import django
from django.test import RequestFactory
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import User
import json

u = User.objects.get(username='bsans')
u.is_active = False
u.save()

request = RequestFactory().post('/api/auth/token/', {'username': 'bsans', 'password': 'password'}, content_type='application/json')
view = TokenObtainPairView.as_view()
response = view(request)
print(f'Status: {response.status_code}')
print(f'Data: {response.data}')

u.is_active = True
u.save()
