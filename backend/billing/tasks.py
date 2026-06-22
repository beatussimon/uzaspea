import datetime
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Count
from celery import shared_task
from django.contrib.auth import get_user_model
from billing.models import CommissionLedgerEntry, MonthlyInvoice

User = get_user_model()

@shared_task
def generate_monthly_invoices():
    today = timezone.now().date()
    first_day_current_month = today.replace(day=1)
    last_day_prev_month = first_day_current_month - datetime.timedelta(days=1)
    year = last_day_prev_month.year
    month = last_day_prev_month.month

    # Group ledger entries by seller
    entries = CommissionLedgerEntry.objects.filter(
        created_at__year=year,
        created_at__month=month
    )
    
    # We want to aggregate by seller
    seller_aggregates = entries.values('seller').annotate(
        total_order_amount=Sum('order_amount'),
        total_commission=Sum('commission_amount'),
        order_count=Count('order', distinct=True)
    )

    due_date = first_day_current_month + datetime.timedelta(days=14) # 15th of the month

    created_count = 0
    for agg in seller_aggregates:
        seller_id = agg['seller']
        try:
            seller = User.objects.get(pk=seller_id)
        except User.DoesNotExist:
            continue

        MonthlyInvoice.objects.get_or_create(
            seller=seller,
            year=year,
            month=month,
            defaults={
                'total_order_amount': agg['total_order_amount'] or Decimal('0.00'),
                'total_commission': agg['total_commission'] or Decimal('0.00'),
                'order_count': agg['order_count'] or 0,
                'status': MonthlyInvoice.Status.UNPAID,
                'due_date': due_date
            }
        )
        created_count += 1
    return f'Generated {created_count} invoices for {year}/{month:02d}'
