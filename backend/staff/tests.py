from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from staff.models import StaffProfile, StaffPermission, Task, TaskCategory
from staff.serializers import TaskSerializer
from uzachuo.permissions import has_staff_permission, IsStaffMember

User = get_user_model()

class StaffPermissionTestCase(TestCase):
    def setUp(self):
        self.staff_user = User.objects.create_user(username="staff", password="password", is_staff=True)
        self.profile = StaffProfile.objects.create(user=self.staff_user, is_active=True)

    def test_permission_expiration_future(self):
        # Expires in 1 day
        perm = StaffPermission.objects.create(
            user=self.staff_user,
            permission="can_audit",
            expires_at=timezone.now() + timedelta(days=1),
            is_active=True
        )
        self.assertTrue(has_staff_permission(self.staff_user, "can_audit"))

    def test_permission_expiration_past(self):
        # Expired 1 day ago
        perm = StaffPermission.objects.create(
            user=self.staff_user,
            permission="can_audit",
            expires_at=timezone.now() - timedelta(days=1),
            is_active=True
        )
        self.assertFalse(has_staff_permission(self.staff_user, "can_audit"))

    def test_permission_expiration_null(self):
        # No expiration date (permanent)
        perm = StaffPermission.objects.create(
            user=self.staff_user,
            permission="can_audit",
            expires_at=None,
            is_active=True
        )
        self.assertTrue(has_staff_permission(self.staff_user, "can_audit"))


class StaffPermissionsClassTestCase(TestCase):
    def setUp(self):
        self.user_regular = User.objects.create_user(username="regular", password="password")
        self.user_staff_active = User.objects.create_user(username="staff_act", password="password", is_staff=True)
        self.profile_active = StaffProfile.objects.create(user=self.user_staff_active, is_active=True)
        
        self.user_staff_inactive = User.objects.create_user(username="staff_inact", password="password", is_staff=True)
        self.profile_inactive = StaffProfile.objects.create(user=self.user_staff_inactive, is_active=False)

    def test_is_staff_member_perm(self):
        class MockRequest:
            def __init__(self, user):
                self.user = user

        perm = IsStaffMember()
        
        # Regular user should be rejected
        self.assertFalse(perm.has_permission(MockRequest(self.user_regular), None))
        
        # Active staff should be allowed
        self.assertTrue(perm.has_permission(MockRequest(self.user_staff_active), None))
        
        # Inactive staff should be rejected
        self.assertFalse(perm.has_permission(MockRequest(self.user_staff_inactive), None))


class TaskSerializerTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="task_creator", password="password")
        self.category = TaskCategory.objects.create(name="Support", description="Support tasks")

    def test_task_serializer_is_overdue(self):
        # Create overdue task
        task_overdue = Task.objects.create(
            title="Overdue Task",
            description="Details",
            category=self.category,
            created_by=self.user,
            due_date=timezone.now() - timedelta(days=2),
            status="pending"
        )
        
        # Create not overdue task
        task_future = Task.objects.create(
            title="Future Task",
            description="Details",
            category=self.category,
            created_by=self.user,
            due_date=timezone.now() + timedelta(days=2),
            status="pending"
        )
        
        serializer_overdue = TaskSerializer(task_overdue)
        serializer_future = TaskSerializer(task_future)
        
        self.assertTrue(serializer_overdue.data['is_overdue'])
        self.assertFalse(serializer_future.data['is_overdue'])
