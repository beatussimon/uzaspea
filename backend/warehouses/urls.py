from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WarehouseViewSet, WarehouseIntakeViewSet, WarehouseTransferViewSet, PickupVerifyView

router = DefaultRouter()
router.register(r'warehouses', WarehouseViewSet, basename='warehouse')
router.register(r'intakes', WarehouseIntakeViewSet, basename='warehouse-intake')
router.register(r'transfers', WarehouseTransferViewSet, basename='warehouse-transfer')

urlpatterns = [
    path('pickup/verify/', PickupVerifyView.as_view(), name='pickup-verify'),
    path('', include(router.urls)),
]
