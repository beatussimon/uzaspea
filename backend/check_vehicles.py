import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from marketplace.models import Order
from logistics.utils import order_has_vehicles
print([(o.id, o.status, order_has_vehicles(o)) for o in Order.objects.all()])
