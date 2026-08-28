from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from staff.api_urls import api_urlpatterns as staff_api_urlpatterns
from django.contrib.sitemaps.views import sitemap
from marketplace.sitemaps import StaticViewSitemap, CategorySitemap, ProductSitemap
from django.http import HttpResponse, JsonResponse
from django.db import connection
from django.core.cache import cache
import time

sitemaps = {
    'static': StaticViewSitemap,
    'categories': CategorySitemap,
    'products': ProductSitemap,
}

def health_check(request):
    status = {'status': 'healthy', 'db': 'ok', 'redis': 'ok', 'timestamp': time.time()}
    http_status = 200
    
    try:
        connection.ensure_connection()
    except Exception as e:
        status['db'] = f'unhealthy: {str(e)}'
        status['status'] = 'degraded'
        http_status = 503
        
    try:
        cache.set('_health', '1', 5)
        if cache.get('_health') != '1':
            raise Exception('cache read failed')
    except Exception as e:
        status['redis'] = f'unhealthy: {str(e)}'
        status['status'] = 'degraded'
        http_status = 503

    return JsonResponse(status, status=http_status)

def robots_txt(request):
    host = request.get_host()
    scheme = request.scheme
    sitemap_url = f"{scheme}://{host}/sitemap.xml"
    lines = [
        "User-Agent: *",
        "Disallow: /api/",
        "Disallow: /admin/",
        "Disallow: /staff/",
        f"Sitemap: {sitemap_url}"
    ]
    return HttpResponse("\n".join(lines), content_type="text/plain")

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health_check'),
    path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='django.contrib.sitemaps.views.sitemap'),
    path('robots.txt', robots_txt, name='robots_txt'),
    path('api/staff/', include(staff_api_urlpatterns)),
    path('api/inspections/', include('inspections.urls')),
    path('api/warehouses/', include('warehouses.urls')),
    path('api/logistics/', include('logistics.urls')),
    path('api/locations/', include('locations.urls')),
    path('api/', include('billing.urls')),
    path('staff/', include('staff.urls')),
    path('', include('marketplace.urls')),
    path('accounts/', include('django.contrib.auth.urls')),  # Includes password reset URLs
] 

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root = settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root = settings.STATIC_ROOT)