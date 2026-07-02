from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ShipmentViewSet, DeliveryOptionViewSet, DeliveryQuoteView, DriverPaymentViewSet, DriverViewSet

router = DefaultRouter()
router.register(r'shipments', ShipmentViewSet, basename='shipment')
router.register(r'options', DeliveryOptionViewSet, basename='delivery-option')
router.register(r'driver-payments', DriverPaymentViewSet, basename='driver-payment')
router.register(r'drivers', DriverViewSet, basename='driver')

urlpatterns = [
    path('pricing/quote/', DeliveryQuoteView.as_view(), name='delivery-quote'),
    path('', include(router.urls)),
]

