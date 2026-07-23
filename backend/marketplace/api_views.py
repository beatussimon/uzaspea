import json
from decimal import Decimal
from rest_framework import viewsets, permissions, status, decorators, serializers as drf_serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from django.db.models import Q, Sum, Count, Avg
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers
from django.db import models as django_models
from .models import (
    Product, Category, Review, ProductComment, Order, OrderItem, 
    Payment, TrackingEvent, UserProfile, Like, ProductImage,
    Notification, Conversation, Message, SavedSearch, PriceAlert,
    Dispute, DeliveryZone, SiteSettings, push_notification, ProductVariant,
    MobileNetwork
)
from .serializers import (
    ProductSerializer, CategorySerializer, ProductReviewSerializer, 
    ProductCommentSerializer, OrderSerializer, PaymentSerializer, UserProfileSerializer,
    NotificationSerializer, ConversationSerializer, MessageSerializer,
    SavedSearchSerializer, PriceAlertSerializer, DisputeSerializer,
    SiteSettingsSerializer, DeliveryZoneSerializer, ProductVariantSerializer,
    MobileNetworkSerializer
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

class TicketRateThrottle(AnonRateThrottle):
    scope = 'ticket'

class GeocodeAnonRateThrottle(AnonRateThrottle):
    rate = '20/minute'

class GeocodeUserRateThrottle(UserRateThrottle):
    rate = '100/minute'

from rest_framework.decorators import api_view, permission_classes, throttle_classes
import requests

@api_view(['GET'])
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
    queryset = Product.objects.all().prefetch_related('images', 'likes')
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

        # Base queryset with annotations
        base = Product.objects.annotate(
            annotated_avg_rating=Avg('reviews__rating'),
            annotated_like_count=Count('likes', distinct=True),
            annotated_is_liked=is_liked_expr,
            annotated_has_inspection=has_inspection_expr,
            annotated_inspection_verdict=inspection_verdict_expr,
            annotated_is_verified=is_verified_expr
        ).select_related(
            'seller', 'seller__profile', 'category'
        ).prefetch_related(
            'images', 'likes', 'reviews', 'inspections', 'inspections__report'
        )
        
        # FIX: Ensure detail actions (delete/edit) don't get blocked by list filters
        if getattr(self, 'detail', False) or self.action in ['retrieve', 'update', 'partial_update', 'destroy']:
            return base

        user = self.request.user
        category_slug = self.request.query_params.get('category', None)
        query = self.request.query_params.get('q', None)
        min_price = self.request.query_params.get('min_price', None)
        max_price = self.request.query_params.get('max_price', None)
        condition = self.request.query_params.get('condition', None)
        sort_by = self.request.query_params.get('sort_by', None)
        seller_param = self.request.query_params.get('seller', None)
        lat = self.request.query_params.get('lat', None)
        lng = self.request.query_params.get('lng', None)
        radius = self.request.query_params.get('radius', None)

        # FIX S-17: sellers can retrieve their own products regardless of availability
        if user.is_authenticated and self.request.query_params.get('mine') == 'true':
            from uzachuo.permissions import get_effective_sellers
            sellers = get_effective_sellers(user, required_permission='manage_products')
            queryset = base.filter(seller_id__in=sellers)
        elif self.request.query_params.get('following') and user.is_authenticated:
            from .models import Follow
            followed = Follow.objects.filter(follower=user).values_list('following__user_id', flat=True)
            queryset = base.filter(seller_id__in=followed, is_available=True, stock__gt=0)
        elif user.is_authenticated and user.is_staff:
            queryset = base.all()
        elif seller_param:
            queryset = base.filter(seller__username=seller_param, is_available=True, stock__gt=0)
        else:
            # Public list only shows available and in-stock products for general browsing
            queryset = base.filter(is_available=True, stock__gt=0)
            
        if self.request.query_params.get('saved') == 'true':
            if user.is_authenticated:
                queryset = queryset.filter(likes__user=user)
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

        if query:
            from django.db import connection
            if connection.vendor == 'postgresql':
                from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
                search_vector = SearchVector('name', weight='A') + SearchVector('description', weight='B') + SearchVector('category__name', weight='C')
                search_query = SearchQuery(query, search_type='websearch')
                queryset = queryset.annotate(
                    search_rank=SearchRank(search_vector, search_query)
                ).filter(
                    Q(search_rank__gte=0.01) |
                    Q(name__icontains=query) | Q(description__icontains=query)
                ).order_by('-search_rank')
            else:
                queryset = queryset.filter(
                    Q(name__icontains=query) | 
                    Q(description__icontains=query) |
                    Q(category__name__icontains=query)
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
            queryset = queryset.filter(condition=condition)

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

    def perform_update(self, serializer):
        product = serializer.save()
        images = self.request.FILES.getlist('uploaded_images')
        if images:
            # Optionally clear existing images if it's a full replacement, 
            # but for now we'll just add new ones as per common MVP patterns
            for img in images:
                ProductImage.objects.create(product=product, image=img)

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

        if is_business:
            # --- Revenue pipeline (last 7 days) ---
            start_date = today - datetime.timedelta(days=6)
            from django.db.models.functions import TruncDate
            pipeline_items = OrderItem.objects.filter(
                product__seller=stats_user, order__order_date__date__gte=start_date,
                order__status__in=PAID_STATUSES,
            ).annotate(
                order_date_day=TruncDate('order__order_date')
            ).values('order_date_day').annotate(
                rev=Sum(django_models.F('price') * django_models.F('quantity')), count=Count('order', distinct=True)
            ).order_by('order_date_day')
            
            pipeline_map = {item['order_date_day']: item for item in pipeline_items}
            total_7d = 0
            for i in range(6, -1, -1):
                date = today - datetime.timedelta(days=i)
                entry = pipeline_map.get(date, {'rev': 0, 'count': 0})
                day_rev = float(entry['rev'] or 0)
                total_7d += day_rev
                revenue_pipeline.append({
                    'date': date.strftime('%a'), 
                    'revenue': day_rev, 
                    'orders': entry['count']
                })

            # --- Previous 7 days for trend ---
            prev_start = today - datetime.timedelta(days=13)
            prev_7d = float(OrderItem.objects.filter(
                product__seller=stats_user,
                order__order_date__date__gte=prev_start,
                order__order_date__date__lt=start_date,
            ).aggregate(t=Sum(django_models.F('price') * django_models.F('quantity')))['t'] or 0)
            trend_pct = round(((total_7d - prev_7d) / prev_7d * 100) if prev_7d else 0, 1)

            # --- Top 5 products by order count ---
            top_prods = (
                OrderItem.objects.filter(product__seller=stats_user)
                .values('product__name', 'product__slug')
                .annotate(sold=Count('id'), rev=Sum(django_models.F('price') * django_models.F('quantity')))
                .order_by('-sold')[:5]
            )
            top_products = [{'name': t['product__name'], 'slug': t['product__slug'], 'sold': t['sold'], 'revenue': float(t['rev'] or 0)} for t in top_prods]

            # --- Category breakdown ---
            cat_data = (
                OrderItem.objects.filter(product__seller=stats_user)
                .values('product__category__name')
                .annotate(rev=Sum(django_models.F('price') * django_models.F('quantity')), count=Count('id'))
                .order_by('-rev')[:8]
            )
            category_breakdown = [{'category': c['product__category__name'] or 'Other', 'revenue': float(c['rev'] or 0), 'items': c['count']} for c in cat_data]

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
            'stock_alerts': low_stock,
            'has_advanced_analytics': is_business,
            'commission_paid': commission_paid,
            'commission_rate': commission_rate_val,
        })

from .models import LipaNumber, FAQ, SupportTicket
from .serializers import LipaNumberSerializer, FAQSerializer, SupportTicketSerializer

class LipaNumberViewSet(viewsets.ModelViewSet):
    """FIX X-01: per-seller Lipa numbers — sellers manage their own, buyers read by seller username."""
    serializer_class = LipaNumberSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
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
            return LipaNumber.objects.filter(seller=self.request.user, is_system=False).select_related('network')
        return LipaNumber.objects.none()

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.IsAuthenticated(), IsSellerOrAbove()]
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsSellerOrAbove()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        # Admin UI will pass is_system in request data. We must manually set it because it's read_only in serializer
        is_system_flag = self.request.data.get('is_system', False)
        if str(is_system_flag).lower() == 'true' and self.request.user.is_superuser:
            serializer.save(seller=self.request.user, is_system=True)
        else:
            serializer.save(seller=self.request.user, is_system=False)

class FAQViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FAQSerializer
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
            return [TicketRateThrottle()]
        return super().get_throttles()
    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            qs = SupportTicket.objects.all().order_by('-created_at')
            status_filter = self.request.query_params.get('status')
            if status_filter:
                qs = qs.filter(status=status_filter)
            return qs
        # FIX LOW-02: also match by email for anonymous-then-logged-in users
        return SupportTicket.objects.filter(
            Q(user=user) | Q(email=user.email)
        ).order_by('-created_at')
    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        from django.db.models import Count, Prefetch
        # Pre-annotate children with their product counts to avoid N+1 queries
        children_qs = Category.objects.annotate(
            annotated_product_count=Count('products', distinct=True)
        )
        # Return only root categories, with children prefetched and parent counts annotated
        return Category.objects.filter(parent__isnull=True).annotate(
            annotated_product_count=Count('products', distinct=True)
        ).prefetch_related(
            Prefetch('children', queryset=children_qs)
        ).order_by('name')

    def list(self, request, *args, **kwargs):
        from django.core.cache import cache
        from rest_framework.response import Response
        cache_key = 'categories_list_v2'
        data = cache.get(cache_key)
        if not data:
            response = super().list(request, *args, **kwargs)
            data = response.data
            # Cache for 2 hours; invalidate externally when categories change
            cache.set(cache_key, data, 60 * 60 * 2)
        return Response(data)

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_throttles(self):
        if self.action == 'create':
            return [OrderCreateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return Order.objects.all().prefetch_related('orderitem_set__product', 'timeline_events', 'payments').order_by('-order_date')
        from uzachuo.permissions import get_effective_sellers
        sellers = get_effective_sellers(user, required_permission='manage_orders')
        return Order.objects.filter(
            Q(user=user) | Q(orderitem_set__product__seller_id__in=sellers)
        ).distinct().prefetch_related('orderitem_set__product', 'timeline_events', 'payments').order_by('-order_date')

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
        serializer.save(user=self.request.user)

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

        # FIX: S-06 — Enforce who can trigger which transitions
        STAFF_ONLY_STATES = {
            'PAID', 'EXPIRED', 'RECEIVED_AT_WAREHOUSE', 'AWAITING_DELIVERY_PAYMENT',
            'IN_TRANSIT', 'ARRIVED_AT_REGIONAL_WAREHOUSE', 'READY_FOR_PICKUP', 'DELIVERED'
        }
        SELLER_ALLOWED_STATES = {
            'SELLER_CONFIRMED', 'PREPARING', 'PACKAGING', 'SHIPPED_TO_WAREHOUSE',
            'PROCESSING', 'SHIPPED', 'DELIVERED', 'DISPUTED'
        }
        BUYER_ALLOWED_STATES = {'AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'PENDING_DELIVERY_VERIFICATION', 'CHECKOUT', 'COMPLETED', 'DISPUTED', 'READY_FOR_TRANSIT', 'ASSIGNED_TRANSPORT', 'PAID_PRODUCT'}

        # Allow warehouse role staff to transition to warehouse states
        is_warehouse_staff = (
            request.user.is_superuser
            or has_staff_permission(request.user, 'can_manage_warehouse_intake')
            or has_staff_permission(request.user, 'can_manage_logistics')
        )
        
        if new_state in STAFF_ONLY_STATES and not is_warehouse_staff:
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

        if new_state == 'DELIVERED':
            delivery_code = request.data.get('delivery_code')
            if order.delivery_code and str(delivery_code).strip() != order.delivery_code:
                return Response({'error': 'Invalid delivery code. Please verify the code with the customer.'}, status=status.HTTP_400_BAD_REQUEST)

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
                
        orders = orders_qs.prefetch_related(
            seller_items_prefetch, 'timeline_events', 'payments'
        ).select_related('user').order_by('-order_date')

        status_filter = request.query_params.get('status', None)
        if status_filter:
            orders = orders.filter(status=status_filter)

        order_id_filter = request.query_params.get('order_id', None)
        if order_id_filter:
            orders = orders.filter(id=order_id_filter)

        page = self.paginate_queryset(orders)
        
        def format_order(order):
            items_data = []
            for item in order.relevant_items:
                # FIX: L-04 — use prefetched images, avoid 2 queries per item
                _imgs = list(item.product.images.all())
                items_data.append({
                    'id': item.id,
                    'product_name': item.product.name,
                    'product_slug': item.product.slug,
                    'product_image': _imgs[0].image.url if _imgs else None,
                    'quantity': item.quantity,
                    'price': float(item.price),
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
                'has_vehicles': order_has_vehicles(order),
                'total_amount': float(order.total_amount),
                'seller_subtotal': sum(i['subtotal'] for i in items_data),
                'items': items_data,
                'timeline': timeline,
                'payments': payments,
                'delivery_info': order.delivery_info if isinstance(order.delivery_info, dict) else (json.loads(order.delivery_info) if isinstance(order.delivery_info, str) else {}),
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
        if order and order.user != self.request.user:
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
        if user.is_staff:
            return Payment.objects.all()
        # Buyers see their own payments, Sellers see payments for their products
        return Payment.objects.filter(
            django_models.Q(order__user=user) | django_models.Q(order__orderitem_set__product__seller=user)
        ).distinct()

    # FIX: C-04 — Add payment verify/approve/reject actions for staff
    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStaffMember])
    def verify(self, request, pk=None):
        """Staff: approve a pending marketplace payment and advance order to PAID."""
        from .services import OrderStateMachine
        payment = self.get_object()
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

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStaffMember])
    def reject(self, request, pk=None):
        """Staff: reject a pending payment and return order to AWAITING_PAYMENT."""
        from .services import OrderStateMachine
        payment = self.get_object()
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
        data['is_staff'] = self.user.is_staff or self.user.is_superuser
        data['is_superuser'] = self.user.is_superuser
        try:
            data['is_verified'] = self.user.profile.is_verified
            data['tier'] = self.user.profile.tier
        except (UserProfile.DoesNotExist, AttributeError):
            data['is_verified'] = False
            data['tier'] = 'customer'
        
        data['is_inspector'] = hasattr(self.user, 'inspector_profile')
        data['inspector_level'] = (
            self.user.inspector_profile.level
            if hasattr(self.user, 'inspector_profile') else None
        )

        from marketplace.models import TeamMember
        member_record = TeamMember.objects.filter(user=self.user).first()
        if member_record:
            data['is_team_member'] = True
            data['team_permissions'] = member_record.permissions
            data['tier'] = 'business'
        else:
            data['is_team_member'] = False
            data['team_permissions'] = {}

        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['user_id'] = user.id
        token['username'] = user.username
        token['is_staff'] = user.is_staff or user.is_superuser
        token['is_superuser'] = user.is_superuser
        
        try:
            token['is_verified'] = user.profile.is_verified
            token['tier'] = user.profile.tier
        except Exception:
            token['is_verified'] = False
            token['tier'] = 'customer'
            
        token['is_inspector'] = hasattr(user, 'inspector_profile')
        token['inspector_level'] = (
            user.inspector_profile.level
            if hasattr(user, 'inspector_profile') else None
        )
        
        from marketplace.models import TeamMember
        member_record = TeamMember.objects.filter(user=user).first()
        if member_record:
            token['is_team_member'] = True
            token['team_permissions'] = member_record.permissions
            token['tier'] = 'business'
        else:
            token['is_team_member'] = False
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
        return UserProfile.objects.all()

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
        category_slug = self.request.query_params.get('category', None)
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
            from django.utils import timezone as _tz
            # FIX S-16: show own listings + all public approved (non-expired) ones
            return SponsoredListing.objects.filter(
                django_models.Q(user=user) | django_models.Q(
                    status='approved',
                )
            ).filter(
                django_models.Q(expires_at__isnull=True) | django_models.Q(expires_at__gt=_tz.now())
            ).distinct().order_by('-created_at')
        return SponsoredListing.objects.filter(
            status='approved'
        ).filter(
            django_models.Q(expires_at__isnull=True) | django_models.Q(expires_at__gt=tz.now())  # FIX: L-12
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


class MobileNetworkViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MobileNetwork.objects.all()
    serializer_class = MobileNetworkSerializer
    permission_classes = [permissions.AllowAny]


# ─── FIX B-12: Conversation ViewSet ───────────────────────────────
class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post']

    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(
            Q(buyer=user) | Q(seller=user)
        ).select_related('buyer', 'seller', 'product').order_by('-updated_at')

    def create(self, request, *args, **kwargs):
        seller_id = request.data.get('seller')
        product_id = request.data.get('product')

        if str(seller_id) == str(request.user.id):
            return Response(
                {'error': 'You cannot start a conversation with yourself.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Look for any existing conversation between this buyer and seller
        conv = Conversation.objects.filter(
            Q(buyer=request.user, seller_id=seller_id) |
            Q(buyer_id=seller_id, seller=request.user)
        ).order_by('-updated_at').first()

        if conv:
            if product_id:
                conv.product_id = product_id
                conv.save()
        else:
            conv = Conversation.objects.create(
                buyer=request.user, seller_id=seller_id, product_id=product_id
            )

        return Response(ConversationSerializer(conv, context={'request': request}).data)

    @decorators.action(detail=True, methods=['get', 'post'])
    def messages(self, request, pk=None):
        conv = self.get_object()
        if not (conv.buyer == request.user or conv.seller == request.user):
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

            return Response(MessageSerializer(msg).data, status=201)
        Message.objects.filter(conversation=conv, is_read=False).exclude(sender=request.user).update(is_read=True)
        # Fetch only last 50 messages, and order them chronologically
        msgs = conv.messages.order_by('-created_at')[:50]
        msgs = sorted(list(msgs), key=lambda x: x.created_at)
        return Response(MessageSerializer(msgs, many=True).data)


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
        user = self.request.user

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

        # Get IDs of orders that qualify as "this week's" completed orders
        weekly_order_ids = Order.objects.filter(
            order_date__gte=seven_days_ago,
            status__in=['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED']
        ).values_list('id', flat=True)

        base_qs = Product.objects.select_related('category', 'seller').prefetch_related('images', 'likes').filter(
            is_available=True
        ).annotate(
            weekly_sales=Coalesce(Sum(
                'orderitem__quantity',
                filter=Q(orderitem__order_id__in=weekly_order_ids)
            ), 0),
            like_count=Count('likes', distinct=True)
        )

        top_sellers_qs = base_qs.order_by('-weekly_sales', '-like_count', '-created_at')[:8]
        most_saved_qs = base_qs.order_by('-like_count', '-weekly_sales', '-created_at')[:8]
        newest_trending_qs = base_qs.order_by('-created_at', '-like_count')[:8]
        
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

        # Cache for 60 seconds to avoid hammering the DB
        cache.set(cache_key, result, 60)

        return Response(result)


# --- Subscription ViewSets ---
class SubscriptionTierViewSet(viewsets.ReadOnlyModelViewSet):
    from .models import SubscriptionTier
    queryset = SubscriptionTier.objects.filter(is_active=True)
    from .serializers import SubscriptionTierSerializer
    serializer_class = SubscriptionTierSerializer
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

    @decorators.action(detail=False, methods=['get'])
    def audit_log(self, request):
        from .models import TeamMemberAuditLog
        entries = TeamMemberAuditLog.objects.filter(owner=request.user).select_related('target_user', 'performed_by')[:100]
        data = [{
            'id': e.id, 'target_user': e.target_user.username, 'performed_by': e.performed_by.username if e.performed_by else None,
            'action': e.action, 'detail': e.detail, 'created_at': e.created_at.isoformat(),
        } for e in entries]
        return Response(data)

