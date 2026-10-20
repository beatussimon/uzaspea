"""Builds the per-request recommendation context (signals) for a visitor or for the admin inspector."""
from collections import Counter
from dataclasses import dataclass, field

from marketplace.models import Product, Like, OrderItem, UserRecProfile
from . import config


@dataclass
class RecContext:
    user: object = None
    recent_ids: list = field(default_factory=list)      # most recent first
    liked_ids: list = field(default_factory=list)
    purchased_ids: list = field(default_factory=list)
    cart_ids: set = field(default_factory=set)
    exclude_ids: set = field(default_factory=set)
    seen_ids: set = field(default_factory=set)          # never recommended again (recent + purchased + cart)
    vehicle_id: int = None
    region: str = ''
    gender: str = ''
    cat_affinity: dict = field(default_factory=dict)    # category_id -> 0..1
    top_category_ids: list = field(default_factory=list)
    product_info: dict = field(default_factory=dict)    # product_id -> row (name, category ids/slugs)

    @property
    def has_signals(self):
        return bool(self.recent_ids or self.liked_ids or self.purchased_ids or self.vehicle_id)


def parse_id_list(raw, cap):
    out = []
    if raw is None:
        return out
    items = raw if isinstance(raw, (list, tuple, set)) else str(raw).split(',')
    for item in items:
        text = str(item).strip()
        if text.isdigit():
            value = int(text)
            if value > 0 and value not in out:
                out.append(value)
        if len(out) >= cap:
            break
    return out


def build_context(user=None, recent_ids=None, vehicle_id=None, region='', gender='',
                  exclude_ids=None, cart_ids=None, use_stored_profile=True):
    ctx = RecContext()
    if user is not None and getattr(user, 'is_authenticated', False):
        ctx.user = user
    ctx.recent_ids = parse_id_list(recent_ids, config.RECENT_MAX)
    ctx.vehicle_id = vehicle_id if isinstance(vehicle_id, int) and vehicle_id > 0 else None
    ctx.region = (region or '').strip()[:64]
    ctx.exclude_ids = set(parse_id_list(exclude_ids, 200))
    ctx.cart_ids = set(parse_id_list(cart_ids, 50))
    if gender in ('female', 'male'):
        ctx.gender = gender

    if ctx.user is not None:
        if use_stored_profile:
            prof = UserRecProfile.objects.filter(user=ctx.user).first()
            if prof:
                for pid in prof.recent_ids or []:
                    if isinstance(pid, int) and pid not in ctx.recent_ids:
                        ctx.recent_ids.append(pid)
                ctx.recent_ids = ctx.recent_ids[:config.RECENT_MAX]
                ctx.vehicle_id = ctx.vehicle_id or prof.vehicle_id
                ctx.region = ctx.region or (prof.region or '')
        ctx.liked_ids = list(Like.objects.filter(user=ctx.user).order_by('-created_at')
                             .values_list('product_id', flat=True)[:20])
        purchased = (OrderItem.objects.filter(order__user=ctx.user, order__status__in=config.PAID_STATUSES)
                     .order_by('-order__order_date').values_list('product_id', flat=True)[:40])
        ctx.purchased_ids = list(dict.fromkeys(purchased))[:20]
        if not ctx.gender:
            profile_gender = getattr(getattr(ctx.user, 'profile', None), 'gender', '')
            if profile_gender in ('female', 'male'):
                ctx.gender = profile_gender

    ctx.seen_ids = set(ctx.recent_ids) | set(ctx.purchased_ids) | set(ctx.cart_ids)
    _compute_affinity(ctx)
    if not ctx.gender:
        ctx.gender = _infer_gender(ctx)
    return ctx


def _compute_affinity(ctx):
    ids = set(ctx.recent_ids) | set(ctx.liked_ids) | set(ctx.purchased_ids)
    if not ids:
        return
    rows = Product.objects.filter(id__in=ids).values(
        'id', 'name', 'category_id', 'category__parent_id', 'category__slug', 'category__parent__slug', 'category__name')
    ctx.product_info = {r['id']: r for r in rows}
    weights = Counter()

    def add(pid, w):
        row = ctx.product_info.get(pid)
        if not row:
            return
        weights[row['category_id']] += w
        if row['category__parent_id']:
            weights[row['category__parent_id']] += w * 0.5

    for rank_index, pid in enumerate(ctx.recent_ids):
        add(pid, 1.0 / (1.0 + 0.15 * rank_index))
    for pid in ctx.liked_ids:
        add(pid, 1.5)
    for pid in ctx.purchased_ids:
        add(pid, 1.0)
    if weights:
        top = max(weights.values())
        ctx.cat_affinity = {cid: round(w / top, 4) for cid, w in weights.items()}
        ctx.top_category_ids = [cid for cid, _ in weights.most_common(5)]


def _infer_gender(ctx):
    female = male = 0
    for row in ctx.product_info.values():
        slugs = f"{row.get('category__slug') or ''} {row.get('category__parent__slug') or ''}".lower()
        if 'women' in slugs or 'ladies' in slugs:
            female += 1
        elif 'men' in slugs:
            male += 1
    if female >= 2 and female > male:
        return 'female'
    if male >= 2 and male > female:
        return 'male'
    return ''


def context_from_request(request):
    qp = request.query_params
    raw_vehicle = qp.get('vehicle_id') or ''
    return build_context(
        user=request.user,
        recent_ids=qp.get('recent_ids'),
        vehicle_id=int(raw_vehicle) if raw_vehicle.isdigit() else None,
        region=qp.get('region') or '',
        gender=qp.get('gender') or '',
        exclude_ids=qp.get('exclude'),
        cart_ids=qp.get('cart_ids'),
    )
