from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Category, Product, Order, LipaNumber, MobileNetwork, UserProfile
from decimal import Decimal

class AuthTests(TestCase):
    def test_register_success(self):
        res = self.client.post('/api/auth/register/', {
            'username': 'testuser', 'email': 'test@test.com',
            'password': 'StrongPass123!', 'confirm_password': 'StrongPass123!'
        }, content_type='application/json')
        if res.status_code != 201:
            print("REG ERROR:", res.content)
        self.assertEqual(res.status_code, 201)
        self.assertIn('access', res.json())

    def test_register_weak_password_fails(self):
        res = self.client.post('/api/auth/register/', {
            'username': 'testuser2', 'email': 't2@test.com',
            'password': 'abc', 'confirm_password': 'abc'
        }, content_type='application/json')
        self.assertEqual(res.status_code, 400)

class OrderTests(TestCase):
    def setUp(self):
        self.buyer = User.objects.create_user('buyer', 'b@test.com', 'BuyerPass123!')
        self.seller = User.objects.create_user('seller', 's@test.com', 'SellerPass123!')
        self.cat = Category.objects.create(name='Test', slug='test')
        self.product = Product.objects.create(
            name='Test Product', slug='test-product', price=Decimal('1000'),
            stock=5, seller=self.seller, category=self.cat, is_available=True
        )
        self.client = APIClient()
        token = RefreshToken.for_user(self.buyer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

    def test_order_decrements_stock(self):
        res = self.client.post('/api/orders/', {
            'items': [{'product': self.product.id, 'quantity': 2}],
            'shipping_method': 'PICKUP', 'shipping_fee': 0,
            'delivery_info': {}
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)

    def test_order_over_stock_rejected(self):
        res = self.client.post('/api/orders/', {
            'items': [{'product': self.product.id, 'quantity': 10}],
            'shipping_method': 'PICKUP', 'shipping_fee': 0, 'delivery_info': {}
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_state_machine_invalid_transition(self):
        from .services import OrderStateMachine
        order = Order.objects.create(user=self.buyer, status='CART', shipping_method='PICKUP')
        with self.assertRaises(ValueError):
            OrderStateMachine.transition_order(order, 'COMPLETED')

class LipaNumberTests(TestCase):
    def setUp(self):
        self.seller = User.objects.create_user('seller2', 'sl@test.com', 'SellerPass123!')
        self.network = MobileNetwork.objects.create(name='M-Pesa')
        self.client = APIClient()
        token = RefreshToken.for_user(self.seller)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

    def test_seller_can_add_lipa_number(self):
        res = self.client.post('/api/lipa-numbers/', {
            'network': self.network.id, 'number': '0712345678', 'name': 'Test Account'
        }, format='json')
        self.assertEqual(res.status_code, 201)