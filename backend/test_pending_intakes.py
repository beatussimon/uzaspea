import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from django.db.models import Q
from marketplace.models import Order
from warehouses.models import Warehouse
from rest_framework.test import APIRequestFactory

warehouse = Warehouse.objects.get(code='WH-MTWARA-01')
orders = Order.objects.filter(
    (Q(status='SHIPPED_TO_WAREHOUSE') & (Q(delivery_info__warehouse_code=warehouse.code) | Q(delivery_info__isnull=True) | Q(delivery_info={}))) |
    (Q(status__in=['IN_TRANSIT', 'ARRIVED_AT_REGIONAL_WAREHOUSE', 'FAILED_DELIVERY']) & Q(delivery_info__destination_warehouse_code=warehouse.code))
).order_by('order_date')
print(f'Pending Intakes for Mtwara ({warehouse.code}):')
for o in orders:
    print(f'Order {o.id}: Status {o.status}')
