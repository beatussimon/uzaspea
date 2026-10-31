import io
from datetime import timedelta
from django.test import TestCase, RequestFactory
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from reportlab.pdfgen import canvas

from marketplace.models import (
    Product, ProductVariant, Order, OrderItem, Category,
    DigitalAsset, DigitalAccessLicense, DigitalAccessToken
)
from marketplace.services import OrderStateMachine
from marketplace.digital_services import (
    generate_access_token,
    validate_access_token,
    apply_pdf_watermark,
    issue_offline_lease,
    ChunkedRangeFileStreamer
)


class DigitalProductsFulfillmentAndSecurityTest(TestCase):
    def setUp(self):
        self.seller = User.objects.create_user(username='bookauthor', password='password123')
        self.buyer = User.objects.create_user(username='bookreader', email='reader@example.com', password='password123')
        self.category = Category.objects.create(name='Books & Literature', slug='books')

        # Create a book with PDF & Audiobook digital variants
        self.book = Product.objects.create(
            seller=self.seller,
            category=self.category,
            name='The Architectural Mind',
            description='A deep dive into scalable system design.',
            price=25000,
            product_type='HYBRID',
            stock=100
        )

        self.pdf_variant = ProductVariant.objects.create(
            product=self.book,
            name='Watermarked PDF Edition',
            format_type='DIGITAL_FILE',
            price_adjustment=0,
            stock=9999,
            is_unlimited_stock=True
        )

        self.audio_variant = ProductVariant.objects.create(
            product=self.book,
            name='Unabridged Audiobook (MP3)',
            format_type='AUDIOBOOK',
            price_adjustment=5000,
            stock=9999,
            is_unlimited_stock=True
        )

        # Generate a small in-memory PDF for testing
        pdf_buf = io.BytesIO()
        c = canvas.Canvas(pdf_buf)
        c.drawString(100, 700, 'Chapter 1: The Foundations of Resilient Architecture')
        c.save()
        pdf_buf.seek(0)

        self.pdf_asset = DigitalAsset.objects.create(
            product=self.book,
            variant=self.pdf_variant,
            title='The Architectural Mind (PDF)',
            file_type='PDF',
            file=SimpleUploadedFile('architectural_mind.pdf', pdf_buf.getvalue(), content_type='application/pdf'),
            file_size_bytes=len(pdf_buf.getvalue()),
            page_count=1,
            delivery_mode='STREAM_AND_DOWNLOAD',
            max_downloads_per_license=3,
            watermark_enabled=True
        )

        self.audio_asset = DigitalAsset.objects.create(
            product=self.book,
            variant=self.audio_variant,
            title='The Architectural Mind (Audiobook)',
            file_type='AUDIO',
            file=SimpleUploadedFile('audiobook.mp3', b'ID3\x03\x00\x00\x00\x00\x00FakeAudioBytesChunk1234567890', content_type='audio/mpeg'),
            file_size_bytes=35,
            duration_seconds=3600,
            delivery_mode='STREAM_ONLY',
            max_downloads_per_license=0,
            watermark_enabled=False
        )

    def test_pure_digital_order_auto_fulfillment_and_completion(self):
        """Test that paying for a purely digital item auto-provisions licenses and completes order immediately."""
        order = Order.objects.create(
            user=self.buyer,
            status='AWAITING_PAYMENT',
            shipping_method='DELIVERY',
            fulfillment_type='DIRECT_DELIVERY',
            shipping_fee=0,
            total_amount=25000
        )
        OrderItem.objects.create(
            order=order,
            product=self.book,
            variant=self.pdf_variant,
            quantity=1,
            price=25000
        )

        # Transition order to PAID via state machine
        OrderStateMachine.transition_order(order, 'PAID', notes='Payment received via M-Pesa')
        order.refresh_from_db()

        # Purely digital order should immediately advance to COMPLETED
        self.assertEqual(order.status, 'COMPLETED')

        # Verify DigitalAccessLicense was created and is ACTIVE
        licenses = DigitalAccessLicense.objects.filter(order=order, user=self.buyer)
        self.assertEqual(licenses.count(), 1)
        lic = licenses.first()
        self.assertEqual(lic.status, 'ACTIVE')
        self.assertEqual(lic.digital_asset, self.pdf_asset)
        self.assertTrue(lic.license_key.startswith('LIC-'))
        self.assertTrue(lic.is_valid())
        self.assertTrue(lic.can_download())
        self.assertEqual(lic.download_count, 0)

    def test_license_revocation_on_cancellation(self):
        """Test anti-piracy kill switch: cancelling or refunding an order revokes digital license access."""
        order = Order.objects.create(
            user=self.buyer,
            status='PAID',
            shipping_method='DELIVERY',
            fulfillment_type='DIRECT_DELIVERY',
            shipping_fee=0,
            total_amount=25000
        )
        OrderItem.objects.create(
            order=order,
            product=self.book,
            variant=self.pdf_variant,
            quantity=1,
            price=25000
        )
        OrderStateMachine.fulfill_digital_licenses_for_order(order)

        lic = DigitalAccessLicense.objects.get(order=order)
        self.assertEqual(lic.status, 'ACTIVE')

        # Cancel the order (or dispute)
        OrderStateMachine.transition_order(order, 'CANCELLED', notes='Fraud alert / chargeback')
        lic.refresh_from_db()
        self.assertEqual(lic.status, 'REVOKED')
        self.assertFalse(lic.is_valid())
        self.assertFalse(lic.can_download())

    def test_token_generation_and_validation(self):
        """Test 15-minute expiring access tokens for anti-piracy streaming and downloading."""
        order = Order.objects.create(user=self.buyer, status='COMPLETED', total_amount=25000)
        lic = DigitalAccessLicense.objects.create(
            user=self.buyer,
            order=order,
            order_item=OrderItem.objects.create(order=order, product=self.book, variant=self.pdf_variant, quantity=1, price=25000),
            digital_asset=self.pdf_asset,
            status='ACTIVE'
        )

        token_obj = generate_access_token(lic, token_type='READ', expires_in_seconds=900)
        self.assertTrue(len(token_obj.token) >= 40)
        self.assertFalse(token_obj.is_expired())

        # Validate token
        valid_token, valid_lic, err = validate_access_token(token_obj.token, expected_type='READ')
        self.assertIsNone(err)
        self.assertEqual(valid_token.id, token_obj.id)
        self.assertEqual(valid_lic.id, lic.id)

        # Mismatched type check
        _, _, mismatch_err = validate_access_token(token_obj.token, expected_type='DOWNLOAD')
        self.assertIn('mismatch', mismatch_err.lower())

        # Expired token check
        token_obj.expires_at = timezone.now() - timedelta(minutes=1)
        token_obj.save()
        _, _, exp_err = validate_access_token(token_obj.token, expected_type='READ')
        self.assertIn('expired', exp_err.lower())

    def test_pdf_dynamic_watermarking(self):
        """Test on-the-fly forensic PDF watermark injection and steganographic metadata embedding."""
        order = Order.objects.create(user=self.buyer, status='COMPLETED', total_amount=25000)
        lic = DigitalAccessLicense.objects.create(
            user=self.buyer,
            order=order,
            order_item=OrderItem.objects.create(order=order, product=self.book, variant=self.pdf_variant, quantity=1, price=25000),
            digital_asset=self.pdf_asset,
            status='ACTIVE'
        )

        watermarked_bytes = apply_pdf_watermark(self.pdf_asset.file.path, lic)
        self.assertTrue(len(watermarked_bytes) > 0)

        # Inspect resulting PDF using pypdf to verify steganographic metadata
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(watermarked_bytes))
        self.assertEqual(len(reader.pages), 1)
        metadata = reader.metadata
        self.assertIn('/SokoniMaxDigitalLicense', metadata)
        self.assertIn('SokoniMax Protected Digital Vault', metadata.get('/Producer', ''))

    def test_offline_cryptographic_lease(self):
        """Test 30-day offline lease generation for WebCrypto/IndexedDB secure vault."""
        order = Order.objects.create(user=self.buyer, status='COMPLETED', total_amount=25000)
        lic = DigitalAccessLicense.objects.create(
            user=self.buyer,
            order=order,
            order_item=OrderItem.objects.create(order=order, product=self.book, variant=self.pdf_variant, quantity=1, price=25000),
            digital_asset=self.pdf_asset,
            status='ACTIVE'
        )

        lease_info = issue_offline_lease(lic, device_fingerprint='firefox-pwa-uuid-99', lease_days=30)
        self.assertIn('lease_signature', lease_info)
        self.assertEqual(lease_info['remaining_days'], 30)
        lic.refresh_from_db()
        self.assertIsNotNone(lic.offline_lease_expires_at)
        self.assertIn('firefox-pwa-uuid-99', lic.device_fingerprints)
