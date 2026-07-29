import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from django.contrib.auth.models import User
try:
    u = User.objects.get(id=1)
    print("User 1 active:", u.is_active)
    print("User 1 username:", u.username)
except User.DoesNotExist:
    print("User 1 does not exist")
