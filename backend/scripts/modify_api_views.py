import os
import re

file_path = '/home/bea/uzaspea/backend/marketplace/api_views.py'
with open(file_path, 'r') as f:
    content = f.read()

# Add ProductRequestViewSet at the end
product_request_viewset = """
from .models import ProductRequest
from .serializers import ProductRequestSerializer
from django.contrib.auth.models import User

class ProductRequestViewSet(viewsets.ModelViewSet):
    queryset = ProductRequest.objects.all()
    serializer_class = ProductRequestSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return ProductRequest.objects.none()
        return ProductRequest.objects.filter(seller=user)

    def create(self, request, *args, **kwargs):
        name = request.data.get('name', '').strip()
        seller_id = request.data.get('seller_id')
        if not name or not seller_id:
            return Response({'error': 'name and seller_id required'}, status=400)
            
        try:
            seller = User.objects.get(id=seller_id)
        except User.DoesNotExist:
            return Response({'error': 'Seller not found'}, status=404)
            
        # Case insensitive check
        pr = ProductRequest.objects.filter(seller=seller, name__iexact=name).first()
        if pr:
            pr.request_count += 1
            pr.save()
            serializer = self.get_serializer(pr)
            return Response(serializer.data, status=200)
        else:
            pr = ProductRequest.objects.create(
                name=name,
                description=request.data.get('description', ''),
                seller=seller,
                user=request.user if request.user.is_authenticated else None
            )
            serializer = self.get_serializer(pr)
            return Response(serializer.data, status=201)
"""
content += product_request_viewset

# Add order actions
order_actions = """
    @decorators.action(detail=False, methods=['post'], url_path='request-invoice')
    @transaction.atomic
    def request_invoice(self, request):
        \"\"\"Convert cart items into an order that requires a quote/invoice.\"\"\"
        user = request.user
        items_data = request.data.get('items', [])
        
        if not items_data:
            return Response({'error': 'No items provided.'}, status=status.HTTP_400_BAD_REQUEST)
            
        order = Order.objects.create(
            user=user,
            status='REQUESTED_INVOICE',
            shipping_method=request.data.get('shipping_method', 'DELIVERY'),
            fulfillment_type=request.data.get('fulfillment_type', 'PLATFORM_DELIVERY')
        )
        
        for item_data in items_data:
            product_id = item_data.get('product_id')
            quantity = int(item_data.get('quantity', 1))
            product = Product.objects.get(id=product_id)
            
            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=quantity,
                price=product.price if not product.requires_quote else Decimal('0.00')
            )
            
        order.update_total()
        TrackingEvent.objects.create(order=order, status='REQUESTED_INVOICE', notes='Customer requested an invoice.')
        return Response({'order_id': order.id, 'status': order.status}, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=['post'], url_path='generate-invoice')
    @transaction.atomic
    def generate_invoice(self, request, pk=None):
        \"\"\"Seller sets prices and generates the invoice.\"\"\"
        order = self.get_object()
        user = request.user
        
        from uzachuo.permissions import get_effective_sellers
        sellers = get_effective_sellers(user)
        
        # Check permissions: user must be seller of at least one item
        seller_ids = [item.product.seller_id for item in order.orderitem_set.select_related('product').all()]
        if not any(sid in sellers for sid in seller_ids) and not user.is_staff:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
        if order.status not in ('REQUESTED_INVOICE', 'CART', 'CHECKOUT'):
            return Response({'error': 'Order is not pending an invoice.'}, status=status.HTTP_400_BAD_REQUEST)
            
        prices = request.data.get('prices', {}) # {item_id: price}
        for item in order.orderitem_set.all():
            if str(item.id) in prices:
                item.price = Decimal(str(prices[str(item.id)]))
                item.save(update_fields=['price'])
                
        # Optional: pos immediate completion
        complete_pos = request.data.get('complete_pos', False)
        
        order.status = 'COMPLETED' if complete_pos else 'INVOICE_GENERATED'
        if complete_pos:
            # Need to update delivery info
            di = order.delivery_info or {}
            di['is_pos'] = True
            order.delivery_info = di
            
        order.update_total()
        TrackingEvent.objects.create(order=order, status=order.status, notes='Invoice generated by seller.')
        
        return Response({'status': order.status})

    @decorators.action(detail=True, methods=['post'], url_path='confirm-invoice')
    @transaction.atomic
    def confirm_invoice(self, request, pk=None):
        \"\"\"Buyer confirms the invoice and proceeds to pay.\"\"\"
        order = self.get_object()
        if order.user != request.user:
            return Response({'error': 'Unauthorized'}, status=403)
            
        if order.status != 'INVOICE_GENERATED':
            return Response({'error': 'No generated invoice to confirm.'}, status=400)
            
        order.status = 'AWAITING_PAYMENT'
        order.save(update_fields=['status'])
        TrackingEvent.objects.create(order=order, status='AWAITING_PAYMENT', notes='Buyer confirmed invoice.')
        return Response({'status': order.status})
"""

# Insert methods before incoming method
pattern = re.compile(r'    @decorators\.action\(detail=False, methods=\[\'get\'\]\)\n    def incoming\(self, request\):')
if pattern.search(content):
    content = pattern.sub(order_actions + '\n' + r'    @decorators.action(detail=False, methods=[\'get\'])\n    def incoming(self, request):', content)
else:
    print("Could not find anchor to insert order actions.")

with open(file_path, 'w') as f:
    f.write(content)

print("Updated api_views.py successfully.")
