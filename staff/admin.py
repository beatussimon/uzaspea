from django.contrib import admin
from .models import (
    StaffProfile, Task, TaskAction, Approval, AuditLog, 
    StaffPermission, TaskCategory
)


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'department', 'is_active', 'created_at']
    list_filter = ['is_active', 'department', 'created_at']
    search_fields = ['user__username', 'user__email', 'department']
    raw_id_fields = ['user']


@admin.register(TaskCategory)
class TaskCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'requires_approval', 'created_at']
    search_fields = ['name']


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'assigned_to', 'status', 'priority', 'due_date', 'created_at']
    list_filter = ['status', 'priority', 'category', 'created_at']
    search_fields = ['title', 'description', 'assigned_to__username']
    raw_id_fields = ['assigned_to', 'created_by', 'category']
    date_hierarchy = 'created_at'


@admin.register(TaskAction)
class TaskActionAdmin(admin.ModelAdmin):
    list_display = ['task', 'performed_by', 'action_type', 'status', 'performed_at']
    list_filter = ['action_type', 'status', 'performed_at']
    search_fields = ['description', 'task__title', 'performed_by__username']
    raw_id_fields = ['task', 'performed_by', 'reviewed_by']
    date_hierarchy = 'performed_at'


@admin.register(Approval)
class ApprovalAdmin(admin.ModelAdmin):
    list_display = ['title', 'approval_type', 'submitted_by', 'status', 'submitted_at']
    list_filter = ['approval_type', 'status', 'submitted_at']
    search_fields = ['title', 'description', 'submitted_by__username']
    raw_id_fields = ['submitted_by', 'reviewer', 'task', 'action']
    date_hierarchy = 'submitted_at'


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'description', 'timestamp']
    list_filter = ['action', 'timestamp']
    search_fields = ['description', 'user__username']
    raw_id_fields = ['user', 'target_user', 'task']
    date_hierarchy = 'timestamp'
    readonly_fields = ['user', 'action', 'description', 'target_user', 'task', 'ip_address', 'user_agent', 'extra_data', 'timestamp']


@admin.register(StaffPermission)
class StaffPermissionAdmin(admin.ModelAdmin):
    list_display = ['user', 'permission', 'granted_by', 'granted_at', 'expires_at', 'is_active']
    list_filter = ['permission', 'is_active', 'granted_at']
    search_fields = ['user__username']
    raw_id_fields = ['user', 'granted_by']
