from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from decimal import Decimal
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

        self.priced_product = Product.objects.create(
            seller=self.seller,
            name='Standard Spark Plug',
            category=self.category,
            price=15000.00,
            stock=50,
            requires_quote=False,
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
                },
                {
                    "product_id": self.priced_product.id,
                    "quantity": 5
                }
            ],
            "shipping_method": "DELIVERY",
            "note": "I need a bulk discount for shop"
        }
        
        url = reverse('order-request-invoice')
        response = self.client.post(url, request_data, format='json')
        self.assertEqual(response.status_code, 201)
        
        order_id = response.data['order_id']
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, 'REQUESTED_INVOICE')
        self.assertTrue(order.is_bulk_order)
        self.assertEqual(order.negotiation_data.get('buyer_request_note'), "I need a bulk discount for shop")
        
        # 2. Seller generates the invoice
        self.client.force_authenticate(user=self.seller)
        generate_url = reverse('order-generate-invoice', args=[order_id])
        item1 = order.orderitem_set.filter(product=self.product).first()
        item2 = order.orderitem_set.filter(product=self.priced_product).first()
        generate_data = {
            "shipping_fee": "5000",
            "seller_note": "Discounted spark plugs for bulk volume",
            "prices": {
                str(item1.id): "20000.00",
                str(item2.id): "12000.00"
            }
        }
        
        response = self.client.post(generate_url, generate_data, format='json')
        self.assertEqual(response.status_code, 200)
        
        order.refresh_from_db()
        self.assertEqual(order.status, 'INVOICE_GENERATED')
        self.assertEqual(order.shipping_fee, Decimal('5000.00'))
        self.assertEqual(order.orderitem_set.filter(product=self.product).first().price, Decimal('20000.00'))
        self.assertEqual(order.orderitem_set.filter(product=self.priced_product).first().price, Decimal('12000.00'))
        
        # 3. Buyer submits a counter-offer (1st round)
        self.client.force_authenticate(user=self.buyer)
        counter_url = reverse('order-counter-invoice', args=[order_id])
        counter_data = {
            "proposed_prices": {
                str(item1.id): 18000.00,
                str(item2.id): 10000.00
            },
            "note": "Could we do 18k and 10k?"
        }
        response = self.client.post(counter_url, counter_data, format='json')
        self.assertEqual(response.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, 'BUYER_COUNTERED')
        self.assertEqual(order.negotiation_data.get('counter_count'), 1)

        # 4. Buyer attempts a second counter-offer (should be rejected by 1-round rule)
        response2 = self.client.post(counter_url, counter_data, format='json')
        self.assertEqual(response2.status_code, 400)

        # 5. Seller accepts counter-offer
        self.client.force_authenticate(user=self.seller)
        response_accept = self.client.post(generate_url, {"accept_counter": True, "seller_note": "Agreed on counter"}, format='json')
        self.assertEqual(response_accept.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, 'INVOICE_GENERATED')
        self.assertTrue(order.negotiation_data.get('resolved'))
        self.assertEqual(order.orderitem_set.filter(product=self.product).first().price, Decimal('18000.00'))
        self.assertEqual(order.orderitem_set.filter(product=self.priced_product).first().price, Decimal('10000.00'))

        # 6. Buyer confirms the invoice and checks out
        self.client.force_authenticate(user=self.buyer)
        confirm_url = reverse('order-confirm-invoice', args=[order_id])
        response_confirm = self.client.post(confirm_url)
        self.assertEqual(response_confirm.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, 'AWAITING_PAYMENT')
        self.assertTrue(order.is_bulk_order)

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
