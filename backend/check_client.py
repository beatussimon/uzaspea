import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from django.test import Client
from django.contrib.auth import get_user_model
User = get_user_model()
client = Client()
user = User.objects.get(username='halima')
client.force_login(user)
response = client.get('/api/orders/')
print(response.json())
