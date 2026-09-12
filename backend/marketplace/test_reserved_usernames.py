from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from marketplace.models import ReservedUsername
from marketplace.username_rules import (
    validate_username_format,
    validate_username_availability,
    canonicalize_username,
    strip_delimiters,
    leetspeak_normalize
)

class ReservedUsernameTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.superuser = User.objects.create_superuser(
            username='admin_boss',
            email='admin@test.com',
            password='TestPassword123!'
        )
        self.regular_user = User.objects.create_user(
            username='regular_joe',
            email='joe@test.com',
            password='TestPassword123!'
        )
        # Create a sample reserved record
        ReservedUsername.objects.create(
            username='toyota',
            category='brand_trademark',
            reason='OEM brand',
            is_active=True
        )
        ReservedUsername.objects.create(
            username='partner_exclusive',
            category='brand_trademark',
            reason='Reserved for official partner',
            is_active=True,
            reserved_for=self.regular_user
        )

    def test_format_validation(self):
        # Too short
        ok, msg, code = validate_username_format('ab')
        self.assertFalse(ok)
        self.assertEqual(code, 'too_short')

        # Numbers only
        ok, msg, code = validate_username_format('123456')
        self.assertFalse(ok)
        self.assertEqual(code, 'numbers_only')

        # Leading/trailing underscores
        ok, msg, code = validate_username_format('_username')
        self.assertFalse(ok)
        self.assertEqual(code, 'invalid_edges')

        # Consecutive underscores
        ok, msg, code = validate_username_format('user__name')
        self.assertFalse(ok)
        self.assertEqual(code, 'consecutive_underscores')

        # Valid format
        ok, msg, code = validate_username_format('valid_user_123')
        self.assertTrue(ok)

    def test_system_routes_blocked(self):
        # Top-level route collision
        for route in ['cart', 'checkout', 'admin', 'api', 'dashboard', 'settings']:
            avail, msg, code, meta = validate_username_availability(route)
            self.assertFalse(avail, f"Expected '{route}' to be blocked.")
            self.assertEqual(meta.get('tier'), 'system')

    def test_staff_and_leetspeak_spoofing(self):
        # Exact staff term
        avail, msg, code, meta = validate_username_availability('sokonimax')
        self.assertFalse(avail)
        self.assertEqual(meta.get('tier'), 'staff_official')

        # Leetspeak spoofs
        for spoof in ['adm1n', 't0y0ta', 's0k0nimax']:
            avail, msg, code, meta = validate_username_availability(spoof)
            self.assertFalse(avail, f"Expected leetspeak spoof '{spoof}' to be blocked.")

    def test_high_value_dictionary_words(self):
        # "one" should be blocked
        avail, msg, code, meta = validate_username_availability('one')
        self.assertFalse(avail)
        self.assertEqual(meta.get('tier'), 'vip_premium')

    def test_brand_reservation_in_db(self):
        # 'toyota' is in ReservedUsername table
        avail, msg, code, meta = validate_username_availability('toyota')
        self.assertFalse(avail)

        # 'partner_exclusive' is reserved for self.regular_user
        # When regular_user checks, it should be allowed
        avail, msg, code, meta = validate_username_availability('partner_exclusive', requesting_user=self.regular_user)
        self.assertTrue(avail)

        # When an unauthorized user checks, it should be blocked
        avail, msg, code, meta = validate_username_availability('partner_exclusive', requesting_user=None)
        self.assertFalse(avail)

    def test_check_username_api_endpoint(self):
        # Blocked word: 'admin'
        resp = self.client.get('/api/auth/check-username/', {'username': 'admin'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data['available'])
        self.assertEqual(resp.data['detail'], 'This username is unavailable.')
        self.assertNotIn('reserved', resp.data['detail'].lower())
        self.assertNotIn('premium', resp.data['detail'].lower())

        # Blocked dictionary word: 'one'
        resp_one = self.client.get('/api/auth/check-username/', {'username': 'one'})
        self.assertEqual(resp_one.status_code, status.HTTP_200_OK)
        self.assertFalse(resp_one.data['available'])
        self.assertEqual(resp_one.data['detail'], 'This username is unavailable.')
        self.assertNotIn('reserved', resp_one.data['detail'].lower())
        self.assertNotIn('premium', resp_one.data['detail'].lower())

        # Available word
        resp_avail = self.client.get('/api/auth/check-username/', {'username': 'my_spare_parts_tz'})
        self.assertEqual(resp_avail.status_code, status.HTTP_200_OK)
        self.assertTrue(resp_avail.data['available'])

    def test_register_api_blocks_reserved_username(self):
        resp = self.client.post('/api/auth/register/', {
            'username': 'one',
            'email': 'one@example.com',
            'password': 'StrongPassword123!',
            'confirm_password': 'StrongPassword123!',
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data['detail'], 'This username is unavailable.')
        self.assertNotIn('reserved', resp.data['detail'].lower())
        self.assertNotIn('premium', resp.data['detail'].lower())

    def test_staff_admin_api_crud(self):
        # Regular user cannot access staff endpoint
        self.client.force_authenticate(user=self.regular_user)
        resp = self.client.get('/api/staff-admin/reserved-usernames/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        # Superuser can access and manage
        self.client.force_authenticate(user=self.superuser)
        resp = self.client.get('/api/staff-admin/reserved-usernames/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # Create new reserved username via API
        post_resp = self.client.post('/api/staff-admin/reserved-usernames/', {
            'username': 'custom_brand_tz',
            'category': 'brand_trademark',
            'reason': 'Special brand in Tanzania',
            'is_active': True
        })
        self.assertEqual(post_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(post_resp.data['username'], 'custom_brand_tz')

        # Test sandbox endpoint
        test_resp = self.client.post('/api/staff-admin/reserved-usernames/test/', {
            'username': 'custom_brand_tz'
        })
        self.assertEqual(test_resp.status_code, status.HTTP_200_OK)
        self.assertFalse(test_resp.data['available'])

        # Stats endpoint
        stats_resp = self.client.get('/api/staff-admin/reserved-usernames/stats/')
        self.assertEqual(stats_resp.status_code, status.HTTP_200_OK)
        self.assertIn('total', stats_resp.data)
        self.assertIn('active', stats_resp.data)
