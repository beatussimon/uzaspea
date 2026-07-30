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
        self.assertEqual(len(response.data['results']), 1)

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
