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

    start_date = datetime.date(year, month, 1)
    if month == 12:
        end_date = datetime.date(year + 1, 1, 1)
    else:
        end_date = datetime.date(year, month + 1, 1)

    # 1. Update existing past-due UNPAID invoices to OVERDUE
    MonthlyInvoice.objects.filter(
        status=MonthlyInvoice.Status.UNPAID,
        due_date__lt=today
    ).update(status=MonthlyInvoice.Status.OVERDUE)

    # 2. Group ledger entries by seller for previous month
    entries = CommissionLedgerEntry.objects.filter(
        created_at__gte=start_date,
        created_at__lt=end_date
    )
    seller_aggregates = {
        agg['seller']: agg
        for agg in entries.values('seller').annotate(
            total_order_amount=Sum('order_amount'),
            total_commission=Sum('commission_amount'),
            order_count=Count('order', distinct=True)
        )
    }

    # 3. Find all candidate sellers who should receive an invoice:
    # (a) sellers who had commission ledger entries in that month
    # (b) sellers who have a Subscription (active or past) or approved SellerApplication
    from marketplace.models import Subscription, SellerApplication, SubscriptionTier

    seller_ids = set(seller_aggregates.keys())

    sub_sellers = Subscription.objects.exclude(tier__isnull=True).values_list('user_id', flat=True)
    seller_ids.update(sub_sellers)

    app_sellers = SellerApplication.objects.filter(status='approved').values_list('user_id', flat=True)
    seller_ids.update(app_sellers)

    from marketplace.models import Product
    product_sellers = Product.objects.values_list('seller_id', flat=True)
    seller_ids.update(product_sellers)

    due_date = first_day_current_month + datetime.timedelta(days=14)  # 15th of current month

    created_count = 0
    for seller_id in seller_ids:
        try:
            seller = User.objects.get(pk=seller_id)
        except User.DoesNotExist:
            continue

        agg = seller_aggregates.get(seller_id, {})
        comm_amount = agg.get('total_commission') or Decimal('0.00')
        order_amount = agg.get('total_order_amount') or Decimal('0.00')
        order_cnt = agg.get('order_count') or 0

        # Determine subscription tier fee
        sub_fee = Decimal('0.00')
        latest_sub = Subscription.objects.filter(user=seller).select_related('tier').order_by('-start_date').first()
        if latest_sub and latest_sub.tier and latest_sub.tier.price:
            sub_fee = Decimal(str(latest_sub.tier.price))
        else:
            latest_app = SellerApplication.objects.filter(user=seller, status='approved').select_related('requested_tier').first()
            if latest_app and latest_app.requested_tier and latest_app.requested_tier.price:
                sub_fee = Decimal(str(latest_app.requested_tier.price))
            elif getattr(getattr(seller, 'profile', None), 'tier', None) in ['seller_pro', 'business']:
                t = SubscriptionTier.objects.filter(tier_level=seller.profile.tier, is_active=True).first()
                if t and t.price:
                    sub_fee = Decimal(str(t.price))
            else:
                # Default to Seller Pro tier for any seller account with listings
                seller_pro_tier = SubscriptionTier.objects.filter(tier_level='seller_pro', is_active=True).first()
                if seller_pro_tier and seller_pro_tier.price:
                    sub_fee = Decimal(str(seller_pro_tier.price))
                else:
                    sub_fee = Decimal('29000.00')

        total_due = comm_amount + sub_fee

        if total_due <= Decimal('0.00'):
            continue

        invoice, created = MonthlyInvoice.objects.get_or_create(
            seller=seller,
            year=year,
            month=month,
            defaults={
                'total_order_amount': order_amount,
                'total_commission': comm_amount,
                'subscription_fee': sub_fee,
                'total_amount_due': total_due,
                'order_count': order_cnt,
                'status': MonthlyInvoice.Status.UNPAID,
                'due_date': due_date
            }
        )
        if not created and invoice.status in [MonthlyInvoice.Status.UNPAID, MonthlyInvoice.Status.OVERDUE]:
            invoice.total_order_amount = order_amount
            invoice.total_commission = comm_amount
            invoice.subscription_fee = sub_fee
            invoice.total_amount_due = total_due
            invoice.order_count = order_cnt
            invoice.save()

        created_count += 1

    return f'Generated/updated {created_count} invoices for {year}/{month:02d}'
