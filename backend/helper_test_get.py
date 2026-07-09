import os
import django
import requests

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken

user = User.objects.get(id=25)
refresh = RefreshToken.for_user(user)
access_token = str(refresh.access_token)

headers = {
    "Authorization": f"Bearer {access_token}"
}

print("GET /api/orders/")
res_get = requests.get("http://127.0.0.1:8000/api/orders/?page=1", headers=headers)
print(res_get.status_code, res_get.text[:200])

print("GET /api/orders/?status=ASSIGNED_TRANSPORT")
res_get2 = requests.get("http://127.0.0.1:8000/api/orders/?page=1&status=ASSIGNED_TRANSPORT", headers=headers)
print(res_get2.status_code, res_get2.text[:200])
