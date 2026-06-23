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
        from .models import SubscriptionTier, Subscription
        from django.utils import timezone
        tier = SubscriptionTier.objects.create(
            name='Seller Pro',
            price=Decimal('10000.00'),
            benefits='Sell things',
            duration=30,
            tier_level='seller_pro',
            commission_rate=Decimal('10.00')
        )
        Subscription.objects.create(
            user=self.seller,
            tier=tier,
            start_date=timezone.now(),
            end_date=timezone.now() + timezone.timedelta(days=30),
            is_active=True
        )
        self.network = MobileNetwork.objects.create(name='M-Pesa')
        self.client = APIClient()
        token = RefreshToken.for_user(self.seller)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

    def test_seller_can_add_lipa_number(self):
        res = self.client.post('/api/lipa-numbers/', {
            'network': self.network.id, 'number': '0712345678', 'name': 'Test Account'
        }, format='json')
        self.assertEqual(res.status_code, 201)


class SellerApplicationTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user('customer1', 'c1@test.com', 'CustomerPass123!')
        self.staff = User.objects.create_user('staff1', 'st1@test.com', 'StaffPass123!', is_staff=True)
        # Create active staff profile for staff member
        from staff.models import StaffProfile
        StaffProfile.objects.create(user=self.staff, is_active=True)

        from marketplace.models import SubscriptionTier
        self.tier = SubscriptionTier.objects.create(
            name='Seller Pro',
            price=Decimal('10000.00'),
            benefits='Sell things',
            duration=30,
            tier_level='seller_pro',
            commission_rate=Decimal('10.00')
        )
        self.client = APIClient()

    def test_customer_can_apply_and_staff_can_approve(self):
        # 1. Login as customer
        token = RefreshToken.for_user(self.customer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

        # Prepare simple fake file for document
        import io
        id_doc = io.BytesIO(b"fake id content")
        id_doc.name = 'id.pdf'

        res = self.client.post('/api/seller-applications/', {
            'requested_tier': self.tier.id,
            'business_name': 'My Shop',
            'id_document': id_doc
        }, format='multipart')
        self.assertEqual(res.status_code, 201)
        app_id = res.json()['id']

        # Get me
        res_me = self.client.get('/api/seller-applications/me/')
        self.assertEqual(res_me.status_code, 200)
        self.assertEqual(res_me.json()['id'], app_id)

        # 2. Login as staff and approve
        staff_token = RefreshToken.for_user(self.staff)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(staff_token.access_token)}')

        # List pending applications
        res_list = self.client.get('/api/staff/seller-applications/?status=pending')
        self.assertEqual(res_list.status_code, 200)
        results = res_list.json().get('results', res_list.json())
        self.assertEqual(len(results), 1)

        # Approve application
        res_approve = self.client.post(f'/api/staff/seller-applications/{app_id}/approve/')
        self.assertEqual(res_approve.status_code, 200)

        # Verify customer subscription and tier are updated
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.profile.tier, 'seller_pro')
        self.assertTrue(self.customer.subscriptions.filter(is_active=True, tier=self.tier).exists())

    def test_staff_can_reject_application(self):
        # 1. Submit application
        token = RefreshToken.for_user(self.customer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

        import io
        id_doc = io.BytesIO(b"fake id content")
        id_doc.name = 'id.pdf'

        res = self.client.post('/api/seller-applications/', {
            'requested_tier': self.tier.id,
            'business_name': 'My Shop 2',
            'id_document': id_doc
        }, format='multipart')
        self.assertEqual(res.status_code, 201)
        app_id = res.json()['id']

        # 2. Reject as staff
        staff_token = RefreshToken.for_user(self.staff)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(staff_token.access_token)}')

        res_reject = self.client.post(f'/api/staff/seller-applications/{app_id}/reject/', {
            'reason': 'Incomplete documents'
        }, format='json')
        self.assertEqual(res_reject.status_code, 200)

        # Verify status is rejected and rejection reason is saved
        from marketplace.models import SellerApplication
        app = SellerApplication.objects.get(id=app_id)
        self.assertEqual(app.status, 'rejected')
        self.assertEqual(app.rejection_reason, 'Incomplete documents')

        # Verify notification is created
        from marketplace.models import Notification
        self.assertTrue(Notification.objects.filter(user=self.customer, notification_type='subscription_rejected').exists())

    def test_business_team_management(self):
        # Create users
        owner = User.objects.create_user('business_owner', 'owner@test.com', 'OwnerPass123!')
        owner.profile.tier = 'business'
        owner.profile.save()
        
        member = User.objects.create_user('team_member_1', 'member1@test.com', 'MemberPass123!')
        
        # 1. Invite team member
        owner_token = RefreshToken.for_user(owner)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(owner_token.access_token)}')
        
        res = self.client.post('/api/team-members/', {
            'username': 'team_member_1',
            'permissions': {'manage_orders': True, 'manage_products': True}
        }, format='json')
        self.assertEqual(res.status_code, 201)
        
        # Verify TeamMember record exists
        from marketplace.models import TeamMember
        self.assertTrue(TeamMember.objects.filter(owner=owner, user=member).exists())
        
        # 2. Member logs in and gets business tier override in token
        res_login = self.client.post('/api/auth/token/', {
            'username': 'team_member_1',
            'password': 'MemberPass123!'
        }, format='json')
        self.assertEqual(res_login.status_code, 200)
        self.assertEqual(res_login.json()['tier'], 'business')
        self.assertTrue(res_login.json()['is_team_member'])
        self.assertTrue(res_login.json()['team_permissions']['manage_orders'])

        # 3. Seller Pro tier does not see advanced analytics (test conditional restriction)
        # Setup Seller Pro user
        pro_user = User.objects.create_user('pro_seller', 'pro@test.com', 'ProPass123!')
        pro_user.profile.tier = 'seller_pro'
        pro_user.profile.save()
        
        pro_token = RefreshToken.for_user(pro_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(pro_token.access_token)}')
        
        res_stats = self.client.get('/api/products/seller_stats/')
        self.assertEqual(res_stats.status_code, 200)
        self.assertFalse(res_stats.json()['has_advanced_analytics'])
        self.assertEqual(res_stats.json()['revenue_data'], [])