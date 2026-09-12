from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from marketplace.models import ReservedUsername
from marketplace.username_rules import (
    STATIC_SYSTEM_ROUTES, STATIC_STAFF_KEYWORDS, STATIC_TECHNICAL_KEYWORDS,
    STATIC_HIGH_VALUE_WORDS, BASELINE_POPULAR_BRANDS, canonicalize_username,
    validate_username_availability
)

class Command(BaseCommand):
    help = "Audits existing users for reserved username collisions and seeds the ReservedUsername registry."

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("=== 1. AUDITING EXISTING USERS ==="))
        existing_users = User.objects.all().order_by('id')
        flagged_users = []

        for u in existing_users:
            c_name = canonicalize_username(u.username)
            is_avail, reason, code, meta = validate_username_availability(c_name, requesting_user=u, check_db=False)
            if not is_avail:
                flagged_users.append((u, code, reason, meta))

        if flagged_users:
            self.stdout.write(self.style.WARNING(f"Found {len(flagged_users)} existing user(s) matching reserved rules:"))
            for u, code, reason, meta in flagged_users:
                staff_tag = "[SUPERUSER]" if u.is_superuser else ("[STAFF]" if u.is_staff else "[NORMAL]")
                self.stdout.write(f"  • User #{u.id} '{u.username}' {staff_tag} -> Triggered {code} ({meta.get('tier')})")
                self.stdout.write(f"    Reason: {reason}")
        else:
            self.stdout.write(self.style.SUCCESS("No existing normal users collide with reserved system rules."))

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== 2. SEEDING RESERVED USERNAMES TABLE ==="))

        seed_data = [
            # Auto Manufacturers & OEMs
            ('toyota', 'brand_trademark', 'Toyota Motor Corporation OEM brand'),
            ('nissan', 'brand_trademark', 'Nissan Motor Co. OEM brand'),
            ('honda', 'brand_trademark', 'Honda Motor Company OEM brand'),
            ('mitsubishi', 'brand_trademark', 'Mitsubishi Motors OEM brand'),
            ('mazda', 'brand_trademark', 'Mazda Motor Corporation OEM brand'),
            ('subaru', 'brand_trademark', 'Subaru Corporation OEM brand'),
            ('suzuki', 'brand_trademark', 'Suzuki Motor Corporation OEM brand'),
            ('isuzu', 'brand_trademark', 'Isuzu Motors OEM brand'),
            ('mercedes', 'brand_trademark', 'Mercedes-Benz Group AG OEM brand'),
            ('benz', 'brand_trademark', 'Mercedes-Benz abbreviation'),
            ('mercedes-benz', 'brand_trademark', 'Mercedes-Benz official trademark'),
            ('bmw', 'brand_trademark', 'Bayerische Motoren Werke AG OEM brand'),
            ('audi', 'brand_trademark', 'Audi AG OEM brand'),
            ('volkswagen', 'brand_trademark', 'Volkswagen AG OEM brand'),
            ('vw', 'brand_trademark', 'Volkswagen abbreviation'),
            ('ford', 'brand_trademark', 'Ford Motor Company OEM brand'),
            ('hyundai', 'brand_trademark', 'Hyundai Motor Company OEM brand'),
            ('kia', 'brand_trademark', 'Kia Corporation OEM brand'),
            ('landrover', 'brand_trademark', 'Jaguar Land Rover OEM brand'),
            ('rangerover', 'brand_trademark', 'Range Rover vehicle brand'),
            ('peugeot', 'brand_trademark', 'Peugeot / Stellantis OEM brand'),
            ('renault', 'brand_trademark', 'Renault Group OEM brand'),
            ('volvo', 'brand_trademark', 'Volvo Cars / Trucks OEM brand'),
            ('scania', 'brand_trademark', 'Scania Commercial Vehicles OEM brand'),
            ('man', 'brand_trademark', 'MAN Truck & Bus OEM brand'),
            ('tata', 'brand_trademark', 'Tata Motors OEM brand'),
            ('sinotruk', 'brand_trademark', 'Sinotruk Commercial Vehicles OEM brand'),
            ('howo', 'brand_trademark', 'Sinotruk HOWO vehicle line'),
            ('fuso', 'brand_trademark', 'Mitsubishi Fuso Truck and Bus Corp'),
            ('yamaha', 'brand_trademark', 'Yamaha Motor Company OEM brand'),
            ('bajaj', 'brand_trademark', 'Bajaj Auto OEM brand'),
            ('tvs', 'brand_trademark', 'TVS Motor Company OEM brand'),

            # Auto Parts & Fluids
            ('bosch', 'brand_trademark', 'Robert Bosch GmbH automotive systems & parts'),
            ('denso', 'brand_trademark', 'Denso Corporation automotive components'),
            ('ngk', 'brand_trademark', 'NGK Spark Plug Co. components'),
            ('brembo', 'brand_trademark', 'Brembo S.p.A. braking systems'),
            ('aisin', 'brand_trademark', 'Aisin Corporation drivetrain & auto components'),
            ('kyb', 'brand_trademark', 'KYB Corporation suspension & shocks'),
            ('valeo', 'brand_trademark', 'Valeo automotive supplier'),
            ('mobil', 'brand_trademark', 'Mobil / ExxonMobil automotive lubricants'),
            ('total', 'brand_trademark', 'TotalEnergies lubricants & fuel'),
            ('totalenergies', 'brand_trademark', 'TotalEnergies corporate trademark'),
            ('shell', 'brand_trademark', 'Shell plc lubricants & fuel'),
            ('castrol', 'brand_trademark', 'Castrol lubricants & oils'),
            ('bridgestone', 'brand_trademark', 'Bridgestone Corporation tires'),
            ('michelin', 'brand_trademark', 'Michelin tire manufacturer'),
            ('pirelli', 'brand_trademark', 'Pirelli & C. S.p.A. tires'),
            ('goodyear', 'brand_trademark', 'Goodyear Tire & Rubber Company'),
            ('dunlop', 'brand_trademark', 'Dunlop Tires brand'),
            ('yokohama', 'brand_trademark', 'Yokohama Rubber Company tires'),

            # Tanzanian Telecom, Banking & Conglomerates
            ('mpesa', 'brand_trademark', 'Vodacom M-Pesa mobile money service'),
            ('m-pesa', 'brand_trademark', 'Vodacom M-Pesa trademark variant'),
            ('vodacom', 'brand_trademark', 'Vodacom Tanzania telecommunications PLC'),
            ('airtel', 'brand_trademark', 'Airtel Tanzania telecommunications'),
            ('airtelmoney', 'brand_trademark', 'Airtel Money mobile financial service'),
            ('tigo', 'brand_trademark', 'Tigo / Yas Tanzania telecommunications'),
            ('tigopesa', 'brand_trademark', 'Tigo Pesa mobile financial service'),
            ('halotel', 'brand_trademark', 'Viettel Halotel Tanzania telecommunications'),
            ('halopesa', 'brand_trademark', 'HaloPesa mobile financial service'),
            ('ttcl', 'brand_trademark', 'Tanzania Telecommunications Corporation'),
            ('crdb', 'brand_trademark', 'CRDB Bank PLC financial institution'),
            ('nmb', 'brand_trademark', 'NMB Bank PLC financial institution'),
            ('stanbic', 'brand_trademark', 'Stanbic Bank Tanzania'),
            ('nbc', 'brand_trademark', 'National Bank of Commerce Tanzania'),
            ('kcb', 'brand_trademark', 'KCB Bank Tanzania'),
            ('equity', 'brand_trademark', 'Equity Bank Tanzania'),
            ('selcom', 'brand_trademark', 'Selcom Paytech Tanzania payment aggregator'),
            ('azampay', 'brand_trademark', 'AzamPay payment rail'),
            ('azam', 'brand_trademark', 'Bakhresa Group Azam brand'),
            ('bakhresa', 'brand_trademark', 'Said Salim Bakhresa & Co Ltd'),
            ('metl', 'brand_trademark', 'Mohammed Enterprises Tanzania Limited'),
            ('mo', 'brand_trademark', 'MeTL Group brand identifier'),

            # Global Tech & Commerce
            ('apple', 'brand_trademark', 'Apple Inc. global brand'),
            ('google', 'brand_trademark', 'Google LLC / Alphabet global brand'),
            ('microsoft', 'brand_trademark', 'Microsoft Corporation global brand'),
            ('amazon', 'brand_trademark', 'Amazon.com Inc. global brand'),
            ('meta', 'brand_trademark', 'Meta Platforms Inc. global brand'),
            ('facebook', 'brand_trademark', 'Facebook social platform'),
            ('whatsapp', 'brand_trademark', 'WhatsApp messaging platform'),
            ('instagram', 'brand_trademark', 'Instagram media platform'),
            ('tiktok', 'brand_trademark', 'TikTok / ByteDance platform'),
            ('twitter', 'brand_trademark', 'X Corp / Twitter platform'),
            ('samsung', 'brand_trademark', 'Samsung Electronics Co. Ltd.'),
            ('sony', 'brand_trademark', 'Sony Corporation electronics'),
            ('lg', 'brand_trademark', 'LG Electronics'),
            ('huawei', 'brand_trademark', 'Huawei Technologies'),
            ('xiaomi', 'brand_trademark', 'Xiaomi Corporation'),
            ('paypal', 'brand_trademark', 'PayPal Holdings Inc.'),
            ('stripe', 'brand_trademark', 'Stripe Inc. payments'),
            ('visa', 'brand_trademark', 'Visa Inc. payment network'),
            ('mastercard', 'brand_trademark', 'Mastercard Incorporated payment network'),

            # Platform & Security Impersonation Shields
            ('sokonimax', 'staff_official', 'Primary platform name'),
            ('uzaspea', 'staff_official', 'Core marketplace brand name'),
            ('sokonimax_official', 'staff_official', 'Official platform announcement channel'),
            ('sokonimax_support', 'staff_official', 'Official support helpdesk channel'),
            ('uzaspea_support', 'staff_official', 'Official support helpdesk channel'),
            ('helpdesk', 'staff_official', 'Platform helpdesk identifier'),
            ('support', 'staff_official', 'Customer support authority handle'),
            ('billing', 'staff_official', 'Platform finance and billing department'),
            ('verification', 'staff_official', 'Platform trust and merchant verification'),
            ('security', 'staff_official', 'Platform security and abuse prevention team'),
            ('inspector', 'staff_official', 'Official vehicle inspection service handle'),
            ('moderator', 'staff_official', 'Community moderation team'),

            # High-Value Dictionary & Generic Commerce Words
            ('one', 'vip_premium', 'High-value dictionary number word'),
            ('two', 'vip_premium', 'High-value dictionary number word'),
            ('three', 'vip_premium', 'High-value dictionary number word'),
            ('store', 'vip_premium', 'Generic commerce term reserved for marketplace'),
            ('shop', 'vip_premium', 'Generic commerce term reserved for marketplace'),
            ('market', 'vip_premium', 'Generic commerce term reserved for marketplace'),
            ('deals', 'vip_premium', 'Promotional keyword reserved for platform campaigns'),
            ('vip', 'vip_premium', 'Special VIP membership identifier'),
            ('pro', 'vip_premium', 'Special Pro tier identifier'),
        ]

        created_count = 0
        skipped_count = 0

        for uname, category, reason in seed_data:
            obj, created = ReservedUsername.objects.get_or_create(
                username=canonicalize_username(uname),
                defaults={
                    'category': category,
                    'reason': reason,
                    'is_active': True
                }
            )
            if created:
                created_count += 1
            else:
                skipped_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Seeding completed successfully! Created: {created_count}, Existing/Skipped: {skipped_count}. Total in DB: {ReservedUsername.objects.count()}"
        ))
