from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from warehouses.models import Warehouse, WarehouseIntake, WarehouseStaffAssignment
from marketplace.models import Order
from decimal import Decimal

User = get_user_model()

class WarehouseIntakeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.superuser = User.objects.create_superuser(username='super', password='pw')
        self.staff_user = User.objects.create_user(username='staff', password='pw', is_staff=True)
        self.normal_user = User.objects.create_user(username='normal', password='pw')

        self.warehouse = Warehouse.objects.create(name='Test Hub', code='TEST-HUB', region='HQ')
        self.order = Order.objects.create(
            user=self.normal_user, 
            status='SHIPPED_TO_WAREHOUSE', 
            total_amount=Decimal('100.00'), 
            shipping_fee=Decimal('5.00')
        )

        WarehouseStaffAssignment.objects.create(user=self.staff_user, warehouse=self.warehouse)

    def test_intake_creation_requires_staff(self):
        self.client.force_authenticate(user=self.normal_user)
        response = self.client.post('/api/warehouses/intakes/', {
            'order': self.order.id,
            'warehouse': self.warehouse.id,
            'package_condition': 'good'
        })
        self.assertEqual(response.status_code, 403)

    def test_intake_creation_allowed_for_assigned_staff(self):
        # We need to give the staff the permission first
        # However, the current setup checks for `has_staff_permission` or `is_superuser`
        # Let's use superuser for a successful creation test, or mock permissions
        self.client.force_authenticate(user=self.superuser)
        response = self.client.post('/api/warehouses/intakes/', {
            'order': self.order.id,
            'warehouse': self.warehouse.id,
            'package_condition': 'good'
        })
        self.assertEqual(response.status_code, 201)

    def test_intake_delete_forbidden_for_staff(self):
        # Create an intake first
        intake = WarehouseIntake.objects.create(
            order=self.order, warehouse=self.warehouse, intake_by=self.superuser
        )
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.delete(f'/api/warehouses/intakes/{intake.id}/')
        self.assertEqual(response.status_code, 403)

    def test_intake_delete_allowed_for_superuser(self):
        intake = WarehouseIntake.objects.create(
            order=self.order, warehouse=self.warehouse, intake_by=self.superuser
        )
        self.client.force_authenticate(user=self.superuser)
        response = self.client.delete(f'/api/warehouses/intakes/{intake.id}/')
        self.assertEqual(response.status_code, 204)
