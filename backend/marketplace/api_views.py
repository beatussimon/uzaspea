import json
from decimal import Decimal
from rest_framework import viewsets, permissions, status, decorators, serializers as drf_serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from django.db.models import Q, Sum, Count, Avg, F
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers
from django.db import models as django_models
from .models import (
    Product, Category, Review, ProductComment, Order, OrderItem, 
    Payment, TrackingEvent, UserProfile, Like, ProductImage,
    Notification, Conversation, Message, SavedSearch, PriceAlert,
    Dispute, DeliveryZone, SiteSettings, push_notification, ProductVariant,
    MobileNetwork, VehicleMake, VehicleModel, Vehicle, ProductVehicleFitment,
    Brand, ReferenceProduct
)
from .serializers import (
    ProductSerializer, CategorySerializer, ProductReviewSerializer, 
    ProductCommentSerializer, OrderSerializer, PaymentSerializer, UserProfileSerializer,
    NotificationSerializer, ConversationSerializer, MessageSerializer,
    SavedSearchSerializer, PriceAlertSerializer, DisputeSerializer,
    SiteSettingsSerializer, DeliveryZoneSerializer, ProductVariantSerializer,
    MobileNetworkSerializer, VehicleMakeSerializer, VehicleModelSerializer, VehicleSerializer,
    BrandSerializer, ReferenceProductSerializer
)

from uzachuo.permissions import IsOwnerOrStaff, IsStaffMember, IsSellerOrAbove, has_staff_permission
from django.db.models import Prefetch
from django.db import transaction


# FIX D-07: Rate limiting throttle classes
class RegisterRateThrottle(AnonRateThrottle):
    scope = 'register'

class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'

class OrderCreateThrottle(UserRateThrottle):
    scope = 'order_create'

class TicketAnonRateThrottle(AnonRateThrottle):
    scope = 'ticket'
    rate = '10/hour'

class TicketUserRateThrottle(UserRateThrottle):
    scope = 'ticket'
    rate = '30/hour'

class GeocodeAnonRateThrottle(AnonRateThrottle):
    rate = '20/minute'

class GeocodeUserRateThrottle(UserRateThrottle):
    rate = '100/minute'

from rest_framework.decorators import api_view, permission_classes, throttle_classes, authentication_classes
import requests

@api_view(['GET'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
@throttle_classes([GeocodeAnonRateThrottle, GeocodeUserRateThrottle])
def reverse_geocode(request):
    """
    Phase 3: Spatial Awareness - Geospatial Proxy
    Proxies requests to OpenStreetMap Nominatim to securely convert 
    coordinates to an address without exposing client API logic.
    """
    lat = request.query_params.get('lat')
    lng = request.query_params.get('lng')
    
    if not lat or not lng:
        return Response({'error': 'lat and lng parameters are required'}, status=400)
        
    try:
        lat_val = float(lat)
        lng_val = float(lng)
        if not (-90.0 <= lat_val <= 90.0) or not (-180.0 <= lng_val <= 180.0):
            return Response({'error': 'Coordinates must be valid float values within correct range (-90 to 90 for latitude, -180 to 180 for longitude).'}, status=400)
    except (ValueError, TypeError):
        return Response({'error': 'lat and lng parameters must be valid decimal values'}, status=400)
        
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat_val}&lon={lng_val}&zoom=18&addressdetails=1"
        # Nominatim requires a valid user-agent
        headers = {'User-Agent': 'SokoniMax/1.0 (https://sokonimax.co.tz)'}
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        
        data = response.json()
        address = data.get('address', {})
        
        # Build a clean readable address
        city = address.get('city') or address.get('town') or address.get('village') or ''
        road = address.get('road') or ''
        suburb = address.get('suburb') or ''
        
        components = [c for c in [road, suburb, city] if c]
        display_name = ", ".join(components) if components else data.get('display_name', 'Unknown Location')
        
        return Response({
            'address': display_name,
            'raw': address
        })
    except requests.RequestException as e:
        return Response({'error': str(e)}, status=503)

@method_decorator(vary_on_headers('Authorization', 'Cookie'), name='list')
class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().prefetch_related('images', 'likes', 'fitments')
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def get_permissions(self):
        if self.action == 'create':
            return [permissions.IsAuthenticated(), IsSellerOrAbove()]
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsOwnerOrStaff()]
        return super().get_permissions()
    lookup_field = 'slug'

    def get_queryset(self):
        from django.db.models import Avg, Count, Exists, OuterRef, Subquery, Value, BooleanField, IntegerField
        from marketplace.models import Like
        from inspections.models import InspectionRequest, InspectionReport

        user = self.request.user
        
        is_liked_expr = Exists(Like.objects.filter(product=OuterRef('pk'), user=user)) if user.is_authenticated else Value(False, output_field=BooleanField())
        has_inspection_expr = Exists(InspectionRequest.objects.filter(marketplace_product=OuterRef('pk'), status='published'))
        inspection_verdict_expr = Subquery(
            InspectionReport.objects.filter(
                request__marketplace_product=OuterRef('pk'), 
                request__status='published'
            ).values('verdict')[:1]
        )
        is_verified_expr = Exists(
            InspectionRequest.objects.filter(
                marketplace_product=OuterRef('pk'), 
                status='published', 
                report__verdict='pass'
            )
        )

        from django.utils import timezone
        from django.db.models import Q
        from marketplace.models import SponsoredListing
        is_sponsored_expr = Exists(
            SponsoredListing.objects.filter(
                Q(expires_at__gt=timezone.now()) | Q(expires_at__isnull=True),
                product=OuterRef('pk'), 
                status='approved'
            )
        )

        from django.db.models.functions import Coalesce
        from marketplace.models import Review
        
        avg_rating_subquery = Subquery(
            Review.objects.filter(product=OuterRef('pk'))
            .values('product')
            .annotate(avg=Avg('rating'))
            .values('avg')[:1]
        )
        
        like_count_subquery = Subquery(
            Like.objects.filter(product=OuterRef('pk'))
            .values('product')
            .annotate(cnt=Count('id'))
            .values('cnt')[:1]
        )

        # Base queryset with annotations
        base = Product.objects.annotate(
            annotated_avg_rating=avg_rating_subquery,
            annotated_like_count=Coalesce(like_count_subquery, Value(0)),
            annotated_is_liked=is_liked_expr,
            annotated_has_inspection=has_inspection_expr,
            annotated_inspection_verdict=inspection_verdict_expr,
            annotated_is_verified=is_verified_expr,
            annotated_is_sponsored=is_sponsored_expr
        ).select_related(
            'seller', 'seller__profile', 'category', 'category__parent',
            'brand', 'brand__created_by',
            'reference_product', 'reference_product__brand', 'reference_product__category', 'reference_product__created_by'
        ).prefetch_related(
            'images', 'inspections', 'inspections__report', 'fitments', 'price_tiers'
        )
        
        # FIX: Ensure detail actions (delete/edit) don't get blocked by list filters
        if getattr(self, 'detail', False) or self.action in ['retrieve', 'update', 'partial_update', 'destroy']:
            return base

        user = self.request.user
        category_slug = self.request.query_params.get('subcategory') or self.request.query_params.get('category', None)
        query = self.request.query_params.get('q', None)
        min_price = self.request.query_params.get('min_price', None)
        max_price = self.request.query_params.get('max_price', None)
        condition = self.request.query_params.get('condition', None)
        sort_by = self.request.query_params.get('sort_by', None)
        seller_param = self.request.query_params.get('seller', None)
        lat = self.request.query_params.get('lat', None)
        lng = self.request.query_params.get('lng', None)
        radius = self.request.query_params.get('radius', None)

        # Seller query parameter (e.g. Profile page or seller store filtering)
        if seller_param:
            queryset = base.filter(seller__username__iexact=seller_param)
            is_draft_param = self.request.query_params.get('is_draft')
            include_unlisted = self.request.query_params.get('include_unlisted') == 'true'
            is_seller_self = user.is_authenticated and (user.username.lower() == str(seller_param).lower() or user.is_staff or user.is_superuser)
            if is_seller_self and is_draft_param == 'true':
                queryset = queryset.filter(is_draft=True)
            elif is_seller_self and is_draft_param == 'false':
                queryset = queryset.filter(is_draft=False)
            elif is_seller_self and include_unlisted:
                pass
            else:
                queryset = queryset.filter(is_available=True, stock__gt=0, is_draft=False)
        elif user.is_authenticated and self.request.query_params.get('mine') == 'true':
            from uzachuo.permissions import get_effective_sellers
            sellers = get_effective_sellers(user, required_permission='manage_products')
            queryset = base.filter(seller_id__in=sellers)
            is_draft_param = self.request.query_params.get('is_draft')
            if is_draft_param == 'true':
                queryset = queryset.filter(is_draft=True)
            elif is_draft_param == 'false':
                queryset = queryset.filter(is_draft=False)
        elif self.request.query_params.get('following') and user.is_authenticated:
            from .models import Follow
            followed = Follow.objects.filter(follower=user).values_list('following__user_id', flat=True)
            queryset = base.filter(seller_id__in=followed, is_available=True, stock__gt=0, is_draft=False)
        elif user.is_authenticated and (user.is_staff or user.is_superuser) and (self.request.query_params.get('all') == 'true' or self.request.query_params.get('moderation') == 'true'):
            queryset = base.all()
        else:
            # Public list only shows available and in-stock published products for general browsing
            queryset = base.filter(is_available=True, stock__gt=0, is_draft=False)
            
        if self.request.query_params.get('saved') == 'true':
            if user.is_authenticated:
                queryset = queryset.filter(likes__user=user)
                saved_time = self.request.query_params.get('saved_time')
                if saved_time:
                    from datetime import timedelta
                    from django.utils import timezone
                    if saved_time == '24h':
                        queryset = queryset.filter(likes__created_at__gte=timezone.now() - timedelta(days=1))
                    elif saved_time == '7d':
                        queryset = queryset.filter(likes__created_at__gte=timezone.now() - timedelta(days=7))
                    elif saved_time == '30d':
                        queryset = queryset.filter(likes__created_at__gte=timezone.now() - timedelta(days=30))
            else:
                return queryset.none()

        if category_slug:
            from .models import Category
            try:
                cat = Category.objects.get(slug=category_slug)
                descendants = cat.get_descendants(include_self=True)
                queryset = queryset.filter(category__in=descendants)
            except Category.DoesNotExist:
                queryset = queryset.filter(category__slug=category_slug)

        brand_slug = self.request.query_params.get('brand', None)
        if brand_slug:
            queryset = queryset.filter(Q(brand__slug=brand_slug) | Q(brand__name__iexact=brand_slug))
            
        ref_slug = self.request.query_params.get('reference_product', None)
        if ref_slug:
            queryset = queryset.filter(reference_product__slug=ref_slug)

        # Dynamic Spec Filtering
        reserved_params = {
            'category', 'subcategory', 'q', 'min_price', 'max_price', 'condition', 'sort_by', 
            'seller', 'lat', 'lng', 'radius', 'brand', 'reference_product', 
            'mine', 'following', 'saved', 'saved_time', 'view', 'page', 'page_size',
            'limit', 'offset', 'cursor', 'ordering', 'format', 'search', 'vehicle_id',
            'make_id', 'model_id', 'year', 'oem_part_number', 'highlight', 't', '_', 'expand'
        }
        for key, value in self.request.query_params.items():
            if key not in reserved_params and value and not key.startswith('_'):
                queryset = queryset.filter(
                    Q(**{f"structured_specs__{key}__iexact": value}) | 
                    Q(**{f"specifications__{key}__iexact": value}) |
                    Q(**{f"structured_specs__{key}": value}) | 
                    Q(**{f"specifications__{key}": value})
                )

        if query:
            from django.db import connection
            if connection.vendor == 'postgresql':
                from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
                search_vector = SearchVector('name', weight='A') + SearchVector('sku', weight='A') + SearchVector('description', weight='B') + SearchVector('category__name', weight='C') + SearchVector('brand__name', weight='C')
                search_query = SearchQuery(query, search_type='websearch')
                queryset = queryset.annotate(
                    search_rank=SearchRank(search_vector, search_query)
                ).filter(
                    Q(search_rank__gte=0.01) |
                    Q(name__icontains=query) | Q(description__icontains=query) | Q(sku__icontains=query) | Q(brand__name__icontains=query)
                ).order_by('-search_rank')
            else:
                queryset = queryset.filter(
                    Q(name__icontains=query) | 
                    Q(description__icontains=query) |
                    Q(category__name__icontains=query) |
                    Q(sku__icontains=query) |
                    Q(brand__name__icontains=query)
                )
        if min_price:
            try:
                queryset = queryset.filter(price__gte=float(min_price))
            except ValueError:
                pass
        if max_price:
            try:
                queryset = queryset.filter(price__lte=float(max_price))
            except ValueError:
                pass
        if condition:
            cond_lower = condition.strip().lower()
            if cond_lower.startswith('new'):
                queryset = queryset.filter(condition__iexact='New')
            elif cond_lower.startswith('used'):
                queryset = queryset.filter(condition__iexact='Used')
            else:
                queryset = queryset.filter(Q(condition__iexact=condition) | Q(condition__icontains=condition))

        # Vehicle Fitment & Specifications Filter
        vehicle_id = self.request.query_params.get('vehicle_id')
        make_id = self.request.query_params.get('make_id')
        model_id = self.request.query_params.get('model_id')
        year = self.request.query_params.get('year')

        if vehicle_id:
            queryset = queryset.filter(fitments__vehicle_id=vehicle_id).distinct()
        elif model_id:
            if year:
                queryset = queryset.filter(fitments__vehicle__model_id=model_id, fitments__vehicle__year=year).distinct()
            else:
                queryset = queryset.filter(fitments__vehicle__model_id=model_id).distinct()
        elif make_id:
            queryset = queryset.filter(fitments__vehicle__make_id=make_id).distinct()
            
        oem_part_number = self.request.query_params.get('oem_part_number')
        if oem_part_number:
            # PostgreSQL specific JSONB query for partial or exact match
            queryset = queryset.filter(specifications__oem_part_number__iexact=oem_part_number)


        # Phase 3: Spatial Awareness - Haversine Proximity Sorting
        if lat and lng:
            try:
                lat_f = float(lat)
                lng_f = float(lng)
                from django.db.models.functions import Cos, Sin, ACos, Radians
                from django.db.models import F, ExpressionWrapper, FloatField

                queryset = queryset.filter(
                    seller__profile__latitude__isnull=False, 
                    seller__profile__longitude__isnull=False
                )
                
                d_lat = Radians(F('seller__profile__latitude'))
                d_lng = Radians(F('seller__profile__longitude'))
                r_lat = Radians(lat_f)
                r_lng = Radians(lng_f)
                
                distance_expr = ExpressionWrapper(
                    6371 * ACos(
                        Cos(r_lat) * Cos(d_lat) * Cos(d_lng - r_lng) +
                        Sin(r_lat) * Sin(d_lat)
                    ),
                    output_field=FloatField()
                )
                queryset = queryset.annotate(distance=distance_expr)
                
                if radius:
                    queryset = queryset.filter(distance__lte=float(radius))
                
                # Override default sort if proximity is requested
                if not sort_by:
                    return queryset.order_by('distance')
                    
            except (ValueError, TypeError):
                pass

        if sort_by == 'price_asc':
            return queryset.order_by('price')
        elif sort_by == 'price_desc':
            return queryset.order_by('-price')
        elif sort_by == 'rating':
            return queryset.annotate(avg=Avg('reviews__rating')).order_by('-avg')
        elif sort_by == 'popular':
            return queryset.annotate(sales=Count('orderitem')).order_by('-sales', '-created_at')
        elif sort_by == 'most_saved':
            return queryset.annotate(saves=Count('likes')).order_by('-saves', '-created_at')
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        seller = user
        from marketplace.models import TeamMember
        team_memberships = TeamMember.objects.filter(user=user)
        if team_memberships.exists():
            requested_seller_id = self.request.data.get('seller')
            if requested_seller_id:
                try:
                    membership = team_memberships.get(owner_id=requested_seller_id)
                    from django.contrib.auth import get_user_model
                    seller = get_user_model().objects.get(id=requested_seller_id)
                except Exception:
                    for membership in team_memberships:
                        if membership.permissions.get('manage_products', False):
                            seller = membership.owner
                            break
            else:
                for membership in team_memberships:
                    if membership.permissions.get('manage_products', False):
                        seller = membership.owner
                        break
        
        product = serializer.save(seller=seller)
        images = self.request.FILES.getlist('uploaded_images')
        for img in images:
            ProductImage.objects.create(product=product, image=img)
            
        fulfill_request_id = self.request.data.get('fulfill_request_id')
        if fulfill_request_id:
            from marketplace.models import ProductRequest, push_notification
            try:
                pr = ProductRequest.objects.get(id=fulfill_request_id, seller=seller)
                pr.is_fulfilled = True
                pr.fulfilled_product = product
                pr.save(update_fields=['is_fulfilled', 'fulfilled_product'])

                # Notify requester and all voters that the requested product is in stock!
                recipient_ids = set()
                if pr.user_id:
                    recipient_ids.add(pr.user_id)
                for vote in pr.votes.all():
                    recipient_ids.add(vote.user_id)

                for uid in recipient_ids:
                    recipient_user = User.objects.filter(id=uid).first()
                    if recipient_user:
                        push_notification(
                            user=recipient_user,
                            notification_type='order',
                            title="Requested Item Now in Stock!",
                            message=f"Good news! '{pr.name}' requested from @{seller.username} is now available.",
                            link=f"/products/{product.slug}"
                        )
            except ProductRequest.DoesNotExist:
                pass

    def perform_update(self, serializer):
        product = serializer.save()
        images = self.request.FILES.getlist('uploaded_images')
        if images:
            # Optionally clear existing images if it's a full replacement, 
            # but for now we'll just add new ones as per common MVP patterns
            for img in images:
                ProductImage.objects.create(product=product, image=img)

    @decorators.action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsSellerOrAbove])
    def batch_upload(self, request):
        import csv
        import io
        from decimal import Decimal
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded'}, status=400)
            
        try:
            # Check if it's a team operation
            seller = request.user
            from marketplace.models import TeamMember, Category
            team_memberships = TeamMember.objects.filter(user=request.user)
            if team_memberships.exists():
                for membership in team_memberships:
                    if membership.permissions.get('manage_products', False):
                        seller = membership.owner
                        break

            decoded_file = file_obj.read().decode('utf-8')
            io_string = io.StringIO(decoded_file)
            reader = csv.DictReader(io_string)
            
            created_count = 0
            for row in reader:
                # Expected columns: Name, Description, Price, Stock, Category ID, SKU, Condition
                category_id = row.get('Category ID') or row.get('category_id')
                if not category_id:
                    continue
                try:
                    category = Category.objects.get(id=category_id)
                except Category.DoesNotExist:
                    continue
                
                requires_quote_raw = str(row.get('Requires Quote') or row.get('requires_quote', 'False')).lower().strip()
                requires_quote = requires_quote_raw in ['true', '1', 'yes', 'y']
                
                Product.objects.create(
                    name=row.get('Name') or row.get('name', 'Untitled'),
                    description=row.get('Description') or row.get('description', ''),
                    price=Decimal(row.get('Price') or row.get('price', '0.00')),
                    stock=Decimal(row.get('Stock') or row.get('stock', '0.00')),
                    sku=row.get('SKU') or row.get('sku', ''),
                    condition=row.get('Condition') or row.get('condition', 'New'),
                    category=category,
                    seller=seller,
                    requires_quote=requires_quote,
                    is_available=True
                )
                created_count += 1
                
            return Response({'message': f'Successfully imported {created_count} products.'})
        except Exception as e:
            return Response({'error': f'Failed to process file: {str(e)}'}, status=400)

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def like(self, request, slug=None):
        product = self.get_object()
        like, created = Like.objects.get_or_create(user=request.user, product=product)
        if not created:
            like.delete()
            liked = False
        else:
            liked = True
        return Response({'liked': liked, 'like_count': product.likes.count()})

    @decorators.action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def seller_stats(self, request):
        from django.utils import timezone
        import datetime
        user = request.user
        from uzachuo.permissions import get_effective_sellers
        sellers = get_effective_sellers(user, required_permission='view_analytics')
        
        from marketplace.models import TeamMember
        membership = TeamMember.objects.filter(user=user, invitation_status='accepted', is_active=True).first()
        if membership:
            if membership.owner.id not in sellers:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You do not have permission to view analytics for this team.")
            stats_user = membership.owner
        else:
            stats_user = user

        is_business = stats_user.profile.tier == 'business' or stats_user.subscriptions.filter(is_active=True, tier__tier_level='business').exists()

        products = Product.objects.filter(seller=stats_user)
        orders = Order.objects.filter(orderitem_set__product__seller=stats_user).distinct()
        today = timezone.now().date()

        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        
        filter_start_date = None
        filter_end_date = None
        
        if start_date_str:
            try:
                filter_start_date = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
                orders = orders.filter(order_date__date__gte=filter_start_date)
            except ValueError:
                pass
                
        if end_date_str:
            try:
                filter_end_date = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()
                orders = orders.filter(order_date__date__lte=filter_end_date)
            except ValueError:
                pass

        # Basic aggregate metrics (always visible to sellers)
        PAID_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']
        paid_orders = orders.filter(status__in=PAID_STATUSES)
        total_orders_count = paid_orders.count()
        total_revenue = float(paid_orders.aggregate(total=Sum('total_amount'))['total'] or 0)
        avg_order = round(total_revenue / total_orders_count, 2) if total_orders_count else 0
        total_reviews = Review.objects.filter(product__seller=stats_user).count()
        avg_rating = float(products.aggregate(avg=Avg('reviews__rating'))['avg'] or 0)

        # Advanced analytics (Only for Business tier)
        revenue_pipeline = []
        trend_pct = 0.0
        top_products = []
        category_breakdown = []
        commission_paid = 0.0

        # --- Commission Paid --- (Always visible for all sellers)
        from billing.models import MonthlyInvoice
        commission_paid = float(MonthlyInvoice.objects.filter(
            seller=stats_user,
            status='PAID'
        ).aggregate(total=Sum('total_commission'))['total'] or 0)

        items_sold_list = []

        if is_business:
            # Determine pipeline date range
            pipe_start = filter_start_date if filter_start_date else (today - datetime.timedelta(days=6))
            pipe_end = filter_end_date if filter_end_date else today
            
            # --- Revenue pipeline ---
            from django.db.models.functions import TruncDate
            
            # Filter OrderItem by the already filtered orders to ensure consistency
            base_order_items = OrderItem.objects.filter(
                product__seller=stats_user, 
                order__in=paid_orders
            )
            
            pipeline_items = base_order_items.annotate(
                order_date_day=TruncDate('order__order_date')
            ).values('order_date_day').annotate(
                rev=Sum(django_models.F('price') * django_models.F('quantity')), count=Count('order', distinct=True)
            ).order_by('order_date_day')
            
            pipeline_map = {item['order_date_day']: item for item in pipeline_items}
            
            # Generate days between pipe_start and pipe_end
            delta = (pipe_end - pipe_start).days
            # Cap at 90 days for safety if user selects massive range
            if delta > 90:
                pipe_start = pipe_end - datetime.timedelta(days=90)
                delta = 90
            elif delta < 0:
                delta = 0
                
            total_current_period = 0
            for i in range(delta + 1):
                date = pipe_start + datetime.timedelta(days=i)
                entry = pipeline_map.get(date, {'rev': 0, 'count': 0})
                day_rev = float(entry['rev'] or 0)
                total_current_period += day_rev
                revenue_pipeline.append({
                    'date': date.strftime('%b %d') if delta > 7 else date.strftime('%a'), 
                    'revenue': day_rev, 
                    'orders': entry['count']
                })

            # --- Trend (compare to previous period of same length) ---
            prev_end = pipe_start - datetime.timedelta(days=1)
            prev_start = prev_end - datetime.timedelta(days=delta)
            
            prev_period_rev = float(OrderItem.objects.filter(
                product__seller=stats_user,
                order__status__in=PAID_STATUSES,
                order__order_date__date__gte=prev_start,
                order__order_date__date__lte=prev_end,
            ).aggregate(t=Sum(django_models.F('price') * django_models.F('quantity')))['t'] or 0)
            
            trend_pct = round(((total_current_period - prev_period_rev) / prev_period_rev * 100) if prev_period_rev else 0, 1)

            # --- Top 5 products by order count ---
            top_prods = (
                base_order_items
                .values('product__name', 'product__slug')
                .annotate(sold=Count('id'), rev=Sum(django_models.F('price') * django_models.F('quantity')))
                .order_by('-sold')[:5]
            )
            top_products = [{'name': t['product__name'], 'slug': t['product__slug'], 'sold': t['sold'], 'revenue': float(t['rev'] or 0)} for t in top_prods]

            # --- Category breakdown ---
            cat_data = (
                base_order_items
                .values('product__category__name')
                .annotate(rev=Sum(django_models.F('price') * django_models.F('quantity')), count=Count('id'))
                .order_by('-rev')[:8]
            )
            category_breakdown = [{'category': c['product__category__name'] or 'Other', 'revenue': float(c['rev'] or 0), 'items': c['count']} for c in cat_data]

            # --- Items Sold List ---
            items_sold_qs = base_order_items.select_related('product', 'order').order_by('-order__order_date')[:100]
            for item in items_sold_qs:
                items_sold_list.append({
                    'id': item.id,
                    'date': item.order.order_date.isoformat(),
                    'product_name': item.product.name,
                    'quantity': item.quantity,
                    'price': float(item.price),
                    'buying_price': float(item.product.buying_price) if item.product.buying_price is not None else None,
                    'total': float(item.price * item.quantity),
                    'status': item.order.status
                })

        # --- Stock alerts (stock <= 3) --- always visible
        low_stock = list(products.filter(stock__lte=3).values('name', 'slug', 'stock', 'price')[:10])
        for ls in low_stock:
            ls['price'] = float(ls['price'])

        # --- Order status breakdown --- always visible
        status_counts = {}
        for s in ['CART','CHECKOUT','AWAITING_PAYMENT','PENDING_VERIFICATION','PAID','PROCESSING','SHIPPED','DELIVERED','COMPLETED','CANCELLED']:
            c = orders.filter(status=s).count()
            if c:
                status_counts[s] = c

        from billing.models import get_seller_commission_rate
        commission_rate_val = float(get_seller_commission_rate(stats_user))
        
        # --- Store Profile details ---
        store_profile = {}
        try:
            profile = stats_user.profile
            store_name = stats_user.get_full_name()
            seller_app = stats_user.seller_applications.filter(status='approved').last()
            if seller_app and seller_app.business_name:
                store_name = seller_app.business_name
            elif not store_name:
                store_name = stats_user.username

            store_profile = {
                'store_name': store_name,
                'phone': profile.phone_number,
                'location': profile.location,
                'instagram': profile.instagram_username,
                'website': profile.website,
            }
        except Exception:
            pass

        return Response({
            'total_products': products.count(),
            'total_orders': total_orders_count,
            'total_revenue': total_revenue,
            'avg_order_value': avg_order,
            'avg_rating': round(avg_rating, 1),
            'total_reviews': total_reviews,
            'revenue_trend_pct': trend_pct,
            'revenue_data': revenue_pipeline,
            'orders_by_status': status_counts,
            'top_products': top_products,
            'category_breakdown': category_breakdown,
            'items_sold_list': items_sold_list,
            'stock_alerts': low_stock,
            'has_advanced_analytics': is_business,
            'commission_paid': commission_paid,
            'commission_rate': commission_rate_val,
            'store_profile': store_profile,
        })

from .models import LipaNumber, FAQ, SupportTicket
from .serializers import LipaNumberSerializer, FAQSerializer, SupportTicketSerializer

class LipaNumberViewSet(viewsets.ModelViewSet):
    """FIX X-01: per-seller Lipa numbers — sellers manage their own, buyers read by seller username."""
    serializer_class = LipaNumberSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        # Mutations must strictly operate on own LipaNumbers or all for staff
        if self.action in ['update', 'partial_update', 'destroy']:
            if self.request.user.is_staff or self.request.user.is_superuser:
                return LipaNumber.objects.all().select_related('network')
            return LipaNumber.objects.filter(seller=self.request.user, is_system=False).select_related('network')

        is_system_query = self.request.query_params.get('is_system') or self.request.query_params.get('system')
        seller_username = self.request.query_params.get('seller')
        purpose = self.request.query_params.get('purpose')
        
        if is_system_query in ('true', '1', 'True'):
            qs = LipaNumber.objects.filter(is_system=True, is_active=True).select_related('network')
            if purpose:
                qs = qs.filter(purpose=purpose)
            return qs

        if seller_username:
            qs = LipaNumber.objects.filter(
                seller__username=seller_username, is_system=False, is_active=True
            ).select_related('network')
            if purpose:
                qs = qs.filter(purpose=purpose)
            return qs
            
        if self.request.user.is_authenticated:
            from uzachuo.permissions import get_effective_sellers
            sellers = get_effective_sellers(self.request.user, required_permission='manage_payment_numbers')
            return LipaNumber.objects.filter(seller_id__in=sellers, is_system=False).select_related('network')
        return LipaNumber.objects.none()

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.IsAuthenticated(), IsSellerOrAbove()]
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsOwnerOrStaff()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        # Admin UI will pass is_system in request data. We must manually set it because it's read_only in serializer
        is_system_flag = self.request.data.get('is_system', False)
        if str(is_system_flag).lower() == 'true' and self.request.user.is_superuser:
            serializer.save(seller=self.request.user, is_system=True)
        else:
            from uzachuo.permissions import get_effective_sellers
            sellers = get_effective_sellers(self.request.user, required_permission='manage_payment_numbers', include_self=False)
            seller_to_use = self.request.user
            if sellers and (not self.request.user.profile or self.request.user.profile.tier in ['customer', 'worker']):
                from django.contrib.auth import get_user_model
                seller_to_use = get_user_model().objects.get(id=sellers[0])
            serializer.save(seller=seller_to_use, is_system=False)

@method_decorator(cache_page(60 * 60 * 24), name='dispatch')
class FAQViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FAQSerializer
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    def get_queryset(self):
        qs = FAQ.objects.filter(is_published=True)
        cat = self.request.query_params.get('category')
        if cat: qs = qs.filter(category=cat)
        q = self.request.query_params.get('q')
        if q: qs = qs.filter(Q(question__icontains=q) | Q(answer__icontains=q))
        return qs

class SupportTicketViewSet(viewsets.ModelViewSet):
    serializer_class = SupportTicketSerializer
    def get_permissions(self):
        if self.action == 'create':
            return [permissions.AllowAny()]
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsStaffMember()]
    def get_throttles(self):  # FIX D-07
        if self.action == 'create':
            return [TicketAnonRateThrottle(), TicketUserRateThrottle()]
        return super().get_throttles()
    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            qs = SupportTicket.objects.all().order_by('-created_at')
            status_filter = self.request.query_params.get('status')
            if status_filter:
                qs = qs.filter(status=status_filter)
            return qs
        return SupportTicket.objects.filter(user=user).order_by('-created_at')
    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)
        
    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def reply(self, request, pk=None):
        ticket = self.get_object()
        body = request.data.get('message')
        if not body:
            return Response({'error': 'message is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        from .models import TicketMessage
        TicketMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            sender_name=request.user.first_name or request.user.username,
            body=body,
            is_internal=False
        )
        return Response({'status': 'Message added to ticket'})

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        from django.db.models import Count, Prefetch, Sum, Q, DecimalField, IntegerField, Subquery, OuterRef
        from django.db.models.functions import Coalesce
        from decimal import Decimal
        from marketplace.models import OrderItem, Like

        # Subquery for total sales in a category
        sales_sq = OrderItem.objects.filter(
            product__category=OuterRef('pk'),
            order__status__in=['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED']
        ).values('product__category').annotate(
            total=Sum('quantity')
        ).values('total')

        # Subquery for total saves in a category
        saves_sq = Like.objects.filter(
            product__category=OuterRef('pk')
        ).values('product__category').annotate(
            total=Count('id')
        ).values('total')

        active_product_filter = Q(products__is_available=True, products__stock__gt=0)

        children_qs_lvl2 = Category.objects.annotate(
            annotated_product_count=Count('products', filter=active_product_filter, distinct=True)
        )
        children_qs_lvl1 = Category.objects.annotate(
            annotated_product_count=Count('products', filter=active_product_filter, distinct=True)
        ).prefetch_related(
            Prefetch('children', queryset=children_qs_lvl2)
        )
        
        return Category.objects.filter(parent__isnull=True).annotate(
            annotated_product_count=Count('products', filter=active_product_filter, distinct=True),
            total_sales=Coalesce(Subquery(sales_sq, output_field=DecimalField()), Decimal('0.0')),
            total_saves=Coalesce(Subquery(saves_sq, output_field=IntegerField()), 0)
        ).prefetch_related(
            Prefetch('children', queryset=children_qs_lvl1)
        ).order_by('name')

    def list(self, request, *args, **kwargs):
        from django.core.cache import cache
        from rest_framework.response import Response
        cache_key = 'categories_list_v6'
        data = cache.get(cache_key)
        if not data:
            response = super().list(request, *args, **kwargs)
            data = response.data
            # Cache for 2 hours; invalidate externally when categories change
            cache.set(cache_key, data, 60 * 60 * 2)
        return Response(data)

    @action(detail=False, methods=['get'], url_path=r'(?P<slug>[^/.]+)/spec-schema')
    def spec_schema(self, request, slug=None):
        from django.shortcuts import get_object_or_404
        from marketplace.models import Category, Product
        category = get_object_or_404(Category, slug=slug)
        
        for_seller = request.query_params.get('for_seller') == 'true' or request.query_params.get('all') == 'true'
        schema = []
        ancestors = category.get_ancestors(include_self=True)
        for anc in ancestors:
            if anc.spec_schema:
                schema.extend(anc.spec_schema)
        
        # If parent category has no direct schema, check child categories
        if not schema:
            descendants = category.get_descendants(include_self=False)
            for desc in descendants:
                if desc.spec_schema:
                    schema.extend(desc.spec_schema)
                    break
        
        merged = {}
        for item in schema:
            merged[item['key']] = dict(item)

        if for_seller:
            return Response(list(merged.values()))

        # For buyer filtering: Only include specs and options that exist in active products
        descendants = category.get_descendants(include_self=True)
        active_products = Product.objects.filter(
            category__in=descendants,
            is_available=True,
            stock__gt=0
        )

        active_spec_values = {}
        for prod in active_products:
            if prod.structured_specs and isinstance(prod.structured_specs, dict):
                for k, v in prod.structured_specs.items():
                    if v is not None and str(v).strip():
                        active_spec_values.setdefault(k, set()).add(str(v).strip())
            if prod.specifications and isinstance(prod.specifications, dict):
                for k, v in prod.specifications.items():
                    if v is not None and str(v).strip():
                        active_spec_values.setdefault(k, set()).add(str(v).strip())

        filtered_schema = []
        for key, spec_item in merged.items():
            existing_vals = active_spec_values.get(key, set())
            if not existing_vals:
                continue

            if 'options' in spec_item and isinstance(spec_item['options'], list):
                valid_options = [opt for opt in spec_item['options'] if str(opt).strip() in existing_vals]
                for v in existing_vals:
                    if v not in valid_options:
                        valid_options.append(v)
                spec_item['options'] = valid_options
            else:
                spec_item['type'] = 'select'
                spec_item['options'] = sorted(list(existing_vals))
            
            filtered_schema.append(spec_item)

        # Include custom specs from active products
        for key, vals in active_spec_values.items():
            if key not in merged and vals and not key.startswith('_'):
                label = key.replace('_', ' ').title()
                filtered_schema.append({
                    'key': key,
                    'label': label,
                    'type': 'select',
                    'options': sorted(list(vals)),
                    'filterable': True
                })

        return Response(filtered_schema)

    @action(detail=False, methods=['get'], url_path=r'(?P<slug>[^/.]+)/brands')
    def brands(self, request, slug=None):
        from django.shortcuts import get_object_or_404
        from marketplace.models import Category, Brand
        from marketplace.serializers import BrandSerializer
        from django.db.models import Q
        category = get_object_or_404(Category, slug=slug)
        descendants = category.get_descendants(include_self=True)

        for_seller = request.query_params.get('for_seller') == 'true' or request.query_params.get('all') == 'true'
        if not for_seller:
            brands = Brand.objects.filter(
                products__category__in=descendants,
                products__is_available=True,
                products__stock__gt=0,
                is_active=True
            ).distinct().order_by('name')
        else:
            # Query brands explicitly associated with this category/descendants,
            # or linked via reference products or products in this category hierarchy.
            ancestors = category.get_ancestors(include_self=False)
            brands = Brand.objects.filter(
                Q(categories__in=descendants) |
                Q(reference_products__category__in=descendants) |
                Q(products__category__in=descendants),
                is_active=True
            ).distinct().order_by('name')

            if not brands.exists() and (ancestors.exists() if hasattr(ancestors, 'exists') else bool(ancestors)):
                brands = Brand.objects.filter(
                    Q(categories__in=ancestors) |
                    Q(reference_products__category__in=ancestors),
                    is_active=True
                ).distinct().order_by('name')

            # Return strictly matched brands (never dump all global brands)

        return Response(BrandSerializer(brands, many=True).data)

    @action(detail=False, methods=['get'], url_path=r'(?P<slug>[^/.]+)/filters')
    def filters(self, request, slug=None):
        # Placeholder for faceted counts if needed later
        return Response({})

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAdminUser])
    def discovered_specs(self, request):
        """
        Scans products for custom/unapproved specification options and custom attributes across all categories.
        """
        from marketplace.models import Category, Product
        from collections import defaultdict

        # Fetch products with structured_specs
        products_with_specs = Product.objects.filter(
            is_available=True
        ).exclude(structured_specs={}).select_related('category')

        # Map categories to their existing spec options
        categories = {c.id: c for c in Category.objects.all()}
        
        # Structure: {(category_id, spec_key, spec_label): {discovered_value: [product_names]}}
        discovered = defaultdict(lambda: defaultdict(list))

        for p in products_with_specs[:600]:
            if not p.category_id or not p.structured_specs:
                continue
            cat = categories.get(p.category_id)
            if not cat:
                continue
            
            # Map existing options for this category schema
            schema_keys = {}
            for s in (cat.spec_schema or []):
                k = s.get('key')
                if k:
                    schema_keys[k] = {
                        'label': s.get('label', k.replace('_', ' ').title()),
                        'options': set(s.get('options') or [])
                    }

            for k, val in p.structured_specs.items():
                if not val or k in ['oem_part_number', 'brand', 'reference_product']:
                    continue
                val_str = str(val).strip()
                if not val_str:
                    continue

                if k in schema_keys:
                    # Check if val_str is NOT in existing schema options
                    if val_str not in schema_keys[k]['options']:
                        discovered[(cat.id, k, schema_keys[k]['label'])][val_str].append(p.name)
                else:
                    # Custom attribute key not even in schema!
                    custom_label = k.replace('_', ' ').title()
                    discovered[(cat.id, k, custom_label)][val_str].append(p.name)

        results = []
        for (cat_id, spec_key, spec_label), val_dict in discovered.items():
            cat = categories.get(cat_id)
            for val, prod_names in val_dict.items():
                results.append({
                    'category_id': cat_id,
                    'category_name': cat.name if cat else 'Unknown',
                    'category_slug': cat.slug if cat else '',
                    'spec_key': spec_key,
                    'spec_label': spec_label,
                    'discovered_value': val,
                    'occurrences_count': len(prod_names),
                    'sample_products': prod_names[:3]
                })

        results.sort(key=lambda x: x['occurrences_count'], reverse=True)
        return Response(results)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def approve_spec_option(self, request):
        from marketplace.models import Category
        category_id = request.data.get('category_id')
        spec_key = request.data.get('spec_key')
        spec_label = request.data.get('spec_label')
        value = str(request.data.get('value', '')).strip()

        if not category_id or not spec_key or not value:
            return Response({'error': 'category_id, spec_key, and value are required.'}, status=400)

        try:
            category = Category.objects.get(id=category_id)
        except Category.DoesNotExist:
            return Response({'error': 'Category not found.'}, status=404)

        schema = list(category.spec_schema or [])
        found_spec = False

        for item in schema:
            if item.get('key') == spec_key:
                found_spec = True
                opts = item.get('options') or []
                if value not in opts:
                    opts.append(value)
                    item['options'] = opts
                    if item.get('type') != 'select':
                        item['type'] = 'select'
                break

        if not found_spec:
            schema.append({
                'key': spec_key,
                'label': spec_label or spec_key.replace('_', ' ').title(),
                'type': 'select',
                'options': [value],
                'required': False
            })

        category.spec_schema = schema
        category.save()

        return Response({
            'message': f"Added '{value}' to '{category.name}' under {spec_label or spec_key}.",
            'spec_schema': category.spec_schema
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def standardize_spec_option(self, request):
        from marketplace.models import Category, Product
        category_id = request.data.get('category_id')
        spec_key = request.data.get('spec_key')
        old_value = str(request.data.get('old_value', '')).strip()
        new_value = str(request.data.get('new_value', '')).strip()

        if not category_id or not spec_key or not old_value or not new_value:
            return Response({'error': 'category_id, spec_key, old_value, and new_value are required.'}, status=400)

        try:
            category = Category.objects.get(id=category_id)
        except Category.DoesNotExist:
            return Response({'error': 'Category not found.'}, status=404)

        descendants = category.get_descendants(include_self=True)
        products = Product.objects.filter(category__in=descendants)
        updated_count = 0

        for p in products:
            if p.structured_specs and p.structured_specs.get(spec_key) == old_value:
                p.structured_specs[spec_key] = new_value
                p.save(update_fields=['structured_specs'])
                updated_count += 1

        schema = list(category.spec_schema or [])
        for item in schema:
            if item.get('key') == spec_key:
                opts = item.get('options') or []
                if old_value in opts:
                    opts.remove(old_value)
                if new_value not in opts:
                    opts.append(new_value)
                item['options'] = opts
                break

        category.spec_schema = schema
        category.save()

        return Response({
            'message': f"Standardized '{old_value}' to '{new_value}'. Updated {updated_count} product listing(s).",
            'spec_schema': category.spec_schema
        })

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_throttles(self):
        if self.action == 'create':
            return [OrderCreateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Order.objects.none()

        # Detail actions: allow buyer, seller/team member of product in order, or staff
        if getattr(self, 'detail', False) or self.action in ['retrieve', 'update', 'partial_update', 'destroy', 'advance', 'cancel']:
            if user.is_staff or user.is_superuser:
                qs = Order.objects.all()
            else:
                from uzachuo.permissions import get_effective_sellers
                sellers = get_effective_sellers(user, required_permission='manage_orders')
                qs = Order.objects.filter(
                    Q(user=user) | Q(orderitem_set__product__seller_id__in=sellers)
                ).distinct()
        else:
            # List action:
            role = self.request.query_params.get('role')
            order_type = self.request.query_params.get('type')
            all_param = self.request.query_params.get('all') == 'true'

            if role == 'seller' or order_type == 'incoming':
                from uzachuo.permissions import get_effective_sellers
                sellers = get_effective_sellers(user, required_permission='manage_orders')
                qs = Order.objects.filter(orderitem_set__product__seller_id__in=sellers).distinct()
            elif (user.is_staff or user.is_superuser) and (all_param or role == 'all' or order_type == 'all'):
                qs = Order.objects.all()
            else:
                # Default for /api/orders/ (Customer Orders / Outgoing Orders): only user's own purchases
                qs = Order.objects.filter(user=user)
            
        status_param = self.request.query_params.get('status')
        exclude_statuses = self.request.query_params.get('exclude_statuses')
        
        if status_param:
            qs = qs.filter(status=status_param)
        if exclude_statuses:
            excluded = exclude_statuses.split(',')
            qs = qs.exclude(status__in=excluded)
            
        return qs.prefetch_related('orderitem_set__product', 'timeline_events', 'payments').order_by('-order_date')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            # Extract readable errors for frontend toast
            err_strings = []
            for field, messages in serializer.errors.items():
                if isinstance(messages, list):
                    err_strings.append(f"{field}: {', '.join(str(m) for m in messages)}")
                else:
                    err_strings.append(f"{field}: {messages}")
            return Response({'detail': "Validation Error: " + " | ".join(err_strings)}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            self.perform_create(serializer)
        except drf_serializers.ValidationError as e:
            err_msg = str(e.detail)
            if isinstance(e.detail, list) and len(e.detail) > 0:
                err_msg = str(e.detail[0])
            elif isinstance(e.detail, dict):
                first_key = list(e.detail.keys())[0]
                if isinstance(e.detail[first_key], list):
                    err_msg = f"{first_key}: {e.detail[first_key][0]}"
                else:
                    err_msg = f"{first_key}: {e.detail[first_key]}"
            return Response({'detail': err_msg}, status=status.HTTP_400_BAD_REQUEST)
            
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        order = serializer.save(user=self.request.user)
        # Notify sellers of incoming new order
        try:
            seller_ids = set(order.orderitem_set.values_list('product__seller_id', flat=True))
            from django.contrib.auth import get_user_model
            User = get_user_model()
            for seller in User.objects.filter(id__in=seller_ids):
                if seller != self.request.user:
                    push_notification(
                        user=seller,
                        notification_type='order_status',
                        title=f'New Order #{order.id}',
                        message=f'Customer @{self.request.user.username} placed a new order totaling TSh {int(order.total_amount):,}.',
                        link=f'/dashboard/orders?highlight={order.id}'
                    )
        except Exception:
            pass

    @decorators.action(detail=True, methods=['post'])
    @transaction.atomic
    def advance(self, request, pk=None):
        from .services import OrderStateMachine
        order = self.get_object()
        
        # PERMISSION CHECK: Must be staff OR a seller of an item in this order
        from uzachuo.permissions import check_team_permission
        is_seller = False
        for item in order.orderitem_set.select_related('product').all():
            seller_id = item.product.seller_id
            if request.user.id == seller_id:
                is_seller = True
                break
            if check_team_permission(request.user, seller_id, 'manage_orders'):
                is_seller = True
                break
        is_buyer = order.user_id == request.user.id  # FIX: S-06

        new_state = request.data.get('status')
        notes = request.data.get('notes', '')

        # Fallback for cached frontend clients trying to skip verification
        if new_state == 'ASSIGNED_TRANSPORT' and order.status == 'AWAITING_DELIVERY_PAYMENT':
            new_state = 'PENDING_DELIVERY_VERIFICATION'

        # FIX: WAREHOUSE_PICKUP orders shouldn't be assigned transport
        if new_state == 'ASSIGNED_TRANSPORT' and order.fulfillment_type == 'WAREHOUSE_PICKUP':
            new_state = 'READY_FOR_PICKUP'

        # FIX: S-06 — Enforce who can trigger which transitions
        STAFF_ONLY_STATES = {
            'PAID', 'EXPIRED', 'RECEIVED_AT_WAREHOUSE', 'AWAITING_DELIVERY_PAYMENT',
            'IN_TRANSIT', 'ARRIVED_AT_REGIONAL_WAREHOUSE', 'READY_FOR_PICKUP', 'DELIVERED'
        }
        SELLER_ALLOWED_STATES = {
            'SELLER_CONFIRMED', 'PREPARING', 'PACKAGING', 'SHIPPED_TO_WAREHOUSE',
            'PROCESSING', 'SHIPPED', 'DELIVERED', 'READY_FOR_PICKUP', 'COMPLETED', 'DISPUTED'
        }
        BUYER_ALLOWED_STATES = {'AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'PENDING_DELIVERY_VERIFICATION', 'CHECKOUT', 'COMPLETED', 'DISPUTED', 'READY_FOR_TRANSIT', 'ASSIGNED_TRANSPORT', 'PAID_PRODUCT'}

        # Allow warehouse role staff to transition to warehouse states
        is_warehouse_staff = (
            request.user.is_superuser
            or has_staff_permission(request.user, 'can_manage_warehouse_intake')
            or has_staff_permission(request.user, 'can_manage_logistics')
        )
        
        if new_state in STAFF_ONLY_STATES and not is_warehouse_staff:
            # HIGH-1: DIRECT_DELIVERY orders — seller manages last-mile, so allow them to mark as DELIVERED
            is_direct_seller_delivery = (
                new_state == 'DELIVERED'
                and order.fulfillment_type == 'DIRECT_DELIVERY'
                and is_seller
            )
            # SELLER_PICKUP orders — seller prepares and marks as READY_FOR_PICKUP or DELIVERED upon customer collection
            is_seller_pickup_action = (
                new_state in ['READY_FOR_PICKUP', 'DELIVERED', 'COMPLETED']
                and order.fulfillment_type == 'SELLER_PICKUP'
                and is_seller
            )
            if not (is_direct_seller_delivery or is_seller_pickup_action):
                return Response(
                    {'detail': f'ERR_STAFF_ONLY: Only staff or warehouse operators can set order status to {new_state}.'},
                    status=403
                )
        if new_state in SELLER_ALLOWED_STATES and not (is_warehouse_staff or is_seller):
            return Response(
                {'detail': f'ERR_SELLER_ONLY: Only the seller or staff can advance order to {new_state}.'},
                status=403
            )
        if new_state in BUYER_ALLOWED_STATES and not (is_warehouse_staff or is_buyer):
            return Response(
                {'detail': f'ERR_BUYER_ONLY: Only the buyer or staff can move order to {new_state}. (is_buyer={is_buyer}, user_id={request.user.id}, order_user_id={order.user_id})'},
                status=403
            )

        # If not staff, buyer, or seller — deny
        if not (is_warehouse_staff or is_seller or is_buyer):
            return Response({'detail': f'ERR_NO_ROLE: No permission to transition this order. (is_buyer={is_buyer}, user_id={request.user.id}, order_user_id={order.user_id})'}, status=403)

        # If transitioning to PENDING_VERIFICATION or PENDING_DELIVERY_VERIFICATION, we might want to attach a payment record
        if new_state in ['PENDING_VERIFICATION', 'PENDING_DELIVERY_VERIFICATION', 'ASSIGNED_TRANSPORT']:
            proof = request.FILES.get('proof_image')
            transaction_id = request.data.get('transaction_id', '')
            if proof or transaction_id:
                # Use delivery fee if advancing to PENDING_DELIVERY_VERIFICATION or ASSIGNED_TRANSPORT, otherwise total_amount
                amount = order.total_amount
                if new_state in ['PENDING_DELIVERY_VERIFICATION', 'ASSIGNED_TRANSPORT']:
                    amount = order.shipping_fee
                
                Payment.objects.create(
                    order=order,
                    payment_method='OFFLINE',
                    proof_image=proof,
                    transaction_id=transaction_id,
                    amount=amount,
                    status='PENDING_VERIFICATION'
                )
                notes = notes or f"Payment proof submitted: {transaction_id}"

        if new_state == 'SHIPPED_TO_WAREHOUSE':
            dropoff_warehouse_code = request.data.get('warehouse_code')
            if dropoff_warehouse_code:
                if isinstance(order.delivery_info, dict):
                    new_di = dict(order.delivery_info)
                    new_di['warehouse_code'] = dropoff_warehouse_code
                    order.delivery_info = new_di
                else:
                    order.delivery_info = {'warehouse_code': dropoff_warehouse_code}
                order.save(update_fields=['delivery_info'])

        if new_state in ['DELIVERED', 'COMPLETED']:
            delivery_code = request.data.get('delivery_code')
            if order.delivery_code:
                if not delivery_code or str(delivery_code).strip() != str(order.delivery_code).strip():
                    return Response({'error': 'Invalid pickup/delivery code. Please check the code with the customer.'}, status=status.HTTP_400_BAD_REQUEST)
            new_state = 'COMPLETED'
            notes = (notes + " Verified by secure collection code.") if notes else "Verified by secure collection code."

        try:
            OrderStateMachine.transition_order(order, new_state, notes=notes)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': order.status})

    @decorators.action(detail=True, methods=['get'], url_path='pickup-code')
    def pickup_code(self, request, pk=None):
        order = self.get_object()
        if order.user != request.user and not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'You are not authorized to view this pickup code.'}, status=status.HTTP_403_FORBIDDEN)
        
        # Suppress pickup code for completed or cancelled orders
        if order.status in ('COMPLETED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'RETURNED'):
            return Response({'error': 'Pickup code is no longer active for completed or cancelled orders.'}, status=status.HTTP_400_BAD_REQUEST)

        if order.fulfillment_type in ('SELLER_PICKUP', 'DIRECT_DELIVERY'):
            return Response({'code': order.delivery_code})

        pickup_code = order.pickup_codes.filter(is_used=False).first()
        if not pickup_code and order.status in ('ARRIVED_AT_REGIONAL_WAREHOUSE', 'READY_FOR_PICKUP', 'READY_FOR_VEHICLE_HANDOVER'):
            from logistics.models import PickupCode
            pickup_code, _ = PickupCode.objects.get_or_create(order=order)
            
        if not pickup_code:
            return Response({'error': 'No active pickup code found for this order.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'code': pickup_code.code})

    @decorators.action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        from .services import OrderStateMachine
        order = self.get_object()
        
        # PERMISSION CHECK: Must be staff, the buyer, or a seller of an item in this order
        is_buyer = order.user == request.user
        from uzachuo.permissions import check_team_permission
        is_seller = False
        for item in order.orderitem_set.select_related('product').all():
            seller_id = item.product.seller_id
            if request.user.id == seller_id:
                is_seller = True
                break
            if check_team_permission(request.user, seller_id, 'manage_orders'):
                is_seller = True
                break
        
        if not (request.user.is_staff or request.user.is_superuser or is_buyer or is_seller):
            return Response({'detail': 'No permission to cancel this order.'}, status=403)

        # Block cancellation if already paid (only staff can cancel paid/processing orders)
        if order.status in ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED') and not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Paid orders can only be cancelled by staff administrators.'}, status=status.HTTP_400_BAD_REQUEST)

        # Block seller cancellation if already dispatched to warehouse
        if is_seller and order.status not in ('CART', 'CHECKOUT', 'AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'PAID_PRODUCT', 'PREPARING', 'PACKAGING'):
            if not (request.user.is_staff or request.user.is_superuser):
                return Response({'error': 'You cannot cancel an order once it has been dispatched to the warehouse.'}, status=status.HTTP_400_BAD_REQUEST)

        notes = request.data.get('notes', 'Order cancelled.')
        try:
            OrderStateMachine.transition_order(order, 'CANCELLED', notes=notes)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': order.status})

    @decorators.action(detail=False, methods=['post'], url_path='pos-checkout')
    @transaction.atomic
    def pos_checkout(self, request):
        """Create a POS (Point of Sale) order for walk-in customers."""
        try:
            user = request.user
            items_data = request.data.get('items', [])
            customer_name = request.data.get('customer_name', 'Walk-in Customer')
            amount_paid = request.data.get('amount_paid', 0)
            
            if not items_data:
                return Response({'error': 'No items provided.'}, status=status.HTTP_400_BAD_REQUEST)
                
            from uzachuo.permissions import get_effective_sellers
            sellers = get_effective_sellers(user)
            
            total_amount = 0
            order_items = []
            
            for item_data in items_data:
                product_id = item_data.get('product_id')
                variant_id = item_data.get('variant_id')
                quantity = int(item_data.get('quantity', 1))
                
                if quantity <= 0:
                    return Response({'error': 'Quantity must be positive.'}, status=status.HTTP_400_BAD_REQUEST)
                    
                try:
                    product = Product.objects.get(id=product_id)
                except Product.DoesNotExist:
                    return Response({'error': f'Product ID {product_id} not found.'}, status=status.HTTP_400_BAD_REQUEST)
                    
                if not (user.is_staff or user.is_superuser or product.seller_id in sellers or product.seller_id == user.id):
                    return Response({'error': f'You are not authorized to sell {product.name}.'}, status=status.HTTP_403_FORBIDDEN)
                    
                variant = None
                if variant_id:
                    try:
                        variant = ProductVariant.objects.get(id=variant_id, product=product)
                    except ProductVariant.DoesNotExist:
                        return Response({'error': f'Variant ID {variant_id} not found.'}, status=status.HTTP_400_BAD_REQUEST)
                
                stock_available = variant.stock if variant else (
                    sum(v.stock for v in product.variants.filter(is_available=True)) if product.variants.exists() else product.stock
                )
                
                if stock_available < quantity:
                    return Response({'error': f'Insufficient stock for {product.name}. Available: {stock_available}.'}, status=status.HTTP_400_BAD_REQUEST)
                
                price = variant.final_price if variant else product.price
                if product.requires_quote:
                    if 'price' in item_data:
                        try:
                            price = float(item_data['price'])
                        except (ValueError, TypeError):
                            return Response({'error': 'Invalid custom price provided.'}, status=status.HTTP_400_BAD_REQUEST)
                    else:
                        return Response({'error': f'Price is required for {product.name} because it requires a quote.'}, status=status.HTTP_400_BAD_REQUEST)
                
                order_items.append({
                    'product': product,
                    'variant': variant,
                    'quantity': quantity,
                    'price': price
                })
                
            delivery_info = {
                'is_pos': True,
                'customer_name': customer_name,
                'amount_paid': amount_paid
            }
            
            order = Order.objects.create(
                user=user,
                status='COMPLETED',
                shipping_method='PICKUP',
                fulfillment_type='SELLER_PICKUP',  # CRIT-5: POS orders are always seller-side pickups
                shipping_fee=0,
                delivery_info=delivery_info
            )
            
            for item in order_items:
                OrderItem.objects.create(
                    order=order,
                    product=item['product'],
                    variant=item['variant'],
                    quantity=item['quantity'],
                    price=item['price']
                )
                if item['variant']:
                    item['variant'].stock = max(0, item['variant'].stock - item['quantity'])
                    if item['variant'].stock <= 0:
                        item['variant'].is_available = False
                    item['variant'].save(update_fields=['stock', 'is_available'])
                item['product'].stock = max(0, item['product'].stock - item['quantity'])
                if item['product'].stock <= 0:
                    item['product'].is_available = False
                item['product'].save(update_fields=['stock', 'is_available'])
                
            order.update_total()
            TrackingEvent.objects.create(order=order, status='COMPLETED', notes=f'In-store POS sale to {customer_name}')
            
            # Phase 2: Platform Economics - Log 5% commission for POS
            from billing.models import CommissionLedgerEntry
            
            seller_totals = {}
            for item in order.orderitem_set.select_related('product__seller').all():
                seller = item.product.seller
                item_total = item.quantity * item.price
                if seller not in seller_totals:
                    seller_totals[seller] = Decimal('0.00')
                seller_totals[seller] += Decimal(str(item_total))
                
            total_commission_collected = Decimal('0.00')
            for seller, amount in seller_totals.items():
                actual_seller = seller or user
                pos_commission_rate = Decimal('5.00')
                commission_amount = amount * (pos_commission_rate / Decimal('100'))
                try:
                    CommissionLedgerEntry.objects.create(
                        order=order,
                        seller=actual_seller,
                        order_amount=amount,
                        commission_rate=pos_commission_rate,
                        commission_amount=commission_amount,
                        entry_type=CommissionLedgerEntry.EntryType.COMMISSION
                    )
                except Exception as e:
                    print(f"Error creating CommissionLedgerEntry: {e}")
                total_commission_collected += commission_amount
                
            order.platform_fee = total_commission_collected
            order.save(update_fields=['platform_fee'])
            
            serializer = self.get_serializer(order, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': f'POS checkout error: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)


    @decorators.action(detail=False, methods=['post'], url_path='request-invoice')
    @transaction.atomic
    def request_invoice(self, request):
        """Convert cart items into a bulk order that requires a quote/invoice."""
        user = request.user
        items_data = request.data.get('items', [])
        buyer_note = request.data.get('note', '')
        
        if not items_data:
            return Response({'error': 'No items provided.'}, status=status.HTTP_400_BAD_REQUEST)
            
        order = Order.objects.create(
            user=user,
            status='REQUESTED_INVOICE',
            shipping_method=request.data.get('shipping_method', 'DELIVERY'),
            fulfillment_type=request.data.get('fulfillment_type', 'PLATFORM_DELIVERY'),
            is_bulk_order=True,
            negotiation_data={
                'buyer_request_note': buyer_note,
                'counter_count': 0,
                'resolved': False,
            }
        )
        
        for item_data in items_data:
            product_id = item_data.get('product_id')
            variant_id = item_data.get('variant_id') or item_data.get('variant')
            quantity = Decimal(str(item_data.get('quantity', 1)))
            product = Product.objects.get(id=product_id)
            variant = None
            if variant_id:
                try:
                    variant = ProductVariant.objects.get(id=variant_id, product=product)
                except ProductVariant.DoesNotExist:
                    variant = None
            
            OrderItem.objects.create(
                order=order,
                product=product,
                variant=variant,
                quantity=quantity,
                price=product.price if not product.requires_quote else Decimal('0.00')
            )
            
        order.update_total()
        TrackingEvent.objects.create(order=order, status='REQUESTED_INVOICE', notes=buyer_note or 'Customer requested an invoice.')
        
        # Notify sellers of invoice request
        try:
            seller_ids = set(order.orderitem_set.values_list('product__seller_id', flat=True))
            from django.contrib.auth import get_user_model
            User = get_user_model()
            for seller in User.objects.filter(id__in=seller_ids):
                if seller != user:
                    push_notification(
                        user=seller,
                        notification_type='order_status',
                        title=f'New Invoice Request #{order.id}',
                        message=f'@{user.username} requested a bulk quote for {order.orderitem_set.count()} items.',
                        link='/dashboard/invoices'
                    )
        except Exception:
            pass

        return Response({'order_id': order.id, 'status': order.status, 'is_bulk_order': order.is_bulk_order}, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=['post'], url_path='generate-invoice')
    @transaction.atomic
    def generate_invoice(self, request, pk=None):
        """Seller sets prices and generates the invoice."""
        order = self.get_object()
        user = request.user
        
        from uzachuo.permissions import get_effective_sellers
        sellers = get_effective_sellers(user)
        
        # Check permissions: user must be seller of at least one item
        seller_ids = [item.product.seller_id for item in order.orderitem_set.select_related('product').all()]
        if not any(sid in sellers for sid in seller_ids) and not user.is_staff:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
        if order.status not in ('REQUESTED_INVOICE', 'CART', 'CHECKOUT', 'BUYER_COUNTERED'):
            return Response({'error': 'Order is not pending an invoice.'}, status=status.HTTP_400_BAD_REQUEST)
        
        seller_note = request.data.get('seller_note') or request.data.get('note', '')
        neg_data = dict(order.negotiation_data or {})
        
        # If seller clicks "Accept Buyer's Offer", apply the buyer's proposed prices
        accept_counter = request.data.get('accept_counter', False)
        if accept_counter and order.status == 'BUYER_COUNTERED' and order.negotiation_data:
            proposed = order.negotiation_data.get('proposed_prices', {})
            for item in order.orderitem_set.all():
                if str(item.id) in proposed:
                    item.price = Decimal(str(proposed[str(item.id)]))
                    item.save(update_fields=['price'])
            neg_data['seller_final_note'] = seller_note or 'Accepted counter-offer'
            neg_data['resolved'] = True
        else:
            prices = request.data.get('prices', {}) # {item_id: price}
            for item in order.orderitem_set.all():
                if str(item.id) in prices:
                    item.price = Decimal(str(prices[str(item.id)]))
                    item.save(update_fields=['price'])
            if order.status == 'BUYER_COUNTERED':
                neg_data['seller_final_note'] = seller_note
                neg_data['resolved'] = True
            else:
                neg_data['seller_invoice_note'] = seller_note
                
        # Handle shipping fee
        shipping_fee = request.data.get('shipping_fee')
        if shipping_fee is not None:
            order.shipping_fee = Decimal(str(shipping_fee))
                
        # Optional: pos immediate completion
        complete_pos = request.data.get('complete_pos', False)
        
        order.status = 'COMPLETED' if complete_pos else 'INVOICE_GENERATED'
        if complete_pos:
            di = order.delivery_info or {}
            di['is_pos'] = True
            order.delivery_info = di
        
        order.negotiation_data = neg_data
        order.save(update_fields=['status', 'shipping_fee', 'delivery_info', 'negotiation_data'])
        order.update_total()
        
        notes = 'Seller accepted buyer\'s counter-offer.' if accept_counter else ('Final invoice generated by seller.' if neg_data.get('resolved') else 'Invoice generated by seller.')
        if seller_note:
            notes += f" ({seller_note})"
        TrackingEvent.objects.create(order=order, status=order.status, notes=notes)
        
        # Notify buyer that invoice is ready/updated
        try:
            title = f'Invoice Updated #{order.id}' if neg_data.get('counter_count', 0) > 0 else f'Invoice Ready #{order.id}'
            push_notification(
                user=order.user,
                notification_type='order_status',
                title=title,
                message=f'@{user.username} sent your invoice for order #{order.id} totaling TSh {int(order.total_amount):,}.',
                link=f'/orders?highlight={order.id}'
            )
        except Exception:
            pass

        return Response({'status': order.status, 'negotiation_data': order.negotiation_data})

    @decorators.action(detail=True, methods=['post'], url_path='confirm-invoice')
    @transaction.atomic
    def confirm_invoice(self, request, pk=None):
        """Buyer confirms the invoice and proceeds to pay."""
        order = self.get_object()
        if order.user != request.user:
            return Response({'error': 'Unauthorized'}, status=403)
            
        if order.status != 'INVOICE_GENERATED':
            return Response({'error': 'No generated invoice to confirm.'}, status=400)
            
        order.status = 'AWAITING_PAYMENT'
        order.save(update_fields=['status'])
        TrackingEvent.objects.create(order=order, status='AWAITING_PAYMENT', notes='Buyer confirmed invoice.')
        
        # Notify sellers that invoice was accepted
        try:
            seller_ids = set(order.orderitem_set.values_list('product__seller_id', flat=True))
            from django.contrib.auth import get_user_model
            User = get_user_model()
            for seller in User.objects.filter(id__in=seller_ids):
                if seller != request.user:
                    push_notification(
                        user=seller,
                        notification_type='order_status',
                        title=f'Invoice Confirmed #{order.id}',
                        message=f'@{request.user.username} accepted invoice #{order.id} and proceeded to checkout.',
                        link=f'/dashboard/orders?highlight={order.id}'
                    )
        except Exception:
            pass

        return Response({'status': order.status})

    @decorators.action(detail=True, methods=['post'], url_path='counter-invoice')
    @transaction.atomic
    def counter_invoice(self, request, pk=None):
        """Buyer submits a counter-offer on the invoice (1 round allowed)."""
        from django.utils import timezone
        order = self.get_object()
        if order.user != request.user:
            return Response({'error': 'Unauthorized'}, status=403)

        if order.status != 'INVOICE_GENERATED':
            return Response({'error': 'Invoice must be in generated state before countering.'}, status=400)

        neg_data = dict(order.negotiation_data or {})
        if neg_data.get('counter_count', 0) >= 1 or neg_data.get('resolved', False):
            return Response({'error': 'Negotiation limit reached. You cannot submit another counter-offer on this invoice.'}, status=400)

        proposed_prices = request.data.get('proposed_prices', {})  # {item_id: proposed_price}
        note = request.data.get('note', '')

        if not proposed_prices:
            return Response({'error': 'Please propose at least one price.'}, status=400)

        neg_data['proposed_prices'] = proposed_prices
        neg_data['counter_note'] = note
        neg_data['counter_count'] = neg_data.get('counter_count', 0) + 1
        neg_data['countered_at'] = timezone.now().isoformat()
        
        order.negotiation_data = neg_data
        order.status = 'BUYER_COUNTERED'
        order.save(update_fields=['status', 'negotiation_data'])
        TrackingEvent.objects.create(order=order, status='BUYER_COUNTERED', notes=f'Buyer counter-offer: {note}')
        
        # Notify sellers of buyer counter-offer
        try:
            seller_ids = set(order.orderitem_set.values_list('product__seller_id', flat=True))
            from django.contrib.auth import get_user_model
            User = get_user_model()
            for seller in User.objects.filter(id__in=seller_ids):
                if seller != request.user:
                    push_notification(
                        user=seller,
                        notification_type='order_status',
                        title=f'Counter-Offer Received #{order.id}',
                        message=f'@{request.user.username} submitted a counter-offer on invoice #{order.id}.',
                        link='/dashboard/invoices'
                    )
        except Exception:
            pass

        return Response({'status': order.status, 'negotiation_data': order.negotiation_data})

    @decorators.action(detail=False, methods=['get'])
    def incoming(self, request):
        """Orders containing the current seller's products."""
        user = request.user
        from uzachuo.permissions import get_effective_sellers
        sellers = get_effective_sellers(user, required_permission='manage_orders')
        
        # Prefetch only for these sellers' items to avoid N+1 and leaking other seller's item data
        seller_items_prefetch = Prefetch(
            'orderitem_set',
            queryset=OrderItem.objects.filter(product__seller_id__in=sellers).select_related('product', 'variant').prefetch_related('product__images'),
            to_attr='relevant_items'
        )

        order_ids = OrderItem.objects.filter(product__seller_id__in=sellers).values_list('order_id', flat=True).distinct()
        
        orders_qs = Order.objects.filter(id__in=order_ids)
        
        is_pos_param = request.query_params.get('is_pos')
        if is_pos_param is not None:
            is_pos = is_pos_param.lower() == 'true'
            if is_pos:
                orders_qs = orders_qs.filter(delivery_info__is_pos=True)
            else:
                orders_qs = orders_qs.exclude(delivery_info__is_pos=True)

        is_bulk_param = request.query_params.get('is_bulk_order')
        if is_bulk_param is not None:
            orders_qs = orders_qs.filter(is_bulk_order=(is_bulk_param.lower() == 'true'))
                
        orders = orders_qs.prefetch_related(
            seller_items_prefetch, 'timeline_events', 'payments'
        ).select_related('user').order_by('-order_date')

        status_filter = request.query_params.get('status', None)
        if status_filter and status_filter.upper() != 'ALL':
            if ',' in status_filter:
                orders = orders.filter(status__in=[s.strip() for s in status_filter.split(',')])
            else:
                orders = orders.filter(status=status_filter)

        exclude_statuses = request.query_params.get('exclude_statuses', None)
        if exclude_statuses:
            orders = orders.exclude(status__in=exclude_statuses.split(','))

        order_id_filter = request.query_params.get('order_id', None)
        if order_id_filter:
            orders = orders.filter(id=order_id_filter)

        page = self.paginate_queryset(orders)
        
        def format_order(order):
            items_data = []
            for item in order.relevant_items:
                # FIX: L-04 — use prefetched images, avoid 2 queries per item
                _imgs = list(item.product.images.all())
                catalog_price = float(item.variant.final_price) if item.variant else (float(item.product.price) if item.product and item.product.price else None)
                items_data.append({
                    'id': item.id,
                    'product_name': item.product.name,
                    'product_slug': item.product.slug,
                    'product_image': _imgs[0].image.url if _imgs else None,
                    'quantity': item.quantity,
                    'price': float(item.price),
                    'catalog_price': catalog_price,
                    'subtotal': float(item.subtotal()),
                    'variant_name': item.variant.name if item.variant else None,
                })

            timeline = [{'status': e.status, 'notes': e.notes, 'created_at': e.created_at.isoformat()} for e in order.timeline_events.all()]
            payments = [{
                'id': p.id,
                'status': p.status,
                'method': p.payment_method,
                'transaction_id': p.transaction_id,
                'proof_image': p.proof_image.url if p.proof_image else None,
                'amount': float(p.amount),
                'created_at': p.created_at.isoformat()
            } for p in order.payments.all()]

            from logistics.utils import order_has_vehicles
            return {
                'id': order.id,
                'buyer': order.user.username,
                'buyer_contact': {
                    'name': order.delivery_info.get('contact_name', '') if order.delivery_info else '',
                    'phone': order.delivery_info.get('contact_phone', '') if order.delivery_info else ''
                },
                'order_date': order.order_date.isoformat(),
                'status': order.status,
                'shipping_method': order.shipping_method,
                'fulfillment_type': order.fulfillment_type,
                'has_vehicles': order_has_vehicles(order),
                'total_amount': float(order.total_amount),
                'shipping_fee': float(order.shipping_fee) if order.shipping_fee else 0.0,
                'seller_subtotal': sum(i['subtotal'] for i in items_data),
                'items': items_data,
                'timeline': timeline,
                'payments': payments,
                'delivery_info': order.delivery_info if isinstance(order.delivery_info, dict) else (json.loads(order.delivery_info) if isinstance(order.delivery_info, str) else {}),
                'negotiation_data': order.negotiation_data if isinstance(order.negotiation_data, dict) else (json.loads(order.negotiation_data) if isinstance(order.negotiation_data, str) else {}),
                'is_bulk_order': order.is_bulk_order,
            }

        if page is not None:
            data = [format_order(o) for o in page]
            return self.get_paginated_response(data)

        data = [format_order(o) for o in orders]
        return Response(data)

class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ProductReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        # FIX: L-05 — non-staff only see approved reviews, plus their own unapproved reviews
        product_id = self.request.query_params.get('product', None)
        qs = Review.objects.all()
        if not self.request.user.is_staff:
            from django.db.models import Q
            if self.request.user.is_authenticated:
                qs = qs.filter(Q(approved=True) | Q(user=self.request.user))
            else:
                qs = qs.filter(approved=True)
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs

    def get_permissions(self):  # FIX: L-06
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsOwnerOrStaff()]
        return super().get_permissions()

    def perform_create(self, serializer):
        product = serializer.validated_data['product']
        # Strict anti-fraud check: User must have a COMPLETED or DELIVERED order containing this product.
        from django.db.models import Q
        has_completed_order = OrderItem.objects.filter(
            Q(order__user=self.request.user, product=product) &
            (Q(order__status__in=['COMPLETED', 'DELIVERED']) | Q(order__is_completed=True))
        ).exists()
        
        if not has_completed_order:
            raise drf_serializers.ValidationError("You can only review products you have completely purchased and received.")
        
        order = serializer.validated_data.get('order')
        if order and order.user_id != self.request.user.id:
            raise drf_serializers.ValidationError("Order does not belong to you.")

        # If review already exists for this user and product, update it instead of throwing error
        existing_review = Review.objects.filter(user=self.request.user, product=product).first()
        if existing_review:
            existing_review.rating = serializer.validated_data['rating']
            existing_review.comment = serializer.validated_data.get('comment', '')
            if order:
                existing_review.order = order
            existing_review.approved = True
            existing_review.save()
            serializer.instance = existing_review
            review = existing_review
        else:
            review = serializer.save(user=self.request.user, approved=True)

        # Notify moderators (staff)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        staff_users = User.objects.filter(is_staff=True)
        for staff in staff_users:
            try:
                push_notification(
                    staff,
                    'review_moderation',
                    'New Review Pending Moderation',
                    f'User {self.request.user.username} submitted a review for "{product.name}" that needs approval.',
                    '/staff'
                )
            except Exception:
                pass

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStaffMember])
    def approve(self, request, pk=None):
        """FIX: M-05 — Staff can approve reviews."""
        review = self.get_object()
        review.approved = True
        review.save(update_fields=['approved'])
        return Response({'approved': True, 'id': review.id})

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStaffMember])
    def reject(self, request, pk=None):
        """FIX: M-05 — Staff can reject reviews."""
        review = self.get_object()
        review.delete()
        return Response(status=204)

class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = ProductCommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        product_id = self.request.query_params.get('product', None)
        if product_id:
            return ProductComment.objects.filter(product_id=product_id)
        return ProductComment.objects.all()

    def get_permissions(self):  # FIX: L-07
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsOwnerOrStaff()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return Payment.objects.all()
        from uzachuo.permissions import get_effective_sellers
        sellers = get_effective_sellers(user, required_permission='manage_payments') or get_effective_sellers(user, required_permission='manage_orders')
        # Buyers see their own payments, Sellers and authorized team members see payments for their products
        return Payment.objects.filter(
            django_models.Q(order__user=user) | django_models.Q(order__orderitem_set__product__seller_id__in=sellers)
        ).distinct()

    # Add payment verify/approve/reject actions for staff, business owners, and accountant team members
    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def verify(self, request, pk=None):
        """Staff, Seller, or Accountant Team Member: approve a pending marketplace payment."""
        from .services import OrderStateMachine
        from uzachuo.permissions import get_effective_sellers
        payment = self.get_object()
        
        is_staff = request.user.is_staff or request.user.is_superuser
        sellers = get_effective_sellers(request.user, required_permission='manage_payments')
        is_seller_or_team = payment.order and payment.order.orderitem_set.filter(product__seller_id__in=sellers).exists()
        
        if not (is_staff or is_seller_or_team):
            return Response({'error': 'You do not have permission to verify this payment.'}, status=403)

        if payment.status != 'PENDING_VERIFICATION':
            return Response({'error': 'Payment is not pending verification.'}, status=400)
        payment.status = 'VERIFIED'
        payment.save(update_fields=['status'])
        if payment.order and payment.order.status == 'PENDING_VERIFICATION':
            try:
                OrderStateMachine.transition_order(
                    payment.order, 'PAID',
                    notes=f'Payment #{payment.id} verified by {request.user.username}.'
                )
            except ValueError as e:
                return Response({'error': str(e)}, status=400)
        return Response({
            'payment_status': payment.status,
            'order_status': payment.order.status if payment.order else None
        })

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def reject(self, request, pk=None):
        """Staff, Seller, or Accountant Team Member: reject a pending payment."""
        from .services import OrderStateMachine
        from uzachuo.permissions import get_effective_sellers
        payment = self.get_object()
        
        is_staff = request.user.is_staff or request.user.is_superuser
        sellers = get_effective_sellers(request.user, required_permission='manage_payments')
        is_seller_or_team = payment.order and payment.order.orderitem_set.filter(product__seller_id__in=sellers).exists()
        
        if not (is_staff or is_seller_or_team):
            return Response({'error': 'You do not have permission to reject this payment.'}, status=403)

        if payment.status != 'PENDING_VERIFICATION':
            return Response({'error': 'Payment is not pending verification.'}, status=400)
        payment.status = 'REJECTED'
        payment.save(update_fields=['status'])
        if payment.order and payment.order.status == 'PENDING_VERIFICATION':
            try:
                OrderStateMachine.transition_order(
                    payment.order, 'AWAITING_PAYMENT',
                    notes=f'Payment #{payment.id} rejected by {request.user.username}. Reason: {request.data.get("reason", "Not specified")}.'
                )
            except ValueError:
                pass
        return Response({'payment_status': payment.status})

from django.contrib.auth.models import User
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        from django.contrib.auth.models import User
        username = attrs.get('username')
        password = attrs.get('password')
        try:
            user = User.objects.get(username=username)
            if not user.is_active and user.check_password(password):
                from rest_framework.exceptions import AuthenticationFailed
                raise AuthenticationFailed('Your account has been banned.', code='user_banned')
        except User.DoesNotExist:
            pass
            
        data = super().validate(attrs)
        data['user_id'] = self.user.id
        data['username'] = self.user.username
        data['first_name'] = self.user.first_name
        data['last_name'] = self.user.last_name
        data['is_staff'] = self.user.is_staff or self.user.is_superuser
        data['is_superuser'] = self.user.is_superuser
        try:
            data['is_verified'] = self.user.profile.is_verified
            data['tier'] = self.user.profile.tier
            data['terms_accepted'] = self.user.profile.terms_accepted
            data['profile_picture'] = self.user.profile.profile_picture.url if self.user.profile.profile_picture else None
        except (UserProfile.DoesNotExist, AttributeError):
            data['is_verified'] = False
            data['tier'] = 'customer'
            data['terms_accepted'] = False
            data['profile_picture'] = None
        
        data['is_inspector'] = hasattr(self.user, 'inspector_profile')
        data['inspector_level'] = (
            self.user.inspector_profile.level
            if hasattr(self.user, 'inspector_profile') else None
        )

        from marketplace.models import TeamMember, TEAM_ROLE_PRESETS
        member_record = TeamMember.objects.filter(user=self.user, invitation_status='accepted').select_related('owner', 'owner__profile').first()
        if member_record:
            owner = member_record.owner
            is_owner_business = (
                getattr(getattr(owner, 'profile', None), 'tier', None) == 'business' or
                owner.subscriptions.filter(is_active=True, tier__tier_level='business').exists() or
                owner.is_superuser
            )
            role_preset = member_record.role_preset or 'custom'
            role_label = TEAM_ROLE_PRESETS.get(role_preset, {}).get('label', role_preset.replace('_', ' ').title())

            data['is_team_member'] = True
            data['team_owner_id'] = owner.id
            data['team_owner_username'] = owner.username
            data['business_name'] = getattr(getattr(owner, 'profile', None), 'bio', None) or owner.get_full_name() or owner.username
            data['team_role_preset'] = role_preset
            data['team_role_label'] = role_label
            data['is_team_suspended'] = not member_record.is_active
            data['is_owner_subscription_active'] = is_owner_business
            data['team_permissions'] = member_record.permissions if (member_record.is_active and is_owner_business) else {}
            if data.get('tier') == 'customer':
                data['tier'] = 'worker'
        else:
            data['is_team_member'] = False
            data['team_owner_id'] = None
            data['team_owner_username'] = None
            data['business_name'] = None
            data['team_role_preset'] = None
            data['team_role_label'] = None
            data['is_team_suspended'] = False
            data['is_owner_subscription_active'] = False
            data['team_permissions'] = {}

        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['user_id'] = user.id
        token['username'] = user.username
        token['first_name'] = user.first_name
        token['last_name'] = user.last_name
        token['is_staff'] = user.is_staff or user.is_superuser
        token['is_superuser'] = user.is_superuser
        
        try:
            token['is_verified'] = user.profile.is_verified
            token['tier'] = user.profile.tier
            token['terms_accepted'] = user.profile.terms_accepted
            token['profile_picture'] = user.profile.profile_picture.url if user.profile.profile_picture else None
        except Exception:
            token['is_verified'] = False
            token['tier'] = 'customer'
            token['terms_accepted'] = False
            token['profile_picture'] = None
            
        token['is_inspector'] = hasattr(user, 'inspector_profile')
        token['inspector_level'] = (
            user.inspector_profile.level
            if hasattr(user, 'inspector_profile') else None
        )
        
        from marketplace.models import TeamMember, TEAM_ROLE_PRESETS
        member_record = TeamMember.objects.filter(user=user, invitation_status='accepted').select_related('owner', 'owner__profile').first()
        if member_record:
            owner = member_record.owner
            is_owner_business = (
                getattr(getattr(owner, 'profile', None), 'tier', None) == 'business' or
                owner.subscriptions.filter(is_active=True, tier__tier_level='business').exists() or
                owner.is_superuser
            )
            role_preset = member_record.role_preset or 'custom'
            role_label = TEAM_ROLE_PRESETS.get(role_preset, {}).get('label', role_preset.replace('_', ' ').title())

            token['is_team_member'] = True
            token['team_owner_id'] = owner.id
            token['team_owner_username'] = owner.username
            token['business_name'] = getattr(getattr(owner, 'profile', None), 'bio', None) or owner.get_full_name() or owner.username
            token['team_role_preset'] = role_preset
            token['team_role_label'] = role_label
            token['is_team_suspended'] = not member_record.is_active
            token['is_owner_subscription_active'] = is_owner_business
            token['team_permissions'] = member_record.permissions if (member_record.is_active and is_owner_business) else {}
            if token.get('tier') == 'customer':
                token['tier'] = 'worker'
        else:
            token['is_team_member'] = False
            token['team_owner_id'] = None
            token['team_owner_username'] = None
            token['business_name'] = None
            token['team_role_preset'] = None
            token['team_role_label'] = None
            token['is_team_suspended'] = False
            token['is_owner_subscription_active'] = False
            token['team_permissions'] = {}
            
        from marketplace.models import Subscription
        from django.utils import timezone
        sub = Subscription.objects.filter(user=user).order_by('-start_date').first()
        if sub and sub.end_date:
            token['subscription_active'] = timezone.now() <= sub.end_date
            token['subscription_end_date'] = sub.end_date.isoformat()
        else:
            token['subscription_active'] = False
            token['subscription_end_date'] = None
            
        return token

from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenRefreshView

class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        refresh = self.token_class(attrs['refresh'])
        user_id = refresh.payload.get('user_id')
        
        if user_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(id=user_id)
                # Generate a brand new access token with up-to-date claims
                new_token = CustomTokenObtainPairSerializer.get_token(user)
                data['access'] = str(new_token.access_token)
            except User.DoesNotExist:
                pass
                
        return data

class CustomTokenRefreshView(TokenRefreshView):
    serializer_class = CustomTokenRefreshSerializer

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]  # FIX D-07

class AcceptTermsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        profile = request.user.profile
        profile.terms_accepted = True
        profile.save()
        return Response({'status': 'terms accepted'})

class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        old = request.data.get('old_password')
        new = request.data.get('new_password')
        if not request.user.check_password(old):
            return Response({'error': 'Incorrect current password'}, status=400)
        from django.core.exceptions import ValidationError
        try:
            validate_password(new, request.user)
        except ValidationError as e:
            return Response({'error': " ".join(e.messages)}, status=400)
        request.user.set_password(new)
        request.user.save()
        return Response({'status': 'password changed'})

class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [RegisterRateThrottle]  # FIX D-07

    def post(self, request):
        username = request.data.get('username')
        email = request.data.get('email')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        dob = request.data.get('date_of_birth')
        password = request.data.get('password')
        confirm_password = request.data.get('confirm_password')

        if not username or not password or not email:
            return Response({'detail': 'Username, email and password are required.'}, status=status.HTTP_400_BAD_REQUEST)
        if password != confirm_password:
            return Response({'detail': 'Passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'detail': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email=email).exists():
            return Response({'detail': 'An account with this email already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(password)
        except Exception as e:
            err_msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
            return Response({'detail': err_msg}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=username, 
            email=email, 
            password=password,
            first_name=first_name or '',
            last_name=last_name or ''
        )
        # Profile is created via post_save signal in models.py
        profile = user.profile
        profile.terms_accepted = True
        if dob:
            profile.date_of_birth = dob
        profile.save()

        from datetime import timedelta
        from django.utils import timezone
        from marketplace.models import Subscription, SubscriptionTier
        customer_tier = SubscriptionTier.objects.filter(tier_level='customer').first()
        if customer_tier:
            Subscription.objects.create(
                user=user,
                tier=customer_tier,
                is_active=True,
                start_date=timezone.now(),
                end_date=timezone.now() + timedelta(days=customer_tier.duration)
            )
        
        refresh = CustomTokenObtainPairSerializer.get_token(user)
        data = {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user_id': user.id,
            'username': user.username,
            'is_staff': user.is_staff or user.is_superuser,
            'is_superuser': user.is_superuser,
            'is_verified': False,
            'tier': profile.tier,
            'terms_accepted': True,
            'is_inspector': False,
            'inspector_level': None
        }
        return Response(data, status=status.HTTP_201_CREATED)

from .models import SponsoredListing
from .serializers import SponsoredListingSerializer

class UserProfileViewSet(viewsets.ModelViewSet):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    lookup_field = 'user__username'

    def get_queryset(self):
        return UserProfile.objects.select_related('user').prefetch_related('store_images')

    def get_object(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_val = self.kwargs.get(lookup_url_kwarg)
        if not lookup_val:
            return super().get_object()
        from django.http import Http404
        queryset = self.filter_queryset(self.get_queryset())
        obj = queryset.filter(user__username__iexact=lookup_val).first()
        if not obj:
            raise Http404("No UserProfile matches the given query.")
        self.check_object_permissions(self.request, obj)
        return obj

    def list(self, request, *args, **kwargs):
        q = request.query_params.get('q', '').strip().lower()
        if not q:
            return super().list(request, *args, **kwargs)
            
        from django.core.cache import cache
        cache_key = 'searchable_user_profiles'
        cached_profiles = cache.get(cache_key)
        
        if cached_profiles is None:
            profiles = UserProfile.objects.filter(user__is_active=True).select_related('user')
            cached_profiles = []
            for p in profiles:
                cached_profiles.append({
                    'id': p.id,
                    'username': p.user.username,
                    'tier': p.tier,
                    'is_verified': p.is_verified,
                    'profile_picture': p.profile_picture.url if p.profile_picture else None,
                })
            cache.set(cache_key, cached_profiles, timeout=86400 * 7)
            
        # Perform in-memory text matching
        results = [
            p for p in cached_profiles
            if q in p['username'].lower()
        ]
        
        # Sort so exact matches are first, then prefix, then anywhere
        results.sort(key=lambda p: (
            0 if p['username'].lower() == q else
            1 if p['username'].lower().startswith(q) else
            2
        ))
        
        page = self.paginate_queryset(results)
        if page is not None:
            return self.get_paginated_response(page)
            
        return Response(results)

    def get_permissions(self):  # FIX: S-07
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsOwnerOrStaff()]
        return super().get_permissions()

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def follow(self, request, **kwargs):
        from .models import Follow
        profile = self.get_object()
        if profile.user == request.user:
            return Response({'error': 'Cannot follow yourself'}, status=400)
        _, created = Follow.objects.get_or_create(follower=request.user, following=profile)
        return Response({'following': True, 'followers_count': profile.get_followers_count(), 'created': created})

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def unfollow(self, request, **kwargs):
        from .models import Follow
        profile = self.get_object()
        Follow.objects.filter(follower=request.user, following=profile).delete()
        return Response({'following': False, 'followers_count': profile.get_followers_count()})

    @decorators.action(detail=True, methods=['get'])
    def follow_status(self, request, **kwargs):
        from .models import Follow
        profile = self.get_object()
        if not request.user.is_authenticated:
            return Response({'following': False})
        return Response({
            'following': Follow.objects.filter(follower=request.user, following=profile).exists(),
            'followers_count': profile.get_followers_count(),
            'following_count': profile.get_following_count(),
        })

    @decorators.action(detail=True, methods=['get'])
    def followers(self, request, **kwargs):
        from .models import Follow, UserProfile
        profile = self.get_object()
        followers_users = Follow.objects.filter(following=profile).values_list('follower', flat=True)
        followers_profiles = UserProfile.objects.filter(user__in=followers_users)
        
        page = self.paginate_queryset(followers_profiles)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(followers_profiles, many=True)
        return Response(serializer.data)

    @decorators.action(detail=True, methods=['get'])
    def following(self, request, **kwargs):
        from .models import Follow, UserProfile
        profile = self.get_object()
        following_profiles_ids = Follow.objects.filter(follower=profile.user).values_list('following', flat=True)
        following_profiles = UserProfile.objects.filter(id__in=following_profiles_ids)
        
        page = self.paginate_queryset(following_profiles)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(following_profiles, many=True)
        return Response(serializer.data)

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def upload_store_image(self, request, **kwargs):
        profile = self.get_object()
        if profile.user != request.user and not request.user.is_staff:
            return Response({'error': 'You do not have permission to manage this profile.'}, status=status.HTTP_403_FORBIDDEN)
        
        if profile.store_images.count() >= 9:
            return Response({'error': 'You can only upload up to 9 store images.'}, status=status.HTTP_400_BAD_REQUEST)
        
        image_file = request.FILES.get('image')
        if not image_file:
            return Response({'error': 'No image file provided.'}, status=status.HTTP_400_BAD_REQUEST)
        
        from .models import StoreImage
        from .serializers import StoreImageSerializer
        store_img = StoreImage.objects.create(profile=profile, image=image_file)
        return Response(StoreImageSerializer(store_img).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def delete_store_image(self, request, **kwargs):
        profile = self.get_object()
        if profile.user != request.user and not request.user.is_staff:
            return Response({'error': 'You do not have permission to manage this profile.'}, status=status.HTTP_403_FORBIDDEN)
        
        image_id = request.data.get('image_id')
        if not image_id:
            return Response({'error': 'No image ID provided.'}, status=status.HTTP_400_BAD_REQUEST)
        
        from .models import StoreImage
        try:
            store_img = profile.store_images.get(id=image_id)
            store_img.image.delete(save=False)
            store_img.delete()
            return Response({'status': 'success'})
        except StoreImage.DoesNotExist:
            return Response({'error': 'Image not found.'}, status=status.HTTP_404_NOT_FOUND)

class SponsoredListingViewSet(viewsets.ModelViewSet):
    serializer_class = SponsoredListingSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.IsAuthenticated(), IsSellerOrAbove()]
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsOwnerOrStaff()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        from django.utils import timezone as tz
        is_public = self.request.query_params.get('public', 'false').lower() == 'true'
        category_slug = self.request.query_params.get('subcategory') or self.request.query_params.get('category', None)
        query = self.request.query_params.get('q', None)

        if is_public:
            qs = SponsoredListing.objects.select_related(
                'product', 'product__category', 'product__seller'
            ).prefetch_related(
                'product__images', 'product__likes'
            ).filter(
                status='approved'
            ).filter(
                django_models.Q(expires_at__isnull=True) | django_models.Q(expires_at__gt=tz.now())
            )
            
            if category_slug:
                from .models import Category
                try:
                    cat = Category.objects.get(slug=category_slug)
                    descendants = cat.get_descendants(include_self=True)
                    qs = qs.filter(product__category__in=descendants)
                except Category.DoesNotExist:
                    qs = qs.filter(product__category__slug=category_slug)
            
            if query:
                from django.db import connection
                if connection.vendor == 'postgresql':
                    from django.contrib.postgres.search import SearchVector, SearchQuery
                    search_vector = SearchVector('product__name', weight='A') + SearchVector('product__description', weight='B')
                    search_query = SearchQuery(query, search_type='websearch')
                    qs = qs.annotate(search=search_vector).filter(search=search_query)
                else:
                    qs = qs.filter(django_models.Q(product__name__icontains=query) | django_models.Q(product__description__icontains=query))

            return qs.order_by('-created_at')

        if user.is_staff:
            return SponsoredListing.objects.all().order_by('-created_at')
        if user.is_authenticated:
            return SponsoredListing.objects.filter(user=user).order_by('-created_at')
        return SponsoredListing.objects.filter(
            status='approved'
        ).filter(
            django_models.Q(expires_at__isnull=True) | django_models.Q(expires_at__gt=tz.now())
        ).order_by('-created_at')

    def get_object(self):  # FIX: S-08 — enforce queryset scope on detail views
        obj = super().get_object()
        user = self.request.user
        if not user.is_authenticated and obj.status != 'approved':
            from rest_framework.exceptions import NotFound
            raise NotFound()
        if user.is_authenticated and not user.is_staff and obj.user != user and obj.status != 'approved':
            from rest_framework.exceptions import NotFound
            raise NotFound()
        return obj

    def perform_create(self, serializer):
        duration_days = serializer.validated_data.get('duration_days', 7)
        amount = duration_days * 1000
        serializer.save(user=self.request.user, amount=amount)


class VerifySuperuserRateThrottle(AnonRateThrottle):
    scope = 'verify_superuser'

# ─── FIX D-02/D-03: ForwardAuth endpoint for Traefik ───────────────
class VerifySuperuserView(APIView):
    """ForwardAuth endpoint: returns 200 for valid superuser JWT, else 401/403."""
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [VerifySuperuserRateThrottle]

    def get(self, request):
        from rest_framework_simplejwt.authentication import JWTAuthentication
        jwt_auth = JWTAuthentication()
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header:
            return Response({'error': 'No authorization header'}, status=401)
        try:
            raw_token = auth_header.split(' ')[-1] if ' ' in auth_header else auth_header
            from rest_framework_simplejwt.tokens import UntypedToken
            validated_token = jwt_auth.get_validated_token(raw_token)
            user = jwt_auth.get_user(validated_token)
        except Exception:
            return Response({'error': 'Invalid token'}, status=401)
        if not user.is_superuser:
            return Response({'error': 'Superuser access required'}, status=403)
        return Response({'status': 'ok'})


# ─── FIX B-11: Notification ViewSet ───────────────────────────────
class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'delete']

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @decorators.action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'all marked read'})

    @decorators.action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({'count': count})

    @decorators.action(detail=False, methods=['delete'])
    def clear_all(self, request):
        Notification.objects.filter(user=request.user).delete()
        return Response({'status': 'all cleared'})


class MobileNetworkViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MobileNetwork.objects.all()
    serializer_class = MobileNetworkSerializer
    authentication_classes = []
    permission_classes = [permissions.AllowAny]


# ─── FIX B-12: Conversation ViewSet ───────────────────────────────
class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post']

    def get_queryset(self):
        user = self.request.user
        from uzachuo.permissions import get_effective_sellers
        sellers = get_effective_sellers(user, required_permission='manage_messages')
        return Conversation.objects.filter(
            Q(buyer=user) | Q(seller=user) | Q(seller_id__in=sellers)
        ).select_related(
            'buyer', 'buyer__profile', 'seller', 'seller__profile', 'product'
        ).prefetch_related(
            'product__images',
            Prefetch('messages', queryset=Message.objects.select_related('sender').order_by('-created_at'), to_attr='prefetched_messages')
        ).annotate(
            annotated_unread_count=Count('messages', filter=Q(messages__is_read=False) & ~Q(messages__sender=user), distinct=True)
        ).order_by('-updated_at')

    def list(self, request, *args, **kwargs):
        from django.core.cache import cache
        queryset = self.filter_queryset(self.get_queryset())
        convs = list(queryset)

        # Bulk fetch user presence to eliminate sequential Redis queries
        user_ids = set()
        for c in convs:
            other_id = c.seller_id if c.buyer_id == request.user.id else c.buyer_id
            if other_id:
                user_ids.add(other_id)

        presence_keys = [f'user:seen:{uid}' for uid in user_ids]
        seen_data = cache.get_many(presence_keys) if presence_keys else {}

        presence_map = {}
        for uid in user_ids:
            key = f'user:seen:{uid}'
            is_online = key in seen_data
            last_seen = seen_data.get(key)
            presence_map[uid] = {'is_online': is_online, 'last_seen': last_seen}

        serializer = self.get_serializer(convs, many=True, context={'request': request, 'presence_map': presence_map})
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        seller_id = request.data.get('seller')
        product_id = request.data.get('product')

        if str(seller_id) == str(request.user.id):
            return Response(
                {'error': 'You cannot start a conversation with yourself.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Build lookup query for this specific buyer-seller pair
        base_q = Q(buyer=request.user, seller_id=seller_id) | Q(buyer_id=seller_id, seller=request.user)

        if product_id:
            # Product-initiated: find existing conversation for THIS specific product
            conv = Conversation.objects.filter(base_q, product_id=product_id).first()
        else:
            # Profile-initiated (no product): find existing general conversation (no product)
            conv = Conversation.objects.filter(base_q, product__isnull=True).first()

        if not conv:
            conv = Conversation.objects.create(
                buyer=request.user, seller_id=seller_id, product_id=product_id
            )

        return Response(ConversationSerializer(conv, context={'request': request}).data)

    @decorators.action(detail=True, methods=['post'])
    def read(self, request, pk=None):
        conv = self.get_object()
        from uzachuo.permissions import get_effective_sellers
        sellers = get_effective_sellers(request.user, required_permission='manage_messages')
        is_participant = conv.buyer == request.user or conv.seller == request.user or conv.seller_id in sellers
        if not is_participant:
            return Response(status=403)
            
        unread_msgs = Message.objects.filter(conversation=conv, is_read=False).exclude(sender=request.user)
        unread_ids = list(unread_msgs.values_list('id', flat=True))
        if unread_ids:
            unread_msgs.update(is_read=True, is_delivered=True)
            try:
                from channels.layers import get_channel_layer
                from asgiref.sync import async_to_sync
                other = conv.seller if request.user == conv.buyer else conv.buyer
                channel_layer = get_channel_layer()
                async_to_sync(channel_layer.group_send)(
                    f'chat_{other.id}',
                    {
                        'type': 'chat_read_update',
                        'conversation_id': conv.id,
                        'message_ids': unread_ids,
                    }
                )
            except Exception:
                pass
        return Response({'status': 'ok'})

    @decorators.action(detail=True, methods=['get', 'post'])
    def messages(self, request, pk=None):
        conv = self.get_object()
        from uzachuo.permissions import get_effective_sellers
        sellers = get_effective_sellers(request.user, required_permission='manage_messages')
        is_participant = conv.buyer == request.user or conv.seller == request.user or conv.seller_id in sellers
        if not is_participant:
            return Response(status=403)
        if request.method == 'POST':
            # Create a mutable copy of request data or just set the conversation
            data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
            data['conversation'] = conv.id
            serializer = MessageSerializer(data=data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            msg = serializer.save(sender=request.user)
            
            conv.save()  # bump updated_at
            other = conv.seller if request.user == conv.buyer else conv.buyer
            push_notification(other, 'new_message',
                f'New message from {request.user.username}',
                msg.content[:100], f'/messages/{conv.id}')
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            from .serializers import MessageSerializer as MsgSerializer

            channel_layer = get_channel_layer()
            try:
                async_to_sync(channel_layer.group_send)(
                    f'chat_{other.id}',
                    {
                        'type': 'chat_message',
                        'conversation_id': conv.id,
                        'message': MsgSerializer(msg).data,
                    }
                )
            except Exception:
                pass  # WS delivery is best-effort; REST response still returns

            return Response(MessageSerializer(msg, context={'request': request}).data, status=201)

        # Mark unread messages as read asynchronously without blocking response
        unread_msgs = Message.objects.filter(conversation=conv, is_read=False).exclude(sender=request.user)
        unread_ids = list(unread_msgs.values_list('id', flat=True))
        if unread_ids:
            unread_msgs.update(is_read=True, is_delivered=True)
            try:
                from channels.layers import get_channel_layer
                from asgiref.sync import async_to_sync
                other = conv.seller if request.user == conv.buyer else conv.buyer
                channel_layer = get_channel_layer()
                async_to_sync(channel_layer.group_send)(
                    f'chat_{other.id}',
                    {
                        'type': 'chat_read_update',
                        'conversation_id': conv.id,
                        'message_ids': unread_ids,
                    }
                )
            except Exception:
                pass

        # Fetch last 50 messages with sender joined, and order chronologically
        msgs = conv.messages.select_related('sender').order_by('-created_at')[:50]
        msgs = sorted(list(msgs), key=lambda x: x.created_at)
        return Response(MessageSerializer(msgs, many=True, context={'request': request}).data)


# ─── FIX B-13: Saved Searches & Price Alerts ─────────────────────
class SavedSearchViewSet(viewsets.ModelViewSet):
    serializer_class = SavedSearchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SavedSearch.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PriceAlertViewSet(viewsets.ModelViewSet):
    serializer_class = PriceAlertSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PriceAlert.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ─── FIX B-15: Dispute ViewSet ───────────────────────────────────
class DisputeViewSet(viewsets.ModelViewSet):
    serializer_class = DisputeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Dispute.objects.all().select_related('order', 'opened_by')
        return Dispute.objects.filter(
            Q(opened_by=user) | Q(order__orderitem_set__product__seller=user)
        ).distinct()

    def perform_create(self, serializer):
        order = serializer.validated_data['order']
        if order.user != self.request.user:
            raise drf_serializers.ValidationError('You can only dispute your own orders.')
            
        allowed_statuses = ['DELIVERED', 'AWAITING_DELIVERY_PAYMENT', 'PAYMENT_VERIFIED', 'OUT_FOR_DELIVERY']
        if order.status not in allowed_statuses:
            raise drf_serializers.ValidationError('Can only dispute orders in DELIVERED or in-transit statuses.')
            
        serializer.save(opened_by=self.request.user)
        
        action_mode = self.request.data.get('action_mode', 'halt')
        if action_mode == 'halt':
            from .services import OrderStateMachine
            OrderStateMachine.transition_order(order, 'DISPUTED', notes='Dispute opened by buyer and fulfillment paused.')
        first_item = order.orderitem_set.first()
        if first_item:
            push_notification(
                first_item.product.seller, 'order_status',
                'Dispute opened on your order',
                f'Order #{order.id} has been disputed.',
                f'/orders?highlight={order.id}'
            )

    @decorators.action(detail=True, methods=['post'], permission_classes=[IsStaffMember])
    def resolve(self, request, pk=None):
        """FIX HIGH-02: staff can resolve disputes."""
        dispute = self.get_object()
        if dispute.status not in ['open', 'under_review']:
            return Response({'error': 'Dispute is already resolved.'}, status=400)

        resolution = request.data.get('resolution')
        notes = request.data.get('notes', '')

        if resolution not in ['resolved_buyer', 'resolved_seller', 'closed']:
            return Response({'error': 'resolution must be: resolved_buyer, resolved_seller, or closed'}, status=400)

        dispute.status = resolution
        dispute.resolution_notes = notes
        dispute.resolved_at = timezone.now()
        dispute.assigned_staff = request.user
        dispute.save(update_fields=['status', 'resolution_notes', 'resolved_at', 'assigned_staff'])

        # Transition order based on resolution
        from .services import OrderStateMachine
        if resolution == 'resolved_buyer':
            try:
                OrderStateMachine.transition_order(
                    dispute.order, 'CANCELLED',
                    notes=f'Dispute resolved in buyer favour by {request.user.username}. {notes}'
                )
            except ValueError:
                pass
        elif resolution == 'resolved_seller':
            try:
                OrderStateMachine.transition_order(
                    dispute.order, 'COMPLETED',
                    notes=f'Dispute resolved in seller favour by {request.user.username}. {notes}'
                )
            except ValueError:
                pass

        # Notify buyer
        push_notification(
            dispute.opened_by, 'order_status',
            'Dispute Resolution',
            f'Your dispute has been resolved: {resolution.replace("_", " ").title()}. {notes}',
            f'/orders?highlight={dispute.order_id}'
        )

        return Response({'status': dispute.status, 'resolution_notes': dispute.resolution_notes})

    @decorators.action(detail=True, methods=['post'], permission_classes=[IsStaffMember])
    def assign(self, request, pk=None):
        """FIX HIGH-02: staff assign dispute to themselves."""
        dispute = self.get_object()
        dispute.assigned_staff = request.user
        dispute.status = 'under_review'
        dispute.save(update_fields=['assigned_staff', 'status'])
        return Response({'status': dispute.status, 'assigned_staff': request.user.username})


# ─── FIX B-21/B-22: Delivery Zone ViewSet ───────────────────────
class DeliveryZoneViewSet(viewsets.ModelViewSet):
    serializer_class = DeliveryZoneSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.IsAuthenticated(), IsSellerOrAbove()]
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsOwnerOrStaff()]
        return super().get_permissions()

    def get_queryset(self):
        seller_username = self.request.query_params.get('seller')
        if seller_username:
            return DeliveryZone.objects.filter(
                seller__username=seller_username, is_active=True
            )
        if self.request.user.is_authenticated:
            return DeliveryZone.objects.filter(seller=self.request.user)
        return DeliveryZone.objects.none()

    def perform_create(self, serializer):
        serializer.save(seller=self.request.user)


# ─── FIX B-18: Site Settings View ───────────────────────────────
class SiteSettingsView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        return Response(SiteSettingsSerializer(SiteSettings.get()).data)


# ─── FIX HIGH-04: ProductVariantViewSet ──────────────────────────────
class ProductVariantViewSet(viewsets.ModelViewSet):
    """FIX CRIT-02: public read for buyers, auth required for seller write."""
    serializer_class = ProductVariantSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsSellerOrAbove()]

    def get_queryset(self):
        product_id = self.request.query_params.get('product')
        product_slug = self.request.query_params.get('product_slug')
        user = self.request.user

        if product_slug:
            qs = ProductVariant.objects.filter(
                product__slug=product_slug
            ).select_related('product')
            if not (user.is_authenticated and (user.is_staff or
                    ProductVariant.objects.filter(product__slug=product_slug, product__seller=user).exists())):
                qs = qs.filter(is_available=True)
            return qs

        if product_id:
            # Public: any visitor can see variants for a product
            qs = ProductVariant.objects.filter(
                product_id=product_id
            ).select_related('product')
            # Non-staff non-owners only see available variants
            if not (user.is_authenticated and (user.is_staff or
                    ProductVariant.objects.filter(product_id=product_id, product__seller=user).exists())):
                qs = qs.filter(is_available=True)
            return qs

        if user.is_authenticated:
            if user.is_staff:
                return ProductVariant.objects.all().select_related('product')
            return ProductVariant.objects.filter(product__seller=user).select_related('product')

        return ProductVariant.objects.none()

    def perform_create(self, serializer):
        product = serializer.validated_data['product']
        if product.seller != self.request.user and not self.request.user.is_staff:
            from rest_framework import serializers as drf_serializers
            raise drf_serializers.ValidationError('You do not own this product.')
        serializer.save()

from datetime import timedelta
from django.utils import timezone

class TrendingAnalyticsView(APIView):
    """
    Returns realistic platform analytics for the Trending Page.
    Publicly accessible.
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.core.cache import cache
        cache_key = 'trending_analytics_v2'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)
        seven_days_ago = now - timedelta(days=7)
        
        # 1. Active Users: Users who logged in within the last 30 days
        from django.contrib.auth.models import User
        active_users_count = User.objects.filter(last_login__gte=thirty_days_ago).count()

        # 2. Products Sold: Sum of quantities in completed/paid orders
        products_sold_dict = OrderItem.objects.filter(
            order__status__in=['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED']
        ).aggregate(total=Sum('quantity'))
        products_sold = products_sold_dict['total'] or 0

        # 3. Weekly Visits (proxy): Unique users who logged in the last 7 days
        weekly_visits = User.objects.filter(last_login__gte=seven_days_ago).count()

        # 4. Top Categories by Interest (Market Share)
        # We annotate categories with their product count.
        top_categories = Category.objects.annotate(
            product_count=Count('products')
        ).filter(product_count__gt=0).order_by('-product_count')[:5]
        
        cat_data = [
            {"name": c.name, "value": c.product_count} for c in top_categories
        ]

        # 5. Trending Products
        from django.db.models.functions import Coalesce
        from decimal import Decimal
        from django.db.models import DecimalField

        weekly_order_ids = Order.objects.filter(
            order_date__gte=seven_days_ago,
            status__in=['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED']
        ).values_list('id', flat=True)
        
        # Simple two-step process to avoid complex annotation errors
        trending_products = Product.objects.select_related('category', 'seller').prefetch_related('images', 'likes').filter(is_available=True)
        
        # We can sort by simple attributes and then limit to 8
        trending_products = trending_products.annotate(
            like_count=Count('likes', distinct=True)
        )
        
        # Top sellers based on order items
        order_items = OrderItem.objects.filter(order__in=weekly_order_ids).values('product_id').annotate(qty=Sum('quantity'))
        sales_dict = {item['product_id']: item['qty'] for item in order_items}
        
        top_sellers_qs = list(trending_products)
        top_sellers_qs.sort(key=lambda p: (sales_dict.get(p.id, 0), p.like_count, p.created_at), reverse=True)
        top_sellers_qs = top_sellers_qs[:8]
        
        most_saved_qs = trending_products.order_by('-like_count', '-created_at')[:8]
        newest_trending_qs = trending_products.order_by('-created_at', '-like_count')[:8]
        
        top_sellers_serialized = ProductSerializer(
            top_sellers_qs, many=True, context={'request': request}
        ).data
        most_saved_serialized = ProductSerializer(
            most_saved_qs, many=True, context={'request': request}
        ).data
        newest_trending_serialized = ProductSerializer(
            newest_trending_qs, many=True, context={'request': request}
        ).data

        trending_dict = {
            "top_sellers": top_sellers_serialized,
            "most_saved": most_saved_serialized,
            "newest_trending": newest_trending_serialized
        }

        result = {
            "stats": {
                "weekly_visits": weekly_visits,
                "active_users": active_users_count,
                "products_sold": products_sold,
                "hot_categories": Category.objects.annotate(pc=Count('products')).filter(pc__gt=0).count()
            },
            "top_categories": cat_data,
            "trending_products": trending_dict
        }

        # Cache for 1 minute (60 seconds) to avoid hammering the DB
        cache.set(cache_key, result, 60)

        return Response(result)


# --- Subscription ViewSets ---
class SubscriptionTierViewSet(viewsets.ReadOnlyModelViewSet):
    from .models import SubscriptionTier
    queryset = SubscriptionTier.objects.filter(is_active=True)
    from .serializers import SubscriptionTierSerializer
    serializer_class = SubscriptionTierSerializer
    authentication_classes = []
    permission_classes = [permissions.AllowAny]


class UserSubscriptionViewSet(viewsets.ReadOnlyModelViewSet):
    from .serializers import SubscriptionSerializer
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from .models import Subscription
        return Subscription.objects.filter(user=self.request.user).select_related('tier').order_by('-start_date')

    @decorators.action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        sub = self.get_queryset().first()
        if not sub:
            return Response({'status': 'none'}, status=200)
        serializer = self.get_serializer(sub)
        return Response(serializer.data)

    @decorators.action(detail=False, methods=['post'], url_path='cancel')
    def cancel(self, request):
        from .models import Subscription, UserProfile
        active_subs = Subscription.objects.filter(user=request.user, is_active=True)
        if not active_subs.exists():
            return Response({'error': 'No active subscription found to cancel.'}, status=400)
        
        # Deactivate all active subscriptions
        active_subs.update(is_active=False)
        
        # Reset UserProfile tier
        try:
            profile = request.user.profile
            profile.tier = 'customer'
            profile.save(update_fields=['tier'])
        except UserProfile.DoesNotExist:
            pass
            
        return Response({'message': 'Subscription cancelled successfully.'})


class PromoCodeViewSet(viewsets.ModelViewSet):
    from .models import PromoCode
    from .serializers import PromoCodeSerializer
    serializer_class = PromoCodeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from .models import PromoCode
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return PromoCode.objects.all().order_by('-created_at')
        return PromoCode.objects.filter(seller=user).order_by('-created_at')

    def perform_create(self, serializer):
        from rest_framework import serializers
        profile = self.request.user.profile
        if profile.tier not in ['seller_pro', 'business']:
            raise serializers.ValidationError("Only sellers with a premium subscription (Seller Pro or Business) can create promo codes.")
        serializer.save(seller=self.request.user)

    @decorators.action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated], url_path='validate')
    def validate_code(self, request):
        from decimal import Decimal
        from .models import PromoCode
        
        code = request.data.get('code')
        merchant_username = request.data.get('merchant')
        subtotal_str = request.data.get('subtotal')

        if not code:
            return Response({'valid': False, 'error': 'Code is required.'}, status=400)
        if not merchant_username:
            return Response({'valid': False, 'error': 'Merchant username is required.'}, status=400)
        if not subtotal_str:
            return Response({'valid': False, 'error': 'Subtotal is required.'}, status=400)

        try:
            subtotal = Decimal(str(subtotal_str))
        except Exception:
            return Response({'valid': False, 'error': 'Invalid subtotal.'}, status=400)

        try:
            promo = PromoCode.objects.get(code__iexact=code)
        except PromoCode.DoesNotExist:
            return Response({'valid': False, 'error': 'Promo code does not exist.'}, status=400)

        is_valid, err_msg = promo.is_valid_for_checkout(merchant_username, subtotal)
        if not is_valid:
            return Response({'valid': False, 'error': err_msg}, status=400)

        discount_amount = promo.calculate_discount(subtotal)
        return Response({
            'valid': True,
            'code': promo.code,
            'discount_type': promo.discount_type,
            'value': float(promo.value),
            'discount_amount': float(discount_amount)
        })


class UserPaymentConfirmationViewSet(viewsets.ModelViewSet):
    from .models import PaymentConfirmation
    from .serializers import UserPaymentConfirmationSerializer
    serializer_class = UserPaymentConfirmationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from .models import PaymentConfirmation
        return PaymentConfirmation.objects.filter(user=self.request.user).select_related('tier').order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SellerApplicationViewSet(viewsets.ModelViewSet):
    from .models import SellerApplication
    from .serializers import SellerApplicationSerializer
    serializer_class = SellerApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from .models import SellerApplication
        return SellerApplication.objects.filter(user=self.request.user).select_related('requested_tier').order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @decorators.action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        application = self.get_queryset().first()
        if not application:
            return Response({'status': 'none'}, status=200)
        serializer = self.get_serializer(application)
        return Response(serializer.data)


class TeamRolePresetsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        from .models import TEAM_ROLE_PRESETS
        return Response(TEAM_ROLE_PRESETS)

class TeamMemberViewSet(viewsets.ModelViewSet):
    from .models import TeamMember
    from .serializers import TeamMemberSerializer
    serializer_class = TeamMemberSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from .models import TeamMember
        user = self.request.user
        return TeamMember.objects.filter(
            Q(owner=user) | Q(user=user)
        ).select_related('owner', 'user').order_by('-created_at')

    def perform_destroy(self, instance):
        if instance.owner != self.request.user and instance.user != self.request.user:
            from rest_framework import exceptions
            raise exceptions.PermissionDenied("Only the team owner or the team member themselves can remove this membership.")
            
        from .models import TeamMemberAuditLog
        TeamMemberAuditLog.objects.create(
            owner=instance.owner, target_user=instance.user, performed_by=self.request.user,
            action='removed', detail={}
        )
        user = instance.user
        instance.delete()

        # Revert user profile tier to customer if they have no other accepted memberships
        from marketplace.models import TeamMember
        has_other = TeamMember.objects.filter(user=user, invitation_status='accepted', is_active=True).exists()
        if not has_other:
            profile = user.profile
            if profile.tier == 'worker':
                profile.tier = 'customer'
                profile.save(update_fields=['tier'])

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.owner != self.request.user:
            from rest_framework import exceptions
            raise exceptions.PermissionDenied("Only the team owner can modify team member permissions.")
            
        before = dict(instance.permissions)
        updated = serializer.save()
        from .models import TeamMemberAuditLog
        TeamMemberAuditLog.objects.create(
            owner=instance.owner, target_user=instance.user, performed_by=self.request.user,
            action='permissions_changed', detail={'before': before, 'after': dict(updated.permissions)}
        )

    @decorators.action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        member = self.get_object()
        if member.user != request.user:
            return Response({'error': 'Only the invited user can accept this invitation.'}, status=403)
        member.invitation_status = 'accepted'
        
        from django.utils import timezone
        member.responded_at = timezone.now()
        member.save(update_fields=['invitation_status', 'responded_at'])
        
        # Transition user profile tier to worker
        profile = member.user.profile
        profile.tier = 'worker'
        profile.save(update_fields=['tier'])
        
        from .models import TeamMemberAuditLog
        TeamMemberAuditLog.objects.create(
            owner=member.owner, target_user=member.user, performed_by=request.user,
            action='accepted', detail={}
        )
        return Response({'status': 'accepted'})

    @decorators.action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        member = self.get_object()
        if member.user != request.user:
            return Response({'error': 'Only the invited user can decline this invitation.'}, status=403)
        member.invitation_status = 'declined'
        
        from django.utils import timezone
        member.responded_at = timezone.now()
        member.save(update_fields=['invitation_status', 'responded_at'])
        
        # Revert user profile tier to customer if they have no other accepted memberships
        from marketplace.models import TeamMember
        has_other = TeamMember.objects.filter(user=member.user, invitation_status='accepted', is_active=True).exists()
        if not has_other:
            profile = member.user.profile
            if profile.tier == 'worker':
                profile.tier = 'customer'
                profile.save(update_fields=['tier'])
        
        from .models import TeamMemberAuditLog
        TeamMemberAuditLog.objects.create(
            owner=member.owner, target_user=member.user, performed_by=request.user,
            action='declined', detail={}
        )
        return Response({'status': 'declined'})

    @decorators.action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        """Business Owner: reset password for a team member directly."""
        member = self.get_object()
        if member.owner != request.user and not request.user.is_superuser:
            return Response({'error': 'Only the business owner can reset passwords for team members.'}, status=403)
        
        from .serializers import TeamMemberPasswordResetSerializer
        serializer = TeamMemberPasswordResetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        
        new_password = serializer.validated_data['new_password']
        member.user.set_password(new_password)
        member.user.save()

        from .models import TeamMemberAuditLog
        TeamMemberAuditLog.objects.create(
            owner=member.owner,
            target_user=member.user,
            performed_by=request.user,
            action='password_reset',
            detail={'target_username': member.user.username}
        )
        return Response({'status': 'password_reset_success', 'message': f'Password for {member.user.username} has been updated successfully.'})

    @decorators.action(detail=True, methods=['post'], url_path='toggle-suspend')
    def toggle_suspend(self, request, pk=None):
        """Business Owner: toggle suspend/reactivate for a team member."""
        member = self.get_object()
        if member.owner != request.user and not request.user.is_superuser:
            return Response({'error': 'Only the business owner can suspend or reactivate team members.'}, status=403)
        
        member.is_active = not member.is_active
        member.save(update_fields=['is_active'])

        action_name = 'reactivated' if member.is_active else 'suspended'
        from .models import TeamMemberAuditLog
        TeamMemberAuditLog.objects.create(
            owner=member.owner,
            target_user=member.user,
            performed_by=request.user,
            action=action_name,
            detail={'is_active': member.is_active}
        )
        return Response({
            'status': 'success',
            'is_active': member.is_active,
            'message': f'Team member @{member.user.username} is now {"active" if member.is_active else "suspended"}.'
        })

    @decorators.action(detail=True, methods=['post'], url_path='transfer-role')
    def transfer_role(self, request, pk=None):
        """Business Owner: transfer role & permissions from one member to another."""
        member = self.get_object()
        if member.owner != request.user and not request.user.is_superuser:
            return Response({'error': 'Only the business owner can transfer team roles.'}, status=403)
        
        from .serializers import TeamMemberTransferSerializer
        serializer = TeamMemberTransferSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        
        target_user = serializer.validated_data['target_username']
        if target_user == member.owner:
            return Response({'error': 'Cannot transfer role to the business owner.'}, status=400)
        if target_user == member.user:
            return Response({'error': 'Source and target user are the same.'}, status=400)

        # Check target user profile tier
        target_profile = getattr(target_user, 'profile', None)
        if target_profile and target_profile.tier not in ['customer', 'worker']:
            return Response({'error': 'Target user must have a regular customer or worker account.'}, status=400)

        # Update or create target membership
        from .models import TeamMember, TeamMemberAuditLog
        target_member, created = TeamMember.objects.get_or_create(
            owner=member.owner,
            user=target_user,
            defaults={
                'permissions': dict(member.permissions),
                'role_preset': member.role_preset,
                'invitation_status': 'accepted',
                'is_active': True,
                'created_by_owner': True,
                'contact_phone': member.contact_phone
            }
        )
        if not created:
            target_member.permissions = dict(member.permissions)
            target_member.role_preset = member.role_preset
            target_member.is_active = True
            target_member.invitation_status = 'accepted'
            target_member.save()

        if target_profile:
            target_profile.tier = 'worker'
            target_profile.save(update_fields=['tier'])

        # Deactivate / remove old member
        old_user = member.user
        member.is_active = False
        member.save(update_fields=['is_active'])

        TeamMemberAuditLog.objects.create(
            owner=member.owner,
            target_user=target_user,
            performed_by=request.user,
            action='transferred',
            detail={
                'from_user': old_user.username,
                'to_user': target_user.username,
                'role_preset': member.role_preset,
                'permissions': dict(member.permissions)
            }
        )
        return Response({
            'status': 'transfer_success',
            'message': f'Role {member.role_preset} successfully transferred from @{old_user.username} to @{target_user.username}.'
        })

    @decorators.action(detail=False, methods=['get'], url_path='my-team-info')
    def my_team_info(self, request):
        """Team Member: get detailed team context and permissions."""
        from .models import TeamMember, TEAM_ROLE_PRESETS
        member = TeamMember.objects.filter(user=request.user, invitation_status='accepted').select_related('owner', 'owner__profile').first()
        if not member:
            return Response({'is_team_member': False, 'message': 'No active team membership found.'}, status=200)

        owner = member.owner
        is_owner_business = (
            getattr(getattr(owner, 'profile', None), 'tier', None) == 'business' or
            owner.subscriptions.filter(is_active=True, tier__tier_level='business').exists() or
            owner.is_superuser
        )
        role_preset = member.role_preset or 'custom'
        preset_info = TEAM_ROLE_PRESETS.get(role_preset, {
            'label': role_preset.replace('_', ' ').title(),
            'description': 'Custom team role',
            'tasks': []
        })

        return Response({
            'is_team_member': True,
            'membership_id': member.id,
            'owner_id': owner.id,
            'owner_username': owner.username,
            'business_name': getattr(getattr(owner, 'profile', None), 'bio', None) or owner.get_full_name() or owner.username,
            'business_email': owner.email,
            'role_preset': role_preset,
            'role_label': preset_info.get('label'),
            'role_description': preset_info.get('description'),
            'role_tasks': preset_info.get('tasks', []),
            'permissions': member.permissions if (member.is_active and is_owner_business) else {},
            'is_active': member.is_active,
            'is_owner_subscription_active': is_owner_business,
            'created_at': member.created_at.isoformat(),
        })

    @decorators.action(detail=False, methods=['get'], url_path='audit-log')
    def audit_log(self, request):
        from .models import TeamMemberAuditLog
        from .serializers import TeamMemberAuditLogSerializer
        entries = TeamMemberAuditLog.objects.filter(owner=request.user).select_related('target_user', 'performed_by').order_by('-created_at')[:200]
        serializer = TeamMemberAuditLogSerializer(entries, many=True)
        return Response(serializer.data)

# --- Web Push Subscription Views ---
class PushSubscriptionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from .models import PushSubscription
        data = request.data
        endpoint = data.get('endpoint')
        keys = data.get('keys', {})
        p256dh = keys.get('p256dh')
        auth = keys.get('auth')

        if not endpoint or not p256dh or not auth:
            return Response({'error': 'Invalid subscription data'}, status=400)

        try:
            sub, created = PushSubscription.objects.update_or_create(
                endpoint=endpoint,
                defaults={
                    'user': request.user,
                    'p256dh': p256dh,
                    'auth': auth
                }
            )
            return Response({'status': 'subscribed', 'id': sub.id})
        except Exception as e:
            from django.db import IntegrityError
            if isinstance(e, IntegrityError):
                # Race condition: another request already created this subscription
                try:
                    sub = PushSubscription.objects.get(endpoint=endpoint)
                    return Response({'status': 'subscribed', 'id': sub.id})
                except PushSubscription.DoesNotExist:
                    pass
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=500)

    def delete(self, request):
        from .models import PushSubscription
        endpoint = request.data.get('endpoint')
        if not endpoint:
            return Response({'error': 'Endpoint is required'}, status=400)
        
        PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
        return Response({'status': 'unsubscribed'})

class PushVapidKeyView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.conf import settings
        public_key = getattr(settings, 'WEBPUSH_VAPID_PUBLIC_KEY', None)
        if not public_key:
            return Response({'public_key': None})
        return Response({'public_key': public_key})


from .models import ProductRequest
from .serializers import ProductRequestSerializer
from django.contrib.auth.models import User

class ProductRequestViewSet(viewsets.ModelViewSet):
    queryset = ProductRequest.objects.all()
    serializer_class = ProductRequestSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        qs = ProductRequest.objects.select_related('seller', 'user', 'category', 'fulfilled_product').prefetch_related('votes')

        seller_username = self.request.query_params.get('seller_username') or self.request.query_params.get('seller')
        if seller_username:
            if str(seller_username).isdigit():
                qs = qs.filter(seller_id=int(seller_username))
            else:
                qs = qs.filter(seller__username__iexact=seller_username)

        seller_id = self.request.query_params.get('seller_id')
        if seller_id and str(seller_id).isdigit():
            qs = qs.filter(seller_id=int(seller_id))

        my_requests = self.request.query_params.get('my_requests') == 'true'
        if my_requests and user.is_authenticated:
            qs = qs.filter(user=user)

        my_votes = self.request.query_params.get('my_votes') == 'true'
        if my_votes and user.is_authenticated:
            qs = qs.filter(votes__user=user)

        is_fulfilled = self.request.query_params.get('is_fulfilled')
        if is_fulfilled is not None:
            if is_fulfilled.lower() == 'true':
                qs = qs.filter(is_fulfilled=True)
            elif is_fulfilled.lower() == 'false':
                qs = qs.filter(is_fulfilled=False)

        # Default fallback for seller dashboard
        if not seller_username and not seller_id and not my_requests and not my_votes and user.is_authenticated:
            if self.request.query_params.get('for_seller') == 'true':
                qs = qs.filter(seller=user)

        return qs.order_by('-request_count', '-last_requested')

    def create(self, request, *args, **kwargs):
        name = request.data.get('name', '').strip()
        seller_id = request.data.get('seller_id')
        seller_username = request.data.get('seller_username') or request.data.get('seller')
        
        if not name or (not seller_id and not seller_username):
            return Response({'error': 'name and seller_id/seller_username required'}, status=400)
            
        try:
            if seller_id and str(seller_id).isdigit():
                seller = User.objects.get(id=int(seller_id))
            else:
                seller = User.objects.get(username__iexact=seller_username)
        except User.DoesNotExist:
            return Response({'error': 'Seller not found'}, status=404)
            
        from marketplace.models import ProductRequestVote

        # Case insensitive check
        pr = ProductRequest.objects.filter(seller=seller, name__iexact=name).first()
        is_seller_creating = request.user.is_authenticated and request.user.id == seller.id
        
        if pr:
            if request.user.is_authenticated and not is_seller_creating:
                if not ProductRequestVote.objects.filter(request=pr, user=request.user).exists() and pr.user_id != request.user.id:
                    ProductRequestVote.objects.create(request=pr, user=request.user)
                
                # Exact distinct voter count
                distinct_votes = ProductRequestVote.objects.filter(request=pr).count()
                if pr.user_id and not ProductRequestVote.objects.filter(request=pr, user_id=pr.user_id).exists():
                    distinct_votes += 1
                pr.request_count = max(distinct_votes, 1)
                pr.save(update_fields=['request_count', 'last_requested'])
            
            serializer = self.get_serializer(pr)
            return Response(serializer.data, status=200)
        else:
            category_id = request.data.get('category')
            price = request.data.get('price') or request.data.get('target_price')
            
            pr = ProductRequest.objects.create(
                name=name,
                description=request.data.get('description', ''),
                seller=seller,
                user=request.user if request.user.is_authenticated else None,
                request_count=0 if is_seller_creating else 1,
                category_id=category_id if category_id else None,
                price=price if price else None,
                buying_price=request.data.get('buying_price') if request.data.get('buying_price') else None,
                condition=request.data.get('condition', 'New'),
                requires_quote=str(request.data.get('requires_quote', 'false')).lower() == 'true',
            )
            if 'image' in request.FILES:
                pr.image = request.FILES['image']
                pr.save()

            if request.user.is_authenticated and not is_seller_creating:
                ProductRequestVote.objects.get_or_create(request=pr, user=request.user)
                
            serializer = self.get_serializer(pr)
            return Response(serializer.data, status=201)

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def vote(self, request, pk=None):
        pr = self.get_object()
        user = request.user
        
        from marketplace.models import ProductRequestVote
        existing_vote = ProductRequestVote.objects.filter(request=pr, user=user).first()
        
        if existing_vote:
            # Unvote
            existing_vote.delete()
            voted = False
        else:
            # Vote
            ProductRequestVote.objects.create(request=pr, user=user)
            voted = True

        # Calculate exact distinct voters
        real_votes_count = ProductRequestVote.objects.filter(request=pr).count()
        if pr.user_id and not ProductRequestVote.objects.filter(request=pr, user_id=pr.user_id).exists():
            real_votes_count += 1
        
        pr.request_count = max(real_votes_count, 1 if pr.user_id else 0)
        pr.save(update_fields=['request_count', 'last_requested'])

        return Response({
            'id': pr.id,
            'has_voted': voted,
            'votes_count': pr.request_count,
            'request_count': pr.request_count,
            'message': "Interest recorded!" if voted else "Vote removed."
        })

class SellerAnalyticsView(APIView):
    """
    Returns analytics for the logged-in seller.
    Includes revenue, active listings, unfulfilled orders, and out-of-stock items.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        
        from django.core.cache import cache
        cache_key = f"seller_analytics_{user.id}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)

        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)
        
        # 1. Total Revenue (Last 30 Days)
        # Sum of order items sold by this seller in completed orders
        revenue_data = OrderItem.objects.filter(
            product__seller=user,
            order__status__in=['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'],
            order__order_date__gte=thirty_days_ago
        ).aggregate(total_revenue=Sum(F('quantity') * F('price')))
        total_revenue = float(revenue_data['total_revenue'] or 0.0)
        
        # 2. Active Listings
        active_listings_count = Product.objects.filter(seller=user, is_available=True).count()
        
        # 3. Unfulfilled Orders Count
        # Orders containing at least one product from this seller that are PAID but not SHIPPED
        unfulfilled_orders_count = Order.objects.filter(
            orderitem_set__product__seller=user,
            status='PAID'
        ).distinct().count()
        
        # 4. Out of stock products
        out_of_stock_count = Product.objects.filter(
            seller=user, 
            stock__lte=0, 
            is_available=True
        ).count()
        
        # 5. Top Selling Products
        top_products = Product.objects.filter(seller=user).annotate(
            sales=Sum(
                'orderitem__quantity', 
                filter=Q(orderitem__order__status__in=['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'])
            ),
            revenue=Sum(
                F('orderitem__quantity') * F('orderitem__price'),
                filter=Q(orderitem__order__status__in=['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'])
            )
        ).filter(sales__gt=0).order_by('-sales')[:5]
        
        top_selling_products = [
            {
                "name": p.name,
                "sales": float(p.sales or 0),
                "revenue": float(p.revenue or 0)
            } for p in top_products
        ]
        
        # 6. Recent Orders
        recent_orders = Order.objects.filter(
            orderitem_set__product__seller=user
        ).distinct().order_by('-order_date')[:5]
        
        recent_orders_data = [
            {
                "id": o.id,
                "date": o.order_date.isoformat(),
                "status": o.status,
                "total": float(o.total_amount)
            } for o in recent_orders
        ]
        
        response_data = {
            "total_revenue": total_revenue,
            "active_listings_count": active_listings_count,
            "unfulfilled_orders_count": unfulfilled_orders_count,
            "out_of_stock_count": out_of_stock_count,
            "top_selling_products": top_selling_products,
            "recent_orders": recent_orders_data
        }
        
        cache.set(cache_key, response_data, timeout=60)
        return Response(response_data)


class VehicleMakeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = VehicleMakeSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        qs = VehicleMake.objects.all()
        for_seller = self.request.query_params.get('for_seller') == 'true' or self.request.query_params.get('all') == 'true'
        has_products = self.request.query_params.get('has_products')
        category_slug = self.request.query_params.get('subcategory') or self.request.query_params.get('category')
        if not for_seller and (has_products == 'true' or has_products is None):
            fitment_filter = Q(
                vehicles__fitments__product__is_available=True,
                vehicles__fitments__product__stock__gt=0
            )
            if category_slug:
                from marketplace.models import Category
                try:
                    cat = Category.objects.get(slug=category_slug)
                    descendants = cat.get_descendants(include_self=True)
                    fitment_filter &= Q(vehicles__fitments__product__category__in=descendants)
                except Category.DoesNotExist:
                    fitment_filter &= Q(vehicles__fitments__product__category__slug=category_slug)
            qs = qs.filter(fitment_filter).distinct()
        return qs.order_by('name')

class VehicleModelViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = VehicleModelSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        qs = VehicleModel.objects.select_related('make').all()
        make_id = self.request.query_params.get('make_id')
        if make_id:
            qs = qs.filter(make_id=make_id)
        for_seller = self.request.query_params.get('for_seller') == 'true' or self.request.query_params.get('all') == 'true'
        has_products = self.request.query_params.get('has_products')
        category_slug = self.request.query_params.get('subcategory') or self.request.query_params.get('category')
        if not for_seller and (has_products == 'true' or has_products is None):
            fitment_filter = Q(
                vehicles__fitments__product__is_available=True,
                vehicles__fitments__product__stock__gt=0
            )
            if category_slug:
                from marketplace.models import Category
                try:
                    cat = Category.objects.get(slug=category_slug)
                    descendants = cat.get_descendants(include_self=True)
                    fitment_filter &= Q(vehicles__fitments__product__category__in=descendants)
                except Category.DoesNotExist:
                    fitment_filter &= Q(vehicles__fitments__product__category__slug=category_slug)
            qs = qs.filter(fitment_filter).distinct()
        return qs.order_by('name')

class VehicleViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = VehicleSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        qs = Vehicle.objects.select_related('make', 'model').all()
        make_id = self.request.query_params.get('make_id')
        model_id = self.request.query_params.get('model_id')
        year = self.request.query_params.get('year')
        if make_id: qs = qs.filter(make_id=make_id)
        if model_id: qs = qs.filter(model_id=model_id)
        if year: qs = qs.filter(year=year)
        for_seller = self.request.query_params.get('for_seller') == 'true' or self.request.query_params.get('all') == 'true'
        has_products = self.request.query_params.get('has_products')
        category_slug = self.request.query_params.get('subcategory') or self.request.query_params.get('category')
        if not for_seller and (has_products == 'true' or has_products is None):
            fitment_filter = Q(
                fitments__product__is_available=True,
                fitments__product__stock__gt=0
            )
            if category_slug:
                from marketplace.models import Category
                try:
                    cat = Category.objects.get(slug=category_slug)
                    descendants = cat.get_descendants(include_self=True)
                    fitment_filter &= Q(fitments__product__category__in=descendants)
                except Category.DoesNotExist:
                    fitment_filter &= Q(fitments__product__category__slug=category_slug)
            qs = qs.filter(fitment_filter).distinct()
        return qs

class BrandViewSet(viewsets.ModelViewSet):
    serializer_class = BrandSerializer
    search_fields = ['name']
    pagination_class = None

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        if self.action in ['create']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        from django.db.models import Count
        qs = Brand.objects.annotate(products_count_annotated=Count('products'))
        
        # Staff inspection view
        include_unverified = self.request.query_params.get('include_unverified') == 'true'
        only_unverified = self.request.query_params.get('only_unverified') == 'true'

        if only_unverified:
            return qs.filter(is_verified=False).order_by('-created_at', 'name')

        for_seller = self.request.query_params.get('for_seller') == 'true' or self.request.query_params.get('all') == 'true'
        has_products = self.request.query_params.get('has_products')
        category_slug = self.request.query_params.get('subcategory') or self.request.query_params.get('category')

        if not for_seller and (has_products == 'true' or has_products is None):
            prod_filter = Q(
                products__is_available=True,
                products__stock__gt=0
            )
            if category_slug:
                from marketplace.models import Category
                try:
                    cat = Category.objects.get(slug=category_slug)
                    descendants = cat.get_descendants(include_self=True)
                    prod_filter &= Q(products__category__in=descendants)
                except Category.DoesNotExist:
                    prod_filter &= Q(products__category__slug=category_slug)
            qs = qs.filter(prod_filter).distinct()
        
        if not include_unverified and not for_seller:
            qs = qs.filter(is_active=True)

        return qs.order_by('name')

    def perform_create(self, serializer):
        from django.utils.text import slugify
        raw_name = serializer.validated_data.get('name', '').strip()
        clean_name = " ".join(raw_name.split())
        clean_slug = slugify(clean_name) or "brand"
        is_staff = self.request.user.is_staff or self.request.user.is_superuser
        serializer.save(
            name=clean_name,
            slug=clean_slug,
            is_verified=is_staff,
            created_by=self.request.user
        )

    @action(detail=False, methods=['get'])
    def unverified(self, request):
        from django.db.models import Count
        unverified_brands = Brand.objects.filter(is_verified=False).annotate(
            products_count_annotated=Count('products')
        ).order_by('-created_at', 'name')
        return Response(BrandSerializer(unverified_brands, many=True).data)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        brand = self.get_object()
        brand.is_verified = True
        
        # Optional renaming / standardizing
        new_name = request.data.get('name')
        if new_name and isinstance(new_name, str) and new_name.strip():
            from django.utils.text import slugify
            clean_name = " ".join(new_name.strip().split())
            brand.name = clean_name
            brand.slug = slugify(clean_name) or brand.slug

        if 'logo' in request.FILES:
            brand.logo = request.FILES['logo']

        brand.save()
        return Response({
            'message': f"Brand '{brand.name}' verified successfully.",
            'brand': BrandSerializer(brand).data
        })

    @action(detail=False, methods=['post'])
    def merge(self, request):
        source_id = request.data.get('source_brand_id')
        target_id = request.data.get('target_brand_id')

        if not source_id or not target_id:
            return Response({'error': 'Both source_brand_id and target_brand_id are required.'}, status=400)

        if str(source_id) == str(target_id):
            return Response({'error': 'Source and target brand cannot be identical.'}, status=400)

        try:
            source_brand = Brand.objects.get(id=source_id)
            target_brand = Brand.objects.get(id=target_id)
        except Brand.DoesNotExist:
            return Response({'error': 'Source or target brand not found.'}, status=404)

        from marketplace.models import Product, ReferenceProduct
        
        # Reassign products
        updated_products_count = Product.objects.filter(brand=source_brand).update(brand=target_brand)
        # Reassign reference products
        ReferenceProduct.objects.filter(brand=source_brand).update(brand=target_brand)
        
        # Reassign category associations
        target_brand.categories.add(*source_brand.categories.all())

        source_name = source_brand.name
        source_brand.delete()

        return Response({
            'message': f"Successfully merged '{source_name}' into '{target_brand.name}'. {updated_products_count} product(s) updated.",
            'target_brand': BrandSerializer(target_brand).data
        })

    @action(detail=False, methods=['get'])
    def stats(self, request):
        from marketplace.models import ReferenceProduct
        unverified_count = Brand.objects.filter(is_verified=False).count()
        total_brands = Brand.objects.count()
        total_models = ReferenceProduct.objects.count()
        return Response({
            'unverified_brands_count': unverified_count,
            'total_brands_count': total_brands,
            'total_reference_models_count': total_models
        })

class ReferenceProductViewSet(viewsets.ModelViewSet):
    queryset = ReferenceProduct.objects.select_related('brand', 'category').all()
    serializer_class = ReferenceProductSerializer
    search_fields = ['name', 'brand__name']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        if self.action in ['create']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        from django.db.models import Count
        qs = ReferenceProduct.objects.select_related('brand', 'category').annotate(products_count_annotated=Count('instances'))
        
        only_unverified = self.request.query_params.get('only_unverified') == 'true'
        if only_unverified:
            return qs.filter(is_verified=False).order_by('-created_at', 'name')

        category_param = self.request.query_params.get('category')
        if category_param:
            from marketplace.models import Category
            if str(category_param).isdigit():
                try:
                    cat = Category.objects.get(id=int(category_param))
                    qs = qs.filter(category__in=cat.get_descendants(include_self=True))
                except Category.DoesNotExist:
                    qs = qs.filter(category_id=int(category_param))
            else:
                try:
                    cat = Category.objects.get(slug=category_param)
                    qs = qs.filter(category__in=cat.get_descendants(include_self=True))
                except Category.DoesNotExist:
                    qs = qs.filter(category__slug=category_param)

        brand_param = self.request.query_params.get('brand')
        if brand_param:
            if str(brand_param).isdigit():
                qs = qs.filter(brand_id=int(brand_param))
            else:
                qs = qs.filter(brand__slug=brand_param)

        return qs.order_by('name')

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def verify(self, request, pk=None):
        ref = self.get_object()
        ref.is_verified = True
        
        new_name = request.data.get('name')
        if new_name and isinstance(new_name, str) and new_name.strip():
            from django.utils.text import slugify
            clean_name = " ".join(new_name.strip().split())
            ref.name = clean_name
            ref.slug = slugify(f"{ref.brand.slug}-{clean_name}")

        specs = request.data.get('structured_specs')
        if specs and isinstance(specs, dict):
            ref.structured_specs = specs

        ref.save()
        return Response({
            'message': f"Reference model '{ref.name}' verified successfully.",
            'reference_product': ReferenceProductSerializer(ref).data
        })
