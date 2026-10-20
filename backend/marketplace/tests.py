from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Category, Product, Order, LipaNumber, MobileNetwork, UserProfile, Conversation, Message
from decimal import Decimal

class AuthTests(TestCase):
    def test_register_success(self):
        res = self.client.post('/api/auth/register/', {
            'username': 'testuser', 'email': 'test@test.com',
            'password': 'StrongPass123!', 'confirm_password': 'StrongPass123!',
            'gender': 'female',
        }, content_type='application/json')
        if res.status_code != 201:
            print("REG ERROR:", res.content)
        self.assertEqual(res.status_code, 201)
        self.assertIn('access', res.json())
        data = res.json()
        self.assertEqual(data.get('gender'), 'female')
        self.assertTrue(data.get('gender_locked'))

    def test_register_missing_gender_fails(self):
        res = self.client.post('/api/auth/register/', {
            'username': 'testuser_nogender', 'email': 'nogender@test.com',
            'password': 'StrongPass123!', 'confirm_password': 'StrongPass123!',
        }, content_type='application/json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Gender is required', res.json().get('detail', ''))

    def test_register_invalid_gender_fails(self):
        res = self.client.post('/api/auth/register/', {
            'username': 'testuser_badgender', 'email': 'badgender@test.com',
            'password': 'StrongPass123!', 'confirm_password': 'StrongPass123!',
            'gender': 'robot',
        }, content_type='application/json')
        self.assertEqual(res.status_code, 400)

    def test_register_weak_password_fails(self):
        res = self.client.post('/api/auth/register/', {
            'username': 'testuser2', 'email': 't2@test.com',
            'password': 'abc', 'confirm_password': 'abc',
            'gender': 'male',
        }, content_type='application/json')
        self.assertEqual(res.status_code, 400)

    def test_existing_user_gender_locked_after_settings_update(self):
        user = User.objects.create_user('existinguser', 'ex@test.com', 'Pass123!456')
        profile = user.profile
        self.assertEqual(profile.gender, 'unspecified')
        self.assertFalse(profile.gender_locked)

        client = APIClient()
        token = RefreshToken.for_user(user)
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

        # First update in settings should succeed
        res = client.patch(f'/api/profiles/{user.username}/', {'gender': 'male'}, format='json')
        self.assertEqual(res.status_code, 200)
        profile.refresh_from_db()
        self.assertEqual(profile.gender, 'male')
        self.assertTrue(profile.gender_locked)

        # Second update attempting to change gender should fail
        res2 = client.patch(f'/api/profiles/{user.username}/', {'gender': 'female'}, format='json')
        self.assertEqual(res2.status_code, 400)
        profile.refresh_from_db()
        self.assertEqual(profile.gender, 'male')

        # Submitting the same gender or other fields should succeed
        res3 = client.patch(f'/api/profiles/{user.username}/', {'gender': 'male', 'bio': 'Hello world'}, format='json')
        self.assertEqual(res3.status_code, 200)
        profile.refresh_from_db()
        self.assertEqual(profile.bio, 'Hello world')

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

    def test_order_cancellation_zeroes_platform_fee(self):
        from .services import OrderStateMachine
        order = Order.objects.create(
            user=self.buyer, status='CHECKOUT', shipping_method='PICKUP',
            platform_fee=Decimal('5000.00')
        )
        OrderStateMachine.transition_order(order, 'CANCELLED')
        order.refresh_from_db()
        self.assertEqual(order.platform_fee, Decimal('0.00'))

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
        
        # 1. Direct team member creation with credentials by Business Owner
        owner_token = RefreshToken.for_user(owner)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(owner_token.access_token)}')
        
        res = self.client.post('/api/team-members/', {
            'username': 'accountant_joe',
            'password': 'JoeAccountant123!',
            'email': 'joe@business.com',
            'first_name': 'Joe',
            'last_name': 'Accountant',
            'role_preset': 'accountant',
            'permissions': {
                'manage_payments': True,
                'manage_invoices': True,
                'view_analytics': True,
                'manage_payment_numbers': True,
                'manage_billing': True
            },
            'create_user': True
        }, format='json')
        self.assertEqual(res.status_code, 201)
        
        # Verify TeamMember record and provisioned User record exist
        from marketplace.models import TeamMember, TeamMemberAuditLog
        member_record = TeamMember.objects.filter(owner=owner, user__username='accountant_joe').first()
        self.assertIsNotNone(member_record)
        self.assertTrue(member_record.is_active)
        self.assertEqual(member_record.invitation_status, 'accepted')
        self.assertEqual(member_record.role_preset, 'accountant')
        self.assertTrue(member_record.created_by_owner)
        
        # 2. Member logs in using directly provisioned credentials
        res_login = self.client.post('/api/auth/token/', {
            'username': 'accountant_joe',
            'password': 'JoeAccountant123!'
        }, format='json')
        self.assertEqual(res_login.status_code, 200)
        self.assertTrue(res_login.json()['is_team_member'])
        self.assertEqual(res_login.json()['team_role_preset'], 'accountant')
        self.assertTrue(res_login.json()['team_permissions']['manage_payments'])
        self.assertTrue(res_login.json()['team_permissions']['manage_invoices'])
        self.assertFalse(res_login.json().get('team_permissions', {}).get('manage_products', False))

        # 3. Owner resets member's password
        res_pw = self.client.post(f'/api/team-members/{member_record.id}/reset-password/', {
            'new_password': 'BrandNewPassword123!',
            'confirm_password': 'BrandNewPassword123!'
        }, format='json')
        self.assertEqual(res_pw.status_code, 200)

        # 4. Member logs in with new password
        res_new_login = self.client.post('/api/auth/token/', {
            'username': 'accountant_joe',
            'password': 'BrandNewPassword123!'
        }, format='json')
        self.assertEqual(res_new_login.status_code, 200)

        # 5. Owner suspends member
        res_suspend = self.client.post(f'/api/team-members/{member_record.id}/toggle-suspend/')
        self.assertEqual(res_suspend.status_code, 200)
        self.assertFalse(res_suspend.json()['is_active'])

        # Check audit logs
        res_audit = self.client.get('/api/team-members/audit-log/')
        self.assertEqual(res_audit.status_code, 200)
        actions = [e['action'] for e in res_audit.json()]
        self.assertIn('user_created', actions)
        self.assertIn('password_reset', actions)
        self.assertIn('suspended', actions)

        # 6. Reactivate member
        res_reactivate = self.client.post(f'/api/team-members/{member_record.id}/toggle-suspend/')
        self.assertEqual(res_reactivate.status_code, 200)
        self.assertTrue(res_reactivate.json()['is_active'])

        # 7. Non-business user (Seller Pro or Customer) cannot manage teams
        pro_user = User.objects.create_user('pro_seller', 'pro@test.com', 'ProPass123!')
        pro_user.profile.tier = 'seller_pro'
        pro_user.profile.save()
        
        pro_token = RefreshToken.for_user(pro_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(pro_token.access_token)}')
        
        res_forbidden = self.client.post('/api/team-members/', {
            'username': 'some_user',
            'password': 'SomePassword123!',
            'create_user': True
        }, format='json')
        self.assertEqual(res_forbidden.status_code, 400) # ValidationError: Only active Business tier can manage teams

class StoreImageTests(TestCase):
    def setUp(self):
        self.seller = User.objects.create_user('seller_img', 'si@test.com', 'SellerPass123!')
        self.seller.profile.tier = 'seller_pro'
        self.seller.profile.save()

        self.other_user = User.objects.create_user('other_img', 'oi@test.com', 'OtherPass123!')

        self.client = APIClient()
        token = RefreshToken.for_user(self.seller)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

    def test_upload_store_image_success(self):
        import io
        from PIL import Image

        file_obj = io.BytesIO()
        image = Image.new('RGB', (100, 100), 'white')
        image.save(file_obj, 'JPEG')
        file_obj.seek(0)
        file_obj.name = 'test_store_image.jpg'

        res = self.client.post(f'/api/profiles/{self.seller.username}/upload_store_image/', {
            'image': file_obj
        }, format='multipart')
        
        self.assertEqual(res.status_code, 201)
        self.assertIn('image', res.json())
        self.assertEqual(self.seller.profile.store_images.count(), 1)

    def test_upload_store_image_limit(self):
        import io
        from PIL import Image
        from .models import StoreImage
        from django.core.files.uploadedfile import SimpleUploadedFile

        for i in range(9):
            StoreImage.objects.create(
                profile=self.seller.profile,
                image=SimpleUploadedFile(f'img_{i}.jpg', b'fake image data', content_type='image/jpeg')
            )

        file_obj = io.BytesIO()
        image = Image.new('RGB', (100, 100), 'white')
        image.save(file_obj, 'JPEG')
        file_obj.seek(0)
        file_obj.name = 'test_store_image10.jpg'

        res = self.client.post(f'/api/profiles/{self.seller.username}/upload_store_image/', {
            'image': file_obj
        }, format='multipart')
        
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['error'], 'You can only upload up to 9 store images.')

    def test_upload_store_image_unauthorized(self):
        other_token = RefreshToken.for_user(self.other_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(other_token.access_token)}')

        import io
        from PIL import Image

        file_obj = io.BytesIO()
        image = Image.new('RGB', (100, 100), 'white')
        image.save(file_obj, 'JPEG')
        file_obj.seek(0)
        file_obj.name = 'test_store_image_unauth.jpg'

        res = self.client.post(f'/api/profiles/{self.seller.username}/upload_store_image/', {
            'image': file_obj
        }, format='multipart')
        
        self.assertEqual(res.status_code, 403)

    def test_delete_store_image_success(self):
        from .models import StoreImage
        from django.core.files.uploadedfile import SimpleUploadedFile
        
        store_img = StoreImage.objects.create(
            profile=self.seller.profile,
            image=SimpleUploadedFile('img.jpg', b'fake image data', content_type='image/jpeg')
        )

        res = self.client.post(f'/api/profiles/{self.seller.username}/delete_store_image/', {
            'image_id': store_img.id
        }, format='json')
        
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.seller.profile.store_images.count(), 0)

    def test_delete_store_image_unauthorized(self):
        from .models import StoreImage
        from django.core.files.uploadedfile import SimpleUploadedFile
        
        store_img = StoreImage.objects.create(
            profile=self.seller.profile,
            image=SimpleUploadedFile('img.jpg', b'fake image data', content_type='image/jpeg')
        )

        other_token = RefreshToken.for_user(self.other_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(other_token.access_token)}')

        res = self.client.post(f'/api/profiles/{self.seller.username}/delete_store_image/', {
            'image_id': store_img.id
        }, format='json')
        
        self.assertEqual(res.status_code, 403)


class PromoCodeAndSubscriptionTests(TestCase):
    def setUp(self):
        from .models import SubscriptionTier, Subscription, Category, Product
        from django.utils import timezone
        
        self.client = APIClient()
        self.customer = User.objects.create_user('cust_test', 'c@test.com', 'CustPass123!')
        self.seller = User.objects.create_user('seller_test', 's@test.com', 'SellerPass123!')
        
        # Setup seller tier subscription
        self.tier = SubscriptionTier.objects.create(
            name='Seller Pro',
            price=Decimal('29000.00'),
            benefits='Sell products',
            duration=30,
            tier_level='seller_pro',
            commission_rate=Decimal('10.00')
        )
        self.sub = Subscription.objects.create(
            user=self.seller,
            tier=self.tier,
            start_date=timezone.now(),
            end_date=timezone.now() + timezone.timedelta(days=30),
            is_active=True
        )
        # Sync profile tier
        self.seller.profile.tier = 'seller_pro'
        self.seller.profile.save()
        
        # Product
        self.cat = Category.objects.create(name='Test Category', slug='test-cat')
        self.product = Product.objects.create(
            name='Promo Product', slug='promo-product', price=Decimal('10000'),
            stock=10, seller=self.seller, category=self.cat, is_available=True
        )

    def test_create_promo_code_non_seller_fails(self):
        token = RefreshToken.for_user(self.customer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')
        
        res = self.client.post('/api/promo-codes/', {
            'code': 'HELLO10',
            'discount_type': 'percentage',
            'value': '10.00',
            'min_purchase_amount': '0.00'
        }, format='json')
        self.assertIn(res.status_code, [400, 403])

    def test_create_promo_code_seller_success(self):
        token = RefreshToken.for_user(self.seller)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')
        
        res = self.client.post('/api/promo-codes/', {
            'code': 'HELLO10',
            'discount_type': 'percentage',
            'value': '10.00',
            'min_purchase_amount': '5000.00'
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()['code'], 'HELLO10')
        self.assertEqual(float(res.json()['min_purchase_amount']), 5000.00)

    def test_validate_promo_code_flow(self):
        from .models import PromoCode
        # Create a code
        promo = PromoCode.objects.create(
            code='SAVE20',
            seller=self.seller,
            discount_type='percentage',
            value=Decimal('20.00'),
            min_purchase_amount=Decimal('5000.00')
        )
        
        token = RefreshToken.for_user(self.customer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')
        
        # Test valid
        res = self.client.post('/api/promo-codes/validate/', {
            'code': 'save20',
            'merchant': self.seller.username,
            'subtotal': '10000.00'
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()['valid'])
        self.assertEqual(float(res.json()['discount_amount']), 2000.00)
        
        # Test wrong merchant
        res = self.client.post('/api/promo-codes/validate/', {
            'code': 'save20',
            'merchant': 'some_other_merchant',
            'subtotal': '10000.00'
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.json()['valid'])
        
        # Test min purchase limit
        res = self.client.post('/api/promo-codes/validate/', {
            'code': 'save20',
            'merchant': self.seller.username,
            'subtotal': '4000.00'
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.json()['valid'])

    def test_apply_promo_code_to_order(self):
        from .models import PromoCode
        promo = PromoCode.objects.create(
            code='SAVE3000',
            seller=self.seller,
            discount_type='fixed',
            value=Decimal('3000.00'),
            min_purchase_amount=Decimal('5000.00')
        )
        
        token = RefreshToken.for_user(self.customer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')
        
        # Create order using promo code
        res = self.client.post('/api/orders/', {
            'items': [{'product': self.product.id, 'quantity': 1}],
            'shipping_method': 'PICKUP',
            'shipping_fee': 0,
            'promo_code': 'SAVE3000',
            'delivery_info': {}
        }, format='json')
        
        self.assertEqual(res.status_code, 201)
        # Price: 10000 - 3000 discount = 7000 TZS
        self.assertEqual(float(res.json()['total_amount']), 7000.00)
        self.assertEqual(float(res.json()['discount_amount']), 3000.00)
        self.assertEqual(res.json()['promo_code_code'], 'SAVE3000')
        
        # Verify usage count incremented
        promo.refresh_from_db()
        self.assertEqual(promo.use_count, 1)

    def test_cancel_subscription(self):
        token = RefreshToken.for_user(self.seller)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')
        
        res = self.client.post('/api/subscriptions/cancel/')
        self.assertEqual(res.status_code, 200)
        
        self.sub.refresh_from_db()
        self.assertFalse(self.sub.is_active)
        
        self.seller.profile.refresh_from_db()
        self.assertEqual(self.seller.profile.tier, 'customer')

    def test_create_promo_code_percentage_out_of_bounds(self):
        token = RefreshToken.for_user(self.seller)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')
        
        # Test > 100%
        res = self.client.post('/api/promo-codes/', {
            'code': 'MEGA200',
            'discount_type': 'percentage',
            'value': '200.00'
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('value', res.json())

        # Test <= 0%
        res = self.client.post('/api/promo-codes/', {
            'code': 'ZERO',
            'discount_type': 'percentage',
            'value': '0.00'
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('value', res.json())

    def test_create_promo_code_fixed_out_of_bounds(self):
        token = RefreshToken.for_user(self.seller)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')
        
        res = self.client.post('/api/promo-codes/', {
            'code': 'NEGFIX',
            'discount_type': 'fixed',
            'value': '-100.00'
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('value', res.json())

    def test_create_promo_code_invalid_dates(self):
        from django.utils import timezone
        token = RefreshToken.for_user(self.seller)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')
        
        start = timezone.now()
        end = start - timezone.timedelta(days=1)
        res = self.client.post('/api/promo-codes/', {
            'code': 'BACKINTIME',
            'discount_type': 'percentage',
            'value': '10.00',
            'start_date': start.isoformat(),
            'end_date': end.isoformat()
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('end_date', res.json())


class AffiliateReferralSystemTests(TestCase):
    def setUp(self):
        from .models import SubscriptionTier, Subscription, Category, Product
        from django.utils import timezone
        self.client = APIClient()
        self.customer = User.objects.create_user('aff_cust', 'aff_c@test.com', 'CustPass123!')
        self.seller = User.objects.create_user('aff_seller', 'aff_s@test.com', 'SellerPass123!')
        self.influencer = User.objects.create_user('aff_influencer', 'aff_i@test.com', 'InfPass123!')

        # Tier for seller
        self.tier = SubscriptionTier.objects.create(
            name='Seller Pro',
            price=Decimal('29000.00'),
            benefits='Sell products',
            duration=30,
            tier_level='seller_pro',
            commission_rate=Decimal('10.00')
        )
        self.sub = Subscription.objects.create(
            user=self.seller,
            tier=self.tier,
            start_date=timezone.now(),
            end_date=timezone.now() + timezone.timedelta(days=30),
            is_active=True
        )
        self.seller.profile.tier = 'seller_pro'
        self.seller.profile.save()

        # Product
        self.cat = Category.objects.create(name='Gadgets', slug='gadgets')
        self.product = Product.objects.create(
            name='Smartphone', slug='smartphone', price=Decimal('20000.00'),
            stock=10, seller=self.seller, category=self.cat, is_available=True
        )

    def test_create_affiliate_promo_code(self):
        token = RefreshToken.for_user(self.seller)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

        res = self.client.post('/api/promo-codes/', {
            'code': 'INFLUENCE10',
            'affiliate_name': 'Tech Reviewer',
            'affiliate_user': self.influencer.id,
            'discount_type': 'percentage',
            'value': '5.00',
            'commission_type': 'percentage',
            'commission_rate': '10.00',
            'max_uses_per_user': 1
        }, format='json')
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data['code'], 'INFLUENCE10')
        self.assertEqual(data['affiliate_name'], 'Tech Reviewer')
        self.assertEqual(float(data['commission_rate']), 10.0)

    def test_checkout_order_creates_referral_conversion(self):
        from .models import PromoCode, ReferralConversion, Order
        promo = PromoCode.objects.create(
            code='JUMA10',
            seller=self.seller,
            affiliate_name='Juma',
            affiliate_user=self.influencer,
            discount_type='percentage',
            value=Decimal('5.00'),
            commission_type='percentage',
            commission_rate=Decimal('10.00'),
            max_uses_per_user=1
        )

        token = RefreshToken.for_user(self.customer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

        # Place order
        res = self.client.post('/api/orders/', {
            'items': [{'product': self.product.id, 'quantity': 1}],
            'shipping_method': 'DELIVERY',
            'shipping_fee': 0,
            'promo_code': 'JUMA10',
            'delivery_info': {'contact_name': 'Aisha', 'contact_phone': '+255711223344'}
        }, format='json')
        self.assertEqual(res.status_code, 201)
        order_id = res.json()['id']

        # Verify ReferralConversion record
        conversion = ReferralConversion.objects.filter(order_id=order_id).first()
        self.assertIsNotNone(conversion)
        self.assertEqual(conversion.customer, self.customer)
        self.assertEqual(conversion.seller, self.seller)
        self.assertEqual(conversion.affiliate_name, 'Juma')
        self.assertEqual(conversion.discount_given, Decimal('1000.00')) # 5% of 20,000
        self.assertEqual(conversion.commission_earned, Decimal('2000.00')) # 10% of 20,000
        self.assertEqual(conversion.status, 'PENDING')

        # Advance order to DELIVERED
        from .services import OrderStateMachine
        Order.objects.filter(id=order_id).update(status='SHIPPED')
        order = Order.objects.get(id=order_id)
        OrderStateMachine.transition_order(order, 'DELIVERED')
        conversion.refresh_from_db()
        self.assertEqual(conversion.status, 'APPROVED')

    def test_order_cancellation_cancels_conversion_and_restores_usage(self):
        from .models import PromoCode, ReferralConversion, Order
        promo = PromoCode.objects.create(
            code='CANCELTEST',
            seller=self.seller,
            affiliate_name='Partner',
            discount_type='fixed',
            value=Decimal('2000.00'),
            commission_type='fixed',
            commission_rate=Decimal('3000.00')
        )

        token = RefreshToken.for_user(self.customer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

        res = self.client.post('/api/orders/', {
            'items': [{'product': self.product.id, 'quantity': 1}],
            'shipping_method': 'DELIVERY',
            'shipping_fee': 0,
            'promo_code': 'CANCELTEST'
        }, format='json')
        self.assertEqual(res.status_code, 201)
        order_id = res.json()['id']

        promo.refresh_from_db()
        self.assertEqual(promo.use_count, 1)

        from .services import OrderStateMachine
        order = Order.objects.get(id=order_id)
        OrderStateMachine.transition_order(order, 'CANCELLED')

        conversion = ReferralConversion.objects.get(order_id=order_id)
        self.assertEqual(conversion.status, 'CANCELLED')

        promo.refresh_from_db()
        self.assertEqual(promo.use_count, 0)

    def test_max_uses_per_user_enforced(self):
        from .models import PromoCode
        PromoCode.objects.create(
            code='ONETIME',
            seller=self.seller,
            affiliate_name='OneTime',
            discount_type='percentage',
            value=Decimal('5.00'),
            max_uses_per_user=1
        )

        token = RefreshToken.for_user(self.customer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

        # First order succeeds
        res1 = self.client.post('/api/orders/', {
            'items': [{'product': self.product.id, 'quantity': 1}],
            'shipping_method': 'DELIVERY',
            'shipping_fee': 0,
            'promo_code': 'ONETIME'
        }, format='json')
        self.assertEqual(res1.status_code, 201)

        # Second order with same code fails
        res2 = self.client.post('/api/orders/', {
            'items': [{'product': self.product.id, 'quantity': 1}],
            'shipping_method': 'DELIVERY',
            'shipping_fee': 0,
            'promo_code': 'ONETIME'
        }, format='json')
        self.assertEqual(res2.status_code, 400)

    def test_self_referral_prevented(self):
        from .models import PromoCode
        PromoCode.objects.create(
            code='SELFREF',
            seller=self.seller,
            affiliate_user=self.influencer,
            discount_type='percentage',
            value=Decimal('10.00'),
            commission_type='percentage',
            commission_rate=Decimal('10.00')
        )

        token = RefreshToken.for_user(self.influencer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

        res = self.client.post('/api/orders/', {
            'items': [{'product': self.product.id, 'quantity': 1}],
            'shipping_method': 'DELIVERY',
            'shipping_fee': 0,
            'promo_code': 'SELFREF'
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('own affiliate referral code', str(res.json()))

    def test_mark_conversion_paid(self):
        from .models import PromoCode, ReferralConversion, Order
        promo = PromoCode.objects.create(
            code='PAYOUT',
            seller=self.seller,
            affiliate_name='Blogger',
            discount_type='percentage',
            value=Decimal('5.00'),
            commission_rate=Decimal('10.00')
        )
        order = Order.objects.create(user=self.customer, total_amount=Decimal('19000.00'))
        conv = ReferralConversion.objects.create(
            order=order,
            promo_code=promo,
            seller=self.seller,
            customer=self.customer,
            order_subtotal=Decimal('20000.00'),
            discount_given=Decimal('1000.00'),
            commission_earned=Decimal('2000.00'),
            status='APPROVED'
        )

        token = RefreshToken.for_user(self.seller)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

        res = self.client.post(f'/api/promo-codes/conversions/{conv.id}/mark-paid/', {
            'payout_reference': 'MPESA-REF-9988'
        }, format='json')
        self.assertEqual(res.status_code, 200)
        conv.refresh_from_db()
        self.assertEqual(conv.status, 'PAID_OUT')
        self.assertEqual(conv.payout_reference, 'MPESA-REF-9988')
        self.assertIsNotNone(conv.payout_date)

    def test_single_product_scope_discount_and_commission_proportional(self):
        from .models import PromoCode, ReferralConversion, Product, Order
        product_b = Product.objects.create(
            name='Headphones', slug='headphones', price=Decimal('40000.00'),
            stock=10, seller=self.seller, category=self.cat, is_available=True
        )

        promo = PromoCode.objects.create(
            code='SINGLEPHONE',
            seller=self.seller,
            affiliate_name='AudioReviewer',
            applicable_scope='single_product',
            product=self.product,
            discount_type='percentage',
            value=Decimal('10.00'),
            commission_type='percentage',
            commission_rate=Decimal('15.00'),
            attribution_window_days=7
        )

        token = RefreshToken.for_user(self.customer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

        res = self.client.post('/api/orders/', {
            'items': [
                {'product': self.product.id, 'quantity': 1},
                {'product': product_b.id, 'quantity': 1}
            ],
            'shipping_method': 'DELIVERY',
            'shipping_fee': 0,
            'promo_code': 'SINGLEPHONE',
            'delivery_info': {'contact_name': 'Test Buyer', 'contact_phone': '+255788111222'}
        }, format='json')
        self.assertEqual(res.status_code, 201)
        order_id = res.json()['id']

        order = Order.objects.get(id=order_id)
        self.assertEqual(order.discount_amount, Decimal('2000.00'))
        self.assertEqual(order.total_amount, Decimal('58000.00'))

        conversion = ReferralConversion.objects.get(order_id=order_id)
        self.assertEqual(conversion.order_subtotal, Decimal('20000.00'))
        self.assertEqual(conversion.discount_given, Decimal('2000.00'))
        self.assertEqual(conversion.commission_earned, Decimal('3000.00'))

    def test_single_product_scope_fails_if_target_not_in_cart(self):
        from .models import PromoCode, Product
        product_b = Product.objects.create(
            name='Watch', slug='watch', price=Decimal('15000.00'),
            stock=10, seller=self.seller, category=self.cat, is_available=True
        )
        PromoCode.objects.create(
            code='WATCHONLY',
            seller=self.seller,
            applicable_scope='single_product',
            product=product_b,
            discount_type='percentage',
            value=Decimal('10.00')
        )

        token = RefreshToken.for_user(self.customer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

        res = self.client.post('/api/orders/', {
            'items': [{'product': self.product.id, 'quantity': 1}],
            'shipping_method': 'DELIVERY',
            'shipping_fee': 0,
            'promo_code': 'WATCHONLY'
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('no matching items in your cart', str(res.json()))

    def test_delivery_phone_anti_reuse_enforced_across_accounts(self):
        from .models import PromoCode
        PromoCode.objects.create(
            code='PHONEONETIME',
            seller=self.seller,
            affiliate_name='TestPartner',
            discount_type='percentage',
            value=Decimal('5.00'),
            max_uses_per_user=1
        )

        token1 = RefreshToken.for_user(self.customer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token1.access_token)}')
        res1 = self.client.post('/api/orders/', {
            'items': [{'product': self.product.id, 'quantity': 1}],
            'shipping_method': 'DELIVERY',
            'shipping_fee': 0,
            'promo_code': 'PHONEONETIME',
            'delivery_info': {'contact_phone': '+255719999888'}
        }, format='json')
        self.assertEqual(res1.status_code, 201)

        customer_2 = User.objects.create_user('diff_cust', 'diff@test.com', 'Pass1234!')
        token2 = RefreshToken.for_user(customer_2)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token2.access_token)}')

        res2 = self.client.post('/api/orders/', {
            'items': [{'product': self.product.id, 'quantity': 1}],
            'shipping_method': 'DELIVERY',
            'shipping_fee': 0,
            'promo_code': 'PHONEONETIME',
            'delivery_info': {'contact_phone': '+255719999888'}
        }, format='json')
        self.assertEqual(res2.status_code, 400)
        self.assertIn('already redeemed', str(res2.json()))

    def test_browse_products_filtered_by_ref_code(self):
        from .models import PromoCode, Product
        prod_other = Product.objects.create(
            name='Camera', slug='camera', price=Decimal('80000.00'),
            stock=5, seller=self.seller, category=self.cat, is_available=True
        )
        promo = PromoCode.objects.create(
            code='PHONESPECIFIC',
            seller=self.seller,
            applicable_scope='single_product',
            product=self.product,
            discount_type='percentage',
            value=Decimal('5.00')
        )

        self.client.credentials()
        res = self.client.get(f'/api/products/?ref={promo.code}')
        self.assertEqual(res.status_code, 200)
        results = res.json().get('results', res.json())
        product_ids = [p['id'] for p in results]
        self.assertIn(self.product.id, product_ids)
        self.assertNotIn(prod_other.id, product_ids)

        # Test with merchant query param (should return qualifying products, not 0)
        res_merchant = self.client.get(f'/api/products/?merchant={self.seller.username}&ref={promo.code}')
        self.assertEqual(res_merchant.status_code, 200)
        results_m = res_merchant.json().get('results', res_merchant.json())
        product_ids_m = [p['id'] for p in results_m]
        self.assertIn(self.product.id, product_ids_m)
        self.assertNotIn(prod_other.id, product_ids_m)

    def test_edit_promo_code_via_patch(self):
        from .models import PromoCode
        promo = PromoCode.objects.create(
            code='EDITME',
            seller=self.seller,
            applicable_scope='all_products',
            discount_type='percentage',
            value=Decimal('5.00')
        )
        token = RefreshToken.for_user(self.seller)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')
        res = self.client.patch(f'/api/promo-codes/{promo.id}/', {
            'affiliate_name': 'New Promoter',
            'commission_rate': '12.50',
            'applicable_scope': 'single_product',
            'product': self.product.id
        }, format='json')
        self.assertEqual(res.status_code, 200)
        promo.refresh_from_db()
        self.assertEqual(promo.affiliate_name, 'New Promoter')
        self.assertEqual(float(promo.commission_rate), 12.5)
        self.assertEqual(promo.applicable_scope, 'single_product')
        self.assertEqual(promo.product_id, self.product.id)

    def test_validate_promo_code_returns_scope_metadata(self):
        from .models import PromoCode
        PromoCode.objects.create(
            code='METATEST',
            seller=self.seller,
            affiliate_name='SuperAffiliate',
            applicable_scope='single_product',
            product=self.product,
            discount_type='percentage',
            value=Decimal('10.00'),
            attribution_window_days=14
        )

        res = self.client.post('/api/promo-codes/validate/', {
            'code': 'METATEST',
            'items': [{'product_id': self.product.id, 'quantity': 1, 'price': '20000.00'}]
        }, format='json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['code'], 'METATEST')
        self.assertEqual(data['applicable_scope'], 'single_product')
        self.assertEqual(data['product_id'], self.product.id)
        self.assertEqual(data['attribution_window_days'], 14)
        self.assertEqual(float(data['discount_amount']), 2000.0)

    def test_check_ref_valid_active_code(self):
        from .models import PromoCode
        PromoCode.objects.create(
            code='ACTIVECHECK',
            seller=self.seller,
            affiliate_name='PartnerCheck',
            applicable_scope='single_product',
            product=self.product,
            discount_type='percentage',
            value=Decimal('15.00'),
            attribution_window_days=10
        )
        res = self.client.get('/api/promo-codes/check-ref/?code=ACTIVECHECK')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['valid'])
        self.assertFalse(data['is_expired'])
        self.assertEqual(data['code'], 'ACTIVECHECK')
        self.assertEqual(data['attribution_window_days'], 10)
        self.assertEqual(data['product_id'], self.product.id)

    def test_check_ref_expired_code(self):
        from .models import PromoCode
        from django.utils import timezone
        PromoCode.objects.create(
            code='EXPIREDREF',
            seller=self.seller,
            discount_type='percentage',
            value=Decimal('10.00'),
            start_date=timezone.now() - timezone.timedelta(days=10),
            end_date=timezone.now() - timezone.timedelta(days=2),
            is_active=True
        )
        res = self.client.get('/api/promo-codes/check-ref/?code=EXPIREDREF')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertFalse(data['valid'])
        self.assertTrue(data['is_expired'])
        self.assertEqual(data['reason'], 'expired')
        self.assertIn('expired', data['message'].lower())

    def test_check_ref_limit_reached(self):
        from .models import PromoCode
        PromoCode.objects.create(
            code='LIMITREF',
            seller=self.seller,
            discount_type='percentage',
            value=Decimal('10.00'),
            max_uses=5,
            use_count=5,
            is_active=True
        )
        res = self.client.get('/api/promo-codes/check-ref/?code=LIMITREF')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertFalse(data['valid'])
        self.assertTrue(data['is_expired'])
        self.assertEqual(data['reason'], 'limit_reached')

    def test_multi_influencer_promoting_same_product(self):
        """Verify multiple influencers can promote the exact same product with distinct codes & ledgers."""
        from .models import PromoCode, Order, OrderItem
        promo_a = PromoCode.objects.create(
            code='INFLUENCER_A',
            seller=self.seller,
            affiliate_name='Creator Alice',
            discount_type='percentage',
            value=Decimal('10.00'),
            commission_type='percentage',
            commission_rate=Decimal('5.00'),
            applicable_scope='single_product',
            product=self.product
        )
        promo_b = PromoCode.objects.create(
            code='INFLUENCER_B',
            seller=self.seller,
            affiliate_name='Creator Bob',
            discount_type='percentage',
            value=Decimal('15.00'),
            commission_type='fixed',
            commission_rate=Decimal('3000.00'),
            applicable_scope='single_product',
            product=self.product
        )

        # Both promo codes point to the exact same product without conflicts
        self.assertEqual(promo_a.product_id, self.product.id)
        self.assertEqual(promo_b.product_id, self.product.id)

        # Validate code A
        res_a = self.client.post('/api/promo-codes/validate/', {
            'code': 'INFLUENCER_A',
            'merchant': self.seller.username,
            'items': [{'product_id': self.product.id, 'price': 50000, 'quantity': 1}]
        }, format='json')
        self.assertEqual(res_a.status_code, 200)
        self.assertEqual(res_a.json()['code'], 'INFLUENCER_A')
        self.assertEqual(res_a.json()['affiliate_name'], 'Creator Alice')

        # Validate code B
        res_b = self.client.post('/api/promo-codes/validate/', {
            'code': 'INFLUENCER_B',
            'merchant': self.seller.username,
            'items': [{'product_id': self.product.id, 'price': 50000, 'quantity': 1}]
        }, format='json')
        self.assertEqual(res_b.status_code, 200)
        self.assertEqual(res_b.json()['code'], 'INFLUENCER_B')
        self.assertEqual(res_b.json()['affiliate_name'], 'Creator Bob')

    def test_promo_code_edit_validation_returns_400_not_500(self):
        """Verify editing a promo code with invalid product ownership returns 400 Bad Request, never 500."""
        from .models import PromoCode, Product
        other_seller = User.objects.create_user('other_seller', 'other@test.com', 'Pass123!')
        other_product = Product.objects.create(
            name='Other Store Item',
            seller=other_seller,
            category=self.cat,
            price=Decimal('20000.00'),
            stock=10
        )
        promo = PromoCode.objects.create(
            code='SELLER_PROMO',
            seller=self.seller,
            value=Decimal('10.00'),
            discount_type='percentage',
            applicable_scope='single_product',
            product=self.product
        )

        self.client.force_authenticate(user=self.seller)
        # Try to patch promo with another seller's product
        res = self.client.patch(f'/api/promo-codes/{promo.id}/', {
            'product': other_product.id
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('product', res.json())
        self.assertNotEqual(res.status_code, 500)

    def test_admin_promo_code_edit_reassigns_seller_seamlessly(self):
        """Verify admin editing a promo code with a new product updates seller cleanly without 500."""
        from .models import PromoCode, Product
        admin_user = User.objects.create_superuser('admin_user', 'admin@test.com', 'AdminPass123!')
        admin_prod = Product.objects.create(
            name='Admin Special Product',
            seller=admin_user,
            category=self.cat,
            price=Decimal('75000.00'),
            stock=5
        )
        promo = PromoCode.objects.create(
            code='EXISTING_PROMO',
            seller=self.seller,
            value=Decimal('10.00'),
            discount_type='percentage',
            applicable_scope='single_product',
            product=self.product
        )

        self.client.force_authenticate(user=admin_user)
        res = self.client.patch(f'/api/promo-codes/{promo.id}/', {
            'product': admin_prod.id
        }, format='json')
        self.assertEqual(res.status_code, 200)
        promo.refresh_from_db()
        self.assertEqual(promo.product_id, admin_prod.id)
        self.assertEqual(promo.seller_id, admin_user.id)


class ConversationPaginationTests(TestCase):
    def setUp(self):
        self.buyer = User.objects.create_user('chatbuyer', 'chatbuyer@test.com', 'ChatPass123!')
        self.seller = User.objects.create_user('chatseller', 'chatseller@test.com', 'ChatPass123!')
        self.conv = Conversation.objects.create(buyer=self.buyer, seller=self.seller)
        from django.utils import timezone
        now = timezone.now()
        msgs = []
        for i in range(45):
            msgs.append(Message(
                conversation=self.conv,
                sender=self.buyer if i % 2 == 0 else self.seller,
                content=f'Message {i}',
                created_at=now + timezone.timedelta(seconds=i)
            ))
        Message.objects.bulk_create(msgs)
        self.client = APIClient()
        token = RefreshToken.for_user(self.buyer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

    def test_cursor_pagination(self):
        # Initial request: limit=20 -> returns latest 20 messages with has_more=True
        res = self.client.get(f'/api/conversations/{self.conv.id}/messages/?limit=20')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn('results', data)
        self.assertEqual(len(data['results']), 20)
        self.assertTrue(data['has_more'])
        oldest_returned_id = data['results'][0]['id']
        self.assertEqual(data['oldest_id'], oldest_returned_id)

        # Second request using cursor: before_id=oldest_returned_id, limit=20
        res2 = self.client.get(f'/api/conversations/{self.conv.id}/messages/?before_id={oldest_returned_id}&limit=20')
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        self.assertEqual(len(data2['results']), 20)
        self.assertTrue(data2['has_more'])
        oldest_second_batch_id = data2['results'][0]['id']

        # Third request: remaining 5 messages -> has_more should be False
        res3 = self.client.get(f'/api/conversations/{self.conv.id}/messages/?before_id={oldest_second_batch_id}&limit=20')
        self.assertEqual(res3.status_code, 200)
        data3 = res3.json()
        self.assertEqual(len(data3['results']), 5)
        self.assertFalse(data3['has_more'])


class PartNumberSearchTests(TestCase):
    def setUp(self):
        self.seller = User.objects.create_user('partseller', 'seller@parts.com', 'Pass1234!')
        self.cat = Category.objects.create(name='Auto Parts', slug='auto-parts')
        self.product1 = Product.objects.create(
            name='Front Brake Pads',
            slug='front-brake-pads-oem-78484',
            price=Decimal('45000.00'),
            stock=10,
            seller=self.seller,
            category=self.cat,
            is_available=True,
            specifications={'oem_part_number': 'OEM-78484'}
        )
        self.product2 = Product.objects.create(
            name='Alternator Assembly',
            slug='alternator-assembly-28100',
            price=Decimal('150000.00'),
            stock=5,
            seller=self.seller,
            category=self.cat,
            is_available=True,
            sku='OEM-28100-0T060'
        )
        self.product3 = Product.objects.create(
            name='Generic Car Wash Shampoo',
            slug='car-wash-shampoo',
            price=Decimal('10000.00'),
            description='Suitable for all brake and engine bays',
            stock=20,
            seller=self.seller,
            category=self.cat,
            is_available=True,
            specifications={}
        )
        self.client = APIClient()

    def test_search_by_partial_number(self):
        res = self.client.get('/api/products/?q=78484')
        self.assertEqual(res.status_code, 200)
        results = res.json().get('results', [])
        ids = [p['id'] for p in results]
        self.assertIn(self.product1.id, ids)

    def test_search_by_full_oem_part_number(self):
        res = self.client.get('/api/products/?q=OEM-78484')
        self.assertEqual(res.status_code, 200)
        results = res.json().get('results', [])
        ids = [p['id'] for p in results]
        self.assertIn(self.product1.id, ids)

    def test_search_by_condensed_number(self):
        res = self.client.get('/api/products/?q=OEM78484')
        self.assertEqual(res.status_code, 200)
        results = res.json().get('results', [])
        ids = [p['id'] for p in results]
        self.assertIn(self.product1.id, ids)

    def test_search_by_space_separated_number(self):
        res = self.client.get('/api/products/?q=OEM 78484')
        self.assertEqual(res.status_code, 200)
        results = res.json().get('results', [])
        ids = [p['id'] for p in results]
        self.assertIn(self.product1.id, ids)

    def test_filter_by_oem_part_number_partial(self):
        res = self.client.get('/api/products/?oem_part_number=78484')
        self.assertEqual(res.status_code, 200)
        results = res.json().get('results', [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], self.product1.id)

    def test_search_sku_part_number(self):
        res = self.client.get('/api/products/?q=28100')
        self.assertEqual(res.status_code, 200)
        results = res.json().get('results', [])
        ids = [p['id'] for p in results]
        self.assertIn(self.product2.id, ids)

    def test_relevance_ranking_part_number_at_top(self):
        res = self.client.get('/api/products/?q=78484')
        self.assertEqual(res.status_code, 200)
        results = res.json().get('results', [])
        self.assertTrue(len(results) > 0)
        self.assertEqual(results[0]['id'], self.product1.id)


class APlusContentTests(TestCase):
    def setUp(self):
        import json
        from django.utils import timezone
        from marketplace.models import SubscriptionTier, Subscription
        self.seller = User.objects.create_user('aplusseller', 'aplus@example.com', 'Pass1234!')
        self.seller.profile.role = 'seller'
        self.seller.profile.tier = 'seller_pro'
        self.seller.profile.save()
        tier, _ = SubscriptionTier.objects.get_or_create(
            tier_level='seller_pro',
            defaults={'name': 'Seller Pro', 'price': Decimal('50000.00'), 'benefits': 'Sell', 'duration': 30, 'commission_rate': Decimal('10.00')}
        )
        Subscription.objects.create(
            user=self.seller,
            tier=tier,
            start_date=timezone.now(),
            end_date=timezone.now() + timezone.timedelta(days=30),
            is_active=True
        )
        self.cat = Category.objects.create(name='Electronics', slug='electronics')
        self.client = APIClient()

    def test_create_and_retrieve_product_with_a_plus_content(self):
        import json
        self.client.force_authenticate(user=self.seller)
        payload = {
            'name': 'High-Tech Headphone',
            'price': '85000.00',
            'stock': 15,
            'category': self.cat.id,
            'description': 'Studio quality noise cancelling headphones.',
            'condition': 'New',
            'has_a_plus_content': 'true',
            'a_plus_content': json.dumps({
                'headline': 'From the manufacturer',
                'company_logo': 'https://example.com/logo.png',
                'modules': [
                    {
                        'type': 'hero_banner',
                        'image': 'https://example.com/banner.jpg',
                        'headline': 'Next-Gen Acoustic Fidelity',
                        'body': 'Constructed with custom 40mm beryllium drivers.'
                    }
                ]
            })
        }
        res = self.client.post('/api/products/', payload)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data['has_a_plus_content'])
        self.assertEqual(res.data['a_plus_content']['headline'], 'From the manufacturer')
        self.assertEqual(len(res.data['a_plus_content']['modules']), 1)

        # Retrieve through GET /api/products/<slug>/
        slug = res.data['slug']
        get_res = self.client.get(f'/api/products/{slug}/')
        self.assertEqual(get_res.status_code, 200)
        self.assertTrue(get_res.data['has_a_plus_content'])
        self.assertEqual(get_res.data['a_plus_content']['modules'][0]['type'], 'hero_banner')

    def test_upload_content_image(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_authenticate(user=self.seller)
        import io
        from PIL import Image
        buf = io.BytesIO()
        img = Image.new('RGB', (10, 10), color='red')
        img.save(buf, format='PNG')
        dummy_img = SimpleUploadedFile(
            name='test_banner.png',
            content=buf.getvalue(),
            content_type='image/png'
        )
        res = self.client.post('/api/products/upload_content_image/', {'image': dummy_img}, format='multipart')
        self.assertEqual(res.status_code, 201)
        self.assertIn('url', res.data)
        self.assertTrue(res.data['url'].startswith('/media/a_plus_content/'))


class SellerSiteVisitTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user('purecustomer', 'pure@test.com', 'Pass1234!')
        UserProfile.objects.get_or_create(user=self.customer, defaults={'phone_number': '0711000001'})

        # Staff user
        self.staff_user = User.objects.create_user('fieldstaff', 'staff@test.com', 'StaffPass123!', is_staff=True)
        from staff.models import StaffProfile
        StaffProfile.objects.create(user=self.staff_user, is_active=True)

        # Admin user
        self.admin_user = User.objects.create_superuser('adminuser', 'admin@test.com', 'AdminPass123!')

        self.client = APIClient()

    def test_pure_customer_initial_status_and_verification_flow(self):
        # 1. Customer checks status: initially can_upgrade is False, no visit
        self.client.force_authenticate(user=self.customer)
        res = self.client.get('/api/seller-site-visits/my-status/')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['can_upgrade'])
        self.assertEqual(res.data['status'], 'none')
        self.assertFalse(res.data['has_site_visit'])

        # 2. Staff conducts physical visit and submits report
        self.client.force_authenticate(user=self.staff_user)
        submit_payload = {
            'user': self.customer.id,
            'business_name': 'Kariakoo Electronics Hub',
            'contact_person': 'Juma Ali',
            'contact_phone': '0711000001',
            'address': 'Msimbazi St, Kariakoo',
            'region': 'Dar es Salaam',
            'district': 'Ilala',
            'latitude': -6.8200,
            'longitude': 39.2700,
            'staff_notes': 'Physical store inspected. Stock and business license confirmed.'
        }
        submit_res = self.client.post('/api/staff/site-visits/', submit_payload, format='json')
        self.assertEqual(submit_res.status_code, 201)
        visit_id = submit_res.data['id']
        self.assertEqual(submit_res.data['status'], 'pending_review')

        # Customer checks status: now pending_review, but can_upgrade is still False
        self.client.force_authenticate(user=self.customer)
        res = self.client.get('/api/seller-site-visits/my-status/')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['can_upgrade'])
        self.assertEqual(res.data['status'], 'pending_review')

        # 3. Admin reviews and approves the site visit
        self.client.force_authenticate(user=self.admin_user)
        approve_res = self.client.post(f'/api/staff/site-visits/{visit_id}/approve/')
        self.assertEqual(approve_res.status_code, 200)
        self.assertEqual(approve_res.data['status'], 'approved')

        # 4. Verify post_save updates customer profile
        self.customer.profile.refresh_from_db()
        self.assertTrue(self.customer.profile.is_location_verified)
        self.assertEqual(self.customer.profile.location, 'Msimbazi St, Kariakoo')
        self.assertAlmostEqual(float(self.customer.profile.latitude), -6.8200, places=4)
        self.assertAlmostEqual(float(self.customer.profile.longitude), 39.2700, places=4)

        # 5. Customer checks status again: can_upgrade is now True
        self.client.force_authenticate(user=self.customer)
        res = self.client.get('/api/seller-site-visits/my-status/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['can_upgrade'])
        self.assertEqual(res.data['status'], 'approved')
        self.assertEqual(res.data['site_visit']['business_name'], 'Kariakoo Electronics Hub')


from django.test import override_settings

@override_settings(CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}})
class ForgotPasswordRateLimitTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.user = User.objects.create_user('resetuser', 'reset@test.com', 'Pass1234!')
        self.client = APIClient()

    def test_rate_limit_three_requests_and_feedback(self):
        # 1st attempt: 2 attempts left
        res1 = self.client.post('/api/auth/forgot-password/', {'email': 'reset@test.com'}, format='json')
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.data['attempts_made'], 1)
        self.assertEqual(res1.data['attempts_left'], 2)
        self.assertNotIn('warning', res1.data)

        # 2nd attempt: 1 attempt left, warning shown
        res2 = self.client.post('/api/auth/forgot-password/', {'email': 'reset@test.com'}, format='json')
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.data['attempts_made'], 2)
        self.assertEqual(res2.data['attempts_left'], 1)
        self.assertIn('1 attempt remaining', res2.data['warning'])

        # 3rd attempt: 0 attempts left, final attempt warning shown
        res3 = self.client.post('/api/auth/forgot-password/', {'email': 'reset@test.com'}, format='json')
        self.assertEqual(res3.status_code, 200)
        self.assertEqual(res3.data['attempts_made'], 3)
        self.assertEqual(res3.data['attempts_left'], 0)
        self.assertIn('final attempt', res3.data['warning'])

        # 4th attempt: 429 Too Many Requests, retry_after present
        res4 = self.client.post('/api/auth/forgot-password/', {'email': 'reset@test.com'}, format='json')
        self.assertEqual(res4.status_code, 429)
        self.assertIn('Daily limit reached', res4.data['error'])
        self.assertIn('retry_after_formatted', res4.data)
        self.assertIn('retry_after_seconds', res4.data)
        self.assertIn('Retry-After', res4.headers)

    def test_anti_enumeration_uniformity(self):
        # Unregistered email receives identical status and attempts tracking
        res1 = self.client.post('/api/auth/forgot-password/', {'email': 'nonexistent@test.com'}, format='json')
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.data['attempts_left'], 2)

        res2 = self.client.post('/api/auth/forgot-password/', {'email': 'nonexistent@test.com'}, format='json')
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.data['attempts_left'], 1)

        res3 = self.client.post('/api/auth/forgot-password/', {'email': 'nonexistent@test.com'}, format='json')
        self.assertEqual(res3.status_code, 200)
        self.assertEqual(res3.data['attempts_left'], 0)

        res4 = self.client.post('/api/auth/forgot-password/', {'email': 'nonexistent@test.com'}, format='json')
        self.assertEqual(res4.status_code, 429)

    def test_gmail_normalization_prevents_evasion(self):
        # Gmail dot trick and plus addressing share the same limit
        res1 = self.client.post('/api/auth/forgot-password/', {'email': 'alice.smith@gmail.com'}, format='json')
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.data['attempts_left'], 2)

        res2 = self.client.post('/api/auth/forgot-password/', {'email': 'alicesmith+test@gmail.com'}, format='json')
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.data['attempts_left'], 1)

class SiteSettingsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.buyer = User.objects.create_user(username='buyer_user', email='buyer@test.com', password='pass')
        UserProfile.objects.get_or_create(user=self.buyer)

    def test_site_settings_public_get(self):
        res = self.client.get('/api/site-settings/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('support_phone', res.data)
        self.assertIn('whatsapp_number', res.data)
        self.assertIn('facebook_url', res.data)
        self.assertIn('instagram_url', res.data)
        self.assertIn('twitter_url', res.data)
        self.assertIn('tiktok_url', res.data)
        self.assertIn('linkedin_url', res.data)
        self.assertIn('youtube_url', res.data)

    def test_site_settings_staff_patch_permission(self):
        # 1. Unauthenticated PATCH -> 401/403
        self.client.credentials()  # Clear auth
        res_anon = self.client.patch('/api/site-settings/', {'support_phone': '+255711111111'}, format='json')
        self.assertIn(res_anon.status_code, [401, 403])

        # 2. Regular buyer/customer PATCH -> 403
        token_buyer = RefreshToken.for_user(self.buyer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token_buyer.access_token)}')
        res_buyer = self.client.patch('/api/site-settings/', {'support_phone': '+255711111111'}, format='json')
        self.assertEqual(res_buyer.status_code, 403)

        # 3. Staff / Superuser PATCH -> 200 and fields updated
        admin_user = User.objects.create_superuser(username='admin_settings', email='admin@test.com', password='pass')
        token_admin = RefreshToken.for_user(admin_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token_admin.access_token)}')

        payload = {
            'support_phone': '+255 789 123 456',
            'whatsapp_number': '+255 789 123 456',
            'support_email': 'support@sokonimax.co.tz',
            'tiktok_url': 'https://tiktok.com/@sokonimax',
            'linkedin_url': 'https://linkedin.com/company/sokonimax',
            'youtube_url': 'https://youtube.com/@sokonimax',
        }
        res_admin = self.client.patch('/api/site-settings/', payload, format='json')
        self.assertEqual(res_admin.status_code, 200)
        self.assertEqual(res_admin.data['support_phone'], '+255 789 123 456')
        self.assertEqual(res_admin.data['whatsapp_number'], '+255 789 123 456')
        self.assertEqual(res_admin.data['tiktok_url'], 'https://tiktok.com/@sokonimax')
        self.assertEqual(res_admin.data['linkedin_url'], 'https://linkedin.com/company/sokonimax')
        self.assertEqual(res_admin.data['youtube_url'], 'https://youtube.com/@sokonimax')


class POSTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.seller = User.objects.create_user(username='pos_seller', email='seller@test.com', password='pass')
        self.seller_profile = UserProfile.objects.get_or_create(user=self.seller, defaults={'role': 'seller', 'tier': 'seller_pro'})[0]
        self.seller_profile.role = 'seller'
        self.seller_profile.tier = 'seller_pro'
        self.seller_profile.save()

        from marketplace.models import SubscriptionTier, Subscription
        from django.utils import timezone
        from datetime import timedelta
        tier, _ = SubscriptionTier.objects.get_or_create(name='Pro', defaults={'tier_level': 'seller_pro', 'price': Decimal('20000.00'), 'duration': 30, 'benefits': 'All Pro Features'})
        Subscription.objects.create(
            user=self.seller,
            tier=tier,
            is_active=True,
            start_date=timezone.now(),
            end_date=timezone.now() + timedelta(days=30)
        )

        self.category = Category.objects.create(name='Electronics')
        self.product = Product.objects.create(
            name='POS Speaker',
            seller=self.seller,
            price=Decimal('100000.00'),
            stock=10,
            category=self.category,
            is_available=True
        )

        from .models import PromoCode
        self.promo = PromoCode.objects.create(
            code='POS10',
            seller=self.seller,
            discount_type='percentage',
            value=Decimal('10.00'),
            applicable_scope='all_products',
            is_active=True
        )

    def test_pos_checkout_with_promo_and_three_percent_commission(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        from billing.models import CommissionLedgerEntry
        from .models import Order

        token = RefreshToken.for_user(self.seller)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

        payload = {
            'customer_name': 'Walk-in Alice',
            'amount_paid': 90000,
            'promo_code': 'POS10',
            'items': [
                {
                    'product_id': self.product.id,
                    'quantity': 1,
                    'price': float(self.product.price)
                }
            ]
        }

        res = self.client.post('/api/orders/pos-checkout/', payload, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        
        order = Order.objects.get(id=res.data['id'])
        # Subtotal: 100,000, 10% discount = 10,000, Total = 90,000
        self.assertEqual(order.discount_amount, Decimal('10000.00'))
        self.assertEqual(order.total_amount, Decimal('90000.00'))
        self.assertEqual(order.promo_code, self.promo)

        # Check promo use count incremented
        self.promo.refresh_from_db()
        self.assertEqual(self.promo.use_count, 1)

        # Check platform fee and commission ledger entry (3% of net amount 90,000 = 2,700)
        self.assertEqual(order.platform_fee, Decimal('2700.00'))
        ledger_entry = CommissionLedgerEntry.objects.get(order=order)
        self.assertEqual(ledger_entry.commission_rate, Decimal('3.00'))
        self.assertEqual(ledger_entry.order_amount, Decimal('90000.00'))
        self.assertEqual(ledger_entry.commission_amount, Decimal('2700.00'))

    def test_pos_checkout_with_custom_discount(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        from billing.models import CommissionLedgerEntry
        from .models import Order

        token = RefreshToken.for_user(self.seller)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

        payload = {
            'customer_name': 'Walk-in Bob',
            'amount_paid': 95000,
            'discount_amount': 5000,
            'items': [
                {
                    'product_id': self.product.id,
                    'quantity': 1,
                    'price': float(self.product.price)
                }
            ]
        }

        res = self.client.post('/api/orders/pos-checkout/', payload, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        
        order = Order.objects.get(id=res.data['id'])
        # Subtotal: 100,000, Custom discount = 5,000, Total = 95,000
        self.assertEqual(order.discount_amount, Decimal('5000.00'))
        self.assertEqual(order.total_amount, Decimal('95000.00'))
        self.assertIsNone(order.promo_code)

        # Platform fee (3% of 95,000 = 2,850)
        self.assertEqual(order.platform_fee, Decimal('2850.00'))
        ledger_entry = CommissionLedgerEntry.objects.get(order=order)
        self.assertEqual(ledger_entry.commission_rate, Decimal('3.00'))
        self.assertEqual(ledger_entry.order_amount, Decimal('95000.00'))
        self.assertEqual(ledger_entry.commission_amount, Decimal('2850.00'))

    def test_pos_checkout_with_custom_pos_commission_rate(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        from billing.models import CommissionLedgerEntry
        from .models import Order, SiteSettings

        settings = SiteSettings.get()
        settings.pos_commission_rate = Decimal('5.00')
        settings.save()

        token = RefreshToken.for_user(self.seller)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

        payload = {
            'customer_name': 'Walk-in Charlie',
            'amount_paid': 100000,
            'items': [
                {
                    'product_id': self.product.id,
                    'quantity': 1,
                    'price': float(self.product.price)
                }
            ]
        }

        res = self.client.post('/api/orders/pos-checkout/', payload, format='json')
        self.assertEqual(res.status_code, 201, res.data)

        order = Order.objects.get(id=res.data['id'])
        # Platform fee (5% of 100,000 = 5,000)
        self.assertEqual(order.platform_fee, Decimal('5000.00'))
        ledger_entry = CommissionLedgerEntry.objects.get(order=order)
        self.assertEqual(ledger_entry.commission_rate, Decimal('5.00'))
        self.assertEqual(ledger_entry.commission_amount, Decimal('5000.00'))