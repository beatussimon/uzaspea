from django.db import models
from django.conf import settings
from decimal import Decimal

class CommissionLedgerEntry(models.Model):
    class EntryType(models.TextChoices):
        COMMISSION = 'COMMISSION', 'Platform Commission'
        CANCELLATION_FEE = 'CANCELLATION_FEE', 'Cancellation Fee'
        REVERSAL = 'REVERSAL', 'Commission Reversal'

    order = models.ForeignKey('marketplace.Order', on_delete=models.PROTECT, related_name='commission_entries')
    # Seller reference for commission tracking in SokoniMax
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='commission_entries')
    order_amount = models.DecimalField(max_digits=12, decimal_places=2)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2)
    entry_type = models.CharField(max_length=30, choices=EntryType.choices, default=EntryType.COMMISSION)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.seller.username} - {self.entry_type} - {self.commission_amount}"

class MonthlyInvoice(models.Model):
    class Status(models.TextChoices):
        UNPAID = 'UNPAID', 'Unpaid'
        PENDING_REVIEW = 'PENDING_REVIEW', 'Pending Review'
        PAID = 'PAID', 'Paid'
        OVERDUE = 'OVERDUE', 'Overdue'

    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='invoices')
    year = models.IntegerField()
    month = models.IntegerField()
    total_order_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    total_commission = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    order_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UNPAID)
    due_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('seller', 'year', 'month')
        ordering = ['-year', '-month']

    def __str__(self):
        return f"{self.seller.username} Invoice - {self.year}/{self.month:02d} ({self.status})"

class CommissionPayment(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending Review'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'

    invoice = models.ForeignKey(MonthlyInvoice, on_delete=models.PROTECT, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_id = models.CharField(max_length=255)
    receipt_screenshot = models.ImageField(upload_to='commission_receipts/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    rejection_reason = models.TextField(blank=True)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='submitted_payments')
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_payments')
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.invoice.seller.username} Payment - {self.amount} ({self.status})"


def get_seller_commission_rate(seller):
    """
    Returns the Decimal commission rate (as a percentage, e.g. Decimal('6.00'))
    that should be charged to this specific seller.

    Resolution order:
      1. The seller's currently ACTIVE Subscription's tier.commission_rate,
         if they have an active subscription with a tier attached.
      2. SiteSettings.commission_rate as the platform default fallback,
         for sellers with no active paid subscription (i.e. free/customer tier).

    This must be used everywhere commission is calculated so that paid-tier
    sellers are actually charged their tier's rate instead of the global default.
    """
    from marketplace.models import Subscription, SiteSettings

    active_sub = (
        Subscription.objects
        .filter(user=seller, is_active=True, tier__isnull=False)
        .select_related('tier')
        .order_by('-start_date')
        .first()
    )
    if active_sub and active_sub.tier and active_sub.tier.commission_rate is not None:
        return active_sub.tier.commission_rate

    settings_obj = SiteSettings.get()
    return settings_obj.commission_rate
