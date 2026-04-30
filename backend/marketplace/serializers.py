from rest_framework import serializers
from django.db import transaction  # FIX: C-01
from django.db.models import F  # FIX: C-01
from .models import (
    Product, Category, Review, ProductComment, Order, OrderItem, 
    Payment, TrackingEvent, UserProfile, Subscription, SubscriptionTier,
    ProductImage, Like, LipaNumber, FAQ, SupportTicket,
    Notification, Conversation, Message, SavedSearch, PriceAlert,
    Dispute, ProductVariant, SiteSettings, DeliveryZone
)

class LipaNumberSerializer(serializers.ModelSerializer):
    network_name = serializers.CharField(source='network.name', read_only=True)
    network_logo = serializers.ImageField(source='network.image', read_only=True)

    class Meta:
        model = LipaNumber
        fields = ['id', 'network', 'network_name', 'network_logo', 'number', 'name',
                  'is_active', 'display_order']
        read_only_fields = ['seller']

class FAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = '__all__'

class SupportTicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicket
        fields = '__all__'
        read_only_fields = ['user', 'status', 'assigned_to', 'staff_notes', 'resolved_at']

class CategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'parent', 'children']

    def get_children(self, obj):
        depth = self.context.get('_cat_depth', 0)  # FIX C-17: depth guard
        if depth >= 2:
            return []
        kids = obj.children.all()
        if not kids.exists():
            return []
        return CategorySerializer(
            kids, many=True,
            context={**self.context, '_cat_depth': depth + 1}
        ).data


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'image']


class ProductSerializer(serializers.ModelSerializer):
    seller_username = serializers.CharField(source='seller.username', read_only=True)
    seller_tier = serializers.SerializerMethodField()
    seller_verified = serializers.SerializerMethodField()
    seller_profile_picture = serializers.SerializerMethodField()
    avg_rating = serializers.SerializerMethodField()
    like_count = serializers.IntegerField(source='likes.count', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)

    has_inspection = serializers.SerializerMethodField()  # FIX B-19
    inspection_verdict = serializers.SerializerMethodField()  # FIX B-19

    inspections = serializers.SerializerMethodField()
    is_verified = serializers.BooleanField(read_only=True)

    class Meta:
        model = Product
        fields = ['id', 'name', 'slug', 'description', 'price', 'stock', 'is_available',
                  'category', 'category_name', 'seller', 'seller_username', 'seller_verified',
                  'seller_tier', 'seller_profile_picture', 'condition',
                  'avg_rating', 'like_count', 'images', 'inspections', 'is_verified',
                  'has_inspection', 'inspection_verdict']
        read_only_fields = ['seller', 'slug']

    def get_inspections(self, obj):
        from inspections.serializers import InspectionSummarySerializer
        return InspectionSummarySerializer(obj.inspections.all(), many=True).data

    def get_avg_rating(self, obj):
        return obj.average_rating()

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
        return any(i.status == 'published' for i in obj.inspections.all())

    def get_inspection_verdict(self, obj):  # FIX B-19
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
    product_image = serializers.SerializerMethodField()
    seller_username = serializers.CharField(source='product.seller.username', read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'variant', 'product_name', 'product_image', 'seller_username', 'quantity', 'price', 'subtotal']
        read_only_fields = ['price']

    def get_product_image(self, obj):
        img = obj.product.images.first()
        if img:
            return img.image.url
        return None

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(source='orderitem_set', many=True, required=False)
    timeline_events = TrackingEventSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    buyer_username = serializers.CharField(source='user.username', read_only=True)
    seller_subtotal = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = [
            'id', 'user', 'buyer_username', 'order_date', 'total_amount', 'status',
            'shipping_method', 'shipping_fee', 'delivery_info',  # FIX: L-02 — include shipping fields
            'items', 'timeline_events', 'payments', 'seller_subtotal'
        ]
        read_only_fields = ['user', 'total_amount']

    def get_seller_subtotal(self, obj):
        request = self.context.get('request')  # FIX: L-03 — guard against missing context
        if not request or not hasattr(request, 'user') or request.user.is_anonymous:
            return float(obj.total_amount)
        return float(sum(item.subtotal() for item in obj.orderitem_set.filter(product__seller=request.user)))

    def create(self, validated_data):
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
            
            shipping_fee = validated_data.get('shipping_fee', 0)
            order.total_amount = total + shipping_fee
            order.save(update_fields=['total_amount'])

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

class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    seller_rating = serializers.SerializerMethodField()  # FIX B-14

    class Meta:
        model = UserProfile
        fields = ['id', 'user', 'username', 'is_verified', 'phone_number', 'instagram_username',
                  'website', 'bio', 'tier', 'location', 'profile_picture', 'banner_image',
                  'preferred_currency', 'seller_rating']
        read_only_fields = ['user', 'is_verified', 'tier']  # FIX: S-07 — only staff should set these

    def get_seller_rating(self, obj):
        return obj.seller_rating  # FIX B-14

from .models import SponsoredListing

class SponsoredListingSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True)
    product_details = ProductSerializer(source='product', read_only=True)

    class Meta:
        model = SponsoredListing
        fields = ['id', 'user', 'product', 'product_name', 'product_slug', 'product_details', 'title', 'description', 'status', 'admin_notes', 'duration_days', 'amount', 'created_at', 'expires_at']
        read_only_fields = ['user', 'status', 'admin_notes', 'amount', 'created_at', 'expires_at']


# ─── New Serializers for v5 fixes ─────────────────────────────────────

class NotificationSerializer(serializers.ModelSerializer):  # FIX B-11
    class Meta:
        model = Notification
        fields = ['id', 'notification_type', 'title', 'message', 'link', 'is_read', 'created_at']
        read_only_fields = ['notification_type', 'title', 'message', 'link', 'created_at']


class MessageSerializer(serializers.ModelSerializer):  # FIX B-12
    sender_username = serializers.CharField(source='sender.username', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'conversation', 'sender', 'sender_username', 'content', 'is_read', 'created_at']
        read_only_fields = ['sender', 'created_at']


class ConversationSerializer(serializers.ModelSerializer):  # FIX B-12
    buyer_username = serializers.CharField(source='buyer.username', read_only=True)
    seller_username = serializers.CharField(source='seller.username', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ['id', 'buyer', 'buyer_username', 'seller', 'seller_username',
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
