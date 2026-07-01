import django
import sys
from django.conf import settings
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from marketplace.api_views import CustomTokenObtainPairSerializer

User = get_user_model()
user = User.objects.filter(username='halima').first()

class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        refresh = self.token_class(attrs['refresh'])
        user_id = refresh.payload.get('user_id')
        if user_id:
            user = User.objects.get(id=user_id)
            new_token = CustomTokenObtainPairSerializer.get_token(user)
            data['access'] = str(new_token.access_token)
        return data

# Create old refresh token (without claims)
old_refresh = RefreshToken.for_user(user)

# Serialize
serializer = CustomTokenRefreshSerializer(data={'refresh': str(old_refresh)})
if serializer.is_valid():
    new_access = serializer.validated_data['access']
    from rest_framework_simplejwt.tokens import AccessToken
    decoded = AccessToken(new_access)
    print('New access claims:', decoded.payload.keys())
    print('Tier:', decoded.payload.get('tier'))
else:
    print('Errors:', serializer.errors)
