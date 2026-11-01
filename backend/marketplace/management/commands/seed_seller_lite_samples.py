"""
backend/marketplace/management/commands/seed_seller_lite_samples.py

Seeds 5 comprehensive sample merchants subscribed to Seller Lite tier (19,000 TZS/mo):
1. powerfit_gym      - Health & Fitness Gym (Gym Passes, Expiry tracking, Check-in counter, Protein shakes)
2. luxe_barber       - Barbershop & Spa Lounge (VIP Haircuts, Attendant attribution, Grooming passes)
3. swahili_bistro    - Coastal Restaurant & Cafe (Food items, Add-on toppings, Dine-in/Takeaway modes, Lunch passes)
4. saficlean_laundry - Dry Cleaners & Sneaker Spa (Garment dry clean, Sneaker whitening, Claim tickets & laundry passes)
5. sparkle_carwash   - Auto Detailing & Ceramic Spa (Foam wash, Wax buffing, Vehicle plate passes, Fleet passes)

All sample accounts use the password: Password123!
"""

from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from marketplace.models import (
    SubscriptionTier, UserProfile, Subscription, StoreLocation,
    Category, Product, Order, OrderItem, CustomerServicePass
)


class Command(BaseCommand):
    help = 'Seed realistic sample merchants for Seller Lite tier services'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("--- Seeding Seller Lite Sample Merchants ---"))

        # Ensure seller_lite tier exists
        lite_tier, _ = SubscriptionTier.objects.get_or_create(
            tier_level='seller_lite',
            defaults={
                'name': 'Seller Lite',
                'description': 'Designed for retail shops, cafes, gyms and service centers needing in-store POS register & analytics.',
                'price': Decimal('19000.00'),
                'billing_period': 'monthly',
                'max_listings': 0,
                'commission_rate': Decimal('0.025'),
                'is_active': True,
                'badge_color': '#9ca3af',
            }
        )

        # Parent category: Services & Maintenance
        services_cat = Category.objects.filter(slug='services-maintenance').first()
        if not services_cat:
            services_cat, _ = Category.objects.get_or_create(
                name='Services & Maintenance',
                slug='services-maintenance'
            )

        cat_gym, _ = Category.objects.get_or_create(
            name='Health, Fitness & Gym',
            slug='services-gym-fitness',
            defaults={'parent': services_cat}
        )
        cat_salon, _ = Category.objects.get_or_create(
            name='Salon, Barber & Spa',
            slug='services-salon-barber',
            defaults={'parent': services_cat}
        )
        cat_food, _ = Category.objects.get_or_create(
            name='Restaurants, Cafes & Food',
            slug='services-restaurant-cafe',
            defaults={'parent': services_cat}
        )
        cat_laundry, _ = Category.objects.get_or_create(
            name='Laundry & Dry Cleaning',
            slug='services-laundry-cleaning',
            defaults={'parent': services_cat}
        )
        cat_auto, _ = Category.objects.get_or_create(
            name='Car Wash & Auto Detailing',
            slug='services-car-wash',
            defaults={'parent': services_cat}
        )

        SAMPLE_SELLERS = [
            # 1. GYM / FITNESS
            {
                'username': 'powerfit_gym',
                'business_mode': 'gym',
                'email': 'powerfit@sokonimax.tz',
                'first_name': 'Hassan',
                'last_name': 'Mrema',
                'business_name': 'PowerFit Gym & Studio',
                'display_name': 'PowerFit Masaki',
                'bio': 'Masaki premier strength training, cardio & functional fitness studio. Modern equipment, personal coaches & member check-in.',
                'location': 'Masaki, Haile Selassie Rd, Dar es Salaam',
                'phone': '+255754123456',
                'whatsapp': '+255754123456',
                'category': cat_gym,
                'store_address': 'Haile Selassie Road, Plot 14, Masaki, Dar es Salaam',
                'products': [
                    {
                        'name': 'Monthly Full Gym Membership',
                        'price': Decimal('75000.00'),
                        'is_service': True,
                        'validity_days': 30,
                        'modifiers': [
                            {'name': 'Locker Rental', 'price': 10000},
                            {'name': 'Personal Coach (4 Sessions)', 'price': 40000},
                            {'name': 'Towel Service', 'price': 5000},
                        ],
                        'description': 'Full 30-day unlimited gym floor access, cardio zone, free weights, and locker room facilities.',
                    },
                    {
                        'name': 'Weekly Fitness Pass',
                        'price': Decimal('25000.00'),
                        'is_service': True,
                        'validity_days': 7,
                        'modifiers': [
                            {'name': 'Steam & Sauna Access', 'price': 10000},
                        ],
                        'description': '7-day consecutive access for visitors and travelers.',
                    },
                    {
                        'name': 'Daily Workout Drop-in Pass',
                        'price': Decimal('10000.00'),
                        'is_service': True,
                        'validity_days': 1,
                        'modifiers': [
                            {'name': 'Shower & Clean Towel', 'price': 3000},
                        ],
                        'description': 'Single-day visitor workout pass with locker usage.',
                    },
                    {
                        'name': '3-Month VIP Membership',
                        'price': Decimal('200000.00'),
                        'is_service': True,
                        'validity_days': 90,
                        'modifiers': [
                            {'name': 'Diet & Nutrition Plan', 'price': 25000},
                        ],
                        'description': 'Quarterly membership with priority trainer booking and complimentary locker.',
                    },
                    {
                        'name': 'Optimum Nutrition Whey Protein (500ml)',
                        'price': Decimal('8000.00'),
                        'is_service': False,
                        'stock': 40,
                        'modifiers': [],
                        'description': 'Cold ready-to-drink post-workout whey protein shake at front desk.',
                    },
                    {
                        'name': 'Bottled Mineral Water 1.5L',
                        'price': Decimal('1500.00'),
                        'is_service': False,
                        'stock': 120,
                        'modifiers': [],
                        'description': 'Chilled pure mineral drinking water.',
                    },
                ],
                'passes': [
                    {
                        'customer_name': 'Juma Rashid',
                        'customer_phone': '+255712345678',
                        'prod_index': 0, # Monthly
                        'days_left': 26,
                        'check_ins': 5,
                        'status': 'ACTIVE',
                        'notes': 'Preferred training time: 6:00 AM'
                    },
                    {
                        'customer_name': 'Amina Mwinyi',
                        'customer_phone': '+255784998877',
                        'prod_index': 1, # Weekly
                        'days_left': 1,
                        'check_ins': 6,
                        'status': 'ACTIVE',
                        'notes': 'Expiring soon - remind via WhatsApp'
                    },
                    {
                        'customer_name': 'Kelvin Shirima',
                        'customer_phone': '+255763112233',
                        'prod_index': 3, # 3-Month
                        'days_left': 72,
                        'check_ins': 19,
                        'status': 'ACTIVE',
                        'notes': 'VIP Member #082'
                    },
                    {
                        'customer_name': 'Baraka Mwamba',
                        'customer_phone': '+255755443322',
                        'prod_index': 0, # Monthly
                        'days_left': -3,
                        'check_ins': 22,
                        'status': 'EXPIRED',
                        'notes': 'Expired 3 days ago - renewal pending'
                    },
                ],
                'sample_orders': [
                    {
                        'customer_name': 'Juma Rashid',
                        'customer_phone': '+255712345678',
                        'order_type': 'walk_in',
                        'items': [
                            {'prod_index': 0, 'qty': 1, 'addons': [{'name': 'Locker Rental', 'price': 10000}], 'attendant': 'Coach Alex'}
                        ]
                    }
                ]
            },

            # 2. SALON & BARBERSHOP
            {
                'username': 'luxe_barber',
                'business_mode': 'salon',
                'email': 'luxebarber@sokonimax.tz',
                'first_name': 'Samwel',
                'last_name': 'Kassim',
                'business_name': 'Luxe Barber & Beauty Lounge',
                'display_name': 'Luxe Lounge Sinza',
                'bio': 'Master haircuts, beard grooming, exfoliating facials & spa manicures. Sinza Mori hotspot for modern gentlemen and ladies.',
                'location': 'Sinza Mori, Shekilango Road, Dar es Salaam',
                'phone': '+255768234567',
                'whatsapp': '+255768234567',
                'category': cat_salon,
                'store_address': 'Shekilango Road opposite Mori Towers, Sinza, Dar es Salaam',
                'products': [
                    {
                        'name': 'Executive Haircut & Beard Shaping',
                        'price': Decimal('15000.00'),
                        'is_service': True,
                        'validity_days': 0,
                        'modifiers': [
                            {'name': 'Hot Towel Steam Treatment', 'price': 5000},
                            {'name': 'Black Beard Dye / Tint', 'price': 8000},
                            {'name': 'Exfoliating Face Scrub', 'price': 7000},
                        ],
                        'description': 'Precision taper fade, clipper work, razor lining, wash & conditioning.',
                    },
                    {
                        'name': 'Kids Haircut & Styling',
                        'price': Decimal('10000.00'),
                        'is_service': True,
                        'validity_days': 0,
                        'modifiers': [
                            {'name': 'Custom Hair Art / Line Design', 'price': 3000},
                        ],
                        'description': 'Gentle cut for children aged 2-12 years.',
                    },
                    {
                        'name': 'Luxury Manicure & Pedicure Spa',
                        'price': Decimal('35000.00'),
                        'is_service': True,
                        'validity_days': 0,
                        'modifiers': [
                            {'name': 'Paraffin Wax Treatment', 'price': 12000},
                            {'name': 'Long-Lasting Gel Polish', 'price': 10000},
                        ],
                        'description': 'Nail trimming, cuticle care, sea salt scrub, massage, and nail buffing.',
                    },
                    {
                        'name': 'Monthly VIP Grooming Pass (4 Sessions)',
                        'price': Decimal('50000.00'),
                        'is_service': True,
                        'validity_days': 30,
                        'modifiers': [
                            {'name': 'Priority Chair Booking', 'price': 0},
                            {'name': 'Complimentary Beverage', 'price': 0},
                        ],
                        'description': 'Prepaid 4 haircut and beard styling sessions for the month.',
                    },
                    {
                        'name': 'Deep Charcoal Facial Treatment',
                        'price': Decimal('25000.00'),
                        'is_service': True,
                        'validity_days': 0,
                        'modifiers': [
                            {'name': 'Collagen Under-Eye Mask', 'price': 5000},
                        ],
                        'description': 'Blackhead removal, clarifying charcoal mask, facial massage, and UV protection.',
                    },
                    {
                        'name': 'Organic Argan Beard Oil (60ml)',
                        'price': Decimal('20000.00'),
                        'is_service': False,
                        'stock': 25,
                        'modifiers': [],
                        'description': 'Natural nourishing oil for beard softness and healthy shine.',
                    },
                ],
                'passes': [
                    {
                        'customer_name': 'David Kimaro',
                        'customer_phone': '+255714112233',
                        'prod_index': 3, # Monthly VIP Grooming
                        'days_left': 21,
                        'check_ins': 2,
                        'status': 'ACTIVE',
                        'notes': 'Regular client | Stylist: Samwel'
                    },
                    {
                        'customer_name': 'Ally Bakari',
                        'customer_phone': '+255755998877',
                        'prod_index': 3,
                        'days_left': 2,
                        'check_ins': 4,
                        'status': 'ACTIVE',
                        'notes': 'Expiring in 2 days | Stylist: Grace'
                    },
                ],
                'sample_orders': [
                    {
                        'customer_name': 'Erick Msuya',
                        'customer_phone': '+255713445566',
                        'order_type': 'walk_in',
                        'items': [
                            {'prod_index': 0, 'qty': 1, 'addons': [{'name': 'Hot Towel Steam Treatment', 'price': 5000}], 'attendant': 'Samwel (Master Barber)'}
                        ]
                    }
                ]
            },

            # 3. CAFE & RESTAURANT
            {
                'username': 'swahili_bistro',
                'business_mode': 'restaurant',
                'email': 'bistro@sokonimax.tz',
                'first_name': 'Fatma',
                'last_name': 'Said',
                'business_name': 'Swahili Bistro & Grill',
                'display_name': 'Swahili Bistro Kinondoni',
                'bio': 'Authentic coastal Swahili cuisine, charcoal grilled meats, fresh pressed tropical juices & chilled drinks.',
                'location': 'Kinondoni, Ali Hassan Mwinyi Rd, Dar es Salaam',
                'phone': '+255715345678',
                'whatsapp': '+255715345678',
                'category': cat_food,
                'store_address': 'Ali Hassan Mwinyi Road near Leaders Club, Kinondoni, Dar es Salaam',
                'products': [
                    {
                        'name': 'Zanzibar Chicken Biryani',
                        'price': Decimal('12000.00'),
                        'is_service': True,
                        'validity_days': 0,
                        'modifiers': [
                            {'name': 'Extra Chicken Drumstick', 'price': 4000},
                            {'name': 'Fresh Kachumbari Salad', 'price': 1000},
                            {'name': 'Fried Ripe Plantains (Ndizi)', 'price': 2000},
                        ],
                        'description': 'Slow-cooked fragrant basmati rice with tender coastal spiced chicken and boiled egg.',
                    },
                    {
                        'name': 'Tender Mbuzi Choma (1/2 kg)',
                        'price': Decimal('16000.00'),
                        'is_service': True,
                        'validity_days': 0,
                        'modifiers': [
                            {'name': 'Hot Ugali Portion', 'price': 1500},
                            {'name': 'Crispy French Fries (Chips)', 'price': 2500},
                            {'name': 'Spicy Chili Pepper Dip', 'price': 500},
                        ],
                        'description': 'Charcoal roasted tender goat meat marinated with garlic, ginger, and lime.',
                    },
                    {
                        'name': 'Double Smash Cheeseburger Combo',
                        'price': Decimal('15000.00'),
                        'is_service': True,
                        'validity_days': 0,
                        'modifiers': [
                            {'name': 'Extra Cheddar Cheese Slice', 'price': 2000},
                            {'name': 'Crispy Beef Bacon', 'price': 3000},
                            {'name': 'Pickled Jalapenos', 'price': 1000},
                        ],
                        'description': 'Two smashed beef patties, melted cheddar, house sauce, caramelized onions on brioche bun with fries.',
                    },
                    {
                        'name': 'Bottled Mineral Water (1.5L)',
                        'price': Decimal('2000.00'),
                        'is_service': False,
                        'stock': 3,
                        'modifiers': [],
                        'description': 'Chilled pure spring drinking water 1.5L bottle.',
                    },
                    {
                        'name': 'Cold Kilimanjaro Premium Lager (500ml)',
                        'price': Decimal('4500.00'),
                        'is_service': False,
                        'stock': 2,
                        'modifiers': [],
                        'description': 'Ice-cold Kilimanjaro lager beer.',
                    },
                    {
                        'name': 'Coca-Cola Zero Can (330ml)',
                        'price': Decimal('2500.00'),
                        'is_service': False,
                        'stock': 0,
                        'modifiers': [],
                        'description': 'Zero sugar Coca-Cola can.',
                    },
                    {
                        'name': 'Fresh Passion & Ginger Juice (500ml)',
                        'price': Decimal('4000.00'),
                        'is_service': True,
                        'validity_days': 0,
                        'modifiers': [
                            {'name': 'Chia Seeds Add-in', 'price': 1000},
                        ],
                        'description': 'Freshly squeezed natural passion fruit juice with zesty ginger root.',
                    },
                    {
                        'name': 'Artisan Vanilla Latte / Cappuccino',
                        'price': Decimal('6000.00'),
                        'is_service': True,
                        'validity_days': 0,
                        'modifiers': [
                            {'name': 'Almond / Oat Milk Substitute', 'price': 1500},
                            {'name': 'Extra Double Shot Espresso', 'price': 1500},
                            {'name': 'Caramel Sauce Drizzle', 'price': 1000},
                        ],
                        'description': 'Locally roasted Kilimanjaro Arabica espresso with steamed velvety milk.',
                    },
                ],
                'passes': [],
                'sample_orders': [
                    {
                        'customer_name': 'Table 4 Guests',
                        'customer_phone': '+255719887766',
                        'order_type': 'dine_in',
                        'table_number': '4',
                        'items': [
                            {'prod_index': 0, 'qty': 2, 'addons': [{'name': 'Extra Chicken Drumstick', 'price': 4000}], 'attendant': 'Server Amani'},
                            {'prod_index': 3, 'qty': 2, 'addons': [], 'attendant': 'Server Amani'}
                        ]
                    },
                    {
                        'customer_name': 'Takeaway Customer',
                        'customer_phone': '+255781223344',
                        'order_type': 'takeaway',
                        'items': [
                            {'prod_index': 2, 'qty': 1, 'addons': [{'name': 'Extra Cheddar Cheese Slice', 'price': 2000}], 'attendant': ''}
                        ]
                    }
                ]
            },

            # 4. DRY CLEANING & SNEAKER SPA
            {
                'username': 'saficlean_laundry',
                'business_mode': 'service',
                'email': 'saficlean@sokonimax.tz',
                'first_name': 'Godfrey',
                'last_name': 'Massawe',
                'business_name': 'SafiClean Drycleaners & Shoe Spa',
                'display_name': 'SafiClean Mwenge',
                'bio': 'Eco-friendly dry cleaning, steam pressing, suede restoration & sneaker deep cleaning. Fast turnaround with claim code tracking.',
                'location': 'Mwenge, Bagamoyo Road, Dar es Salaam',
                'phone': '+255782456789',
                'whatsapp': '+255782456789',
                'category': cat_laundry,
                'store_address': 'Bagamoyo Road near TRA Mwenge, Dar es Salaam',
                'products': [
                    {
                        'name': 'Suit (2-Piece) Dry Clean & Steam Press',
                        'price': Decimal('14000.00'),
                        'is_service': True,
                        'validity_days': 0,
                        'modifiers': [
                            {'name': 'Same-Day Express (4 hrs)', 'price': 8000},
                            {'name': 'Heavy Starch Crisp Finish', 'price': 2000},
                            {'name': 'Breathable Garment Suit Bag', 'price': 3000},
                        ],
                        'description': 'Gentle dry cleaning for wool, linen and polyester blend suits with hand finishing.',
                    },
                    {
                        'name': 'Sneakers Deep Cleaning & Whitening',
                        'price': Decimal('18000.00'),
                        'is_service': True,
                        'validity_days': 0,
                        'modifiers': [
                            {'name': 'Hydrophobic Water Repellent Shield', 'price': 5000},
                            {'name': 'Deodorizing Ozone Treatment', 'price': 3000},
                            {'name': 'Brand New Flat White Laces', 'price': 3000},
                        ],
                        'description': 'Complete upper scrubbing, sole deoxidation, insole wash and hand conditioning.',
                    },
                    {
                        'name': 'Monthly Executive Laundry Pass (20 Clothes)',
                        'price': Decimal('65000.00'),
                        'is_service': True,
                        'validity_days': 30,
                        'modifiers': [
                            {'name': 'Free Doorstep Collection', 'price': 0},
                        ],
                        'description': 'Monthly subscription for shirts, trousers and casual wear wash & iron.',
                    },
                    {
                        'name': 'Duvet / Large Blanket Dry Cleaning',
                        'price': Decimal('20000.00'),
                        'is_service': True,
                        'validity_days': 0,
                        'modifiers': [
                            {'name': 'Aroma Fresh Infusion', 'price': 3000},
                            {'name': 'Vacuum Sealed Storage Bag', 'price': 5000},
                        ],
                        'description': 'Hygienic deep cleaning for king/queen size duvets and heavy winter blankets.',
                    },
                    {
                        'name': 'SafiSneak Cleaning Foam Kit (150ml)',
                        'price': Decimal('15000.00'),
                        'is_service': False,
                        'stock': 30,
                        'modifiers': [],
                        'description': 'Take-home shoe care foam kit with hog-hair bristle brush and microfiber towel.',
                    },
                ],
                'passes': [
                    {
                        'customer_name': 'Francis Lyimo',
                        'customer_phone': '+255713998811',
                        'prod_index': 2, # Monthly Laundry Pass
                        'days_left': 24,
                        'check_ins': 7,
                        'status': 'ACTIVE',
                        'notes': 'Prefers light starch on shirts'
                    },
                    {
                        'customer_name': 'Fatuma Juma',
                        'customer_phone': '+255754887766',
                        'prod_index': 2,
                        'days_left': 5,
                        'check_ins': 18,
                        'status': 'ACTIVE',
                        'notes': 'Expiring soon - send WhatsApp renewal'
                    },
                ],
                'sample_orders': [
                    {
                        'customer_name': 'Michael Komba',
                        'customer_phone': '+255718334455',
                        'order_type': 'walk_in',
                        'pickup_required': True,
                        'pickup_time': 'Today at 5:00 PM',
                        'claim_code': 'SKN:CLM:Mwenge-401',
                        'items': [
                            {'prod_index': 0, 'qty': 1, 'addons': [{'name': 'Same-Day Express (4 hrs)', 'price': 8000}], 'attendant': 'Tech Musa'},
                            {'prod_index': 1, 'qty': 1, 'addons': [{'name': 'Hydrophobic Water Repellent Shield', 'price': 5000}], 'attendant': 'Tech Musa'}
                        ]
                    }
                ]
            },

            # 5. CAR WASH & AUTO DETAILING
            {
                'username': 'sparkle_carwash',
                'business_mode': 'service',
                'email': 'sparkle@sokonimax.tz',
                'first_name': 'Edward',
                'last_name': 'Kimaro',
                'business_name': 'Sparkle Auto Spa & Detailing',
                'display_name': 'Sparkle Car Wash Mikocheni',
                'bio': 'Snow foam car wash, ceramic wax coating, engine steam cleaning & fleet subscriptions. Track your wash pass by car plate!',
                'location': 'Mikocheni B, Old Bagamoyo Rd, Dar es Salaam',
                'phone': '+255767112233',
                'whatsapp': '+255767112233',
                'category': cat_auto,
                'store_address': 'Old Bagamoyo Road near Shoppers Plaza, Mikocheni, Dar es Salaam',
                'products': [
                    {
                        'name': 'Executive Foam Body Wash & Interior Vacuum',
                        'price': Decimal('10000.00'),
                        'is_service': True,
                        'validity_days': 0,
                        'modifiers': [
                            {'name': 'Engine Steam Clean & Degrease', 'price': 5000},
                            {'name': 'Silicone Tyre Shine Treatment', 'price': 2000},
                            {'name': 'Dashboard Matte Dressing Polish', 'price': 3000},
                        ],
                        'description': 'Thick pH-neutral snow foam wash, hand mitt drying, deep interior vacuuming and glass cleaning.',
                    },
                    {
                        'name': 'Full Machine Buffing & Ceramic Wax',
                        'price': Decimal('45000.00'),
                        'is_service': True,
                        'validity_days': 0,
                        'modifiers': [
                            {'name': 'Headlight Oxidation Polish', 'price': 15000},
                            {'name': 'Odor Eliminator Ozone Bomb', 'price': 10000},
                        ],
                        'description': 'Clay bar decontamination, dual-action machine glaze polish, and 6-month ceramic wax shield.',
                    },
                    {
                        'name': 'Monthly Unlimited Car Wash Pass (Single Vehicle)',
                        'price': Decimal('70000.00'),
                        'is_service': True,
                        'validity_days': 30,
                        'modifiers': [
                            {'name': 'Engine Wash Included (2x)', 'price': 0},
                        ],
                        'description': 'Unlimited executive washes for 30 days tied to your vehicle plate registration number.',
                    },
                    {
                        'name': '10-Wash Prepaid Fleet Pass',
                        'price': Decimal('80000.00'),
                        'is_service': True,
                        'validity_days': 60,
                        'modifiers': [],
                        'description': 'Prepaid 10-wash package valid for 60 days across company or family cars.',
                    },
                    {
                        'name': 'Microfiber Car Drying Towel XL',
                        'price': Decimal('12000.00'),
                        'is_service': False,
                        'stock': 20,
                        'modifiers': [],
                        'description': '1200 GSM plush twist loop microfiber drying towel, scratch-free.',
                    },
                ],
                'passes': [
                    {
                        'customer_name': 'T 421 DRJ - Prado (Edward Mushi)',
                        'customer_phone': '+255715990011',
                        'prod_index': 2, # Monthly Unlimited
                        'days_left': 22,
                        'check_ins': 8,
                        'status': 'ACTIVE',
                        'notes': 'Plate: T 421 DRJ | Model: Toyota Prado Pearl White'
                    },
                    {
                        'customer_name': 'T 118 EAK - BMW X5 (Sarah Kessy)',
                        'customer_phone': '+255787665544',
                        'prod_index': 3, # 10-Wash Fleet
                        'days_left': 41,
                        'check_ins': 4,
                        'status': 'ACTIVE',
                        'notes': 'Plate: T 118 EAK | 6 washes remaining'
                    },
                ],
                'sample_orders': [
                    {
                        'customer_name': 'T 789 DXY - Harrier',
                        'customer_phone': '+255712998877',
                        'order_type': 'walk_in',
                        'items': [
                            {'prod_index': 0, 'qty': 1, 'addons': [{'name': 'Engine Steam Clean & Degrease', 'price': 5000}, {'name': 'Silicone Tyre Shine Treatment', 'price': 2000}], 'attendant': 'Washer Japhari'}
                        ]
                    }
                ]
            },
        ]

        for sdata in SAMPLE_SELLERS:
            uname = sdata['username']
            user, created = User.objects.get_or_create(
                username=uname,
                defaults={
                    'email': sdata['email'],
                    'first_name': sdata['business_name'],
                    'last_name': '',
                }
            )
            user.first_name = sdata['business_name']
            user.last_name = ''
            user.set_password('Password123!')
            user.save()

            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.tier = 'seller_lite'
            profile.is_seller = True
            profile.is_verified = True # Gray checkmark on profile!
            profile.subscription_active = True
            profile.subscription_expired = False
            profile.subscription_end_date = timezone.now() + timezone.timedelta(days=365)
            profile.bio = sdata['bio']
            profile.location = sdata['location']
            profile.phone_number = sdata['phone']
            profile.whatsapp_number = sdata['whatsapp']
            profile.business_mode = sdata.get('business_mode', 'retail')
            profile.pass_expiry_window_days = 7
            profile.show_product_requests = True
            profile.terms_accepted = True
            profile.save()

            # Active Subscription record
            sub, _ = Subscription.objects.get_or_create(
                user=user,
                tier=lite_tier,
                defaults={
                    'is_active': True,
                    'start_date': timezone.now(),
                    'end_date': timezone.now() + timezone.timedelta(days=365)
                }
            )
            sub.is_active = True
            sub.end_date = timezone.now() + timezone.timedelta(days=365)
            sub.save()

            # Primary Store Location
            loc, _ = StoreLocation.objects.get_or_create(
                owner=user,
                is_main=True,
                defaults={
                    'name': 'Main Branch',
                    'is_active': True,
                    'phone': sdata['phone'],
                    'whatsapp': sdata['whatsapp'],
                    'address_line': sdata['store_address'],
                    'city': 'Dar es Salaam',
                }
            )
            loc.is_active = True
            loc.address_line = sdata['store_address']
            loc.save()

            # Seed Products & Services
            created_prods = []
            for pdata in sdata['products']:
                prod, _ = Product.objects.get_or_create(
                    seller=user,
                    name=pdata['name'],
                    defaults={
                        'category': sdata['category'],
                        'price': pdata['price'],
                        'description': pdata['description'],
                        'condition': 'New',
                        'is_available': True,
                        'is_draft': False,
                        'pos_only': True,
                        'is_service': pdata['is_service'],
                        'validity_days': pdata.get('validity_days') or None,
                        'modifiers': pdata['modifiers'],
                        'stock': pdata.get('stock', 0),
                    }
                )
                prod.price = pdata['price']
                prod.description = pdata['description']
                prod.category = sdata['category']
                prod.is_service = pdata['is_service']
                prod.pos_only = True
                prod.is_available = True
                prod.validity_days = pdata.get('validity_days') or None
                prod.modifiers = pdata['modifiers']
                if not pdata['is_service']:
                    prod.stock = pdata.get('stock', 0)
                prod.save()
                created_prods.append(prod)

            # Seed Sample Service Passes
            if not sdata.get('passes'):
                CustomerServicePass.objects.filter(seller=user).delete()
            for pass_data in sdata.get('passes', []):
                prod_target = created_prods[pass_data['prod_index']]
                days = pass_data['days_left']
                exp_date = timezone.now() + timezone.timedelta(days=days)
                
                sp = CustomerServicePass.objects.filter(
                    seller=user,
                    customer_phone=pass_data['customer_phone']
                ).first()
                if not sp:
                    sp = CustomerServicePass(
                        seller=user,
                        customer_name=pass_data['customer_name'],
                        customer_phone=pass_data['customer_phone'],
                        product=prod_target,
                        start_date=timezone.now() - timezone.timedelta(days=max(0, 30 - days)),
                        expires_at=exp_date,
                        status=pass_data['status'],
                        check_in_count=pass_data['check_ins'],
                        last_checked_in=timezone.now() - timezone.timedelta(hours=4) if pass_data['check_ins'] > 0 else None,
                        notes=pass_data['notes'],
                    )
                    sp.save()
                else:
                    sp.expires_at = exp_date
                    sp.status = pass_data['status']
                    sp.check_in_count = pass_data['check_ins']
                    sp.notes = pass_data['notes']
                    sp.save()

            # Seed Sample Orders
            for odata in sdata.get('sample_orders', []):
                # Calculate total
                order_total = Decimal('0.00')
                line_items = []
                for item_spec in odata['items']:
                    target_p = created_prods[item_spec['prod_index']]
                    unit_p = target_p.price
                    for add in item_spec.get('addons', []):
                        unit_p += Decimal(str(add.get('price', 0)))
                    item_sub = unit_p * item_spec['qty']
                    order_total += item_sub
                    line_items.append((target_p, item_spec['qty'], unit_p, item_spec.get('addons', []), item_spec.get('attendant', '')))

                ord_obj = Order.objects.create(
                    user=user,
                    total_amount=order_total,
                    status='COMPLETED',
                    is_completed=True,
                    shipping_method='PICKUP',
                    fulfillment_type='SELLER_PICKUP',
                    delivery_info={
                        'is_pos': True,
                        'customer_name': odata['customer_name'],
                        'customer_phone': odata['customer_phone'],
                        'order_type': odata['order_type'],
                        'table_number': odata.get('table_number', ''),
                        'pickup_required': odata.get('pickup_required', False),
                        'pickup_promised_time': odata.get('pickup_time', ''),
                        'claim_ticket_code': odata.get('claim_code', ''),
                        'amount_paid': float(order_total),
                        'amount_tendered': float(order_total),
                        'change_due': 0.0,
                        'discount_amount': 0.0,
                        'location_id': loc.id,
                        'location_name': loc.name,
                    }
                )
                for p_obj, qty, price, addons, att in line_items:
                    OrderItem.objects.create(
                        order=ord_obj,
                        product=p_obj,
                        quantity=qty,
                        price=price,
                        selected_addons=addons,
                        attendant_name=att,
                    )

            self.stdout.write(self.style.SUCCESS(
                f"✓ Merchant seeded: @{uname} ({sdata['business_name']}) - {len(sdata['products'])} items, {len(sdata.get('passes', []))} passes."
            ))

        self.stdout.write(self.style.SUCCESS("\n--- All 5 Seller Lite Sample Merchants Seeded Successfully! ---"))
        self.stdout.write(self.style.NOTICE("Login credentials for all accounts: Password123!"))
