import django
from django.conf import settings
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from staff.api_views import StaffCommissionPaymentViewSet

User = get_user_model()
user = User.objects.filter(is_staff=True).first()

rf = RequestFactory()
request = rf.get('/?status=PENDING')
request.user = user

view = StaffCommissionPaymentViewSet.as_view({'get': 'list'})

try:
    response = view(request)
    print('Status Code:', response.status_code)
except Exception as e:
    import traceback
    traceback.print_exc()

