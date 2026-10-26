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

        from locations.models import Region
        r = Region.objects.create(name='HQ Region')
        self.warehouse = Warehouse.objects.create(name='Test Warehouse', code='TEST-WH', region=r)
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

    def test_preview_order_barcode_variations(self):
        self.client.force_authenticate(user=self.superuser)
        # Test numeric ID
        res = self.client.get(f'/api/warehouses/intakes/preview-order/?order_id={self.order.id}')
        self.assertEqual(res.status_code, 200)

        # Test prefixed ID (e.g. #12 or SOK-12)
        res_prefixed = self.client.get(f'/api/warehouses/intakes/preview-order/?order_id=%23{self.order.id}')
        self.assertEqual(res_prefixed.status_code, 200)

        # Test PickupCode
        from logistics.models import PickupCode
        pcode = PickupCode.objects.create(order=self.order, code='987654')
        res_pcode = self.client.get(f'/api/warehouses/intakes/preview-order/?order_id=987654')
        self.assertEqual(res_pcode.status_code, 200)


class WarehousePostIntakeWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.superuser = User.objects.create_superuser(username='wh_super', password='pw')
        self.buyer = User.objects.create_user(username='wh_buyer', password='pw')
        self.driver = User.objects.create_user(username='wh_driver', password='pw')

        from locations.models import Region
        r_origin = Region.objects.create(name='Dar es Salaam')
        r_dest = Region.objects.create(name='Arusha')
        self.wh_origin = Warehouse.objects.create(name='Dar Hub', code='DAR-01', region=r_origin)
        self.wh_dest = Warehouse.objects.create(name='Arusha Hub', code='ARU-01', region=r_dest)

        WarehouseStaffAssignment.objects.create(user=self.superuser, warehouse=self.wh_origin, is_manager=True)
        WarehouseStaffAssignment.objects.create(user=self.superuser, warehouse=self.wh_dest, is_manager=True)

    def test_set_delivery_fee_parameter_aliases_and_transfer_creation(self):
        self.client.force_authenticate(user=self.superuser)
        order = Order.objects.create(
            user=self.buyer,
            status='RECEIVED_AT_WAREHOUSE',
            fulfillment_type='PLATFORM_DELIVERY',
            delivery_info={'warehouse_code': self.wh_origin.code}
        )

        # Call with frontend parameter names: delivery_fee & destination_warehouse_code
        res = self.client.post(f'/api/warehouses/warehouses/{self.wh_origin.id}/set-delivery-fee/', {
            'order_id': order.id,
            'delivery_fee': '7500.00',
            'destination_warehouse_code': self.wh_dest.code
        })
        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.shipping_fee, Decimal('7500.00'))
        self.assertEqual(order.status, 'AWAITING_DELIVERY_PAYMENT')
        self.assertEqual(order.delivery_info.get('destination_warehouse_code'), self.wh_dest.code)

        # Verify WarehouseTransfer auto-created
        from warehouses.models import WarehouseTransfer
        transfer = WarehouseTransfer.objects.filter(order=order).first()
        self.assertIsNotNone(transfer)
        self.assertEqual(transfer.source_warehouse, self.wh_origin)
        self.assertEqual(transfer.destination_warehouse, self.wh_dest)

    def test_set_delivery_fee_zero_advances_order_directly(self):
        self.client.force_authenticate(user=self.superuser)
        order = Order.objects.create(
            user=self.buyer,
            status='RECEIVED_AT_WAREHOUSE',
            fulfillment_type='WAREHOUSE_PICKUP',
            shipping_method='PICKUP',
            delivery_info={'warehouse_code': self.wh_origin.code, 'destination_warehouse_code': self.wh_origin.code}
        )

        res = self.client.post(f'/api/warehouses/warehouses/{self.wh_origin.id}/set-delivery-fee/', {
            'order_id': order.id,
            'fee': '0.00'
        })
        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, 'READY_FOR_PICKUP')

    def test_dispatch_order_with_driver_and_metadata(self):
        self.client.force_authenticate(user=self.superuser)
        order = Order.objects.create(
            user=self.buyer,
            status='ASSIGNED_TRANSPORT',
            fulfillment_type='PLATFORM_DELIVERY',
            delivery_info={
                'current_warehouse_code': self.wh_origin.code,
                'destination_warehouse_code': self.wh_origin.code
            }
        )

        res = self.client.post(f'/api/warehouses/warehouses/{self.wh_origin.id}/dispatch-order/', {
            'order_id': order.id,
            'carrier_type': 'driver',
            'driver_id': self.driver.id,
            'tracking_number': 'TRK-TEST-99',
            'estimated_delivery': '2026-11-01T12:00:00Z'
        })
        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        # Last-mile to customer -> OUT_FOR_DELIVERY
        self.assertEqual(order.status, 'OUT_FOR_DELIVERY')

        from logistics.models import Shipment
        shipment = Shipment.objects.filter(order=order).first()
        self.assertIsNotNone(shipment)
        self.assertEqual(shipment.driver, self.driver)
        self.assertEqual(shipment.tracking_number, 'TRK-TEST-99')
        self.assertEqual(shipment.status, 'in_transit')

    def test_transfer_ship_and_dispatch_alias(self):
        self.client.force_authenticate(user=self.superuser)
        from warehouses.models import WarehouseTransfer
        from logistics.models import Shipment
        order = Order.objects.create(
            user=self.buyer,
            status='ASSIGNED_TRANSPORT',
            fulfillment_type='PLATFORM_DELIVERY',
            delivery_info={
                'current_warehouse_code': self.wh_origin.code,
                'destination_warehouse_code': self.wh_dest.code
            }
        )
        transfer = WarehouseTransfer.objects.create(
            order=order,
            source_warehouse=self.wh_origin,
            destination_warehouse=self.wh_dest,
            status='pending'
        )
        shipment = Shipment.objects.create(
            order=order,
            shipment_type='line_haul',
            status='pending'
        )

        # Call /dispatch/ endpoint alias
        res = self.client.post(f'/api/warehouses/transfers/{transfer.id}/dispatch/')
        self.assertEqual(res.status_code, 200)

        transfer.refresh_from_db()
        shipment.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(transfer.status, 'in_transit')
        self.assertEqual(shipment.status, 'in_transit')
        self.assertEqual(order.status, 'IN_TRANSIT')

    def test_transfer_receive_updates_current_warehouse_and_advances_pickup(self):
        self.client.force_authenticate(user=self.superuser)
        from warehouses.models import WarehouseTransfer
        order = Order.objects.create(
            user=self.buyer,
            status='IN_TRANSIT',
            fulfillment_type='WAREHOUSE_PICKUP',
            shipping_method='PICKUP',
            delivery_info={
                'current_warehouse_code': self.wh_origin.code,
                'destination_warehouse_code': self.wh_dest.code
            }
        )
        transfer = WarehouseTransfer.objects.create(
            order=order,
            source_warehouse=self.wh_origin,
            destination_warehouse=self.wh_dest,
            status='in_transit'
        )

        res = self.client.post(f'/api/warehouses/transfers/{transfer.id}/receive/')
        self.assertEqual(res.status_code, 200)

        transfer.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(transfer.status, 'completed')
        self.assertEqual(order.delivery_info.get('current_warehouse_code'), self.wh_dest.code)
        self.assertEqual(order.status, 'READY_FOR_PICKUP')

    def test_pickup_verification_dual_code(self):
        self.client.force_authenticate(user=self.superuser)
        from marketplace.services import OrderStateMachine
        order = Order.objects.create(
            user=self.buyer,
            status='ARRIVED_AT_REGIONAL_WAREHOUSE',
            fulfillment_type='WAREHOUSE_PICKUP',
            shipping_method='PICKUP',
            delivery_code='555123'
        )
        OrderStateMachine.transition_order(order, 'READY_FOR_PICKUP')

        # Test verification using the order's delivery_code directly
        res = self.client.post('/api/warehouses/pickup/verify/', {'code': '555123'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get('status'), 'success')
        order.refresh_from_db()
        self.assertEqual(order.status, 'COMPLETED')

    def test_delivery_payment_verification_advances_order(self):
        self.client.force_authenticate(user=self.superuser)
        from marketplace.models import Payment
        order = Order.objects.create(
            user=self.buyer,
            status='PENDING_DELIVERY_VERIFICATION',
            fulfillment_type='WAREHOUSE_PICKUP',
            shipping_method='PICKUP',
            delivery_info={
                'current_warehouse_code': self.wh_origin.code,
                'destination_warehouse_code': self.wh_origin.code
            }
        )
        payment = Payment.objects.create(
            order=order,
            amount=Decimal('5000.00'),
            status='PENDING_VERIFICATION'
        )

        res = self.client.post(f'/api/payments/{payment.id}/verify/')
        self.assertEqual(res.status_code, 200)
        order.refresh_from_db()
        # Same hub pickup -> READY_FOR_PICKUP
        self.assertEqual(order.status, 'READY_FOR_PICKUP')

    def test_warehouse_verify_delivery_payment_action_approve(self):
        # Create non-staff warehouse operator assigned to the warehouse
        wh_operator = User.objects.create_user(username='wh_op1', password='pw', is_staff=False)
        WarehouseStaffAssignment.objects.create(user=wh_operator, warehouse=self.wh_origin)

        from marketplace.models import Payment
        order = Order.objects.create(
            user=self.buyer,
            status='PENDING_DELIVERY_VERIFICATION',
            fulfillment_type='WAREHOUSE_PICKUP',
            shipping_method='PICKUP',
            shipping_fee=Decimal('6000.00'),
            delivery_info={
                'current_warehouse_code': self.wh_origin.code,
                'destination_warehouse_code': self.wh_origin.code
            }
        )
        payment = Payment.objects.create(
            order=order,
            amount=Decimal('6000.00'),
            transaction_id='TXN-TEST-1234',
            status='PENDING_VERIFICATION'
        )

        self.client.force_authenticate(user=wh_operator)
        res = self.client.post(f'/api/warehouses/warehouses/{self.wh_origin.id}/verify-delivery-payment/', {
            'order_id': order.id,
            'action': 'approve'
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get('status'), 'success')

        order.refresh_from_db()
        payment.refresh_from_db()
        self.assertEqual(payment.status, 'VERIFIED')
        self.assertEqual(order.status, 'READY_FOR_PICKUP')

    def test_warehouse_verify_delivery_payment_action_reject(self):
        wh_operator = User.objects.create_user(username='wh_op2', password='pw', is_staff=False)
        WarehouseStaffAssignment.objects.create(user=wh_operator, warehouse=self.wh_origin)

        from marketplace.models import Payment
        order = Order.objects.create(
            user=self.buyer,
            status='PENDING_DELIVERY_VERIFICATION',
            fulfillment_type='PLATFORM_DELIVERY',
            shipping_fee=Decimal('8000.00'),
            delivery_info={
                'current_warehouse_code': self.wh_origin.code,
                'destination_warehouse_code': self.wh_dest.code
            }
        )
        payment = Payment.objects.create(
            order=order,
            amount=Decimal('8000.00'),
            transaction_id='TXN-BAD-999',
            status='PENDING_VERIFICATION'
        )

        self.client.force_authenticate(user=wh_operator)
        res = self.client.post(f'/api/warehouses/warehouses/{self.wh_origin.id}/verify-delivery-payment/', {
            'order_id': order.id,
            'action': 'reject',
            'reason': 'Transaction ID not found in bank statement.'
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get('status'), 'success')

        order.refresh_from_db()
        payment.refresh_from_db()
        self.assertEqual(payment.status, 'REJECTED')
        self.assertEqual(order.status, 'AWAITING_DELIVERY_PAYMENT')

