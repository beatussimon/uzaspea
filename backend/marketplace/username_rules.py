"""
Core Rules Engine for Username Validation, Reservation, and Protection.
Defines static baseline sets (system routes, staff/security terms, tech keywords,
popular global/Tanzanian brands, and dictionary/short words) alongside canonical
normalization and leetspeak detection.
"""
import re
from typing import Tuple, Dict, Any, Optional

# ==============================================================================
# 1. STATIC BASELINE SETS
# ==============================================================================

# Tier 1: System Routes & Protocols (shadows React Router, Django endpoints, or web protocols)
STATIC_SYSTEM_ROUTES = frozenset([
    # React Router top-level paths from App.tsx
    'cart', 'checkout', 'products', 'browse_products', 'browse', 'product',
    'dashboard', 'upgrade', 'shipments', 'staff-admin', 'staff', 'inspections',
    'inspector', 'verify', 'help', 'blog', 'login', 'register', 'forgot-password',
    'reset-password', 'terms', 'privacy', 'seller-contract', 'teams',
    'teams-dashboard', 'orders', 'messages', 'settings',
    
    # Backend & Server endpoints from urls.py
    'admin', 'api', 'sitemap', 'sitemap.xml', 'robots', 'robots.txt',
    'favicon', 'favicon.ico', 'media', 'static', 'staticfiles', 'accounts',
    'health', 'ws', 'wss', 'webhook', 'webhooks', 'cdn', 'assets', 'public',
    'django', 'graphql', 'auth', 'oauth', 'token', 'refresh', 'logout',
    'search', 'feed', 'rss', 'xml', 'json', 'download', 'upload',
])

# Tier 2: Staff, Platform Authority & Anti-Phishing (Impersonation targets)
STATIC_STAFF_KEYWORDS = frozenset([
    'sokonimax', 'uzaspea', 'staff', 'admin', 'administrator', 'super',
    'superuser', 'root', 'support', 'helpdesk', 'service', 'system', 'security',
    'official', 'moderator', 'mod', 'team', 'billing', 'finance', 'payment',
    'payout', 'escrow', 'audit', 'verification', 'verified', 'trust', 'safety',
    'compliance', 'legal', 'inspector', 'inspection', 'warehouse', 'driver',
    'courier', 'manager', 'bot', 'robot', 'automated', 'notifications',
    'helpcenter', 'contact', 'feedback', 'press', 'investor', 'careers',
    'sokonimax-support', 'sokonimax_support', 'uzaspea-support', 'uzaspea_support',
    'sokonimax-official', 'sokonimax_official', 'uzaspea-official', 'uzaspea_official',
])

# Tier 3: RFC 2142 & Standards Role Accounts
STATIC_RFC_ROLES = frozenset([
    'abuse', 'postmaster', 'noc', 'security', 'hostmaster', 'webmaster',
    'info', 'marketing', 'sales', 'mailer-daemon', 'usenet', 'news',
    'uucp', 'ftp', 'www',
])

# Tier 4: Technical & Serialization Keywords (could break JSON, URLs, or script filters)
STATIC_TECHNICAL_KEYWORDS = frozenset([
    'null', 'undefined', 'none', 'nil', 'void', 'nan', 'true', 'false',
    '0', 'me', 'self', 'this', 'window', 'document', 'anonymous', 'anyone',
    'everyone', 'all', 'test', 'testing', 'dev', 'developer', 'development',
    'staging', 'stage', 'prod', 'production', 'local', 'localhost', 'internal',
    'example', 'config', 'configuration', 'env', 'environment',
])

# Tier 5: High-Value Dictionary & Vanity Words (e.g. "one", single/short words, generic commerce)
STATIC_HIGH_VALUE_WORDS = frozenset([
    'one', 'two', 'three', 'first', 'second', 'third', 'zero',
    'top', 'best', 'pro', 'vip', 'premium', 'deal', 'deals', 'sale', 'sales',
    'store', 'shop', 'market', 'marketplace', 'mall', 'supermarket', 'bazaar',
    'hub', 'outlet', 'mart', 'direct', 'online', 'express', 'global',
])

# Prominent Brands (Baseline fallbacks - DB has full dynamic management)
BASELINE_POPULAR_BRANDS = frozenset([
    # Automotive Makes
    'toyota', 'nissan', 'honda', 'mitsubishi', 'mazda', 'subaru', 'suzuki',
    'isuzu', 'mercedes', 'benz', 'bmw', 'audi', 'volkswagen', 'vw', 'ford',
    'hyundai', 'kia', 'landrover', 'rangerover', 'peugeot', 'renault', 'volvo',
    'scania', 'man', 'tata', 'sinotruk', 'howo', 'fuso', 'yamaha', 'bajaj', 'tvs',
    # Auto Parts & Fluids
    'bosch', 'denso', 'ngk', 'brembo', 'aisin', 'kyb', 'valeo', 'mobil',
    'total', 'totalenergies', 'shell', 'castrol', 'bridgestone', 'michelin',
    'pirelli', 'goodyear', 'dunlop', 'yokohama',
    # Tanzanian Telecom, Banking & Conglomerates
    'mpesa', 'm-pesa', 'vodacom', 'airtel', 'airtelmoney', 'tigo', 'tigopesa',
    'halotel', 'halopesa', 'ttcl', 'crdb', 'nmb', 'stanbic', 'nbc', 'kcb',
    'equity', 'selcom', 'azampay', 'azam', 'bakhresa', 'metl', 'mo',
    # Global Tech & Commerce
    'apple', 'google', 'microsoft', 'amazon', 'meta', 'facebook', 'whatsapp',
    'instagram', 'tiktok', 'twitter', 'samsung', 'sony', 'lg', 'huawei',
    'xiaomi', 'paypal', 'stripe', 'visa', 'mastercard',
])

# Leetspeak translation table for anti-spoofing
LEET_MAPPING = {
    '0': 'o',
    '1': 'i',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '7': 't',
    '8': 'b',
    '@': 'a',
    '$': 's',
}


# ==============================================================================
# 2. NORMALIZATION & LEETSPEAK LOGIC
# ==============================================================================

def canonicalize_username(raw: str) -> str:
    """
    Returns lowercased string with leading and trailing whitespace stripped.
    """
    if not raw:
        return ''
    return str(raw).strip().lower()


def strip_delimiters(username: str) -> str:
    """
    Strips underscores, hyphens, and dots to check the root word.
    e.g. '_admin_' -> 'admin', 't-o-y-o-t-a' -> 'toyota'
    """
    return re.sub(r'[\_\.\-]', '', username)


def leetspeak_normalize(username: str) -> str:
    """
    Translates common leetspeak substitutions to standard Latin characters.
    e.g. 'adm1n' -> 'admin', 't0y0ta' -> 'toyota', 's0k0nimax' -> 'sokonimax'
    """
    result = []
    for char in username:
        result.append(LEET_MAPPING.get(char, char))
    return ''.join(result)


def is_leetspeak_spoof_of(candidate: str, target: str) -> bool:
    """
    Checks if candidate is a leetspeak or delimiter spoof of target.
    """
    c_clean = strip_delimiters(candidate.lower())
    t_clean = strip_delimiters(target.lower())
    if c_clean == t_clean:
        return True
    c_leet = leetspeak_normalize(c_clean)
    return c_leet == t_clean


# ==============================================================================
# 3. FORMAT & SYNTAX VALIDATION
# ==============================================================================

USERNAME_REGEX = re.compile(r'^[a-z0-9](?:[a-z0-9_]*[a-z0-9])?$')

def validate_username_format(username: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Validates structural formatting rules:
    - Length: 3 to 30 characters
    - Characters: lowercase letters, numbers, single underscores
    - No leading or trailing underscores
    - No consecutive underscores ('__')
    - Must contain at least one letter (prevents pure numeric IDs/phones)
    
    Returns: (is_valid, error_message, error_code)
    """
    u = canonicalize_username(username)
    
    if not u:
        return False, "Username is required.", "required"
    
    if len(u) < 3:
        return False, "Username must be at least 3 characters long.", "too_short"
    
    if len(u) > 30:
        return False, "Username cannot exceed 30 characters.", "too_long"
    
    if not USERNAME_REGEX.match(u):
        if u.startswith('_') or u.endswith('_'):
            return False, "Username cannot start or end with an underscore.", "invalid_edges"
        return False, "Username may only contain lowercase letters, numbers, and single underscores.", "invalid_characters"
    
    if '__' in u:
        return False, "Username cannot contain consecutive underscores.", "consecutive_underscores"
    
    # Must contain at least one alphabetical letter
    if not re.search(r'[a-z]', u):
        return False, "Username cannot be numbers only. It must contain at least one letter.", "numbers_only"
        
    return True, None, None


# ==============================================================================
# 4. COMPREHENSIVE AVAILABILITY VALIDATION
# ==============================================================================

def validate_username_availability(
    raw_username: str, 
    requesting_user: Optional[Any] = None,
    check_db: bool = True
) -> Tuple[bool, Optional[str], Optional[str], Dict[str, Any]]:
    """
    Complete multi-tier validation:
    1. Format check (length, regex, letters requirement)
    2. Static system routes check
    3. Static staff & authority check (including leetspeak spoofs)
    4. Static RFC & technical keyword check
    5. Static high-value dictionary word check
    6. Static baseline popular brand check
    7. Dynamic DB check against ReservedUsername table (with override support)
    8. Case-insensitive database collision check with auth_user

    Returns:
        (is_available: bool, error_message: Optional[str], code: Optional[str], metadata: Dict)
    """
    username = canonicalize_username(raw_username)
    
    # 1. Format check
    fmt_ok, fmt_err, fmt_code = validate_username_format(username)
    if not fmt_ok:
        return False, fmt_err, fmt_code, {'tier': 'format', 'input': username}

    # Root word without delimiters for containment checks
    root_word = strip_delimiters(username)
    leet_word = leetspeak_normalize(root_word)

    # Generic uniform message for all reserved categories to avoid exposing internal classifications or premium tiers
    RESERVED_UNAVAILABLE_MSG = "This username is unavailable."

    # 2. Static System Routes check
    if username in STATIC_SYSTEM_ROUTES or root_word in STATIC_SYSTEM_ROUTES:
        return (
            False,
            RESERVED_UNAVAILABLE_MSG,
            "reserved_system_route",
            {'tier': 'system', 'matched': username}
        )

    # 3. Static Staff & Authority check (exact + leetspeak spoofs)
    for staff_word in STATIC_STAFF_KEYWORDS:
        if username == staff_word or root_word == staff_word or leet_word == strip_delimiters(staff_word):
            return (
                False,
                RESERVED_UNAVAILABLE_MSG,
                "reserved_staff_authority",
                {'tier': 'staff_official', 'matched': staff_word}
            )

    # 4. Static RFC & Technical Keywords
    if username in STATIC_RFC_ROLES or root_word in STATIC_RFC_ROLES:
        return (
            False,
            RESERVED_UNAVAILABLE_MSG,
            "reserved_rfc_role",
            {'tier': 'rfc_role', 'matched': username}
        )

    if username in STATIC_TECHNICAL_KEYWORDS or root_word in STATIC_TECHNICAL_KEYWORDS:
        return (
            False,
            RESERVED_UNAVAILABLE_MSG,
            "reserved_technical_keyword",
            {'tier': 'technical', 'matched': username}
        )

    # 5. Static High-Value / Dictionary Words (e.g. "one", "store")
    if username in STATIC_HIGH_VALUE_WORDS or root_word in STATIC_HIGH_VALUE_WORDS:
        return (
            False,
            RESERVED_UNAVAILABLE_MSG,
            "reserved_high_value",
            {'tier': 'vip_premium', 'matched': username}
        )

    # 6. Static Baseline Brands
    if username in BASELINE_POPULAR_BRANDS or root_word in BASELINE_POPULAR_BRANDS:
        return (
            False,
            RESERVED_UNAVAILABLE_MSG,
            "reserved_brand_trademark",
            {'tier': 'brand_trademark', 'matched': username}
        )

    # If DB checks are bypassed (e.g. in standalone tests or migrations), return early
    if not check_db:
        return True, None, None, {'tier': 'none', 'input': username}

    # 7. Dynamic DB Check in ReservedUsername
    try:
        from marketplace.models import ReservedUsername
        # Check active reserved records matching canonical or stripped username
        reserved_entry = (
            ReservedUsername.objects.filter(is_active=True)
            .filter(username__in=[username, root_word, leet_word])
            .first()
        )
        if reserved_entry:
            # Check if this handle was specifically reserved for the requesting user
            if requesting_user and requesting_user.is_authenticated:
                if reserved_entry.reserved_for_id == requesting_user.id:
                    # User is the authorized holder of this reserved handle!
                    return True, None, None, {
                        'tier': 'db_reserved_authorized',
                        'assigned_to': requesting_user.id
                    }

            return (
                False,
                RESERVED_UNAVAILABLE_MSG,
                f"reserved_db_{reserved_entry.category}",
                {
                    'tier': reserved_entry.category,
                    'reason': reserved_entry.reason,
                    'db_id': reserved_entry.id
                }
            )
    except Exception:
        # Table might not exist yet during migrations, ignore safely
        pass

    # 8. Database Collision Check in auth_user (case-insensitive)
    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        existing_user = User.objects.filter(username__iexact=username).first()
        if existing_user:
            # If the user is checking their own username during an update
            if requesting_user and requesting_user.is_authenticated and existing_user.id == requesting_user.id:
                return True, None, None, {'tier': 'current_user'}
            
            return (
                False,
                "This username is already taken. Please choose another.",
                "already_exists",
                {'tier': 'auth_user_collision', 'existing_id': existing_user.id}
            )
    except Exception:
        pass

    return True, None, None, {'tier': 'available', 'input': username}
