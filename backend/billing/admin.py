from django.contrib import admin
from .models import CommissionLedgerEntry, MonthlyInvoice, CommissionPayment

@admin.register(CommissionLedgerEntry)
class CommissionLedgerEntryAdmin(admin.ModelAdmin):
    list_display = ('seller', 'order', 'commission_amount', 'entry_type', 'created_at')
    list_filter = ('entry_type', 'created_at')
    search_fields = ('seller__username', 'order__id')

@admin.register(MonthlyInvoice)
class MonthlyInvoiceAdmin(admin.ModelAdmin):
    list_display = ('seller', 'year', 'month', 'total_commission', 'status', 'due_date')
    list_filter = ('status', 'year', 'month')
    search_fields = ('seller__username',)

@admin.register(CommissionPayment)
class CommissionPaymentAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'amount', 'status', 'submitted_by', 'submitted_at')
    list_filter = ('status',)
    search_fields = ('invoice__seller__username', 'transaction_id')
