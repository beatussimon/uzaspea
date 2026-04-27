import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from inspections.api_views import InspectionRequestViewSet
from django.contrib.auth.models import User
import traceback

try:
    factory = APIRequestFactory()
    user = User.objects.filter(is_superuser=True).first()
    if not user:
        user = User.objects.create_superuser('debug_admin', 'debug@example.com', 'password123')
    
    view = InspectionRequestViewSet.as_view({'get': 'retrieve'})
    request = factory.get('/api/inspections/requests/2/')
    force_authenticate(request, user=user)
    response = view(request, pk=2)
    print(f"STATUS: {response.status_code}")
    if response.status_code >= 500:
        print("RESULT: ERROR 500")
    else:
        print(f"DATA: {response.data}")
except Exception:
    print("TRACEBACK:")
    print(traceback.format_exc())
