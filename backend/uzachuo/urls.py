import logging
import time
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from staff.api_urls import api_urlpatterns as staff_api_urlpatterns
from django.contrib.sitemaps.views import sitemap
from django.views.decorators.cache import cache_page
from marketplace.sitemaps import StaticViewSitemap, CategorySitemap, ProductSitemap, SellerSitemap, BrandSitemap
from marketplace.views_seo import SeoRenderView
from uzachuo.private_media import ProtectedMediaAuthView
from django.http import HttpResponse, JsonResponse
from django.db import connection
from django.core.cache import cache

logger = logging.getLogger(__name__)

sitemaps = {
    'static': StaticViewSitemap,
    'categories': CategorySitemap,
    'brands': BrandSitemap,
    'products': ProductSitemap,
    'sellers': SellerSitemap,
}


def liveness_check(request):
    return JsonResponse({'status': 'alive'})


def health_check(request):
    status = {'status': 'healthy', 'db': 'ok', 'redis': 'ok', 'timestamp': time.time()}
    http_status = 200

    try:
        connection.ensure_connection()
    except Exception:
        logger.exception("Health check DB failure")
        status['db'] = 'unhealthy'
        status['status'] = 'degraded'
        http_status = 503

    try:
        cache.set('_health', '1', 5)
        if cache.get('_health') != '1':
            raise RuntimeError('cache read failed')
    except Exception:
        logger.exception("Health check Redis failure")
        status['redis'] = 'unhealthy'
        status['status'] = 'degraded'
        http_status = 503

    return JsonResponse(status, status=http_status)


def robots_txt(request):
    host = request.get_host()
    scheme = request.scheme
    sitemap_url = f"{scheme}://{host}/sitemap.xml"
    lines = [
        "User-agent: *",
        "Allow: /",
        "Allow: /products$",
        "Allow: /products?category=*",
        "Allow: /products?brand=*",
        "Allow: /product/*",
        "Allow: /media/*",
        "Allow: /help",
        "Allow: /terms",
        "Allow: /privacy",
        "Disallow: /api/",
        "Disallow: /admin/",
        "Disallow: /staff/",
        "Disallow: /staff-admin/",
        "Disallow: /cart",
        "Disallow: /checkout",
        "Disallow: /dashboard/",
        "Disallow: /teams-dashboard/",
        "Disallow: /messages",
        "Disallow: /settings",
        "Disallow: /secure-media/",
        "Disallow: /*?*sort_by=*",
        "Disallow: /*?*saved=*",
        f"Sitemap: {sitemap_url}",
    ]
    return HttpResponse("\n".join(lines), content_type="text/plain")


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/live/', liveness_check, name='health_live'),
    path('api/health/', health_check, name='health_check'),
    path('internal/media-auth/<path:rel_path>', ProtectedMediaAuthView.as_view(), name='protected_media_auth'),
    path('secure-media/<path:rel_path>', ProtectedMediaAuthView.as_view(), name='secure_media_dev'),
    path('sitemap.xml', cache_page(3600)(sitemap), {'sitemaps': sitemaps}, name='django.contrib.sitemaps.views.sitemap'),
    path('robots.txt', robots_txt, name='robots_txt'),
    path('api/seo/render/', SeoRenderView.as_view(), name='seo_render'),
    path('api/staff/', include(staff_api_urlpatterns)),
    path('api/inspections/', include('inspections.urls')),
    path('api/warehouses/', include('warehouses.urls')),
    path('api/logistics/', include('logistics.urls')),
    path('api/locations/', include('locations.urls')),
    path('api/', include('billing.urls')),
    path('staff/', include('staff.urls')),
    path('', include('marketplace.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
