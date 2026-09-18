from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.db.models import Avg, Count, Exists, OuterRef, Subquery, Value, BooleanField, Q, F, ExpressionWrapper, FloatField
from django.db.models.functions import Coalesce, Cos, Sin, ACos, Radians, Greatest, Least
from django.utils import timezone

from django.core.cache import cache
from .models import Product, Category, Like, Review, SponsoredListing
from inspections.models import InspectionRequest, InspectionReport
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
    has_inspection_expr = Exists(
        InspectionRequest.objects.filter(marketplace_product=OuterRef('pk'), status='published')
    )
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
        annotated_is_sponsored=is_sponsored_expr
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
    Recommendation-ready discovery feed endpoint.
    Serves structured section carousels ('Look Different', 'For Your Car', 
    'Brand New Deals in Phones', 'View More in [Category]', 'Fresh Picks').
    Supports single-section pagination via section_id, page, page_size.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user = request.user
        user_gender = 'unspecified'
        if user and user.is_authenticated and hasattr(user, 'profile'):
            user_gender = getattr(user.profile, 'gender', 'unspecified') or 'unspecified'

        # Client override query param takes priority (e.g. guest toggling female/male)
        req_gender = request.query_params.get('gender')
        active_gender = req_gender if req_gender in ['female', 'male'] else (
            user_gender if user_gender in ['female', 'male'] else 'female'
        )

        base_qs = get_base_product_queryset(user)

        # Single Section Pagination Support for Infinite Horizontal Scroll
        section_id = request.query_params.get('section_id')
        if section_id:
            try:
                page = max(1, int(request.query_params.get('page', 1)))
            except (ValueError, TypeError):
                page = 1
            try:
                page_size = max(1, min(50, int(request.query_params.get('page_size', 12))))
            except (ValueError, TypeError):
                page_size = 12

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

        # Check cache for standard initial load without specific location filters
        is_standard_feed = not any([
            request.query_params.get('lat'),
            request.query_params.get('lng'),
            request.query_params.get('region'),
            request.query_params.get('location_mode')
        ])
        cache_key = f"discovery_feed_{active_gender}"
        if is_standard_feed:
            cached_data = cache.get(cache_key)
            if cached_data:
                return Response(cached_data)

        # Full Discovery Feed Initial Load
        filtered_qs = apply_location_filters(base_qs, request)
        sections = []

        # 1. Section: "Look Different" (Fashion personalized by gender)
        if active_gender == 'male':
            fashion_cat = get_category_by_slug_or_keywords('mens-fashion', ["Men's Fashion", "Men"])
            fashion_title = "Look Different"
            fashion_subtitle = "Sharp looks, shoes & style essentials for men"
            fashion_see_more = f"/products?category={fashion_cat.slug if fashion_cat else 'mens-fashion'}"
        else:
            fashion_cat = get_category_by_slug_or_keywords('womens-fashion', ["Women's Fashion", "Women"])
            fashion_title = "Look Different"
            fashion_subtitle = "Trendy styles, dresses, shoes & beauty picks for women"
            fashion_see_more = f"/products?category={fashion_cat.slug if fashion_cat else 'womens-fashion'}"

        fashion_products = get_section_products('look_different', active_gender, filtered_qs, offset=0, limit=16)
        sections.append({
            "id": "look_different",
            "type": "horizontal_shelf",
            "title": fashion_title,
            "subtitle": fashion_subtitle,
            "category_slug": fashion_cat.slug if fashion_cat else ("mens-fashion" if active_gender == 'male' else "womens-fashion"),
            "gender_active": active_gender,
            "has_gender_toggle": False,
            "see_more_url": fashion_see_more,
            "products": ProductListSerializer(fashion_products, many=True, context={'request': request}).data
        })

        # 2. Section: "For Your Car" (Automotive & Spare Parts)
        auto_cat = get_category_by_slug_or_keywords('vehicles', ["Vehicles", "Cars", "Motorcycles", "Vehicle Parts"])
        auto_products = get_section_products('for_your_car', active_gender, filtered_qs, offset=0, limit=16)
        sections.append({
            "id": "for_your_car",
            "type": "horizontal_shelf",
            "title": "For Your Car",
            "subtitle": "Essential spare parts, vehicle accessories & automobiles",
            "category_slug": auto_cat.slug if auto_cat else "vehicles",
            "see_more_url": f"/products?category={auto_cat.slug if auto_cat else 'vehicles'}",
            "products": ProductListSerializer(auto_products, many=True, context={'request': request}).data
        })

        # 3. Section: "Brand New Deals in Phones" (Phones & Gadgets)
        phone_cat = get_category_by_slug_or_keywords('electronics-mobile-phones', ["Mobile Phones", "Phones", "Smartphones", "Electronics"])
        phone_products = get_section_products('phone_deals', active_gender, filtered_qs, offset=0, limit=16)
        sections.append({
            "id": "phone_deals",
            "type": "horizontal_shelf",
            "title": "Brand New Deals in Phones",
            "subtitle": "Smartphones, mobile accessories & hot electronic gadgets",
            "category_slug": phone_cat.slug if phone_cat else "electronics",
            "see_more_url": f"/products?category={phone_cat.slug if phone_cat else 'electronics'}",
            "products": ProductListSerializer(phone_products, many=True, context={'request': request}).data
        })

        # 4. Section: "View More in Home & Living"
        home_cat = get_category_by_slug_or_keywords('home-garden-furniture', ["Home", "Furniture", "Appliances", "Living"])
        home_products = get_section_products('view_more_home', active_gender, filtered_qs, offset=0, limit=16)
        if home_products:
            sections.append({
                "id": "view_more_home",
                "type": "horizontal_shelf",
                "title": f"View More in {home_cat.name if home_cat else 'Home & Living'}",
                "subtitle": "Popular furnishings, kitchen electronics & home appliances",
                "category_slug": home_cat.slug if home_cat else "home-garden-furniture",
                "see_more_url": f"/products?category={home_cat.slug if home_cat else 'home-garden-furniture'}",
                "products": ProductListSerializer(home_products, many=True, context={'request': request}).data
            })

        # 5. Section: "Fresh Picks" (Latest across all categories)
        fresh_products = get_section_products('fresh_picks', active_gender, filtered_qs, offset=0, limit=16)
        sections.append({
            "id": "fresh_picks",
            "type": "horizontal_shelf",
            "title": "Fresh Picks Across All Categories",
            "subtitle": "Just listed verified products in Tanzania",
            "category_slug": "",
            "see_more_url": "/products?sort_by=newest",
            "products": ProductListSerializer(fresh_products, many=True, context={'request': request}).data
        })

        result_payload = {
            "status": "success",
            "sections": sections
        }
        if is_standard_feed:
            cache.set(cache_key, result_payload, timeout=600)

        return Response(result_payload)


class CategoryRecommendationsView(APIView):
    """
    Returns closest related products for a given category or product context.
    Uses multi-stage candidate retrieval, ranking, and diversification.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from .models import Product
        from .recommendation_service import RecommendationEngine

        product_id = request.query_params.get('product_id')
        cat_slug = request.query_params.get('category')
        exclude_param = request.query_params.get('exclude', '')
        limit = int(request.query_params.get('limit', 24))

        exclude_ids = []
        if exclude_param:
            for item in exclude_param.split(','):
                item = item.strip()
                if item.isdigit():
                    exclude_ids.append(int(item))

        target_prod = None
        if product_id and product_id.isdigit():
            target_prod = Product.objects.filter(id=int(product_id), is_available=True).first()

        cat = None
        if cat_slug:
            cat = Category.objects.filter(slug=cat_slug).first()
            if not cat:
                cat = Category.objects.filter(name__icontains=cat_slug).first()

        recs = RecommendationEngine.get_recommendations(
            target_product=target_prod,
            user=request.user,
            category_slug=cat.slug if cat else cat_slug,
            limit=limit,
            exclude_ids=exclude_ids,
            request=request
        )

        title = "You Might Also Like"
        if target_prod:
            subtitle = "Recommended for you based on this product"
        elif cat:
            subtitle = f"Recommended picks in {cat.name}"
        else:
            subtitle = "Popular picks tailored for you"

        return Response({
            "product_id": target_prod.id if target_prod else None,
            "category": cat.slug if cat else cat_slug,
            "category_name": cat.name if cat else None,
            "title": title,
            "subtitle": subtitle,
            "products": ProductListSerializer(recs, many=True, context={'request': request}).data
        })
