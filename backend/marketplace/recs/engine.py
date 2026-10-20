"""Online serving: merge candidates, personal re-rank, diversity, sponsored/explore slots, shelves."""
import math
from dataclasses import dataclass, field

from django.utils import timezone

from marketplace.models import Product, ProductRecs, EditorialShelf, Category
from . import config
from .context import RecContext
from .queries import (category_pool, trending_pool, fresh_pool, vehicle_pool, active_sponsored_ids,
                      category_ids_with_descendants, popularity_order, ACTIVE)
from .scoring import weighted


@dataclass
class Scored:
    product_id: int
    score: float
    breakdown: dict = field(default_factory=dict)
    reason: str = ''
    slot: str = ''          # '' | 'sponsored' | 'explore'


def _named(weights, values, factor=1.0):
    out = {}
    for (key, w), v in zip(weights.items(), values or []):
        out[key] = round(w * float(v or 0) * factor, 4)
    return out


def _entries(stored, weights, reason, factor=1.0):
    """ProductRecs list -> candidate tuples (product_id, base_score, breakdown, reason)."""
    out = []
    for e in stored or []:
        if not isinstance(e, (list, tuple)) or len(e) < 2:
            continue
        comps = e[2] if len(e) > 2 else []
        out.append((int(e[0]), round(float(e[1]) * factor, 4), _named(weights, comps, factor), reason))
    return out


def _meta(ids):
    ids = list(ids)
    if not ids:
        return {}
    rows = (Product.objects.filter(id__in=ids, **ACTIVE)
            .values('id', 'category_id', 'category__parent_id', 'seller_id', 'location_name', 'created_at',
                    'stats__popularity', 'stats__quality'))
    out = {}
    for r in rows:
        r['popularity'] = float(r.pop('stats__popularity') or 0.0)
        r['quality'] = float(r.pop('stats__quality') or 0.0)
        out[r['id']] = r
    return out


def _personal(m, ctx, vehicle_ids, now):
    aff = ctx.cat_affinity.get(m['category_id'], 0.0)
    if not aff and m['category__parent_id']:
        aff = 0.5 * ctx.cat_affinity.get(m['category__parent_id'], 0.0)
    region_hit = 1.0 if (ctx.region and m['location_name'] and ctx.region.lower() in m['location_name'].lower()) else 0.0
    age_days = (now - m['created_at']).total_seconds() / 86400.0 if m['created_at'] else 365.0
    comps = {'affinity': aff, 'vehicle': 1.0 if m['id'] in vehicle_ids else 0.0, 'region': region_hit,
             'freshness': math.exp(-max(0.0, age_days) / 7.0)}
    return weighted(comps, config.W_PERSONAL)


def _diversify(items, meta, by_category=True):
    seller_n, cat_n, picked, deferred = {}, {}, [], []
    for s in items:
        m = meta[s.product_id]
        seller_ok = seller_n.get(m['seller_id'], 0) < config.MAX_PER_SELLER
        cat_ok = (not by_category) or cat_n.get(m['category_id'], 0) < config.MAX_PER_CATEGORY
        if seller_ok and cat_ok:
            picked.append(s)
            seller_n[m['seller_id']] = seller_n.get(m['seller_id'], 0) + 1
            cat_n[m['category_id']] = cat_n.get(m['category_id'], 0) + 1
        else:
            deferred.append(s)
    return picked + deferred


def _apply_slots(ranked, meta, limit):
    if not ranked:
        return []
    sponsored = active_sponsored_ids()
    top = max(ranked[0].score, 1e-6)
    organic = [s for s in ranked if s.product_id not in sponsored]
    spons = [s for s in ranked if s.product_id in sponsored and s.score >= config.SPONSORED_MIN_RELEVANCE * top]
    now = timezone.now()

    def is_new(s):
        m = meta[s.product_id]
        created = m.get('created_at')
        return bool(created) and (now - created).days <= config.NEW_LISTING_DAYS and m['popularity'] < config.EXPLORE_MAX_POPULARITY

    out, used, oi = [], set(), 0
    while len(out) < limit:
        pos = len(out) % config.SLOT_EVERY
        if pos == config.SPONSORED_SLOT_INDEX and spons:
            s = spons.pop(0)
            if s.product_id not in used:
                s.slot = 'sponsored'
                out.append(s)
                used.add(s.product_id)
            continue
        if pos == config.EXPLORE_SLOT_INDEX:
            j = next((k for k in range(oi + 1, len(organic))
                      if organic[k].product_id not in used and is_new(organic[k])), None)
            if j is not None:
                s = organic.pop(j)
                s.slot = 'explore'
                out.append(s)
                used.add(s.product_id)
                continue
        while oi < len(organic) and organic[oi].product_id in used:
            oi += 1
        if oi >= len(organic):
            break
        out.append(organic[oi])
        used.add(organic[oi].product_id)
        oi += 1
    return out


def rank(cands, ctx, limit, *, meta=None, personalize=True, diversify='full', slots=True,
         extra_exclude=None, exclude_category_ids=None):
    """cands: iterable of (product_id, base_score or None, breakdown, reason). Returns list[Scored]."""
    excluded = set(ctx.exclude_ids) | set(ctx.seen_ids) | set(extra_exclude or ())
    best = {}
    for pid, base, bd, reason in cands:
        if pid in excluded:
            continue
        prev = best.get(pid)
        if prev is None or (base or 0) > (prev[0] or 0):
            best[pid] = (base, bd, reason)
    if not best:
        return []
    if meta is None:
        meta = _meta(best.keys())
    vehicle_ids = set(vehicle_pool(ctx.vehicle_id)) if (personalize and ctx.vehicle_id) else set()
    now = timezone.now()
    items = []
    for pid, (base, bd, reason) in best.items():
        m = meta.get(pid)
        if m is None:
            continue
        if exclude_category_ids and m['category_id'] in exclude_category_ids:
            continue
        breakdown = {}
        if base is None:
            base, pool_bd = weighted({'popularity': m['popularity'], 'quality': m['quality']}, config.W_POOL)
            breakdown.update({f"pool.{k}": v for k, v in pool_bd.items()})
            if reason.endswith('_fallback'):
                base = round(base * config.FALLBACK_FACTOR, 4)
                breakdown['pool.fallback_factor'] = config.FALLBACK_FACTOR
        else:
            breakdown.update({f"base.{k}": v for k, v in (bd or {}).items()})
        total = float(base)
        if personalize:
            p_total, p_bd = _personal(m, ctx, vehicle_ids, now)
            total += p_total
            breakdown.update({f"personal.{k}": v for k, v in p_bd.items()})
        items.append(Scored(pid, round(total, 4), breakdown, reason))
    items.sort(key=lambda s: (-s.score, s.product_id))
    if diversify:
        items = _diversify(items, meta, by_category=(diversify == 'full'))
    if slots:
        return _apply_slots(items, meta, limit)
    return items[:limit]


# ─── Surfaces ─────────────────────────────────────────────────────
def similar_for_product(product_id, page=1, page_size=12):
    stored = ProductRecs.objects.filter(product_id=product_id).values_list('similar', flat=True).first()
    cands = _entries(stored, config.W_SIMILAR, 'similar')
    if not cands:
        cat_id = Product.objects.filter(id=product_id).values_list('category_id', flat=True).first()
        if cat_id:
            cands = [(pid, None, {}, 'similar_fallback') for pid in category_pool(cat_id)]
    ctx = RecContext(exclude_ids={product_id})
    ranked = rank(cands, ctx, limit=max(1, len(cands)), personalize=False, diversify=None, slots=True)
    start = max(0, (page - 1) * page_size)
    return ranked[start:start + page_size], len(ranked) > start + page_size


def ymal_for_product(product_id, ctx, limit=12):
    stored = ProductRecs.objects.filter(product_id=product_id).values_list('complements', flat=True).first()
    cands = _entries(stored, config.W_COMPLEMENT, 'ymal')
    own_cat = Product.objects.filter(id=product_id).values_list('category_id', flat=True).first()
    if len(cands) < limit * 2:
        cands += [(pid, None, {}, 'ymal_fallback') for pid in trending_pool(ctx.region or None)]
    ctx.exclude_ids.add(product_id)
    return rank(cands, ctx, limit, exclude_category_ids={own_cat} if own_cat else None)


def category_picks(category, ctx, limit=24):
    cands = [(pid, None, {}, 'category') for pid in category_pool(category.id)]
    return rank(cands, ctx, limit, diversify='seller')


def top_picks(ctx, limit=12):
    cands = [(pid, None, {}, 'trending') for pid in trending_pool(ctx.region or None)]
    return rank(cands, ctx, limit)


def rank_editorial_shelves(ctx):
    """[(EditorialShelf, shelf_score)] best first. Score = interest affinity + small base_order tiebreak."""
    active_gender = ctx.gender or 'female'
    ranked = []
    for shelf in EditorialShelf.objects.filter(is_active=True).select_related('category'):
        if shelf.audience not in ('all', active_gender):
            continue
        cat_ids = category_ids_with_descendants(shelf.category)
        affinity = max([ctx.cat_affinity.get(c, 0.0) for c in cat_ids] or [0.0])
        score = round(affinity + (1000 - min(shelf.base_order, 1000)) / 10000.0, 4)
        ranked.append((shelf, score))
    ranked.sort(key=lambda t: (-t[1], t[0].base_order, t[0].id))
    return ranked


def editorial_page(shelf_key, page=1, page_size=12):
    shelf = EditorialShelf.objects.filter(key=shelf_key, is_active=True).select_related('category').first()
    if shelf is None:
        return [], False
    cat_ids = category_ids_with_descendants(shelf.category)
    start = max(0, (page - 1) * page_size)
    ids = list(Product.objects.filter(category_id__in=cat_ids, **ACTIVE).order_by(*popularity_order())
               .values_list('id', flat=True)[start:start + page_size + 1])
    return ids[:page_size], len(ids) > page_size


def for_you(ctx, per_shelf=None, even=True, min_items=None):
    """Returns a list of shelf dicts, each with 'items': list[Scored]. Used by the feed AND the admin inspector."""
    per_shelf = per_shelf or config.SHELF_SIZE
    min_items = config.MIN_SHELF_ITEMS if min_items is None else min_items
    plans = []

    anchors, anchor_cats = [], set()
    for pid in ctx.recent_ids:
        info = ctx.product_info.get(pid)
        if not info or info['category_id'] in anchor_cats:
            continue
        anchors.append(info)
        anchor_cats.add(info['category_id'])
        if len(anchors) >= config.MAX_BECAUSE_SHELVES:
            break

    rec_ids = [a['id'] for a in anchors] + ctx.liked_ids[:5] + ctx.purchased_ids[:5]
    recs_map = {pid: (sim, comp) for pid, sim, comp in
                ProductRecs.objects.filter(product_id__in=rec_ids).values_list('product_id', 'similar', 'complements')}

    for a in anchors:
        sim, comp = recs_map.get(a['id'], ([], []))
        cands = _entries(sim, config.W_SIMILAR, 'because_viewed') + \
            _entries(comp, config.W_COMPLEMENT, 'because_viewed', factor=0.8)
        plans.append({'id': f"because_{a['id']}", 'kind': 'because_viewed',
                      'title': f"Because you viewed {a['name'][:40]}",
                      'subtitle': 'Similar items and things that go with it',
                      'category_slug': a['category__slug'] or '', 'cands': cands})

    if ctx.recent_ids:
        plans.append({'id': 'recently_viewed', 'kind': 'recently_viewed', 'title': 'Recently viewed',
                      'subtitle': 'Pick up where you left off', 'category_slug': '', 'fixed': ctx.recent_ids[:12]})

    if ctx.vehicle_id:
        plans.append({'id': 'for_my_vehicle', 'kind': 'for_your_car', 'title': 'Fits your vehicle',
                      'subtitle': 'Parts and accessories that match your saved vehicle', 'category_slug': '',
                      'cands': [(pid, None, {}, 'for_your_car') for pid in vehicle_pool(ctx.vehicle_id)]})

    if ctx.liked_ids:
        cands = []
        for pid in ctx.liked_ids[:5]:
            cands += _entries(recs_map.get(pid, ([], []))[0], config.W_SIMILAR, 'saved_similar')
        plans.append({'id': 'saved_similar', 'kind': 'saved_similar', 'title': 'Similar to items you saved',
                      'subtitle': 'Alternatives to what you liked', 'category_slug': '', 'cands': cands})

    if ctx.purchased_ids:
        cands = []
        for pid in ctx.purchased_ids[:5]:
            cands += _entries(recs_map.get(pid, ([], []))[1], config.W_COMPLEMENT, 'goes_with_purchases')
        plans.append({'id': 'goes_with_purchases', 'kind': 'goes_with_purchases',
                      'title': 'Goes with your recent purchases', 'subtitle': 'Accessories and add-ons',
                      'category_slug': '', 'cands': cands})

    if ctx.top_category_ids:
        top_cat = Category.objects.filter(id=ctx.top_category_ids[0]).values('id', 'name', 'slug').first()
        if top_cat:
            plans.append({'id': f"top_category_{top_cat['id']}", 'kind': 'top_category',
                          'title': f"Picks in {top_cat['name']}", 'subtitle': 'Based on what you browse',
                          'category_slug': top_cat['slug'], 'diversify': 'seller',
                          'cands': [(pid, None, {}, 'top_category') for pid in category_pool(top_cat['id'])]})

    plans.append({'id': 'trending', 'kind': 'trending',
                  'title': f"Trending in {ctx.region}" if ctx.region else 'Trending on SokoniMax',
                  'subtitle': 'Popular right now', 'category_slug': '',
                  'cands': [(pid, None, {}, 'trending') for pid in trending_pool(ctx.region or None)]})

    active_gender = ctx.gender or 'female'
    for shelf, shelf_score in rank_editorial_shelves(ctx):
        plans.append({'id': f"shelf:{shelf.key}", 'kind': 'editorial', 'title': shelf.title,
                      'subtitle': shelf.subtitle, 'category_slug': shelf.category.slug, 'diversify': 'seller',
                      'paginated': True, 'shelf_score': shelf_score,
                      'has_gender_toggle': False, 'gender_active': active_gender,
                      'cands': [(pid, None, {}, 'editorial') for pid in category_pool(shelf.category_id)]})

    plans.append({'id': 'fresh_picks', 'kind': 'fresh', 'title': 'Fresh Picks Across All Categories',
                  'subtitle': 'Just listed on SokoniMax', 'category_slug': '', 'paginated': True,
                  'see_more_url': '/products?sort_by=newest',
                  'cands': [(pid, None, {}, 'fresh') for pid in fresh_pool()]})

    union = set()
    for plan in plans:
        union.update(plan.get('fixed', []))
        union.update(c[0] for c in plan.get('cands', []))
    meta = _meta(union)

    shown, result = set(), []
    for plan in plans:
        if 'fixed' in plan:
            items = [Scored(pid, 0.0, {}, 'recently_viewed') for pid in plan['fixed'] if pid in meta]
        else:
            items = rank(plan['cands'], ctx, per_shelf, meta=meta, diversify=plan.get('diversify', 'full'),
                         extra_exclude=shown)
        if len(items) < min_items:
            continue
        if even and len(items) % 2:
            items = items[:-1]
        if plan['kind'] != 'recently_viewed':
            shown.update(s.product_id for s in items)
        slug = plan.get('category_slug') or ''
        result.append({
            'id': plan['id'], 'kind': plan['kind'], 'type': 'horizontal_shelf', 'title': plan['title'],
            'subtitle': plan.get('subtitle', ''), 'category_slug': slug,
            'see_more_url': plan.get('see_more_url') or (f"/products?category={slug}" if slug else ''),
            'paginated': bool(plan.get('paginated')), 'has_gender_toggle': False,
            'gender_active': plan.get('gender_active', active_gender), 'shelf_score': plan.get('shelf_score'),
            'items': items,
        })
    return result
