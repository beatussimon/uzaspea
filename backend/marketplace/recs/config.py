"""Recommendation system v3 - every tunable number lives here.

IMPORTANT: the KEY ORDER of W_SIMILAR and W_COMPLEMENT defines the order of the component values stored in
ProductRecs. If you add/remove/reorder keys, run `python manage.py build_recs` afterwards.
"""

CACHE_PREFIX = "recs:v3"

# Precompute (stored per product in ProductRecs)
SIMILAR_STORE = 36
COMPLEMENT_STORE = 36
MAX_CANDIDATES_PER_PRODUCT = 600
SIMILAR_MIN_SAME_CATEGORY = 8
SIBLING_CATEGORY_FACTOR = 0.6
COMPLEMENT_CATEGORY_TAKE = 40

# Online pools (Redis, ids only, always with TTL)
POOL_SIZE = 60
POOL_TTL = 900
TREND_TTL = 3600
SPONSORED_TTL = 300
INSPECT_TTL = 300
COLD_FEED_TTL = 300
HEALTH_TTL = 3600

# Shelves
SHELF_SIZE = 16
MIN_SHELF_ITEMS = 4
MAX_BECAUSE_SHELVES = 2

# Diversity and slots
MAX_PER_SELLER = 2
MAX_PER_CATEGORY = 3
SLOT_EVERY = 8
SPONSORED_SLOT_INDEX = 2      # 3rd card of every block of 8
EXPLORE_SLOT_INDEX = 6        # 7th card of every block of 8
SPONSORED_MIN_RELEVANCE = 0.35  # sponsored item must score >= 35% of the best item to be shown
NEW_LISTING_DAYS = 7
EXPLORE_MAX_POPULARITY = 0.2
FALLBACK_FACTOR = 0.5

# Signals
RECENT_MAX = 20
COVIEW_WINDOW = 2
MAX_PAIRS_PER_BEACON = 40
MAX_VIEWS_PER_BEACON = 30
MAX_IMPRESSIONS_PER_SURFACE = 50
DAILY_STATS_KEEP_DAYS = 35
SURFACE_STATS_KEEP_DAYS = 120
COVIEW_KEEP_PER_PRODUCT = 30
COVIEW_MAX_AGE_DAYS = 180

PRICE_BAND_LOG10 = 0.5   # price similarity reaches 0 at ~3.2x price difference

W_SIMILAR = {'text': 0.35, 'price': 0.20, 'brand': 0.15, 'condition': 0.10, 'quality': 0.10, 'popularity': 0.10}
W_COMPLEMENT = {'coview': 0.35, 'copurchase': 0.25, 'category': 0.15, 'popularity': 0.15, 'quality': 0.10}
W_PERSONAL = {'affinity': 0.30, 'vehicle': 0.20, 'region': 0.10, 'freshness': 0.10}
W_POOL = {'popularity': 0.6, 'quality': 0.4}

PAID_STATUSES = (
    'PAID', 'PAID_PRODUCT', 'SELLER_CONFIRMED', 'PREPARING', 'PACKAGING', 'SHIPPED_TO_WAREHOUSE',
    'RECEIVED_AT_WAREHOUSE', 'ASSIGNED_TRANSPORT', 'IN_TRANSIT', 'ARRIVED_AT_REGIONAL_WAREHOUSE',
    'READY_FOR_PICKUP', 'READY_FOR_VEHICLE_HANDOVER', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY',
    'DELIVERED', 'COMPLETED',
)

SURFACES = ('similar', 'ymal', 'foryou', 'cat_shelf', 'cart', 'empty_search')

STOPWORDS = {
    'the', 'and', 'for', 'with', 'new', 'used', 'original', 'genuine', 'quality', 'best', 'sale', 'pcs',
    'set', 'of', 'in', 'to', 'an', 'na', 'ya', 'kwa', 'za', 'la', 'cha', 'mpya', 'bei',
}
