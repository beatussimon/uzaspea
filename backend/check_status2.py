import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from marketplace.models import Order
from marketplace.serializers import OrderSerializer
o = Order.objects.get(id=48)
data = OrderSerializer(o).data
print('status:', data.get('status'))
print('has_vehicles:', data.get('has_vehicles'))
