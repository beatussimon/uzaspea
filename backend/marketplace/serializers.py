from rest_framework import serializers
from django.db import transaction  # FIX: C-01
from django.db.models import F  # FIX: C-01
from decimal import Decimal
from .models import (
    Product, Category, Review, ProductComment, Order, OrderItem, 
    Payment, PaymentConfirmation, TrackingEvent, UserProfile, Subscription, SubscriptionTier,
    ProductImage, Like, LipaNumber, FAQ, SupportTicket,
    Notification, Conversation, Message, SavedSearch, PriceAlert,
    Dispute, ProductVariant, SiteSettings, DeliveryZone, MobileNetwork, SellerApplication,
    TeamMember, StoreImage
)

class LipaNumberSerializer(serializers.ModelSerializer):
    network_name = serializers.CharField(source='network.name', read_only=True)
    network_logo = serializers.ImageField(source='network.image', read_only=True)

    class Meta:
        model = LipaNumber
        fields = ['id', 'seller', 'network', 'network_name', 'network_logo', 'number', 'name',
                  'is_active', 'display_order', 'purpose', 'is_system']
        read_only_fields = ['seller', 'network_name', 'network_logo', 'is_system']

class FAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = '__all__'

class SupportTicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicket
        fields = '__all__'
        read_only_fields = ['user', 'status', 'assigned_to', 'staff_notes', 'staff_reply', 'resolved_at']

class CategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'parent', 'children', 'image', 'product_count']

    def get_children(self, obj):
        depth = self.context.get('_cat_depth', 0)  # FIX C-17: depth guard
        if depth >= 2:
            return []
        # Use prefetched children (no extra query if prefetch was done in the viewset)
        try:
            kids = obj.children.all()
        except Exception:
            return []
        if not kids:
            return []
        return CategorySerializer(
            kids, many=True,
            context={**self.context, '_cat_depth': depth + 1}
        ).data

    def get_product_count(self, obj):
        # Always prefer the DB-annotated count to avoid any extra queries
        if hasattr(obj, 'annotated_product_count'):
            return obj.annotated_product_count
        return obj.products.count()


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'image']


class MobileNetworkSerializer(serializers.ModelSerializer):
    class Meta:
        model = MobileNetwork
        fields = ['id', 'name', 'image']


class ProductSerializer(serializers.ModelSerializer):
    seller_username = serializers.CharField(source='seller.username', read_only=True)
    seller_tier = serializers.SerializerMethodField()
    seller_verified = serializers.SerializerMethodField()
    seller_profile_picture = serializers.SerializerMethodField()
    avg_rating = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)

    has_inspection = serializers.SerializerMethodField()  # FIX B-19
    inspection_verdict = serializers.SerializerMethodField()  # FIX B-19

    inspections = serializers.SerializerMethodField()
    is_verified = serializers.BooleanField(read_only=True)
    latitude = serializers.FloatField(required=False, allow_null=True)
    longitude = serializers.FloatField(required=False, allow_null=True)

    class Meta:
        model = Product
        fields = ['id', 'name', 'slug', 'description', 'price', 'sale_price', 'stock', 'is_available',
                  'category', 'category_name', 'seller', 'seller_username', 'seller_verified',
                  'seller_tier', 'seller_profile_picture', 'condition',
                  'avg_rating', 'like_count', 'is_liked', 'images', 'inspections', 'is_verified',
                  'has_inspection', 'inspection_verdict', 'created_at', 'location_name', 'latitude', 'longitude',
                  'weight_kg', 'size']
        read_only_fields = ['seller', 'slug']

    def get_inspections(self, obj):
        # View uses prefetch_related for obj.inspections, avoiding N+1
        from inspections.serializers import InspectionSummarySerializer
        return InspectionSummarySerializer(obj.inspections.all(), many=True).data

    def get_is_liked(self, obj):
        if hasattr(obj, 'annotated_is_liked'):
            return obj.annotated_is_liked
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def get_avg_rating(self, obj):
        if hasattr(obj, 'annotated_avg_rating') and obj.annotated_avg_rating is not None:
            return int(obj.annotated_avg_rating)
        return obj.average_rating()

    def get_like_count(self, obj):
        if hasattr(obj, 'annotated_like_count'):
            return obj.annotated_like_count
        return obj.likes.count()

    def get_seller_tier(self, obj):
        try:
            return obj.seller.profile.tier
        except UserProfile.DoesNotExist:
            return 'free'

    def get_seller_verified(self, obj):
        try:
            return obj.seller.profile.is_verified
        except UserProfile.DoesNotExist:
            return False

    def get_seller_profile_picture(self, obj):
        try:
            pic = obj.seller.profile.profile_picture
            if pic:
                return pic.url
        except UserProfile.DoesNotExist:
            pass
        return None

    def get_has_inspection(self, obj):  # FIX B-19
        if hasattr(obj, 'annotated_has_inspection'):
            return obj.annotated_has_inspection
        return any(i.status == 'published' for i in obj.inspections.all())

    def get_inspection_verdict(self, obj):  # FIX B-19
        if hasattr(obj, 'annotated_inspection_verdict'):
            return obj.annotated_inspection_verdict
        for i in obj.inspections.all():
            if i.status == 'published':
                return getattr(i, 'report', None) and i.report.verdict
        return None

class ProductReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Review
        fields = ['id', 'product', 'user', 'username', 'order', 'rating', 'comment', 'created_at', 'approved']
        read_only_fields = ['user', 'approved']

class ProductCommentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = ProductComment
        fields = ['id', 'product', 'user', 'username', 'body', 'parent', 'created_at', 'likes_count']
        read_only_fields = ['user', 'likes_count']

class TrackingEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrackingEvent
        fields = ['id', 'status', 'notes', 'created_at']

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'order', 'verification_authority', 'payment_method', 'proof_image', 'transaction_id', 'status', 'amount', 'created_at']
        read_only_fields = ['verification_authority', 'status']

class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    variant_name = serializers.CharField(source='variant.name', read_only=True)
    product_image = serializers.SerializerMethodField()
    seller_username = serializers.CharField(source='product.seller.username', read_only=True)
    has_review = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'variant', 'variant_name', 'product_name', 'product_image', 'seller_username', 'quantity', 'price', 'subtotal', 'has_review']
        read_only_fields = ['price']

    def get_has_review(self, obj):
        from .models import Review
        # Check if a review exists for this product and order
        return Review.objects.filter(order=obj.order, product=obj.product).exists()

    def get_product_image(self, obj):
        img = obj.product.images.first()
        if img:
            return img.image.url
        return None

class PromoCodeSerializer(serializers.ModelSerializer):
    seller_username = serializers.CharField(source='seller.username', read_only=True)
    
    class Meta:
        from .models import PromoCode
        model = PromoCode
        fields = [
            'id', 'code', 'seller', 'seller_username', 'discount_type', 'value',
            'min_purchase_amount', 'max_uses', 'use_count', 'start_date',
            'end_date', 'is_active', 'created_at'
        ]
        read_only_fields = ['seller', 'use_count', 'created_at']

    def validate_code(self, value):
        value = value.strip().upper()
        if not value.isalnum():
            raise serializers.ValidationError("Promo code must contain only alphanumeric characters.")
        return value

    def validate(self, attrs):
        from django.utils import timezone
        discount_type = attrs.get('discount_type')
        value = attrs.get('value')
        
        if self.instance:
            discount_type = discount_type or self.instance.discount_type
            value = value if value is not None else self.instance.value
            
        if discount_type == 'percentage':
            if value <= Decimal('0') or value > Decimal('100'):
                raise serializers.ValidationError({"value": "Percentage discount must be between 0.01 and 100."})
        elif discount_type == 'fixed':
            if value <= Decimal('0'):
                raise serializers.ValidationError({"value": "Fixed discount value must be greater than 0."})
                
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')
        if self.instance:
            start_date = start_date or self.instance.start_date
            end_date = end_date or self.instance.end_date
        else:
            start_date = start_date or timezone.now()
            
        if end_date and start_date and end_date <= start_date:
            raise serializers.ValidationError({"end_date": "End date must be after start date."})
            
        return attrs


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(source='orderitem_set', many=True, required=False)
    timeline_events = TrackingEventSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    buyer_username = serializers.CharField(source='user.username', read_only=True)
    seller_subtotal = serializers.SerializerMethodField()
    delivery_code = serializers.SerializerMethodField()
    shipments = serializers.SerializerMethodField()
    has_vehicles = serializers.SerializerMethodField()
    buyer_contact = serializers.SerializerMethodField()
    seller_contacts = serializers.SerializerMethodField()
    seller_commission = serializers.SerializerMethodField()
    seller_net_payout = serializers.SerializerMethodField()
    logistics_info = serializers.SerializerMethodField()
    promo_code = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    promo_code_code = serializers.CharField(source='promo_code.code', read_only=True)
    promo_code_details = serializers.SerializerMethodField(read_only=True)
    discount_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = Order
        fields = [
            'id', 'user', 'buyer_username', 'order_date', 'total_amount', 'status',
            'shipping_method', 'shipping_fee', 'delivery_info',  # FIX: L-02 — include shipping fields
            'items', 'timeline_events', 'payments', 'seller_subtotal', 'delivery_code', 'shipments',
            'has_vehicles', 'buyer_contact', 'seller_contacts', 'seller_commission', 'seller_net_payout',
            'logistics_info', 'promo_code', 'promo_code_code', 'discount_amount', 'promo_code_details'
        ]
        read_only_fields = ['user', 'total_amount']

    def get_logistics_info(self, obj):
        shipment = obj.shipments.order_by('-created_at').first()
        transfer = obj.warehouse_transfers.order_by('-created_at').first()
        
        departure_date = None
        expected_arrival = None
        carrier_name = "SokoniMax Driver"
        tracking_number = ""
        
        if shipment:
            departure_date = shipment.shipped_at or shipment.created_at
            expected_arrival = shipment.estimated_delivery
            carrier_name = "SokoniMax Driver" if shipment.carrier_type == 'driver' else "Third-Party Courier"
            tracking_number = shipment.tracking_number
        
        if not departure_date and transfer:
            departure_date = transfer.shipped_at or transfer.created_at
            expected_arrival = transfer.received_at
            
        return {
            'departure_date': departure_date.isoformat() if departure_date else None,
            'expected_arrival': expected_arrival.isoformat() if expected_arrival else None,
            'carrier_name': carrier_name,
            'tracking_number': tracking_number,
        }

    def get_buyer_contact(self, obj):
        try:
            profile = obj.user.profile
            return {
                'phone': profile.phone_number,
                'full_name': f"{obj.user.first_name} {obj.user.last_name}".strip()
            }
        except Exception:
            return None

    def get_seller_contacts(self, obj):
        from .models import OrderItem
        sellers = set()
        for item in obj.orderitem_set.select_related('product__seller__profile').all():
            sellers.add(item.product.seller)
        
        contacts = []
        for seller in sellers:
            try:
                profile = seller.profile
                contacts.append({
                    'username': seller.username,
                    'phone': profile.phone_number,
                    'full_name': f"{seller.first_name} {seller.last_name}".strip()
                })
            except Exception:
                pass
        return contacts

    def get_has_vehicles(self, obj):
        from logistics.models import order_has_vehicles
        return order_has_vehicles(obj)

    def get_shipments(self, obj):
        from logistics.serializers import ShipmentSerializer
        return ShipmentSerializer(obj.shipments.all(), many=True).data

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get('request')
        if request and hasattr(request, 'user') and not request.user.is_anonymous:
            user = request.user
            if not (user.is_staff or user.is_superuser or instance.user == user):
                from uzachuo.permissions import get_effective_sellers
                sellers = get_effective_sellers(user, required_permission='manage_products')
                filtered_items = instance.orderitem_set.filter(product__seller_id__in=sellers)
                ret['items'] = OrderItemSerializer(filtered_items, many=True, context=self.context).data
        return ret

    def get_seller_subtotal(self, obj):
        request = self.context.get('request')  # FIX: L-03 — guard against missing context
        if not request or not hasattr(request, 'user') or request.user.is_anonymous:
            return float(obj.total_amount)
        return float(sum(item.subtotal() for item in obj.orderitem_set.filter(product__seller=request.user)))

    def get_seller_commission(self, obj):
        request = self.context.get('request')
        if not request or not hasattr(request, 'user') or request.user.is_anonymous:
            return 0.0
        from billing.models import get_seller_commission_rate
        from decimal import Decimal
        seller_subtotal = sum(item.subtotal() for item in obj.orderitem_set.filter(product__seller=request.user))
        rate_pct = get_seller_commission_rate(request.user)
        return float(seller_subtotal * (rate_pct / Decimal('100')))

    def get_seller_net_payout(self, obj):
        request = self.context.get('request')
        if not request or not hasattr(request, 'user') or request.user.is_anonymous:
            return 0.0
        from billing.models import get_seller_commission_rate
        from decimal import Decimal
        seller_subtotal = sum(item.subtotal() for item in obj.orderitem_set.filter(product__seller=request.user))
        rate_pct = get_seller_commission_rate(request.user)
        commission = seller_subtotal * (rate_pct / Decimal('100'))
        return float(seller_subtotal - commission)

    def get_delivery_code(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and not request.user.is_anonymous:
            # Only the buyer and staff can see the delivery code
            if request.user == obj.user or request.user.is_staff:
                return obj.delivery_code
        return None

    def get_promo_code_details(self, obj):
        if obj.promo_code:
            return {
                'code': obj.promo_code.code,
                'discount_type': obj.promo_code.discount_type,
                'value': float(obj.promo_code.value),
            }
        return None

    def create(self, validated_data):
        promo_code_str = validated_data.pop('promo_code', None)
        # Extract items data from the source mapping
        items_data = validated_data.pop('orderitem_set', [])

        # FIX: C-01 + L-01 — wrap in transaction.atomic for rollback safety
        with transaction.atomic():
            order = Order.objects.create(**validated_data)
            
            total = 0
            for item_data in items_data:
                product = item_data['product']
                qty = item_data['quantity']
                variant = item_data.get('variant')

                if product.seller == self.context['request'].user:
                    raise serializers.ValidationError(f'You cannot order your own product: "{product.name}".')

                if variant:
                    variant = ProductVariant.objects.select_for_update().get(pk=variant.pk)
                    if variant.stock < qty:
                        raise serializers.ValidationError(
                            f'Variant "{variant.name}" of "{product.name}" only has {variant.stock} unit(s) in stock.'
                        )
                    item_price = variant.final_price
                else:
                    product = Product.objects.select_for_update().get(pk=product.pk)
                    if product.stock < qty:
                        raise serializers.ValidationError(
                            f'"{product.name}" only has {product.stock} unit(s) in stock.'
                        )
                    item_price = product.price

                OrderItem.objects.create(
                    order=order,
                    product=product,
                    variant=variant,
                    quantity=qty,
                    price=item_price
                )
                total += (item_price * qty)

                if variant:
                    ProductVariant.objects.filter(pk=variant.pk).update(stock=F('stock') - qty)
                    ProductVariant.objects.filter(pk=variant.pk, stock=0).update(is_available=False)
                else:
                    Product.objects.filter(pk=product.pk).update(stock=F('stock') - qty)
                    Product.objects.filter(pk=product.pk, stock=0).update(is_available=False)
            
            # Apply promo code if provided
            promo_obj = None
            discount_amount = Decimal('0.00')
            if promo_code_str:
                from .models import PromoCode
                try:
                    # Lock row to prevent concurrent limit bypasses
                    promo_obj = PromoCode.objects.select_for_update().get(code__iexact=promo_code_str)
                except PromoCode.DoesNotExist:
                    raise serializers.ValidationError("Invalid promo code.")
                
                # Compute subtotal for items belonging to the seller of this promo code
                if promo_obj.seller:
                    matching_subtotal = sum(
                        item.quantity * item.price
                        for item in order.orderitem_set.all()
                        if item.product.seller == promo_obj.seller
                    )
                    seller_username = promo_obj.seller.username
                else:
                    matching_subtotal = total
                    seller_username = None
                
                is_valid, err_msg = promo_obj.is_valid_for_checkout(
                    seller_username=seller_username,
                    subtotal=matching_subtotal
                )
                if not is_valid:
                    raise serializers.ValidationError(err_msg)
                
                discount_amount = promo_obj.calculate_discount(matching_subtotal)
                
                order.promo_code = promo_obj
                order.discount_amount = discount_amount
                
                # Increment usage atomically
                PromoCode.objects.filter(pk=promo_obj.pk).update(use_count=F('use_count') + 1)
            
            shipping_fee = validated_data.get('shipping_fee', 0)
            order.total_amount = max(Decimal('0.00'), total - discount_amount) + shipping_fee
            order.save(update_fields=['total_amount', 'promo_code', 'discount_amount'])

        # FIX MED-06: notify sellers of new order
        try:
            from .models import push_notification
            seller_ids_notified = set()
            for item in order.orderitem_set.select_related('product__seller'):
                if item.product.seller_id not in seller_ids_notified:
                    seller_ids_notified.add(item.product.seller_id)
                    push_notification(
                        item.product.seller,
                        'order_status',
                        '🛍️ New Order!',
                        f'Order #{order.id} — {item.product.name} × {item.quantity} — TSh {int(item.subtotal()):,}',
                        '/dashboard/orders'
                    )
        except Exception:
            pass  # never block order creation for notification failure

        # FIX: C-02 — REMOVED auto-advance to AWAITING_PAYMENT
        # The order is created with status='CART' (model default).
        # The frontend must call POST /api/orders/{id}/advance/ with {"status": "AWAITING_PAYMENT"}
        # after the user completes the checkout form. This restores the intended state machine flow.
        return order

class WarehouseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    variant_name = serializers.SerializerMethodField()
    product_image = serializers.SerializerMethodField()
    seller_username = serializers.CharField(source='product.seller.username', read_only=True)
    has_review = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'variant', 'variant_name', 'product_name', 'product_image', 'seller_username', 'quantity', 'price', 'subtotal', 'has_review']

    def get_product_name(self, obj):
        return "SokoniMax Secured Package"

    def get_variant_name(self, obj):
        return "Standard"

    def get_product_image(self, obj):
        return None

    def get_has_review(self, obj):
        return False

class WarehouseOrderSerializer(OrderSerializer):
    items = WarehouseOrderItemSerializer(source='orderitem_set', many=True, read_only=True)

class StoreImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreImage
        fields = ['id', 'image', 'uploaded_at']

class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    seller_rating = serializers.SerializerMethodField()  # FIX B-14
    store_images = StoreImageSerializer(many=True, read_only=True)

    class Meta:
        model = UserProfile
        fields = ['id', 'user', 'user_id', 'username', 'is_verified', 'phone_number', 'instagram_username',
                  'website', 'bio', 'tier', 'location', 'latitude', 'longitude', 'profile_picture', 'banner_image',
                  'preferred_currency', 'seller_rating', 'store_images', 'is_location_verified']
        read_only_fields = ['user', 'is_verified', 'tier', 'is_location_verified']  # FIX: S-07 — only staff should set these

    def get_seller_rating(self, obj):
        return obj.seller_rating  # FIX B-14

    def update(self, instance, validated_data):
        # Check if location coordinates changed
        lat_changed = 'latitude' in validated_data and validated_data['latitude'] != instance.latitude
        lng_changed = 'longitude' in validated_data and validated_data['longitude'] != instance.longitude

        ret = super().update(instance, validated_data)

        if lat_changed or lng_changed:
            instance.is_location_verified = False
            instance.save(update_fields=['is_location_verified'])
            
            # Log audit
            request = self.context.get('request')
            if request and hasattr(request, 'user'):
                try:
                    from staff.api_views import log_audit
                    log_audit(
                        user=request.user,
                        action='LOCATION_CHANGED',
                        description=f'User {instance.user.username} updated location to {instance.latitude}, {instance.longitude}',
                        request=request
                    )
                except Exception:
                    pass

        return ret

from .models import SponsoredListing

class SponsoredListingSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True)
    product_details = ProductSerializer(source='product', read_only=True)

    class Meta:
        model = SponsoredListing
        fields = ['id', 'user', 'product', 'product_name', 'product_slug', 'product_details', 'title', 'description', 'status', 'admin_notes', 'duration_days', 'amount', 'transaction_reference', 'payment_proof', 'created_at', 'expires_at']
        read_only_fields = ['user', 'status', 'admin_notes', 'amount', 'created_at', 'expires_at']


class SubscriptionTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionTier
        fields = ['id', 'name', 'price', 'benefits', 'duration', 'is_active', 'tier_level', 'commission_rate']


class SubscriptionSerializer(serializers.ModelSerializer):
    tier = SubscriptionTierSerializer(read_only=True)
    is_expired = serializers.SerializerMethodField()
    
    class Meta:
        model = Subscription
        fields = ['id', 'user', 'tier', 'start_date', 'end_date', 'is_active', 'is_expired']
        
    def get_is_expired(self, obj):
        from django.utils import timezone
        if not obj.end_date:
            return False
        return timezone.now() > obj.end_date



class UserPaymentConfirmationSerializer(serializers.ModelSerializer):
    tier_name = serializers.CharField(source='tier.name', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = PaymentConfirmation
        fields = ['id', 'user', 'username', 'tier', 'tier_name', 'amount', 'reference', 'proof', 'status', 'created_at']
        read_only_fields = ['user', 'status', 'created_at']


# ─── New Serializers for v5 fixes ─────────────────────────────────────

class NotificationSerializer(serializers.ModelSerializer):  # FIX B-11
    class Meta:
        model = Notification
        fields = ['id', 'notification_type', 'title', 'message', 'link', 'is_read', 'created_at']
        read_only_fields = ['notification_type', 'title', 'message', 'link', 'created_at']


class MessageSerializer(serializers.ModelSerializer):  # FIX B-12
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    content = serializers.CharField(max_length=2000, required=True, allow_blank=False)

    class Meta:
        model = Message
        fields = ['id', 'conversation', 'sender', 'sender_username', 'content', 'is_read', 'created_at']
        read_only_fields = ['sender', 'created_at']

    def validate_content(self, value):
        stripped = value.strip() if value else ''
        if not stripped:
            raise serializers.ValidationError("Message content cannot be empty.")
        return stripped


class ConversationSerializer(serializers.ModelSerializer):  # FIX B-12
    buyer_username = serializers.CharField(source='buyer.username', read_only=True)
    seller_username = serializers.CharField(source='seller.username', read_only=True)
    seller_verified = serializers.BooleanField(source='seller.profile.is_verified', read_only=True)
    seller_tier = serializers.CharField(source='seller.profile.tier', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ['id', 'buyer', 'buyer_username', 'seller', 'seller_username',
                  'seller_verified', 'seller_tier',
                  'product', 'product_name', 'last_message', 'unread_count',
                  'created_at', 'updated_at']
        read_only_fields = ['buyer', 'created_at', 'updated_at']

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        return MessageSerializer(msg).data if msg else None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request:
            return 0
        return obj.messages.filter(is_read=False).exclude(sender=request.user).count()


class SavedSearchSerializer(serializers.ModelSerializer):  # FIX B-13
    class Meta:
        model = SavedSearch
        fields = ['id', 'query', 'category', 'min_price', 'max_price',
                  'condition', 'notify_on_match', 'created_at']
        read_only_fields = ['created_at']


class PriceAlertSerializer(serializers.ModelSerializer):  # FIX B-13
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = PriceAlert
        fields = ['id', 'product', 'product_name', 'target_price', 'is_active',
                  'triggered_at', 'created_at']
        read_only_fields = ['triggered_at', 'created_at']


class DisputeSerializer(serializers.ModelSerializer):  # FIX B-15
    class Meta:
        model = Dispute
        fields = ['id', 'order', 'opened_by', 'reason', 'evidence_description',
                  'evidence_image', 'status', 'assigned_staff', 'resolution_notes',
                  'resolved_at', 'created_at', 'updated_at']
        read_only_fields = ['opened_by', 'status', 'assigned_staff',
                           'resolution_notes', 'resolved_at', 'created_at', 'updated_at']


class ProductVariantSerializer(serializers.ModelSerializer):  # FIX B-16
    final_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = ProductVariant
        fields = ['id', 'product', 'name', 'sku', 'price_adjustment', 'stock',
                  'is_available', 'image', 'final_price']


class SiteSettingsSerializer(serializers.ModelSerializer):  # FIX B-18
    class Meta:
        model = SiteSettings
        fields = ['company_name', 'tagline', 'support_email', 'support_phone',
                  'whatsapp_number', 'address', 'facebook_url', 'instagram_url',
                  'twitter_url', 'working_hours']


class DeliveryZoneSerializer(serializers.ModelSerializer):  # FIX B-21
    seller_username = serializers.CharField(source='seller.username', read_only=True)

    class Meta:
        model = DeliveryZone
        fields = ['id', 'seller', 'seller_username', 'zone_name', 'delivery_fee',
                  'estimated_days', 'is_active', 'notes']
        read_only_fields = ['seller']


class SellerApplicationSerializer(serializers.ModelSerializer):
    requested_tier_name = serializers.CharField(source='requested_tier.name', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = SellerApplication
        fields = [
            'id', 'user', 'username', 'requested_tier', 'requested_tier_name',
            'business_name', 'business_registration_number', 'tin_number',
            'business_address', 'business_region',
            'id_document', 'business_document', 'status',
            'rejection_reason', 'created_at', 'updated_at'
        ]
        read_only_fields = ['user', 'status', 'rejection_reason', 'created_at', 'updated_at']


class TeamMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(write_only=True)
    user_details = serializers.SerializerMethodField(read_only=True)
    owner_username = serializers.CharField(source='owner.username', read_only=True)

    class Meta:
        model = TeamMember
        fields = ['id', 'owner', 'owner_username', 'user', 'username', 'user_details', 'permissions', 'invitation_status', 'is_active', 'role_preset', 'created_at']
        read_only_fields = ['id', 'owner', 'user', 'invitation_status', 'created_at']

    def get_user_details(self, obj):
        return {
            'id': obj.user.id,
            'username': obj.user.username,
            'email': obj.user.email,
            'first_name': obj.user.first_name,
            'last_name': obj.user.last_name
        }

    def validate_username(self, value):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.get(username=value)
            if user.profile.tier != 'customer':
                raise serializers.ValidationError("Invited team members must have a regular customer account (not a seller or business account).")
            return user
        except User.DoesNotExist:
            raise serializers.ValidationError("User with this username does not exist.")

    def create(self, validated_data):
        owner = self.context['request'].user
        user = validated_data.pop('username')  # user object after validation

        is_business = owner.profile.tier == 'business' or owner.subscriptions.filter(is_active=True, tier__tier_level='business').exists()
        if not is_business:
            raise serializers.ValidationError("Only users with a Business tier subscription can invite team members.")

        # Enforce seat limit if the owner's active Business subscription defines one.
        active_sub = owner.subscriptions.filter(is_active=True, tier__tier_level='business').select_related('tier').first()
        if active_sub and active_sub.tier.max_team_members is not None:
            current_count = TeamMember.objects.filter(owner=owner, invitation_status__in=['pending', 'accepted']).count()
            if current_count >= active_sub.tier.max_team_members:
                raise serializers.ValidationError(
                    f"Your Business plan allows up to {active_sub.tier.max_team_members} team members. Remove an existing member or upgrade your plan to invite more."
                )

        if owner == user:
            raise serializers.ValidationError("You cannot invite yourself to your own team.")

        if TeamMember.objects.filter(owner=owner, user=user).exists():
            raise serializers.ValidationError("This user is already a member of your team.")

        permissions = validated_data.get('permissions', {})
        if not isinstance(permissions, dict):
            permissions = {}
        # manage_messages permission is reserved for future seller-messaging-as-team-member support; not yet enforced
            
        role_preset = validated_data.get('role_preset', '')

        member = TeamMember.objects.create(
            owner=owner, user=user, permissions=permissions, 
            invitation_status='pending', role_preset=role_preset
        )
        from .models import push_notification, TeamMemberAuditLog
        try:
            push_notification(
                user, 'order_status', 'Team invitation',
                f'{owner.username} has invited you to join their business team. Review and accept in your account settings.',
                '/dashboard/team-invitations'
            )
        except Exception:
            pass
            
        TeamMemberAuditLog.objects.create(
            owner=owner, target_user=user, performed_by=owner,
            action='invited', detail={'permissions': permissions, 'role_preset': role_preset}
        )
        return member
