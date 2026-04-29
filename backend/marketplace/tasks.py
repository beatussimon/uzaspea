
from celery import shared_task
from django.core.management import call_command
from django.utils import timezone


@shared_task
def check_expirations_periodic():
    """
    Periodic task that runs the check_expirations management command.
    Scheduled every 30 minutes via Celery Beat.
    """
    call_command('check_expirations')
    return f'Expiry check completed at {timezone.now()}'


@shared_task
def check_saved_searches():
    """FIX B-13: notify users when new products match their saved searches."""
    from .models import SavedSearch, Product, push_notification
    from django.db.models import Q

    for ss in SavedSearch.objects.filter(notify_on_match=True):
        qs = Product.objects.filter(is_available=True, created_at__gt=ss.last_checked)
        if ss.query:
            qs = qs.filter(name__icontains=ss.query)
        if ss.category_id:
            qs = qs.filter(category=ss.category)
        if ss.min_price:
            qs = qs.filter(price__gte=ss.min_price)
        if ss.max_price:
            qs = qs.filter(price__lte=ss.max_price)
        if ss.condition:
            qs = qs.filter(condition=ss.condition)
        count = qs.count()
        if count > 0:
            push_notification(
                ss.user, 'order_status',
                f'{count} new product{"s" if count > 1 else ""} match your search "{ss.query or "Saved Search"}"',
                'Check out the latest matches',
                f'/?q={ss.query}&category={ss.category_id or ""}'
            )
        ss.last_checked = timezone.now()
        ss.save(update_fields=['last_checked'])


@shared_task
def check_price_alerts():
    """FIX B-13: notify users when product price drops to their target."""
    from .models import PriceAlert, push_notification

    for alert in PriceAlert.objects.filter(is_active=True, triggered_at__isnull=True):
        if alert.product.price <= alert.target_price:
            push_notification(
                alert.user, 'order_status',
                f'Price dropped! {alert.product.name}',
                f'Now TSh {alert.product.price:,.0f} — your target was TSh {alert.target_price:,.0f}',
                f'/product/{alert.product.slug}'
            )
            alert.triggered_at = timezone.now()
            alert.is_active = False
            alert.save(update_fields=['triggered_at', 'is_active'])
