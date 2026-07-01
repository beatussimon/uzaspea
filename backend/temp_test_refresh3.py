import django
import sys
from django.conf import settings
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()
user = User.objects.filter(username='halima').first()
refresh = str(RefreshToken.for_user(user))

client = APIClient()
res = client.post('/api/auth/token/refresh/', {'refresh': refresh})
print('Status:', res.status_code)
if res.status_code == 200:
    from rest_framework_simplejwt.tokens import AccessToken
    decoded = AccessToken(res.data['access'])
    print('Tier in token:', decoded.payload.get('tier'))
else:
    print(res.data)
