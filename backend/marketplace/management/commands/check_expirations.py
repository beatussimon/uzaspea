from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from marketplace.models import Order, Subscription
from marketplace.services import OrderStateMachine

class Command(BaseCommand):
    help = 'Check and expire overdue orders and subscriptions'

    def handle(self, *args, **options):
        now = timezone.now()
        
        # Expire orders sitting in AWAITING_PAYMENT for > 2 hours
        timeout_limit = now - timedelta(hours=2)
        expired_orders = Order.objects.filter(status='AWAITING_PAYMENT', order_date__lt=timeout_limit)
        
        count = 0
        for order in expired_orders:
            OrderStateMachine.transition_order(order, 'EXPIRED', notes="Auto-expired by system due to timeout.")
            count += 1
            
        self.stdout.write(self.style.SUCCESS(f'Successfully expired {count} orders.'))

        # Check Subscriptions
        expired_subs = Subscription.objects.filter(is_active=True, end_date__lt=now)
        sub_count = expired_subs.update(is_active=False)
        self.stdout.write(self.style.SUCCESS(f'Successfully expired {sub_count} subscriptions.'))
