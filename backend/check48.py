import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from marketplace.models import Order
from marketplace.serializers import OrderSerializer
o = Order.objects.get(id=48)
print(OrderSerializer(o).data.get('has_vehicles'))
