from django.core.management.base import BaseCommand
from billing.tasks import generate_monthly_invoices

class Command(BaseCommand):
    help = 'Generates monthly invoices for the previous month'

    def handle(self, *args, **options):
        result = generate_monthly_invoices()
        self.stdout.write(self.style.SUCCESS(f'Successfully run invoice generation: {result}'))
