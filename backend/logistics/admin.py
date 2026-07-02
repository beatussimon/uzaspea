from django.contrib import admin
from .models import Shipment, DriverPayment, DeliveryOption, PickupCode, Driver

@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ['user', 'vehicle_type', 'assigned_region', 'is_active', 'created_at']
    list_filter = ['is_active', 'vehicle_type']
    search_fields = ['user__username', 'user__email', 'vehicle_plate', 'assigned_region']

@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ['order', 'status', 'carrier_type', 'driver', 'tracking_number', 'created_at']
    list_filter = ['status', 'carrier_type']
    search_fields = ['order__id', 'tracking_number']

@admin.register(DriverPayment)
class DriverPaymentAdmin(admin.ModelAdmin):
    list_display = ['driver', 'shipment', 'amount', 'is_paid', 'created_at']
    list_filter = ['is_paid']
    search_fields = ['driver__username', 'shipment__order__id']

@admin.register(DeliveryOption)
class DeliveryOptionAdmin(admin.ModelAdmin):
    list_display = ['name', 'base_price', 'per_km_rate', 'is_active']
    list_filter = ['is_active']

@admin.register(PickupCode)
class PickupCodeAdmin(admin.ModelAdmin):
    list_display = ['order', 'code', 'is_used', 'verified_by', 'created_at']
    list_filter = ['is_used']
    search_fields = ['order__id', 'code']
