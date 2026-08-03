import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from rest_framework.test import APIClient
client = APIClient()
response = client.get('/api/products/?page_size=12')
print('Response count with page_size=12:', len(response.data.get('results', [])))
