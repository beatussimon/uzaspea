import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from marketplace.models import Order
try:
    o = Order.objects.get(id=67)
    print(f'Order 67 Status: {o.status}')
    print(f'Delivery Info: {o.delivery_info}')
except Exception as e:
    print(e)
