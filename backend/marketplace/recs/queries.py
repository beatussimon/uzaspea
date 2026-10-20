"""Shared DB/Redis helpers. Redis only ever stores small lists of integer ids, always with a TTL."""
import re

from django.core.cache import cache
from django.db.models import F, Q
from django.utils import timezone

from marketplace.models import Product, Like, SponsoredListing
from . import config

ACTIVE = {'is_available': True, 'is_draft': False, 'stock__gt': 0}


def cache_key(*parts):
    clean = [re.sub(r'[^a-z0-9]+', '-', str(p).lower()).strip('-') or 'none' for p in parts]
    return ':'.join([config.CACHE_PREFIX] + clean)


def popularity_order():
    return [F('stats__popularity').desc(nulls_last=True), '-created_at', 'id']


def card_queryset():
    return (Product.objects.filter(**ACTIVE)
            .select_related('seller', 'seller__profile', 'category', 'category__parent', 'stats')
            .prefetch_related('images', 'variants', 'price_tiers'))


def hydrate(ids):
    """Active products for `ids`, in the same order. Unavailable ids are silently dropped."""
    ids = [int(i) for i in ids if i]
    if not ids:
        return []
    order = {pid: idx for idx, pid in enumerate(ids)}
    items = list(card_queryset().filter(id__in=list(order)))
    items.sort(key=lambda p: order[p.id])
    return items


def active_sponsored_ids():
    key = cache_key('sponsored')
    ids = cache.get(key)
    if ids is None:
        now = timezone.now()
        ids = list(SponsoredListing.objects.filter(status='approved')
                   .filter(Q(expires_at__gt=now) | Q(expires_at__isnull=True))
                   .values_list('product_id', flat=True).distinct())
        cache.set(key, ids, config.SPONSORED_TTL)
    return set(ids)


def liked_ids(user, product_ids):
    if not user or not getattr(user, 'is_authenticated', False) or not product_ids:
        return set()
    return set(Like.objects.filter(user=user, product_id__in=list(product_ids)).values_list('product_id', flat=True))


def category_ids_with_descendants(category):
    key = cache_key('catdesc', category.id)
    ids = cache.get(key)
    if ids is None:
        ids = list(category.get_descendants(include_self=True).values_list('id', flat=True))
        cache.set(key, ids, 3600)
    return ids


def category_pool(category_id):
    """Top POOL_SIZE active products in a category (and its children) by popularity, then newest."""
    key = cache_key('catpool', category_id)
    ids = cache.get(key)
    if ids is None:
        from marketplace.models import Category
        category = Category.objects.filter(id=category_id).first()
        if category is None:
            return []
        cat_ids = category_ids_with_descendants(category)
        ids = list(Product.objects.filter(category_id__in=cat_ids, **ACTIVE)
                   .order_by(*popularity_order()).values_list('id', flat=True)[:config.POOL_SIZE])
        cache.set(key, ids, config.POOL_TTL)
    return ids


def trending_pool(region=None):
    region = (region or '').strip()
    key = cache_key('trend', region or 'all')
    ids = cache.get(key)
    if ids is None:
        qs = Product.objects.filter(**ACTIVE)
        if region:
            qs = qs.filter(Q(location_name__icontains=region) | Q(seller__profile__location__icontains=region))
        ids = list(qs.order_by(*popularity_order()).values_list('id', flat=True)[:config.POOL_SIZE])
        if region and len(ids) < config.MIN_SHELF_ITEMS * 2:
            national = trending_pool(None)
            ids = (ids + [i for i in national if i not in ids])[:config.POOL_SIZE]
        cache.set(key, ids, config.TREND_TTL)
    return ids


def fresh_pool():
    key = cache_key('fresh')
    ids = cache.get(key)
    if ids is None:
        ids = list(Product.objects.filter(**ACTIVE).order_by('-created_at', '-id')
                   .values_list('id', flat=True)[:config.POOL_SIZE])
        cache.set(key, ids, config.POOL_TTL)
    return ids


def vehicle_pool(vehicle_id):
    if not vehicle_id:
        return []
    key = cache_key('veh', vehicle_id)
    ids = cache.get(key)
    if ids is None:
        ids = list(Product.objects.filter(fitments__vehicle_id=vehicle_id, **ACTIVE)
                   .order_by(*popularity_order()).values_list('id', flat=True)[:config.POOL_SIZE])
        cache.set(key, ids, config.POOL_TTL)
    return ids
