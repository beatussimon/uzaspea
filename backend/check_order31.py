import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Order
try:
    order = Order.objects.get(id=31)
    print(f"Order 31 status: {order.status}")
    for payment in order.payments.all():
        print(f"Payment {payment.id}: {payment.status}")
except Exception as e:
    print(e)
