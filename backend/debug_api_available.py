import os
import django
import sys
from rest_framework.test import APIRequestFactory, force_authenticate

sys.path.append('/home/bea/uzaspea/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from inspections.api_views import InspectorProfileViewSet
from django.contrib.auth.models import User

factory = APIRequestFactory()
view = InspectorProfileViewSet.as_view({'get': 'available'})

# Test for category 7 (Sedans)
request = factory.get('/api/inspections/inspectors/available/?category_id=7')
user = User.objects.get(username='bsans') # A staff user
force_authenticate(request, user=user)

response = view(request)
print(f"STATUS: {response.status_code}")
print(f"DATA: {response.data}")
