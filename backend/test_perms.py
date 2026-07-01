import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Order
from django.contrib.auth.models import User

order = Order.objects.get(id=30)
buyer = order.user

print(f"Order ID: {order.id}")
print(f"Buyer ID: {buyer.id}")
print(f"order.user_id: {order.user_id}")
print(f"is_buyer check (order.user_id == buyer.id): {order.user_id == buyer.id}")

is_warehouse_staff = buyer.groups.filter(name='warehouse').exists() or buyer.is_superuser or buyer.is_staff
print(f"is_warehouse_staff: {is_warehouse_staff}")

is_seller = False
for item in order.orderitem_set.select_related('product').all():
    seller_id = item.product.seller_id
    if buyer.id == seller_id:
        is_seller = True
        break
print(f"is_seller: {is_seller}")

new_state = 'ASSIGNED_TRANSPORT'

BUYER_ALLOWED_STATES = {'AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'CHECKOUT', 'COMPLETED', 'DISPUTED', 'READY_FOR_TRANSIT', 'ASSIGNED_TRANSPORT'}
STAFF_ONLY_STATES = {
    'PAID', 'EXPIRED', 'RECEIVED_AT_WAREHOUSE', 'AWAITING_DELIVERY_PAYMENT',
    'IN_TRANSIT', 'ARRIVED_AT_REGIONAL_WAREHOUSE', 'READY_FOR_PICKUP', 'DELIVERED', 'PAID_PRODUCT'
}

is_buyer = order.user_id == buyer.id

if new_state in STAFF_ONLY_STATES and not is_warehouse_staff:
    print("Failed STAFF_ONLY_STATES")
elif new_state in BUYER_ALLOWED_STATES and not (is_warehouse_staff or is_buyer):
    print("Failed BUYER_ALLOWED_STATES")
elif not (is_warehouse_staff or is_seller or is_buyer):
    print("Failed NO_ROLE")
else:
    print("Success: Permission Granted!")
