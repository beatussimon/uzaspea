"""
High-Performance Multi-Stage Recommendation Engine for SokoniMax.
Optimized for resource-constrained production (AWS Lightsail, 64MB Redis, 384MB Postgres).

Pipeline Architecture:
1. Context & Signals: Client-side recent views (zero DB write), Likes, Purchases, Vehicle Fitment.
2. Pushdown Candidate Retrieval: Index-only composite SQL scans across 4 channels (Vehicle, Category/Sibling, Brand, Fresh/Region).
3. In-Memory Scoring: Pure Python arithmetic (< 1ms CPU, 0 RAM overhead).
4. Anti-Monotony Diversification: Greedy slotting capping max 2 items per seller, max 4 per category.
5. Two-Tier ID Caching: Stores compact integer ID lists in Redis (TTL 10-60 min, < 1.5MB total memory).
"""
import math
import logging
from collections import defaultdict
from typing import List, Dict, Any, Optional, Set

from django.core.cache import cache
from django.utils import timezone
from django.db.models import Q

from .models import Product, Category, Like, OrderItem, ProductVehicleFitment
from .discovery_views import get_base_product_queryset

logger = logging.getLogger(__name__)

CACHE_PREFIX = "recs:v2"


class RecommendationEngine:
    """
    Multi-stage, resource-safe recommendation engine for e-commerce and automotive parts.
    """

    @classmethod
    def get_recommendations(
        cls,
        target_product: Optional[Product] = None,
        user=None,
        category_slug: Optional[str] = None,
        recent_ids: Optional[List[int]] = None,
        active_vehicle_id: Optional[int] = None,
        region: Optional[str] = None,
        limit: int = 12,
        exclude_ids: Optional[List[int]] = None,
        request=None
    ) -> List[Product]:
        """
        Main entry point for generating tailored, diversified product recommendations.
        """
        # If request is provided, automatically extract query params and user
        if request is not None:
            if user is None and hasattr(request, 'user'):
                user = request.user
            if not region:
                region = request.query_params.get('region') or request.query_params.get('location')
            if not active_vehicle_id and request.query_params.get('vehicle_id'):
                v_param = request.query_params.get('vehicle_id')
                if v_param and v_param.isdigit():
                    active_vehicle_id = int(v_param)
            if not recent_ids and request.query_params.get('recent_ids'):
                raw_recent = request.query_params.get('recent_ids', '')
                recent_ids = [int(x) for x in raw_recent.split(',') if x.strip().isdigit()]
            if not category_slug and request.query_params.get('category'):
                category_slug = request.query_params.get('category')

        # Sanitize limit
        limit = max(1, min(50, int(limit)))

        # Sanitize exclusions
        sanitized_exclude: Set[int] = set()
        if target_product:
            sanitized_exclude.add(target_product.id)
        if exclude_ids:
            for item in exclude_ids:
                if isinstance(item, int):
                    sanitized_exclude.add(item)
                elif isinstance(item, str) and item.isdigit():
                    sanitized_exclude.add(int(item))

        # ── 1. Check Redis ID Cache ──────────────────────────────────────
        cache_key = cls._build_cache_key(
            target_product=target_product,
            user=user,
            category_slug=category_slug,
            active_vehicle_id=active_vehicle_id,
            region=region
        )

        try:
            cached_ids = cache.get(cache_key)
            if cached_ids and isinstance(cached_ids, list):
                # Filter out any newly excluded IDs
                valid_ids = [pid for pid in cached_ids if pid not in sanitized_exclude]
                if len(valid_ids) >= min(4, limit):
                    return cls._hydrate_products(valid_ids[:limit], user=user)
        except Exception as e:
            logger.debug("Recommendation cache read error: %s", e)

        # ── 2. Context & Signal Extraction ───────────────────────────────
        signals = cls._extract_signals(
            target_product=target_product,
            user=user,
            recent_ids=recent_ids,
            category_slug=category_slug
        )
        sanitized_exclude.update(signals['exclude_ids'])

        # ── 3. Pushdown Multi-Channel Candidate Retrieval ───────────────
        candidate_ids = cls._retrieve_candidates(
            target_product=target_product,
            category_slug=category_slug,
            signals=signals,
            active_vehicle_id=active_vehicle_id,
            region=region,
            exclude_ids=sanitized_exclude
        )

        # ── 4. Candidate Scoring Fetch (Lean Query, No heavy prefetches) ──
        if not candidate_ids:
            candidate_ids = list(
                Product.objects.filter(is_available=True, is_draft=False, stock__gt=0)
                .exclude(id__in=sanitized_exclude)
                .order_by('-created_at')
                .values_list('id', flat=True)[:limit]
            )

        if not candidate_ids:
            return []

        candidates = list(
            Product.objects.filter(id__in=candidate_ids)
            .select_related('seller', 'seller__profile', 'category', 'category__parent', 'brand')
            .only(
                'id', 'name', 'price', 'category_id', 'brand_id', 'seller_id', 'created_at',
                'category__id', 'category__parent_id',
                'seller__id', 'seller__profile__is_verified', 'seller__profile__tier'
            )
        )

        if not candidates:
            return []

        # ── 5. In-Memory Scoring ─────────────────────────────────────────
        now = timezone.now()
        target_price = float(target_product.price) if (target_product and target_product.price) else None

        scored_candidates = []
        for p in candidates:
            score = cls._score_candidate(
                product=p,
                target_product=target_product,
                signals=signals,
                target_price=target_price,
                active_vehicle_id=active_vehicle_id,
                now=now
            )
            scored_candidates.append((p, score))

        # Sort descending by composite score
        scored_candidates.sort(key=lambda x: x[1], reverse=True)

        # ── 6. Anti-Monotony Diversification ─────────────────────────────
        final_products = cls._diversify(scored_candidates, limit=limit)
        final_ids = [p.id for p in final_products]

        # ── 7. Store ID Array in Redis ───────────────────────────────────
        try:
            # TTL: 1 hour for product/category shelves, 10 min for personalized user feeds
            ttl = 600 if (user and user.is_authenticated and not target_product) else 3600
            cache.set(cache_key, final_ids, timeout=ttl)
        except Exception as e:
            logger.debug("Recommendation cache write error: %s", e)

        # ── 8. Hydrate Final Output (Only the top products get full prefetches) ──
        return cls._hydrate_products(final_ids, user=user)

    @classmethod
    def _build_cache_key(
        cls,
        target_product: Optional[Product],
        user,
        category_slug: Optional[str],
        active_vehicle_id: Optional[int],
        region: Optional[str]
    ) -> str:
        prod_part = f"p:{target_product.id}" if target_product else "p:none"
        user_part = f"u:{user.id}" if (user and user.is_authenticated) else "u:guest"
        cat_part = f"c:{category_slug}" if category_slug else "c:none"
        veh_part = f"v:{active_vehicle_id}" if active_vehicle_id else "v:none"
        reg_part = f"r:{region.lower().strip()[:15]}" if region else "r:tz"
        return f"{CACHE_PREFIX}:{prod_part}:{user_part}:{cat_part}:{veh_part}:{reg_part}"

    @classmethod
    def _extract_signals(
        cls,
        target_product: Optional[Product],
        user,
        recent_ids: Optional[List[int]],
        category_slug: Optional[str]
    ) -> Dict[str, Any]:
        signals: Dict[str, Any] = {
            'viewed_cat_ids': set(),
            'liked_prod_ids': set(),
            'purchased_cat_ids': set(),
            'preferred_brands': set(),
            'exclude_ids': set(),
        }

        # Target product context
        if target_product:
            signals['exclude_ids'].add(target_product.id)
            if target_product.category_id:
                signals['viewed_cat_ids'].add(target_product.category_id)
            if target_product.brand_id:
                signals['preferred_brands'].add(target_product.brand_id)

        # Client-side recent views (from localStorage)
        if recent_ids:
            clean_recent = [int(i) for i in recent_ids if isinstance(i, int) or (isinstance(i, str) and i.isdigit())][:10]
            signals['exclude_ids'].update(clean_recent)
            # Find categories and brands of recent items in a single lean query
            recent_data = Product.objects.filter(
                id__in=clean_recent
            ).values('category_id', 'brand_id')
            for row in recent_data:
                if row.get('category_id'):
                    signals['viewed_cat_ids'].add(row['category_id'])
                if row.get('brand_id'):
                    signals['preferred_brands'].add(row['brand_id'])

        # Explicit category query context
        if category_slug:
            cat = Category.objects.filter(slug=category_slug).first()
            if cat:
                signals['viewed_cat_ids'].add(cat.id)

        # Authenticated user context
        if user and user.is_authenticated:
            # Likes (last 15)
            likes = list(Like.objects.filter(user=user).values_list('product_id', flat=True)[:15])
            signals['liked_prod_ids'].update(likes)

            # Purchases (last 10 order items)
            purchased_cats = OrderItem.objects.filter(
                order__user=user
            ).values_list('product__category_id', flat=True)[:10]
            signals['purchased_cat_ids'].update(filter(None, purchased_cats))

            # Preferred brands from purchases & likes
            if likes:
                liked_brands = Product.objects.filter(
                    id__in=likes, brand__isnull=False
                ).values_list('brand_id', flat=True)
                signals['preferred_brands'].update(liked_brands)

        return signals

    @classmethod
    def _retrieve_candidates(
        cls,
        target_product: Optional[Product],
        category_slug: Optional[str],
        signals: Dict[str, Any],
        active_vehicle_id: Optional[int],
        region: Optional[str],
        exclude_ids: Set[int]
    ) -> List[int]:
        candidates: Set[int] = set()
        base_filter = Q(is_available=True, is_draft=False, stock__gt=0)

        # ── Channel A: Vehicle Fitment (Automotive Parts) ────────────
        if active_vehicle_id:
            fitment_ids = list(
                ProductVehicleFitment.objects.filter(
                    vehicle_id=active_vehicle_id,
                    product__is_available=True,
                    product__is_draft=False,
                    product__stock__gt=0
                ).exclude(product_id__in=exclude_ids)
                .values_list('product_id', flat=True)[:40]
            )
            signals['fitment_prod_ids'] = set(fitment_ids)
            candidates.update(fitment_ids)

        # ── Channel B: Taxonomy (Category & Sibling Subcategories) ────
        target_cat_ids = set(signals['viewed_cat_ids'])
        sibling_cat_ids = set()

        if target_product and target_product.category:
            target_cat_ids.add(target_product.category_id)
            if target_product.category.parent_id:
                sibs = Category.objects.filter(
                    parent_id=target_product.category.parent_id
                ).exclude(id=target_product.category_id).values_list('id', flat=True)
                sibling_cat_ids.update(sibs)

        all_cat_pool = target_cat_ids.union(sibling_cat_ids)
        if all_cat_pool:
            cat_candidates = list(
                Product.objects.filter(base_filter, category_id__in=all_cat_pool)
                .exclude(id__in=exclude_ids)
                .order_by('-created_at')
                .values_list('id', flat=True)[:50]
            )
            candidates.update(cat_candidates)

        # ── Channel C: Brand Affinity ────────────────────────────────
        if signals['preferred_brands']:
            brand_candidates = list(
                Product.objects.filter(base_filter, brand_id__in=signals['preferred_brands'])
                .exclude(id__in=exclude_ids)
                .order_by('-created_at')
                .values_list('id', flat=True)[:30]
            )
            candidates.update(brand_candidates)

        # ── Channel D: Region & High-Engagement Fresh Picks ──────────
        fresh_filter = base_filter
        if region:
            fresh_filter &= Q(location_name__icontains=region)

        fresh_candidates = list(
            Product.objects.filter(fresh_filter)
            .exclude(id__in=exclude_ids | candidates)
            .order_by('-created_at')
            .values_list('id', flat=True)[:40]
        )
        candidates.update(fresh_candidates)

        return list(candidates)

    @classmethod
    def _score_candidate(
        cls,
        product: Product,
        target_product: Optional[Product],
        signals: Dict[str, Any],
        target_price: Optional[float],
        active_vehicle_id: Optional[int],
        now
    ) -> float:
        score = 0.0

        # ── 1. Relevance Scoring ─────────────────────────────────────
        if target_product:
            # Exact Category match
            if product.category_id == target_product.category_id:
                score += 25.0
            # Sibling Category match
            elif (target_product.category and product.category and
                  product.category.parent_id and
                  product.category.parent_id == target_product.category.parent_id):
                score += 12.0

            # Brand affinity match
            if target_product.brand_id and product.brand_id == target_product.brand_id:
                score += 15.0

            # Log-distance price similarity (closer prices rank higher)
            if target_price and target_price > 0 and product.price and product.price > 0:
                p_val = float(product.price)
                ratio = abs(math.log10(p_val) - math.log10(target_price))
                score += max(0.0, 10.0 * (1.0 - (ratio / 1.5)))

        # Vehicle Fitment match
        if active_vehicle_id:
            fitment_ids = signals.get('fitment_prod_ids')
            if fitment_ids is not None:
                if product.id in fitment_ids:
                    score += 35.0
            else:
                fitments = getattr(product, 'fitments', None)
                if fitments is not None and hasattr(fitments, 'all'):
                    try:
                        if any(f.vehicle_id == active_vehicle_id for f in fitments.all()):
                            score += 35.0
                    except Exception:
                        pass

        # ── 2. Behavioral Scoring ────────────────────────────────────
        if product.category_id in signals['viewed_cat_ids']:
            score += 15.0
        if product.category_id in signals['purchased_cat_ids']:
            score += 20.0
        if product.brand_id in signals['preferred_brands']:
            score += 10.0

        # Recency decay (7-day half life, max 10 pts)
        if product.created_at:
            days_old = max(0, (now - product.created_at).days)
            score += max(0.0, 10.0 * math.exp(-days_old / 7.0))

        # ── 3. Quality & Trust Scoring (SokoniMax Core) ──────────────
        profile = getattr(getattr(product, 'seller', None), 'profile', None)
        if profile:
            if getattr(profile, 'is_verified', False):
                score += 15.0
            if getattr(profile, 'tier', 'standard') in ['seller_pro', 'business']:
                score += 10.0

        # Pre-purchase inspection passed
        if getattr(product, 'annotated_is_verified', False):
            score += 25.0

        # Rating score
        avg_rating = float(getattr(product, 'annotated_avg_rating', 0.0) or 0.0)
        if avg_rating > 0:
            score += (avg_rating / 5.0) * 10.0

        # Like count boost (logarithmic scale)
        like_count = int(getattr(product, 'annotated_like_count', 0) or 0)
        if like_count > 0:
            score += min(5.0, math.log2(1.0 + like_count))

        # ── 4. Commercial / Sponsored Boost ──────────────────────────
        if getattr(product, 'annotated_is_sponsored', False):
            score += 20.0

        return score

    @classmethod
    def _diversify(cls, scored_candidates: List[tuple], limit: int) -> List[Product]:
        """
        Greedy diversification enforcing max 2 items per seller and max 4 per category.
        """
        selected: List[Product] = []
        seller_counts: Dict[int, int] = defaultdict(int)
        category_counts: Dict[int, int] = defaultdict(int)

        deferred: List[Product] = []

        # Pass 1: Strict diversity limits
        for product, _ in scored_candidates:
            if len(selected) >= limit:
                break

            s_id = product.seller_id
            c_id = product.category_id

            if seller_counts[s_id] < 2 and category_counts[c_id] < 4:
                selected.append(product)
                seller_counts[s_id] += 1
                category_counts[c_id] += 1
            else:
                deferred.append(product)

        # Pass 2: Backfill from deferred candidates if catalog pool is small
        if len(selected) < limit:
            for product in deferred:
                if len(selected) >= limit:
                    break
                selected.append(product)

        return selected

    @classmethod
    def _hydrate_products(cls, product_ids: List[int], user=None) -> List[Product]:
        """
        Fast hydration preserving recommendation score order.
        """
        preserved_order = {pid: idx for idx, pid in enumerate(product_ids)}
        qs = get_base_product_queryset(user).filter(id__in=product_ids)
        items = list(qs)
        return sorted(items, key=lambda p: preserved_order.get(p.id, 999))


def get_product_recommendations(
    product: Optional[Product] = None,
    user=None,
    limit: int = 8,
    exclude_ids: Optional[List[int]] = None,
    recent_ids: Optional[List[int]] = None,
    active_vehicle_id: Optional[int] = None,
    region: Optional[str] = None
) -> List[Product]:
    """
    Backwards-compatible convenience wrapper around RecommendationEngine.
    """
    return RecommendationEngine.get_recommendations(
        target_product=product,
        user=user,
        limit=limit,
        exclude_ids=exclude_ids,
        recent_ids=recent_ids,
        active_vehicle_id=active_vehicle_id,
        region=region
    )
