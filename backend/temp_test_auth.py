import django
from django.test import RequestFactory
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User

u = User.objects.get(username='bsans')
u.is_active = False
u.save()

refresh = RefreshToken.for_user(u)
try:
    refresh.verify()
    print('Token is valid')
except Exception as e:
    print(f'Verification Error: {e}')

u.is_active = True
u.save()
