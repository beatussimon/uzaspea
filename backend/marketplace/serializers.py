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
    TeamMember, TeamMemberAuditLog, StoreImage, ProductPriceTier, ProductRequest,
    VehicleMake, VehicleModel, Vehicle, ProductVehicleFitment,
    Brand, ReferenceProduct
)


class ProductRequestSerializer(serializers.ModelSerializer):
    seller_username = serializers.CharField(source='seller.username', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True, allow_null=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    fulfilled_product_id = serializers.IntegerField(source='fulfilled_product.id', read_only=True, allow_null=True)
    fulfilled_product_slug = serializers.CharField(source='fulfilled_product.slug', read_only=True, allow_null=True)
    has_voted = serializers.SerializerMethodField()
    votes_count = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductRequest
        fields = [
            'id', 'name', 'description', 'seller', 'seller_username', 
            'user', 'user_username', 'request_count', 'votes_count', 'has_voted',
            'created_at', 'last_requested', 'category', 'category_name',
            'price', 'buying_price', 'condition', 'requires_quote', 'image', 'image_url',
            'is_fulfilled', 'fulfilled_product_id', 'fulfilled_product_slug'
        ]
        read_only_fields = ['request_count', 'last_requested', 'fulfilled_product_id', 'fulfilled_product_slug']

    def get_has_voted(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.votes.filter(user=request.user).exists() or (obj.user_id == request.user.id)
        return False

    def get_votes_count(self, obj):
        return obj.request_count

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

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

from .models import TicketMessage

class TicketMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketMessage
        fields = '__all__'
        read_only_fields = ['ticket', 'sender', 'sender_name', 'is_internal', 'created_at']

class SupportTicketSerializer(serializers.ModelSerializer):
    messages = serializers.SerializerMethodField()
    # We will still accept 'message' in write operations for the initial ticket creation
    message = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = SupportTicket
        fields = '__all__'
        read_only_fields = ['user', 'status', 'assigned_to', 'resolved_at']

    def get_messages(self, obj):
        request = self.context.get('request')
        is_staff = request and request.user and request.user.is_staff
        
        msgs = obj.messages.all()
        if not is_staff:
            msgs = msgs.filter(is_internal=False)
            
        return TicketMessageSerializer(msgs, many=True).data

    def create(self, validated_data):
        initial_message = validated_data.pop('message', '')
        ticket = super().create(validated_data)
        if initial_message:
            TicketMessage.objects.create(
                ticket=ticket,
                sender=ticket.user,
                sender_name=ticket.name,
                body=initial_message,
                is_internal=False
            )
        return ticket

class CategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    product_count = serializers.SerializerMethodField()
    total_sales = serializers.SerializerMethodField()
    total_saves = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'parent', 'children', 'image', 'product_count', 'total_sales', 'total_saves', 'spec_schema', 'is_leaf']

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
        return obj.products.filter(is_available=True, stock__gt=0).count()

    def get_total_sales(self, obj):
        return getattr(obj, 'total_sales', 0)
        
    def get_total_saves(self, obj):
        return getattr(obj, 'total_saves', 0)


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'image']


class MobileNetworkSerializer(serializers.ModelSerializer):
    class Meta:
        model = MobileNetwork
        fields = ['id', 'name', 'image']


class ProductPriceTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductPriceTier
        fields = ['id', 'min_quantity', 'max_quantity', 'unit_price']


class BrandSerializer(serializers.ModelSerializer):
    products_count = serializers.SerializerMethodField()
    created_by_username = serializers.CharField(source='created_by.username', read_only=True, default=None)

    class Meta:
        model = Brand
        fields = ['id', 'name', 'slug', 'logo', 'is_active', 'is_verified', 'created_by_username', 'created_at', 'products_count']

    def get_products_count(self, obj):
        if hasattr(obj, 'products_count_annotated'):
            return obj.products_count_annotated
        # Avoid N+1 count query when serialized nested inside ProductSerializer
        if self.parent and isinstance(self.parent, serializers.BaseSerializer):
            return 0
        return obj.products.count()

class ReferenceProductSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True, default=None)
    products_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ReferenceProduct
        fields = ['id', 'name', 'slug', 'brand', 'brand_name', 'category', 'category_name', 'image', 'structured_specs', 'is_verified', 'created_by_username', 'created_at', 'products_count']

    def get_products_count(self, obj):
        if hasattr(obj, 'products_count_annotated'):
            return obj.products_count_annotated
        # Avoid N+1 count query when serialized nested inside ProductSerializer
        if self.parent and isinstance(self.parent, serializers.BaseSerializer):
            return 0
        return obj.instances.count()

class FlexibleBrandRelatedField(serializers.PrimaryKeyRelatedField):
    def to_internal_value(self, data):
        if not data:
            return None
        if isinstance(data, str) and not data.isdigit():
            from .models import Brand
            from django.db.models import Q
            from django.utils.text import slugify

            raw_val = data.strip()
            if not raw_val or raw_val.lower() == 'null' or raw_val.lower() == 'none' or raw_val == '__custom__':
                return None

            # Clean and standardize string
            clean_name = " ".join(raw_val.split())
            clean_slug = slugify(clean_name) or "brand"

            # 1. Check existing brand (by slug or case-insensitive name)
            brand = Brand.objects.filter(
                Q(slug__iexact=clean_slug) | 
                Q(name__iexact=clean_name) | 
                Q(slug__iexact=raw_val) | 
                Q(name__iexact=raw_val)
            ).first()

            if brand:
                return brand

            # 2. Smart auto-create with standard casing if not found
            if clean_name.islower() or clean_name.isupper():
                clean_name = clean_name.title()

            request = self.context.get('request')
            user = request.user if (request and hasattr(request, 'user') and request.user.is_authenticated) else None

            brand, _ = Brand.objects.get_or_create(
                slug=clean_slug,
                defaults={
                    'name': clean_name,
                    'is_active': True,
                    'is_verified': False,
                    'created_by': user
                }
            )
            return brand

        return super().to_internal_value(data)

class FlexibleReferenceProductRelatedField(serializers.PrimaryKeyRelatedField):
    def to_internal_value(self, data):
        if not data:
            return None
        if isinstance(data, str) and not data.isdigit():
            from .models import ReferenceProduct, Brand, Category
            from django.db.models import Q
            from django.utils.text import slugify

            raw_val = data.strip()
            if not raw_val or raw_val.lower() == 'null' or raw_val.lower() == 'none' or raw_val == '__custom__':
                return None

            clean_name = " ".join(raw_val.split())
            clean_slug = slugify(clean_name) or "model"
            ref = ReferenceProduct.objects.filter(
                Q(slug__iexact=clean_slug) | 
                Q(slug__iexact=raw_val) | 
                Q(name__iexact=raw_val) |
                Q(name__iexact=clean_name)
            ).first()

            if ref:
                return ref

            # Auto-create unverified reference product if brand and category exist
            request = self.context.get('request')
            initial = getattr(self.root, 'initial_data', None) or getattr(self.parent, 'initial_data', None) or {}
            req_data = getattr(request, 'data', {}) if request else {}
            
            brand_id_or_slug = initial.get('brand') or req_data.get('brand')
            category_id = initial.get('category') or req_data.get('category')

            brand_obj = None
            if brand_id_or_slug:
                if isinstance(brand_id_or_slug, Brand):
                    brand_obj = brand_id_or_slug
                elif str(brand_id_or_slug).isdigit():
                    brand_obj = Brand.objects.filter(id=int(brand_id_or_slug)).first()
                else:
                    brand_obj = Brand.objects.filter(Q(slug__iexact=str(brand_id_or_slug)) | Q(name__iexact=str(brand_id_or_slug))).first()

            cat_obj = None
            if category_id:
                if isinstance(category_id, Category):
                    cat_obj = category_id
                elif str(category_id).isdigit():
                    cat_obj = Category.objects.filter(id=int(category_id)).first()
                else:
                    cat_obj = Category.objects.filter(slug=str(category_id)).first()

            if brand_obj and cat_obj:
                user = request.user if (request and hasattr(request, 'user') and request.user.is_authenticated) else None
                ref_slug = slugify(f"{brand_obj.slug}-{clean_name}") or clean_slug
                ref, _ = ReferenceProduct.objects.get_or_create(
                    brand=brand_obj,
                    name__iexact=clean_name,
                    defaults={
                        'name': clean_name,
                        'slug': ref_slug,
                        'category': cat_obj,
                        'is_verified': False,
                        'created_by': user
                    }
                )
                return ref

            return None
        return super().to_internal_value(data)

class SafeJSONField(serializers.Field):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault('required', False)
        kwargs.setdefault('default', dict)
        kwargs.setdefault('allow_null', True)
        super().__init__(*args, **kwargs)

    def to_internal_value(self, data):
        import json
        if not data:
            return {}
        if isinstance(data, dict):
            return data
        if isinstance(data, str):
            data = data.strip()
            if not data or data in ('null', 'undefined', '{}', '[]', '[object Object]'):
                return {}
            try:
                parsed = json.loads(data)
                if isinstance(parsed, dict):
                    return parsed
                return {}
            except Exception:
                return {}
        return {}

    def to_representation(self, value):
        import json
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass
        return {}

class ProductSerializer(serializers.ModelSerializer):
    seller_username = serializers.CharField(source='seller.username', read_only=True)
    price_tiers = ProductPriceTierSerializer(many=True, read_only=True)
    seller_tier = serializers.SerializerMethodField()
    seller_verified = serializers.SerializerMethodField()
    seller_profile_picture = serializers.SerializerMethodField()
    seller_full_name = serializers.SerializerMethodField()
    vehicle_ids = serializers.SerializerMethodField(read_only=True)
    oem_part_number = serializers.SerializerMethodField(read_only=True)

    vehicle_ids = serializers.ListField(child=serializers.IntegerField(), required=False, write_only=True)

    avg_rating = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    weekly_sales = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    category_parent_name = serializers.CharField(source='category.parent.name', read_only=True, default=None)
    category_parent_slug = serializers.CharField(source='category.parent.slug', read_only=True, default=None)
    images = ProductImageSerializer(many=True, read_only=True)

    brand = FlexibleBrandRelatedField(queryset=Brand.objects.all(), required=False, allow_null=True)
    reference_product = FlexibleReferenceProductRelatedField(queryset=ReferenceProduct.objects.all(), required=False, allow_null=True)
    structured_specs = SafeJSONField()
    specifications = SafeJSONField()
    unit_of_measure = serializers.CharField(max_length=50, required=False, allow_blank=True, default='piece')
    is_draft = serializers.BooleanField(required=False, default=False)

    brand_details = BrandSerializer(source='brand', read_only=True)
    reference_product_details = ReferenceProductSerializer(source='reference_product', read_only=True)

    has_inspection = serializers.SerializerMethodField()  # FIX B-19
    inspection_verdict = serializers.SerializerMethodField()  # FIX B-19

    inspections = serializers.SerializerMethodField()
    is_verified = serializers.BooleanField(read_only=True)
    latitude = serializers.FloatField(required=False, allow_null=True)
    longitude = serializers.FloatField(required=False, allow_null=True)
    can_review = serializers.SerializerMethodField()
    is_sponsored = serializers.SerializerMethodField()

    def get_is_sponsored(self, obj):
        return getattr(obj, 'annotated_is_sponsored', False)

    class Meta:
        model = Product
        fields = ['id', 'name', 'slug', 'sku', 'description', 'price', 'buying_price', 'sale_price', 'stock', 'is_available', 'is_draft',
                  'unit_of_measure', 'minimum_order_quantity', 'price_tiers',
                  'category', 'category_name', 'category_slug', 'category_parent_name', 'category_parent_slug', 'seller', 'seller_username', 'seller_full_name', 'seller_verified',
                  'seller_tier', 'seller_profile_picture', 'condition', 'requires_quote',
                  'avg_rating', 'like_count', 'weekly_sales', 'is_liked', 'images', 'inspections', 'is_verified', 'vehicle_ids', 'oem_part_number',
                  'has_inspection', 'inspection_verdict', 'created_at', 'location_name', 'latitude', 'longitude',
                  'weight_kg', 'size', 'can_review', 'is_sponsored', 'specifications',
                  'brand', 'reference_product', 'structured_specs', 'brand_details', 'reference_product_details']
        read_only_fields = ['seller', 'slug']

    def to_internal_value(self, data):
        import json
        mutable_data = data.copy() if hasattr(data, 'copy') else dict(data)
        
        # Handle draft defaults for incomplete listings
        is_draft_val = mutable_data.get('is_draft')
        is_draft = is_draft_val in [True, 'true', 'True', '1', 1]
        
        if is_draft:
            if not mutable_data.get('name') or not str(mutable_data.get('name')).strip():
                mutable_data['name'] = 'Untitled Draft'
            if not mutable_data.get('description') or not str(mutable_data.get('description')).strip():
                mutable_data['description'] = 'Draft listing'
            if not mutable_data.get('price') or str(mutable_data.get('price')).strip() == '':
                mutable_data['price'] = '0.00'
            if not mutable_data.get('stock') or str(mutable_data.get('stock')).strip() == '':
                mutable_data['stock'] = '0'
            if not mutable_data.get('category'):
                from .models import Category
                cat = Category.objects.filter(children__isnull=True).first() or Category.objects.first()
                if cat:
                    mutable_data['category'] = cat.id

        # Handle JSON strings from multipart/form-data
        if 'structured_specs' in mutable_data and isinstance(mutable_data['structured_specs'], str):
            try:
                mutable_data['structured_specs'] = json.loads(mutable_data['structured_specs'])
            except Exception:
                pass
                
        if 'specifications' in mutable_data and isinstance(mutable_data['specifications'], str):
            try:
                mutable_data['specifications'] = json.loads(mutable_data['specifications'])
            except Exception:
                pass

        return super().to_internal_value(mutable_data)

    def get_inspections(self, obj):
        # View uses prefetch_related for obj.inspections, avoiding N+1
        from inspections.serializers import InspectionSummarySerializer
        return InspectionSummarySerializer(obj.inspections.all(), many=True).data

    def get_can_review(self, obj):
        request = self.context.get('request')
        view = self.context.get('view')
        if not request or not request.user.is_authenticated:
            return False
            
        # Avoid N+1 queries by only checking this on the detail view
        if view and getattr(view, 'action', None) == 'list':
            return False
        
        from .models import OrderItem, Review
        from django.db.models import Q
        
        completed_orders_count = OrderItem.objects.filter(
            order__user=request.user,
            product=obj,
            order__status__in=['COMPLETED', 'DELIVERED']
        ).values('order').distinct().count()
        
        if completed_orders_count == 0:
            return False
            
        reviews_count = Review.objects.filter(product=obj, user=request.user).count()
        return completed_orders_count > reviews_count

    def create(self, validated_data):
        import json
        request = self.context.get('request')
        req_data = request.data if (request and hasattr(request, 'data')) else {}
        price_tiers_data = req_data.get('price_tiers')
        vehicle_ids = req_data.getlist('vehicle_ids') if hasattr(req_data, 'getlist') else req_data.get('vehicle_ids', [])
        
        # In multipart/form-data, an array might come as 'vehicle_ids', 'vehicle_ids[]', or a comma-separated string
        if not isinstance(vehicle_ids, list):
            vehicle_ids = [vehicle_ids] if vehicle_ids else []
            
        oem_part_number = req_data.get('oem_part_number', None)
        
        if oem_part_number:
            specs = validated_data.get('specifications', {})
            if not isinstance(specs, dict):
                specs = {}
            specs['oem_part_number'] = oem_part_number
            validated_data['specifications'] = specs

        product = super().create(validated_data)
        if vehicle_ids:
            from .models import ProductVehicleFitment, Vehicle
            for vid in vehicle_ids:
                try:
                    if str(vid).isdigit():
                        vehicle = Vehicle.objects.get(id=int(vid))
                        ProductVehicleFitment.objects.create(product=product, vehicle=vehicle)
                except Exception:
                    pass

        if price_tiers_data:
            try:
                tiers = json.loads(price_tiers_data) if isinstance(price_tiers_data, str) else price_tiers_data
                for tier in tiers:
                    ProductPriceTier.objects.create(product=product, **tier)
            except Exception as e:
                pass

        # Ensure Brand is associated with Category for future listings
        if product.category and product.brand:
            try:
                product.category.brands.add(product.brand)
            except Exception:
                pass

        return product

    def update(self, instance, validated_data):
        import json
        request = self.context.get('request')
        req_data = request.data if (request and hasattr(request, 'data')) else {}
        price_tiers_data = req_data.get('price_tiers')
        vehicle_ids = req_data.getlist('vehicle_ids') if hasattr(req_data, 'getlist') else req_data.get('vehicle_ids', None)
        oem_part_number = req_data.get('oem_part_number', None)
        
        if vehicle_ids is not None and not isinstance(vehicle_ids, list):
            vehicle_ids = [vehicle_ids]
            
        if oem_part_number is not None:
            specs = validated_data.get('specifications', instance.specifications or {})
            if not isinstance(specs, dict):
                specs = {}
            specs['oem_part_number'] = oem_part_number
            validated_data['specifications'] = specs

        instance = super().update(instance, validated_data)

        # Ensure Brand is associated with Category for future listings
        if instance.category and instance.brand:
            try:
                instance.category.brands.add(instance.brand)
            except Exception:
                pass
        if vehicle_ids is not None:
            from .models import ProductVehicleFitment, Vehicle
            ProductVehicleFitment.objects.filter(product=instance).delete()
            for vid in vehicle_ids:
                try:
                    if str(vid).isdigit():
                        vehicle = Vehicle.objects.get(id=int(vid))
                        ProductVehicleFitment.objects.create(product=instance, vehicle=vehicle)
                except Exception:
                    pass

        if price_tiers_data is not None:
            try:
                tiers = json.loads(price_tiers_data)
                instance.price_tiers.all().delete()
                for tier in tiers:
                    ProductPriceTier.objects.create(product=instance, **tier)
            except Exception as e:
                pass
        return instance

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

    def get_weekly_sales(self, obj):
        if hasattr(obj, 'weekly_sales'):
            return obj.weekly_sales
        return getattr(obj, 'sales_count', 0)
    def get_vehicle_ids(self, obj):
        return [fitment.vehicle_id for fitment in obj.fitments.all()]

    def get_oem_part_number(self, obj):
        if obj.specifications and isinstance(obj.specifications, dict):
            return obj.specifications.get('oem_part_number', '')
        return ''

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
        if hasattr(obj.seller, 'profile') and obj.seller.profile.profile_picture:
            return obj.seller.profile.profile_picture.url
        return None

    def get_seller_full_name(self, obj):
        if obj.seller:
            name = f"{obj.seller.first_name} {obj.seller.last_name}".strip()
            return name if name else None
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
    user_full_name = serializers.SerializerMethodField()
    user_profile_picture = serializers.SerializerMethodField()
    user_verified = serializers.SerializerMethodField()
    user_tier = serializers.SerializerMethodField()
    is_verified_buyer = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = [
            'id', 'product', 'user', 'username', 'user_full_name', 
            'user_profile_picture', 'user_verified', 'user_tier', 
            'is_verified_buyer', 'order', 'rating', 'comment', 
            'created_at', 'approved'
        ]
        read_only_fields = ['user', 'approved']

    def get_user_full_name(self, obj):
        if obj.user:
            name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return name if name else None
        return None

    def get_user_profile_picture(self, obj):
        if hasattr(obj.user, 'profile') and obj.user.profile.profile_picture:
            try:
                return obj.user.profile.profile_picture.url
            except Exception:
                return None
        return None

    def get_user_verified(self, obj):
        if hasattr(obj.user, 'profile'):
            return getattr(obj.user.profile, 'is_verified', False)
        return False

    def get_user_tier(self, obj):
        if hasattr(obj.user, 'profile'):
            return getattr(obj.user.profile, 'user_tier', 'standard')
        return 'standard'

    def get_is_verified_buyer(self, obj):
        return True

class ProductCommentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    user_full_name = serializers.SerializerMethodField()
    user_profile_picture = serializers.SerializerMethodField()
    user_verified = serializers.SerializerMethodField()
    user_tier = serializers.SerializerMethodField()
    
    class Meta:
        model = ProductComment
        fields = [
            'id', 'product', 'user', 'username', 'user_full_name', 
            'user_profile_picture', 'user_verified', 'user_tier', 
            'body', 'parent', 'created_at', 'likes_count'
        ]
        read_only_fields = ['user', 'likes_count']

    def get_user_full_name(self, obj):
        if obj.user:
            name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return name if name else None
        return None

    def get_user_profile_picture(self, obj):
        if hasattr(obj.user, 'profile') and obj.user.profile.profile_picture:
            try:
                return obj.user.profile.profile_picture.url
            except Exception:
                return None
        return None

    def get_user_verified(self, obj):
        if hasattr(obj.user, 'profile'):
            return getattr(obj.user.profile, 'is_verified', False)
        return False

    def get_user_tier(self, obj):
        if hasattr(obj.user, 'profile'):
            return getattr(obj.user.profile, 'user_tier', 'standard')
        return 'standard'

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
    product_slug = serializers.CharField(source='product.slug', read_only=True)
    variant_name = serializers.CharField(source='variant.name', read_only=True)
    product_image = serializers.SerializerMethodField()
    seller_username = serializers.CharField(source='product.seller.username', read_only=True)
    requires_quote = serializers.BooleanField(source='product.requires_quote', read_only=True)
    catalog_price = serializers.SerializerMethodField()
    has_review = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_slug', 'variant', 'variant_name', 'product_name', 'product_image', 'seller_username', 'quantity', 'price', 'subtotal', 'requires_quote', 'catalog_price', 'has_review', 'review']
        read_only_fields = ['price']

    def get_catalog_price(self, obj):
        try:
            if obj.variant:
                if hasattr(obj.variant, 'final_price'):
                    return float(obj.variant.final_price)
                if hasattr(obj.variant, 'price_adjustment'):
                    base = float(obj.product.price) if (obj.product and obj.product.price) else 0
                    return base + float(obj.variant.price_adjustment or 0)
            if obj.product and obj.product.price:
                return float(obj.product.price)
        except Exception:
            pass
        return None

    def get_has_review(self, obj):
        from .models import Review
        # Check if a review exists for this product and this specific order
        return Review.objects.filter(product=obj.product, order=obj.order).exists()

    def get_review(self, obj):
        from .models import Review
        review = Review.objects.filter(product=obj.product, order=obj.order).first()
        if review:
            return ProductReviewSerializer(review, context=self.context).data
        return None

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
            'shipping_method', 'fulfillment_type', 'shipping_fee', 'delivery_info',  # FIX: L-02 — include shipping fields
            'items', 'timeline_events', 'payments', 'seller_subtotal', 'delivery_code', 'shipments',
            'has_vehicles', 'buyer_contact', 'seller_contacts', 'seller_commission', 'seller_net_payout',
            'logistics_info', 'promo_code', 'promo_code_code', 'discount_amount', 'promo_code_details',
            'negotiation_data', 'is_bulk_order'
        ]
        read_only_fields = ['user', 'total_amount']

    def validate(self, data):
        """HIGH-4: Cross-validate fulfillment_type and shipping_method."""
        shipping_method = data.get('shipping_method', 'DELIVERY')
        fulfillment_type = data.get('fulfillment_type')

        # Auto-infer sensible defaults when client omits fulfillment_type
        if not fulfillment_type:
            if shipping_method == 'PICKUP':
                data['fulfillment_type'] = 'WAREHOUSE_PICKUP'
            else:
                data['fulfillment_type'] = 'PLATFORM_DELIVERY'
            fulfillment_type = data['fulfillment_type']

        # Validate consistent combinations
        DELIVERY_TYPES = {'PLATFORM_DELIVERY', 'DIRECT_DELIVERY'}
        PICKUP_TYPES = {'WAREHOUSE_PICKUP', 'SELLER_PICKUP'}

        if shipping_method == 'DELIVERY' and fulfillment_type in PICKUP_TYPES:
            raise serializers.ValidationError(
                f"fulfillment_type '{fulfillment_type}' is incompatible with shipping_method 'DELIVERY'."
            )
        if shipping_method == 'PICKUP' and fulfillment_type in DELIVERY_TYPES:
            raise serializers.ValidationError(
                f"fulfillment_type '{fulfillment_type}' is incompatible with shipping_method 'PICKUP'."
            )

        # Region-based validation
        request = self.context.get('request')
        if request and request.method == 'POST' and self.initial_data.get('orderitem_set'):
            buyer_region = data.get('delivery_info', {}).get('region', '').strip().lower()
            
            # Find the first item to get the seller (assuming single-seller order or validating against first item)
            first_item = self.initial_data.get('orderitem_set', [])[0]
            if first_item:
                product_id = first_item.get('product')
                if isinstance(product_id, dict):
                    product_id = product_id.get('id') or product_id.get('pk')
                from marketplace.models import Product
                try:
                    product = Product.objects.get(pk=product_id)
                    seller = product.seller
                    
                    # Try to get seller's region from SellerApplication first, then UserProfile
                    seller_region = ''
                    app = seller.seller_applications.filter(status='approved').order_by('-created_at').first()
                    if app and app.business_region:
                        seller_region = app.business_region.strip().lower()
                    elif hasattr(seller, 'profile') and seller.profile.location:
                        seller_region = seller.profile.location.strip().lower()
                        
                    if buyer_region and seller_region and buyer_region != seller_region:
                        # They are in different regions, ONLY PLATFORM_DELIVERY is allowed
                        if fulfillment_type != 'PLATFORM_DELIVERY':
                            raise serializers.ValidationError(
                                "Buyer and seller are in different regions. Only 'Platform Delivery' (via our warehouse) is allowed."
                            )
                except Product.DoesNotExist:
                    pass

        return data

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
        sellers = set()
        for item in obj.orderitem_set.all():
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
        
        d_info = ret.get('delivery_info', {})
        if isinstance(d_info, str):
            import json
            import ast
            try:
                d_info = json.loads(d_info)
            except:
                try:
                    d_info = ast.literal_eval(d_info)
                except:
                    d_info = {}

        if d_info and isinstance(d_info, dict):
            ret['delivery_info'] = d_info
            if not d_info.get('estimated_shipping_fee'):
                origin_code = d_info.get('warehouse_code')
                dest_code = d_info.get('destination_warehouse_code')
                if origin_code and dest_code:
                    from warehouses.models import Warehouse, HistoricalRoutePricing
                    try:
                        orig_wh = Warehouse.objects.filter(code=origin_code).first()
                        dest_wh = Warehouse.objects.filter(code=dest_code).first()
                        if orig_wh and dest_wh:
                            hrp = HistoricalRoutePricing.objects.filter(
                                origin_warehouse=orig_wh, destination_warehouse=dest_wh
                            ).first()
                            if hrp and hrp.data_points > 0:
                                d_info['estimated_shipping_fee'] = float(hrp.average_cost)
                                d_info['is_historical_estimate'] = True
                    except Exception:
                        pass
            ret['delivery_info'] = d_info

        request = self.context.get('request')
        if request and hasattr(request, 'user') and not request.user.is_anonymous:
            user = request.user
            if not (user.is_staff or user.is_superuser or instance.user == user):
                from uzachuo.permissions import get_effective_sellers
                sellers = get_effective_sellers(user, required_permission='manage_orders') or get_effective_sellers(user, required_permission='manage_products') or [user.id]
                all_items = list(instance.orderitem_set.all())
                filtered_items = [item for item in all_items if item.product.seller_id in sellers]
                ret['items'] = OrderItemSerializer(filtered_items, many=True, context=self.context).data
        return ret

    def _get_seller_items(self, request, obj):
        items = list(obj.orderitem_set.all())
        if not request or not hasattr(request, 'user') or request.user.is_anonymous:
            return items
        from uzachuo.permissions import get_effective_sellers
        sellers = get_effective_sellers(request.user, required_permission='manage_orders') or get_effective_sellers(request.user)
        filtered_items = [item for item in items if item.product.seller_id in sellers]
        if not filtered_items:
            filtered_items = [item for item in items if item.product.seller_id == request.user.id]
        if not filtered_items:
            filtered_items = items
        return filtered_items

    def get_seller_subtotal(self, obj):
        request = self.context.get('request')
        items = self._get_seller_items(request, obj)
        return float(sum(item.subtotal() for item in items))

    def get_seller_commission(self, obj):
        request = self.context.get('request')
        items = self._get_seller_items(request, obj)
        seller_subtotal = sum(item.subtotal() for item in items)
        
        d_info = obj.delivery_info or {}
        if isinstance(d_info, str):
            import json
            import ast
            try: d_info = json.loads(d_info)
            except: 
                try: d_info = ast.literal_eval(d_info)
                except: d_info = {}
            
        is_pos = isinstance(d_info, dict) and d_info.get('is_pos')
        if is_pos:
            rate_pct = Decimal('5.00')
        else:
            from billing.models import get_seller_commission_rate
            rate_pct = get_seller_commission_rate(request.user) if (request and hasattr(request, 'user') and not request.user.is_anonymous) else Decimal('10.00')
            
        return float(seller_subtotal * (rate_pct / Decimal('100')))

    def get_seller_net_payout(self, obj):
        request = self.context.get('request')
        items = self._get_seller_items(request, obj)
        seller_subtotal = sum(item.subtotal() for item in items)
        
        d_info = obj.delivery_info or {}
        if isinstance(d_info, str):
            import json
            import ast
            try: d_info = json.loads(d_info)
            except:
                try: d_info = ast.literal_eval(d_info)
                except: d_info = {}
            
        is_pos = isinstance(d_info, dict) and d_info.get('is_pos')
        if is_pos:
            rate_pct = Decimal('5.00')
        else:
            from billing.models import get_seller_commission_rate
            rate_pct = get_seller_commission_rate(request.user) if (request and hasattr(request, 'user') and not request.user.is_anonymous) else Decimal('10.00')
            
        commission = seller_subtotal * (rate_pct / Decimal('100'))
        return float(seller_subtotal - commission)

    def get_delivery_code(self, obj):
        # Do not expose delivery verification codes once order is delivered, completed, or cancelled
        if obj.status in ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'RETURNED']:
            return None

        request = self.context.get('request')
        if request and hasattr(request, 'user') and not request.user.is_anonymous:
            # Only the buyer and staff can see the active delivery code
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

    from django.db import transaction

    def create(self, validated_data):
        promo_code_str = validated_data.pop('promo_code', None)
        # Extract items data from the source mapping
        items_data = validated_data.pop('orderitem_set', [])

        # FIX: Auto-map region to warehouse
        delivery_info = validated_data.get('delivery_info') or {}
        if isinstance(delivery_info, dict):
            buyer_region = delivery_info.get('region', '').strip()
            if buyer_region:
                try:
                    from locations.models import Region
                    from warehouses.models import Warehouse
                    region_obj = Region.objects.filter(name__iexact=buyer_region).first()
                    if region_obj:
                        wh = Warehouse.objects.filter(region=region_obj, is_active=True).first()
                        if wh:
                            delivery_info['destination_warehouse_code'] = wh.code
                            validated_data['delivery_info'] = delivery_info
                except Exception:
                    pass

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
                    
                if qty < product.minimum_order_quantity:
                    unit_disp = getattr(product, 'get_unit_of_measure_display', lambda: product.unit_of_measure)()
                    raise serializers.ValidationError(
                        f'The minimum order quantity for "{product.name}" is {product.minimum_order_quantity} {unit_disp}.'
                    )

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
                    
                    # Apply tiered pricing if applicable
                    item_price = product.price
                    tier = product.price_tiers.filter(min_quantity__lte=qty).order_by('-min_quantity').first()
                    if tier:
                        item_price = tier.unit_price

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
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    seller_rating = serializers.SerializerMethodField()  # FIX B-14
    store_images = StoreImageSerializer(many=True, read_only=True)
    is_following = serializers.SerializerMethodField()

    website = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    facebook_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    youtube_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    linkedin_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    whatsapp_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    phone_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = UserProfile
        fields = ['id', 'user', 'user_id', 'username', 'first_name', 'last_name', 'is_verified', 'phone_number', 'instagram_username',
                  'whatsapp_number', 'facebook_url', 'tiktok_username', 'twitter_username', 'youtube_url', 'linkedin_url',
                  'website', 'bio', 'tier', 'location', 'latitude', 'longitude', 'profile_picture', 'banner_image',
                  'preferred_currency', 'seller_rating', 'store_images', 'is_location_verified', 'is_following',
                  'show_product_requests']
        read_only_fields = ['user', 'is_verified', 'tier', 'is_location_verified']  # FIX: S-07 — only staff should set these

    def _normalize_url(self, value):
        if not value:
            return ''
        val = str(value).strip()
        if not val:
            return ''
        if not (val.startswith('http://') or val.startswith('https://')):
            return f'https://{val}'
        return val

    def validate_website(self, value):
        return self._normalize_url(value)

    def validate_facebook_url(self, value):
        return self._normalize_url(value)

    def validate_youtube_url(self, value):
        return self._normalize_url(value)

    def validate_linkedin_url(self, value):
        return self._normalize_url(value)

    def validate_whatsapp_number(self, value):
        if not value:
            return ''
        import re
        val = str(value).strip()
        digits = re.sub(r'[^0-9]', '', val)
        if digits:
            if digits.startswith('0') and len(digits) == 10:
                digits = f'255{digits[1:]}'
            return f'+{digits}'
        return ''

    def validate_phone_number(self, value):
        if not value:
            return ''
        import re
        val = str(value).strip()
        digits = re.sub(r'[^0-9]', '', val)
        if digits:
            if digits.startswith('0') and len(digits) == 10:
                digits = f'255{digits[1:]}'
            return f'+{digits}'
        return ''

    def get_seller_rating(self, obj):
        return obj.seller_rating  # FIX B-14

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            from .models import Follow
            return Follow.objects.filter(follower=request.user, following=obj).exists()
        return False

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        is_owner = request and request.user.is_authenticated and request.user.id == instance.user_id
        is_staff = request and request.user.is_authenticated and (request.user.is_staff or request.user.is_superuser)
        is_commercial_seller = instance.tier in ['seller_pro', 'business', 'worker']
        
        # Protect PII: mask private phone number and coordinates for non-sellers from public visitors
        if not (is_owner or is_staff or is_commercial_seller):
            data['phone_number'] = None
            data['whatsapp_number'] = None
            data['latitude'] = None
            data['longitude'] = None
        return data

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
    is_active = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()
    seconds_remaining = serializers.SerializerMethodField()

    class Meta:
        model = SponsoredListing
        fields = [
            'id', 'user', 'product', 'product_name', 'product_slug', 'product_details',
            'title', 'description', 'status', 'admin_notes', 'duration_days', 'amount',
            'transaction_reference', 'payment_proof', 'created_at', 'approved_at', 'expires_at',
            'is_active', 'days_remaining', 'seconds_remaining'
        ]
        read_only_fields = ['user', 'status', 'admin_notes', 'amount', 'created_at', 'approved_at', 'expires_at']

    def get_is_active(self, obj):
        from django.utils import timezone
        if obj.status == 'approved' and obj.expires_at:
            return obj.expires_at > timezone.now()
        return False

    def get_days_remaining(self, obj):
        from django.utils import timezone
        if obj.status == 'approved' and obj.expires_at:
            diff = obj.expires_at - timezone.now()
            return max(0, diff.days)
        return 0

    def get_seconds_remaining(self, obj):
        from django.utils import timezone
        if obj.status == 'approved' and obj.expires_at:
            diff = obj.expires_at - timezone.now()
            return max(0, int(diff.total_seconds()))
        return 0

    def validate(self, attrs):
        if self.instance and self.instance.status == 'approved':
            if 'product' in attrs and attrs['product'] != self.instance.product:
                raise serializers.ValidationError({"product": "Cannot change product for an active approved promotion."})
            if 'duration_days' in attrs and attrs['duration_days'] != self.instance.duration_days:
                raise serializers.ValidationError({"duration_days": "Cannot change duration for an active approved promotion."})
        return attrs


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
        fields = ['id', 'conversation', 'sender', 'sender_username', 'content', 'is_delivered', 'is_read', 'created_at']
        read_only_fields = ['sender', 'created_at']

    def validate_content(self, value):
        stripped = value.strip() if value else ''
        if not stripped:
            raise serializers.ValidationError("Message content cannot be empty.")
        return stripped


class ConversationSerializer(serializers.ModelSerializer):  # FIX B-12
    buyer_username = serializers.CharField(source='buyer.username', read_only=True)
    seller_username = serializers.CharField(source='seller.username', read_only=True)
    buyer_verified = serializers.BooleanField(source='buyer.profile.is_verified', read_only=True)
    buyer_tier = serializers.CharField(source='buyer.profile.tier', read_only=True)
    seller_verified = serializers.BooleanField(source='seller.profile.is_verified', read_only=True)
    seller_tier = serializers.CharField(source='seller.profile.tier', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)
    product_image = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    is_online = serializers.SerializerMethodField()
    last_seen = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ['id', 'buyer', 'buyer_username', 'seller', 'seller_username',
                  'buyer_verified', 'buyer_tier', 'seller_verified', 'seller_tier',
                  'product', 'product_name', 'product_image', 'last_message', 'unread_count',
                  'is_online', 'last_seen', 'created_at', 'updated_at']
        read_only_fields = ['buyer', 'created_at', 'updated_at']

    def _get_other_user(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        return obj.seller if request.user == obj.buyer else obj.buyer

    def get_is_online(self, obj):
        other = self._get_other_user(obj)
        if not other:
            return False
        presence_map = self.context.get('presence_map')
        if presence_map is not None and other.id in presence_map:
            return presence_map[other.id].get('is_online', False)
        from django.core.cache import cache
        return cache.get(f'user:seen:{other.id}') is not None

    def get_last_seen(self, obj):
        other = self._get_other_user(obj)
        if not other:
            return None
        presence_map = self.context.get('presence_map')
        if presence_map is not None and other.id in presence_map:
            return presence_map[other.id].get('last_seen')
        from django.core.cache import cache
        val = cache.get(f'user:seen:{other.id}')
        if val:
            return val
        if other.last_login:
            return other.last_login.isoformat()
        return None

    def get_product_image(self, obj):
        if obj.product:
            # Use prefetched images if available
            try:
                images = obj.product.images.all()
                if images:
                    return images[0].image.url
            except Exception:
                pass
        return None

    def get_last_message(self, obj):
        if hasattr(obj, 'prefetched_messages'):
            if obj.prefetched_messages:
                return MessageSerializer(obj.prefetched_messages[0]).data
            return None
        msg = obj.messages.order_by('-created_at').first()
        return MessageSerializer(msg).data if msg else None

    def get_unread_count(self, obj):
        if hasattr(obj, 'annotated_unread_count'):
            return obj.annotated_unread_count
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
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email = serializers.EmailField(write_only=True, required=False, allow_blank=True)
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    phone_number = serializers.CharField(write_only=True, required=False, allow_blank=True)
    create_user = serializers.BooleanField(write_only=True, required=False, default=False)
    
    user_details = serializers.SerializerMethodField(read_only=True)
    owner_username = serializers.CharField(source='owner.username', read_only=True)

    class Meta:
        model = TeamMember
        fields = [
            'id', 'owner', 'owner_username', 'user', 'username', 'password',
            'email', 'first_name', 'last_name', 'phone_number', 'create_user',
            'user_details', 'permissions', 'invitation_status', 'is_active',
            'role_preset', 'created_by_owner', 'contact_phone', 'notes', 'created_at'
        ]
        read_only_fields = ['id', 'owner', 'user', 'invitation_status', 'created_by_owner', 'created_at']

    def get_user_details(self, obj):
        profile = getattr(obj.user, 'profile', None)
        return {
            'id': obj.user.id,
            'username': obj.user.username,
            'email': obj.user.email,
            'first_name': obj.user.first_name,
            'last_name': obj.user.last_name,
            'phone_number': profile.phone_number if profile else obj.contact_phone,
            'tier': profile.tier if profile else 'customer',
        }

    def validate(self, attrs):
        owner = self.context['request'].user
        is_business = (
            getattr(getattr(owner, 'profile', None), 'tier', None) == 'business' or
            owner.subscriptions.filter(is_active=True, tier__tier_level='business').exists() or
            owner.is_superuser
        )
        if not is_business:
            raise serializers.ValidationError("Only users with an active Business tier subscription can assemble and manage teams.")

        # Enforce seat limit if the owner's active Business subscription defines one.
        active_sub = owner.subscriptions.filter(is_active=True, tier__tier_level='business').select_related('tier').first()
        if active_sub and active_sub.tier.max_team_members is not None:
            current_count = TeamMember.objects.filter(owner=owner, invitation_status__in=['pending', 'accepted']).count()
            if current_count >= active_sub.tier.max_team_members:
                raise serializers.ValidationError(
                    f"Your Business plan allows up to {active_sub.tier.max_team_members} team members. Remove an existing member or upgrade your plan to add more."
                )

        username = attrs.get('username')
        create_user = attrs.get('create_user') or bool(attrs.get('password'))
        from django.contrib.auth import get_user_model
        User = get_user_model()

        if create_user:
            # Direct user provisioning mode
            if User.objects.filter(username=username).exists():
                raise serializers.ValidationError({"username": f"Username '{username}' is already taken. Choose a different username or invite this user instead."})
            
            email = attrs.get('email')
            if email and User.objects.filter(email=email).exists():
                raise serializers.ValidationError({"email": f"An account with email '{email}' already exists."})

            password = attrs.get('password')
            if not password:
                raise serializers.ValidationError({"password": "A password is required when creating a new team member account."})

            from django.contrib.auth.password_validation import validate_password
            try:
                validate_password(password)
            except Exception as e:
                err_msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
                raise serializers.ValidationError({"password": err_msg})
        else:
            # Invite existing user mode
            try:
                existing_user = User.objects.get(username=username)
                if existing_user == owner:
                    raise serializers.ValidationError({"username": "You cannot invite yourself to your own team."})
                if TeamMember.objects.filter(owner=owner, user=existing_user).exists():
                    raise serializers.ValidationError({"username": "This user is already a member of your team."})
                attrs['_existing_user'] = existing_user
            except User.DoesNotExist:
                raise serializers.ValidationError({"username": f"User '{username}' does not exist. Check 'Create User' to provision a brand new account for this member."})

        return attrs

    def create(self, validated_data):
        owner = self.context['request'].user
        username = validated_data.pop('username')
        password = validated_data.pop('password', None)
        email = validated_data.pop('email', '')
        first_name = validated_data.pop('first_name', '')
        last_name = validated_data.pop('last_name', '')
        phone_number = validated_data.pop('phone_number', '')
        create_user = validated_data.pop('create_user', False) or bool(password)
        existing_user = validated_data.pop('_existing_user', None)

        permissions = validated_data.get('permissions', {})
        if not isinstance(permissions, dict):
            permissions = {}
        role_preset = validated_data.get('role_preset', 'custom')
        contact_phone = validated_data.get('contact_phone') or phone_number
        notes = validated_data.get('notes', '')

        from django.contrib.auth import get_user_model
        from .models import push_notification, TeamMemberAuditLog
        User = get_user_model()

        if create_user:
            # Provision brand new user directly
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name
            )
            profile = getattr(user, 'profile', None)
            if profile:
                profile.tier = 'worker'
                profile.terms_accepted = True
                if phone_number:
                    profile.phone_number = phone_number
                profile.save()

            member = TeamMember.objects.create(
                owner=owner,
                user=user,
                permissions=permissions,
                invitation_status='accepted',
                is_active=True,
                role_preset=role_preset,
                created_by_owner=True,
                contact_phone=contact_phone,
                notes=notes
            )

            TeamMemberAuditLog.objects.create(
                owner=owner,
                target_user=user,
                performed_by=owner,
                action='user_created',
                detail={'permissions': permissions, 'role_preset': role_preset, 'created_by_owner': True}
            )
            return member
        else:
            # Invite existing user
            user = existing_user
            member = TeamMember.objects.create(
                owner=owner,
                user=user,
                permissions=permissions,
                invitation_status='pending',
                is_active=True,
                role_preset=role_preset,
                created_by_owner=False,
                contact_phone=contact_phone,
                notes=notes
            )

            try:
                push_notification(
                    user, 'order_status', 'Team invitation',
                    f'{owner.username} has invited you to join their business team ({role_preset.replace("_", " ").title()}). Review and accept in your account settings.',
                    '/dashboard/team-invitations'
                )
            except Exception:
                pass

            TeamMemberAuditLog.objects.create(
                owner=owner,
                target_user=user,
                performed_by=owner,
                action='invited',
                detail={'permissions': permissions, 'role_preset': role_preset}
            )
            return member


class TeamMemberPasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, required=True)
    confirm_password = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        new_pw = attrs.get('new_password')
        confirm_pw = attrs.get('confirm_password')
        if new_pw != confirm_pw:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})

        from django.contrib.auth.password_validation import validate_password
        try:
            validate_password(new_pw)
        except Exception as e:
            err_msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            raise serializers.ValidationError({'new_password': err_msg})

        return attrs


class TeamMemberTransferSerializer(serializers.Serializer):
    target_username = serializers.CharField(write_only=True, required=True)

    def validate_target_username(self, value):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            target = User.objects.get(username=value)
            return target
        except User.DoesNotExist:
            raise serializers.ValidationError(f"Target user '{value}' does not exist.")


class TeamMemberAuditLogSerializer(serializers.ModelSerializer):
    target_username = serializers.CharField(source='target_user.username', read_only=True)
    performed_by_username = serializers.CharField(source='performed_by.username', read_only=True, default='System')

    class Meta:
        model = TeamMemberAuditLog
        fields = ['id', 'owner', 'target_user', 'target_username', 'performed_by', 'performed_by_username', 'action', 'detail', 'created_at']
        read_only_fields = ['id', 'owner', 'target_user', 'performed_by', 'created_at']

class VehicleMakeSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleMake
        fields = ['id', 'name', 'slug']

class VehicleModelSerializer(serializers.ModelSerializer):
    make_name = serializers.CharField(source='make.name', read_only=True)
    class Meta:
        model = VehicleModel
        fields = ['id', 'make', 'make_name', 'name', 'slug']

class VehicleSerializer(serializers.ModelSerializer):
    make_name = serializers.CharField(source='make.name', read_only=True)
    model_name = serializers.CharField(source='model.name', read_only=True)
    class Meta:
        model = Vehicle
        fields = [
            'id', 'make', 'make_name', 'model', 'model_name', 'year',
            'trim', 'engine', 'drivetrain', 'transmission', 'body_style',
            'region', 'created_at'
        ]
