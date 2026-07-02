from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WarehouseViewSet, WarehouseIntakeViewSet, WarehouseTransferViewSet, PickupVerifyView, WarehouseStaffAssignmentViewSet

router = DefaultRouter()
router.register(r'warehouses', WarehouseViewSet, basename='warehouse')
router.register(r'intakes', WarehouseIntakeViewSet, basename='warehouse-intake')
router.register(r'transfers', WarehouseTransferViewSet, basename='warehouse-transfer')
router.register(r'staff-assignments', WarehouseStaffAssignmentViewSet, basename='warehouse-staff-assignment')

urlpatterns = [
    path('pickup/verify/', PickupVerifyView.as_view(), name='pickup-verify'),
    path('', include(router.urls)),
]
