import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Order
order = Order.objects.get(id=30)
print(f"Order 30 status: {order.status}")

for payment in order.payments.all():
    print(f"Payment {payment.id}: {payment.status}")
