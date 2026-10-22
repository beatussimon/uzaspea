from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import RegionViewSet, DistrictViewSet

router = SimpleRouter()
router.register(r'regions', RegionViewSet, basename='region')
router.register(r'districts', DistrictViewSet, basename='district')

urlpatterns = [
    path('', include(router.urls)),
]
