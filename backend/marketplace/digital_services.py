import os
import io
import re
import json
import secrets
import hashlib
import hmac
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.utils import timezone
from django.http import HttpResponse, StreamingHttpResponse, Http404
from django.core.exceptions import PermissionDenied

from .models import DigitalAsset, DigitalAccessLicense, DigitalAccessToken


def generate_access_token(license_obj, token_type='READ', client_ip=None, expires_in_seconds=900):
    """
    Generate a cryptographically secure, short-lived digital access token (default 15 minutes).
    Used to access streaming chunks or protected download endpoints without exposing vault file URLs.
    """
    token_str = secrets.token_urlsafe(40)
    expires_at = timezone.now() + timedelta(seconds=expires_in_seconds)
    
    token_obj = DigitalAccessToken.objects.create(
        token=token_str,
        license=license_obj,
        token_type=token_type,
        expires_at=expires_at,
        client_ip=client_ip
    )
    return token_obj


def validate_access_token(token_str, expected_type=None, client_ip=None):
    """
    Validates a token string:
    - Must exist in DB
    - Must not be expired
    - Must match expected_type if specified
    - Must belong to an ACTIVE license whose order is in a valid paid state
    Returns tuple: (token_obj, license_obj, error_message)
    """
    if not token_str:
        return None, None, "Missing access token"
        
    try:
        token_obj = DigitalAccessToken.objects.select_related(
            'license', 'license__user', 'license__order', 'license__digital_asset'
        ).get(token=token_str)
    except DigitalAccessToken.DoesNotExist:
        return None, None, "Invalid or unrecognized access token"

    if token_obj.is_expired():
        return None, None, "Access token has expired. Please refresh your session."

    if token_obj.is_used:
        return None, None, "Token already used"

    if expected_type and token_obj.token_type != expected_type:
        return None, None, f"Token type mismatch (expected {expected_type}, got {token_obj.token_type})"

    license_obj = token_obj.license
    if not license_obj.is_valid():
        return None, None, f"Digital license is {license_obj.status.lower()} or order is not completed."

    return token_obj, license_obj, None


def get_or_create_watermarked_pdf(source_file_path: str, license_obj) -> str:
    """
    Creates or reuses a disk-cached watermarked PDF in SECURE_DIGITAL_ROOT / '_watermarked'.
    Uses template page caching so only 1 watermark Canvas is built per unique page dimension.
    Returns the relative path under SECURE_DIGITAL_ROOT (e.g. '_watermarked/lic_123_abc.pdf')
    for zero-RAM serving via X-Accel-Redirect.
    """
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.colors import Color
        from pypdf import PdfReader, PdfWriter
    except ImportError as exc:
        raise RuntimeError(f"Missing PDF watermarking dependencies (pypdf/reportlab): {exc}") from exc

    vault_root = getattr(settings, 'SECURE_DIGITAL_ROOT', '/tmp')
    cache_dir = os.path.join(vault_root, '_watermarked')
    os.makedirs(cache_dir, exist_ok=True)

    asset = license_obj.digital_asset
    checksum_tag = (asset.sha256_checksum or "v1")[:12]
    rel_path = f"_watermarked/lic_{license_obj.id}_{checksum_tag}.pdf"
    full_target_path = os.path.join(vault_root, rel_path)

    if os.path.exists(full_target_path) and os.path.getsize(full_target_path) > 0:
        return rel_path

    file_size = os.path.getsize(source_file_path) if os.path.exists(source_file_path) else 0
    if file_size > 35 * 1024 * 1024:
        return os.path.relpath(source_file_path, vault_root).replace('\\', '/')

    input_reader = PdfReader(source_file_path)
    num_pages = len(input_reader.pages)
    if num_pages == 0:
        return os.path.relpath(source_file_path, vault_root).replace('\\', '/')

    buyer = license_obj.user
    buyer_name = f"{buyer.first_name} {buyer.last_name}".strip() if buyer else "Valued Customer"
    buyer_email = (buyer.email if buyer else "") or (buyer.username if buyer else "Customer")
    order_id = license_obj.order_id
    lic_key = license_obj.license_key

    footer_text = f"Licensed exclusively to {buyer_name} ({buyer_email}) • SokoniMax Order #{order_id} • {lic_key}"
    diagonal_text = f"Verified Buyer: {buyer_email} • {lic_key}"

    writer = PdfWriter()
    watermark_cache = {}

    for idx, page in enumerate(input_reader.pages):
        page_box = page.mediabox
        page_width = float(page_box.width)
        page_height = float(page_box.height)
        dim_key = (int(round(page_width)), int(round(page_height)))

        if dim_key not in watermark_cache:
            wm_buffer = io.BytesIO()
            c = canvas.Canvas(wm_buffer, pagesize=(page_width, page_height))

            # 1. Subtle diagonal watermark across center
            c.saveState()
            c.translate(page_width / 2.0, page_height / 2.0)
            c.rotate(45)
            c.setFont("Helvetica-Bold", 14)
            c.setFillColor(Color(0.2, 0.2, 0.2, alpha=0.07))
            c.drawCentredString(0, 0, diagonal_text)
            c.restoreState()

            # 2. Running footer at bottom
            c.saveState()
            c.setFont("Helvetica", 7.5)
            c.setFillColor(Color(0.25, 0.25, 0.25, alpha=0.55))
            c.drawString(24, 16, footer_text)
            c.restoreState()

            c.save()
            wm_buffer.seek(0)
            wm_reader = PdfReader(wm_buffer)
            watermark_cache[dim_key] = wm_reader.pages[0]

        page.merge_page(watermark_cache[dim_key])
        writer.add_page(page)

    metadata_payload = {
        'license_key': lic_key,
        'buyer_id': buyer.id if buyer else None,
        'order_id': order_id,
        'buyer_email': buyer_email,
        'stamped_at': timezone.now().isoformat(),
        'vault_signature': hmac.new(
            settings.SECRET_KEY.encode('utf-8'),
            f"{lic_key}:{order_id}:{buyer.id if buyer else 0}".encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
    }
    writer.add_metadata({
        '/SokoniMaxDigitalLicense': json.dumps(metadata_payload),
        '/Producer': 'SokoniMax Protected Digital Vault',
    })

    tmp_target_path = f"{full_target_path}.tmp"
    with open(tmp_target_path, 'wb') as f_out:
        writer.write(f_out)
    os.replace(tmp_target_path, full_target_path)

    return rel_path


def apply_pdf_watermark(source_file_path_or_buffer, license_obj):
    """
    Injects visible forensic identity stamp and invisible steganographic metadata into a PDF file.
    Fail-closed if required PDF libraries are missing.
    """
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.colors import Color
        from pypdf import PdfReader, PdfWriter
    except ImportError as exc:
        raise RuntimeError(f"Missing PDF watermarking dependencies (pypdf/reportlab): {exc}") from exc


    # Read input PDF
    if isinstance(source_file_path_or_buffer, str):
        with open(source_file_path_or_buffer, 'rb') as f:
            pdf_bytes = f.read()
    elif hasattr(source_file_path_or_buffer, 'read'):
        pdf_bytes = source_file_path_or_buffer.read()
    else:
        pdf_bytes = bytes(source_file_path_or_buffer)

    input_reader = PdfReader(io.BytesIO(pdf_bytes))
    num_pages = len(input_reader.pages)
    if num_pages == 0:
        return pdf_bytes

    buyer = license_obj.user
    buyer_name = f"{buyer.first_name} {buyer.last_name}".strip() or buyer.username
    buyer_email = buyer.email or buyer.username
    order_id = license_obj.order_id
    lic_key = license_obj.license_key

    footer_text = f"Licensed exclusively to {buyer_name} ({buyer_email}) • SokoniMax Order #{order_id} • {lic_key}"
    diagonal_text = f"Verified Buyer: {buyer_email} • {lic_key}"

    # Build watermark overlays using the dimensions of each page
    writer = PdfWriter()

    for idx, page in enumerate(input_reader.pages):
        page_box = page.mediabox
        page_width = float(page_box.width)
        page_height = float(page_box.height)

        wm_buffer = io.BytesIO()
        c = canvas.Canvas(wm_buffer, pagesize=(page_width, page_height))

        # 1. Subtle diagonal watermark across center
        c.saveState()
        c.translate(page_width / 2.0, page_height / 2.0)
        c.rotate(45)
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(Color(0.2, 0.2, 0.2, alpha=0.07))
        c.drawCentredString(0, 0, diagonal_text)
        c.restoreState()

        # 2. Running footer at bottom
        c.saveState()
        c.setFont("Helvetica", 7.5)
        c.setFillColor(Color(0.25, 0.25, 0.25, alpha=0.55))
        c.drawString(24, 16, footer_text)
        page_label = f"Page {idx + 1} of {num_pages}"
        c.drawRightString(page_width - 24, 16, page_label)
        c.restoreState()

        c.save()
        wm_buffer.seek(0)

        wm_reader = PdfReader(wm_buffer)
        watermark_page = wm_reader.pages[0]

        # Merge watermark onto original page
        page.merge_page(watermark_page)
        writer.add_page(page)

    # Steganographic metadata
    metadata_payload = {
        'license_key': lic_key,
        'buyer_id': buyer.id,
        'order_id': order_id,
        'buyer_email': buyer_email,
        'stamped_at': timezone.now().isoformat(),
        'vault_signature': hmac.new(
            settings.SECRET_KEY.encode('utf-8'),
            f"{lic_key}:{order_id}:{buyer.id}".encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
    }
    writer.add_metadata({
        '/SokoniMaxDigitalLicense': json.dumps(metadata_payload),
        '/Producer': 'SokoniMax Protected Digital Vault',
    })

    output_stream = io.BytesIO()
    writer.write(output_stream)
    return output_stream.getvalue()


class ChunkedRangeFileStreamer:
    """
    Handles streaming of large audio/video files with HTTP 206 Partial Content and Range headers.
    Enables seeking, scrubbing, and fast progressive playback without loading the full file into memory.
    """
    def __init__(self, file_path, request, chunk_size=128 * 1024):
        self.file_path = file_path
        self.request = request
        self.chunk_size = chunk_size
        self.file_size = os.path.getsize(file_path)

    def get_response(self, content_type='audio/mpeg'):
        range_header = self.request.META.get('HTTP_RANGE', '').strip()
        range_match = re.match(r'bytes=(\d+)-(\d*)', range_header)

        if range_match:
            start = int(range_match.group(1))
            end = int(range_match.group(2)) if range_match.group(2) else self.file_size - 1
            if start >= self.file_size or end >= self.file_size or start > end:
                resp = HttpResponse(status=416)
                resp['Content-Range'] = f'bytes */{self.file_size}'
                return resp

            length = end - start + 1
            response = StreamingHttpResponse(
                self._file_iterator(start, length),
                status=206,
                content_type=content_type
            )
            response['Content-Range'] = f'bytes {start}-{end}/{self.file_size}'
            response['Content-Length'] = str(length)
        else:
            response = StreamingHttpResponse(
                self._file_iterator(0, self.file_size),
                status=200,
                content_type=content_type
            )
            response['Content-Length'] = str(self.file_size)

        response['Accept-Ranges'] = 'bytes'
        response['Cache-Control'] = 'private, no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        return response

    def _file_iterator(self, offset, length):
        with open(self.file_path, 'rb') as f:
            f.seek(offset)
            remaining = length
            while remaining > 0:
                read_len = min(self.chunk_size, remaining)
                data = f.read(read_len)
                if not data:
                    break
                remaining -= len(data)
                yield data


def issue_offline_lease(license_obj, device_fingerprint=None, lease_days=30):
    """
    Issues or renews a cryptographic offline access lease for the client device.
    Allows IndexedDB / WebCrypto encrypted caching on buyer's device valid for up to 30 days.
    """
    expires_at = timezone.now() + timedelta(days=lease_days)
    
    # Track device fingerprint
    fingerprints = list(license_obj.device_fingerprints or [])
    if device_fingerprint and device_fingerprint not in fingerprints:
        fingerprints.append(device_fingerprint)
        if len(fingerprints) > 5:
            fingerprints = fingerprints[-5:]
        license_obj.device_fingerprints = fingerprints

    license_obj.offline_lease_expires_at = expires_at
    license_obj.last_accessed_at = timezone.now()
    license_obj.save(update_fields=['offline_lease_expires_at', 'last_accessed_at', 'device_fingerprints'])

    payload = {
        'license_key': license_obj.license_key,
        'user_id': license_obj.user_id,
        'asset_id': license_obj.digital_asset_id,
        'expires_at': expires_at.isoformat(),
        'device_fingerprint': device_fingerprint or 'default',
    }
    
    payload_str = json.dumps(payload, sort_keys=True)
    lease_signature = hmac.new(
        settings.SECRET_KEY.encode('utf-8'),
        payload_str.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    return {
        'license_key': license_obj.license_key,
        'expires_at': expires_at.isoformat(),
        'lease_payload': payload,
        'lease_signature': lease_signature,
        'remaining_days': lease_days
    }
