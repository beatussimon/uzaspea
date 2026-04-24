from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from staff.api_urls import api_urlpatterns as staff_api_urlpatterns

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/staff/', include(staff_api_urlpatterns)),
    path('staff/', include('staff.urls')),
    path('', include('marketplace.urls')),
    path('accounts/', include('django.contrib.auth.urls')),  # Includes password reset URLs
] 

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root = settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root = settings.STATIC_ROOT)