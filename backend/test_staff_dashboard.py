import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory
from staff.api_views import StaffDashboardView

def test_staff_dashboard():
    factory = APIRequestFactory()
    view = StaffDashboardView.as_view()
    
    for user in User.objects.filter(is_staff=True):
        print(f"Testing Dashboard for user: {user.username}")
        request = factory.get('/api/staff/dashboard-summary/')
        request.user = user
        try:
            response = view(request)
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
    test_staff_dashboard()
