import os
import django
import requests

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from marketplace.models import Order

user = User.objects.get(id=25)
token, _ = Token.objects.get_or_create(user=user)

url = "http://127.0.0.1:8000/api/orders/30/advance/"
headers = {
    "Authorization": f"Token {token.key}"
}
data = {
    "status": "ASSIGNED_TRANSPORT",
    "notes": "Test via script"
}

print(f"Making request as {user.username} with token {token.key}")
response = requests.post(url, headers=headers, data=data)

print(f"Status Code: {response.status_code}")
print(f"Response Body: {response.text}")
