import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from warehouses.views import WarehouseIntakeViewSet
from warehouses.models import Warehouse
User = get_user_model()
try:
    user = User.objects.filter(is_superuser=True).first()
    warehouse = Warehouse.objects.get(code='WH-DAR-ES-SALAAM-01')
    
    factory = RequestFactory()
    request = factory.post('/api/warehouses/intakes/', {
        'warehouse': warehouse.id,
        'order': 67,
        'package_condition': 'good',
        'notes': 'test'
    })
    request.user = user
    
    view = WarehouseIntakeViewSet.as_view({'post': 'create'})
    response = view(request)
    print('Intake Status:', response.status_code)
    print('Intake Data:', response.data)
except Exception as e:
    print('Error:', e)
