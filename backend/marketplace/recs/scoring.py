"""Pure scoring helpers (no database access)."""
import math
import re

from . import config

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(*parts):
    out = set()
    for part in parts:
        if not part:
            continue
        for tok in _TOKEN_RE.findall(str(part).lower()):
            if len(tok) >= 2 and tok not in config.STOPWORDS:
                out.add(tok)
    return out


def spec_tokens(specs):
    if not isinstance(specs, dict):
        return set()
    values = [v for v in specs.values() if isinstance(v, (str, int, float)) and len(str(v)) <= 30]
    return tokenize(*values)


def jaccard(a, b):
    if not a or not b:
        return 0.0
    inter = len(a & b)
    return inter / float(len(a | b)) if inter else 0.0


def price_sim(p, q):
    try:
        p, q = float(p), float(q)
    except (TypeError, ValueError):
        return 0.0
    if p <= 0 or q <= 0:
        return 0.0
    return max(0.0, 1.0 - abs(math.log10(p / q)) / config.PRICE_BAND_LOG10)


def raw_popularity(views_7d, likes, orders_30d):
    return math.log1p(4 * (orders_30d or 0) + 2 * (likes or 0) + (views_7d or 0))


def quality_score(inspection_pass, seller_verified, rating_avg, rating_count):
    rating_part = (float(rating_avg or 0) / 5.0) * min(1.0, (rating_count or 0) / 3.0)
    value = 0.4 * (1.0 if inspection_pass else 0.0) + 0.3 * (1.0 if seller_verified else 0.0) + 0.3 * rating_part
    return round(value, 4)


def weighted(components, weights):
    """Returns (total, breakdown) where breakdown[key] = weight * value."""
    breakdown, total = {}, 0.0
    for key, weight in weights.items():
        part = weight * float(components.get(key, 0.0) or 0.0)
        breakdown[key] = round(part, 4)
        total += part
    return round(total, 4), breakdown
