import os
import re
import logging
import ipaddress
from django.conf import settings
from django.core.cache import cache
from uzachuo.net_utils import get_client_ip

logger = logging.getLogger(__name__)

# Curated country choices list with flags & ISO-3166-1 alpha-2 codes
# Grouped: East African Community (EAC), Southern African Development Community (SADC),
# Rest of Africa, and key global trade / partner hubs.
COUNTRY_CHOICES = [
    # East African Community (EAC)
    ('TZ', '🇹🇿 Tanzania (United Republic of)'),
    ('KE', '🇰🇪 Kenya'),
    ('UG', '🇺🇬 Uganda'),
    ('RW', '🇷🇼 Rwanda'),
    ('BI', '🇧🇮 Burundi'),
    ('CD', '🇨🇩 DR Congo'),
    ('SS', '🇸🇸 South Sudan'),
    ('SO', '🇸🇴 Somalia'),

    # Southern Africa (SADC)
    ('ZM', '🇿🇲 Zambia'),
    ('MW', '🇲🇼 Malawi'),
    ('MZ', '🇲🇿 Mozambique'),
    ('ZW', '🇿🇼 Zimbabwe'),
    ('BW', '🇧🇼 Botswana'),
    ('NA', '🇳🇦 Namibia'),
    ('ZA', '🇿🇦 South Africa'),
    ('AO', '🇦🇴 Angola'),
    ('LS', '🇱🇸 Lesotho'),
    ('SZ', '🇸🇿 Eswatini'),
    ('MG', '🇲🇬 Madagascar'),
    ('MU', '🇲🇺 Mauritius'),
    ('SC', '🇸🇨 Seychelles'),
    ('KM', '🇰🇲 Comoros'),

    # Rest of Africa
    ('NG', '🇳🇬 Nigeria'),
    ('GH', '🇬🇭 Ghana'),
    ('ET', '🇪🇹 Ethiopia'),
    ('EG', '🇪🇬 Egypt'),
    ('MA', '🇲🇦 Morocco'),
    ('DZ', '🇩🇿 Algeria'),
    ('TN', '🇹🇳 Tunisia'),
    ('SN', '🇸🇳 Senegal'),
    ('CI', '🇨🇮 Côte d\'Ivoire'),
    ('CM', '🇨🇲 Cameroon'),
    ('SD', '🇸🇩 Sudan'),
    ('GA', '🇬🇦 Gabon'),
    ('CG', '🇨🇬 Congo (Republic)'),

    # Key Global Trade & Diaspora Hubs
    ('AE', '🇦🇪 United Arab Emirates (UAE / Dubai)'),
    ('CN', '🇨🇳 China'),
    ('IN', '🇮🇳 India'),
    ('TR', '🇹🇷 Turkey'),
    ('GB', '🇬🇧 United Kingdom'),
    ('US', '🇺🇸 United States'),
    ('CA', '🇨🇦 Canada'),
    ('DE', '🇩🇪 Germany'),
    ('FR', '🇫🇷 France'),
    ('IT', '🇮🇹 Italy'),
    ('NL', '🇳🇱 Netherlands'),
    ('JP', '🇯🇵 Japan'),
    ('AU', '🇦🇺 Australia'),
    ('SA', '🇸🇦 Saudi Arabia'),
    ('QA', '🇶🇦 Qatar'),
    ('OM', '🇴🇲 Oman'),
    ('CH', '🇨🇭 Switzerland'),
    ('SE', '🇸🇪 Sweden'),
    ('NO', '🇳🇴 Norway'),
    ('DK', '🇩🇰 Denmark'),
]

COUNTRY_NAMES = {code: name for code, name in COUNTRY_CHOICES}

INTERNAL_EXEMPT_NETWORKS = [
    ipaddress.ip_network('127.0.0.0/8'),
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('::1/128'),
    ipaddress.ip_network('fc00::/7'),
    ipaddress.ip_network('fe80::/10'),
]

EXEMPT_PUBLIC_IPS = {"3.6.193.212", "13.235.198.184"}
_extra_bypass = os.environ.get("GEOFENCE_BYPASS_IPS", "")
if _extra_bypass:
    for _ip in _extra_bypass.split(","):
        if _ip.strip():
            EXEMPT_PUBLIC_IPS.add(_ip.strip())

_mmdb_reader = None
_mmdb_checked = False


def get_mmdb_reader():
    """Lazy process-level maxminddb reader on settings.GEOIP_MMDB_PATH."""
    global _mmdb_reader, _mmdb_checked
    if not _mmdb_checked:
        _mmdb_checked = True
        try:
            import maxminddb
            mmdb_path = getattr(settings, 'GEOIP_MMDB_PATH', None)
            if mmdb_path and os.path.exists(mmdb_path):
                _mmdb_reader = maxminddb.open_database(str(mmdb_path))
                logger.info("GeoIP MMDB loaded successfully from %s", mmdb_path)
        except Exception as e:
            logger.warning("Could not open GeoIP mmdb: %s", e)
    return _mmdb_reader


def resolve_country_code(ip_str: str, cf_header: str = "") -> tuple:
    """
    Resolves 2-letter uppercase ISO country code.
    Returns (iso_code, source), e.g. ('TZ', 'cloudflare') or ('TZ', 'mmdb') or ('', 'unknown').
    """
    if cf_header:
        code = str(cf_header).strip().upper()
        if len(code) == 2 and code.isalpha() and code != 'XX':
            return (code, 'cloudflare')

    reader = get_mmdb_reader()
    if reader and ip_str:
        try:
            clean_ip = ip_str.split('%')[0].strip()
            res = reader.get(clean_ip)
            if res and isinstance(res, dict):
                code = res.get('country', {}).get('iso_code') or res.get('registered_country', {}).get('iso_code')
                if code and len(code) == 2:
                    return (str(code).upper(), 'mmdb')
        except Exception as e:
            logger.debug("GeoIP reader lookup failed for IP %s: %s", ip_str, e)

    return ('', 'unknown')


def is_exempt_ip(client_ip: str, whitelisted_nets: list = None) -> bool:
    """Checks if IP is private loopback/link-local, Lightsail cluster node, or admin-whitelisted."""
    if not client_ip:
        return False

    clean_ip = client_ip.split('%')[0].strip()
    if clean_ip in EXEMPT_PUBLIC_IPS:
        return True

    try:
        ip_obj = ipaddress.ip_address(clean_ip)
    except ValueError:
        return False

    for net in INTERNAL_EXEMPT_NETWORKS:
        if ip_obj in net:
            return True

    if whitelisted_nets:
        for net in whitelisted_nets:
            if ip_obj in net:
                return True

    return False


def get_cached_geofence_config() -> dict:
    """Reads geofence settings from Redis cache or loads singleton model from DB with 300s TTL."""
    cached = cache.get("geofence:config:v1")
    if cached is not None:
        return cached

    try:
        from marketplace.models import GeofenceSettings
        gs = GeofenceSettings.load()
    except Exception as e:
        logger.warning("Failed to load GeofenceSettings: %s. Using default fallback.", e)
        return {
            'is_enabled': False,
            'enforcement_mode': 'STRICT_BLOCK',
            'allowed_countries': ['TZ'],
            'allowed_countries_set': {'TZ'},
            'block_tor_anonymous_proxies': True,
            'allow_unknown_country_fallback': True,
            'allow_staff_anywhere': True,
            'allow_seo_and_social_previews': True,
            'whitelisted_nets': [],
            'block_title': "SokoniMax is not yet available in your country",
            'block_message': "SokoniMax currently serves selected countries in East Africa. If you are travelling or using a VPN, please connect from a supported region and try again.",
        }

    whitelisted_nets = []
    if gs.whitelisted_ips:
        for line in re.split(r'[\r\n,]+', gs.whitelisted_ips):
            line = line.strip()
            if line:
                try:
                    whitelisted_nets.append(ipaddress.ip_network(line, strict=False))
                except ValueError:
                    pass

    allowed = gs.allowed_countries or ['TZ']
    allowed_set = {str(c).strip().upper() for c in allowed if str(c).strip()}

    cfg = {
        'is_enabled': bool(gs.is_enabled),
        'enforcement_mode': gs.enforcement_mode or 'STRICT_BLOCK',
        'allowed_countries': allowed,
        'allowed_countries_set': allowed_set,
        'block_tor_anonymous_proxies': bool(gs.block_tor_anonymous_proxies),
        'allow_unknown_country_fallback': bool(gs.allow_unknown_country_fallback),
        'allow_staff_anywhere': bool(gs.allow_staff_anywhere),
        'allow_seo_and_social_previews': bool(gs.allow_seo_and_social_previews),
        'whitelisted_nets': whitelisted_nets,
        'block_title': gs.block_title,
        'block_message': gs.block_message,
    }
    cache.set("geofence:config:v1", cfg, timeout=300)
    return cfg


def evaluate_http_geofence(request) -> dict:
    """Evaluates request against active geofence rules."""
    path = request.path or ''
    # Fast-path 1: Administrative, internal, static, and health endpoints
    if (
        path.startswith('/admin/') or
        path.startswith('/static/') or
        path.startswith('/media/') or
        path.startswith('/api/health/') or
        path.startswith('/internal/') or
        path == '/api/geofence/status/' or
        path == '/api/auth/verify-superuser/'
    ):
        return {'allowed': True}

    cfg = get_cached_geofence_config()
    if not cfg['is_enabled']:
        return {'allowed': True}

    client_ip = get_client_ip(request)
    if is_exempt_ip(client_ip, cfg['whitelisted_nets']):
        return {'allowed': True, 'country_code': 'EXEMPT'}

    # Fast-path 3: SEO and social previews if enabled
    if cfg['allow_seo_and_social_previews'] and request.method in ('GET', 'HEAD'):
        if path in ('/robots.txt', '/api/seo/render/') or path.startswith('/sitemap'):
            return {'allowed': True}

    # Fast-path 4: Browse Globally, Transact Locally (read-only allowed abroad)
    if cfg['enforcement_mode'] == 'READ_ONLY_OUTSIDE' and request.method in ('GET', 'HEAD', 'OPTIONS'):
        return {'allowed': True}

    cf_header = request.META.get('HTTP_CF_IPCOUNTRY', '').strip()
    country_code, source = resolve_country_code(client_ip, cf_header)

    # Tor exit node block check
    if country_code == 'T1' and cfg['block_tor_anonymous_proxies']:
        pass  # Proceed to auth bypass check before blocking
    elif not country_code and cfg['allow_unknown_country_fallback']:
        return {'allowed': True, 'country_code': 'UNKNOWN'}
    elif country_code in cfg['allowed_countries_set']:
        return {'allowed': True, 'country_code': country_code}

    # Authenticated superuser & staff bypass check
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated:
        try:
            from uzachuo.authentication import GracefulJWTAuthentication
            auth_res = GracefulJWTAuthentication().authenticate(request)
            if auth_res:
                user = auth_res[0]
                request.user = user
        except Exception:
            pass

    if user and user.is_authenticated:
        if user.is_superuser:
            return {'allowed': True, 'country_code': country_code}
        if user.is_staff and cfg['allow_staff_anywhere']:
            return {'allowed': True, 'country_code': country_code}

    c_name = COUNTRY_NAMES.get(country_code, country_code or 'Unknown')
    return {
        'allowed': False,
        'country_code': country_code,
        'country_name': c_name,
        'detail': cfg['block_message'],
        'title': cfg['block_title'],
        'mode': cfg['enforcement_mode'],
        'allowed_countries': cfg['allowed_countries'],
    }


class GeofenceMiddleware:
    """
    Enforces country geofencing at HTTP middleware layer.
    Returns HTTP 451 Unavailable For Legal Reasons when outside allowed countries.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        verdict = evaluate_http_geofence(request)
        if not verdict.get('allowed', True):
            from django.http import JsonResponse
            resp = JsonResponse({
                'code': 'region_restricted',
                'title': verdict.get('title', 'Region Restricted'),
                'detail': verdict.get('detail', 'Access restricted in your country.'),
                'country_code': verdict.get('country_code', ''),
                'country_name': verdict.get('country_name', ''),
                'allowed_countries': verdict.get('allowed_countries', []),
            }, status=451)
            resp['Cache-Control'] = 'private, no-store'
            resp['Vary'] = 'CF-IPCountry'
            return resp

        return self.get_response(request)


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions

class GeofenceStatusView(APIView):
    """
    Publicly accessible endpoint reporting the current visitor's region status,
    detected country, and platform enforcement parameters.
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        verdict = evaluate_http_geofence(request)
        cfg = get_cached_geofence_config()
        client_ip = get_client_ip(request)
        cf_header = request.META.get('HTTP_CF_IPCOUNTRY', '').strip()
        code, source = resolve_country_code(client_ip, cf_header)
        c_name = COUNTRY_NAMES.get(code, code or 'Unknown')

        data = {
            'restricted': not verdict.get('allowed', True),
            'is_enabled': cfg['is_enabled'],
            'mode': cfg['enforcement_mode'],
            'country_code': code,
            'country_name': c_name,
            'allowed_countries': cfg['allowed_countries'],
            'title': cfg['block_title'],
            'detail': cfg['block_message'],
        }
        resp = Response(data, status=200)
        resp['Cache-Control'] = 'private, no-store'
        return resp


def check_ws_geofence(scope, user=None) -> bool:
    """
    Validates WebSocket connections against geofencing rules.
    Returns False if connection must be closed (code 4451).
    """
    try:
        cfg = get_cached_geofence_config()
        if not cfg['is_enabled']:
            return True

        if user and (getattr(user, 'is_superuser', False) or (getattr(user, 'is_staff', False) and cfg['allow_staff_anywhere'])):
            return True

        headers = dict(scope.get('headers', []))
        client = scope.get('client', [''])
        client_ip = client[0] if client else ''

        for h_key, h_val in headers.items():
            if h_key.lower() == b'cf-connecting-ip':
                client_ip = h_val.decode('utf-8', errors='ignore').strip()
                break
            elif h_key.lower() == b'x-forwarded-for' and not client_ip:
                client_ip = h_val.decode('utf-8', errors='ignore').split(',')[0].strip()

        if is_exempt_ip(client_ip, cfg['whitelisted_nets']):
            return True

        cf_header = ''
        for h_key, h_val in headers.items():
            if h_key.lower() == b'cf-ipcountry':
                cf_header = h_val.decode('utf-8', errors='ignore').strip().upper()
                break

        country_code, _ = resolve_country_code(client_ip, cf_header)
        if country_code == 'T1' and cfg['block_tor_anonymous_proxies']:
            return False
        if not country_code and cfg['allow_unknown_country_fallback']:
            return True
        if country_code in cfg['allowed_countries_set']:
            return True

        return False
    except Exception as e:
        logger.warning("Error in check_ws_geofence: %s", e)
        return True
