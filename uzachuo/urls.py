from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('marketplace.urls')),
    path('accounts/', include('django.contrib.auth.urls')),  # Includes password reset URLs
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)