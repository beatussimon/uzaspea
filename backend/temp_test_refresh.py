import django
import sys
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.filter(username='halima').first()
if not user:
    print('User not found')
    sys.exit(1)

refresh = RefreshToken.for_user(user)
print('Refresh token claims:', refresh.payload.keys())
access = refresh.access_token
print('Access token claims:', access.payload.keys())

