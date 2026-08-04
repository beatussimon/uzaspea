import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Order

order = Order.objects.first()
if order:
    print('Before:', order.delivery_info)
    if not order.delivery_info:
        order.delivery_info = {}
    new_di = dict(order.delivery_info)
    new_di['test_key'] = 'test_value'
    order.delivery_info = new_di
    order.save(update_fields=['delivery_info'])
    
    order.refresh_from_db()
    print('After:', order.delivery_info)
