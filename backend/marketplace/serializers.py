from rest_framework import serializers
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
        children = obj.children.all()
        return CategorySerializer(children, many=True).data if children.exists() else []


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

    class Meta:
        model = Product
        fields = ['id', 'name', 'slug', 'description', 'price', 'stock', 'is_available',
                  'category', 'category_name', 'seller', 'seller_username', 'seller_verified',
                  'seller_tier', 'seller_profile_picture', 'condition',
                  'avg_rating', 'like_count', 'images']
        read_only_fields = ['seller', 'slug']

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

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'quantity', 'price', 'subtotal']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(source='orderitem_set', many=True, read_only=True)
    timeline_events = TrackingEventSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    buyer_username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = Order
        fields = ['id', 'user', 'buyer_username', 'order_date', 'total_amount', 'status', 'items', 'timeline_events', 'payments']
        read_only_fields = ['user', 'total_amount']

class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = UserProfile
        fields = ['id', 'user', 'username', 'is_verified', 'phone_number', 'instagram_username', 'website', 'bio', 'tier', 'location', 'profile_picture', 'banner_image']

from .models import SponsoredListing

class SponsoredListingSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True)

    class Meta:
        model = SponsoredListing
        fields = ['id', 'user', 'product', 'product_name', 'product_slug', 'title', 'description', 'status', 'admin_notes', 'created_at', 'expires_at']
        read_only_fields = ['user', 'status', 'admin_notes', 'created_at', 'expires_at']
