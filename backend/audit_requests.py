import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from inspections.models import InspectionRequest
from django.contrib.auth.models import User
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory
from inspections.api_views import InspectionRequestViewSet

def test_all_requests():
    factory = APIRequestFactory()
    view = InspectionRequestViewSet.as_view({'get': 'retrieve'})
    admin = User.objects.filter(is_superuser=True).first()
    
    for req in InspectionRequest.objects.all():
        print(f"Testing Request ID: {req.id} ({req.inspection_id})")
        request = factory.get(f'/api/inspections/requests/{req.id}/')
        request.user = admin
        try:
            response = view(request, pk=req.id)
            if response.status_code != 200:
                print(f"  FAILED: Status {response.status_code}")
                print(f"  Data: {response.data}")
            else:
                print(f"  SUCCESS")
        except Exception as e:
            print(f"  CRASH: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    test_all_requests()
