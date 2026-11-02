import hashlib
import hmac
import mimetypes
import os
import time
from urllib.parse import quote

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.storage import FileSystemStorage
from django.http import FileResponse, Http404, HttpResponse
from PIL import Image
from rest_framework import permissions
from rest_framework.views import APIView


def _sign_private_path(norm_path: str, exp: int) -> str:
    msg = f"privmedia:{norm_path}:{exp}".encode("utf-8")
    return hmac.new(settings.SECRET_KEY.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def build_signed_private_media_url(name: str, ttl_seconds: int = 300) -> str:
    if not name:
        return ""
    norm = os.path.normpath(str(name)).replace("\\", "/").lstrip("/")
    exp = int(time.time()) + ttl_seconds
    sig = _sign_private_path(norm, exp)
    quoted = "/".join(quote(seg) for seg in norm.split("/"))
    return f"{settings.PRIVATE_MEDIA_URL}{quoted}?exp={exp}&sig={sig}"


class PrivateMediaStorage(FileSystemStorage):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("location", settings.PRIVATE_MEDIA_ROOT)
        kwargs.setdefault("base_url", settings.PRIVATE_MEDIA_URL)
        super().__init__(*args, **kwargs)

    def deconstruct(self):
        return ("uzachuo.private_media.PrivateMediaStorage", [], {})

    def url(self, name):
        return build_signed_private_media_url(name)


def verify_magic_bytes(file_obj, allow_pdf: bool = False, max_mb: int = 10):
    if not file_obj:
        return
    if getattr(file_obj, "size", 0) > max_mb * 1024 * 1024:
        raise ValidationError(f"File size must not exceed {max_mb} MB.")

    fname = (getattr(file_obj, "name", "") or "").lower()
    ext = os.path.splitext(fname)[1]
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp"}
    if allow_pdf:
        allowed_exts.add(".pdf")
    if ext not in allowed_exts:
        raise ValidationError(f"Unsupported file extension '{ext}'. Allowed: {', '.join(sorted(allowed_exts))}.")

    pos = file_obj.tell() if hasattr(file_obj, "tell") else 0
    head = file_obj.read(16)
    if hasattr(file_obj, "seek"):
        file_obj.seek(pos)

    is_jpeg = head.startswith(b"\xff\xd8\xff")
    is_png = head.startswith(b"\x89PNG\r\n\x1a\n")
    is_webp = len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    is_pdf = allow_pdf and head.startswith(b"%PDF-")

    if not (is_jpeg or is_png or is_webp or is_pdf):
        raise ValidationError("Invalid or corrupted file header (failed magic-byte verification).")

    if not is_pdf:
        try:
            img = Image.open(file_obj)
            img.verify()
        except Exception as exc:
            raise ValidationError("Uploaded image failed integrity/pixel-limit verification.") from exc
        finally:
            if hasattr(file_obj, "seek"):
                file_obj.seek(pos)


def validate_private_image(file_obj):
    verify_magic_bytes(file_obj, allow_pdf=False, max_mb=10)


def validate_private_document(file_obj):
    verify_magic_bytes(file_obj, allow_pdf=True, max_mb=10)


def validate_digital_master_file(file_obj, file_type: str = "PDF", max_mb: int = 50):
    """Strict magic-byte + extension validator for DigitalAsset master & sample uploads."""
    if not file_obj:
        return
    if getattr(file_obj, "size", 0) > max_mb * 1024 * 1024:
        raise ValidationError(f"Digital asset must not exceed {max_mb} MB.")
    fname = (getattr(file_obj, "name", "") or "").lower()
    ext = os.path.splitext(fname)[1]
    pos = file_obj.tell() if hasattr(file_obj, "tell") else 0
    head = file_obj.read(16)
    if hasattr(file_obj, "seek"):
        file_obj.seek(pos)

    ft = (file_type or "PDF").upper()
    if ft == "PDF":
        if ext != ".pdf" or not head.startswith(b"%PDF-"):
            raise ValidationError("PDF digital assets must be valid .pdf files starting with %PDF-.")
    elif ft == "AUDIO":
        valid_audio_ext = ext in {".mp3", ".m4a", ".m4b", ".wav", ".ogg"}
        valid_audio_sig = (
            head.startswith(b"ID3")
            or (len(head) >= 2 and head[0] == 0xFF and (head[1] & 0xE0) == 0xE0)
            or (len(head) >= 8 and head[4:8] == b"ftyp")
            or (len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WAVE")
            or head.startswith(b"OggS")
        )
        if not (valid_audio_ext and valid_audio_sig):
            raise ValidationError("Audiobook assets must be valid MP3, M4A/M4B, WAV, or OGG audio files.")
    elif ft == "EPUB":
        if ext != ".epub" or not head.startswith(b"PK\x03\x04"):
            raise ValidationError("EPUB digital assets must be valid .epub archives.")
    else:
        if ext not in {".pdf", ".epub", ".mp3", ".m4a", ".m4b", ".zip", ".txt"}:
            raise ValidationError(f"Unsupported digital file extension '{ext}'.")


class ProtectedMediaAuthView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request, rel_path: str):
        clean_rel = os.path.normpath(rel_path).replace("\\", "/").lstrip("/")
        if not clean_rel or clean_rel.startswith(".."):
            raise Http404()

        priv_root = os.path.realpath(str(settings.PRIVATE_MEDIA_ROOT))
        full_path = os.path.realpath(os.path.join(priv_root, clean_rel))
        if os.path.commonpath([full_path, priv_root]) != priv_root or not os.path.isfile(full_path):
            raise Http404()

        exp_raw = request.GET.get("exp")
        sig_raw = request.GET.get("sig")
        authorized = False

        if exp_raw and sig_raw:
            try:
                exp_int = int(exp_raw)
            except ValueError:
                exp_int = 0
            if exp_int >= int(time.time()):
                expected = _sign_private_path(clean_rel, exp_int)
                if hmac.compare_digest(sig_raw, expected):
                    authorized = True

        if not authorized:
            from uzachuo.authentication import GracefulJWTAuthentication
            auth_res = GracefulJWTAuthentication().authenticate(request)
            user = auth_res[0] if auth_res else None
            if user and user.is_authenticated and user.is_active and (user.is_superuser or user.is_staff):
                authorized = True

        if not authorized:
            return HttpResponse("Forbidden", status=403)

        ext = os.path.splitext(full_path)[1].lower()
        safe_mimes = {
            ".pdf": "application/pdf",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
        }
        content_type = safe_mimes.get(ext) or mimetypes.guess_type(full_path)[0] or "application/octet-stream"
        disposition = "inline" if ext in {".jpg", ".jpeg", ".png", ".webp"} else "attachment"
        safe_name = os.path.basename(full_path).replace('"', "")

        if settings.DEBUG:
            resp = FileResponse(open(full_path, "rb"), content_type=content_type)
        else:
            quoted_internal = "/".join(quote(seg) for seg in clean_rel.split("/"))
            resp = HttpResponse(status=200, content_type=content_type)
            resp["X-Accel-Redirect"] = f"/_protected_media/{quoted_internal}"

        resp["Content-Disposition"] = f'{disposition}; filename="{safe_name}"'
        resp["Cache-Control"] = "private, no-store, no-cache, must-revalidate"
        resp["X-Content-Type-Options"] = "nosniff"
        return resp
