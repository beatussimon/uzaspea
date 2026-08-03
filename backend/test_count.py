import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from marketplace.models import Product
from rest_framework.test import APIClient
print('Total Products:', Product.objects.count())
client = APIClient()
response = client.get('/api/products/')
print('Default response count:', len(response.data.get('results', [])))
print('Total in DB from response:', response.data.get('count'))
