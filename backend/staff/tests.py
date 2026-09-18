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
        
        self.user_staff_inactive = User.objects.create_user(username="staff_inact", password="password", is_staff=False)
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


from rest_framework.test import APITestCase
from marketplace.models import SubscriptionTier, Subscription, PaymentConfirmation, UserProfile
from billing.models import MonthlyInvoice, CommissionPayment

class StaffPaymentAndCommissionOverdueTestCase(APITestCase):
    def setUp(self):
        self.staff_user = User.objects.create_user(username="staff_admin", password="password", is_staff=True)
        StaffProfile.objects.create(user=self.staff_user, is_active=True)
        self.client.force_authenticate(user=self.staff_user)

        # Seller 1 with expired subscription
        self.seller1 = User.objects.create_user(
            username="seller1", email="seller1@example.com",
            password="password", first_name="John", last_name="Doe"
        )
        UserProfile.objects.filter(user=self.seller1).update(
            phone_number="+255711222333", whatsapp_number="+255711222333",
            location="Dar es Salaam", tier="seller_pro"
        )
        self.tier = SubscriptionTier.objects.create(
            name="Seller Pro", price=Decimal("29000.00"), duration=30,
            tier_level="seller_pro", is_active=True
        )

        Subscription.objects.create(
            user=self.seller1,
            tier=self.tier,
            start_date=timezone.now() - timedelta(days=40),
            end_date=timezone.now() - timedelta(days=10),
            is_active=False
        )

        # Monthly Invoice for seller1
        self.invoice1 = MonthlyInvoice.objects.create(
            seller=self.seller1,
            year=2026,
            month=8,
            total_order_amount=Decimal("500000.00"),
            total_commission=Decimal("50000.00"),
            subscription_fee=Decimal("29000.00"),
            total_amount_due=Decimal("79000.00"),
            order_count=5,
            status=MonthlyInvoice.Status.OVERDUE,
            due_date=timezone.now().date() - timedelta(days=5)
        )

    def test_payment_confirmation_overdue_and_analytics(self):
        # Test overdue subscriptions endpoint
        response = self.client.get('/api/staff/payment-confirmations/overdue/')
        self.assertEqual(response.status_code, 200)
        data = response.data.get('results', response.data)
        self.assertTrue(any(item['username'] == 'seller1' for item in data))
        seller_item = next(item for item in data if item['username'] == 'seller1')
        self.assertEqual(seller_item['phone_number'], '+255711222333')
        self.assertEqual(seller_item['store_url'], '/seller1')
        self.assertEqual(seller_item['tier_name'], 'Seller Pro')
        self.assertTrue(seller_item['days_overdue'] >= 10)

        # Test subscription analytics endpoint
        res_analytics = self.client.get('/api/staff/payment-confirmations/analytics/')
        self.assertEqual(res_analytics.status_code, 200)
        self.assertIn('kpis', res_analytics.data)
        self.assertIn('monthly_trend', res_analytics.data)
        self.assertIn('tier_breakdown', res_analytics.data)
        self.assertIn('status_distribution', res_analytics.data)

    def test_commission_payment_overdue_and_analytics(self):
        # Test overdue commissions endpoint
        response = self.client.get('/api/staff/commission-payments/overdue/')
        self.assertEqual(response.status_code, 200)
        data = response.data.get('results', response.data)
        self.assertTrue(any(item['seller_username'] == 'seller1' for item in data))
        invoice_item = next(item for item in data if item['seller_username'] == 'seller1')
        self.assertEqual(invoice_item['phone_number'], '+255711222333')
        self.assertEqual(invoice_item['store_url'], '/seller1')
        self.assertEqual(invoice_item['total_commission'], 50000.0)
        self.assertEqual(invoice_item['total_amount_due'], 79000.0)
        self.assertTrue(invoice_item['days_overdue'] >= 5)

        # Test commission analytics endpoint
        res_analytics = self.client.get('/api/staff/commission-payments/analytics/')
        self.assertEqual(res_analytics.status_code, 200)
        self.assertIn('kpis', res_analytics.data)
        self.assertIn('monthly_trend', res_analytics.data)
        self.assertIn('status_distribution', res_analytics.data)
        self.assertIn('top_debtors', res_analytics.data)
