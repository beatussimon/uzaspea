from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed


class GracefulJWTAuthentication(JWTAuthentication):
    """
    Custom JWT Authentication class that allows public views (AllowAny) to work
    seamlessly even when clients send an expired, invalid, or revoked JWT token.

    If the token is invalid/expired/revoked or the user is inactive, it falls back
    to anonymous user (returning None). Protected views with IsAuthenticated
    permission will strictly enforce authentication and return 401.
    """

    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
            if not user or not user.is_active:
                return None

            from uzachuo.auth_cookies import get_auth_cache
            auth_cache = get_auth_cache()
            iat_ms = validated_token.get("iat_ms")
            if iat_ms is not None:
                revoked_ms = auth_cache.get(f"user:revoked_at_ms:{user.id}")
                if revoked_ms is not None and int(iat_ms) <= int(revoked_ms):
                    return None
            else:
                revoked_at = auth_cache.get(f"user:revoked_at:{user.id}")
                if revoked_at is not None and int(validated_token.get("iat", 0)) <= int(revoked_at):
                    return None

            return user, validated_token
        except (InvalidToken, AuthenticationFailed):
            return None
