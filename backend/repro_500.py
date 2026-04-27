import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from django.contrib.auth.models import User
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory
from inspections.api_views import InspectionRequestViewSet
import traceback

def reproduce():
    factory = APIRequestFactory()
    view = InspectionRequestViewSet.as_view({'get': 'retrieve'})
    user = User.objects.filter(is_superuser=True).first()
    
    request = factory.get('/api/inspections/requests/2/')
    request.user = user
    try:
        response = view(request, pk=2)
        print(f"Status: {response.status_code}")
        if response.status_code == 500:
            print("REPRODUCED 500!")
        else:
            print(f"Data: {response.data}")
    except Exception:
        print("CRASHED!")
        traceback.print_exc()

if __name__ == "__main__":
    reproduce()
