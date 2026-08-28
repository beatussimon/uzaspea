from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed

class GracefulJWTAuthentication(JWTAuthentication):
    """
    Custom JWT Authentication class that allows public views (AllowAny) to work
    seamlessly even when clients send an expired or invalid JWT token from localStorage.
    
    If the token is invalid/expired, it falls back to anonymous user (returning None).
    Protected views with IsAuthenticated permission will still strictly enforce
    authentication and return 401 if the user is not authenticated.
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
            return self.get_user(validated_token), validated_token
        except (InvalidToken, AuthenticationFailed):
            # Return None to treat as unauthenticated/anonymous without hard 401 abort
            return None
