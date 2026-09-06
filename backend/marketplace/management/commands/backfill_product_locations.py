from django.core.management.base import BaseCommand
from marketplace.models import Product, UserProfile
from marketplace.location_utils import resolve_location_coords

class Command(BaseCommand):
    help = "Backfill location_name, latitude, and longitude for products and seller profiles lacking them."

    def handle(self, *args, **options):
        # 1. Backfill UserProfiles
        profiles_to_update = UserProfile.objects.filter(latitude__isnull=True)
        profile_count = 0
        for p in profiles_to_update:
            loc = p.location or "Dar es Salaam, Tanzania"
            coords = resolve_location_coords(loc)
            p.latitude = coords[0]
            p.longitude = coords[1]
            if not p.location:
                p.location = loc
            p.save(update_fields=['latitude', 'longitude', 'location'])
            profile_count += 1
        self.stdout.write(self.style.SUCCESS(f"Updated {profile_count} user profiles with coordinates."))

        # 2. Backfill Products
        products_to_update = Product.objects.filter(latitude__isnull=True)
        prod_count = 0
        for prod in products_to_update:
            seller_prof = getattr(prod.seller, 'profile', None) if prod.seller_id else None
            loc = prod.location_name or (seller_prof.location if seller_prof and seller_prof.location else "Dar es Salaam, Tanzania")
            if seller_prof and seller_prof.latitude is not None and seller_prof.longitude is not None:
                prod.latitude = seller_prof.latitude
                prod.longitude = seller_prof.longitude
            else:
                coords = resolve_location_coords(loc)
                prod.latitude = coords[0]
                prod.longitude = coords[1]
            if not prod.location_name:
                prod.location_name = loc
            prod.save(update_fields=['latitude', 'longitude', 'location_name'])
            prod_count += 1
        self.stdout.write(self.style.SUCCESS(f"Updated {prod_count} products with accurate location coordinates."))
