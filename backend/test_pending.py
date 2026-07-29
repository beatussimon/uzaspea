import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from marketplace.models import Order
from warehouses.models import Warehouse
for o in Order.objects.filter(status='SHIPPED_TO_WAREHOUSE'):
    print(o.id, o.status, o.delivery_info)
