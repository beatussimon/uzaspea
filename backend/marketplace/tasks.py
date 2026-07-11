from celery import shared_task
from django.utils import timezone
from datetime import timedelta

def perform_expiration_checks():
    from marketplace.models import Order, Subscription, SponsoredListing
    from marketplace.services import OrderStateMachine
    
    now = timezone.now()
    results = {}

    # 1. Expire orders sitting in AWAITING_PAYMENT for > 15 minutes
    timeout_limit = now - timedelta(minutes=15)
    expired_orders = Order.objects.filter(status='AWAITING_PAYMENT', order_date__lt=timeout_limit)
    order_count = 0
    for order in expired_orders:
        try:
            OrderStateMachine.transition_order(order, 'EXPIRED', notes="Auto-expired by system due to timeout.")
            order_count += 1
        except Exception:
            pass
    results['expired_awaiting_payment'] = order_count

    # 2. Expire CART orders sitting for > 24 hours (restoring stock)
    cart_timeout_limit = now - timedelta(hours=24)
    expired_carts = Order.objects.filter(status='CART', order_date__lt=cart_timeout_limit)
    cart_count = 0
    for order in expired_carts:
        try:
            OrderStateMachine.transition_order(order, 'CANCELLED', notes="Auto-cancelled by system due to 24-hour cart timeout.")
            cart_count += 1
        except Exception:
            pass
    results['expired_carts'] = cart_count

    # 3. Check Subscriptions
    expired_subs = Subscription.objects.filter(is_active=True, end_date__lt=now)
    user_ids = list(expired_subs.values_list('user_id', flat=True))
    sub_count = expired_subs.update(is_active=False)
    
    downgraded_count = 0
    if user_ids:
        from marketplace.models import UserProfile
        users_with_active = set(Subscription.objects.filter(
            user_id__in=user_ids, is_active=True
        ).values_list('user_id', flat=True))
        
        users_to_downgrade = [uid for uid in user_ids if uid not in users_with_active]
        if users_to_downgrade:
            downgraded_count = UserProfile.objects.filter(user_id__in=users_to_downgrade).update(
                tier='customer', is_verified=False
            )
            
    results['expired_subscriptions'] = sub_count
    results['downgraded_profiles'] = downgraded_count

    # 4. Check Sponsored Listings
    from marketplace.models import SponsoredListing
    expired_listings = SponsoredListing.objects.filter(status='approved', expires_at__lt=now)
    list_count = expired_listings.update(status='expired')
    results['expired_sponsored_listings'] = list_count

    return results

@shared_task
def check_expirations_periodic():
    """
    Periodic task that checks and expires overdue orders, carts, and subscriptions.
    Scheduled every 5 minutes via Celery Beat.
    """
    results = perform_expiration_checks()
    return f'Expiry check completed: {results}'


@shared_task
def check_saved_searches():
    """FIX B-13: notify users when new products match their saved searches."""
    from .models import SavedSearch, Product, push_notification
    from django.db.models import Q

    for ss in SavedSearch.objects.filter(notify_on_match=True).iterator(chunk_size=100):
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

    for alert in PriceAlert.objects.filter(is_active=True, triggered_at__isnull=True).select_related('product').iterator(chunk_size=100):
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
