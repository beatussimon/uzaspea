from django.core.management.base import BaseCommand
from inspections.models import InspectionCategory, ChecklistTemplate, ChecklistItem

class Command(BaseCommand):
    help = 'Seeds comprehensive inspection categories and checklist templates'

    def create_template(self, category, items):
        template, _ = ChecklistTemplate.objects.get_or_create(
            category=category, version=1, defaults={'is_active': True}
        )
        for order_idx, (label, ctype, mandatory, fail_flags, unit, help_text) in enumerate(items):
            ChecklistItem.objects.get_or_create(
                template=template, label=label,
                defaults={
                    'item_type': ctype, 'is_mandatory': mandatory,
                    'order': order_idx, 'fail_triggers_flag': fail_flags,
                    'unit': unit, 'help_text': help_text
                }
            )

    def handle(self, *args, **options):
        # ── VEHICLES DOMAIN ──
        vehicles, _ = InspectionCategory.objects.get_or_create(name='Vehicles', defaults={'level': 'domain', 'base_price': 0})
        cars, _ = InspectionCategory.objects.get_or_create(name='Cars & SUVs', parent=vehicles, defaults={'level': 'category', 'base_price': 60000, 'required_inspector_level': 'senior'})
        motorcycles, _ = InspectionCategory.objects.get_or_create(name='Motorcycles & Boda Boda', parent=vehicles, defaults={'level': 'category', 'base_price': 35000})
        trucks, _ = InspectionCategory.objects.get_or_create(name='Trucks & Commercial', parent=vehicles, defaults={'level': 'category', 'base_price': 90000, 'required_inspector_level': 'specialist'})

        # ── ELECTRONICS DOMAIN ──
        electronics, _ = InspectionCategory.objects.get_or_create(name='Electronics', defaults={'level': 'domain', 'base_price': 0})
        phones, _ = InspectionCategory.objects.get_or_create(name='Smartphones & Tablets', parent=electronics, defaults={'level': 'category', 'base_price': 25000})
        laptops, _ = InspectionCategory.objects.get_or_create(name='Laptops & Computers', parent=electronics, defaults={'level': 'category', 'base_price': 35000, 'required_inspector_level': 'senior'})
        tv_audio, _ = InspectionCategory.objects.get_or_create(name='TVs & Audio Equipment', parent=electronics, defaults={'level': 'category', 'base_price': 20000})

        # ── PROPERTY DOMAIN ──
        property_domain, _ = InspectionCategory.objects.get_or_create(name='Property', defaults={'level': 'domain', 'base_price': 0})
        residential, _ = InspectionCategory.objects.get_or_create(name='Residential Property', parent=property_domain, defaults={'level': 'category', 'base_price': 150000, 'required_inspector_level': 'specialist'})
        commercial, _ = InspectionCategory.objects.get_or_create(name='Commercial Property', parent=property_domain, defaults={'level': 'category', 'base_price': 200000, 'required_inspector_level': 'specialist'})
        land, _ = InspectionCategory.objects.get_or_create(name='Land & Plots', parent=property_domain, defaults={'level': 'category', 'base_price': 80000, 'required_inspector_level': 'senior'})

        # ── MACHINERY DOMAIN ──
        machinery, _ = InspectionCategory.objects.get_or_create(name='Machinery & Equipment', defaults={'level': 'domain', 'base_price': 0})
        generators, _ = InspectionCategory.objects.get_or_create(name='Generators & Power', parent=machinery, defaults={'level': 'category', 'base_price': 50000, 'required_inspector_level': 'senior'})
        agri, _ = InspectionCategory.objects.get_or_create(name='Agricultural Equipment', parent=machinery, defaults={'level': 'category', 'base_price': 70000, 'required_inspector_level': 'specialist'})

        # ═══ COMPREHENSIVE CHECKLISTS ═══

        # CARS — 45 items
        self.create_template(cars, [
            # Engine & Drivetrain (12 items)
            ('Engine Start & Idle Quality', 'pass_fail', True, True, '', 'Cold start and warm idle — listen for knocking, misfires, rough idle'),
            ('Engine Oil Level & Condition', 'pass_fail', True, True, '', 'Check dipstick — color, level, milky appearance indicates water ingress'),
            ('Coolant Level & Condition', 'pass_fail', True, True, '', 'Check reservoir and radiator cap — rust or oil contamination'),
            ('Transmission Shift Quality (All Gears)', 'scale', True, True, '', 'Test all gears including reverse — slipping, grinding, delays'),
            ('Clutch Engagement Point (Manual)', 'pass_fail', False, False, '', 'Clutch biting point — high biting point indicates wear'),
            ('Engine Oil Leaks (Visual)', 'pass_fail', True, True, '', 'Check under hood and beneath car for oil drips or seeping gaskets'),
            ('Timing Belt/Chain Condition', 'pass_fail', True, True, '', 'Check service history — timing belt typically replaced at 80,000–100,000 km'),
            ('Exhaust Smoke Color & Odor', 'pass_fail', True, True, '', 'Blue=oil burn, White=coolant burn, Black=rich mixture — all fail triggers'),
            ('Power Steering Fluid Level', 'pass_fail', True, False, '', 'Check reservoir — low level may indicate leak'),
            ('Drive Shaft & CV Joints', 'pass_fail', True, True, '', 'Turn steering full lock and accelerate — clicking indicates CV joint failure'),
            ('Fuel System (No Leaks, Correct Pressure)', 'pass_fail', True, True, '', 'Check for fuel smell, leaks at injectors and fuel lines'),
            ('Engine Compression Test', 'measurement', False, True, 'PSI', 'Cylinder compression — deviation >10% between cylinders is fail trigger'),

            # Body & Exterior (10 items)
            ('Paintwork Condition & Color Match', 'scale', True, False, '', 'Use paint thickness gauge if available — respray indicates accident repair'),
            ('Panel Gaps & Alignment', 'scale', True, True, '', 'Uneven gaps indicate accident damage or poor repair'),
            ('Rust & Corrosion Assessment', 'scale', True, True, '', 'Check wheel arches, sills, floor, chassis — structural rust is fail'),
            ('Glass & Windscreen (Chips/Cracks)', 'pass_fail', True, False, '', 'Any crack in driver sight line is mandatory replacement'),
            ('Doors, Boot & Bonnet Operation', 'pass_fail', True, False, '', 'All should open, close and latch smoothly with proper alignment'),
            ('VIN/Chassis Number Verification', 'pass_fail', True, True, '', 'Match chassis plate, windscreen sticker and registration documents — mismatch is fraud flag'),
            ('Undercarriage Rust & Damage', 'pass_fail', True, True, '', 'Lift vehicle or use mirror — check chassis rails, floor pan, crossmembers'),
            ('Airbag System (Warning Light)', 'pass_fail', True, True, '', 'SRS warning light off after startup — if on, system is compromised'),
            ('Headlights, Taillights & Indicators', 'pass_fail', True, False, '', 'All lights operational including hazards, reversing lights, number plate light'),
            ('Wiper Blades & Washer System', 'pass_fail', False, False, '', 'Wiper sweep quality and washer jet aim'),

            # Suspension & Brakes (10 items)
            ('Front Shock Absorbers', 'scale', True, True, '', 'Bounce test — should settle within 1–2 oscillations. Leaking = fail'),
            ('Rear Shock Absorbers', 'scale', True, True, '', 'Same bounce test — note any difference side-to-side'),
            ('Brake Pad Thickness (Front)', 'measurement', True, True, 'mm', 'Minimum legal thickness 3mm — below 2mm immediate fail'),
            ('Brake Pad Thickness (Rear)', 'measurement', True, True, 'mm', 'Check via caliper inspection or wheel removal if accessible'),
            ('Brake Disc Condition (Front & Rear)', 'scale', True, True, '', 'Check for scoring, warping, minimum thickness marking'),
            ('Handbrake Effectiveness', 'pass_fail', True, True, '', 'Should hold vehicle on gradient — count ratchet clicks (optimal 3–5)'),
            ('ABS System (Warning Light)', 'pass_fail', True, False, '', 'ABS light should go off after engine start — test on low-speed brake application'),
            ('Steering Play & Alignment', 'measurement', True, True, 'degrees', 'Measure free play in steering wheel — excessive play indicates worn rack or ball joints'),
            ('Wheel Bearing Condition', 'pass_fail', True, True, '', 'Jack each corner — wobble = bearing play. Spin wheel — grinding = worn bearing'),
            ('Tyre Tread Depth (All Four)', 'measurement', True, True, 'mm', 'Legal minimum 1.6mm — check inside, center, outside with tread gauge'),

            # Interior & Electrics (8 items)
            ('Air Conditioning (Cooling Temp)', 'measurement', True, False, '°C', 'Measure vent temperature — should reach 10–15°C on full cold'),
            ('All Power Windows Operation', 'pass_fail', True, False, '', 'Test up/down smoothness and auto-close on all windows'),
            ('Infotainment, Bluetooth & USB', 'pass_fail', False, False, '', 'Connect phone via Bluetooth and USB — test audio output'),
            ('Instrument Cluster (All Gauges)', 'pass_fail', True, True, '', 'Fuel, temperature, speedometer, warning lights — all should function'),
            ('Seat Belts (All Positions)', 'pass_fail', True, True, '', 'Test latch, retraction, and inertia lock on all seating positions'),
            ('Central Locking & Key Fob', 'pass_fail', False, False, '', 'All doors lock/unlock remotely and manually'),
            ('Interior Condition & Odor', 'scale', True, False, '', 'Mold, smoke, water damage odors — check under floor mats for damp'),
            ('Odometer Reading & Service History', 'text', True, True, '', 'Record exact reading — request full service book or digital history'),

            # Documentation (5 items)
            ('Registration Certificate (Log Book)', 'pass_fail', True, True, '', 'Verify owner name matches seller — request title transfer documents'),
            ('Insurance Certificate Validity', 'pass_fail', True, False, '', 'Note expiry date'),
            ('Road Worthiness Certificate', 'pass_fail', True, True, '', 'Valid certificate from SUMATRA'),
            ('Outstanding Finance Check', 'text', True, True, '', 'Ask seller to confirm no outstanding bank finance — request clearance letter if applicable'),
            ('Accident History Disclosure', 'text', True, True, '', 'Seller declaration of known accident history — cross-check with bodywork findings'),
        ])

        # SMARTPHONES & TABLETS — 28 items
        self.create_template(phones, [
            # Display (6 items)
            ('Screen Burn-In / Ghost Images', 'pass_fail', True, True, '', 'Display all-gray and all-white screens — ghost images indicate OLED burn-in'),
            ('Dead Pixels & Bright Spots', 'pass_fail', True, True, '', 'Display black screen — any lit pixels are dead/stuck pixel defects'),
            ('Touch Sensitivity (All Screen Zones)', 'pass_fail', True, True, '', 'Draw diagonal lines across all screen edges — dead zones indicate damage'),
            ('Screen Glass Condition (Cracks/Scratches)', 'scale', True, False, '', 'Check under bright light at angles — hairline cracks affect resale severely'),
            ('Display Brightness (Max & Auto)', 'measurement', True, False, 'nits', 'Max brightness should match device spec — dim display may indicate degraded backlight'),
            ('Face ID / Fingerprint Reader', 'pass_fail', False, False, '', 'Test biometric unlock — failures may indicate motherboard or sensor damage'),

            # Battery (5 items)
            ('Battery Health Percentage', 'measurement', True, True, '%', 'iOS: Settings > Battery > Battery Health. Android: Use AccuBattery app — below 80% is replacement threshold'),
            ('Charge Port Condition & Function', 'pass_fail', True, True, '', 'Inspect for bent pins, lint — test charging with known-good cable'),
            ('Wireless Charging (if applicable)', 'pass_fail', False, False, '', 'Test with compatible pad — functionality confirms charging coil intact'),
            ('Battery Swelling (Visual)', 'pass_fail', True, True, '', 'Screen lifting from body indicates swollen battery — immediate safety fail'),
            ('Charge Cycle Count', 'measurement', False, False, 'cycles', 'iOS: Use CoconutBattery or similar. Android: Battery info in system settings'),

            # Cameras (4 items)
            ('Rear Camera Photo Quality', 'scale', True, False, '', 'Photograph various subjects — check for autofocus speed, blur, lens marks'),
            ('Front Camera Photo Quality', 'scale', True, False, '', 'Selfie photo test — check sharpness and exposure'),
            ('Video Recording Stability', 'pass_fail', False, False, '', 'Record 30-second video — check stabilization, audio sync, 4K if applicable'),
            ('Camera Lens Condition (No Cracks)', 'pass_fail', True, True, '', 'Inspect physically — cracked lens causes haze in photos'),

            # Connectivity (5 items)
            ('SIM Card Slots & Network Reception', 'pass_fail', True, True, '', 'Insert test SIM — verify signal bars and voice call quality'),
            ('Wi-Fi Connection & Speed', 'pass_fail', True, False, '', 'Connect to known network — run speed test, check 5GHz band if applicable'),
            ('Bluetooth Pairing', 'pass_fail', True, False, '', 'Pair with headphones or speaker — test audio output quality'),
            ('GPS Accuracy', 'pass_fail', False, False, '', 'Open maps app outdoors — verify location accuracy within 10m'),
            ('NFC (if applicable)', 'pass_fail', False, False, '', 'Test with NFC-enabled payment terminal or tag'),

            # Hardware & Software (8 items)
            ('IMEI Verification', 'text', True, True, '', 'Dial *#06# — record both IMEIs. Check blacklist status on GSMA or local registry'),
            ('Speakers & Earpiece Quality', 'pass_fail', True, False, '', 'Play music at max volume — check for distortion. Test earpiece on a call'),
            ('Microphone (Voice & Noise Cancel)', 'pass_fail', True, False, '', 'Record voice memo and play back — check clarity and noise cancellation mic'),
            ('Vibration Motor', 'pass_fail', False, False, '', 'Enable haptic feedback — test vibration intensity and consistency'),
            ('Physical Buttons (Volume, Power, Mute)', 'pass_fail', True, False, '', 'Press all buttons — ensure tactile response and function'),
            ('Operating System Version & Updates', 'text', True, False, '', 'Record OS version — note if device can still receive security updates'),
            ('iCloud/Google Account Lock Status', 'pass_fail', True, True, '', 'Factory reset should proceed without account prompt — activation lock = fraud flag'),
            ('Water Damage Indicator', 'pass_fail', True, True, '', 'Check SIM slot for red water damage indicator strip — red/pink = water damage'),
        ])

        # RESIDENTIAL PROPERTY — 55 items
        self.create_template(residential, [
            # Structure (12 items)
            ('Foundation Condition (Visual)', 'pass_fail', True, True, '', 'Look for cracks, settlement, water staining around foundation'),
            ('Load-Bearing Wall Cracks', 'scale', True, True, '', 'Hairline=monitor, >3mm=structural concern, diagonal cracks=subsidence'),
            ('Roof Structure Integrity', 'pass_fail', True, True, '', 'Access roof space if possible — check for sagging rafters, rot, daylight through roof'),
            ('Roof Covering Condition', 'scale', True, True, '', 'Check tiles/iron sheets — cracked, missing, or rusted sheets cause leaks'),
            ('Ceiling Condition', 'scale', True, False, '', 'Water stains indicate past or current roof/plumbing leaks'),
            ('Floor Level & Structural Integrity', 'pass_fail', True, True, '', 'Check for bouncy or sloping floors indicating joist failure or subsidence'),
            ('External Wall Condition', 'scale', True, False, '', 'Check render, pointing, cracks — note any vegetation growth in cracks'),
            ('Damp Proof Course', 'pass_fail', True, True, '', 'Check for rising damp up to 1m on internal walls — tide marks, salt deposits'),
            ('Lintel Condition (Window & Door Openings)', 'pass_fail', True, True, '', 'Cracks above openings indicate failed or missing lintels'),
            ('Drainage Around Foundation', 'pass_fail', True, True, '', 'Ground should slope away from building — pooling water causes foundation damage'),
            ('Asbestos (if pre-1990 construction)', 'pass_fail', False, True, '', 'Flag any suspected asbestos roof/ceiling sheets — requires specialist test'),
            ('Structural Walls (No Unauthorized Removal)', 'pass_fail', True, True, '', 'Compare with any available plans — removed load-bearing walls are critical safety fail'),

            # Electrical (10 items)
            ('Consumer Unit / Fuse Box Condition', 'pass_fail', True, True, '', 'MCBs present, no scorch marks, proper labelling, RCD present'),
            ('Earthing & Bonding', 'pass_fail', True, True, '', 'Earth rod visible or confirmed — bonding to water and gas pipes'),
            ('Socket Outlets (Sample Test All Rooms)', 'pass_fail', True, True, '', 'Use socket tester — check live, neutral, earth wiring. Note polarity failures'),
            ('Lighting Circuit (All Rooms)', 'pass_fail', True, False, '', 'All light switches operate correct lights — check for non-functional switches'),
            ('ELCB/RCD Function Test', 'pass_fail', True, True, '', 'Press test button on RCD — should trip immediately'),
            ('Wiring Condition (Visible Sections)', 'scale', True, True, '', 'Fabric insulation indicates old pre-1960s wiring — flag for full rewire'),
            ('Outdoor/Garden Electrical Points', 'pass_fail', False, False, '', 'Check weatherproofing and RCD protection on external sockets'),
            ('Electric Meter & Tariff Type', 'text', True, False, '', 'Record meter number and type (prepaid/postpaid) — verify with utility provider'),
            ('Generator/Backup Power Connection', 'pass_fail', False, False, '', 'Check changeover switch — must prevent backfeed to mains grid'),
            ('Security Lighting & External Points', 'pass_fail', False, False, '', 'Motion sensors functional — dusk-to-dawn lights operational'),

            # Plumbing & Water (10 items)
            ('Water Supply Pressure', 'measurement', True, True, 'bar', 'Check pressure at kitchen tap — normal 1–3 bar. Low pressure indicates main issue'),
            ('Hot Water System (Geyser/Boiler)', 'pass_fail', True, False, '', 'Check age, pressure relief valve, anode rod condition, thermostat setting'),
            ('All Taps & Shower Mixers', 'pass_fail', True, False, '', 'Operate all taps — check for drips, correct hot/cold orientation'),
            ('Toilet Flush & Fill Valve', 'pass_fail', True, False, '', 'Flush — check fill time (should be <2 min), no continuous running'),
            ('Drain Waste & Overflow (All Basins/Baths)', 'pass_fail', True, False, '', 'Fill and drain — check flow rate and no backup between fixtures'),
            ('Waste Pipe & Soil Pipe Condition', 'pass_fail', True, True, '', 'Check for leaks, blockages, proper fall gradient, correct venting'),
            ('Roof Gutters & Downpipes', 'pass_fail', True, False, '', 'Check joints for gaps, blockages, and correct fall to downpipe'),
            ('Septic Tank / Sewage Connection', 'text', True, True, '', 'Confirm connection type — if septic: last emptying date, leach field condition'),
            ('Water Meter & Connection', 'text', True, False, '', 'Record meter reading and confirm correct property connection'),
            ('Underground Pipe Condition', 'pass_fail', False, False, '', 'CCTV drain survey recommended for older properties — flagged if suspected blockage'),

            # Security & Safety (8 items)
            ('Door Lock Quality (All External Doors)', 'scale', True, False, '', 'Check deadbolt throw, frame condition, door material thickness'),
            ('Window Locks & Security', 'scale', True, False, '', 'Test all window locks — note any that cannot be secured'),
            ('Perimeter Wall / Fence Condition', 'scale', True, False, '', 'Check height, structural integrity, anti-climb measures'),
            ('Gate & Gate Motor', 'pass_fail', False, False, '', 'Gate motor operation, remote function, manual override'),
            ('Smoke Detectors', 'pass_fail', True, True, '', 'Test each detector — mandatory in bedrooms and hallways'),
            ('Fire Extinguisher (Present & Valid)', 'pass_fail', False, False, '', 'Check pressure gauge and service date'),
            ('CCTV System (if present)', 'pass_fail', False, False, '', 'Check camera coverage, recording function, night vision'),
            ('Burglar Alarm System', 'pass_fail', False, False, '', 'Test arm/disarm — verify zones cover all entry points'),

            # Interior Finishes (8 items)
            ('Kitchen Units & Worktops', 'scale', True, False, '', 'Check door hinges, worktop condition, water damage under sink'),
            ('Bathroom Tiles & Grouting', 'scale', True, False, '', 'Loose tiles indicate water ingress behind — press each tile to check'),
            ('Floor Covering Condition (All Rooms)', 'scale', True, False, '', 'Tiles, timber, carpet — note damage, lifting edges, squeaks'),
            ('Internal Door Condition & Operation', 'scale', True, False, '', 'All should close and latch — sticking indicates structural movement'),
            ('Wall Finishes & Paintwork', 'scale', False, False, '', 'Note cracks, staining, flaking paint — may indicate damp'),
            ('Built-In Storage & Wardrobes', 'scale', False, False, '', 'Check internal condition, hinges, rail strength'),
            ('Kitchen Appliances (if included)', 'pass_fail', False, False, '', 'Test cooker, oven, extractor, dishwasher if included in sale'),
            ('Air Conditioning Units', 'pass_fail', False, False, '', 'Test cooling and heating modes — check filter condition and drainage'),

            # Documentation & Compliance (7 items)
            ('Title Deed Verification', 'text', True, True, '', 'Original title deed — check owner name, plot number, registered area'),
            ('Survey Plan (Cadastral)', 'text', True, True, '', 'Compare physical boundaries with survey plan — encroachments are fail'),
            ('Building Permit & Approved Plans', 'pass_fail', True, True, '', 'All structures must have approved permits — unauthorized extensions are flagged'),
            ('Occupancy Certificate', 'pass_fail', True, True, '', 'Certificate of occupancy from municipality — required for habitation'),
            ('Land Rates & Service Charges (Up to Date)', 'text', True, True, '', 'Request rates clearance certificate — unpaid rates transfer to new owner'),
            ('Utility Bills & Accounts', 'text', True, False, '', 'Check water and electricity accounts are in seller name — request clearance'),
            ('Encumbrances & Caveats', 'text', True, True, '', 'Search title for mortgages, caveats, court orders — any found = fail trigger'),
        ])

        # LAPTOPS — 22 items
        self.create_template(laptops, [
            ('Display (Dead Pixels, Backlight Bleed)', 'pass_fail', True, True, '', 'Display solid colors — check corners for backlight bleed'),
            ('Screen Hinge Condition', 'scale', True, False, '', 'Open/close — should hold position at all angles without wobble'),
            ('Keyboard (All Keys Function)', 'pass_fail', True, False, '', 'Use keyboard test website — check every key including Fn combinations'),
            ('Trackpad (Click & Gesture)', 'pass_fail', True, False, '', 'Test click, right-click, two-finger scroll, pinch-to-zoom'),
            ('Battery Cycle Count & Health', 'measurement', True, True, 'cycles', 'Windows: powercfg /batteryreport. Mac: System Info > Power — note design vs full capacity'),
            ('RAM Amount & Type', 'text', True, False, 'GB', 'Verify installed RAM matches advertised spec'),
            ('Storage Drive Health (SMART Data)', 'pass_fail', True, True, '', 'Run CrystalDiskInfo (Win) or DiskScan (Mac) — any SMART warnings = fail trigger'),
            ('Storage Capacity & Type (SSD/HDD)', 'text', True, False, 'GB', 'Verify actual storage matches spec — check if original or upgraded'),
            ('Processor (Benchmark Score)', 'measurement', False, False, 'score', 'Run Cinebench or PassMark — compare to known good score for that CPU'),
            ('GPU (if dedicated) Function', 'pass_fail', False, False, '', 'Stress test with GPU-Z or render test — check temperatures and artifacts'),
            ('USB Ports (All Types & Speeds)', 'pass_fail', True, False, '', 'Test each USB port with USB 3.0 drive — verify transfer speed'),
            ('HDMI / DisplayPort Output', 'pass_fail', False, False, '', 'Connect external monitor — verify signal and resolution'),
            ('Wi-Fi & Bluetooth', 'pass_fail', True, False, '', 'Connect to 5GHz and 2.4GHz — run speed test'),
            ('Webcam & Microphone', 'pass_fail', True, False, '', 'Test video call quality — check autofocus and audio clarity'),
            ('Speakers & Headphone Jack', 'pass_fail', True, False, '', 'Play audio — check for distortion at volume. Test 3.5mm jack'),
            ('Cooling System (Temperatures Under Load)', 'measurement', True, True, '°C', 'Run stress test for 5 min — CPU should not exceed 95°C. Throttling = fail'),
            ('Chassis Condition (Cracks, Warping)', 'scale', True, False, '', 'Check lid, base, and palm rest — cracks near hinge indicate drop damage'),
            ('Serial Number & BIOS Info', 'text', True, True, '', 'Record serial — check against any blacklist or theft registry'),
            ('Operating System & License', 'text', True, False, '', 'Note OS version and whether license is genuine and transferable'),
            ('Charger & Cable Condition', 'pass_fail', False, False, '', 'Check charger for fraying, correct wattage, and charging speed'),
            ('Battery Run-Time Test', 'measurement', True, False, 'hours', 'Discharge from 100% at normal load — note time to 20%'),
            ('Fan Noise & Vibration', 'scale', True, False, '', 'Excessive fan noise at idle indicates cooling paste degradation or failing fan'),
        ])

        # GENERATORS — 18 items
        self.create_template(generators, [
            ('Engine Start (Cold & Warm)', 'pass_fail', True, True, '', 'Cold start without choke assistance after warm-up — ease of starting indicates condition'),
            ('Engine Oil Level & Condition', 'pass_fail', True, True, '', 'Check dipstick — dark sludge indicates neglected maintenance'),
            ('Output Voltage (No Load)', 'measurement', True, True, 'V', '220–240V nominal — outside ±10% indicates regulator fault'),
            ('Output Voltage (Full Load)', 'measurement', True, True, 'V', 'Apply rated load — voltage should remain stable within ±5%'),
            ('Output Frequency', 'measurement', True, True, 'Hz', '50Hz nominal — check with meter under load'),
            ('Fuel Leaks (Tank, Lines, Carb)', 'pass_fail', True, True, '', 'Fuel smell or drips — immediate fail, fire hazard'),
            ('Air Filter Condition', 'scale', True, False, '', 'Remove and inspect — heavily clogged affects performance'),
            ('Spark Plug Condition', 'scale', True, False, '', 'Remove plug — check electrode gap, carbon fouling, oil fouling'),
            ('Automatic Voltage Regulator (AVR)', 'pass_fail', True, True, '', 'Confirm AVR type and operation — protects connected equipment'),
            ('Circuit Breaker & Overload Protection', 'pass_fail', True, True, '', 'Test trip function — breaker should trip at rated amperage'),
            ('Earth Connection', 'pass_fail', True, True, '', 'Verify proper earth stake connected — essential for safety'),
            ('Fuel Tank Capacity & Condition', 'measurement', True, False, 'L', 'Confirm tank capacity, check for rust inside tank'),
            ('Runtime Per Tank (Tested)', 'measurement', True, False, 'hours', 'Run until empty at 75% load — compare to manufacturer spec'),
            ('Noise Level', 'measurement', False, False, 'dB', 'Measure at 7 metres — relevant for residential use'),
            ('Control Panel (Meters & Switches)', 'pass_fail', True, False, '', 'All meters and switches operational — hourmeter shows actual use'),
            ('Battery (Electric Start Models)', 'pass_fail', False, False, '', 'Battery condition and cold cranking performance'),
            ('Frame & Body Condition', 'scale', True, False, '', 'Rust, cracks in frame, wheel condition'),
            ('Service History & Hours', 'text', True, False, 'hours', 'Record hourmeter reading — oil change due every 250 hours'),
        ])

        self.stdout.write(self.style.SUCCESS('Seeded comprehensive inspection checklists successfully'))
