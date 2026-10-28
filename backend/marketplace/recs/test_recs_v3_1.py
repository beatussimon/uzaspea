"""
SokoniMax Recommendations v3.1 Test Suite.
Verifies all 9 core architectural deliverables:
- D1 Hierarchical Tree Fallbacks
- D2 Single-Item Recently Viewed Shelf
- D3 Self-Healing Celery Task
- D4 Fixed Inspector Shelf Caps
- D5 "Not Interested" Dismissals
- Attribution Pipeline (OrderItems & Conversions)
- Cart & Empty Search Recommendations Placements
- A/B Testing Variants Configuration
- Workstream F: Listing Query Optimization Toggle
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from marketplace.models import (
    Product, Category, Order, OrderItem, ProductStats, ProductRecs,
    SiteSettings, UserRecProfile, RecSurfaceDailyStat, RecConversionDaily
)
from marketplace.recs.context import build_context
from marketplace.recs.engine import similar_for_product, for_you
from marketplace.recs.queries import category_pool
from marketplace.tasks import recs_self_heal_task
from marketplace.discovery_views import get_base_product_queryset
from marketplace.recs import config

User = get_user_model()


class RecsV31Tests(TestCase):
    def setUp(self):
        self.seller = User.objects.create_user(username='seller_v31', password='password123', email='seller@example.com')
        self.buyer = User.objects.create_user(username='buyer_v31', password='password123', email='buyer@example.com')
        self.parent_cat = Category.objects.create(name='Electronics', slug='electronics')
        self.leaf_cat = Category.objects.create(name='Headphones', slug='headphones', parent=self.parent_cat)

        self.p_alone = Product.objects.create(
            name='Lone Headphone', slug='lone-headphone', price=Decimal('50000'),
            stock=10, seller=self.seller, category=self.leaf_cat, is_available=True
        )
        self.p_parent1 = Product.objects.create(
            name='Audio Amp', slug='audio-amp', price=Decimal('80000'),
            stock=5, seller=self.seller, category=self.parent_cat, is_available=True
        )
        self.p_parent2 = Product.objects.create(
            name='Audio DAC', slug='audio-dac', price=Decimal('60000'),
            stock=8, seller=self.seller, category=self.parent_cat, is_available=True
        )

        ProductStats.objects.filter(product=self.p_alone).update(rating_avg=4.5, likes=10)
        ProductStats.objects.filter(product=self.p_parent1).update(rating_avg=4.0, likes=5)
        ProductStats.objects.filter(product=self.p_parent2).update(rating_avg=4.8, likes=12)

        self.client = APIClient()
        token = RefreshToken.for_user(self.buyer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(token.access_token)}')

    def test_similar_fallback_sparse_category_never_empty(self):
        """D1 Fix: Sparse leaf category (<4 products) climbs tree to parent category."""
        pool = category_pool(self.leaf_cat.id, allow_hierarchy_expansion=True)
        self.assertIn(self.p_parent1.id, pool)
        self.assertIn(self.p_parent2.id, pool)

        similar_items, _ = similar_for_product(self.p_alone.id, page=1, page_size=12)
        recommended_ids = [item.product_id for item in similar_items]
        self.assertTrue(len(recommended_ids) > 0, "Similar shelf should not be empty for sparse category")
        self.assertTrue(self.p_parent1.id in recommended_ids or self.p_parent2.id in recommended_ids)

    def test_guest_single_view_shows_recently_viewed(self):
        """D2 Fix: Single product view is enough to display the Recently Viewed shelf."""
        ctx = build_context(user=None, recent_ids=[self.p_alone.id])
        shelves = for_you(ctx, min_items=1)
        shelf_ids = [s['id'] for s in shelves]
        self.assertIn('recently_viewed', shelf_ids)
        rec_shelf = next(s for s in shelves if s['id'] == 'recently_viewed')
        self.assertEqual(len(rec_shelf['items']), 1)
        self.assertEqual(rec_shelf['items'][0].product_id, self.p_alone.id)

    def test_self_heal_task_builds_missing_recs(self):
        """D3 Fix: Self-healing background Celery task populates missing ProductRecs rows."""
        self.assertFalse(ProductRecs.objects.filter(product_id=self.p_alone.id).exists())
        recs_self_heal_task.apply()
        self.assertTrue(ProductRecs.objects.filter(product_id=self.p_alone.id).exists())

    def test_inspector_respects_per_shelf_cap(self):
        """D4 Fix: When per_shelf is specified, fixed/editorial shelves respect the cap."""
        ctx = build_context(user=None)
        shelves = for_you(ctx, per_shelf=1, min_items=1)
        for s in shelves:
            self.assertLessEqual(len(s['items']), 1, f"Shelf {s['id']} exceeded per_shelf cap of 1")

    def test_not_interested_filters_out_product(self):
        """D5 Fix: Products dismissed via 'Not interested' are excluded from all recommendation shelves."""
        ctx = build_context(user=None, recent_ids=[self.p_parent1.id], exclude_ids=[self.p_parent2.id])
        shelves = for_you(ctx, min_items=1)
        all_recommended_ids = [item.product_id for s in shelves for item in s['items']]
        self.assertNotIn(self.p_parent2.id, all_recommended_ids)

    def test_cart_recommendations_excludes_cart_items(self):
        """Items already in cart are strictly excluded from cart complements."""
        res = self.client.get(f'/api/recs/cart/?cart_ids={self.p_alone.id}')
        self.assertEqual(res.status_code, 200)
        product_ids = [p['id'] for p in res.data.get('products', [])]
        self.assertNotIn(self.p_alone.id, product_ids)

    def test_attribution_recorded_on_order_item(self):
        """Order creation records rec_surface and rec_variant and increments RecConversionDaily."""
        res = self.client.post('/api/orders/', {
            'items': [{
                'product': self.p_alone.id,
                'quantity': 1,
                'rec_surface': 'cart',
                'rec_variant': 'variant_b'
            }],
            'shipping_method': 'PICKUP',
            'shipping_fee': 0,
            'delivery_info': {}
        }, format='json')
        self.assertEqual(res.status_code, 201)
        order_item = OrderItem.objects.filter(product=self.p_alone).last()
        self.assertEqual(order_item.rec_surface, 'cart')
        self.assertEqual(order_item.rec_variant, 'variant_b')

        conv = RecConversionDaily.objects.filter(surface='cart', variant='variant_b').first()
        self.assertIsNotNone(conv)
        self.assertGreaterEqual(conv.orders, 1)
        self.assertGreaterEqual(conv.revenue, Decimal('50000'))

    def test_ab_testing_variants_applied(self):
        """Configuration specifies valid weights for control and variant_b."""
        self.assertIn('control', config.VARIANTS)
        self.assertIn('variant_b', config.VARIANTS)
        self.assertEqual(config.VARIANTS['control']['explore_factor'], 1.0)
        self.assertEqual(config.VARIANTS['variant_b']['explore_factor'], 1.3)
        self.assertEqual(config.VARIANTS['control']['w_similar']['text'], 0.35)
        self.assertEqual(config.VARIANTS['variant_b']['w_similar']['quality'], 0.15)

    def test_listing_optimization_toggle(self):
        """Workstream F: Toggling SiteSettings.use_product_stats_for_listings switches query path cleanly."""
        settings_obj, _ = SiteSettings.objects.get_or_create(pk=1)
        settings_obj.use_product_stats_for_listings = True
        settings_obj.save()

        qs_fast = get_base_product_queryset()
        items_fast = list(qs_fast[:5])
        self.assertTrue(len(items_fast) > 0)

        settings_obj.use_product_stats_for_listings = False
        settings_obj.save()

        qs_legacy = get_base_product_queryset()
        items_legacy = list(qs_legacy[:5])
        self.assertTrue(len(items_fast) > 0)
