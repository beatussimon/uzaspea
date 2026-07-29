import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from marketplace.models import Order
try:
    o = Order.objects.get(id=67)
    o.delivery_info['warehouse_code'] = 'WH-DAR-ES-SALAAM-01'
    o.save()
    print('Order 67 fixed.')
except Exception as e:
    print('Error:', e)
