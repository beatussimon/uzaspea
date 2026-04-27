import os
import django
from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory, force_authenticate
import sys

# Setup django
sys.path.append('/home/bea/uzaspea/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from inspections.api_views import InspectionRequestViewSet, InspectionReportViewSet
from inspections.models import InspectionRequest, InspectionReport

print("Starting Security Audit...")

# Create/Find two users
u1, _ = User.objects.get_or_create(username='test_user_1')
u2, _ = User.objects.get_or_create(username='test_user_2')

# Create a request for u1
from inspections.models import InspectionCategory
cat = InspectionCategory.objects.first()
req1 = InspectionRequest.objects.create(
    client=u1,
    category=cat,
    item_name="User 1 Private Car",
    item_address="Hidden St",
    item_description="Private"
)

# Test Fetching req1 as u2
factory = APIRequestFactory()
view = InspectionRequestViewSet.as_view({'get': 'list'})
request = factory.get('/api/inspections/requests/')
force_authenticate(request, user=u2)
response = view(request)

print(f"U2 listing requests: {len(response.data.get('results', response.data))} found")
found_req1 = any(r['id'] == req1.id for r in (response.data.get('results', response.data)))
print(f"U2 saw U1's request in list: {found_req1}")

# Test Retrieving req1 directly as u2
view_detail = InspectionRequestViewSet.as_view({'get': 'retrieve'})
request_detail = factory.get(f'/api/inspections/requests/{req1.id}/')
force_authenticate(request_detail, user=u2)
try:
    response_detail = view_detail(request_detail, pk=req1.id)
    print(f"U2 retrieving U1's request detail: Status {response_detail.status_code}")
except Exception as e:
    print(f"U2 retrieving U1's request detail failed: {e}")

# Clean up
req1.delete()
print("Audit Complete.")
