import os
import django
import datetime
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from django.conf import settings
settings.CELERY_TASK_ALWAYS_EAGER = True
settings.CELERY_TASK_PUBLISH_RETRY = False

from django.db.models.signals import post_save
from django.contrib.auth import get_user_model
from django.utils import timezone
from marketplace.models import (
    Category, Product, StoreLocation, LocationStock, 
    StockTransfer, StockTransferItem, RegisterSession, TeamMember,
    UserProfile, Subscription, SubscriptionTier, recs_on_product_saved
)

# Disconnect heavy background tasks during seeding
try:
    post_save.disconnect(recs_on_product_saved, sender=Product)
except Exception:
    pass

User = get_user_model()

def seed():
    print("=== SEEDING 2 SAMPLE BUSINESS PROFILES ===")

    # Ensure Business Subscription Tier exists
    biz_tier, _ = SubscriptionTier.objects.get_or_create(
        tier_level='business',
        defaults={
            'name': 'Business Plan',
            'price': Decimal('75000.00'),
            'duration': 365,
            'commission_rate': Decimal('5.00'),
            'is_active': True,
        }
    )

    # Categories
    laptops_cat, _ = Category.objects.get_or_create(name='Laptops & Computers', defaults={'slug': 'laptops-computers'})
    phones_cat, _ = Category.objects.get_or_create(name='Smartphones & Tablets', defaults={'slug': 'smartphones-tablets'})
    audio_cat, _ = Category.objects.get_or_create(name='Audio & Headphones', defaults={'slug': 'audio-headphones'})
    fashion_cat, _ = Category.objects.get_or_create(name='Apparel & Footwear', defaults={'slug': 'apparel-footwear'})

    # =========================================================================
    # PROFILE 1: Kilimanjaro Tech HQ (Electronics, multi-branch, POS, transfers)
    # =========================================================================
    u1, created = User.objects.get_or_create(
        username='kilimanjaro_tech',
        defaults={
            'email': 'kilimanjaro@uzaspea.com',
            'first_name': 'Rashid',
            'last_name': 'Mrema',
        }
    )
    u1.set_password('TechPass123!')
    u1.save()

    p1, _ = UserProfile.objects.get_or_create(user=u1)
    p1.tier = 'business'
    p1.terms_accepted = True
    p1.phone_number = '+255754123456'
    p1.whatsapp_number = '+255754123456'
    p1.location = 'Kariakoo, Sinza & Arusha'
    p1.bio = 'Tanzania’s premier tech store for genuine Apple MacBooks, Samsung flagships, and premium audio equipment with countrywide branch pickup.'
    p1.save()

    # Subscription
    Subscription.objects.update_or_create(
        user=u1,
        defaults={
            'tier': biz_tier,
            'is_active': True,
            'start_date': timezone.now() - datetime.timedelta(days=30),
            'end_date': timezone.now() + datetime.timedelta(days=365),
        }
    )

    # Branches for Kilimanjaro Tech
    kariakoo_loc, _ = StoreLocation.objects.update_or_create(
        owner=u1,
        name='Kariakoo Flagship Store',
        defaults={
            'is_main': True,
            'is_active': True,
            'phone': '+255754123456',
            'whatsapp': '+255754123456',
            'address_line': 'Msimbazi Street / Congo St junction',
            'city': 'Dar es Salaam',
            'district': 'Ilala',
            'latitude': Decimal('-6.818200'),
            'longitude': Decimal('39.278300'),
            'operating_hours': {
                'mon': {'open': '08:00', 'close': '18:30', 'closed': False},
                'tue': {'open': '08:00', 'close': '18:30', 'closed': False},
                'wed': {'open': '08:00', 'close': '18:30', 'closed': False},
                'thu': {'open': '08:00', 'close': '18:30', 'closed': False},
                'fri': {'open': '08:00', 'close': '18:30', 'closed': False},
                'sat': {'open': '08:30', 'close': '18:00', 'closed': False},
                'sun': {'open': '10:00', 'close': '14:00', 'closed': True},
            }
        }
    )

    sinza_loc, _ = StoreLocation.objects.update_or_create(
        owner=u1,
        name='Sinza Mori Branch',
        defaults={
            'is_main': False,
            'is_active': True,
            'phone': '+255713987654',
            'whatsapp': '+255713987654',
            'address_line': 'Shekilango Road, Opp. Mori Plaza',
            'city': 'Dar es Salaam',
            'district': 'Kinondoni',
            'latitude': Decimal('-6.782000'),
            'longitude': Decimal('39.231000'),
            'operating_hours': {
                'mon': {'open': '09:00', 'close': '20:00', 'closed': False},
                'sat': {'open': '09:00', 'close': '20:00', 'closed': False},
                'sun': {'open': '11:00', 'close': '17:00', 'closed': False},
            }
        }
    )

    arusha_loc, _ = StoreLocation.objects.update_or_create(
        owner=u1,
        name='Arusha Clock Tower Branch',
        defaults={
            'is_main': False,
            'is_active': True,
            'phone': '+255788443322',
            'whatsapp': '+255788443322',
            'address_line': 'Sokoine Road, Near Clock Tower',
            'city': 'Arusha',
            'district': 'Arusha Urban',
            'latitude': Decimal('-3.366700'),
            'longitude': Decimal('36.683300'),
            'operating_hours': {
                'mon': {'open': '08:30', 'close': '18:00', 'closed': False},
                'sat': {'open': '09:00', 'close': '16:00', 'closed': False},
            }
        }
    )

    # Products for Kilimanjaro Tech
    products_data_1 = [
        {
            'name': 'MacBook Pro 16 M3 Max (36GB / 1TB SSD)',
            'slug': 'macbook-pro-16-m3-max-space-black',
            'category': laptops_cat,
            'price': Decimal('6800000.00'),
            'description': 'Apple M3 Max chip with 14-core CPU, 30-core GPU, Liquid Retina XDR display, 36GB Unified Memory, Space Black finish. 1 Year Apple Care Warranty.',
            'stock_distribution': {
                kariakoo_loc: {'qty': 8, 'override': None},
                sinza_loc: {'qty': 4, 'override': None},
                arusha_loc: {'qty': 2, 'override': Decimal('6950000.00')}, # Freight surcharge
            }
        },
        {
            'name': 'Sony WH-1000XM5 Noise Canceling Headphones',
            'slug': 'sony-wh-1000xm5-wireless-silver',
            'category': audio_cat,
            'price': Decimal('850000.00'),
            'description': 'Industry-leading noise cancellation with two processors and 8 microphones. Up to 30-hour battery life with fast charging. Crystal clear hands-free calling.',
            'stock_distribution': {
                kariakoo_loc: {'qty': 18, 'override': None},
                sinza_loc: {'qty': 7, 'override': None},
                arusha_loc: {'qty': 5, 'override': Decimal('870000.00')},
            }
        },
        {
            'name': 'Samsung Galaxy S24 Ultra 5G (512GB Titanium)',
            'slug': 'samsung-galaxy-s24-ultra-titanium-gray',
            'category': phones_cat,
            'price': Decimal('3200000.00'),
            'description': 'Galaxy AI is here. 200MP camera with 100x Space Zoom, embedded S Pen, Snapdragon 8 Gen 3 for Galaxy, 5000mAh battery, Titanium Gray.',
            'stock_distribution': {
                kariakoo_loc: {'qty': 12, 'override': None},
                sinza_loc: {'qty': 5, 'override': None},
                arusha_loc: {'qty': 1, 'override': Decimal('3250000.00')}, # Low stock alert at Arusha
            }
        },
        {
            'name': 'Anker Prime 100W GaN 3-Port Wall Charger',
            'slug': 'anker-prime-100w-fast-charger',
            'category': laptops_cat,
            'price': Decimal('120000.00'),
            'description': 'Ultra-compact high-speed charger powered by GaNPrime technology. Charges 3 devices simultaneously: 2x USB-C and 1x USB-A.',
            'stock_distribution': {
                kariakoo_loc: {'qty': 35, 'override': None},
                sinza_loc: {'qty': 12, 'override': None},
                arusha_loc: {'qty': 0, 'override': None}, # Out of stock at Arusha
            }
        }
    ]

    for p_info in products_data_1:
        prod, _ = Product.objects.update_or_create(
            seller=u1,
            slug=p_info['slug'],
            defaults={
                'name': p_info['name'],
                'category': p_info['category'],
                'price': p_info['price'],
                'description': p_info['description'],
                'is_available': True,
                'is_draft': False,
            }
        )
        total_stock = 0
        for loc, stock_meta in p_info['stock_distribution'].items():
            LocationStock.objects.update_or_create(
                location=loc,
                product=prod,
                variant=None,
                defaults={
                    'quantity': Decimal(str(stock_meta['qty'])),
                    'price_override': stock_meta['override']
                }
            )
            total_stock += stock_meta['qty']
        prod.stock = total_stock
        prod.save(update_fields=['stock'])

    # Inter-Branch Stock Transfers for Kilimanjaro Tech
    # 1. In-Transit: Kariakoo -> Arusha (Replenishing 10x Anker chargers)
    anker_prod = Product.objects.get(seller=u1, slug='anker-prime-100w-fast-charger')
    sony_prod = Product.objects.get(seller=u1, slug='sony-wh-1000xm5-wireless-silver')

    trf1, _ = StockTransfer.objects.update_or_create(
        tracking_number='TRF-ARU-2026-001',
        defaults={
            'owner': u1,
            'source_location': kariakoo_loc,
            'destination_location': arusha_loc,
            'status': 'in_transit',
            'notes': 'Urgent inventory dispatch: Restocking Anker chargers for Arusha tech hub.',
            'dispatched_by': u1,
            'dispatched_at': timezone.now() - datetime.timedelta(hours=14),
        }
    )
    StockTransferItem.objects.update_or_create(
        transfer=trf1,
        product=anker_prod,
        defaults={'quantity_dispatched': Decimal('10.00'), 'notes': 'Fresh batch from Kariakoo warehouse'}
    )

    # 2. Completed: Kariakoo -> Sinza (5x Sony Headphones received)
    trf2, _ = StockTransfer.objects.update_or_create(
        tracking_number='TRF-SNZ-2026-002',
        defaults={
            'owner': u1,
            'source_location': kariakoo_loc,
            'destination_location': sinza_loc,
            'status': 'completed',
            'notes': 'Weekly stock rotation received at Sinza Mori store.',
            'dispatched_by': u1,
            'dispatched_at': timezone.now() - datetime.timedelta(days=2),
            'received_by': u1,
            'received_at': timezone.now() - datetime.timedelta(days=1),
        }
    )
    StockTransferItem.objects.update_or_create(
        transfer=trf2,
        product=sony_prod,
        defaults={
            'quantity_dispatched': Decimal('5.00'),
            'quantity_received': Decimal('5.00'),
            'notes': 'All 5 units in perfect sealed condition'
        }
    )

    # Open Register Session at Kariakoo POS
    RegisterSession.objects.filter(location=kariakoo_loc, status='open').update(status='closed')
    RegisterSession.objects.create(
        location=kariakoo_loc,
        opened_by=u1,
        opening_float=Decimal('200000.00'),
        status='open',
        notes='Morning shift started by store manager.'
    )

    # Team Members for Kilimanjaro Tech
    # Cashier 1: Sinza restricted
    cashier_user, _ = User.objects.get_or_create(
        username='sinza_cashier',
        defaults={'email': 'sinzacashier@uzaspea.com', 'first_name': 'Neema', 'last_name': 'Kavishe'}
    )
    cashier_user.set_password('CashierPass123!')
    cashier_user.save()
    p_c, _ = UserProfile.objects.get_or_create(user=cashier_user)
    p_c.tier = 'worker'
    p_c.terms_accepted = True
    p_c.save()

    tm1, _ = TeamMember.objects.update_or_create(
        owner=u1,
        user=cashier_user,
        defaults={
            'role_preset': 'cashier',
            'invitation_status': 'accepted',
            'is_active': True,
            'all_locations_access': False,
            'permissions': {'manage_orders': True, 'pos_access': True, 'view_analytics': False, 'manage_products': False}
        }
    )
    tm1.assigned_locations.set([sinza_loc])

    print(f"Created Profile 1: {u1.username} (Password: TechPass123!)")
    print(f"  - 3 Branches: Kariakoo (HQ), Sinza Mori, Arusha Clock Tower")
    print(f"  - 4 Products with live cross-branch stock & price overrides")
    print(f"  - 2 Transfers (1 In-Transit, 1 Completed)")
    print(f"  - 1 Scoped Cashier: sinza_cashier (Password: CashierPass123!)")

    # =========================================================================
    # PROFILE 2: Serengeti Luxury Apparel (Fashion, multi-branch, Click & Collect)
    # =========================================================================
    u2, created2 = User.objects.get_or_create(
        username='serengeti_apparel',
        defaults={
            'email': 'serengeti@uzaspea.com',
            'first_name': 'Zawadi',
            'last_name': 'Moloo',
        }
    )
    u2.set_password('SafariPass123!')
    u2.save()

    p2, _ = UserProfile.objects.get_or_create(user=u2)
    p2.tier = 'business'
    p2.terms_accepted = True
    p2.phone_number = '+255655778899'
    p2.whatsapp_number = '+255655778899'
    p2.location = 'Masaki & Mwanza'
    p2.bio = 'Timeless luxury safari apparel, linen wear, and bespoke handcrafted leather goods inspired by the Serengeti.'
    p2.save()

    Subscription.objects.update_or_create(
        user=u2,
        defaults={
            'tier': biz_tier,
            'is_active': True,
            'start_date': timezone.now() - datetime.timedelta(days=20),
            'end_date': timezone.now() + datetime.timedelta(days=365),
        }
    )

    masaki_loc, _ = StoreLocation.objects.update_or_create(
        owner=u2,
        name='Masaki Slipway Flagship',
        defaults={
            'is_main': True,
            'is_active': True,
            'phone': '+255655778899',
            'whatsapp': '+255655778899',
            'address_line': 'Slipway Waterfront, Ground Floor Boutique #4',
            'city': 'Dar es Salaam',
            'district': 'Kinondoni',
            'latitude': Decimal('-6.753300'),
            'longitude': Decimal('39.278900'),
            'operating_hours': {
                'mon': {'open': '09:30', 'close': '21:00', 'closed': False},
                'sat': {'open': '09:30', 'close': '21:00', 'closed': False},
                'sun': {'open': '10:00', 'close': '19:00', 'closed': False},
            }
        }
    )

    mwanza_loc, _ = StoreLocation.objects.update_or_create(
        owner=u2,
        name='Mwanza Rock City Mall Branch',
        defaults={
            'is_main': False,
            'is_active': True,
            'phone': '+255655112233',
            'whatsapp': '+255655112233',
            'address_line': 'Rock City Mall, Wing B - Store 12',
            'city': 'Mwanza',
            'district': 'Nyamagana',
            'latitude': Decimal('-2.516700'),
            'longitude': Decimal('32.900000'),
            'operating_hours': {
                'mon': {'open': '09:00', 'close': '20:00', 'closed': False},
                'sat': {'open': '09:00', 'close': '20:00', 'closed': False},
            }
        }
    )

    # Products for Serengeti Apparel
    products_data_2 = [
        {
            'name': 'Serengeti Signature Safari Utility Jacket',
            'slug': 'serengeti-safari-jacket-khaki',
            'category': fashion_cat,
            'price': Decimal('280000.00'),
            'description': 'Constructed from heavy-duty breathable 100% African cotton twill with brass hardware, deep cargo pockets, and adjustable waist cinch.',
            'stock_distribution': {
                masaki_loc: {'qty': 25, 'override': None},
                mwanza_loc: {'qty': 10, 'override': Decimal('290000.00')},
            }
        },
        {
            'name': 'Handcrafted Full-Grain Leather Driving Loafers',
            'slug': 'handcrafted-leather-driving-loafers',
            'category': fashion_cat,
            'price': Decimal('420000.00'),
            'description': 'Meticulously crafted from vegetable-tanned full-grain cowhide with rubberized pebble grip sole and memory-foam cushioned footbed.',
            'stock_distribution': {
                masaki_loc: {'qty': 14, 'override': None},
                mwanza_loc: {'qty': 6, 'override': Decimal('430000.00')},
            }
        }
    ]

    for p_info in products_data_2:
        prod, _ = Product.objects.update_or_create(
            seller=u2,
            slug=p_info['slug'],
            defaults={
                'name': p_info['name'],
                'category': p_info['category'],
                'price': p_info['price'],
                'description': p_info['description'],
                'is_available': True,
                'is_draft': False,
            }
        )
        total_stock = 0
        for loc, stock_meta in p_info['stock_distribution'].items():
            LocationStock.objects.update_or_create(
                location=loc,
                product=prod,
                variant=None,
                defaults={
                    'quantity': Decimal(str(stock_meta['qty'])),
                    'price_override': stock_meta['override']
                }
            )
            total_stock += stock_meta['qty']
        prod.stock = total_stock
        prod.save(update_fields=['stock'])

    print(f"Created Profile 2: {u2.username} (Password: SafariPass123!)")
    print(f"  - 2 Branches: Masaki Slipway (HQ), Mwanza Rock City Mall")
    print(f"  - 2 Luxury Apparel Products with multi-branch stock")
    print("=== SEEDING COMPLETED SUCCESSFULLY ===")

if __name__ == '__main__':
    seed()
