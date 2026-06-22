from django.test import TestCase
from django.contrib.auth import get_user_model
from decimal import Decimal
from django.utils import timezone
from .models import DeliveryOption, PickupCode, Shipment
from .pricing import calculate_delivery_price, calculate_haversine_distance
from marketplace.models import Order, Category, Product, OrderItem

User = get_user_model()

class DeliveryEngineTests(TestCase):
    def setUp(self):
        # Seed DeliveryOptions
        DeliveryOption.objects.create(code='economy', name='Economy', base_price=Decimal('2000.00'), per_km_rate=Decimal('100.00'), per_kg_rate=Decimal('50.00'))
        DeliveryOption.objects.create(code='standard', name='Standard', base_price=Decimal('4000.00'), per_km_rate=Decimal('150.00'), per_kg_rate=Decimal('75.00'))
        DeliveryOption.objects.create(code='express', name='Express', base_price=Decimal('7000.00'), per_km_rate=Decimal('250.00'), per_kg_rate=Decimal('120.00'))
        DeliveryOption.objects.create(code='urgent', name='Urgent', base_price=Decimal('12000.00'), per_km_rate=Decimal('450.00'), per_kg_rate=Decimal('200.00'))

    def test_economy_short_light_small(self):
        # Scenario 1: Short distance (approx 5.5 km), light item (1.5 kg), small size, economy speed.
        # Kariakoo (-6.8161, 39.2803) to Oysterbay (-6.7725, 39.2715) -> approx 4.9 km distance
        price = calculate_delivery_price(
            -6.8161, 39.2803,
            -6.7725, 39.2715,
            weight=1.5,
            size='small',
            speed_code='economy'
        )
        # Expected base = 2000. Distance cost = 4.9 * 100 = 490. Weight cost = 1.5 * 50 = 75.
        # Total approx 2565. Rounded to nearest 100 -> 2600.
        self.assertTrue(2400 <= price <= 2800)

    def test_standard_medium_medium_medium(self):
        # Scenario 2: Medium distance (approx 15 km), medium weight (5.0 kg), medium size, standard speed.
        # Mwanza (-2.5167, 32.9000) to Airport (-2.4431, 32.9189) -> approx 8.4 km
        price = calculate_delivery_price(
            -2.5167, 32.9000,
            -2.4431, 32.9189,
            weight=5.0,
            size='medium',
            speed_code='standard'
        )
        # Standard: base = 4000. Distance = 8.4 * 150 = 1260. Weight = 5 * 75 = 375.
        # Subtotal = 5635. Size mult 'medium' = 1.2. Total = 5635 * 1.2 = 6762.
        # Rounded to nearest 100 -> 6800.
        self.assertTrue(6500 <= price <= 7100)

    def test_express_long_heavy_oversized(self):
        # Scenario 3: Long distance (approx 50 km), heavy weight (20.0 kg), oversized size, express speed.
        price = calculate_delivery_price(
            -6.8161, 39.2803,  # Dar es Salaam
            -6.4422, 38.9025,  # Bagamoyo (approx 56 km)
            weight=20.0,
            size='oversized',
            speed_code='express'
        )
        # Express: base = 7000. Distance = 56 * 250 = 14000. Weight = 20 * 120 = 2400.
        # Subtotal = 23400. Size mult 'oversized' = 2.5. Total = 23400 * 2.5 = 58500.
        # Rounded to nearest 100 -> 58500.
        self.assertTrue(50000 <= price <= 65000)


class PickupCodeTests(TestCase):
    def setUp(self):
        self.buyer = User.objects.create_user('buyer3', 'b3@test.com', 'BuyerPass123!')
        self.seller = User.objects.create_user('seller3', 's3@test.com', 'SellerPass123!')
        self.staff = User.objects.create_user('staff3', 'st3@test.com', 'StaffPass123!', is_staff=True)
        # Create active staff profile for staff member
        from staff.models import StaffProfile
        StaffProfile.objects.create(user=self.staff, is_active=True)

        self.cat = Category.objects.create(name='Test Cat', slug='test-cat')
        self.product = Product.objects.create(
            name='Test P', slug='test-p', price=Decimal('100.00'),
            stock=10, seller=self.seller, category=self.cat, is_available=True
        )
        self.order = Order.objects.create(user=self.buyer, status='READY_FOR_PICKUP', shipping_method='PICKUP')
        
        # Create pickup code
        self.pickup_code = PickupCode.objects.create(order=self.order)
        
        from rest_framework.test import APIClient
        self.client = APIClient()

    def test_pickup_code_generation(self):
        self.assertEqual(len(self.pickup_code.code), 6)
        self.assertTrue(self.pickup_code.code.isdigit())

    def test_one_time_use_atomic_verification(self):
        token = get_token_for_user(self.staff)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # 1. First verification should succeed
        res = self.client.post('/api/warehouses/pickup/verify/', {'code': self.pickup_code.code}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['status'], 'success')
        
        # Verify order status transitions to DELIVERED
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'DELIVERED')

        # 2. Second verification should fail (one-time-use)
        res_fail = self.client.post('/api/warehouses/pickup/verify/', {'code': self.pickup_code.code}, format='json')
        self.assertEqual(res_fail.status_code, 400)
        self.assertIn('already been used', res_fail.json()['error'])


def get_token_for_user(user):
    from rest_framework_simplejwt.tokens import RefreshToken
    return str(RefreshToken.for_user(user).access_token)


class ShipmentTests(TestCase):
    def setUp(self):
        self.buyer = User.objects.create_user('buyer4', 'b4@test.com', 'BuyerPass123!')
        self.seller = User.objects.create_user('seller4', 's4@test.com', 'SellerPass123!')
        self.driver = User.objects.create_user('driver4', 'dr4@test.com', 'DriverPass123!')
        self.staff = User.objects.create_user('staff4', 'st4@test.com', 'StaffPass123!', is_staff=True)
        # Create active staff profile
        from staff.models import StaffProfile
        StaffProfile.objects.create(user=self.staff, is_active=True)

        self.cat_vehicles = Category.objects.create(name='Vehicles', slug='vehicles')
        self.cat_cars = Category.objects.create(name='Cars', slug='cars', parent=self.cat_vehicles)
        self.cat_electronics = Category.objects.create(name='Electronics', slug='electronics')

        self.vehicle_product = Product.objects.create(
            name='Toyota RAV4', slug='toyota-rav4', price=Decimal('15000000.00'),
            stock=1, seller=self.seller, category=self.cat_cars, is_available=True
        )
        self.regular_product = Product.objects.create(
            name='iPhone 15', slug='iphone-15', price=Decimal('2000000.00'),
            stock=5, seller=self.seller, category=self.cat_electronics, is_available=True
        )

        from rest_framework.test import APIClient
        self.client = APIClient()

    def test_vehicle_shipment_requires_driver_transit(self):
        token = get_token_for_user(self.staff)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # Create vehicle order
        order = Order.objects.create(user=self.buyer, status='PAID', shipping_method='DELIVERY')
        OrderItem.objects.create(order=order, product=self.vehicle_product, quantity=1, price=self.vehicle_product.price)

        # 1. Try to create a shipment with status='in_transit' and no driver
        res = self.client.post('/api/logistics/shipments/', {
            'order': order.id,
            'status': 'in_transit',
            'carrier_type': 'driver'
        }, format='json')
        # Should return 400 Bad Request
        self.assertEqual(res.status_code, 400)

        # 2. Create shipment with driver succeeds
        res_ok = self.client.post('/api/logistics/shipments/', {
            'order': order.id,
            'status': 'in_transit',
            'carrier_type': 'driver',
            'driver': self.driver.id
        }, format='json')
        self.assertEqual(res_ok.status_code, 201)

    def test_gps_location_ping(self):
        token = get_token_for_user(self.staff)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # Create shipment
        order = Order.objects.create(user=self.buyer, status='PAID', shipping_method='DELIVERY')
        shipment = Shipment.objects.create(order=order, driver=self.driver, status='in_transit')

        # Driver logs a location ping
        driver_token = get_token_for_user(self.driver)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {driver_token}')
        res = self.client.post(f'/api/logistics/shipments/{shipment.id}/ping/', {
            'lat': -6.8161,
            'lng': 39.2803,
            'source': 'driver'
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()['status'], 'success')

        # Verify LocationPing is created
        from logistics.models import LocationPing
        self.assertEqual(LocationPing.objects.filter(shipment=shipment).count(), 1)
        ping = LocationPing.objects.filter(shipment=shipment).first()
        self.assertEqual(ping.lat, -6.8161)
        self.assertEqual(ping.lng, 39.2803)

    def test_driver_payment_auto_create_and_pay(self):
        # Create vehicle order and shipment
        order = Order.objects.create(user=self.buyer, status='PAID', shipping_method='DELIVERY', shipping_fee=Decimal('20000.00'))
        OrderItem.objects.create(order=order, product=self.vehicle_product, quantity=1, price=self.vehicle_product.price)

        shipment = Shipment.objects.create(order=order, driver=self.driver, status='in_transit')

        # Verify no driver payment yet
        from logistics.models import DriverPayment
        self.assertFalse(DriverPayment.objects.filter(shipment=shipment).exists())

        # Transition shipment to delivered
        token = get_token_for_user(self.staff)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.patch(f'/api/logistics/shipments/{shipment.id}/', {
            'status': 'delivered'
        }, format='json')
        self.assertEqual(res.status_code, 200)

        # Verify DriverPayment is auto-created
        self.assertTrue(DriverPayment.objects.filter(shipment=shipment).exists())
        payment = DriverPayment.objects.get(shipment=shipment)
        self.assertEqual(payment.driver, self.driver)
        self.assertEqual(payment.amount, Decimal('20000.00'))
        self.assertFalse(payment.is_paid)

        # Settle the payment
        res_pay = self.client.post(f'/api/logistics/driver-payments/{payment.id}/pay/')
        self.assertEqual(res_pay.status_code, 200)
        payment.refresh_from_db()
        self.assertTrue(payment.is_paid)
        self.assertIsNotNone(payment.paid_at)


