import django
from django.test import RequestFactory
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.contrib.auth.models import User

u = User.objects.get(username='bsans')
u.is_active = False
u.save()

refresh = RefreshToken.for_user(u)
access = refresh.access_token

auth = JWTAuthentication()
try:
    user = auth.get_user(access)
    print(f'Authenticated: {user}')
except Exception as e:
    print(f'Authentication Error: {e.__class__.__name__}: {e}')

u.is_active = True
u.save()
