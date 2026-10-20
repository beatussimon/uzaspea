from django.core.management.base import BaseCommand

from marketplace.recs.builder import refresh_product_stats, build_recs


class Command(BaseCommand):
    help = "Refresh ProductStats then rebuild ProductRecs for all active products (safe to re-run)."

    def handle(self, *args, **options):
        stats = refresh_product_stats()
        recs = build_recs()
        self.stdout.write(self.style.SUCCESS(f"recs v3: stats rows={stats}, recs rows={recs}"))
