from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    StaffProfile, Task, TaskCategory, TaskAction, Approval,
    AuditLog, StaffPermission, Department
)

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'description']


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
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True, default=None)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True, default=None)
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)
    is_overdue = serializers.SerializerMethodField()

    def get_is_overdue(self, obj):
        if hasattr(obj, 'is_overdue'):
            if callable(obj.is_overdue):
                return obj.is_overdue()
            return obj.is_overdue
        return False

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'category', 'category_name',
            'assigned_to', 'assigned_to_username', 'created_by', 'created_by_username',
            'status', 'priority', 'due_date', 'created_at', 'updated_at', 'completed_at',
            'is_overdue'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'completed_at', 'status']
        # FIX L-18: removed 'assigned_to' from read_only so tasks can be assigned on creation


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
        read_only_fields = ['user', 'target_user', 'task', 'ip_address', 'user_agent', 'timestamp']


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


from marketplace.models import PaymentConfirmation, UserProfile
from billing.models import CommissionPayment

class UserManagementSerializer(serializers.ModelSerializer):
    tier = serializers.CharField(source='profile.tier', read_only=True)
    is_verified = serializers.BooleanField(source='profile.is_verified', read_only=True)
    is_inspector = serializers.SerializerMethodField()
    inspector_level = serializers.CharField(source='inspector_profile.level', read_only=True, default=None)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'is_active', 'is_staff', 'is_superuser',
            'tier', 'is_verified', 'is_inspector', 'inspector_level', 'permissions'
        ]

    def get_is_inspector(self, obj):
        return hasattr(obj, 'inspector_profile')

    def get_permissions(self, obj):
        if not hasattr(obj, 'staff_permissions'):
            return []
        return list(obj.staff_permissions.filter(is_active=True).values_list('permission', flat=True))


class PaymentConfirmationSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    tier_name = serializers.CharField(source='tier.name', read_only=True)
    phone_number = serializers.CharField(source='user.profile.phone_number', read_only=True, default='')
    whatsapp_number = serializers.CharField(source='user.profile.whatsapp_number', read_only=True, default='')
    email = serializers.CharField(source='user.email', read_only=True, default='')
    location = serializers.CharField(source='user.profile.location', read_only=True, default='')
    full_name = serializers.SerializerMethodField()
    store_url = serializers.SerializerMethodField()
    active_products_count = serializers.SerializerMethodField()

    class Meta:
        model = PaymentConfirmation
        fields = [
            'id', 'user', 'username', 'full_name', 'tier', 'tier_name', 'amount',
            'reference', 'proof', 'status', 'created_at', 'phone_number',
            'whatsapp_number', 'email', 'location', 'store_url', 'active_products_count'
        ]

    def get_full_name(self, obj):
        if not obj.user:
            return ""
        name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return name or obj.user.username

    def get_store_url(self, obj):
        return f"/{obj.user.username}" if obj.user else ""

    def get_active_products_count(self, obj):
        if not obj.user:
            return 0
        return getattr(obj.user, 'products', None).filter(is_available=True).count() if hasattr(obj.user, 'products') else 0


class StaffCommissionPaymentSerializer(serializers.ModelSerializer):
    seller_username = serializers.CharField(source='invoice.seller.username', read_only=True)
    seller_phone = serializers.CharField(source='invoice.seller.profile.phone_number', read_only=True, default='')
    seller_whatsapp = serializers.CharField(source='invoice.seller.profile.whatsapp_number', read_only=True, default='')
    seller_email = serializers.CharField(source='invoice.seller.email', read_only=True, default='')
    seller_location = serializers.CharField(source='invoice.seller.profile.location', read_only=True, default='')
    seller_full_name = serializers.SerializerMethodField()
    seller_store_url = serializers.SerializerMethodField()
    invoice_year = serializers.IntegerField(source='invoice.year', read_only=True)
    invoice_month = serializers.IntegerField(source='invoice.month', read_only=True)
    total_order_amount = serializers.DecimalField(source='invoice.total_order_amount', max_digits=12, decimal_places=2, read_only=True, default=0)
    order_count = serializers.IntegerField(source='invoice.order_count', read_only=True, default=0)
    total_commission = serializers.DecimalField(source='invoice.total_commission', max_digits=12, decimal_places=2, read_only=True, default=0)
    subscription_fee = serializers.DecimalField(source='invoice.subscription_fee', max_digits=12, decimal_places=2, read_only=True, default=0)
    total_amount_due = serializers.DecimalField(source='invoice.total_amount_due', max_digits=12, decimal_places=2, read_only=True, default=0)
    due_date = serializers.DateField(source='invoice.due_date', read_only=True, default=None)
    invoice_status = serializers.CharField(source='invoice.status', read_only=True, default='')
    days_overdue = serializers.SerializerMethodField()
    reviewed_by_username = serializers.CharField(source='reviewed_by.username', read_only=True, default=None)

    class Meta:
        model = CommissionPayment
        fields = [
            'id', 'invoice', 'seller_username', 'seller_full_name', 'seller_store_url',
            'seller_phone', 'seller_whatsapp', 'seller_email', 'seller_location',
            'invoice_year', 'invoice_month', 'total_order_amount', 'order_count',
            'total_commission', 'subscription_fee', 'total_amount_due', 'due_date',
            'invoice_status', 'days_overdue', 'amount', 'transaction_id',
            'receipt_screenshot', 'status', 'rejection_reason', 'submitted_at',
            'reviewed_by_username', 'reviewed_at'
        ]

    def get_seller_full_name(self, obj):
        seller = getattr(getattr(obj, 'invoice', None), 'seller', None)
        if not seller:
            return ""
        name = f"{seller.first_name} {seller.last_name}".strip()
        return name or seller.username

    def get_seller_store_url(self, obj):
        seller = getattr(getattr(obj, 'invoice', None), 'seller', None)
        return f"/{seller.username}" if seller else ""

    def get_days_overdue(self, obj):
        due_date = getattr(getattr(obj, 'invoice', None), 'due_date', None)
        if due_date:
            from django.utils import timezone
            today = timezone.now().date()
            if today > due_date:
                return (today - due_date).days
        return 0
