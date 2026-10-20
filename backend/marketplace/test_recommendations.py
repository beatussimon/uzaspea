"""Recommendations v3 tests. Includes regression tests for BUG-1..BUG-5."""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from marketplace.models import (Category, Product, Like, Review, SponsoredListing, EditorialShelf,
                                ProductDailyStat, ProductCoView, UserRecProfile)
from marketplace.recs import config
from marketplace.recs.builder import refresh_product_stats, build_recs
from marketplace.recs.context import build_context, RecContext
from marketplace.recs.engine import similar_for_product, ymal_for_product, for_you, rank_editorial_shelves
from marketplace.recs.serializers import ProductCardSerializer


class RecsBase(TestCase):
    def setUp(self):
        cache.clear()
        self.sellers = [User.objects.create_user(username=f'seller{i}', password='pw12345!x') for i in range(4)]
        self.buyer = User.objects.create_user(username='buyer', password='pw12345!x')
        self.phones = Category.objects.create(name='Mobile Phones', slug='mobile-phones')
        self.accessories = Category.objects.create(name='Phone Accessories', slug='phone-accessories')
        self.fashion = Category.objects.create(name="Women's Fashion", slug='womens-fashion')
        self.phones.related_categories.add(self.accessories)
        self.phone_items = [self._product(f'Samsung Galaxy A{i}', self.phones, 400000 + i * 1000, i) for i in range(10)]
        self.acc_items = [self._product(f'Phone Case {i}', self.accessories, 15000 + i * 100, i) for i in range(6)]
        self.fashion_items = [self._product(f'Ladies Dress {i}', self.fashion, 30000 + i * 500, i) for i in range(6)]

    def _product(self, name, category, price, n):
        return Product.objects.create(
            name=name, description=f'{name} description', price=Decimal(price), buying_price=Decimal(price) / 2,
            stock=Decimal('5'), is_available=True, is_draft=False, category=category, seller=self.sellers[n % 4],
            location_name='Dar es Salaam, Tanzania', latitude=Decimal('-6.800000'), longitude=Decimal('39.280000'))

    def build(self):
        refresh_product_stats()
        build_recs()
        cache.clear()


class SecurityTests(RecsBase):
    def test_card_never_has_buying_price(self):
        self.assertNotIn('buying_price', ProductCardSerializer(self.phone_items[0], context={}).data)

    def test_public_detail_hides_buying_price(self):
        res = APIClient().get(f'/api/products/{self.phone_items[0].slug}/')
        self.assertEqual(res.status_code, 200)
        self.assertNotIn('buying_price', res.json())

    def test_owner_sees_buying_price(self):
        p = self.phone_items[0]
        client = APIClient()
        client.force_authenticate(user=p.seller)
        self.assertIn('buying_price', client.get(f'/api/products/{p.slug}/').json())


class SimilarTests(RecsBase):
    def test_similar_is_same_category(self):
        self.build()
        items, _ = similar_for_product(self.phone_items[0].id, page=1, page_size=6)
        ids = [s.product_id for s in items]
        self.assertTrue(ids)
        self.assertTrue(set(ids) <= {p.id for p in self.phone_items})
        self.assertNotIn(self.phone_items[0].id, ids)

    def test_quality_changes_ranking(self):  # BUG-1
        target, a, b = self.phone_items[0], self.phone_items[5], self.phone_items[6]
        Product.objects.filter(id__in=[a.id, b.id]).update(price=Decimal('405000'))
        for i in range(3):
            reviewer = User.objects.create_user(username=f'rev{i}', password='pw12345!x')
            Review.objects.create(product=b, user=reviewer, rating=5, approved=True)
        self.build()
        ids = [s.product_id for s in similar_for_product(target.id, page=1, page_size=12)[0]]
        self.assertLess(ids.index(b.id), ids.index(a.id))


class YmalTests(RecsBase):
    def test_ymal_uses_related_and_skips_own_category(self):
        self.build()
        ids = [s.product_id for s in ymal_for_product(self.phone_items[0].id, RecContext(), limit=4)]
        self.assertTrue(ids)
        self.assertFalse(set(ids) & {p.id for p in self.phone_items})
        self.assertIn(ids[0], {p.id for p in self.acc_items})

    def test_limit_respected(self):  # BUG-3
        self.build()
        self.assertEqual(len(ymal_for_product(self.phone_items[0].id, RecContext(), limit=4)), 4)
        self.assertGreater(len(ymal_for_product(self.phone_items[0].id, RecContext(), limit=8)), 4)


class GuestIsolationTests(RecsBase):  # BUG-2
    def test_different_guests_get_different_feeds(self):
        self.build()
        feed_a = for_you(build_context(recent_ids=[self.phone_items[0].id]))
        feed_b = for_you(build_context(recent_ids=[self.fashion_items[0].id]))
        self.assertEqual(feed_a[0]['id'], f'because_{self.phone_items[0].id}')
        self.assertEqual(feed_b[0]['id'], f'because_{self.fashion_items[0].id}')
        shown_b = {s.product_id for sh in feed_b if sh['kind'] != 'recently_viewed' for s in sh['items']}
        self.assertNotIn(self.fashion_items[0].id, shown_b)


class DetailCacheTests(RecsBase):  # BUG-4
    def test_no_personal_data_in_shared_detail_cache(self):
        self.build()
        target = self.phone_items[0]
        Like.objects.create(user=self.buyer, product=self.phone_items[1])
        client = APIClient()
        client.force_authenticate(user=self.buyer)
        body = client.get(f'/api/products/{target.slug}/').json()
        self.assertNotIn('recommended_products', body)
        self.assertTrue(body['similar_products'])
        self.assertTrue(all(p['is_liked'] is False for p in body['similar_products']))
        anon = APIClient().get(f'/api/products/{target.slug}/').json()
        self.assertEqual([p['id'] for p in anon['similar_products']], [p['id'] for p in body['similar_products']])


class SlotTests(RecsBase):
    def test_max_one_sponsored_per_eight_in_fixed_slot(self):
        for p in self.phone_items[1:6]:
            SponsoredListing.objects.create(user=p.seller, product=p, status='approved',
                                            expires_at=timezone.now() + timedelta(days=3))
        self.build()
        items, _ = similar_for_product(self.phone_items[0].id, page=1, page_size=8)
        sponsored = [s for s in items if s.slot == 'sponsored']
        self.assertLessEqual(len(sponsored), 1)
        if sponsored:
            self.assertEqual(items.index(sponsored[0]), config.SPONSORED_SLOT_INDEX)


class EventsTests(RecsBase):
    def test_beacon_updates_counts_coviews_profile(self):
        client = APIClient()
        client.force_authenticate(user=self.buyer)
        a, b, c = self.phone_items[0].id, self.phone_items[1].id, self.acc_items[0].id
        res = client.post('/api/recs/events/', {'views': [a, b, c], 'impressions': {'ymal': 4},
                                                'clicks': [{'s': 'ymal', 'p': c}]}, format='json')
        self.assertEqual(res.status_code, 204)
        self.assertEqual(ProductDailyStat.objects.get(product_id=a).views, 1)
        self.assertTrue(ProductCoView.objects.filter(product_a_id=a, product_b_id=b).exists())
        self.assertEqual(UserRecProfile.objects.get(user=self.buyer).recent_ids[0], c)

    def test_beacon_ignores_garbage(self):
        res = APIClient().post('/api/recs/events/', {'views': ['x', -1, 999999]}, format='json')
        self.assertEqual(res.status_code, 204)
        self.assertEqual(ProductDailyStat.objects.count(), 0)


class EditorialTests(RecsBase):
    def test_shelves_follow_interest(self):
        EditorialShelf.objects.create(key='fashion', title='Look Different', category=self.fashion, audience='all', base_order=10)
        EditorialShelf.objects.create(key='phones', title='Phones', category=self.phones, audience='all', base_order=30)
        self.assertEqual([s.key for s, _ in rank_editorial_shelves(build_context())], ['fashion', 'phones'])
        warm = build_context(recent_ids=[self.phone_items[0].id])
        self.assertEqual([s.key for s, _ in rank_editorial_shelves(warm)], ['phones', 'fashion'])


class InspectorTests(RecsBase):
    def test_requires_superuser(self):
        client = APIClient()
        client.force_authenticate(user=self.buyer)
        self.assertEqual(client.get('/api/recs/admin/users/').status_code, 403)

    def test_user_inspector_max_five_per_reason(self):
        self.build()
        UserRecProfile.objects.create(user=self.buyer, recent_ids=[self.phone_items[0].id])
        admin = User.objects.create_superuser(username='boss', password='pw12345!x', email='boss@example.com')
        client = APIClient()
        client.force_authenticate(user=admin)
        res = client.get(f'/api/recs/admin/users/{self.buyer.id}/')
        self.assertEqual(res.status_code, 200)
        reasons = res.json()['reasons']
        self.assertTrue(reasons)
        self.assertTrue(all(len(r['items']) <= 5 for r in reasons))
        self.assertTrue(all('breakdown' in i and 'score' in i for r in reasons for i in r['items']))
