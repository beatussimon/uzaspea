from django.core.management.base import BaseCommand
from marketplace.tasks import perform_expiration_checks

class Command(BaseCommand):
    help = 'Check and expire overdue orders and subscriptions'

    def handle(self, *args, **options):
        results = perform_expiration_checks()
        self.stdout.write(self.style.SUCCESS(f"Successfully expired {results['expired_awaiting_payment']} awaiting payment orders."))
        self.stdout.write(self.style.SUCCESS(f"Successfully expired {results['expired_carts']} CART orders."))
        self.stdout.write(self.style.SUCCESS(f"Successfully expired {results['expired_subscriptions']} subscriptions."))
        self.stdout.write(self.style.SUCCESS(f"Successfully expired {results['expired_sponsored_listings']} sponsored listings."))
