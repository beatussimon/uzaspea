from django.contrib import admin
from .models import Warehouse, WarehouseIntake, WarehouseTransfer, HistoricalRoutePricing, WarehouseStaffAssignment

@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'region', 'is_active', 'created_at']
    list_filter = ['region', 'is_active']
    search_fields = ['name', 'code', 'region', 'address']

@admin.register(WarehouseIntake)
class WarehouseIntakeAdmin(admin.ModelAdmin):
    list_display = ['order', 'warehouse', 'intake_by', 'package_condition', 'created_at']
    list_filter = ['warehouse', 'package_condition']
    search_fields = ['order__id', 'warehouse__name', 'intake_by__username']
    readonly_fields = ['created_at']

@admin.register(WarehouseTransfer)
class WarehouseTransferAdmin(admin.ModelAdmin):
    list_display = ['order', 'source_warehouse', 'destination_warehouse', 'status', 'shipped_at', 'received_at']
    list_filter = ['status', 'source_warehouse', 'destination_warehouse']
    search_fields = ['order__id']

@admin.register(HistoricalRoutePricing)
class HistoricalRoutePricingAdmin(admin.ModelAdmin):
    list_display = ['origin_warehouse', 'destination_warehouse', 'average_cost', 'data_points', 'last_updated']
    list_filter = ['origin_warehouse', 'destination_warehouse']

@admin.register(WarehouseStaffAssignment)
class WarehouseStaffAssignmentAdmin(admin.ModelAdmin):
    list_display = ['user', 'warehouse', 'is_manager', 'assigned_at']
    list_filter = ['warehouse', 'is_manager']
    search_fields = ['user__username', 'warehouse__name', 'warehouse__code']
