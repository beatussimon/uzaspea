"""Ingest one batched client beacon with at most 3 SQL upserts + 1 profile update."""
from collections import Counter

from django.db import connection, transaction
from django.utils import timezone

from marketplace.models import Product, Vehicle, ProductDailyStat, ProductCoView, RecSurfaceDailyStat, UserRecProfile
from . import config


def _upsert_increment(model, conflict_cols, inc_cols, set_cols, rows):
    """INSERT ... ON CONFLICT DO UPDATE (works on Postgres and SQLite). Identifiers come from code, never input."""
    if not rows:
        return
    qn = connection.ops.quote_name
    table = qn(model._meta.db_table)
    cols = list(conflict_cols) + list(inc_cols) + list(set_cols)
    one = '(' + ', '.join(['%s'] * len(cols)) + ')'
    updates = [f"{qn(c)} = {table}.{qn(c)} + EXCLUDED.{qn(c)}" for c in inc_cols]
    updates += [f"{qn(c)} = EXCLUDED.{qn(c)}" for c in set_cols]
    sql = (f"INSERT INTO {table} ({', '.join(qn(c) for c in cols)}) VALUES {', '.join([one] * len(rows))} "
           f"ON CONFLICT ({', '.join(qn(c) for c in conflict_cols)}) DO UPDATE SET {', '.join(updates)}")
    params = [value for row in rows for value in row]
    with connection.cursor() as cursor:
        cursor.execute(sql, params)


def _clean_ids(raw, cap):
    out = []
    if not isinstance(raw, list):
        return out
    for item in raw[:cap * 2]:
        if isinstance(item, bool):
            continue
        if isinstance(item, int) and item > 0:
            out.append(item)
        elif isinstance(item, str) and item.isdigit() and int(item) > 0:
            out.append(int(item))
        if len(out) >= cap:
            break
    return out


def ingest(payload, user=None):
    if not isinstance(payload, dict):
        return
    today = timezone.localdate()
    date_param = today.isoformat() if connection.vendor == 'sqlite' else today

    views = _clean_ids(payload.get('views'), config.MAX_VIEWS_PER_BEACON)
    clicks = []
    for c in payload.get('clicks') or []:
        if isinstance(c, dict) and c.get('s') in config.SURFACES:
            pid = _clean_ids([c.get('p')], 1)
            if pid:
                clicks.append((c['s'], pid[0]))
        if len(clicks) >= 30:
            break
    impressions = {}
    raw_imp = payload.get('impressions')
    if isinstance(raw_imp, dict):
        for surface, n in raw_imp.items():
            if surface in config.SURFACES and isinstance(n, int) and not isinstance(n, bool) and n > 0:
                impressions[surface] = min(n, config.MAX_IMPRESSIONS_PER_SURFACE)
    raw_vehicle = payload.get('vehicle_id')
    vehicle_id = raw_vehicle if (isinstance(raw_vehicle, int) and not isinstance(raw_vehicle, bool) and raw_vehicle > 0) else None
    if vehicle_id and not Vehicle.objects.filter(id=vehicle_id).exists():
        vehicle_id = None
    region = payload.get('region') if isinstance(payload.get('region'), str) else ''
    region = region.strip()[:64]

    all_ids = set(views) | {p for _, p in clicks}
    valid = set(Product.objects.filter(id__in=all_ids).values_list('id', flat=True)) if all_ids else set()
    views = [v for v in views if v in valid]
    clicks = [(s, p) for s, p in clicks if p in valid]

    view_n = Counter(views)
    click_n = Counter(p for _, p in clicks)
    daily_rows = [(pid, date_param, view_n.get(pid, 0), click_n.get(pid, 0))
                  for pid in sorted(set(view_n) | set(click_n))]

    seq = [v for i, v in enumerate(views) if i == 0 or v != views[i - 1]]
    pairs = Counter()
    for i in range(len(seq)):
        for j in range(i + 1, min(i + 1 + config.COVIEW_WINDOW, len(seq))):
            a, b = seq[i], seq[j]
            if a != b:
                pairs[(a, b)] += 1
                pairs[(b, a)] += 1
    pair_rows = [(a, b, n, date_param) for (a, b), n in sorted(pairs.items())[:config.MAX_PAIRS_PER_BEACON]]

    surface_clicks = Counter(s for s, _ in clicks)
    surface_rows = [(date_param, s, impressions.get(s, 0), surface_clicks.get(s, 0))
                    for s in sorted(set(impressions) | set(surface_clicks))]

    with transaction.atomic():
        _upsert_increment(ProductDailyStat, ['product_id', 'date'], ['views', 'rec_clicks'], [], daily_rows)
        _upsert_increment(ProductCoView, ['product_a_id', 'product_b_id'], ['hits'], ['last_seen'], pair_rows)
        _upsert_increment(RecSurfaceDailyStat, ['date', 'surface'], ['impressions', 'clicks'], [], surface_rows)
        if user is not None and getattr(user, 'is_authenticated', False) and (views or vehicle_id or region):
            prof, _ = UserRecProfile.objects.get_or_create(user=user)
            merged = []
            for pid in reversed(views):
                if pid not in merged:
                    merged.append(pid)
            for pid in prof.recent_ids or []:
                if isinstance(pid, int) and pid not in merged:
                    merged.append(pid)
            prof.recent_ids = merged[:config.RECENT_MAX]
            if vehicle_id:
                prof.vehicle_id = vehicle_id
            if region:
                prof.region = region
            prof.save()
