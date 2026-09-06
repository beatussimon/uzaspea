from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from marketplace.models import ProductRequest

User = get_user_model()

class ProductRequestTests(TestCase):
    def setUp(self):
        from marketplace.models import SubscriptionTier, Subscription
        from django.utils import timezone
        self.client = APIClient()
        self.seller = User.objects.create_user(username='seller1', password='password123', email='seller@example.com')
        tier = SubscriptionTier.objects.create(name='Business', tier_level='business', price=1000, duration=30)
        Subscription.objects.create(user=self.seller, tier=tier, is_active=True, start_date=timezone.now(), end_date=timezone.now() + timezone.timedelta(days=30))
        self.buyer = User.objects.create_user(username='buyer1', password='password123', email='buyer@example.com')
        self.seller2 = User.objects.create_user(username='seller2', password='password123', email='seller2@example.com')
        Subscription.objects.create(user=self.seller2, tier=tier, is_active=True, start_date=timezone.now(), end_date=timezone.now() + timezone.timedelta(days=30))

    def test_seller_create_demand_card(self):
        self.client.force_authenticate(user=self.seller)
        url = reverse('product-request-list')
        data = {
            'name': 'iPhone 16 Pro Max',
            'description': 'Latest iPhone',
            'seller_username': self.seller.username,
            'price': '1000.00',
            'buying_price': '800.00'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['request_count'], 0) # seller created it, count starts at 0
        self.assertEqual(response.data['buying_price'], '800.00')

    def test_buyer_upvote_card(self):
        pr = ProductRequest.objects.create(
            name='iPhone 16 Pro Max',
            description='Latest iPhone',
            seller=self.seller,
            request_count=0
        )
        
        self.client.force_authenticate(user=self.buyer)
        url = reverse('product-request-list')
        data = {
            'name': 'iPhone 16 Pro Max',
            'seller_username': self.seller.username
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['request_count'], 1)

    def test_fetch_by_seller_username(self):
        ProductRequest.objects.create(name='Test 1', seller=self.seller)
        
        url = reverse('product-request-list')
        response = self.client.get(f"{url}?seller_username={self.seller.username}")
        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)

    def test_fulfill_request_on_product_create(self):
        from marketplace.models import Category, Product
        cat = Category.objects.create(name='Phones')
        pr = ProductRequest.objects.create(
            name='Fulfill Me',
            seller=self.seller,
            category=cat,
            price=999.99
        )
        self.client.force_authenticate(user=self.seller)
        url = reverse('product-list')
        data = {
            'name': 'Fulfilled Product',
            'description': 'It was a request',
            'price': '1000.00',
            'category': cat.id,
            'condition': 'New',
            'is_available': True,
            'fulfill_request_id': pr.id
        }
        response = self.client.post(url, data, format='multipart')
        
        self.assertEqual(response.status_code, 201)
        pr.refresh_from_db()
        self.assertTrue(pr.is_fulfilled)

    def test_demand_analytics_isolated_to_seller(self):
        card1 = ProductRequest.objects.create(
            name='Seller1 Secret Demand',
            seller=self.seller,
            price='500.00',
            buying_price='300.00',
            request_count=5
        )
        card2 = ProductRequest.objects.create(
            name='Seller2 Secret Demand',
            seller=self.seller2,
            price='800.00',
            buying_price='600.00',
            request_count=10
        )

        # Seller 1 requests their demand analytics with ?mine=true
        self.client.force_authenticate(user=self.seller)
        url = reverse('product-request-list')
        res = self.client.get(f"{url}?mine=true")
        self.assertEqual(res.status_code, 200)
        results = res.data.get('results', res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], card1.id)
        self.assertEqual(results[0]['name'], 'Seller1 Secret Demand')

        # Test default authenticated list (fallback for dashboard)
        res_default = self.client.get(url)
        self.assertEqual(res_default.status_code, 200)
        default_results = res_default.data.get('results', res_default.data)
        self.assertEqual(len(default_results), 1)
        self.assertEqual(default_results[0]['id'], card1.id)

        # Seller 2 requests their demand analytics
        self.client.force_authenticate(user=self.seller2)
        res2 = self.client.get(f"{url}?mine=true")
        self.assertEqual(res2.status_code, 200)
        results2 = res2.data.get('results', res2.data)
        self.assertEqual(len(results2), 1)
        self.assertEqual(results2[0]['id'], card2.id)
        self.assertEqual(results2[0]['name'], 'Seller2 Secret Demand')

    def test_buying_price_hidden_from_public_and_other_sellers(self):
        ProductRequest.objects.create(
            name='Wholesale Gadget',
            seller=self.seller,
            price='100.00',
            buying_price='40.00',
            request_count=3
        )
        url = reverse('product-request-list')

        # 1. Unauthenticated buyer views seller's profile
        self.client.force_authenticate(user=None)
        res_anon = self.client.get(f"{url}?seller_username={self.seller.username}")
        self.assertEqual(res_anon.status_code, 200)
        anon_item = res_anon.data.get('results', res_anon.data)[0]
        self.assertNotIn('buying_price', anon_item)

        # 2. Authenticated buyer views seller's profile
        self.client.force_authenticate(user=self.buyer)
        res_buyer = self.client.get(f"{url}?seller_username={self.seller.username}")
        self.assertEqual(res_buyer.status_code, 200)
        buyer_item = res_buyer.data.get('results', res_buyer.data)[0]
        self.assertNotIn('buying_price', buyer_item)

        # 3. Another seller views seller1's profile
        self.client.force_authenticate(user=self.seller2)
        res_other_seller = self.client.get(f"{url}?seller_username={self.seller.username}")
        self.assertEqual(res_other_seller.status_code, 200)
        other_item = res_other_seller.data.get('results', res_other_seller.data)[0]
        self.assertNotIn('buying_price', other_item)

        # 4. Seller1 views their own demand card
        self.client.force_authenticate(user=self.seller)
        res_owner = self.client.get(f"{url}?seller_username={self.seller.username}")
        self.assertEqual(res_owner.status_code, 200)
        owner_item = res_owner.data.get('results', res_owner.data)[0]
        self.assertIn('buying_price', owner_item)
        self.assertEqual(owner_item['buying_price'], '40.00')

    def test_unauthenticated_unscoped_query_returns_empty(self):
        ProductRequest.objects.create(name='Test Demand', seller=self.seller)
        self.client.force_authenticate(user=None)
        url = reverse('product-request-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 0)

    def test_other_seller_cannot_modify_or_delete_demand_card(self):
        pr = ProductRequest.objects.create(
            name='Seller1 Item',
            seller=self.seller,
            price='100.00',
            buying_price='60.00'
        )
        detail_url = reverse('product-request-detail', kwargs={'pk': pr.id})

        # Seller 2 attempts to patch Seller 1's card
        self.client.force_authenticate(user=self.seller2)
        patch_res = self.client.patch(detail_url, {'price': '999.00'}, format='json')
        self.assertIn(patch_res.status_code, [403, 404])

        # Seller 2 attempts to delete Seller 1's card
        del_res = self.client.delete(detail_url)
        self.assertIn(del_res.status_code, [403, 404])

        # Verify card is unchanged
        pr.refresh_from_db()
        self.assertEqual(str(pr.price), '100.00')

        # Seller 1 can update their own card
        self.client.force_authenticate(user=self.seller)
        owner_patch = self.client.patch(detail_url, {'price': '150.00'}, format='json')
        self.assertEqual(owner_patch.status_code, 200)
        pr.refresh_from_db()
        self.assertEqual(str(pr.price), '150.00')

    def test_buyer_cannot_inject_buying_price(self):
        self.client.force_authenticate(user=self.buyer)
        url = reverse('product-request-list')
        data = {
            'name': 'Buyer Requested Item',
            'seller_username': self.seller.username,
            'price': '200.00',
            'buying_price': '10.00'  # Buyer attempting to set buying price
        }
        res = self.client.post(url, data, format='json')
        self.assertEqual(res.status_code, 201)
        created_pr = ProductRequest.objects.get(id=res.data['id'])
        self.assertIsNone(created_pr.buying_price)
        self.assertEqual(created_pr.request_count, 1)

    def test_team_member_with_manage_products_can_access(self):
        from marketplace.models import TeamMember
        worker = User.objects.create_user(username='worker1', password='password123', email='worker@example.com')
        TeamMember.objects.create(
            owner=self.seller,
            user=worker,
            role_preset='manager',
            invitation_status='accepted',
            is_active=True,
            permissions={'manage_products': True}
        )

        card = ProductRequest.objects.create(
            name='Team Demand Card',
            seller=self.seller,
            price='50.00',
            buying_price='25.00'
        )

        # Worker can see the card and the buying price
        self.client.force_authenticate(user=worker)
        url = reverse('product-request-list')
        res = self.client.get(f"{url}?mine=true")
        self.assertEqual(res.status_code, 200)
        results = res.data.get('results', res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['buying_price'], '25.00')

        # Worker can update the card
        detail_url = reverse('product-request-detail', kwargs={'pk': card.id})
        patch_res = self.client.patch(detail_url, {'price': '55.00'}, format='json')
        self.assertEqual(patch_res.status_code, 200)
        card.refresh_from_db()
        self.assertEqual(str(card.price), '55.00')
