import os
import django
import json

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uzachuo.settings")
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model
from marketplace.models import Order

User = get_user_model()
order = Order.objects.get(id=48)
buyer = order.user

client = Client()
client.force_login(buyer)

print(f"Current Order Status: {order.status}")

data = {
    'status': 'PENDING_DELIVERY_VERIFICATION',
    'transaction_id': 'TEST_123',
    'notes': 'Testing delivery fee'
}
response = client.post(f'/api/orders/{order.id}/advance/', data=data)

print(f"Response status: {response.status_code}")
print(f"Response body: {response.content}")
