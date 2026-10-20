from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.db.models import Avg, Count, Exists, OuterRef, Subquery, Value, BooleanField, Q, F, ExpressionWrapper, FloatField, Case, When
from django.db.models.functions import Coalesce, Cos, Sin, ACos, Radians, Greatest, Least
from django.utils import timezone

from django.core.cache import cache
from .models import Product, Category, Like, Review, SponsoredListing
from inspections.models import InspectionRequest, InspectionReport, ProductInspectionEvent
from .serializers import ProductListSerializer


def get_base_product_queryset(user=None):
    """
    Returns the standard annotated and prefetched Product queryset for public browsing.
    """
    is_liked_expr = (
        Exists(Like.objects.filter(product=OuterRef('pk'), user=user))
        if user and user.is_authenticated
        else Value(False, output_field=BooleanField())
    )
    has_post_inspection_changes_expr = Exists(
        ProductInspectionEvent.objects.filter(product=OuterRef('pk'))
    )
    has_inspection_expr = Case(
        When(has_post_inspection_changes_expr, then=Value(False)),
        default=Exists(
            InspectionRequest.objects.filter(marketplace_product=OuterRef('pk'), status='published')
        ),
        output_field=BooleanField()
    )
    inspection_verdict_expr = Subquery(
        InspectionReport.objects.filter(
            request__marketplace_product=OuterRef('pk'), 
            request__status='published'
        ).values('verdict')[:1]
    )
    is_verified_expr = Case(
        When(has_post_inspection_changes_expr, then=Value(False)),
        default=Exists(
            InspectionRequest.objects.filter(
                marketplace_product=OuterRef('pk'), 
                status='published', 
                report__verdict='pass'
            )
        ),
        output_field=BooleanField()
    )
    is_sponsored_expr = Exists(
        SponsoredListing.objects.filter(
            Q(expires_at__gt=timezone.now()) | Q(expires_at__isnull=True),
            product=OuterRef('pk'), 
            status='approved'
        )
    )
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

    return Product.objects.annotate(
        annotated_avg_rating=Coalesce(avg_rating_subquery, Value(0.0, output_field=FloatField())),
        annotated_like_count=Coalesce(like_count_subquery, Value(0)),
        annotated_is_liked=is_liked_expr,
        annotated_has_inspection=has_inspection_expr,
        annotated_inspection_verdict=inspection_verdict_expr,
        annotated_is_verified=is_verified_expr,
        annotated_is_sponsored=is_sponsored_expr,
        annotated_has_post_inspection_changes=has_post_inspection_changes_expr
    ).select_related(
        'seller', 'seller__profile', 'category', 'category__parent',
        'brand', 'brand__created_by',
        'reference_product', 'reference_product__brand', 'reference_product__category', 'reference_product__created_by'
    ).prefetch_related(
        'images', 'variants', 'fitments', 'price_tiers'
    ).filter(is_available=True, stock__gt=0, is_draft=False)


def get_category_by_slug_or_keywords(slug, keywords=None):
    """Find a category by slug or fall back to keyword match."""
    cat = Category.objects.filter(slug=slug).first()
    if not cat and keywords:
        q_filter = Q()
        for kw in keywords:
            q_filter |= Q(name__icontains=kw) | Q(slug__icontains=kw)
        cat = Category.objects.filter(q_filter).first()
    return cat


def apply_location_filters(queryset, request):
    location_mode = request.query_params.get('location_mode')
    region_filter = request.query_params.get('region')
    lat = request.query_params.get('lat')
    lng = request.query_params.get('lng')
    radius = request.query_params.get('radius')

    if location_mode == 'region' and region_filter:
        return queryset.filter(
            Q(location_name__icontains=region_filter) |
            Q(seller__profile__location__icontains=region_filter)
        )
    elif lat and lng and location_mode != 'nationwide':
        try:
            lat_f = float(lat)
            lng_f = float(lng)

            qs = queryset.filter(
                Q(latitude__isnull=False, longitude__isnull=False) |
                Q(seller__profile__latitude__isnull=False, seller__profile__longitude__isnull=False)
            )
            effective_lat = Coalesce(F('latitude'), F('seller__profile__latitude'))
            effective_lng = Coalesce(F('longitude'), F('seller__profile__longitude'))

            d_lat = Radians(effective_lat)
            d_lng = Radians(effective_lng)
            r_lat = Radians(lat_f)
            r_lng = Radians(lng_f)

            cos_val = Greatest(
                Least(
                    Cos(r_lat) * Cos(d_lat) * Cos(d_lng - r_lng) + Sin(r_lat) * Sin(d_lat),
                    Value(1.0)
                ),
                Value(-1.0)
            )
            dist_expr = ExpressionWrapper(
                Value(6371.0) * ACos(cos_val),
                output_field=FloatField()
            )
            rad_km = float(radius) if radius else 10.0
            return qs.annotate(distance_km=dist_expr).filter(distance_km__lte=rad_km).order_by('distance_km', '-created_at')
        except Exception:
            return queryset
    return queryset


def get_section_products(section_id, active_gender, base_qs, offset=0, limit=16):
    """
    Returns products for a specific discovery section with pagination support.
    Guarantees an even number of products for 2-row shelves so columns are always paired.
    """
    products = []
    if section_id == 'look_different':
        if active_gender == 'male':
            cat = get_category_by_slug_or_keywords('mens-fashion', ["Men's Fashion", "Men"])
        else:
            cat = get_category_by_slug_or_keywords('womens-fashion', ["Women's Fashion", "Women"])
        if cat:
            desc = cat.get_descendants(include_self=True)
            qs = base_qs.filter(category__in=desc).order_by('-created_at')
        else:
            qs = base_qs.none()
        products = list(qs[offset:offset + limit])
        if len(products) < limit and offset == 0:
            existing_ids = {p.id for p in products}
            fb = list(base_qs.filter(
                Q(category__name__icontains="Fashion") | Q(category__name__icontains="Clothing")
            ).exclude(id__in=existing_ids).order_by('-created_at')[:limit - len(products)])
            products.extend(fb)

    elif section_id == 'for_your_car':
        cat = get_category_by_slug_or_keywords('vehicles', ["Vehicles", "Cars", "Motorcycles", "Vehicle Parts"])
        if cat:
            desc = cat.get_descendants(include_self=True)
            qs = base_qs.filter(category__in=desc).order_by('-created_at')
        else:
            qs = base_qs.none()
        products = list(qs[offset:offset + limit])
        if len(products) < limit and offset == 0:
            existing_ids = {p.id for p in products}
            fb = list(base_qs.filter(
                Q(category__name__icontains="Vehicle") | Q(name__icontains="Car") | Q(name__icontains="Part")
            ).exclude(id__in=existing_ids).order_by('-created_at')[:limit - len(products)])
            products.extend(fb)

    elif section_id == 'phone_deals':
        cat = get_category_by_slug_or_keywords('electronics-mobile-phones', ["Mobile Phones", "Phones", "Smartphones", "Electronics"])
        if cat:
            desc = cat.get_descendants(include_self=True)
            qs = base_qs.filter(category__in=desc).order_by('-created_at')
        else:
            qs = base_qs.none()
        products = list(qs[offset:offset + limit])
        if len(products) < limit and offset == 0:
            existing_ids = {p.id for p in products}
            fb = list(base_qs.filter(
                Q(category__name__icontains="Phone") | Q(category__name__icontains="Electronic") | Q(name__icontains="Phone")
            ).exclude(id__in=existing_ids).order_by('-created_at')[:limit - len(products)])
            products.extend(fb)

    elif section_id == 'view_more_home':
        cat = get_category_by_slug_or_keywords('home-garden-furniture', ["Home", "Furniture", "Appliances", "Living"])
        if cat:
            desc = cat.get_descendants(include_self=True)
            qs = base_qs.filter(category__in=desc).order_by('-created_at')
        else:
            qs = base_qs.none()
        products = list(qs[offset:offset + limit])
        if len(products) < limit and offset == 0:
            existing_ids = {p.id for p in products}
            fb = list(base_qs.filter(
                Q(category__name__icontains="Home") | Q(category__name__icontains="Furniture")
            ).exclude(id__in=existing_ids).order_by('-created_at')[:limit - len(products)])
            products.extend(fb)

    elif section_id == 'fresh_picks':
        products = list(base_qs.order_by('-created_at')[offset:offset + limit])

    # Guarantee an even number of products so 2-row shelves never have an orphaned card with empty bottom
    if len(products) > 1 and len(products) % 2 != 0:
        products = products[:-1]

    return products


class DiscoveryFeedView(APIView):
    """
    For You feed (recommendations v3).
    - No section_id: personalised shelves + ranked editorial shelves (see recs/engine.for_you).
    - section_id='shelf:<key>': next page of an editorial shelf.
    - Any other section_id: legacy section pagination (kept for old cached clients and 'fresh_picks').
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from .recs import config as rec_config
        from .recs.context import context_from_request
        from .recs.engine import for_you, editorial_page
        from .recs.queries import cache_key
        from .recs.views import cards_for_ids, shelves_to_payload, safe_int

        section_id = request.query_params.get('section_id')
        if section_id:
            page = safe_int(request.query_params.get('page'), 1, 1, 1000)
            page_size = safe_int(request.query_params.get('page_size'), 12, 1, 50)
            if section_id.startswith('shelf:'):
                ids, has_more = editorial_page(section_id[len('shelf:'):], page, page_size)
                return Response({"status": "success", "section_id": section_id, "page": page,
                                 "has_more": has_more, "products": cards_for_ids(ids, request)})
            return self._legacy_section(request, section_id, page, page_size)

        ctx = context_from_request(request)
        cold_key = None
        if ctx.user is None and not ctx.has_signals:
            cold_key = cache_key('foryou', 'cold', ctx.gender or 'auto', ctx.region or 'all')
            cached = cache.get(cold_key)
            if cached is not None:
                return Response(cached)
        payload = {"status": "success", "personalized": ctx.has_signals,
                   "sections": shelves_to_payload(for_you(ctx), request)}
        if cold_key:
            cache.set(cold_key, payload, rec_config.COLD_FEED_TTL)
        return Response(payload)

    def _legacy_section(self, request, section_id, page, page_size):
        user = request.user
        user_gender = 'unspecified'
        if user and user.is_authenticated and hasattr(user, 'profile'):
            user_gender = getattr(user.profile, 'gender', 'unspecified') or 'unspecified'
        req_gender = request.query_params.get('gender')
        active_gender = req_gender if req_gender in ['female', 'male'] else (
            user_gender if user_gender in ['female', 'male'] else 'female'
        )
        base_qs = get_base_product_queryset(user)
        offset = (page - 1) * page_size
        filtered_qs = apply_location_filters(base_qs, request)
        section_items = get_section_products(section_id, active_gender, filtered_qs, offset=offset, limit=page_size)
        return Response({
            "status": "success",
            "section_id": section_id,
            "page": page,
            "has_more": len(section_items) >= page_size,
            "products": ProductListSerializer(section_items, many=True, context={'request': request}).data
        })


class CategoryRecommendationsView(APIView):
    """Recommendation shelf for a category page (or a product, for old clients). Uses recs v3."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from .recs.context import context_from_request
        from .recs.engine import ymal_for_product, category_picks, top_picks
        from .recs.views import cards_for_scored, safe_int

        product_id = request.query_params.get('product_id') or ''
        cat_slug = (request.query_params.get('category') or '').strip()
        limit = safe_int(request.query_params.get('limit'), 24, 1, 50)
        ctx = context_from_request(request)

        target = Product.objects.filter(id=int(product_id), is_available=True).first() if product_id.isdigit() else None
        cat = None
        if cat_slug:
            cat = Category.objects.filter(slug=cat_slug).first() or Category.objects.filter(name__icontains=cat_slug).first()

        if target is not None:
            items = ymal_for_product(target.id, ctx, limit)
            subtitle = "Recommended for you based on this product"
        elif cat is not None:
            items = category_picks(cat, ctx, limit)
            subtitle = f"Recommended picks in {cat.name}"
        else:
            items = top_picks(ctx, limit)
            subtitle = "Popular picks tailored for you"

        return Response({
            "product_id": target.id if target else None,
            "category": cat.slug if cat else cat_slug,
            "category_name": cat.name if cat else None,
            "title": "You Might Also Like",
            "subtitle": subtitle,
            "products": cards_for_scored(items, request),
        })
