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

print("GET /api/orders/?page=NaN")
res_get = requests.get("http://127.0.0.1:8000/api/orders/?page=NaN", headers=headers)
print(res_get.status_code, res_get.text[:200])
