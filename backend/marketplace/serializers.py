from rest_framework import serializers
from django.db import transaction  # FIX: C-01
from django.db.models import F  # FIX: C-01
from .models import (
    Product, Category, Review, ProductComment, Order, OrderItem, 
    Payment, TrackingEvent, UserProfile, Subscription, SubscriptionTier,
    ProductImage, Like
)

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

    inspections = serializers.SerializerMethodField()
    is_verified = serializers.BooleanField(read_only=True)

    class Meta:
        model = Product
        fields = ['id', 'name', 'slug', 'description', 'price', 'stock', 'is_available',
                  'category', 'category_name', 'seller', 'seller_username', 'seller_verified',
                  'seller_tier', 'seller_profile_picture', 'condition',
                  'avg_rating', 'like_count', 'images', 'inspections', 'is_verified']
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
        fields = ['id', 'product', 'product_name', 'product_image', 'seller_username', 'quantity', 'price', 'subtotal']
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

                # FIX: C-01 — validate stock before creating OrderItem
                product.refresh_from_db(fields=['stock'])
                if product.stock < qty:
                    raise serializers.ValidationError(
                        f'"{product.name}" only has {product.stock} unit(s) in stock.'
                    )

                OrderItem.objects.create(
                    order=order,
                    product=product,
                    quantity=qty,
                    price=product.price
                )
                total += (product.price * qty)

                # FIX: C-01 — decrement stock atomically
                Product.objects.filter(pk=product.pk).update(stock=F('stock') - qty)
                # FIX: M-03 — auto-mark unavailable if now at zero
                Product.objects.filter(pk=product.pk, stock=0).update(is_available=False)
            
            shipping_fee = validated_data.get('shipping_fee', 0)
            order.total_amount = total + shipping_fee
            order.save(update_fields=['total_amount'])

        # FIX: C-02 — REMOVED auto-advance to AWAITING_PAYMENT
        # The order is created with status='CART' (model default).
        # The frontend must call POST /api/orders/{id}/advance/ with {"status": "AWAITING_PAYMENT"}
        # after the user completes the checkout form. This restores the intended state machine flow.
        return order

class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = UserProfile
        fields = ['id', 'user', 'username', 'is_verified', 'phone_number', 'instagram_username', 'website', 'bio', 'tier', 'location', 'profile_picture', 'banner_image']
        read_only_fields = ['user', 'is_verified', 'tier']  # FIX: S-07 — only staff should set these

from .models import SponsoredListing

class SponsoredListingSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True)
    product_details = ProductSerializer(source='product', read_only=True)

    class Meta:
        model = SponsoredListing
        fields = ['id', 'user', 'product', 'product_name', 'product_slug', 'product_details', 'title', 'description', 'status', 'admin_notes', 'duration_days', 'amount', 'created_at', 'expires_at']
        read_only_fields = ['user', 'status', 'admin_notes', 'amount', 'created_at', 'expires_at']
