"""Offline builders for recommendations v3. All functions are safe to re-run at any time.

refresh_product_stats()   hourly   -> ProductStats
build_recs(only_ids=None) nightly + on product save -> ProductRecs
prune_rec_data()          weekly   -> trims old/weak signal rows
"""
import logging
from collections import Counter, defaultdict
from datetime import timedelta

from django.db.models import Avg, Count, Sum
from django.utils import timezone

from marketplace.models import (
    Product, Category, Like, OrderItem, Review, ProductVehicleFitment,
    ProductStats, ProductRecs, ProductDailyStat, ProductCoView, RecSurfaceDailyStat,
)
from . import config
from .scoring import tokenize, spec_tokens, jaccard, price_sim, raw_popularity, quality_score, weighted

logger = logging.getLogger(__name__)

STATS_FIELDS = ['views_7d', 'views_30d', 'likes', 'orders_7d', 'orders_30d', 'rating_avg', 'rating_count',
                'has_inspection', 'inspection_verdict', 'inspection_pass', 'popularity', 'quality', 'updated_at']


def _active():
    return Product.objects.filter(is_available=True, is_draft=False, stock__gt=0)


# ─── Hourly: ProductStats ──────────────────────────────────────────
def refresh_product_stats():
    now = timezone.now()
    today = timezone.localdate()
    products = list(_active().order_by().values('id', 'seller__profile__is_verified'))
    if not products:
        return 0

    def summed_views(days):
        return dict(ProductDailyStat.objects.filter(date__gte=today - timedelta(days=days)).order_by()
                    .values('product_id').annotate(n=Sum('views')).values_list('product_id', 'n'))

    def paid_orders(days):
        return dict(OrderItem.objects.filter(order__status__in=config.PAID_STATUSES,
                                             order__order_date__gte=now - timedelta(days=days)).order_by()
                    .values('product_id').annotate(n=Count('order_id', distinct=True)).values_list('product_id', 'n'))

    views7, views30 = summed_views(7), summed_views(30)
    orders7, orders30 = paid_orders(7), paid_orders(30)
    likes = dict(Like.objects.order_by().values('product_id').annotate(n=Count('id')).values_list('product_id', 'n'))
    ratings = {r['product_id']: (float(r['avg'] or 0.0), r['cnt']) for r in
               Review.objects.filter(approved=True).order_by().values('product_id')
               .annotate(avg=Avg('rating'), cnt=Count('id'))}

    from inspections.models import InspectionRequest
    verdicts = {}
    for pid, verdict in (InspectionRequest.objects.filter(status='published', marketplace_product__isnull=False)
                         .order_by('id').values_list('marketplace_product_id', 'report__verdict')):
        verdicts[pid] = verdict or ''

    raw = {p['id']: raw_popularity(views7.get(p['id'], 0), likes.get(p['id'], 0), orders30.get(p['id'], 0))
           for p in products}
    top = max(raw.values()) or 1.0

    rows = []
    for p in products:
        pid = p['id']
        r_avg, r_cnt = ratings.get(pid, (0.0, 0))
        verdict = verdicts.get(pid)
        passed = verdict == 'pass'
        rows.append(ProductStats(
            product_id=pid,
            views_7d=views7.get(pid, 0) or 0,
            views_30d=views30.get(pid, 0) or 0,
            likes=likes.get(pid, 0) or 0,
            orders_7d=orders7.get(pid, 0) or 0,
            orders_30d=orders30.get(pid, 0) or 0,
            rating_avg=round(r_avg, 2),
            rating_count=r_cnt,
            has_inspection=verdict is not None,
            inspection_verdict=(verdict or '')[:20],
            inspection_pass=passed,
            popularity=round(raw[pid] / top, 4),
            quality=quality_score(passed, bool(p['seller__profile__is_verified']), r_avg, r_cnt),
            updated_at=now,
        ))
    ProductStats.objects.bulk_create(rows, batch_size=500, update_conflicts=True,
                                     unique_fields=['product'], update_fields=STATS_FIELDS)
    return len(rows)


# ─── Nightly: ProductRecs ──────────────────────────────────────────
def _load_catalog():
    rows = list(_active().order_by().values(
        'id', 'name', 'price', 'category_id', 'category__parent_id', 'brand_id', 'brand__name',
        'reference_product_id', 'condition', 'seller_id', 'structured_specs'))
    stats = {s['product_id']: s for s in ProductStats.objects.values('product_id', 'popularity', 'quality')}
    for r in rows:
        st = stats.get(r['id'], {})
        r['popularity'] = float(st.get('popularity', 0.0) or 0.0)
        r['quality'] = float(st.get('quality', 0.0) or 0.0)
        r['tokens'] = tokenize(r['name'], r['brand__name']) | spec_tokens(r['structured_specs'])
        r['price_f'] = float(r['price'] or 0)
    return rows


def _load_relations():
    related = defaultdict(set)
    through = Category.related_categories.through
    for a, b in through.objects.values_list('from_category_id', 'to_category_id'):
        related[a].add(b)

    coview = defaultdict(dict)
    for a, b, n in ProductCoView.objects.values_list('product_a_id', 'product_b_id', 'hits'):
        coview[a][b] = n

    baskets = defaultdict(set)
    since = timezone.now() - timedelta(days=365)
    for oid, pid in (OrderItem.objects.filter(order__status__in=config.PAID_STATUSES, order__order_date__gte=since)
                     .values_list('order_id', 'product_id')):
        baskets[oid].add(pid)
    copurchase = defaultdict(Counter)
    for items in baskets.values():
        if 2 <= len(items) <= 20:
            for a in items:
                for b in items:
                    if a != b:
                        copurchase[a][b] += 1

    fitments, by_vehicle = defaultdict(set), defaultdict(set)
    for pid, vid in ProductVehicleFitment.objects.values_list('product_id', 'vehicle_id'):
        fitments[pid].add(vid)
        by_vehicle[vid].add(pid)
    return related, coview, copurchase, fitments, by_vehicle


def _similar_for(p, by_cat, by_parent):
    own = [c for c in by_cat.get(p['category_id'], []) if c['id'] != p['id']]
    candidates = [(c, 1.0) for c in own]
    if len(own) < config.SIMILAR_MIN_SAME_CATEGORY:
        parent_key = p['category__parent_id'] or p['category_id']
        seen = {c['id'] for c in own} | {p['id']}
        for c in by_parent.get(parent_key, []):
            if c['id'] not in seen:
                candidates.append((c, config.SIBLING_CATEGORY_FACTOR))
                seen.add(c['id'])
    if len(candidates) > config.MAX_CANDIDATES_PER_PRODUCT:
        candidates.sort(key=lambda t: -price_sim(p['price_f'], t[0]['price_f']))
        candidates = candidates[:config.MAX_CANDIDATES_PER_PRODUCT]

    scored = []
    for c, factor in candidates:
        same_brand = bool((p['brand_id'] and p['brand_id'] == c['brand_id']) or
                          (p['reference_product_id'] and p['reference_product_id'] == c['reference_product_id']))
        comps = {
            'text': jaccard(p['tokens'], c['tokens']),
            'price': price_sim(p['price_f'], c['price_f']),
            'brand': 1.0 if same_brand else 0.0,
            'condition': 1.0 if p['condition'] == c['condition'] else 0.0,
            'quality': c['quality'],
            'popularity': c['popularity'],
        }
        total, _ = weighted(comps, config.W_SIMILAR)
        scored.append([c['id'], round(total * factor, 4), [round(comps[k] * factor, 3) for k in config.W_SIMILAR]])
    scored.sort(key=lambda e: (-e[1], e[0]))
    return scored[:config.SIMILAR_STORE]


def _complements_for(p, idx, by_cat_popular, by_parent_cats, by_seller_ids, related, coview, copurchase,
                     fitments, by_vehicle):
    pid, own_cat = p['id'], p['category_id']
    affinity = {}

    def bump(cid, value):
        if value > affinity.get(cid, 0.0):
            affinity[cid] = value

    cv = coview.get(pid, {})
    cp = copurchase.get(pid, {})
    cand_ids = set(cv) | set(cp)
    for cat_id in related.get(own_cat, ()):
        for cid in by_cat_popular.get(cat_id, [])[:config.COMPLEMENT_CATEGORY_TAKE]:
            cand_ids.add(cid)
            bump(cid, 1.0)
    if p['category__parent_id']:
        for cat_id in by_parent_cats.get(p['category__parent_id'], ()):
            if cat_id == own_cat:
                continue
            for cid in by_cat_popular.get(cat_id, [])[:config.COMPLEMENT_CATEGORY_TAKE]:
                cand_ids.add(cid)
                bump(cid, 0.5)
    for vid in fitments.get(pid, ()):
        for cid in sorted(by_vehicle.get(vid, ()))[:100]:
            cand_ids.add(cid)
            bump(cid, 0.8)
    for cid in by_seller_ids.get(p['seller_id'], [])[:30]:
        cand_ids.add(cid)
        bump(cid, 0.3)
    cand_ids.discard(pid)

    max_cv = max(cv.values()) if cv else 0
    max_cp = max(cp.values()) if cp else 0
    scored = []
    for cid in cand_ids:
        c = idx.get(cid)
        if c is None or c['category_id'] == own_cat:
            continue
        comps = {
            'coview': (cv.get(cid, 0) / max_cv) if max_cv else 0.0,
            'copurchase': (cp.get(cid, 0) / max_cp) if max_cp else 0.0,
            'category': affinity.get(cid, 0.0),
            'popularity': c['popularity'],
            'quality': c['quality'],
        }
        total, _ = weighted(comps, config.W_COMPLEMENT)
        scored.append([cid, total, [round(comps[k], 3) for k in config.W_COMPLEMENT]])
    scored.sort(key=lambda e: (-e[1], e[0]))
    return scored[:config.COMPLEMENT_STORE]


def build_recs(only_ids=None):
    catalog = _load_catalog()
    if not catalog:
        return 0
    idx = {r['id']: r for r in catalog}
    by_cat, by_parent = defaultdict(list), defaultdict(list)
    by_parent_cats, by_seller = defaultdict(set), defaultdict(list)
    for r in catalog:
        by_cat[r['category_id']].append(r)
        if r['category__parent_id']:
            by_parent[r['category__parent_id']].append(r)
            by_parent_cats[r['category__parent_id']].add(r['category_id'])
        by_seller[r['seller_id']].append(r)
    by_cat_popular = {k: [r['id'] for r in sorted(v, key=lambda r: (-r['popularity'], r['id']))] for k, v in by_cat.items()}
    by_seller_ids = {k: [r['id'] for r in sorted(v, key=lambda r: (-r['popularity'], r['id']))] for k, v in by_seller.items()}
    related, coview, copurchase, fitments, by_vehicle = _load_relations()

    targets = catalog if only_ids is None else [idx[i] for i in only_ids if i in idx]
    rows = []
    for p in targets:
        rows.append(ProductRecs(
            product_id=p['id'],
            similar=_similar_for(p, by_cat, by_parent),
            complements=_complements_for(p, idx, by_cat_popular, by_parent_cats, by_seller_ids,
                                         related, coview, copurchase, fitments, by_vehicle),
        ))
    ProductRecs.objects.bulk_create(rows, batch_size=200, update_conflicts=True,
                                    unique_fields=['product'], update_fields=['similar', 'complements', 'computed_at'])
    logger.info("build_recs: wrote %s rows", len(rows))
    return len(rows)


# ─── Weekly: pruning ───────────────────────────────────────────────
def prune_rec_data():
    today = timezone.localdate()
    ProductDailyStat.objects.filter(date__lt=today - timedelta(days=config.DAILY_STATS_KEEP_DAYS)).delete()
    RecSurfaceDailyStat.objects.filter(date__lt=today - timedelta(days=config.SURFACE_STATS_KEEP_DAYS)).delete()
    ProductCoView.objects.filter(last_seen__lt=today - timedelta(days=config.COVIEW_MAX_AGE_DAYS)).delete()
    heavy = list(ProductCoView.objects.order_by().values('product_a_id').annotate(n=Count('id'))
                 .filter(n__gt=config.COVIEW_KEEP_PER_PRODUCT).values_list('product_a_id', flat=True))
    removed = 0
    for pid in heavy:
        keep = list(ProductCoView.objects.filter(product_a_id=pid).order_by('-hits', '-last_seen')
                    .values_list('id', flat=True)[:config.COVIEW_KEEP_PER_PRODUCT])
        removed += ProductCoView.objects.filter(product_a_id=pid).exclude(id__in=keep).delete()[0]
    return removed
