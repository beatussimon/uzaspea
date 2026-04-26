from django.contrib import admin
from .models import (
    InspectionCategory, ChecklistTemplate, ChecklistItem,
    InspectorProfile, InspectionRequest, InspectionBill,
    InspectionPayment, InspectionAssignment, InspectionCheckIn,
    InspectionEvidence, InspectionReport, ChecklistResponse,
    ReInspection, InspectionNotification, FraudFlag, SLABreach,
)


@admin.register(InspectionCategory)
class InspectionCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'level', 'parent', 'base_price', 'required_inspector_level', 'is_active']
    list_filter = ['level', 'is_active', 'required_inspector_level']
    search_fields = ['name']
    prepopulated_fields = {'slug': ('name',)}


class ChecklistItemInline(admin.TabularInline):
    model = ChecklistItem
    extra = 1
    fields = ['label', 'item_type', 'is_mandatory', 'order', 'fail_triggers_flag', 'unit']


@admin.register(ChecklistTemplate)
class ChecklistTemplateAdmin(admin.ModelAdmin):
    list_display = ['category', 'version', 'is_active', 'created_at']
    list_filter = ['is_active']
    inlines = [ChecklistItemInline]


@admin.register(InspectorProfile)
class InspectorProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'level', 'performance_score', 'total_inspections', 'is_available']
    list_filter = ['level', 'is_available']
    filter_horizontal = ['certified_categories']


@admin.register(InspectionRequest)
class InspectionRequestAdmin(admin.ModelAdmin):
    list_display = ['inspection_id', 'client', 'item_name', 'category', 'scope', 'status', 'created_at']
    list_filter = ['status', 'scope', 'turnaround']
    search_fields = ['inspection_id', 'item_name', 'client__username']
    readonly_fields = ['inspection_id']


@admin.register(InspectionPayment)
class InspectionPaymentAdmin(admin.ModelAdmin):
    list_display = ['request', 'stage', 'amount', 'status', 'confirmed_by', 'created_at']
    list_filter = ['stage', 'status']


@admin.register(InspectionReport)
class InspectionReportAdmin(admin.ModelAdmin):
    list_display = ['request', 'verdict', 'is_locked', 'submitted_by', 'approved_by', 'submitted_at']
    list_filter = ['verdict', 'is_locked']
    readonly_fields = ['report_hash', 'is_locked']


@admin.register(FraudFlag)
class FraudFlagAdmin(admin.ModelAdmin):
    list_display = ['request', 'flag_type', 'resolved', 'created_at']
    list_filter = ['flag_type', 'resolved']


admin.site.register(InspectionBill)
admin.site.register(InspectionAssignment)
admin.site.register(InspectionCheckIn)
admin.site.register(InspectionEvidence)
admin.site.register(ChecklistResponse)
admin.site.register(ReInspection)
admin.site.register(InspectionNotification)
admin.site.register(SLABreach)
