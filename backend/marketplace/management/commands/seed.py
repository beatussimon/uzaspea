"""
backend/marketplace/management/commands/seed.py

Full platform seed: marketplace categories, site settings,
plus expands inspection categories and checklists for all missing types.

Usage:
    python manage.py seed                  # full seed (idempotent — safe to re-run)
    python manage.py seed --admin-only     # only create admin user
    python manage.py seed --skip-admin     # skip admin user creation

IMPORTANT: Never run this in a way that wipes existing data.
           All get_or_create calls are intentional — this is additive only.
"""
import os
import secrets
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction


class Command(BaseCommand):
    help = 'Seed marketplace categories, site settings, and inspection data (idempotent)'

    def add_arguments(self, parser):
        parser.add_argument('--admin-only', action='store_true', help='Only create admin user')
        parser.add_argument('--skip-admin', action='store_true', help='Skip admin user creation')

    # ─────────────────────────────────────────
    # INSPECTION HELPER
    # ─────────────────────────────────────────

    def create_checklist(self, category, items):
        """
        items: list of (label, item_type, is_mandatory, fail_triggers_flag, unit, help_text)
        item_type: 'pass_fail' | 'scale' | 'measurement' | 'text' | 'media'
        """
        from inspections.models import ChecklistTemplate, ChecklistItem
        template, _ = ChecklistTemplate.objects.get_or_create(
            category=category, version=1,
            defaults={'is_active': True}
        )
        for idx, (label, ctype, mandatory, fail_flag, unit, help_text) in enumerate(items):
            ChecklistItem.objects.get_or_create(
                template=template, label=label,
                defaults={
                    'item_type': ctype,
                    'is_mandatory': mandatory,
                    'order': idx,
                    'fail_triggers_flag': fail_flag,
                    'unit': unit,
                    'help_text': help_text,
                }
            )
        return template

    # ─────────────────────────────────────────
    # MAIN HANDLE
    # ─────────────────────────────────────────

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('\n━━━ SOKONIMAX DATABASE SEED ━━━\n'))

        # ── ADMIN USER ──────────────────────────────────────────────────────
        if not options.get('skip_admin'):
            admin = User.objects.filter(username='admin').first()
            if not admin:
                password = os.environ.get('SEED_ADMIN_PASSWORD') or secrets.token_urlsafe(16)
                User.objects.create_superuser('admin', 'admin@sokonimax.co.tz', password)
                self.stdout.write(self.style.SUCCESS(f'  ✓ Admin user created'))
                if not os.environ.get('SEED_ADMIN_PASSWORD'):
                    self.stdout.write(self.style.WARNING(
                        f'\n  ⚠  Admin password: {password}'
                        f'\n  ⚠  Save this now — it will not be shown again.\n'
                    ))
            else:
                self.stdout.write(f'  · Admin user already exists — skipping')

        if options.get('admin_only'):
            self.stdout.write(self.style.SUCCESS('\nDone (admin only).\n'))
            return

        # ── MARKETPLACE CATEGORIES ───────────────────────────────────────────
        self.stdout.write('\n── Marketplace Categories ──')
        self._seed_marketplace_categories()

        # ── SITE SETTINGS ────────────────────────────────────────────────────
        self.stdout.write('\n── Site Settings ──')
        self._seed_site_settings()

        # ── SUBSCRIPTION TIERS ───────────────────────────────────────────────
        self._seed_subscription_tiers()

        # ── WAREHOUSES ───────────────────────────────────────────────────────
        self._seed_warehouses()

        # ── DELIVERY OPTIONS ──────────────────────────────────────────────────
        self._seed_delivery_options()

        # ── INSPECTION CATEGORIES & CHECKLISTS ──────────────────────────────
        self.stdout.write('\n── Inspection Categories & Checklists ──')
        self._seed_inspections()

        self.stdout.write(self.style.SUCCESS('\n━━━ SEED COMPLETE ━━━\n'))

    # ─────────────────────────────────────────
    # MARKETPLACE CATEGORIES
    # ─────────────────────────────────────────

    def _seed_marketplace_categories(self):
        from marketplace.models import Category

        categories = [
            # (name, slug, parent_slug, description)
            ('Vehicles', 'vehicles', None, 'Cars, motorcycles, trucks and all motorized vehicles'),
            ('Cars & SUVs', 'cars-suvs', 'vehicles', 'Sedans, hatchbacks, SUVs and crossovers'),
            ('Motorcycles & Boda Boda', 'motorcycles', 'vehicles', 'Motorcycles and bodaboda for sale'),
            ('Trucks & Commercial Vehicles', 'trucks', 'vehicles', 'Trucks, minibuses, tuk-tuks and commercial transport'),
            ('Spare Parts & Accessories', 'spare-parts', 'vehicles', 'Vehicle parts, tyres, oils and accessories'),

            ('Electronics', 'electronics', None, 'Phones, laptops, TVs and electronic devices'),
            ('Smartphones & Tablets', 'smartphones', 'electronics', 'Mobile phones and tablet computers'),
            ('Laptops & Computers', 'laptops', 'electronics', 'Laptops, desktop PCs and peripherals'),
            ('TVs & Audio', 'tvs-audio', 'electronics', 'Televisions, speakers, home theater systems'),
            ('Cameras & Photography', 'cameras', 'electronics', 'Digital cameras, drones and accessories'),
            ('Gaming', 'gaming', 'electronics', 'Consoles, games and gaming accessories'),

            ('Property', 'property', None, 'Land, houses and commercial property'),
            ('Houses & Apartments', 'houses', 'property', 'Residential property for sale'),
            ('Land & Plots', 'land', 'property', 'Plots and land for sale'),
            ('Commercial Property', 'commercial-property', 'property', 'Offices, shops and industrial property'),

            ('Fashion & Clothing', 'fashion', None, 'Clothes, shoes and fashion accessories'),
            ("Men's Clothing", 'mens-clothing', 'fashion', "Men's fashion and clothing"),
            ("Women's Clothing", 'womens-clothing', 'fashion', "Women's fashion and clothing"),
            ('Shoes & Footwear', 'shoes', 'fashion', 'All types of footwear'),
            ('Bags & Luggage', 'bags', 'fashion', 'Handbags, backpacks and luggage'),
            ('Watches & Jewellery', 'watches-jewellery', 'fashion', 'Watches, rings, necklaces and accessories'),

            ('Home & Garden', 'home-garden', None, 'Furniture, appliances and home décor'),
            ('Furniture', 'furniture', 'home-garden', 'Beds, sofas, tables and all furniture'),
            ('Kitchen & Appliances', 'kitchen-appliances', 'home-garden', 'Fridges, cookers, washing machines'),
            ('Home Décor', 'home-decor', 'home-garden', 'Curtains, rugs, art and decoration'),
            ('Garden & Outdoor', 'garden', 'home-garden', 'Garden tools, plants and outdoor equipment'),

            ('Agriculture', 'agriculture', None, 'Farming equipment, livestock and produce'),
            ('Farm Machinery', 'farm-machinery', 'agriculture', 'Tractors, ploughs and farm equipment'),
            ('Livestock & Poultry', 'livestock', 'agriculture', 'Cattle, goats, chickens and livestock'),
            ('Seeds & Fertilizers', 'seeds-fertilizers', 'agriculture', 'Seeds, fertilizers and crop inputs'),
            ('Irrigation Equipment', 'irrigation', 'agriculture', 'Pumps, drip kits and irrigation systems'),

            ('Machinery & Tools', 'machinery', None, 'Industrial machinery and professional tools'),
            ('Generators & Power', 'generators', 'machinery', 'Generators, solar systems and backup power'),
            ('Construction Equipment', 'construction-equipment', 'machinery', 'Mixers, compactors, scaffolding'),
            ('Power Tools', 'power-tools', 'machinery', 'Drills, saws, grinders and power tools'),
            ('Hand Tools', 'hand-tools', 'machinery', 'Spanners, hammers, and manual tools'),

            ('Sports & Fitness', 'sports', None, 'Sports equipment and fitness gear'),
            ('Fitness Equipment', 'fitness', 'sports', 'Gym equipment, weights and exercise machines'),
            ('Outdoor & Adventure', 'outdoor', 'sports', 'Camping, hiking and adventure gear'),
            ('Team Sports', 'team-sports', 'sports', 'Football, basketball and team sport equipment'),

            ('Baby & Kids', 'baby-kids', None, "Children's products and toys"),
            ('Baby Gear', 'baby-gear', 'baby-kids', 'Prams, cots, car seats and baby essentials'),
            ('Toys & Games', 'toys', 'baby-kids', 'Toys, board games and educational materials'),
            ("Children's Clothing", 'kids-clothing', 'baby-kids', "Boys' and girls' clothing"),

            ('Books, Music & Movies', 'books-media', None, 'Books, CDs, DVDs and educational materials'),
            ('Books & Textbooks', 'books', 'books-media', 'Fiction, non-fiction and academic textbooks'),
            ('Music & Instruments', 'music', 'books-media', 'Instruments, recording equipment and music'),

            ('Services', 'services', None, 'Professional and personal services'),
            ('Repair & Maintenance', 'repair', 'services', 'Electronics repair, plumbing and maintenance'),
            ('Tutoring & Education', 'tutoring', 'services', 'Private tuition and educational services'),
            ('Business Services', 'business-services', 'services', 'Accounting, legal and business services'),

            ('Other', 'other', None, 'Items that do not fit other categories'),
        ]

        created = 0
        slug_to_obj = {}

        # Build a name→obj map of existing first
        for cat in Category.objects.all():
            slug_to_obj[cat.slug] = cat

        for name, slug, parent_slug, description in categories:
            parent = slug_to_obj.get(parent_slug) if parent_slug else None
            obj, was_created = Category.objects.get_or_create(
                slug=slug,
                defaults={'name': name, 'parent': parent, 'description': description}
            )
            slug_to_obj[slug] = obj
            if was_created:
                created += 1

        self.stdout.write(self.style.SUCCESS(f'  ✓ {created} new marketplace categories created ({len(categories)} total defined)'))

    # ─────────────────────────────────────────
    # SITE SETTINGS
    # ─────────────────────────────────────────

    def _seed_site_settings(self):
        from marketplace.models import SiteSettings
        from decimal import Decimal
        obj, created = SiteSettings.objects.get_or_create(
            pk=1,
            defaults={
                'company_name': 'SokoniMax',
                'tagline': 'Tanzania\'s Trusted Marketplace',
                'support_email': 'support@sokonimax.co.tz',
                'support_phone': '+255 700 000 000',
                'address': 'Dar es Salaam, Tanzania',
                'commission_rate': Decimal('10.00'),
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS('  ✓ Site settings created'))
        else:
            self.stdout.write('  · Site settings already exist — skipping')

    def _seed_subscription_tiers(self):
        from marketplace.models import SubscriptionTier
        from decimal import Decimal
        self.stdout.write('\n── Subscription Tiers ──')
        tiers = [
            {'name': 'Customer', 'tier_level': 'customer', 'price': Decimal('0.00'),
             'duration': 36500, 'benefits': 'Buy, inspect, track orders, message sellers',
             'commission_rate': Decimal('0.00')},
            {'name': 'Seller Pro', 'tier_level': 'seller_pro', 'price': Decimal('29000.00'),
             'duration': 30, 'benefits': 'Create listings, manage inventory, seller dashboard',
             'commission_rate': Decimal('10.00')},
            {'name': 'Business', 'tier_level': 'business', 'price': Decimal('79000.00'),
             'duration': 30, 'benefits': 'Everything in Seller Pro + team management + advanced analytics',
             'commission_rate': Decimal('10.00')},
        ]
        for t in tiers:
            obj, created = SubscriptionTier.objects.update_or_create(
                name=t['name'], defaults=t
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  ✓ Subscription tier {obj.name} created'))
            else:
                self.stdout.write(f'  · Subscription tier {obj.name} updated')

    def _seed_warehouses(self):
        try:
            from warehouses.models import Warehouse
            from decimal import Decimal
            self.stdout.write('\n── Warehouses ──')
            warehouses = [
                {'name': 'SokoniMax Dar es Salaam Hub', 'code': 'DAR-01',
                 'region': 'Dar es Salaam', 'address': 'Kariakoo, Dar es Salaam',
                 'latitude': Decimal('-6.8161'), 'longitude': Decimal('39.2803')},
                {'name': 'SokoniMax Mwanza Hub', 'code': 'MWZ-01',
                 'region': 'Mwanza', 'address': 'Mwanza City Centre, Mwanza',
                 'latitude': Decimal('-2.5167'), 'longitude': Decimal('32.9000')},
            ]
            for w in warehouses:
                obj, created = Warehouse.objects.update_or_create(code=w['code'], defaults=w)
                if created:
                    self.stdout.write(self.style.SUCCESS(f'  ✓ Warehouse {obj.name} created'))
                else:
                    self.stdout.write(f'  · Warehouse {obj.name} updated')
        except ImportError:
            pass

    def _seed_delivery_options(self):
        try:
            from logistics.models import DeliveryOption
            self.stdout.write('\n── Delivery Options ──')
            options = [
                {'name': 'Economy', 'code': 'economy', 'base_price': '3000', 'per_km_rate': '30', 'per_kg_rate': '200'},
                {'name': 'Standard', 'code': 'standard', 'base_price': '5000', 'per_km_rate': '60', 'per_kg_rate': '300'},
                {'name': 'Express', 'code': 'express', 'base_price': '9000', 'per_km_rate': '100', 'per_kg_rate': '500'},
                {'name': 'Urgent', 'code': 'urgent', 'base_price': '15000', 'per_km_rate': '200', 'per_kg_rate': '800'},
            ]
            for opt in options:
                obj, created = DeliveryOption.objects.get_or_create(code=opt['code'], defaults={**opt, 'is_active': True})
                if created:
                    self.stdout.write(self.style.SUCCESS(f'  ✓ Delivery option {obj.name} created'))
                else:
                    self.stdout.write(f'  · Delivery option {obj.name} already exists')
        except ImportError:
            pass

    # ─────────────────────────────────────────
    # INSPECTION CATEGORIES & CHECKLISTS
    # ─────────────────────────────────────────

    def _seed_inspections(self):
        from inspections.models import InspectionCategory
        from marketplace.models import Category as MarketCategory

        def cat(name, parent=None, level='category', base_price=50000, inspector_level='junior', marketplace_slug=None):
            mkt_cat = None
            if marketplace_slug:
                mkt_cat = MarketCategory.objects.filter(slug=marketplace_slug).first()
            
            obj, created = InspectionCategory.objects.get_or_create(
                name=name,
                defaults={
                    'level': level,
                    'parent': parent,
                    'base_price': base_price,
                    'required_inspector_level': inspector_level,
                    'is_active': True,
                    'marketplace_category': mkt_cat,
                }
            )
            if not created and mkt_cat and not obj.marketplace_category:
                obj.marketplace_category = mkt_cat
                obj.save()
            if created:
                self.stdout.write(f'  + {obj.get_full_path()}')
            return obj

        # ── DOMAINS ──────────────────────────────────────────────────────
        vehicles    = cat('Vehicles',             level='domain', base_price=0, marketplace_slug='vehicles')
        electronics = cat('Electronics',          level='domain', base_price=0, marketplace_slug='electronics')
        prop        = cat('Property',              level='domain', base_price=0, marketplace_slug='property')
        machinery   = cat('Machinery & Tools',     level='domain', base_price=0, marketplace_slug='machinery')
        agri_dom    = cat('Agriculture',           level='domain', base_price=0, marketplace_slug='agriculture')
        fashion_dom = cat('Fashion & Clothing',    level='domain', base_price=0, marketplace_slug='fashion')
        home_garden = cat('Home & Garden',         level='domain', base_price=0, marketplace_slug='home-garden')
        sports_dom  = cat('Sports & Fitness',      level='domain', base_price=0, marketplace_slug='sports')
        baby_kids   = cat('Baby & Kids',           level='domain', base_price=0, marketplace_slug='baby-kids')
        books_media = cat('Books, Music & Movies', level='domain', base_price=0, marketplace_slug='books-media')
        services    = cat('Services',              level='domain', base_price=0, marketplace_slug='services')
        other_dom   = cat('Other Categories',      level='domain', base_price=0, marketplace_slug='other')

        # ── VEHICLE SUBCATEGORIES ────────────────────────────────────────
        cars         = cat('Cars & SUVs',               vehicles,  base_price=60000,  inspector_level='senior',     marketplace_slug='cars-suvs')
        motorcycles  = cat('Motorcycles & Boda Boda',   vehicles,  base_price=35000,  inspector_level='junior',     marketplace_slug='motorcycles')
        trucks       = cat('Trucks & Commercial',        vehicles,  base_price=90000,  inspector_level='specialist', marketplace_slug='trucks')
        spare_parts  = cat('Vehicle Spare Parts',        vehicles,  base_price=20000,  inspector_level='junior',     marketplace_slug='spare-parts')

        # ── ELECTRONICS SUBCATEGORIES ────────────────────────────────────
        phones       = cat('Smartphones & Tablets',      electronics, base_price=25000, inspector_level='junior',     marketplace_slug='smartphones')
        laptops      = cat('Laptops & Computers',        electronics, base_price=35000, inspector_level='senior',     marketplace_slug='laptops')
        tv_audio     = cat('TVs & Audio Equipment',      electronics, base_price=20000, inspector_level='junior',     marketplace_slug='tvs-audio')
        cameras      = cat('Cameras & Photography',      electronics, base_price=25000, inspector_level='junior',     marketplace_slug='cameras')
        gaming       = cat('Gaming & Consoles',          electronics, base_price=25000, inspector_level='junior',     marketplace_slug='gaming')

        # ── PROPERTY SUBCATEGORIES ────────────────────────────────────────
        residential  = cat('Residential Property', prop, base_price=150000, inspector_level='specialist', marketplace_slug='houses')
        commercial   = cat('Commercial Property',  prop, base_price=200000, inspector_level='specialist', marketplace_slug='commercial-property')
        land         = cat('Land & Plots',         prop, base_price=80000,  inspector_level='senior',     marketplace_slug='land')

        # ── MACHINERY SUBCATEGORIES ───────────────────────────────────────
        generators   = cat('Generators & Power',       machinery, base_price=50000, inspector_level='senior',     marketplace_slug='generators')
        construction = cat('Construction Equipment',    machinery, base_price=70000, inspector_level='senior',     marketplace_slug='construction-equipment')
        power_tools  = cat('Power Tools',              machinery, base_price=25000, inspector_level='junior',     marketplace_slug='power-tools')
        hand_tools   = cat('Hand Tools',               machinery, base_price=15000, inspector_level='junior',     marketplace_slug='hand-tools')

        # ── AGRICULTURE SUBCATEGORIES ─────────────────────────────────────
        farm_mach    = cat('Farm Machinery',            agri_dom, base_price=80000, inspector_level='specialist', marketplace_slug='farm-machinery')
        livestock    = cat('Livestock & Poultry',       agri_dom, base_price=40000, inspector_level='senior',     marketplace_slug='livestock')
        seeds_fert   = cat('Seeds & Fertilizers',       agri_dom, base_price=15000, inspector_level='junior',     marketplace_slug='seeds-fertilizers')
        irrigation   = cat('Irrigation Equipment',      agri_dom, base_price=30000, inspector_level='junior',     marketplace_slug='irrigation')

        # ── FASHION SUBCATEGORIES ─────────────────────────────────────────
        mens_clothing = cat("Men's Clothing",   fashion_dom, base_price=10000, inspector_level='junior', marketplace_slug='mens-clothing')
        womens_clothing = cat("Women's Clothing", fashion_dom, base_price=10000, inspector_level='junior', marketplace_slug='womens-clothing')
        shoes         = cat('Shoes & Footwear',  fashion_dom, base_price=15000, inspector_level='junior', marketplace_slug='shoes')
        bags          = cat('Bags & Luggage',    fashion_dom, base_price=15000, inspector_level='junior', marketplace_slug='bags')
        watches_jw    = cat('Watches & Jewellery', fashion_dom, base_price=25000, inspector_level='senior', marketplace_slug='watches-jewellery')

        # ── HOME & GARDEN SUBCATEGORIES ───────────────────────────────────
        furniture     = cat('Furniture',           home_garden, base_price=30000, inspector_level='junior', marketplace_slug='furniture')
        kitchen_app   = cat('Kitchen & Appliances', home_garden, base_price=25000, inspector_level='junior', marketplace_slug='kitchen-appliances')
        home_decor    = cat('Home Décor',          home_garden, base_price=15000, inspector_level='junior', marketplace_slug='home-decor')
        garden        = cat('Garden & Outdoor',    home_garden, base_price=15000, inspector_level='junior', marketplace_slug='garden')

        # ── SPORTS SUBCATEGORIES ──────────────────────────────────────────
        fitness       = cat('Fitness Equipment',    sports_dom, base_price=25000, inspector_level='junior', marketplace_slug='fitness')
        outdoor       = cat('Outdoor & Adventure',  sports_dom, base_price=20000, inspector_level='junior', marketplace_slug='outdoor')
        team_sports   = cat('Team Sports Equipment', sports_dom, base_price=15000, inspector_level='junior', marketplace_slug='team-sports')

        # ── BABY & KIDS SUBCATEGORIES ─────────────────────────────────────
        baby_gear     = cat('Baby Gear',            baby_kids, base_price=20000, inspector_level='junior', marketplace_slug='baby-gear')
        toys          = cat('Toys & Games',         baby_kids, base_price=15000, inspector_level='junior', marketplace_slug='toys')
        kids_clothing = cat("Children's Clothing",  baby_kids, base_price=10000, inspector_level='junior', marketplace_slug='kids-clothing')

        # ── BOOKS & MEDIA SUBCATEGORIES ───────────────────────────────────
        books         = cat('Books & Textbooks',    books_media, base_price=10000, inspector_level='junior', marketplace_slug='books')
        music         = cat('Music & Instruments',  books_media, base_price=25000, inspector_level='senior', marketplace_slug='music')

        # ── SERVICES SUBCATEGORIES ────────────────────────────────────────
        repair        = cat('Repair & Maintenance', services, base_price=20000, inspector_level='junior', marketplace_slug='repair')
        tutoring      = cat('Tutoring & Education', services, base_price=15000, inspector_level='junior', marketplace_slug='tutoring')
        bus_services  = cat('Business Services',    services, base_price=30000, inspector_level='senior', marketplace_slug='business-services')

        # ── OTHER SUBCATEGORIES ───────────────────────────────────────────
        other         = cat('Other Items',          other_dom, base_price=15000, inspector_level='junior', marketplace_slug='other')

        # ══════════════════════════════════════════════════════════════════
        # CHECKLIST SEEDING
        # ══════════════════════════════════════════════════════════════════

        # ── VEHICLES ──
        self._checklist_cars(cars)
        self._checklist_motorcycles(motorcycles)
        self._checklist_trucks(trucks)
        self._checklist_spare_parts(spare_parts)

        # ── ELECTRONICS ──
        self._checklist_phones(phones)
        self._checklist_laptops(laptops)
        self._checklist_tv_audio(tv_audio)
        self._checklist_cameras(cameras)
        
        # Gaming
        self.create_checklist(gaming, [
            ('Console & Controller Button Response', 'scale', True, True, '', 'Check all buttons, triggers, and analog sticks for stick drift or stickiness'),
            ('Optical Drive / Disc Reading', 'pass_fail', False, False, '', 'Verify if console reads physical game discs or Blu-rays successfully'),
            ('HDMI & USB Ports Physical Condition', 'pass_fail', True, True, '', 'Check for bent pins, looseness, or burnt smells in ports'),
            ('Fan Noise & Overheating Assessment', 'scale', True, True, '', 'Run console for 10 minutes — check for excessive fan noise or heat shutdown'),
        ])

        # ── PROPERTY ──
        self._checklist_residential(residential)
        self._checklist_commercial(commercial)
        self._checklist_land(land)

        # ── MACHINERY ──
        self._checklist_generators(generators)
        self._checklist_construction(construction)
        self._checklist_power_tools(power_tools)
        
        # Hand Tools
        self.create_checklist(hand_tools, [
            ('Handle Grip & Safety Condition', 'scale', True, False, '', 'Check rubber grips, welds and overall handle integrity'),
            ('Metal Corrosion & Wear Assessment', 'scale', True, True, '', 'Check for structural rust, cracks or deformation on working edges'),
            ('Joint / Moving Parts Operation', 'pass_fail', True, False, '', 'For pliers, adjustables, clamps — verify smooth movement and no locking'),
        ])

        # ── AGRICULTURE ──
        self._checklist_farm_machinery(farm_mach)
        self._checklist_livestock(livestock)
        
        # Seeds & Fertilizers
        self.create_checklist(seeds_fert, [
            ('Packaging & Seal Integrity', 'pass_fail', True, True, '', 'Verify bags are factory sealed, dry and free of tears/infestation'),
            ('Expiry Date & Batch Number Code', 'pass_fail', True, True, '', 'Must show clear expiry date and batch information'),
            ('Government Certification Stamps', 'pass_fail', True, True, '', 'Verify TOSCI/TFDA stamp or other agricultural certification'),
        ])
        
        # Irrigation
        self.create_checklist(irrigation, [
            ('Pump Operation & Engine Compression', 'pass_fail', True, True, '', 'Start pump engine/motor — check for smooth start, fuel leaks, correct sound'),
            ('Hoses, Pipes, & Connectors Leak Check', 'pass_fail', True, True, '', 'Connect and pressurize system — inspect all joints and pipes for water leaks'),
            ('Valves & Pressure Gauge Readings', 'scale', True, False, '', 'Ensure pressure gauges operate and control valves adjust flow correctly'),
        ])

        # ── FASHION ──
        clothing_items = [
            ('Stitching Quality & Seam Integrity', 'scale', True, False, '', 'Inspect seams under tension — check for loose threads or unraveling'),
            ('Zippers, Buttons & Fasteners Function', 'pass_fail', True, True, '', 'Slide all zippers up/down and test all buttons/press studs'),
            ('Fabric Condition (Tears, Stains, Holes)', 'scale', True, True, '', 'Check front, back, interior for holes, discoloration, or heavy wear'),
            ('Brand Tag & Care Label Presence', 'pass_fail', False, False, '', 'Check label presence and care instructions readability'),
        ]
        self.create_checklist(mens_clothing, clothing_items)
        self.create_checklist(womens_clothing, clothing_items)
        self.create_checklist(kids_clothing, clothing_items)
        
        # Shoes
        self.create_checklist(shoes, [
            ('Sole Wear & Tread Depth', 'scale', True, True, '', 'Inspect shoe soles for tread wear, cracks, or loose glue lines'),
            ('Upper Material Condition (Scuffs, Tears)', 'scale', True, True, '', 'Inspect leather/fabric for scuffs, cracks, holes, or staining'),
            ('Insole & Interior Lining Condition', 'scale', True, False, '', 'Check inside for wear, tearing, or hygiene issues'),
            ('Authenticity & Quality Hallmarks', 'pass_fail', True, True, '', 'For branded shoes — verify labels, logo stitching, box labels, and serials'),
        ])
        
        # Bags
        self.create_checklist(bags, [
            ('Handle & Strap Attachment Strength', 'scale', True, True, '', 'Pull test on handles/straps — check stitching and metal loop condition'),
            ('Zippers & Lock Mechanisms Operation', 'pass_fail', True, True, '', 'Test all zip openings and buckle locks'),
            ('Interior Lining & Pockets Condition', 'scale', True, False, '', 'Inspect interior for tears, stains, or damage'),
            ('Authenticity Verification', 'pass_fail', True, True, '', 'Verify tags, brand engraving, alignment of logos and stitch patterns'),
        ])
        
        # Watches & Jewellery
        self.create_checklist(watches_jw, [
            ('Movement Accuracy & Battery Condition', 'pass_fail', True, True, '', 'Verify watch keeps time correctly. If automatic, test rotor swing'),
            ('Case, Bezel, and Crystal Scratch Check', 'scale', True, True, '', 'Check glass face for cracks/scratches, check case/bracelet finish'),
            ('Crown & Dial Adjustments Function', 'pass_fail', True, True, '', 'Pull crown and test setting time/date, chronograph buttons'),
            ('Authenticity Hallmarks & Material Purity', 'pass_fail', True, True, '', 'Verify stamps (e.g. 925, 18K), model serial number, and paperwork'),
        ])

        # ── HOME & GARDEN ──
        # Furniture
        self.create_checklist(furniture, [
            ('Joint Stability & Weld Strength', 'scale', True, True, '', 'Check for wobbling, loose joints, or weak welds under load'),
            ('Surface Finish, Paint, & Veneer Condition', 'scale', True, False, '', 'Check for scratches, chips, missing veneer, or water damage'),
            ('Upholstery Upholstery Wear & Staining', 'scale', True, True, '', 'For sofas/chairs — inspect fabric/leather for rips, stains, or sagging'),
            ('Drawers, Hinges, & Doors Alignment', 'pass_fail', False, False, '', 'Open and close all drawers/doors to verify correct alignment and slide'),
        ])
        
        # Kitchen Appliances
        self.create_checklist(kitchen_app, [
            ('Heating / Cooling Temp Benchmarks', 'pass_fail', True, True, '', 'Verify appliance reaches correct operational temperature (fridge, oven, kettle)'),
            ('Electrical Cord, Plug & Grounding safety', 'pass_fail', True, True, '', 'Inspect power cord for fraying, check plug grounding pin'),
            ('Door Gaskets & Seals Condition', 'scale', True, False, '', 'Inspect door rubber seals to ensure proper closing and seal'),
            ('Controls, Knobs, & Displays Function', 'pass_fail', True, False, '', 'Verify all button options, knobs, and digital displays function correctly'),
        ])
        
        # Home Decor
        self.create_checklist(home_decor, [
            ('Physical Integrity (No Cracks, Chips)', 'scale', True, True, '', 'Verify item is structurally whole with no damage'),
            ('Finish & Paint Aesthetics Quality', 'scale', True, False, '', 'Inspect surface aesthetics, colors, paint and textures'),
        ])
        
        # Garden
        self.create_checklist(garden, [
            ('Structure & Mechanical Components Integrity', 'scale', True, False, '', 'Check handles, wheels, or moving mechanical joints'),
            ('Rust, Corrosion, & Environmental Wear', 'scale', True, True, '', 'Check steel/iron parts for rust and UV damage on plastics'),
        ])

        # ── SPORTS ──
        # Fitness
        self.create_checklist(fitness, [
            ('Frame Stability & Weld Integrity', 'scale', True, True, '', 'Inspect structural frame and bolts under load for movement or cracking'),
            ('Cables, Pulleys, and Belts Tension', 'scale', True, True, '', 'Check tension, fraying on cables, belt cracking, and smooth operation'),
            ('Electronic Monitor & Screen Operation', 'pass_fail', False, False, '', 'Verify console boots, buttons work, and sensor feedback functions'),
        ])
        
        # Outdoor
        self.create_checklist(outdoor, [
            ('Zipper & Fabric Water Resistance', 'scale', True, True, '', 'Check zippers and seams on tents/sleeping bags. Inspect fabric condition'),
            ('Poles, Buckles & Strap Strength', 'scale', True, False, '', 'Check poles for bends, check all straps and plastic buckle clips'),
        ])
        
        # Team Sports
        self.create_checklist(team_sports, [
            ('Pressure Retention & Physical Form', 'pass_fail', True, True, '', 'Check for pressure leaks in balls. Verify safety shields/guards structural form'),
            ('Nets, Posts & Protective Mesh Condition', 'scale', True, False, '', 'Inspect netting or posts for fraying or structural stability'),
        ])

        # ── BABY & KIDS ──
        # Baby Gear
        self.create_checklist(baby_gear, [
            ('Harness & Buckle Safety System', 'pass_fail', True, True, '', 'Test child lock buckle and ensure straps lock securely'),
            ('Folding Mechanism & Brake Locks', 'pass_fail', True, True, '', 'Ensure stroller/cot folds cleanly and brakes lock wheels perfectly'),
            ('Fabric Cleanliness & Frame Strength', 'scale', True, True, '', 'Check for stains, check frames under structural load'),
        ])
        
        # Toys
        self.create_checklist(toys, [
            ('Choking Hazards & Sharp Edges Inspection', 'pass_fail', True, True, '', 'Verify no sharp edges or loose small components suitable for swallowing'),
            ('Battery Compartment Safety & Function', 'pass_fail', False, False, '', 'Verify battery cover locks securely. Test clean contacts and battery runtime'),
        ])

        # ── BOOKS & MEDIA ──
        # Books
        self.create_checklist(books, [
            ('Spine & Page Binding Integrity', 'scale', True, True, '', 'Verify pages are not falling out and the spine is secure'),
            ('Completeness Check (No Missing Pages)', 'pass_fail', True, True, '', 'Verify page sequence — no torn or missing pages'),
            ('Markings, Highlighting & Cover Wear', 'scale', True, False, '', 'Check for notations, stains, or creasing on covers'),
        ])
        
        # Music
        self.create_checklist(music, [
            ('Neck Alignment & Tuning Stability', 'scale', True, True, '', 'For stringed instruments — check neck straightness and tuners hold pitch'),
            ('Pickups, Knobs & Input Jack Function', 'pass_fail', False, False, '', 'Connect to amplifier — check volume, tone pots, and jack connection noise'),
            ('Keys, Valves & Pad Action Response', 'scale', True, False, '', 'Ensure key/valve movement is smooth with no sticking or air leaks'),
        ])

        # ── SERVICES ──
        # Repair
        self.create_checklist(repair, [
            ('Company Permits & Technician Credentials', 'pass_fail', True, True, '', 'Verify business permit and technician licenses/certifications'),
            ('Service Warranty & Scope Agreement', 'text', True, False, '', 'Verify service contract terms and length of repair warranty'),
            ('Equipment and Tools Professional Standard', 'scale', True, False, '', 'Evaluate diagnostic gear and tools used by service team'),
        ])
        # Tutoring
        self.create_checklist(tutoring, [
            ('Educational Qualifications Verification', 'pass_fail', True, True, '', 'Verify academic degrees, transcripts and tutoring licenses'),
            ('Syllabus & Course Delivery Plan', 'text', True, False, '', 'Verify tutoring schedule and curriculum alignment'),
        ])
        # Business Services
        self.create_checklist(bus_services, [
            ('Professional Registration & Certifications', 'pass_fail', True, True, '', 'Verify professional body membership (CPAs, Bar association etc.)'),
            ('Service Level Agreement (SLA) Review', 'text', True, True, '', 'Check standard deliverables and timelines listed in the contract'),
        ])

        # ── OTHER ──
        # Other
        self.create_checklist(other, [
            ('General Physical Condition & Form', 'scale', True, True, '', 'Inspect physical shape, finish, and structural condition'),
            ('Basic Functionality Check', 'pass_fail', True, True, '', 'Verify if item performs its primary function successfully'),
            ('Packaging & Manuals Presence', 'scale', False, False, '', 'Check if original boxes, manuals, and accessories are present'),
        ])

        self.stdout.write(self.style.SUCCESS('  ✓ Inspection categories and checklists complete'))

    # ══════════════════════════════════════════════════════════════════════
    # CHECKLIST DEFINITIONS
    # ══════════════════════════════════════════════════════════════════════

    def _checklist_cars(self, category):
        self.create_checklist(category, [
            # Engine & Drivetrain
            ('Engine Start & Idle Quality', 'pass_fail', True, True, '', 'Cold start and warm idle — listen for knocking, misfires, rough idle'),
            ('Engine Oil Level & Condition', 'pass_fail', True, True, '', 'Check dipstick — color, level, milky appearance indicates water ingress'),
            ('Coolant Level & Condition', 'pass_fail', True, True, '', 'Check reservoir and radiator cap — rust or oil contamination'),
            ('Transmission Shift Quality (All Gears)', 'scale', True, True, '', 'Test all gears including reverse — slipping, grinding, delays'),
            ('Clutch Engagement Point (Manual)', 'pass_fail', False, False, '', 'High biting point indicates wear'),
            ('Engine Oil Leaks (Visual)', 'pass_fail', True, True, '', 'Check under hood and beneath car for oil drips or seeping gaskets'),
            ('Timing Belt/Chain Service History', 'pass_fail', True, True, '', 'Typically replaced at 80,000–100,000 km'),
            ('Exhaust Smoke Color & Odor', 'pass_fail', True, True, '', 'Blue=oil burn, White=coolant burn, Black=rich mixture — all fail triggers'),
            ('Power Steering Fluid Level', 'pass_fail', True, False, '', 'Low level may indicate leak'),
            ('Drive Shaft & CV Joints', 'pass_fail', True, True, '', 'Turn steering full lock and accelerate — clicking indicates CV joint failure'),
            ('Fuel System Integrity (No Leaks)', 'pass_fail', True, True, '', 'Check for fuel smell, leaks at injectors and fuel lines'),
            ('Engine Compression Test', 'measurement', False, True, 'PSI', 'Deviation >10% between cylinders is fail trigger'),
            # Body & Exterior
            ('Paintwork Condition & Color Match', 'scale', True, False, '', 'Respray indicates accident repair — use paint thickness gauge if available'),
            ('Panel Gaps & Alignment', 'scale', True, True, '', 'Uneven gaps indicate accident damage or poor repair'),
            ('Rust & Corrosion Assessment', 'scale', True, True, '', 'Check wheel arches, sills, floor, chassis — structural rust is fail'),
            ('Glass & Windscreen Condition', 'pass_fail', True, False, '', 'Any crack in driver sight line requires replacement'),
            ('Doors, Boot & Bonnet Operation', 'pass_fail', True, False, '', 'All should open, close and latch smoothly'),
            ('VIN/Chassis Number Verification', 'pass_fail', True, True, '', 'Match chassis plate, windscreen sticker and registration — mismatch is fraud flag'),
            ('Undercarriage Rust & Damage', 'pass_fail', True, True, '', 'Check chassis rails, floor pan, crossmembers'),
            ('Airbag System Warning Light', 'pass_fail', True, True, '', 'SRS light off after startup — if on, system is compromised'),
            ('Headlights, Taillights & Indicators', 'pass_fail', True, False, '', 'All lights operational including hazards and reversing lights'),
            ('Wiper Blades & Washer System', 'pass_fail', False, False, '', 'Wiper sweep quality and washer jet aim'),
            # Suspension & Brakes
            ('Front Shock Absorbers', 'scale', True, True, '', 'Bounce test — should settle within 1–2 oscillations. Leaking = fail'),
            ('Rear Shock Absorbers', 'scale', True, True, '', 'Same bounce test — note any side-to-side difference'),
            ('Brake Pad Thickness Front', 'measurement', True, True, 'mm', 'Minimum 3mm — below 2mm immediate fail'),
            ('Brake Pad Thickness Rear', 'measurement', True, True, 'mm', 'Check via caliper inspection'),
            ('Brake Disc Condition', 'scale', True, True, '', 'Check for scoring, warping, minimum thickness marking'),
            ('Handbrake Effectiveness', 'pass_fail', True, True, '', 'Should hold on gradient — optimal 3–5 ratchet clicks'),
            ('ABS System Warning Light', 'pass_fail', True, False, '', 'ABS light off after engine start'),
            ('Steering Play & Alignment', 'measurement', True, True, 'degrees', 'Excessive free play indicates worn rack or ball joints'),
            ('Wheel Bearing Condition', 'pass_fail', True, True, '', 'Jack each corner — wobble = bearing play, grinding = worn bearing'),
            ('Tyre Tread Depth All Four', 'measurement', True, True, 'mm', 'Legal minimum 1.6mm — check inside, center, outside'),
            # Interior & Electrics
            ('Air Conditioning Cooling Temperature', 'measurement', True, False, '°C', 'Should reach 10–15°C on full cold'),
            ('All Power Windows Operation', 'pass_fail', True, False, '', 'Test up/down smoothness on all windows'),
            ('Infotainment, Bluetooth & USB', 'pass_fail', False, False, '', 'Connect phone via Bluetooth and USB — test audio output'),
            ('Instrument Cluster All Gauges', 'pass_fail', True, True, '', 'Fuel, temperature, speedometer — all should function'),
            ('Seat Belts All Positions', 'pass_fail', True, True, '', 'Test latch, retraction, inertia lock on all seats'),
            ('Central Locking & Key Fob', 'pass_fail', False, False, '', 'All doors lock/unlock remotely and manually'),
            ('Interior Condition & Odor', 'scale', True, False, '', 'Check for mold, smoke, water damage odors under floor mats'),
            ('Odometer Reading & Service History', 'text', True, True, '', 'Record exact reading — request full service book'),
            # Documentation
            ('Registration Certificate (Log Book)', 'pass_fail', True, True, '', 'Verify owner name matches seller — request title transfer docs'),
            ('Insurance Certificate Validity', 'pass_fail', True, False, '', 'Note expiry date'),
            ('Road Worthiness Certificate (SUMATRA)', 'pass_fail', True, True, '', 'Valid certificate required'),
            ('Outstanding Finance Check', 'text', True, True, '', 'Confirm no outstanding bank finance — request clearance letter'),
            ('Accident History Disclosure', 'text', True, True, '', 'Cross-check seller declaration with bodywork findings'),
        ])

    def _checklist_motorcycles(self, category):
        self.create_checklist(category, [
            # Engine
            ('Engine Start & Idle', 'pass_fail', True, True, '', 'Cold and warm start — listen for knocking, misfires'),
            ('Engine Oil Level & Condition', 'pass_fail', True, True, '', 'Check sight glass or dipstick — dark/thick oil = neglected service'),
            ('Oil Leaks (Around Engine Cases)', 'pass_fail', True, True, '', 'Check gaskets, drain plug, oil filter — any drip is fail'),
            ('Chain Condition & Tension', 'pass_fail', True, True, '', 'Should have 20–30mm of slack — dry/rusted chain = fail'),
            ('Sprocket Wear (Front & Rear)', 'scale', True, True, '', 'Shark-fin tooth profile indicates severe wear — replace with chain'),
            ('Clutch Cable & Lever', 'pass_fail', True, False, '', 'Smooth engagement, not frayed, correct free play'),
            ('Throttle Response & Cable', 'pass_fail', True, True, '', 'Snap throttle — should return immediately. Sticky throttle = fail'),
            ('Gear Change Quality All Gears', 'scale', True, True, '', 'Smooth positive changes — missed neutrals or false neutrals are fail'),
            ('Exhaust Condition & Smoke', 'pass_fail', True, False, '', 'No excessive smoke — check for cracks, rust in headers'),
            # Frame & Bodywork
            ('Frame Condition (Cracks/Welds)', 'pass_fail', True, True, '', 'Inspect welds around head tube and swing arm pivot — cracks are safety fail'),
            ('Straight Frame Check', 'pass_fail', True, True, '', 'View from front and rear — twisted frame indicates crash damage'),
            ('Fairing & Plastic Condition', 'scale', False, False, '', 'Note cracks or missing pieces — indicates drop history'),
            ('Seat Condition', 'scale', False, False, '', 'Torn seat exposes foam to water'),
            ('Fuel Tank Condition (No Rust)', 'pass_fail', True, True, '', 'Shake and listen — internal rust causes fuel system blockage'),
            # Suspension & Brakes
            ('Front Forks Condition', 'pass_fail', True, True, '', 'Compress forks — should rebound smoothly. Oil seals on stanchions = fail'),
            ('Rear Shock Absorber', 'pass_fail', True, True, '', 'Bounce rear — leaking shock or excessive play is fail'),
            ('Front Brake (Disc/Drum)', 'pass_fail', True, True, '', 'Test at walking speed — should bite positively with no pull'),
            ('Rear Brake Operation', 'pass_fail', True, True, '', 'Foot pedal or hand lever — check pad thickness'),
            ('Tyre Tread Front', 'measurement', True, True, 'mm', 'Minimum 1.6mm — check center and edges'),
            ('Tyre Tread Rear', 'measurement', True, True, 'mm', 'Rear wears faster — check center groove depth'),
            ('Wheel Rim Condition (No Cracks/Bends)', 'pass_fail', True, True, '', 'Spin each wheel — any wobble or flat spot indicates bent rim'),
            ('Bearings (Headstock & Wheel)', 'pass_fail', True, True, '', 'Lift front wheel and turn handlebars — notchiness = worn headstock bearings'),
            # Electrics & Documentation
            ('Battery Condition & Charging', 'pass_fail', True, False, '', 'Start with no kick — battery should hold charge'),
            ('All Lights & Horn', 'pass_fail', True, False, '', 'Headlight, taillight, indicators, horn — all must work'),
            ('Instrument Panel & Speedometer', 'pass_fail', True, False, '', 'Speedometer accuracy, fuel gauge, warning lights'),
            ('Engine Number & Frame Number Match', 'pass_fail', True, True, '', 'Both must match registration documents — mismatch = fraud flag'),
            ('Registration & Licence Disc', 'pass_fail', True, True, '', 'Valid and matching documents'),
            ('Service History & Mileage', 'text', True, False, '', 'Record odometer reading and any service records'),
        ])

    def _checklist_trucks(self, category):
        self.create_checklist(category, [
            # Engine & Drivetrain
            ('Engine Start Cold & Warm', 'pass_fail', True, True, '', 'Cold start including glow plug pre-heat for diesel — listen for knock'),
            ('Engine Oil Level, Color & Leaks', 'pass_fail', True, True, '', 'Check level and condition — black sludge indicates neglect'),
            ('Coolant System (Level & No Leaks)', 'pass_fail', True, True, '', 'Check hoses, radiator, expansion tank — overheating history is fail'),
            ('Turbocharger Function & Boost', 'pass_fail', False, True, '', 'Listen for turbo whine or surge — blue smoke under boost = seal failure'),
            ('Gearbox All Ratios (Including Hi/Lo)', 'scale', True, True, '', 'Test all gears including high/low range if 4WD'),
            ('Differential Lock Operation', 'pass_fail', False, False, '', 'Test engagement and disengagement of diff lock'),
            ('PTO (Power Take-Off) if Applicable', 'pass_fail', False, False, '', 'Test PTO engagement — relevant for agricultural/tipper trucks'),
            ('Fuel System (Tanks, Lines, Injectors)', 'pass_fail', True, True, '', 'No leaks, correct fuel type, injector smoke check'),
            ('Air Filter & Intake Condition', 'scale', True, False, '', 'Clogged air filter causes black smoke and power loss'),
            ('Exhaust System & DPF/Emissions', 'pass_fail', True, False, '', 'Check for leaks, excessive smoke — emissions compliance'),
            # Chassis & Body
            ('Chassis Rail Condition (Rust/Cracks)', 'pass_fail', True, True, '', 'Most critical structural check — cracks near crossmember welds are fail'),
            ('Body/Tipping Body Condition', 'scale', True, False, '', 'Check for corrosion, cracks, hinge condition'),
            ('Cab Condition & Rust', 'scale', True, False, '', 'Check floor, sills, door pillars — structural rust in cab is fail'),
            ('Fifth Wheel / Coupling (if Applicable)', 'pass_fail', False, True, '', 'Check jaw wear, locking mechanism — worn fifth wheel is safety fail'),
            ('Tow Hitch & Electrics (if Applicable)', 'pass_fail', False, False, '', 'Test trailer electrical connection — all lights through to trailer'),
            # Suspension & Brakes
            ('Leaf Spring Condition (All Axles)', 'pass_fail', True, True, '', 'Broken or cracked leaves are immediate fail — check U-bolts'),
            ('Shock Absorbers (All Axles)', 'scale', True, True, '', 'Bounce test on all corners — leaking shocks are fail'),
            ('Air Brake System (if Applicable)', 'pass_fail', False, True, '', 'Build to cutout pressure, drain tanks — test service and park brakes'),
            ('Hydraulic Brake System', 'pass_fail', True, True, '', 'Firm pedal, even braking, no pull'),
            ('Brake Drum/Disc Condition', 'scale', True, True, '', 'Check wear, cracking, scoring on all axles'),
            ('Tyre Condition All Axles', 'measurement', True, True, 'mm', 'Minimum 1.6mm all positions — check for illegal regrooves'),
            ('Steering Play & Geometry', 'measurement', True, True, 'degrees', 'Excessive play in steering wheel is safety fail'),
            ('Wheel Hub & Bearing Condition', 'pass_fail', True, True, '', 'Check for play, heat after drive, grease condition'),
            # Electrics & Cab
            ('Battery & Charging System', 'pass_fail', True, False, '', 'Check battery voltage and alternator output under load'),
            ('All Lights (Including Clearance & Marker)', 'pass_fail', True, True, '', 'All required lights functional — commercial vehicles have stricter requirements'),
            ('Tachograph (if Applicable)', 'pass_fail', False, True, '', 'Calibration date — required for commercial operators'),
            ('Air Conditioning (Cab)', 'pass_fail', False, False, '', 'Driver comfort — check refrigerant and blower operation'),
            # Load & Documentation
            ('Payload Capacity vs Actual Use', 'text', True, False, 'kg', 'Verify rated payload — check for overloading wear on springs'),
            ('Fleet Number & Ownership Documents', 'text', True, True, '', 'Check registration, ownership, fleet markings match'),
            ('SUMATRA Fitness Certificate', 'pass_fail', True, True, '', 'Valid commercial vehicle fitness certificate'),
            ('Outstanding Traffic Fines Check', 'text', True, True, '', 'Request clearance from traffic authority — fines transfer to new owner'),
            ('Weighbridge Records (if Available)', 'text', False, False, '', 'Overloading history affects chassis life significantly'),
            ('Accident History & Structural Repairs', 'text', True, True, '', 'Check for welded chassis repairs — structural modification is fail trigger'),
            ('Service History & Engine Hours', 'text', True, False, '', 'Record odometer and request full service records'),
            ('Finance & Encumbrances Clearance', 'text', True, True, '', 'Confirm no outstanding finance, court orders, or seizure notices'),
        ])

    def _checklist_phones(self, category):
        self.create_checklist(category, [
            ('Screen Burn-In / Ghost Images', 'pass_fail', True, True, '', 'Display all-gray and all-white — ghost images indicate OLED burn'),
            ('Dead Pixels & Bright Spots', 'pass_fail', True, True, '', 'Display black screen — any lit pixels are defects'),
            ('Touch Sensitivity All Screen Zones', 'pass_fail', True, True, '', 'Draw diagonal lines across all screen edges — dead zones indicate damage'),
            ('Screen Glass Condition', 'scale', True, False, '', 'Check under bright light at angles — hairline cracks affect resale severely'),
            ('Display Brightness Max & Auto', 'measurement', True, False, 'nits', 'Max brightness should match device spec'),
            ('Face ID / Fingerprint Reader', 'pass_fail', False, False, '', 'Failures may indicate motherboard or sensor damage'),
            ('Battery Health Percentage', 'measurement', True, True, '%', 'iOS: Settings > Battery Health. Android: AccuBattery — below 80% is replacement threshold'),
            ('Charge Port Condition & Function', 'pass_fail', True, True, '', 'Inspect for bent pins — test charging with known-good cable'),
            ('Wireless Charging Function', 'pass_fail', False, False, '', 'Confirms charging coil intact'),
            ('Battery Swelling Visual Check', 'pass_fail', True, True, '', 'Screen lifting from body = swollen battery — immediate safety fail'),
            ('Charge Cycle Count', 'measurement', False, False, 'cycles', 'Record from system info'),
            ('Rear Camera Photo Quality', 'scale', True, False, '', 'Photograph text and distant objects — check autofocus and clarity'),
            ('Front Camera Quality', 'scale', True, False, '', 'Check sharpness and exposure'),
            ('Video Recording & Stabilization', 'pass_fail', False, False, '', 'Record 30 seconds — check audio sync and stabilization'),
            ('Camera Lens Condition No Cracks', 'pass_fail', True, True, '', 'Cracked lens causes haze in photos'),
            ('SIM Slots & Network Reception', 'pass_fail', True, True, '', 'Insert test SIM — verify signal and voice call quality'),
            ('Wi-Fi Connection & Speed', 'pass_fail', True, False, '', 'Connect to 5GHz — run speed test'),
            ('Bluetooth Pairing', 'pass_fail', True, False, '', 'Pair with headphones — test audio quality'),
            ('GPS Accuracy', 'pass_fail', False, False, '', 'Open maps outdoors — verify location within 10m'),
            ('NFC Function', 'pass_fail', False, False, '', 'Test with NFC tag or payment terminal'),
            ('IMEI Verification', 'text', True, True, '', 'Dial *#06# — record both IMEIs. Check blacklist on GSMA or local registry'),
            ('Speakers & Earpiece Quality', 'pass_fail', True, False, '', 'Play music at max volume — check for distortion'),
            ('Microphone Voice Quality', 'pass_fail', True, False, '', 'Record voice memo — check clarity and noise cancellation'),
            ('Vibration Motor', 'pass_fail', False, False, '', 'Enable haptic feedback — test intensity and consistency'),
            ('Physical Buttons All', 'pass_fail', True, False, '', 'Volume, power, mute — ensure tactile response'),
            ('OS Version & Update Support', 'text', True, False, '', 'Note OS version — is device still receiving security updates?'),
            ('iCloud/Google Account Lock Status', 'pass_fail', True, True, '', 'Factory reset must proceed without account prompt — activation lock = fraud flag'),
            ('Water Damage Indicator', 'pass_fail', True, True, '', 'Check SIM slot — red/pink indicator = water damage'),
        ])

    def _checklist_laptops(self, category):
        self.create_checklist(category, [
            ('Display Dead Pixels & Backlight Bleed', 'pass_fail', True, True, '', 'Display solid colors — check corners for backlight bleed'),
            ('Screen Hinge Condition', 'scale', True, False, '', 'Open/close — should hold position at all angles without wobble'),
            ('Keyboard All Keys Function', 'pass_fail', True, False, '', 'Use keyboard test website — check every key including Fn combos'),
            ('Trackpad Click & Gesture', 'pass_fail', True, False, '', 'Test click, right-click, two-finger scroll, pinch-to-zoom'),
            ('Battery Cycle Count & Health', 'measurement', True, True, 'cycles', 'powercfg /batteryreport (Win) or System Info > Power (Mac)'),
            ('RAM Amount & Type', 'text', True, False, 'GB', 'Verify installed RAM matches advertised spec'),
            ('Storage Drive SMART Health', 'pass_fail', True, True, '', 'CrystalDiskInfo (Win) or DiskScan (Mac) — any SMART warnings = fail'),
            ('Storage Capacity & Type SSD/HDD', 'text', True, False, 'GB', 'Verify actual storage matches spec'),
            ('Processor Benchmark Score', 'measurement', False, False, 'score', 'Cinebench or PassMark — compare to known good score'),
            ('GPU Function if Dedicated', 'pass_fail', False, False, '', 'Stress test with GPU-Z — check temperatures and artifacts'),
            ('USB Ports All Types', 'pass_fail', True, False, '', 'Test each USB port with USB 3.0 drive — verify speed'),
            ('HDMI/DisplayPort Output', 'pass_fail', False, False, '', 'Connect external monitor — verify signal and resolution'),
            ('Wi-Fi & Bluetooth', 'pass_fail', True, False, '', 'Connect to 5GHz and 2.4GHz — run speed test'),
            ('Webcam & Microphone', 'pass_fail', True, False, '', 'Test video call quality — check autofocus and audio clarity'),
            ('Speakers & Headphone Jack', 'pass_fail', True, False, '', 'Play audio — check distortion at volume. Test 3.5mm jack'),
            ('Cooling Temperature Under Load', 'measurement', True, True, '°C', 'Stress test 5 min — should not exceed 95°C. Throttling = fail'),
            ('Chassis Condition Cracks & Warping', 'scale', True, False, '', 'Check lid, base, palm rest — cracks near hinge indicate drop damage'),
            ('Serial Number & Theft Check', 'text', True, True, '', 'Record serial — check against theft registry'),
            ('Operating System & License', 'text', True, False, '', 'Note OS version and whether license is genuine and transferable'),
            ('Charger & Cable Condition', 'pass_fail', False, False, '', 'Check for fraying, correct wattage, charging speed'),
            ('Battery Runtime Test', 'measurement', True, False, 'hours', 'Discharge from 100% at normal load — note time to 20%'),
            ('Fan Noise & Vibration', 'scale', True, False, '', 'Excessive fan noise at idle indicates failing fan or degraded paste'),
        ])

    def _checklist_tv_audio(self, category):
        self.create_checklist(category, [
            # Display
            ('Screen Dead Pixels & Uniformity', 'pass_fail', True, True, '', 'Display solid white, red, green, blue, black — any dead pixels are fail'),
            ('Backlight Uniformity (No Clouding)', 'scale', True, False, '', 'Display dark gray in dim room — clouding/flashlighting reduces viewing quality'),
            ('Panel Type (LED/OLED/QLED)', 'text', True, False, '', 'Record panel type — OLED risk of burn-in if used as monitor'),
            ('Screen Resolution Verification', 'pass_fail', True, False, '', 'Confirm resolution matches spec — 4K content test if claimed'),
            ('Brightness & Contrast (HDR if Applicable)', 'measurement', True, False, 'nits', 'Measure peak brightness — compare to manufacturer spec'),
            ('Screen Physical Condition', 'pass_fail', True, True, '', 'Inspect panel surface for cracks, pressure marks, scratches'),
            # Inputs & Connectivity
            ('All HDMI Ports Function', 'pass_fail', True, True, '', 'Test each HDMI port with source device — verify signal and ARC/eARC'),
            ('USB Ports Function', 'pass_fail', True, False, '', 'Test media playback from USB — verify supported formats'),
            ('Audio Output (Optical/ARC)', 'pass_fail', False, False, '', 'Connect soundbar or receiver — test signal output'),
            ('Built-In Wi-Fi & Smart Platform', 'pass_fail', True, False, '', 'Connect to network — test streaming app launch speed and stability'),
            ('Bluetooth Audio Pairing', 'pass_fail', False, False, '', 'Pair wireless headphones — test audio sync'),
            ('Remote Control Function All Buttons', 'pass_fail', True, False, '', 'Test all remote buttons including smart/voice buttons'),
            # Audio
            ('Internal Speakers Audio Quality', 'scale', True, False, '', 'Play music and speech at various volumes — check for distortion'),
            ('Bass & Treble Balance', 'scale', False, False, '', 'Note if speakers produce adequate low frequency'),
            # General
            ('Smart TV App Store & Updates', 'pass_fail', False, False, '', 'Confirm OS can still receive updates — old OS may limit streaming apps'),
            ('Power Consumption', 'measurement', False, False, 'W', 'Measure watt draw — abnormal consumption may indicate component fault'),
            ('Stand Stability or VESA Mount Condition', 'scale', True, False, '', 'Confirm stand is included and stable, or VESA pattern matches spec'),
            ('Serial Number & Model Verification', 'text', True, True, '', 'Record serial — verify model matches advertised spec'),
            # Audio Equipment Specific
            ('Amplifier/Receiver All Channels', 'pass_fail', False, True, '', 'Test all speaker channels at reference level — any dead channel is fail'),
            ('Speaker Drivers (No Torn Surrounds)', 'pass_fail', False, True, '', 'Inspect woofer surrounds — torn rubber causes distortion and rattling'),
            ('Subwoofer Cone & Port', 'pass_fail', False, False, '', 'Check cone for damage — port should have no obstruction'),
            ('Audio Connectivity All Inputs', 'pass_fail', False, False, '', 'Test all inputs: optical, coax, RCA, XLR if applicable'),
        ])

    def _checklist_cameras(self, category):
        self.create_checklist(category, [
            ('Sensor Dust & Spots', 'pass_fail', True, True, '', 'Photograph white wall at f/16 — dark spots are sensor dust requiring cleaning or swap'),
            ('Sensor Dead Pixels', 'pass_fail', True, True, '', 'Long exposure dark frame — white hot pixels in RAW indicate sensor damage'),
            ('Shutter Actuation Count', 'measurement', True, True, 'actuations', 'Check EXIF data or use online checker — compare to rated shutter life'),
            ('Shutter Speeds All Work', 'pass_fail', True, True, '', 'Test 1/8000s to 30s — check for banding or partial curtain failure'),
            ('Autofocus Speed & Accuracy', 'scale', True, False, '', 'Test phase detect and contrast AF — front/back focus issues indicate calibration need'),
            ('Image Stabilization Function', 'pass_fail', False, False, '', 'Record video handheld — check stabilization effectiveness'),
            ('LCD Screen Condition', 'pass_fail', True, True, '', 'Check for cracks, dead pixels, backlight evenness'),
            ('Viewfinder Condition', 'pass_fail', True, False, '', 'Check for mold, dirt, scratches in EVF or OVF eyepiece'),
            ('Battery Grip & Compartment', 'pass_fail', True, False, '', 'Check battery contacts — corrosion or bent pins'),
            ('Battery Health & Run-Time', 'measurement', True, False, 'shots', 'Charge fully — note shots-per-charge under normal use'),
            ('Memory Card Slot Function', 'pass_fail', True, True, '', 'Insert test card — write and read at rated speed'),
            ('All Dials & Buttons Function', 'pass_fail', True, False, '', 'Test mode dial, exposure compensation, all custom buttons'),
            ('Lens Mount Condition', 'pass_fail', True, True, '', 'Check mount contacts and alignment — scratches indicate rough lens changes'),
            ('Lens Tested (if Included)', 'scale', False, False, '', 'Check for fungus (hold to light), haze, aperture blade oil'),
            ('Lens Autofocus Motor', 'pass_fail', False, True, '', 'Test AF with body — stuttering or hunting indicates motor wear'),
            ('Tripod Mount Thread Condition', 'pass_fail', True, False, '', 'Check for cross-threading or stripped insert'),
            ('Weather Sealing Gaskets (if Rated)', 'scale', False, False, '', 'Inspect all door and button seals — any gaps in weatherproof models'),
            ('Video Recording All Modes', 'pass_fail', False, False, '', 'Record in claimed max resolution — check for rolling shutter, overheating'),
            ('Serial Number & Warranty Status', 'text', True, True, '', 'Record body serial — check manufacturer warranty status and theft registry'),
            ('Original Packaging & Accessories', 'text', False, False, '', 'Note what accessories are included — charger, straps, original box'),
        ])

    def _checklist_residential(self, category):
        self.create_checklist(category, [
            # Structure
            ('Foundation Condition Visual', 'pass_fail', True, True, '', 'Look for cracks, settlement, water staining around foundation'),
            ('Load-Bearing Wall Cracks', 'scale', True, True, '', 'Hairline=monitor, >3mm=structural concern, diagonal=subsidence'),
            ('Roof Structure Integrity', 'pass_fail', True, True, '', 'Check for sagging rafters, rot, daylight through roof'),
            ('Roof Covering Condition', 'scale', True, True, '', 'Check tiles/iron sheets — cracked or missing sheets cause leaks'),
            ('Ceiling Condition', 'scale', True, False, '', 'Water stains indicate roof or plumbing leaks'),
            ('Floor Level & Integrity', 'pass_fail', True, True, '', 'Bouncy or sloping floors indicate joist failure or subsidence'),
            ('External Wall Condition', 'scale', True, False, '', 'Check render, pointing, cracks — vegetation in cracks = problem'),
            ('Damp Proof Course', 'pass_fail', True, True, '', 'Rising damp up to 1m on internal walls — tide marks, salt deposits'),
            ('Lintel Condition Above Openings', 'pass_fail', True, True, '', 'Cracks above door/window openings indicate failed lintels'),
            ('Drainage Around Foundation', 'pass_fail', True, True, '', 'Ground should slope away from building — pooling causes damage'),
            ('Asbestos Pre-1990 Construction', 'pass_fail', False, True, '', 'Flag suspected asbestos materials — requires specialist test'),
            ('Unauthorized Wall Removal', 'pass_fail', True, True, '', 'Compare with plans — removed load-bearing walls are safety fail'),
            # Electrical
            ('Consumer Unit & Fuse Box', 'pass_fail', True, True, '', 'MCBs present, no scorch marks, proper labelling, RCD present'),
            ('Earthing & Bonding', 'pass_fail', True, True, '', 'Earth rod confirmed — bonding to water and gas pipes'),
            ('Socket Outlets Sample Test', 'pass_fail', True, True, '', 'Use socket tester — check live, neutral, earth wiring'),
            ('Lighting Circuit All Rooms', 'pass_fail', True, False, '', 'All light switches operate correct lights'),
            ('RCD Function Test', 'pass_fail', True, True, '', 'Press test button on RCD — should trip immediately'),
            ('Wiring Condition Visible Sections', 'scale', True, True, '', 'Fabric insulation = old pre-1960s wiring — flag for full rewire'),
            ('Outdoor Electrical Points', 'pass_fail', False, False, '', 'Check weatherproofing and RCD protection'),
            ('Electric Meter & Tariff Type', 'text', True, False, '', 'Record meter number and type — prepaid or postpaid'),
            # Plumbing
            ('Water Supply Pressure', 'measurement', True, True, 'bar', 'Normal 1–3 bar at kitchen tap — low pressure indicates main issue'),
            ('Hot Water System Geyser/Boiler', 'pass_fail', True, False, '', 'Check age, pressure relief valve, anode rod condition'),
            ('All Taps & Shower Mixers', 'pass_fail', True, False, '', 'Operate all taps — check for drips, correct hot/cold orientation'),
            ('Toilet Flush & Fill Valve', 'pass_fail', True, False, '', 'Flush — fill time should be <2 min, no continuous running'),
            ('Drain Waste & Overflow', 'pass_fail', True, False, '', 'Fill and drain — check flow rate and no backup between fixtures'),
            ('Waste Pipe & Soil Pipe Condition', 'pass_fail', True, True, '', 'Check for leaks, blockages, correct gradient and venting'),
            ('Roof Gutters & Downpipes', 'pass_fail', True, False, '', 'Check joints for gaps, blockages, and correct fall'),
            ('Septic Tank / Sewage Connection', 'text', True, True, '', 'Confirm type — if septic: last emptying date, leach field condition'),
            # Security
            ('Door Lock Quality All External', 'scale', True, False, '', 'Check deadbolt throw, frame condition, door material thickness'),
            ('Window Locks & Security', 'scale', True, False, '', 'Test all window locks — note any that cannot be secured'),
            ('Perimeter Wall / Fence Condition', 'scale', True, False, '', 'Check height, structural integrity, anti-climb measures'),
            ('Smoke Detectors', 'pass_fail', True, True, '', 'Test each detector — mandatory in bedrooms and hallways'),
            # Interior Finishes
            ('Kitchen Units & Worktops', 'scale', True, False, '', 'Check door hinges, worktop condition, water damage under sink'),
            ('Bathroom Tiles & Grouting', 'scale', True, False, '', 'Loose tiles indicate water ingress behind — press each tile'),
            ('Floor Covering Condition All Rooms', 'scale', True, False, '', 'Check for damage, lifting edges, squeaks'),
            ('Internal Door Condition & Operation', 'scale', True, False, '', 'Sticking indicates structural movement'),
            ('Air Conditioning Units', 'pass_fail', False, False, '', 'Test cooling and heating — check filter condition and drainage'),
            # Documentation
            ('Title Deed Verification', 'text', True, True, '', 'Original title deed — check owner name, plot number, registered area'),
            ('Survey Plan Cadastral', 'text', True, True, '', 'Compare physical boundaries with survey plan — encroachments are fail'),
            ('Building Permit & Approved Plans', 'pass_fail', True, True, '', 'All structures must have approved permits'),
            ('Occupancy Certificate', 'pass_fail', True, True, '', 'Certificate of occupancy from municipality — required for habitation'),
            ('Land Rates & Service Charges', 'text', True, True, '', 'Request rates clearance certificate — unpaid rates transfer to new owner'),
            ('Encumbrances & Caveats Search', 'text', True, True, '', 'Search title for mortgages, caveats, court orders — any found = fail'),
        ])

    def _checklist_commercial(self, category):
        self.create_checklist(category, [
            # Structure
            ('Structural Engineers Report', 'pass_fail', True, True, '', 'Formal structural assessment required for commercial property'),
            ('Foundation & Basement Condition', 'pass_fail', True, True, '', 'Check for cracking, water ingress, settlement'),
            ('Floor Loading Capacity', 'measurement', True, True, 'kg/m²', 'Verify floor loading matches intended use — especially ground floor retail'),
            ('Roof Condition & Drainage', 'scale', True, True, '', 'Flat roofs — check waterproof membrane, outlets, parapet condition'),
            ('Facade & External Cladding', 'scale', True, False, '', 'Check fixings, water ingress behind cladding'),
            ('Fire Compartmentation', 'pass_fail', True, True, '', 'Check fire walls, fire doors, and escape routes meet code'),
            # Services
            ('Electrical Main Switchboard Capacity', 'measurement', True, True, 'kVA', 'Confirm capacity meets business operational requirements'),
            ('Three-Phase Power (if Required)', 'pass_fail', False, True, '', 'Essential for manufacturing, large kitchens, heavy machinery'),
            ('Generator Backup System', 'pass_fail', False, False, '', 'Check capacity, automatic transfer switch, fuel tank'),
            ('HVAC/Air Conditioning System', 'scale', True, False, '', 'Test all zones — check filter condition and service records'),
            ('Plumbing & Commercial Drainage', 'pass_fail', True, True, '', 'Grease trap condition for food businesses — drain capacity for industrial'),
            ('Fire Suppression System', 'pass_fail', True, True, '', 'Sprinkler test certificate, fire hose reels, extinguisher servicing'),
            ('Security System & Access Control', 'scale', True, False, '', 'CCTV coverage, alarm zones, access card system'),
            # Compliance & Zoning
            ('Business Permit / Trading License Zone', 'text', True, True, '', 'Confirm zoning allows intended use — residential zone = commercial fail'),
            ('Fire Certificate', 'pass_fail', True, True, '', 'Current fire certificate from fire authority'),
            ('Environmental Compliance', 'pass_fail', False, True, '', 'NEMC compliance for businesses with environmental impact'),
            ('Health & Safety Inspection Record', 'pass_fail', True, False, '', 'OSHA compliance records if manufacturing/industrial'),
            # Layout & Condition
            ('Office/Retail Space Condition', 'scale', True, False, '', 'Condition of floors, ceilings, partitioning, lighting'),
            ('Loading Bay & Access', 'pass_fail', False, False, '', 'Check truck access, dock height, turning radius'),
            ('Parking Availability', 'text', True, False, 'bays', 'Count dedicated bays — confirm legal right to parking area'),
            ('Signage Rights', 'text', False, False, '', 'Confirm rights to external signage — some leases restrict this'),
            # Documentation
            ('Title Deed & Zoning Certificate', 'text', True, True, '', 'Verify title and zoning — must match intended commercial use'),
            ('Rates & Municipal Account Clearance', 'text', True, True, '', 'Request clearance certificate — liabilities transfer to buyer'),
            ('Survey Plan & Area Confirmation', 'text', True, True, '', 'Measure and confirm gross and net leasable area'),
            ('Existing Lease Agreements', 'text', False, True, '', 'Review all tenant leases — long-term tenants may restrict buyer use'),
            ('Outstanding Finance & Encumbrances', 'text', True, True, '', 'Full title search for mortgages, caveats, court orders'),
            ('Historic Contamination Assessment', 'pass_fail', False, True, '', 'Phase 1 environmental report for ex-industrial sites — contamination = fail'),
            ('Asbestos & Hazardous Materials Survey', 'pass_fail', False, True, '', 'Required for pre-1990s commercial buildings'),
            ('Insurance History & Claims', 'text', False, False, '', 'Request claim history — repeated fire or flood claims indicate systemic issues'),
            ('VAT & Tax Registration of Seller', 'text', False, False, '', 'Commercial property transactions may attract VAT — confirm seller status'),
        ])

    def _checklist_land(self, category):
        self.create_checklist(category, [
            # Legal & Ownership
            ('Title Deed Type & Ownership', 'text', True, True, '', 'Right of Occupancy (CRO/GRO/LRO) or Freehold — confirm type and owner'),
            ('Owner Identity Verification', 'pass_fail', True, True, '', 'Match title deed owner to seller ID — proxy sellers must have power of attorney'),
            ('Land Registry Search', 'pass_fail', True, True, '', 'Official search at land registry — confirm no caveats, charges, or disputes'),
            ('Cadastral Survey Plan Accuracy', 'pass_fail', True, True, '', 'Walk boundaries with survey plan — any discrepancy must be resolved before purchase'),
            ('Beacon/Boundary Markers Present', 'pass_fail', True, True, '', 'All four corners should have survey pegs — missing pegs indicate boundary disputes'),
            ('Encroachments on Adjacent Land', 'pass_fail', True, True, '', 'Any structures crossing boundary = encroachment dispute — fail trigger'),
            ('Land Rates & Ground Rent Clearance', 'text', True, True, '', 'Request clearance certificate from municipality — unpaid rates transfer'),
            # Physical Assessment
            ('Plot Size Measurement Verification', 'measurement', True, True, 'm²', 'Measure actual plot — compare to survey plan figure'),
            ('Topography & Flood Risk', 'scale', True, True, '', 'Low-lying plots flood during rains — check drainage direction and flood history'),
            ('Soil Type & Stability', 'scale', True, True, '', 'Expansive clay soils cause foundation problems — sandy soils may have erosion issues'),
            ('Existing Structures on Plot', 'text', True, False, '', 'Note any structures — confirm they will be demolished or are included in sale'),
            ('Tree Coverage & Removal Rights', 'text', False, False, '', 'Check for protected trees — removal may require environmental approval'),
            ('Utility Connections Available', 'text', True, False, '', 'Confirm proximity of water, electricity, sewer mains — cost to connect'),
            ('Road Access (Formal or Informal)', 'pass_fail', True, True, '', 'Legal access road must exist — landlocked plots with informal access are high risk'),
            ('Access Road Surface & Condition', 'scale', True, False, '', 'All-weather access — dirt roads may be impassable in rains'),
            # Zoning & Development
            ('Zoning Classification', 'text', True, True, '', 'Residential/Commercial/Industrial/Agricultural — must match intended use'),
            ('Building Height Restriction', 'text', True, False, '', 'Municipality plot ratio and height limit — affects development potential'),
            ('Setback Requirements', 'text', True, False, 'm', 'Required setbacks from boundaries and road — affects buildable area'),
            ('Environmental Restrictions', 'pass_fail', False, True, '', 'Riparian buffers, protected areas, conservation zones — all restrict development'),
        ])

    def _checklist_generators(self, category):
        self.create_checklist(category, [
            ('Engine Start Cold & Warm', 'pass_fail', True, True, '', 'Cold start without choke assistance — ease indicates condition'),
            ('Engine Oil Level & Condition', 'pass_fail', True, True, '', 'Check dipstick — dark sludge indicates neglected maintenance'),
            ('Output Voltage No Load', 'measurement', True, True, 'V', '220–240V nominal — outside ±10% indicates regulator fault'),
            ('Output Voltage Full Load', 'measurement', True, True, 'V', 'Apply rated load — voltage should remain stable within ±5%'),
            ('Output Frequency', 'measurement', True, True, 'Hz', '50Hz nominal — check with meter under load'),
            ('Fuel Leaks Tank Lines Carb', 'pass_fail', True, True, '', 'Fuel smell or drips — immediate fail, fire hazard'),
            ('Air Filter Condition', 'scale', True, False, '', 'Heavily clogged affects performance'),
            ('Spark Plug Condition', 'scale', True, False, '', 'Check electrode gap, carbon fouling, oil fouling'),
            ('Automatic Voltage Regulator AVR', 'pass_fail', True, True, '', 'Confirm AVR type and operation — protects connected equipment'),
            ('Circuit Breaker & Overload Protection', 'pass_fail', True, True, '', 'Test trip function — breaker should trip at rated amperage'),
            ('Earth Connection', 'pass_fail', True, True, '', 'Verify proper earth stake connected — essential for safety'),
            ('Fuel Tank Capacity & Condition', 'measurement', True, False, 'L', 'Confirm capacity, check for rust inside tank'),
            ('Runtime Per Tank at 75% Load', 'measurement', True, False, 'hours', 'Compare to manufacturer specification'),
            ('Noise Level at 7 Metres', 'measurement', False, False, 'dB', 'Relevant for residential use areas'),
            ('Control Panel Meters & Switches', 'pass_fail', True, False, '', 'All meters and switches operational — hourmeter shows actual use'),
            ('Battery Electric Start Models', 'pass_fail', False, False, '', 'Battery condition and cold cranking performance'),
            ('Frame & Body Condition', 'scale', True, False, '', 'Rust, cracks in frame, wheel condition'),
            ('Service History & Hours', 'text', True, False, 'hours', 'Record hourmeter — oil change due every 250 hours'),
        ])

    def _checklist_construction(self, category):
        self.create_checklist(category, [
            # Engine/Power
            ('Engine Start & Idle Quality', 'pass_fail', True, True, '', 'Cold start — listen for knock, smoke, rough idle'),
            ('Engine Oil Level & Leaks', 'pass_fail', True, True, '', 'Check level and inspect for leaks around gaskets and seals'),
            ('Hydraulic Fluid Level & Condition', 'pass_fail', True, True, '', 'Check reservoir — milky fluid indicates water contamination'),
            ('Hydraulic Leaks (All Lines & Rams)', 'pass_fail', True, True, '', 'Inspect all hydraulic lines and cylinders — any seeping is fail'),
            # Machine-Specific Functions
            ('All Hydraulic Functions Operate', 'pass_fail', True, True, '', 'Test every hydraulic circuit: lift, tilt, extend, swing — any dead circuit is fail'),
            ('Bucket/Blade/Attachment Condition', 'scale', True, False, '', 'Check wear on cutting edges, cracks in welds, pin/bush play'),
            ('Boom/Arm/Mast Condition', 'scale', True, True, '', 'Inspect for cracks in welds, straightness, pin wear'),
            ('Slew Ring Condition if Applicable', 'pass_fail', False, True, '', 'Excavators — check slew ring play and grease condition'),
            # Undercarriage
            ('Track/Tyre Condition', 'measurement', True, True, 'mm or %', 'Track pads: measure lug height. Tyres: tread depth and sidewall condition'),
            ('Track Tension & Idler Condition', 'pass_fail', False, False, '', 'Correct tension prevents derailing — check idler wear'),
            ('Undercarriage Rollers & Sprockets', 'scale', True, False, '', 'Worn rollers and sprockets accelerate track wear — inspect for flat spots'),
            # Structure & Safety
            ('ROPS/FOPS Cab Protection', 'pass_fail', True, True, '', 'Roll-over and falling object protection must be intact — any damage is fail'),
            ('Seatbelt Condition', 'pass_fail', True, True, '', 'Operator seatbelt must function — critical safety item'),
            ('All Controls Operate Correctly', 'pass_fail', True, True, '', 'Test every lever, pedal, and switch — check for stiff or non-responsive controls'),
            ('Horn & Reversing Alarm', 'pass_fail', True, True, '', 'Horn and backup alarm both required on construction sites'),
            # Electrics & Hours
            ('Battery & Charging System', 'pass_fail', True, False, '', 'Battery voltage and alternator output under load'),
            ('All Warning Lights & Gauges', 'pass_fail', True, True, '', 'Check temperature, oil pressure, hydraulic temp — any warning = investigate'),
            ('Hour Meter Reading', 'measurement', True, True, 'hours', 'Record hour meter — engine life typically 10,000–15,000 hours for major rebuild'),
            # Documentation
            ('Service History & Oil Change Records', 'text', True, False, '', 'Request service book — oil intervals, filter changes, major repairs'),
            ('Engine Serial & Machine PIN', 'text', True, True, '', 'Record both — cross-check with registration and theft databases'),
            ('Outstanding Finance Check', 'text', True, True, '', 'Confirm no outstanding finance — equipment often used as collateral'),
            ('Compliance with Site Safety Regulations', 'pass_fail', False, False, '', 'Check machine meets OSHA site requirements if purchasing for site use'),
        ])

    def _checklist_farm_machinery(self, category):
        self.create_checklist(category, [
            # Engine & Power
            ('Engine Start Cold & Warm', 'pass_fail', True, True, '', 'Diesel engines — check glow plug operation, smoke on start'),
            ('Engine Oil Level & Leaks', 'pass_fail', True, True, '', 'Check level and inspect for leaks — especially around injection pump'),
            ('Coolant Level & Radiator Condition', 'pass_fail', True, True, '', 'Check fins for mud blockage — common on tractors working in fields'),
            ('Fuel Injection System', 'pass_fail', True, True, '', 'Listen for injector knock — blue/white smoke under load indicates injector wear'),
            ('PTO Speed & Function', 'pass_fail', True, True, '', 'Test PTO at 540 and 1000 rpm — critical for implements like pumps and balers'),
            ('Hydraulic System (Three-Point Hitch)', 'pass_fail', True, True, '', 'Raise implement to full height — should lift rated load and hold position'),
            ('Hydraulic Top Link & Lift Arms', 'pass_fail', True, False, '', 'Check wear in linkage pins and bushings — slop affects implement accuracy'),
            ('Transmission All Gears Hi/Lo Range', 'scale', True, True, '', 'Test all gears including hi/lo range and 4WD engagement'),
            ('Differential Lock Engagement', 'pass_fail', True, False, '', 'Test engagement and disengagement — critical for field traction'),
            # Running Gear
            ('Front Axle & Steering (2WD)', 'pass_fail', True, True, '', 'Check steering play and kingpin wear — excessive play is safety fail'),
            ('Front Axle 4WD Drive Engagement', 'pass_fail', False, True, '', 'Engage 4WD and turn tight circle — clicking indicates CV joint failure'),
            ('Tyre Condition All Four', 'scale', True, True, '', 'Agricultural tyres — check tread depth and sidewall cracking from UV exposure'),
            ('Wheel Bearing Condition', 'pass_fail', True, True, '', 'Jack each corner — any play in wheel indicates worn bearing'),
            ('Brakes Independent & Together', 'pass_fail', True, True, '', 'Test left and right brakes independently (essential for field turning) and together on road'),
            # Implement-Specific (if included)
            ('Implement Attachment Condition', 'scale', False, False, '', 'Check wear on blades, tines, discs — measure remaining wear material'),
            ('Implement Frame Welds', 'pass_fail', False, True, '', 'Inspect welds on implement frame — cracks under load are safety fail'),
            ('Seed Drill Metering Mechanism', 'pass_fail', False, False, '', 'If seed drill: test metering rollers, seed tubes, coulter depth adjustment'),
            # Electrics & Controls
            ('Battery & Charging System', 'pass_fail', True, False, '', 'Battery voltage and alternator output — agricultural batteries work hard'),
            ('All Warning Lights & Instruments', 'pass_fail', True, True, '', 'Check oil pressure, temperature gauges — any warning = investigate before purchase'),
            ('Cab Comfort if Applicable', 'scale', False, False, '', 'Air conditioning, seat suspension, radio — operator hours matter for productivity'),
            # Documentation
            ('Hour Meter Reading', 'measurement', True, True, 'hours', 'Record hour meter — engine rebuild typically due at 5,000–8,000 hours for small tractors'),
            ('Service History', 'text', True, False, '', 'Oil change intervals, filter replacements, major works'),
            ('Registration & Ownership Documents', 'text', True, True, '', 'TRA registration if applicable — verify ownership matches seller ID'),
            ('Outstanding Finance Check', 'text', True, True, '', 'Farm equipment often financed — confirm clearance letter from lender'),
            ('Seasonal Condition Assessment', 'text', True, False, '', 'Note time of year — machinery sold after harvest may be run harder than usual'),
        ])

    def _checklist_livestock(self, category):
        self.create_checklist(category, [
            # Health & Condition
            ('General Body Condition Score', 'scale', True, True, '', 'Score 1–5: 1=emaciated, 3=ideal, 5=obese. Score <2 or >4 = flag'),
            ('Eye Condition (Bright & Clear)', 'pass_fail', True, True, '', 'Sunken, dull, or discharging eyes indicate disease or dehydration'),
            ('Nasal Discharge', 'pass_fail', True, True, '', 'Clear discharge is normal — thick yellow/green or bloody = respiratory disease'),
            ('Coat/Hide/Feather Condition', 'scale', True, False, '', 'Rough coat, hair loss, or missing feathers indicate nutritional deficiency or parasites'),
            ('Lameness & Gait Assessment', 'pass_fail', True, True, '', 'Observe walking — any limping or reluctance to bear weight = veterinary assessment required'),
            ('Hoof/Foot Condition', 'scale', True, True, '', 'Check for overgrowth, rot, foot-and-mouth lesions — severe hoof disease is fail'),
            ('Dung/Droppings Consistency', 'scale', True, True, '', 'Liquid diarrhea indicates disease or parasite load — firm is ideal'),
            ('Signs of Respiratory Disease', 'pass_fail', True, True, '', 'Listen for cough, labored breathing — respiratory disease spreads rapidly in herds'),
            # Reproductive Assessment
            ('Gender Verification', 'pass_fail', True, True, '', 'Confirm animal is as described — age and gender verification critical for pricing'),
            ('Reproductive Status (Females)', 'text', False, False, '', 'Pregnant, lactating, or dry — note expected calving/kidding date if pregnant'),
            ('Udder Condition (Females in Production)', 'scale', False, False, '', 'Check for mastitis — hard lumps or asymmetric quarters indicate infection'),
            ('Breeding History / Pedigree', 'text', False, False, '', 'Record sire and dam if pedigree claimed — verify with documentation'),
            # Age & Identification
            ('Age Estimation (Teeth)', 'text', True, True, '', 'Examine teeth eruption — note estimated age. Seller age claims must match teeth'),
            ('Ear Tag / Brand / Tattoo Identification', 'pass_fail', True, True, '', 'Record all identification markings — match to movement permit'),
            ('Movement Permit Validity', 'pass_fail', True, True, '', 'Valid permit from district veterinary officer — required for livestock movement'),
            # Vaccinations & Health Records
            ('Vaccination Records', 'text', True, True, '', 'Check vaccination card — East Coast Fever, CBPP, FMD, Newcastle etc. as applicable'),
            ('Deworming History', 'text', True, False, '', 'Date of last deworming — resistance monitoring important for herd health'),
            ('Veterinary Health Certificate', 'pass_fail', True, True, '', 'Current health certificate from licensed vet — required for formal livestock markets'),
            # Production Records
            ('Milk Production Records if Dairy', 'text', False, False, 'litres/day', 'Request daily milk records for last 30 days — verify against visual udder assessment'),
            ('Growth Rate / Weight Records', 'text', False, False, 'kg', 'For beef animals: weigh at inspection and compare to breed standard for age'),
        ])

    def _checklist_spare_parts(self, category):
        self.create_checklist(category, [
            ('Part Condition & Authenticity', 'pass_fail', True, True, '', 'Check for counterfeit marks or excessive wear'),
            ('Compatibility Verification', 'text', True, True, '', 'Check part numbers against vehicle models'),
            ('Physical Damage', 'pass_fail', True, True, '', 'Check for cracks, broken mounts, or missing components'),
            ('Functional Test (if applicable)', 'pass_fail', False, False, '', 'Test electronic or mechanical function if possible'),
        ])

    def _checklist_power_tools(self, category):
        self.create_checklist(category, [
            ('Power Cord & Plug Condition', 'pass_fail', True, True, '', 'Check for fraying, exposed wires, grounding prong'),
            ('Motor Operation & Brushes', 'pass_fail', True, True, '', 'Listen for abnormal noise, check for excessive sparking'),
            ('Trigger & Safety Switches', 'pass_fail', True, True, '', 'Ensure all switches operate smoothly and safely'),
            ('Chuck / Mount Condition', 'scale', True, False, '', 'Check for wobbling, wear, or stripped threads'),
            ('Battery Health (if Cordless)', 'pass_fail', False, True, '', 'Check ability to hold charge under load'),
        ])

