import os
import django
import requests
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken

user = User.objects.get(id=25)
refresh = RefreshToken.for_user(user)
access_token = str(refresh.access_token)

url_post = "http://127.0.0.1:8000/api/orders/"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}
orderData = {
    "items": [{"product": 183, "quantity": 1}],
    "total_amount": 1000,
    "shipping_method": "DELIVERY",
    "shipping_fee": 0,
    "delivery_info": {
        "full_name": "Test User",
        "phone": "0700000000",
        "address": "Dar, Ilala",
        "warehouse_code": "DAR-1"
    }
}

print("POST /api/orders/")
res_post = requests.post(url_post, headers=headers, json=orderData)
print(res_post.status_code, res_post.text)
