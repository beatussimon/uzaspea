import ipaddress
from django.conf import settings


def get_client_ip(request) -> str:
    cf_ip = (request.META.get("HTTP_CF_CONNECTING_IP") or "").strip()
    if cf_ip:
        try:
            ipaddress.ip_address(cf_ip)
            return cf_ip
        except ValueError:
            pass

    xff = (request.META.get("HTTP_X_FORWARDED_FOR") or "").strip()
    if xff:
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        num_proxies = getattr(settings, "NUM_TRUSTED_PROXIES", 2)
        idx = max(0, len(parts) - num_proxies)
        if parts:
            try:
                ipaddress.ip_address(parts[idx])
                return parts[idx]
            except ValueError:
                pass

    remote = (request.META.get("REMOTE_ADDR") or "127.0.0.1").strip()
    try:
        ipaddress.ip_address(remote)
        return remote
    except ValueError:
        return "127.0.0.1"


def get_ws_scope_ip(scope: dict) -> str:
    headers = {
        k.decode("latin1").lower(): v.decode("latin1").strip()
        for k, v in (scope.get("headers") or [])
    }
    cf_ip = headers.get("cf-connecting-ip", "")
    if cf_ip:
        try:
            ipaddress.ip_address(cf_ip)
            return cf_ip
        except ValueError:
            pass
    xff = headers.get("x-forwarded-for", "")
    if xff:
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        num_proxies = getattr(settings, "NUM_TRUSTED_PROXIES", 2)
        idx = max(0, len(parts) - num_proxies)
        if parts:
            try:
                ipaddress.ip_address(parts[idx])
                return parts[idx]
            except ValueError:
                pass
    client = scope.get("client")
    if client and client[0]:
        return str(client[0])
    return "127.0.0.1"


def get_ws_scope_country(scope: dict) -> str:
    headers = {
        k.decode("latin1").lower(): v.decode("latin1").strip()
        for k, v in (scope.get("headers") or [])
    }
    cf_country = headers.get("cf-ipcountry", "").upper()
    if len(cf_country) == 2 and cf_country != "XX":
        return cf_country
    return ""


def validate_webpush_endpoint(endpoint: str) -> bool:
    """Validate push endpoint is HTTPS and points to a public, non-internal IP (SSRF guard)."""
    import urllib.parse
    import socket
    if not endpoint or not isinstance(endpoint, str):
        return False
    try:
        parsed = urllib.parse.urlparse(endpoint.strip())
        if parsed.scheme.lower() != 'https':
            return False
        hostname = parsed.hostname
        if not hostname:
            return False
        addrinfo = socket.getaddrinfo(hostname, 443, proto=socket.IPPROTO_TCP)
        for _, _, _, _, sockaddr in addrinfo:
            ip = ipaddress.ip_address(sockaddr[0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
        return True
    except Exception:
        return False

