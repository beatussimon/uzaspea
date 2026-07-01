import django
import sys
from django.conf import settings
from django.contrib.auth.models import User

u = User.objects.get(username='bsans')
print(f'bsans Active: {u.is_active}')
u.is_active = True
u.save()
print('bsans unbanned')
