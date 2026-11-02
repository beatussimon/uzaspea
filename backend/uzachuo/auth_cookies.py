import secrets
from django.conf import settings
from django.core.cache import caches
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken


def get_auth_cache():
    return caches["auth"] if "auth" in settings.CACHES else caches["default"]


def set_auth_cookies(response, refresh_token_str: str):
    max_age = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
    response.set_cookie(
        key=settings.AUTH_REFRESH_COOKIE_NAME,
        value=refresh_token_str,
        max_age=max_age,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
        secure=settings.AUTH_COOKIE_SECURE,
        httponly=True,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    response.set_cookie(
        key=settings.AUTH_HINT_COOKIE_NAME,
        value="1",
        max_age=max_age,
        path="/",
        secure=settings.AUTH_COOKIE_SECURE,
        httponly=False,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


def clear_auth_cookies(response):
    response.delete_cookie(
        key=settings.AUTH_REFRESH_COOKIE_NAME,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key=settings.AUTH_HINT_COOKIE_NAME,
        path="/",
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


def enforce_cookie_csrf_defense(request):
    if request.headers.get("X-Requested-With") != "XMLHttpRequest":
        raise PermissionDenied("Missing X-Requested-With security header.")
    origin = request.headers.get("Origin")
    if origin and not settings.DEBUG:
        allowed = {
            o.rstrip("/")
            for o in (list(settings.CORS_ALLOWED_ORIGINS) + list(settings.CSRF_TRUSTED_ORIGINS))
            if o
        }
        if origin.rstrip("/") not in allowed:
            raise PermissionDenied("Untrusted Origin.")


def revoke_all_user_tokens(user):
    tokens = OutstandingToken.objects.filter(user=user)
    existing = set(BlacklistedToken.objects.filter(token__in=tokens).values_list("token_id", flat=True))
    to_create = [BlacklistedToken(token=t) for t in tokens if t.id not in existing]
    if to_create:
        BlacklistedToken.objects.bulk_create(to_create, ignore_conflicts=True)
    now_ts = timezone.now().timestamp()
    auth_cache = get_auth_cache()
    auth_cache.set(f"user:revoked_at:{user.id}", int(now_ts), timeout=900)
    auth_cache.set(f"user:revoked_at_ms:{user.id}", int(now_ts * 1000), timeout=900)


def issue_ws_ticket(user_id: int) -> str:
    ticket = secrets.token_urlsafe(32)
    get_auth_cache().set(f"ws_ticket:{ticket}", int(user_id), timeout=30)
    return ticket


def consume_ws_ticket(ticket: str):
    if not ticket or len(ticket) > 128:
        return None
    cache = get_auth_cache()
    key = f"ws_ticket:{ticket}"
    user_id = cache.get(key)
    if user_id is not None:
        cache.delete(key)
    return user_id
