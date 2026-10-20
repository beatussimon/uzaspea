"""HTTP endpoints: public recommendation APIs + superuser Recommendations Inspector."""
import logging
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db.models import Count, F, Max, Q, Sum
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from uzachuo.permissions import IsSuperUser
from marketplace.models import (Product, Like, Order, Vehicle, Category, ProductStats, ProductRecs,
                                RecSurfaceDailyStat, UserRecProfile)
from . import config
from .context import build_context, context_from_request
from .engine import similar_for_product, ymal_for_product, for_you
from .events import ingest
from .queries import hydrate
from .serializers import serialize_cards

logger = logging.getLogger(__name__)


# ─── helpers ──────────────────────────────────────────────────────
def safe_int(raw, default, lo, hi):
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, value))


def cards_for_scored(items, request, personal=True):
    products = hydrate([s.product_id for s in items])
    slots = {s.product_id: s.slot for s in items if s.slot}
    return serialize_cards(products, request, slots=slots, personal=personal)


def cards_for_ids(ids, request, personal=True):
    return serialize_cards(hydrate(ids), request, personal=personal)


def shelves_to_payload(shelves, request):
    all_ids, slots = [], {}
    for shelf in shelves:
        for s in shelf['items']:
            if s.product_id not in slots:
                all_ids.append(s.product_id)
                slots[s.product_id] = s.slot
            elif s.slot:
                slots[s.product_id] = s.slot
    cards = {c['id']: c for c in serialize_cards(hydrate(all_ids), request, slots=slots)}
    out = []
    for shelf in shelves:
        data = {k: v for k, v in shelf.items() if k != 'items'}
        data['products'] = [cards[s.product_id] for s in shelf['items'] if s.product_id in cards]
        out.append(data)
    return out


# ─── public ───────────────────────────────────────────────────────
class RecSimilarView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, product_id):
        page = safe_int(request.query_params.get('page'), 1, 1, 100)
        page_size = safe_int(request.query_params.get('page_size'), 12, 1, 36)
        items, has_more = similar_for_product(product_id, page=page, page_size=page_size)
        return Response({'product_id': product_id, 'page': page, 'has_more': has_more,
                         'products': cards_for_scored(items, request)})


class RecYmalView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, product_id):
        limit = safe_int(request.query_params.get('limit'), 9, 1, 24)
        ctx = context_from_request(request)
        items = ymal_for_product(product_id, ctx, limit)
        return Response({'product_id': product_id, 'title': 'You Might Also Like',
                         'products': cards_for_scored(items, request)})


class RecEventsView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'rec_events'

    def post(self, request):
        try:
            ingest(request.data, request.user)
        except Exception as exc:
            logger.warning("rec events ingest failed: %s", exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── admin inspector ──────────────────────────────────────────────
def _row(scored, product):
    images = list(product.images.all())
    return {
        'id': product.id, 'name': product.name, 'slug': product.slug, 'price': str(product.price),
        'image': images[0].image.url if images and images[0].image else None,
        'category': product.category.name if product.category_id else '',
        'seller': product.seller.username, 'score': scored.score, 'slot': scored.slot,
        'reason': scored.reason, 'breakdown': scored.breakdown,
    }


def inspect_payload(ctx):
    shelves = for_you(ctx, per_shelf=5, even=False, min_items=1)
    ids = []
    for shelf in shelves:
        for s in shelf['items']:
            if s.product_id not in ids:
                ids.append(s.product_id)
    products = {p.id: p for p in hydrate(ids)}
    signal_ids = set(ctx.recent_ids) | set(ctx.liked_ids) | set(ctx.purchased_ids)
    names = dict(Product.objects.filter(id__in=signal_ids).values_list('id', 'name'))
    cat_names = dict(Category.objects.filter(id__in=ctx.top_category_ids).values_list('id', 'name'))
    vehicle = Vehicle.objects.select_related('make', 'model').filter(id=ctx.vehicle_id).first() if ctx.vehicle_id else None

    def named(id_list):
        return [{'id': i, 'name': names.get(i, '(unavailable)')} for i in id_list]

    return {
        'signals': {
            'recent': named(ctx.recent_ids), 'liked': named(ctx.liked_ids), 'purchased': named(ctx.purchased_ids),
            'vehicle_id': ctx.vehicle_id, 'vehicle': str(vehicle) if vehicle else None,
            'region': ctx.region, 'gender': ctx.gender,
            'top_categories': [{'id': c, 'name': cat_names.get(c, str(c)), 'affinity': ctx.cat_affinity.get(c, 0)}
                               for c in ctx.top_category_ids],
        },
        'reasons': [{'id': sh['id'], 'kind': sh['kind'], 'title': sh['title'], 'shelf_score': sh.get('shelf_score'),
                     'items': [_row(s, products[s.product_id]) for s in sh['items'] if s.product_id in products]}
                    for sh in shelves],
        'weights': {'similar': config.W_SIMILAR, 'complement': config.W_COMPLEMENT,
                    'personal': config.W_PERSONAL, 'pool': config.W_POOL},
        'generated_at': timezone.now().isoformat(),
    }


class RecAdminUserListView(APIView):
    permission_classes = [IsSuperUser]
    PAGE_SIZE = 20

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        page = safe_int(request.query_params.get('page'), 1, 1, 100000)
        qs = User.objects.all()
        if q:
            qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q) |
                           Q(first_name__icontains=q) | Q(last_name__icontains=q))
        total = qs.count()
        start = (page - 1) * self.PAGE_SIZE
        users = list(qs.order_by(F('last_login').desc(nulls_last=True), '-id')[start:start + self.PAGE_SIZE])
        ids = [u.id for u in users]
        profiles = {p.user_id: p for p in UserRecProfile.objects.filter(user_id__in=ids)}
        likes = dict(Like.objects.filter(user_id__in=ids).order_by().values('user_id')
                     .annotate(n=Count('id')).values_list('user_id', 'n'))
        orders = dict(Order.objects.filter(user_id__in=ids, status__in=config.PAID_STATUSES).order_by()
                      .values('user_id').annotate(n=Count('id')).values_list('user_id', 'n'))
        results = []
        for u in users:
            prof = profiles.get(u.id)
            results.append({
                'id': u.id, 'username': u.username, 'name': f"{u.first_name} {u.last_name}".strip(),
                'last_login': u.last_login, 'recent_views': len(prof.recent_ids or []) if prof else 0,
                'likes': likes.get(u.id, 0), 'orders': orders.get(u.id, 0),
                'vehicle_id': prof.vehicle_id if prof else None, 'region': prof.region if prof else '',
            })
        return Response({'count': total, 'page': page, 'page_size': self.PAGE_SIZE, 'results': results})


class RecAdminUserInspectView(APIView):
    permission_classes = [IsSuperUser]

    def get(self, request, user_id):
        target = User.objects.filter(id=user_id).first()
        if target is None:
            return Response({'detail': 'User not found'}, status=404)
        key = f"{config.CACHE_PREFIX}:inspect:user:{user_id}"
        if request.query_params.get('refresh') != '1':
            cached = cache.get(key)
            if cached is not None:
                return Response({**cached, 'cached': True})
        payload = inspect_payload(build_context(user=target))
        payload['user'] = {'id': target.id, 'username': target.username,
                           'name': f"{target.first_name} {target.last_name}".strip()}
        cache.set(key, payload, config.INSPECT_TTL)
        return Response({**payload, 'cached': False})


class RecAdminProductInspectView(APIView):
    permission_classes = [IsSuperUser]

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        product = Product.objects.filter(id=int(q)).first() if q.isdigit() else None
        if product is None and q:
            product = Product.objects.filter(slug=q).first()
        if product is None:
            return Response({'detail': 'Product not found'}, status=404)
        similar, _ = similar_for_product(product.id, page=1, page_size=5)
        ymal = ymal_for_product(product.id, build_context(), limit=5)
        products = {p.id: p for p in hydrate([s.product_id for s in similar] + [s.product_id for s in ymal])}
        return Response({
            'product': {'id': product.id, 'name': product.name, 'slug': product.slug, 'price': str(product.price),
                        'category': product.category.name if product.category_id else ''},
            'stats': ProductStats.objects.filter(product_id=product.id).values().first(),
            'recs_computed_at': ProductRecs.objects.filter(product_id=product.id).values_list('computed_at', flat=True).first(),
            'reasons': [
                {'id': 'similar', 'kind': 'similar', 'title': 'Similar items (substitutes)', 'shelf_score': None,
                 'items': [_row(s, products[s.product_id]) for s in similar if s.product_id in products]},
                {'id': 'ymal', 'kind': 'ymal', 'title': 'You might also like (complements, guest view)',
                 'shelf_score': None,
                 'items': [_row(s, products[s.product_id]) for s in ymal if s.product_id in products]},
            ],
        })


class RecAdminSimulateView(APIView):
    permission_classes = [IsSuperUser]

    def post(self, request):
        body = request.data if isinstance(request.data, dict) else {}
        raw_vehicle = str(body.get('vehicle_id') or '')
        ctx = build_context(user=None, recent_ids=body.get('recent_ids'),
                            vehicle_id=int(raw_vehicle) if raw_vehicle.isdigit() else None,
                            region=str(body.get('region') or ''), gender=str(body.get('gender') or ''))
        return Response(inspect_payload(ctx))


class RecAdminHealthView(APIView):
    permission_classes = [IsSuperUser]

    def get(self, request):
        key = f"{config.CACHE_PREFIX}:health"
        if request.query_params.get('refresh') != '1':
            cached = cache.get(key)
            if cached is not None:
                return Response(cached)
        today = timezone.localdate()
        surfaces = []
        for row in (RecSurfaceDailyStat.objects.filter(date__gte=today - timedelta(days=6)).order_by()
                    .values('surface').annotate(impressions=Sum('impressions'), clicks=Sum('clicks')).order_by('surface')):
            ctr = (row['clicks'] / row['impressions']) if row['impressions'] else 0.0
            surfaces.append({**row, 'ctr': round(ctr * 100, 2)})
        active_ids = set(Product.objects.filter(is_available=True, is_draft=False, stock__gt=0).values_list('id', flat=True))
        covered = set()
        for sim, comp in ProductRecs.objects.values_list('similar', 'complements').iterator(chunk_size=200):
            for e in (sim or []) + (comp or []):
                covered.add(e[0])
        payload = {
            'window_days': 7, 'surfaces': surfaces, 'active_products': len(active_ids),
            'products_with_stats': ProductStats.objects.count(), 'products_with_recs': ProductRecs.objects.count(),
            'catalog_coverage_pct': round(100.0 * len(active_ids & covered) / len(active_ids), 1) if active_ids else 0.0,
            'last_recs_build': ProductRecs.objects.aggregate(m=Max('computed_at'))['m'],
            'last_stats_refresh': ProductStats.objects.aggregate(m=Max('updated_at'))['m'],
            'users_with_rec_profile': UserRecProfile.objects.count(),
            'generated_at': timezone.now(),
        }
        cache.set(key, payload, config.HEALTH_TTL)
        return Response(payload)
