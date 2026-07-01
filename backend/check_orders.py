import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Order
orders = Order.objects.order_by('-id')[:5]
for o in orders:
    print(f"Order {o.id}: {o.status}")
