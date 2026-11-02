import os
import json
import hashlib
from decimal import Decimal
from django.test import TestCase, Client, RequestFactory
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.cache import cache

from marketplace.models import (
    Order, OrderItem, Product, Category, GeofenceSettings,
    DigitalAsset, DigitalAccessLicense, Payment
)
from marketplace.serializers import compute_invoice_signature, DigitalAssetSerializer
from uzachuo.geofence import GeofenceMiddleware, evaluate_http_geofence, get_cached_geofence_config


class SecurityAuditRegressionTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = Client()
        self.rf = RequestFactory()

        # Users
        self.admin = User.objects.create_superuser('audit_admin', 'admin@example.com', 'adminpass123')
        self.staff_user = User.objects.create_user('audit_staff', 'staff@example.com', 'staffpass123', is_staff=True)
        self.seller = User.objects.create_user('audit_seller', 'seller@example.com', 'sellerpass123')
        self.buyer = User.objects.create_user('audit_buyer', 'buyer@example.com', 'buyerpass123')

        # Category & Product
        self.category = Category.objects.create(name='Test Category', slug='test-category')
        self.product = Product.objects.create(
            seller=self.seller,
            name='Test Physical Item',
            slug='test-physical-item',
            category=self.category,
            price=Decimal('15000.00'),
            stock=10,
            is_available=True,
            is_draft=False
        )

    def tearDown(self):
        cache.clear()

    # ─────────────────────────────────────────────────────────────
    # Test 1: PublicInvoiceVerifyView anti-tamper signature & leak ban
    # ─────────────────────────────────────────────────────────────
    def test_invoice_verify_anti_tamper_and_leak_ban(self):
        order = Order.objects.create(
            user=self.buyer,
            status='INVOICE_GENERATED',
            total_amount=Decimal('15000.00'),
            delivery_info={'full_name': 'John Doe', 'contact_name': 'John Doe'}
        )
        OrderItem.objects.create(
            order=order, product=self.product, quantity=1, price=Decimal('15000.00')
        )

        # 1. Unauthenticated request without signature must return 403
        resp = self.client.get(f'/api/invoices/verify/{order.id}/')
        self.assertEqual(resp.status_code, 403)
        data = resp.json()
        self.assertFalse(data.get('is_authentic'))
        self.assertNotIn('items', data)

        # 2. Cart order must return 404
        order.status = 'CART'
        order.save()
        created_ts = int(order.order_date.timestamp()) if order.order_date else 0
        sig = compute_invoice_signature(order.id, created_ts)
        resp = self.client.get(f'/api/invoices/verify/{order.id}/?sig={sig}')
        self.assertEqual(resp.status_code, 404)

        # 3. Valid invoice with valid signature returns 200 and never leaks verification_token
        order.status = 'INVOICE_GENERATED'
        order.save()
        resp = self.client.get(f'/api/invoices/verify/{order.id}/?sig={sig}')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get('is_authentic'))
        self.assertTrue(data.get('sig_valid'))
        self.assertIsNone(data.get('verification_token'))
        # Buyer name is masked for unauthenticated scans
        self.assertNotEqual(data.get('buyer', {}).get('name'), 'John Doe')

    # ─────────────────────────────────────────────────────────────
    # Test 2: Advance & Payment Self-Dealing / Warehouse locks
    # ─────────────────────────────────────────────────────────────
    def test_payment_and_advance_self_dealing_bans(self):
        order = Order.objects.create(
            user=self.seller,  # Buyer is the seller (self-dealing attempt)
            status='AWAITING_PAYMENT',
            total_amount=Decimal('15000.00'),
            fulfillment_type='DIRECT_DELIVERY'
        )
        payment = Payment.objects.create(
            order=order,
            amount=Decimal('15000.00'),
            payment_method='TIGO_PESA',
            status='PENDING_VERIFICATION'
        )

        # Seller attempts to verify payment on their own order (self-dealing)
        self.client.force_login(self.seller)
        resp = self.client.post(f'/api/payments/{payment.id}/verify/')
        self.assertEqual(resp.status_code, 403)
        self.assertIn('Self-dealing is prohibited', resp.json().get('error', ''))

        # Buyer attempts advance to PAID directly (self-dealing bypass attempt)
        self.client.force_login(self.buyer)
        buyer_order = Order.objects.create(
            user=self.buyer,
            status='AWAITING_PAYMENT',
            total_amount=Decimal('15000.00')
        )
        resp = self.client.post(f'/api/orders/{buyer_order.id}/advance/', {'status': 'PAID'}, content_type='application/json')
        self.assertEqual(resp.status_code, 403)

    # ─────────────────────────────────────────────────────────────
    # Test 3: Junior staff cannot escalate is_superuser via PATCH
    # ─────────────────────────────────────────────────────────────
    def test_staff_cannot_escalate_superuser_via_patch(self):
        self.client.force_login(self.staff_user)
        target_user = User.objects.create_user('victim_user', 'victim@example.com', 'pass123', is_superuser=False)
        resp = self.client.patch(
            f'/api/staff/users/{target_user.id}/',
            json.dumps({'is_superuser': True, 'is_staff': True}),
            content_type='application/json'
        )
        target_user.refresh_from_db()
        self.assertFalse(target_user.is_superuser)

    # ─────────────────────────────────────────────────────────────
    # Test 4: DigitalAssetSerializer write_only file & %PDF- magic validation
    # ─────────────────────────────────────────────────────────────
    def test_digital_asset_file_validation(self):
        # Valid PDF header
        valid_pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
        valid_file = SimpleUploadedFile("book.pdf", valid_pdf_content, content_type="application/pdf")

        # Fake PDF header (magic byte mismatch)
        fake_pdf_content = b"<html><script>alert(1)</script></html>"
        fake_file = SimpleUploadedFile("exploit.pdf", fake_pdf_content, content_type="application/pdf")

        # Test serializer validation with fake PDF
        serializer_fail = DigitalAssetSerializer(data={
            'product': self.product.id,
            'title': 'Test Exploit',
            'file_type': 'PDF',
            'delivery_mode': 'STREAM_AND_DOWNLOAD',
            'file': fake_file
        }, context={'request': self.rf.post('/')})
        self.assertFalse(serializer_fail.is_valid())
        err_str = str(serializer_fail.errors)
        self.assertTrue('file' in serializer_fail.errors or 'non_field_errors' in serializer_fail.errors)
        self.assertIn('PDF digital assets must be valid', err_str)

        # Test serializer validation with valid PDF
        self.product.seller = self.seller
        self.product.save()
        rf_req = self.rf.post('/')
        rf_req.user = self.seller

        serializer_ok = DigitalAssetSerializer(data={
            'product': self.product.id,
            'title': 'Test Good Book',
            'file_type': 'PDF',
            'delivery_mode': 'STREAM_AND_DOWNLOAD',
            'file': valid_file
        }, context={'request': rf_req})
        self.assertTrue(serializer_ok.is_valid(), serializer_ok.errors)

    # ─────────────────────────────────────────────────────────────
    # Test 5: GeofenceMiddleware enforcement & exemptions
    # ─────────────────────────────────────────────────────────────
    def test_geofence_middleware_rules(self):
        gs = GeofenceSettings.load()
        gs.is_enabled = True
        gs.enforcement_mode = 'STRICT_BLOCK'
        gs.allowed_countries = ['TZ']
        gs.whitelisted_ips = ''
        gs.save()
        cache.clear()

        # 1. Allowed country (TZ) + public IP -> 200 OK
        resp = self.client.get('/api/products/', HTTP_CF_IPCOUNTRY='TZ', REMOTE_ADDR='197.186.10.5')
        self.assertEqual(resp.status_code, 200)

        # 2. Disallowed country (US) + public IP -> 451 Region Restricted
        resp = self.client.get('/api/products/', HTTP_CF_IPCOUNTRY='US', REMOTE_ADDR='8.8.8.8')
        self.assertEqual(resp.status_code, 451)
        data = resp.json()
        self.assertEqual(data.get('code'), 'region_restricted')

        # 3. Exempt Lightsail cluster IP (Mumbai App Node: 3.6.193.212) -> 200 OK
        resp = self.client.get('/api/products/', HTTP_CF_IPCOUNTRY='IN', REMOTE_ADDR='3.6.193.212')
        self.assertEqual(resp.status_code, 200)

        # 4. Admin path (/admin/login/) from foreign country (US) -> 200 OK (never locked out)
        resp = self.client.get('/admin/login/', HTTP_CF_IPCOUNTRY='US', REMOTE_ADDR='8.8.8.8')
        self.assertEqual(resp.status_code, 200)

        # 5. Authenticated superuser from foreign country (US) -> 200 OK
        self.client.force_login(self.admin)
        resp = self.client.get('/api/products/', HTTP_CF_IPCOUNTRY='US', REMOTE_ADDR='8.8.8.8')
        self.assertEqual(resp.status_code, 200)
