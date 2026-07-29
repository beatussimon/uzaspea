from django.core.cache import cache
from django.utils import timezone
from rest_framework_simplejwt.tokens import UntypedToken
import logging

logger = logging.getLogger(__name__)

class ActiveUserMiddleware:
    """
    Middleware to track user's last seen timestamp in Redis cache.
    Updates the 'user:seen:{user_id}' key with a 1-minute TTL.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        user_id = None
        if hasattr(request, 'user') and request.user.is_authenticated:
            user_id = request.user.id
        else:
            # Extract from JWT if available
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
                try:
                    validated = UntypedToken(token)
                    user_id = validated.get('user_id')
                except Exception:
                    pass

        if user_id:
            cache_key = f'user:seen:{user_id}'
            # Store timestamp; expiration is handled by cache timeout
            cache.set(cache_key, timezone.now().isoformat(), timeout=60)

        return response
