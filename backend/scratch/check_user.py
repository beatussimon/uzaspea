
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzaspea.settings')
django.setup()

from django.contrib.auth.models import User
from inspections.models import InspectorProfile
from staff.models import StaffPermission

try:
    user = User.objects.get(username='seller1')
    print(f"User: {user.username}")
    print(f"Is Staff: {user.is_staff}")
    print(f"Is Superuser: {user.is_superuser}")
    
    has_profile = hasattr(user, 'inspector_profile')
    print(f"Has Inspector Profile: {has_profile}")
    
    perms = StaffPermission.objects.filter(user=user, is_active=True).values_list('permission', flat=True)
    print(f"Staff Permissions: {list(perms)}")
    
except User.DoesNotExist:
    print("User 'seller1' not found")
