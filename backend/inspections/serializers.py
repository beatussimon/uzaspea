from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    InspectionCategory, ChecklistTemplate, ChecklistItem,
    InspectorProfile, InspectionRequest, InspectionBill,
    InspectionPayment, InspectionAssignment, InspectionCheckIn,
    InspectionEvidence, InspectionReport, ChecklistResponse,
    ReInspection, InspectionNotification, FraudFlag, SLABreach,
)


class InspectionCategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    full_path = serializers.SerializerMethodField()

    class Meta:
        model = InspectionCategory
        fields = [
            'id', 'name', 'slug', 'level', 'parent', 'description',
            'base_price', 'required_inspector_level', 'is_active',
            'children', 'full_path',
        ]

    def get_children(self, obj):
        kids = obj.children.filter(is_active=True)
        return InspectionCategorySerializer(kids, many=True).data

    def get_full_path(self, obj):
        return obj.get_full_path()


class ChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChecklistItem
        fields = [
            'id', 'label', 'item_type', 'is_mandatory',
            'order', 'fail_triggers_flag', 'unit', 'help_text',
        ]


class ChecklistTemplateSerializer(serializers.ModelSerializer):
    items = ChecklistItemSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = ChecklistTemplate
        fields = ['id', 'category', 'category_name', 'version', 'is_active', 'items', 'created_at']


class InspectorProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.SerializerMethodField()
    certified_categories = InspectionCategorySerializer(many=True, read_only=True)
    certified_category_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=InspectionCategory.objects.all(),
        source='certified_categories', write_only=True, required=False
    )

    class Meta:
        model = InspectorProfile
        fields = [
            'id', 'user', 'username', 'full_name', 'level',
            'certified_categories', 'certified_category_ids',
            'is_available', 'performance_score',
            'total_inspections', 'total_flags', 'phone_number', 'notes',
        ]

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class InspectionBillSerializer(serializers.ModelSerializer):
    class Meta:
        model = InspectionBill
        fields = '__all__'
        read_only_fields = ['request']


class InspectionPaymentSerializer(serializers.ModelSerializer):
    confirmed_by_username = serializers.CharField(
        source='confirmed_by.username', read_only=True
    )
    # Use any queryset here, we will filter it in the view if needed, 
    # but for create validation, we need to ensure it's a valid PK.
    # However, to be strict, we'll override __init__ or just handle it in validate.

    class Meta:
        model = InspectionPayment
        fields = [
            'id', 'request', 'stage', 'amount', 'proof_image',
            'transaction_reference', 'status', 'confirmed_by',
            'confirmed_by_username', 'confirmed_at', 'rejection_reason', 'created_at',
        ]
        read_only_fields = ['status', 'confirmed_by', 'confirmed_at']

    def validate(self, data):
        request_obj = data.get('request')
        user = self.context['request'].user
        
        # Ownership check (Final redundancy for 403)
        if request_obj.client != user and not user.is_superuser:
            raise serializers.ValidationError("You do not have permission to submit payment for this request.")

        # Status check
        allowed_statuses = ['awaiting_payment', 'deposit_paid', 'bill_sent']
        if request_obj.status not in allowed_statuses and not user.is_superuser:
             raise serializers.ValidationError(f"Payments cannot be submitted for requests in {request_obj.status} status.")
             
        return data


class InspectionAssignmentSerializer(serializers.ModelSerializer):
    inspector_name = serializers.CharField(
        source='inspector.user.username', read_only=True
    )
    inspector_level = serializers.CharField(
        source='inspector.level', read_only=True
    )

    class Meta:
        model = InspectionAssignment
        fields = [
            'id', 'request', 'inspector', 'inspector_name', 'inspector_level',
            'assigned_by', 'is_manual_override', 'override_reason',
            'sla_deadline', 'assigned_at',
        ]


class InspectionCheckInSerializer(serializers.ModelSerializer):
    class Meta:
        model = InspectionCheckIn
        fields = [
            'id', 'request', 'checkin_photo', 'checkin_lat', 'checkin_lng', 'checkin_at',
            'checkout_photo', 'checkout_lat', 'checkout_lng', 'checkout_at',
        ]
        read_only_fields = ['checkin_at', 'checkout_at']


class InspectionEvidenceSerializer(serializers.ModelSerializer):
    item_label = serializers.CharField(source='checklist_item.label', read_only=True)

    class Meta:
        model = InspectionEvidence
        fields = [
            'id', 'request', 'checklist_item', 'item_label', 'image',
            'captured_at', 'latitude', 'longitude', 'file_hash', 'caption',
        ]
        read_only_fields = ['file_hash', 'captured_at']


class ChecklistResponseSerializer(serializers.ModelSerializer):
    item_label = serializers.CharField(source='checklist_item.label', read_only=True)
    item_type = serializers.CharField(source='checklist_item.item_type', read_only=True)

    class Meta:
        model = ChecklistResponse
        fields = [
            'id', 'report', 'checklist_item', 'item_label',
            'item_type', 'response_value', 'flagged', 'notes',
        ]


class InspectionReportSerializer(serializers.ModelSerializer):
    responses = ChecklistResponseSerializer(many=True, read_only=True)
    submitted_by_username = serializers.CharField(
        source='submitted_by.username', read_only=True
    )
    approved_by_username = serializers.CharField(
        source='approved_by.username', read_only=True
    )

    class Meta:
        model = InspectionReport
        fields = [
            'id', 'request', 'checklist_template_version', 'verdict',
            'summary', 'is_locked', 'report_hash',
            'submitted_by', 'submitted_by_username', 'submitted_at',
            'approved_by', 'approved_by_username', 'approved_at',
            'qa_notes', 'responses', 'finalized_at',
        ]
        read_only_fields = [
            'is_locked', 'report_hash', 'submitted_by',
            'approved_by', 'approved_at',
        ]


class InspectionRequestSerializer(serializers.ModelSerializer):
    client_username = serializers.CharField(source='client.username', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_path = serializers.CharField(source='category.get_full_path', read_only=True)
    bill = InspectionBillSerializer(read_only=True)
    assignment = serializers.SerializerMethodField()
    report = InspectionReportSerializer(read_only=True)
    payments = InspectionPaymentSerializer(many=True, read_only=True)
    evidence = InspectionEvidenceSerializer(many=True, read_only=True)
    unread_notifications = serializers.SerializerMethodField()

    class Meta:
        model = InspectionRequest
        fields = [
            'id', 'inspection_id', 'client', 'client_username',
            'category', 'category_name', 'category_path',
            'marketplace_product', 'product_snapshot',
            'item_name', 'item_description', 'item_address',
            'item_age_years', 'is_complex', 'scope', 'turnaround',
            'status', 'pre_inspection_notes', 'reinspection_coverage',
            'created_at', 'updated_at',
            'bill', 'assignment', 'report', 'payments', 'evidence',
            'unread_notifications',
        ]
        read_only_fields = ['inspection_id', 'client', 'status', 'product_snapshot']

    def get_assignment(self, obj):
        active = obj.active_assignment
        if active:
            return InspectionAssignmentSerializer(active).data
        return None

    def get_unread_notifications(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        return obj.notifications.filter(user=request.user, is_read=False).count()


class InspectionRequestListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    category_path = serializers.CharField(source='category.get_full_path', read_only=True)
    client_username = serializers.CharField(source='client.username', read_only=True)
    has_report = serializers.SerializerMethodField()

    class Meta:
        model = InspectionRequest
        fields = [
            'id', 'inspection_id', 'client_username', 'item_name',
            'category_path', 'scope', 'turnaround', 'status',
            'created_at', 'has_report',
        ]

    def get_has_report(self, obj):
        return hasattr(obj, 'report')


class InspectionSummarySerializer(serializers.ModelSerializer):
    """Minimal serializer for product inspection history."""
    verdict = serializers.CharField(source='report.verdict', read_only=True)
    report_id = serializers.IntegerField(source='report.id', read_only=True)

    class Meta:
        model = InspectionRequest
        fields = ['id', 'inspection_id', 'status', 'verdict', 'report_id', 'created_at']


class ReInspectionSerializer(serializers.ModelSerializer):
    triggered_by_username = serializers.CharField(
        source='triggered_by.username', read_only=True
    )
    original_id = serializers.CharField(
        source='original_request.inspection_id', read_only=True
    )

    class Meta:
        model = ReInspection
        fields = [
            'id', 'original_request', 'original_id', 'new_request',
            'triggered_by', 'triggered_by_username', 'reason',
            'status', 'discount_applied', 'created_at',
        ]
        read_only_fields = ['triggered_by', 'status', 'new_request']


class InspectionNotificationSerializer(serializers.ModelSerializer):
    request_id = serializers.CharField(
        source='related_request.inspection_id', read_only=True
    )

    class Meta:
        model = InspectionNotification
        fields = [
            'id', 'notification_type', 'message',
            'related_request', 'request_id', 'is_read', 'created_at',
        ]


class FraudFlagSerializer(serializers.ModelSerializer):
    request_id = serializers.CharField(source='request.inspection_id', read_only=True)

    class Meta:
        model = FraudFlag
        fields = [
            'id', 'request', 'request_id', 'flag_type',
            'details', 'resolved', 'resolved_by', 'created_at',
        ]


class SLABreachSerializer(serializers.ModelSerializer):
    request_id = serializers.CharField(source='request.inspection_id', read_only=True)

    class Meta:
        model = SLABreach
        fields = ['id', 'request', 'request_id', 'phase', 'breached_at', 'escalated_to']
