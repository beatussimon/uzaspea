from django.db import migrations
from decimal import Decimal

def seed_default_locations_and_stock(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    UserProfile = apps.get_model('marketplace', 'UserProfile')
    StoreLocation = apps.get_model('marketplace', 'StoreLocation')
    Product = apps.get_model('marketplace', 'Product')
    ProductVariant = apps.get_model('marketplace', 'ProductVariant')
    LocationStock = apps.get_model('marketplace', 'LocationStock')
    TeamMember = apps.get_model('marketplace', 'TeamMember')

    # 1. Existing team members get all_locations_access=True by default to prevent lockout
    TeamMember.objects.update(all_locations_access=True)

    # 2. Identify all users who sell products or have seller profiles
    seller_ids = set(Product.objects.values_list('seller_id', flat=True).distinct())
    seller_profile_ids = set(UserProfile.objects.filter(tier__in=['seller_pro', 'business']).values_list('user_id', flat=True))
    all_seller_ids = seller_ids.union(seller_profile_ids)

    seller_location_map = {}

    for seller_id in all_seller_ids:
        if not seller_id:
            continue
        try:
            seller = User.objects.get(pk=seller_id)
        except User.DoesNotExist:
            continue

        loc = StoreLocation.objects.filter(owner=seller, is_main=True).first()
        if not loc:
            loc = StoreLocation.objects.filter(owner=seller).first()
        if not loc:
            profile = UserProfile.objects.filter(user=seller).first()
            addr = (profile.location if profile and profile.location else "") or "Dar es Salaam, Tanzania"
            phone = (profile.phone_number if profile and profile.phone_number else "")
            
            loc = StoreLocation.objects.create(
                owner=seller,
                name="Main Store",
                slug=f"main-store-{seller.id}",
                is_main=True,
                is_active=True,
                address_line=addr,
                phone=phone,
                city="Dar es Salaam"
            )
        seller_location_map[seller_id] = loc

    # 3. Populate LocationStock for all products and variants
    for prod in Product.objects.all():
        loc = seller_location_map.get(prod.seller_id)
        if not loc:
            loc = StoreLocation.objects.filter(owner_id=prod.seller_id, is_main=True).first()
            if not loc:
                loc = StoreLocation.objects.create(
                    owner_id=prod.seller_id,
                    name="Main Store",
                    slug=f"main-store-{prod.seller_id}",
                    is_main=True,
                    is_active=True,
                    address_line="Dar es Salaam, Tanzania",
                    city="Dar es Salaam"
                )
                seller_location_map[prod.seller_id] = loc

        variants = list(ProductVariant.objects.filter(product=prod))
        if variants:
            for v in variants:
                LocationStock.objects.get_or_create(
                    location=loc,
                    product=prod,
                    variant=v,
                    defaults={'quantity': Decimal(str(v.stock or 0))}
                )
        else:
            LocationStock.objects.get_or_create(
                location=loc,
                product=prod,
                variant=None,
                defaults={'quantity': prod.stock or Decimal('0.00')}
            )


def reverse_seed(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('marketplace', '0111_teammember_all_locations_access_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_default_locations_and_stock, reverse_seed),
    ]
