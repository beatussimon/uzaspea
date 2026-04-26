from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    StaffProfile, Task, TaskCategory, TaskAction, Approval,
    AuditLog, StaffPermission
)


class StaffProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)

    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = StaffProfile
        fields = [
            'id', 'user', 'username', 'email', 'is_active',
            'department', 'department_name', 'phone_number', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']


class TaskCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskCategory
        fields = ['id', 'name', 'description', 'requires_approval', 'created_at']
        read_only_fields = ['created_at']


class TaskSerializer(serializers.ModelSerializer):
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'category', 'category_name',
            'assigned_to', 'assigned_to_username', 'created_by', 'created_by_username',
            'status', 'priority', 'due_date', 'created_at', 'updated_at', 'completed_at',
            'is_overdue'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'completed_at']


class TaskActionSerializer(serializers.ModelSerializer):
    performed_by_username = serializers.CharField(source='performed_by.username', read_only=True)
    reviewed_by_username = serializers.CharField(source='reviewed_by.username', read_only=True, default=None)
    task_title = serializers.CharField(source='task.title', read_only=True)

    class Meta:
        model = TaskAction
        fields = [
            'id', 'task', 'task_title', 'performed_by', 'performed_by_username',
            'action_type', 'description', 'previous_value', 'new_value',
            'status', 'notes', 'performed_at', 'reviewed_by', 'reviewed_by_username',
            'reviewed_at'
        ]
        read_only_fields = ['performed_by', 'performed_at', 'reviewed_by', 'reviewed_at']


class ApprovalSerializer(serializers.ModelSerializer):
    submitted_by_username = serializers.CharField(source='submitted_by.username', read_only=True)
    reviewer_username = serializers.CharField(source='reviewer.username', read_only=True, default=None)

    class Meta:
        model = Approval
        fields = [
            'id', 'action', 'task', 'approval_type', 'title', 'description',
            'submitted_by', 'submitted_by_username', 'status', 'reviewer',
            'reviewer_username', 'comments', 'submitted_at', 'reviewed_at'
        ]
        read_only_fields = ['submitted_by', 'submitted_at', 'reviewed_at']


class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True, default=None)
    target_username = serializers.CharField(source='target_user.username', read_only=True, default=None)
    task_title = serializers.CharField(source='task.title', read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'username', 'action', 'description',
            'target_user', 'target_username', 'task', 'task_title',
            'ip_address', 'user_agent', 'extra_data', 'timestamp'
        ]
        read_only_fields = ['__all__']


class StaffPermissionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    granted_by_username = serializers.CharField(source='granted_by.username', read_only=True, default=None)

    class Meta:
        model = StaffPermission
        fields = [
            'id', 'user', 'username', 'permission', 'granted_by',
            'granted_by_username', 'granted_at', 'expires_at', 'is_active'
        ]
        read_only_fields = ['granted_by', 'granted_at']
