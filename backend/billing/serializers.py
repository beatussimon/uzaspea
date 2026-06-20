from rest_framework import serializers
from .models import CommissionLedgerEntry, MonthlyInvoice, CommissionPayment

class CommissionLedgerEntrySerializer(serializers.ModelSerializer):
    order_id = serializers.IntegerField(source='order.id', read_only=True)

    class Meta:
        model = CommissionLedgerEntry
        fields = ['id', 'order_id', 'order_amount', 'commission_rate', 'commission_amount', 'entry_type', 'created_at']

class MonthlyInvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = MonthlyInvoice
        fields = ['id', 'year', 'month', 'total_order_amount', 'total_commission', 'order_count', 'status', 'due_date', 'created_at']

class CommissionPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommissionPayment
        fields = ['id', 'invoice', 'amount', 'transaction_id', 'receipt_screenshot', 'status', 'rejection_reason', 'submitted_at']
        read_only_fields = ['invoice', 'status', 'rejection_reason', 'submitted_by', 'submitted_at', 'reviewed_by', 'reviewed_at']
