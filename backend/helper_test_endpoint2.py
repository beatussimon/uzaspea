import os
import django
import requests
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token

user = User.objects.get(id=25)
token, _ = Token.objects.get_or_create(user=user)

# Try GET /api/orders/
url_get = "http://127.0.0.1:8000/api/orders/"
headers = {"Authorization": f"Token {token.key}"}
res_get = requests.get(url_get, headers=headers)
print("GET /api/orders/")
print(res_get.status_code, res_get.text[:200])

# Try POST to advance order 30 with ASSIGNED_TRANSPORT
url_post = "http://127.0.0.1:8000/api/orders/30/advance/"
data = {"status": "ASSIGNED_TRANSPORT", "notes": "Test"}
res_post = requests.post(url_post, headers=headers, data=data)
print("POST advance ASSIGNED_TRANSPORT")
print(res_post.status_code, res_post.text)

# Try POST to advance order 30 with PENDING_VERIFICATION
data2 = {"status": "PENDING_VERIFICATION", "notes": "Test2"}
res_post2 = requests.post(url_post, headers=headers, data=data2)
print("POST advance PENDING_VERIFICATION")
print(res_post2.status_code, res_post2.text)
