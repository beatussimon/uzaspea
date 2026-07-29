import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from warehouses.models import Warehouse
import json
print(json.dumps([{'name': w.name, 'code': w.code, 'region_name': w.region.name if w.region else None, 'lat': str(w.latitude), 'lng': str(w.longitude)} for w in Warehouse.objects.all()], indent=2))
