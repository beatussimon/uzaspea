import os
import django
from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory, force_authenticate
import sys

# Setup django
sys.path.append('/home/bea/uzaspea/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from inspections.api_views import InspectionRequestViewSet
from inspections.models import InspectionRequest, InspectionCategory

print("Starting Staff Security Audit...")

# Find a staff user and a client
staff, _ = User.objects.get_or_create(username='test_staff_1', is_staff=True)
client, _ = User.objects.get_or_create(username='test_client_1')

cat = InspectionCategory.objects.first()
req1 = InspectionRequest.objects.create(
    client=client,
    category=cat,
    item_name="Client Private Car"
)

factory = APIRequestFactory()

# 1. Staff fetches without all=true
view = InspectionRequestViewSet.as_view({'get': 'list'})
request1 = factory.get('/api/inspections/requests/')
force_authenticate(request1, user=staff)
response1 = view(request1)
print(f"Staff listing WITHOUT all=true: {len(response1.data.get('results', response1.data))} found")

# 2. Staff fetches WITH all=true
request2 = factory.get('/api/inspections/requests/?all=true')
force_authenticate(request2, user=staff)
response2 = view(request2)
print(f"Staff listing WITH all=true: {len(response2.data.get('results', response2.data))} found")

# 3. Client fetches WITH all=true
request3 = factory.get('/api/inspections/requests/?all=true')
force_authenticate(request3, user=client)
response3 = view(request3)
print(f"Client listing WITH all=true: {len(response3.data.get('results', response3.data))} found (owned only)")

req1.delete()
print("Audit Complete.")
