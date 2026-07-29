from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from marketplace.models import Category, Product, Order, OrderItem

User = get_user_model()

class RFQFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.seller = User.objects.create_user(username='seller1', password='password123', email='seller@example.com')
        self.buyer = User.objects.create_user(username='buyer1', password='password123', email='buyer@example.com')
        self.category = Category.objects.create(name='Electronics')
        
        self.product = Product.objects.create(
            seller=self.seller,
            name='Custom Service',
            category=self.category,
            price=0.00,
            stock=100,
            requires_quote=True,
            is_available=True
        )

    def test_full_rfq_flow(self):
        # 1. Buyer requests an invoice
        self.client.force_authenticate(user=self.buyer)
        request_data = {
            "items": [
                {
                    "product_id": self.product.id,
                    "quantity": 2
                }
            ],
            "shipping_method": "pickup",
            "notes": "I need a bulk discount"
        }
        
        url = reverse('order-request-invoice')
        response = self.client.post(url, request_data, format='json')
        self.assertEqual(response.status_code, 201)
        
        order_id = response.data['order_id']
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, 'REQUESTED_INVOICE')
        
        # 2. Seller generates the invoice
        self.client.force_authenticate(user=self.seller)
        generate_url = reverse('order-generate-invoice', args=[order_id])
        generate_data = {
            "shipping_fee": "5000",
            "notes": "Here is your custom invoice",
            "prices": {
                str(order.orderitem_set.first().id): "15000.00"
            }
        }
        
        response = self.client.post(generate_url, generate_data, format='json')
        self.assertEqual(response.status_code, 200)
        
        order.refresh_from_db()
        self.assertEqual(order.status, 'INVOICE_GENERATED')
        self.assertEqual(order.shipping_fee, 5000)
        self.assertEqual(order.orderitem_set.first().price, 15000.00)
        self.assertEqual(order.total_amount, (15000.00 * 2) + 5000)
        
        # 3. Buyer confirms the invoice
        self.client.force_authenticate(user=self.buyer)
        confirm_url = reverse('order-confirm-invoice', args=[order_id])
        
        response = self.client.post(confirm_url)
        self.assertEqual(response.status_code, 200)
        
        order.refresh_from_db()
        self.assertEqual(order.status, 'AWAITING_PAYMENT')

    def test_permission_denied_for_generate_invoice(self):
        # Buyer requests an invoice
        self.client.force_authenticate(user=self.buyer)
        request_data = {
            "items": [{"product_id": self.product.id, "quantity": 1}],
            "shipping_method": "pickup"
        }
        url = reverse('order-request-invoice')
        response = self.client.post(url, request_data, format='json')
        order_id = response.data['order_id']
        
        # Buyer attempts to generate their own invoice (should fail)
        generate_url = reverse('order-generate-invoice', args=[order_id])
        generate_data = {"shipping_fee": "0", "items": []}
        response = self.client.post(generate_url, generate_data, format='json')
        self.assertEqual(response.status_code, 403)
