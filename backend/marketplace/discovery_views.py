from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.db.models import Avg, Count, Exists, OuterRef, Subquery, Value, BooleanField, Q
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import Product, Category, Like, Review, SponsoredListing
from inspections.models import InspectionRequest, InspectionReport
from .serializers import ProductSerializer


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


class DiscoveryFeedView(APIView):
    """
    Recommendation-ready discovery feed endpoint.
    Serves structured section carousels ('Look Different', 'For Your Car', 
    'Brand New Deals in Phones', 'View More in [Category]', 'Fresh Picks').
    
    Future recommendation models (collaborative filtering, embedding similarity,
    personalization graph) can directly override this endpoint without any frontend redesign.
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

        sections = []

        # 1. Section: "Look Different" (Fashion personalized by gender)
        if active_gender == 'male':
            fashion_cat = get_category_by_slug_or_keywords('mens-fashion', ["Men's Fashion", "Men"])
            fashion_title = "Look Different"
            fashion_subtitle = "Sharp looks, shoes & style essentials for men"
            fashion_badge = "Men's Style"
            fashion_see_more = f"/products?category={fashion_cat.slug if fashion_cat else 'mens-fashion'}"
        else:
            fashion_cat = get_category_by_slug_or_keywords('womens-fashion', ["Women's Fashion", "Women"])
            fashion_title = "Look Different"
            fashion_subtitle = "Trendy styles, dresses, shoes & beauty picks for women"
            fashion_badge = "Women's Fashion"
            fashion_see_more = f"/products?category={fashion_cat.slug if fashion_cat else 'womens-fashion'}"

        if fashion_cat:
            fashion_descendants = fashion_cat.get_descendants(include_self=True)
            fashion_products = list(base_qs.filter(category__in=fashion_descendants).order_by('-created_at')[:16])
        else:
            fashion_products = []

        # If sparse, pad with other fashion or top-rated items
        if len(fashion_products) < 8:
            fallback_fashion = base_qs.filter(
                Q(category__name__icontains="Fashion") | Q(category__name__icontains="Clothing")
            ).exclude(id__in=[p.id for p in fashion_products]).order_by('-created_at')[:12]
            fashion_products.extend(list(fallback_fashion))

        sections.append({
            "id": "look_different",
            "type": "horizontal_shelf",
            "title": fashion_title,
            "subtitle": fashion_subtitle,
            "category_slug": fashion_cat.slug if fashion_cat else ("mens-fashion" if active_gender == 'male' else "womens-fashion"),
            "gender_active": active_gender,
            "has_gender_toggle": False,
            "see_more_url": fashion_see_more,
            "products": ProductSerializer(fashion_products[:16], many=True, context={'request': request}).data
        })

        # 2. Section: "For Your Car" (Automotive & Spare Parts)
        auto_cat = get_category_by_slug_or_keywords('vehicles', ["Vehicles", "Cars", "Motorcycles", "Vehicle Parts"])
        if auto_cat:
            auto_descendants = auto_cat.get_descendants(include_self=True)
            auto_products = list(base_qs.filter(category__in=auto_descendants).order_by('-created_at')[:16])
        else:
            auto_products = []

        if len(auto_products) < 8:
            fallback_auto = base_qs.filter(
                Q(category__name__icontains="Vehicle") | Q(name__icontains="Car") | Q(name__icontains="Part")
            ).exclude(id__in=[p.id for p in auto_products]).order_by('-created_at')[:12]
            auto_products.extend(list(fallback_auto))

        sections.append({
            "id": "for_your_car",
            "type": "horizontal_shelf",
            "title": "For Your Car",
            "subtitle": "Essential spare parts, vehicle accessories & automobiles",
            "category_slug": auto_cat.slug if auto_cat else "vehicles",
            "see_more_url": f"/products?category={auto_cat.slug if auto_cat else 'vehicles'}",
            "products": ProductSerializer(auto_products[:16], many=True, context={'request': request}).data
        })

        # 3. Section: "Brand New Deals in Phones" (Phones & Gadgets)
        phone_cat = get_category_by_slug_or_keywords(
            'electronics-mobile-phones', 
            ["Mobile Phones", "Phones", "Smartphones", "Electronics"]
        )
        if phone_cat:
            phone_descendants = phone_cat.get_descendants(include_self=True)
            phone_products = list(base_qs.filter(category__in=phone_descendants).order_by('-created_at')[:16])
        else:
            phone_products = []

        if len(phone_products) < 8:
            fallback_phone = base_qs.filter(
                Q(category__name__icontains="Phone") | Q(category__name__icontains="Electronic") | Q(name__icontains="Phone")
            ).exclude(id__in=[p.id for p in phone_products]).order_by('-created_at')[:12]
            phone_products.extend(list(fallback_phone))

        sections.append({
            "id": "phone_deals",
            "type": "horizontal_shelf",
            "title": "Brand New Deals in Phones",
            "subtitle": "Smartphones, mobile accessories & hot electronic gadgets",
            "category_slug": phone_cat.slug if phone_cat else "electronics",
            "see_more_url": f"/products?category={phone_cat.slug if phone_cat else 'electronics'}",
            "products": ProductSerializer(phone_products[:16], many=True, context={'request': request}).data
        })

        # 4. Section: "View More in Home & Living"
        home_cat = get_category_by_slug_or_keywords(
            'home-garden-furniture',
            ["Home", "Furniture", "Appliances", "Living"]
        )
        if home_cat:
            home_descendants = home_cat.get_descendants(include_self=True)
            home_products = list(base_qs.filter(category__in=home_descendants).order_by('-created_at')[:16])
        else:
            home_products = []

        if len(home_products) < 8:
            fallback_home = base_qs.filter(
                Q(category__name__icontains="Home") | Q(category__name__icontains="Furniture")
            ).exclude(id__in=[p.id for p in home_products]).order_by('-created_at')[:12]
            home_products.extend(list(fallback_home))

        if home_products:
            sections.append({
                "id": "view_more_home",
                "type": "horizontal_shelf",
                "title": f"View More in {home_cat.name if home_cat else 'Home & Living'}",
                "subtitle": "Popular furnishings, kitchen electronics & home appliances",
                "category_slug": home_cat.slug if home_cat else "home-garden-furniture",
                "see_more_url": f"/products?category={home_cat.slug if home_cat else 'home-garden-furniture'}",
                "products": ProductSerializer(home_products[:16], many=True, context={'request': request}).data
            })

        # 5. Section: "Fresh Picks" (Latest across all categories)
        fresh_products = list(base_qs.order_by('-created_at')[:16])
        sections.append({
            "id": "fresh_picks",
            "type": "horizontal_shelf",
            "title": "Fresh Picks Across All Categories",
            "subtitle": "Just listed verified products in Tanzania",
            "category_slug": "",
            "see_more_url": "/products?sort_by=newest",
            "products": ProductSerializer(fresh_products, many=True, context={'request': request}).data
        })

        return Response({
            "status": "success",
            "sections": sections
        })


class CategoryRecommendationsView(APIView):
    """
    Returns closest related products for a given category.
    Used for interleaving recommendations after row 2/3 of category listings.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cat_slug = request.query_params.get('category')
        exclude_param = request.query_params.get('exclude', '')
        limit = int(request.query_params.get('limit', 24))

        exclude_ids = []
        if exclude_param:
            for item in exclude_param.split(','):
                item = item.strip()
                if item.isdigit():
                    exclude_ids.append(int(item))

        base_qs = get_base_product_queryset(request.user)
        if exclude_ids:
            base_qs = base_qs.exclude(id__in=exclude_ids)

        if not cat_slug:
            recommended = base_qs.order_by('-annotated_avg_rating', '-annotated_like_count')[:limit]
            return Response({
                "category": None,
                "title": "You Might Also Like",
                "subtitle": "Popular picks across the market",
                "products": ProductSerializer(recommended, many=True, context={'request': request}).data
            })

        cat = Category.objects.filter(slug=cat_slug).first()
        if not cat:
            cat = Category.objects.filter(name__icontains=cat_slug).first()

        if not cat:
            recommended = base_qs.order_by('-created_at')[:limit]
            return Response({
                "category": cat_slug,
                "title": "You Might Also Like",
                "subtitle": "Popular picks across the market",
                "products": ProductSerializer(recommended, many=True, context={'request': request}).data
            })

        # Related Category Strategy:
        # 1. If subcategory: look for sibling categories in the same parent
        # 2. If top category (or if siblings have no products): pick another active top-level category
        products = []
        related_name = None

        if cat.parent:
            siblings = Category.objects.filter(parent=cat.parent).exclude(id=cat.id)
            sib_desc = []
            for s in siblings:
                sib_desc.extend(s.get_descendants(include_self=True))
            sib_qs = base_qs.filter(category__in=sib_desc).order_by('-created_at')
            if sib_qs.count() >= 4:
                products = list(sib_qs[:limit])
                first_sib = siblings.first()
                related_name = first_sib.name if first_sib else cat.parent.name

        if not products:
            current_root_id = cat.parent_id if cat.parent else cat.id
            other_roots = Category.objects.filter(parent__isnull=True).exclude(id=current_root_id)
            for other in other_roots:
                desc = other.get_descendants(include_self=True)
                other_qs = base_qs.filter(category__in=desc).order_by('-created_at')
                if other_qs.count() >= 4:
                    products = list(other_qs[:limit])
                    related_name = other.name
                    break

        if not products:
            current_desc = cat.get_descendants(include_self=True)
            any_qs = base_qs.exclude(category__in=current_desc).order_by('-created_at')
            products = list(any_qs[:limit])
            related_name = "Trending Items"

        title = "You Might Also Like"
        subtitle = f"Popular in {related_name}" if related_name else "Related items you might like"

        return Response({
            "category": cat.slug,
            "category_name": cat.name,
            "related_category_name": related_name,
            "title": title,
            "subtitle": subtitle,
            "products": ProductSerializer(products[:limit], many=True, context={'request': request}).data
        })
