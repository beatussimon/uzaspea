import json
from decimal import Decimal
from django.db import transaction
from django.utils.text import slugify
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from marketplace.models import Category, Brand, ReferenceProduct, Product

User = get_user_model()

# ==============================================================================
# 1. SPECIFICATION SCHEMAS FOR ALL TECHNICAL CATEGORIES
# ==============================================================================

COMPUTERS_SCHEMA = [
    {"key": "form_factor", "label": "Form Factor", "type": "select", "options": ["Traditional Laptop", "2-in-1 Convertible / Touch", "Ultrabook", "Gaming Laptop", "Mobile Workstation", "Desktop Tower", "Mini PC / Micro", "All-in-One (AIO)"], "required": True, "filterable": True, "display_order": 1},
    {"key": "processor_brand", "label": "Processor Brand", "type": "select", "options": ["Intel", "AMD", "Apple Silicon", "Qualcomm Snapdragon"], "required": True, "filterable": True, "display_order": 2},
    {"key": "processor_generation", "label": "Processor Generation", "type": "select", "options": ["Intel Core Ultra", "Intel 14th Gen Core", "Intel 13th Gen Core", "Intel 12th Gen Core", "Intel 11th Gen Core", "Intel 10th Gen Core", "Intel 8th/9th Gen Core", "Intel 4th-7th Gen Core", "AMD Ryzen 9000 Series", "AMD Ryzen 8000/7000 Series", "AMD Ryzen 5000 Series", "Apple M4 / M4 Pro / M4 Max", "Apple M3 / M3 Pro / M3 Max", "Apple M2 / M2 Pro / M2 Max", "Apple M1 / M1 Pro / M1 Max", "Qualcomm Snapdragon X Elite"], "required": True, "filterable": True, "display_order": 3},
    {"key": "processor_model", "label": "Processor Model", "type": "text", "required": False, "filterable": True, "display_order": 4},
    {"key": "ram_size_gb", "label": "RAM Size", "type": "select", "unit": "GB", "options": ["4GB", "8GB", "16GB", "24GB", "32GB", "64GB", "128GB"], "required": True, "filterable": True, "display_order": 5},
    {"key": "storage_capacity", "label": "Storage Capacity", "type": "select", "options": ["128GB", "256GB", "512GB", "1TB", "2TB", "4TB"], "required": True, "filterable": True, "display_order": 6},
    {"key": "storage_type", "label": "Storage Type", "type": "select", "options": ["NVMe M.2 PCIe SSD", "SATA SSD", "HDD", "eMMC Flash", "SSD + HDD Dual"], "required": False, "filterable": True, "display_order": 7},
    {"key": "screen_size_inch", "label": "Screen Size", "type": "select", "unit": "inch", "options": ["11.6\"", "12.5\"", "13.3\"", "13.6\"", "14.0\"", "14.2\"", "15.6\"", "16.0\"", "16.2\"", "17.3\"", "24.0\" (AIO)", "27.0\" (AIO)"], "required": False, "filterable": True, "display_order": 8},
    {"key": "display_resolution", "label": "Resolution", "type": "select", "options": ["HD (1366x768)", "FHD (1920x1080)", "FHD+ (1920x1200)", "2K / QHD (2560x1440)", "3K / 3.5K OLED", "4K UHD (3840x2160)", "Liquid Retina XDR"], "required": False, "filterable": True, "display_order": 9},
    {"key": "graphics_type", "label": "Graphics Architecture", "type": "select", "options": ["Integrated Graphics", "Dedicated NVIDIA RTX 40-Series", "Dedicated NVIDIA RTX 30-Series", "Dedicated NVIDIA GTX-Series", "Dedicated AMD Radeon", "Apple Unified GPU"], "required": True, "filterable": True, "display_order": 10},
    {"key": "gpu_model", "label": "GPU Model", "type": "text", "required": False, "filterable": True, "display_order": 11},
    {"key": "operating_system", "label": "Operating System", "type": "select", "options": ["macOS", "Windows 11 Pro", "Windows 11 Home", "Windows 10 Pro", "Windows 10 Home", "ChromeOS", "Ubuntu Linux", "FreeDOS / No OS"], "required": True, "filterable": True, "display_order": 12}
]

SMARTPHONES_SCHEMA = [
    {"key": "device_type", "label": "Device Classification", "type": "select", "options": ["Smartphone", "Tablet", "Feature Phone", "Smartwatch / Wearable"], "required": True, "filterable": True, "display_order": 1},
    {"key": "ram_size_gb", "label": "RAM Capacity", "type": "select", "unit": "GB", "options": ["2GB", "3GB", "4GB", "6GB", "8GB", "12GB", "16GB", "24GB"], "required": True, "filterable": True, "display_order": 2},
    {"key": "storage_internal", "label": "Internal Storage", "type": "select", "options": ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"], "required": True, "filterable": True, "display_order": 3},
    {"key": "network_generation", "label": "Network Connectivity", "type": "select", "options": ["5G", "4G LTE", "3G", "2G Only"], "required": True, "filterable": True, "display_order": 4},
    {"key": "screen_size_inch", "label": "Screen Size", "type": "select", "unit": "inch", "options": ["< 5.0\"", "5.0\" - 5.9\"", "6.0\" - 6.4\"", "6.5\" - 6.7\"", "6.8\" - 6.9\"", "7.0\" - 8.9\" (Compact Tablet)", "10.0\" - 11.5\" (Standard Tablet)", "12.0\" - 14.6\" (Pro Tablet)"], "required": False, "filterable": True, "display_order": 5},
    {"key": "display_type", "label": "Display Technology", "type": "select", "options": ["Dynamic AMOLED 2X", "Super AMOLED", "LTPO OLED", "OLED", "IPS LCD", "Foldable AMOLED"], "required": False, "filterable": True, "display_order": 6},
    {"key": "refresh_rate_hz", "label": "Refresh Rate", "type": "select", "unit": "Hz", "options": ["60Hz", "90Hz", "120Hz", "144Hz", "165Hz"], "required": False, "filterable": True, "display_order": 7},
    {"key": "main_camera_mp", "label": "Main Camera Resolution", "type": "select", "unit": "MP", "options": ["12MP - 13MP", "48MP - 50MP", "64MP", "108MP", "200MP"], "required": False, "filterable": True, "display_order": 8},
    {"key": "battery_capacity_mah", "label": "Battery Capacity", "type": "select", "unit": "mAh", "options": ["< 3000 mAh", "3000 - 3999 mAh", "4000 - 4800 mAh", "5000 mAh", "6000 mAh", "7000+ mAh", "8000 - 11200 mAh (Tablet)"], "required": False, "filterable": True, "display_order": 9},
    {"key": "charging_wattage", "label": "Charging Speed", "type": "select", "unit": "W", "options": ["10W - 15W Standard", "18W - 25W Fast", "33W - 45W Super Fast", "65W - 80W Ultra Fast", "100W - 120W HyperCharge", "200W+ Extreme"], "required": False, "filterable": True, "display_order": 10},
    {"key": "chipset_brand", "label": "Processor / Chipset", "type": "select", "options": ["Apple A-Series", "Qualcomm Snapdragon", "MediaTek Dimensity", "MediaTek Helio (G-Series)", "Samsung Exynos", "Google Tensor", "Unisoc"], "required": False, "filterable": True, "display_order": 11},
    {"key": "os_platform", "label": "Operating System", "type": "select", "options": ["iOS", "Android", "iPadOS", "HarmonyOS"], "required": True, "filterable": True, "display_order": 12}
]

TVS_AUDIO_SCHEMA = [
    {"key": "product_subtype", "label": "Product Subtype", "type": "select", "options": ["Television", "Soundbar System", "Home Theatre 5.1/7.1", "Portable Bluetooth Speaker", "Party Speaker / Hi-Fi Tower", "Over-Ear Headphones", "Wireless Earbuds (TWS)"], "required": True, "filterable": True, "display_order": 1},
    {"key": "screen_size_inch", "label": "TV Screen Size", "type": "select", "unit": "inch", "options": ["24\"", "32\"", "40\" - 43\"", "50\"", "55\"", "65\"", "75\"", "85\"", "98\" - 100\"+"], "required": False, "filterable": True, "display_order": 2},
    {"key": "display_technology", "label": "Display Technology", "type": "select", "options": ["OLED", "QD-OLED", "Mini-LED", "QLED", "NanoCell", "Direct LED / DLED", "Laser TV / UST"], "required": False, "filterable": True, "display_order": 3},
    {"key": "display_resolution", "label": "Resolution", "type": "select", "options": ["HD Ready (720p)", "Full HD (1080p)", "4K Ultra HD (3840x2160)", "8K Ultra HD"], "required": False, "filterable": True, "display_order": 4},
    {"key": "smart_tv_platform", "label": "Smart TV OS", "type": "select", "options": ["Google TV", "Android TV", "Samsung Tizen OS", "LG webOS", "VIDAA OS (Hisense)", "Digital / Non-Smart"], "required": False, "filterable": True, "display_order": 5},
    {"key": "audio_power_output_rms_watts", "label": "Audio Output Power (RMS)", "type": "select", "unit": "W", "options": ["10W - 30W", "40W - 80W", "100W - 250W", "300W - 600W", "800W - 1200W", "1500W - 3000W+"], "required": False, "filterable": True, "display_order": 6},
    {"key": "audio_channels", "label": "Audio Channels", "type": "select", "options": ["2.0 Stereo", "2.1 Channel (Subwoofer)", "3.1 Channel", "5.1 Surround Sound", "7.1.2 / 11.1.4 Dolby Atmos"], "required": False, "filterable": True, "display_order": 7},
    {"key": "waterproof_rating", "label": "Water Resistance", "type": "select", "options": ["IPX4 (Splashproof)", "IPX7 (Waterproof 1m)", "IP67 (Dust & Waterproof)", "Not Waterproof"], "required": False, "filterable": True, "display_order": 8}
]

CAMERAS_SCHEMA = [
    {"key": "photography_type", "label": "Device Classification", "type": "select", "options": ["Mirrorless Camera", "DSLR Camera", "Drone / Quadcopter", "Action Camera", "360 VR Camera", "Cinema Video Camera", "Camera Lens", "Gimbal Stabilizer"], "required": True, "filterable": True, "display_order": 1},
    {"key": "sensor_format", "label": "Sensor Size", "type": "select", "options": ["Full Frame (35mm)", "APS-C", "Micro Four Thirds (MFT)", "Medium Format", "1-inch", "1/1.3-inch", "1/2.3-inch"], "required": False, "filterable": True, "display_order": 2},
    {"key": "sensor_resolution_mp", "label": "Megapixels (MP)", "type": "select", "unit": "MP", "options": ["12MP", "20MP - 24MP", "26MP - 33MP", "45MP - 50MP", "61MP+", "100MP (Medium Format)"], "required": False, "filterable": True, "display_order": 3},
    {"key": "max_video_resolution", "label": "Max Video Resolution", "type": "select", "options": ["1080p Full HD", "4K 30/60 fps", "4K 120 fps High Speed", "5.3K / 5.7K 360", "6K RAW", "8K 30/60 fps"], "required": False, "filterable": True, "display_order": 4},
    {"key": "lens_mount_compatibility", "label": "Lens Mount", "type": "select", "options": ["Sony E-Mount", "Canon RF Mount", "Canon EF / EF-S Mount", "Nikon Z Mount", "Nikon F Mount", "Fujifilm X Mount", "Micro Four Thirds", "Fixed Lens"], "required": False, "filterable": True, "display_order": 5},
    {"key": "stabilization_type", "label": "Image Stabilization", "type": "select", "options": ["5-Axis In-Body Sensor-Shift (IBIS)", "Optical Lens-Based (OIS)", "3-Axis Mechanical Gimbal", "Electronic RockSteady / HyperSmooth", "No Stabilization"], "required": False, "filterable": True, "display_order": 6},
    {"key": "drone_max_flight_time_min", "label": "Max Flight Time", "type": "select", "unit": "mins", "options": ["< 20 mins", "25 - 31 mins", "34 - 38 mins", "40 - 46 mins"], "required": False, "filterable": True, "display_order": 7}
]

GAMING_SCHEMA = [
    {"key": "console_type", "label": "Form Factor", "type": "select", "options": ["Home Console (Disc Edition)", "Home Console (Digital / Discless)", "Hybrid Handheld / TV Console", "Dedicated Handheld Gaming Console", "PC Gaming Handheld", "VR Headset System", "Cloud / Remote Player"], "required": True, "filterable": True, "display_order": 1},
    {"key": "platform", "label": "Platform Ecosystem", "type": "select", "options": ["PlayStation 5", "PlayStation 4", "PlayStation 3", "Xbox Series X/S", "Xbox One", "Xbox 360", "Nintendo Switch", "Steam Deck (PC)", "Windows Gaming Handheld", "Meta Quest VR"], "required": True, "filterable": True, "display_order": 2},
    {"key": "storage_capacity", "label": "Internal Storage", "type": "select", "options": ["32GB - 64GB eMMC", "500GB HDD", "512GB SSD", "825GB SSD", "1TB SSD", "2TB SSD"], "required": True, "filterable": True, "display_order": 3},
    {"key": "max_resolution_output", "label": "Target / Max Resolution", "type": "select", "options": ["720p HD", "1080p Full HD", "1440p QHD", "4K UHD (60/120Hz)", "8K Ready"], "required": False, "filterable": True, "display_order": 4},
    {"key": "refresh_rate_vrr", "label": "Display / Video Refresh Rate", "type": "select", "options": ["60Hz Standard", "120Hz VRR Supported", "144Hz Native VRR"], "required": False, "filterable": True, "display_order": 5}
]

PRINTERS_SCHEMA = [
    {"key": "printer_category", "label": "Equipment Type", "type": "select", "options": ["Ink Tank (Continuous Ink / CISS)", "Monochrome Laser Printer", "Color Laser / LED Printer", "Commercial Photocopier (A3/A4)", "Thermal Receipt POS Printer (58mm/80mm)", "Barcode & Shipping Label Printer", "Flatbed / Document Scanner", "All-in-One Android POS Terminal"], "required": True, "filterable": True, "display_order": 1},
    {"key": "functions_all_in_one", "label": "Supported Functions", "type": "select", "options": ["Print Only (Single Function)", "3-in-1 (Print, Scan, Copy)", "4-in-1 (Print, Scan, Copy, Fax)", "Thermal POS Printing Only", "Barcode Scanning Only"], "required": True, "filterable": True, "display_order": 2},
    {"key": "max_paper_size", "label": "Max Media / Paper Size", "type": "select", "options": ["58mm Receipt Roll", "80mm Receipt Roll", "4\"x6\" Shipping Waybill (A6)", "A4 / Letter", "A3 / Ledger Large Format"], "required": True, "filterable": True, "display_order": 3},
    {"key": "print_speed_metric", "label": "Print Speed", "type": "select", "options": ["Up to 15 ppm (Home/Photo)", "20 - 30 ppm (Standard Office)", "35 - 50+ ppm (High-Speed Laser)", "90 - 150 mm/sec (Thermal POS)", "200 - 300 mm/sec (Fast POS)"], "required": False, "filterable": True, "display_order": 4}
]

TRUCKS_SCHEMA = [
    {"key": "commercial_type", "label": "Vehicle Type", "type": "select", "options": ["Light Duty Truck (Canter / Forward)", "Medium Duty Truck (7-15 Ton)", "Heavy Duty Prime Mover / Tractor Head", "Tipper / Dump Truck", "Box Body / Cargo Truck", "Flatbed Truck", "Fuel / Water Tanker", "Refrigerated Truck (Cold Chain)", "Minibus / Coaster", "Bus / Coach"], "required": True, "filterable": True, "display_order": 1},
    {"key": "payload_capacity", "label": "Payload / Tonnage", "type": "select", "options": ["1 - 2 Tons", "3 - 5 Tons", "7 - 10 Tons", "15 - 20 Tons", "25 - 30 Tons", "30+ Tons"], "required": True, "filterable": True, "display_order": 2},
    {"key": "axle_configuration", "label": "Axle Configuration", "type": "select", "options": ["4x2", "6x2", "6x4 (Double Differential)", "8x4"], "required": False, "filterable": True, "display_order": 3},
    {"key": "engine_fuel_type", "label": "Fuel Type", "type": "select", "options": ["Diesel", "CNG / Gas", "Electric", "Petrol"], "required": True, "filterable": True, "display_order": 4},
    {"key": "transmission", "label": "Transmission", "type": "select", "options": ["Manual", "Automatic", "Automated Manual (AMT)"], "required": True, "filterable": True, "display_order": 5},
    {"key": "year", "label": "Year of Manufacture", "type": "number", "required": True, "filterable": True, "display_order": 6}
]

SOLAR_SCHEMA = [
    {"key": "solar_equipment_type", "label": "Equipment Type", "type": "select", "options": ["Solar PV Panel", "Hybrid Inverter", "Off-Grid Inverter", "Lithium LiFePO4 Battery", "Gel / Tubular Deep Cycle Battery", "MPPT Solar Charge Controller", "Complete Solar Home System Kit"], "required": True, "filterable": True, "display_order": 1},
    {"key": "power_wattage_rating", "label": "Power / Capacity Rating", "type": "select", "options": ["150W - 300W", "450W - 580W Mono Tier-1", "650W+ Bifacial", "1kW - 3kW Inverter", "5kW Inverter", "8kW - 10kW Inverter", "12V 100Ah/200Ah (1.2-2.4kWh)", "48V 100Ah (5.12kWh LiFePO4)", "48V 200Ah (10.24kWh LiFePO4)", "15kWh+ Rackmount Battery"], "required": True, "filterable": True, "display_order": 2},
    {"key": "voltage_system", "label": "System Voltage", "type": "select", "options": ["12V DC", "24V DC", "48V DC", "220V/230V AC Single Phase", "380V/400V AC Three Phase"], "required": True, "filterable": True, "display_order": 3},
    {"key": "battery_chemistry", "label": "Battery Chemistry", "type": "select", "options": ["Lithium Iron Phosphate (LiFePO4)", "Lithium-Ion (NMC)", "Sealed Gel Deep Cycle", "Tubular Lead-Acid", "Not Applicable (Panel/Inverter)"], "required": False, "filterable": True, "display_order": 4}
]

GENERATORS_SCHEMA = [
    {"key": "power_output_kva", "label": "Power Output Rating", "type": "select", "options": ["1.0 - 2.5 kVA (Portable)", "3.0 - 5.0 kVA (Home/Shop)", "6.5 - 10 kVA (Heavy Single Phase)", "15 - 30 kVA (Commercial)", "50 - 100 kVA (Industrial)", "150 - 500+ kVA (Heavy Industrial Prime)"], "required": True, "filterable": True, "display_order": 1},
    {"key": "fuel_type", "label": "Fuel Type", "type": "select", "options": ["Petrol / Gasoline", "Diesel", "Dual Fuel (LPG/Petrol)", "Solar Generator / Portable Power Station"], "required": True, "filterable": True, "display_order": 2},
    {"key": "soundproof_enclosure", "label": "Noise / Canopy Level", "type": "select", "options": ["Super Silent Soundproof Canopy", "Semi-Silent Inverter", "Open Frame (Standard)"], "required": False, "filterable": True, "display_order": 3},
    {"key": "start_type", "label": "Starting Method", "type": "select", "options": ["Electric Key Start + Remote", "Electric Key + Recoil Pull Start", "Automatic Transfer Switch (ATS) Auto-Start", "Recoil Manual Pull Only"], "required": True, "filterable": True, "display_order": 4}
]

POWER_TOOLS_SCHEMA = [
    {"key": "tool_category", "label": "Tool Type", "type": "select", "options": ["Cordless Drill / Driver", "Rotary Hammer Drill (SDS-Plus/Max)", "Angle Grinder (4.5\" / 9\")", "Circular Saw / Mitre Saw", "Impact Wrench (1/2\" Drive)", "Welding Inverter (ARC/MIG/TIG)", "High-Pressure Washer", "Submersible Deep Well Water Pump", "Surface Centrifugal Water Pump", "Piston Air Compressor"], "required": True, "filterable": True, "display_order": 1},
    {"key": "power_source_type", "label": "Power Source", "type": "select", "options": ["Cordless Li-Ion Battery (18V / 20V)", "Heavy Duty Cordless (40V / 60V)", "Electric 220V-240V Corded", "Industrial Three Phase 380V", "Petrol Engine Powered"], "required": True, "filterable": True, "display_order": 2},
    {"key": "motor_technology", "label": "Motor Technology", "type": "select", "options": ["Brushless Motor (Heavy Duty)", "Standard Carbon Brush Motor"], "required": False, "filterable": True, "display_order": 3}
]

# ==============================================================================
# 2. MASTER BRAND REGISTRY
# ==============================================================================

ALL_BRANDS = [
    # Computers & Laptops
    ("Apple", "apple"), ("Dell", "dell"), ("HP", "hp"), ("Lenovo", "lenovo"),
    ("Asus", "asus"), ("Acer", "acer"), ("MSI", "msi"), ("Microsoft Surface", "microsoft-surface"),
    ("Samsung", "samsung"), ("Razer", "razer"), ("Toshiba", "toshiba"), ("Fujitsu", "fujitsu"),
    ("Alienware", "alienware"), ("Huawei", "huawei"), ("LG", "lg"),

    # Smartphones & Tablets
    ("Tecno", "tecno"), ("Infinix", "infinix"), ("Xiaomi", "xiaomi"), ("Redmi", "redmi"),
    ("Poco", "poco"), ("Google Pixel", "google-pixel"), ("Oppo", "oppo"), ("Vivo", "vivo"),
    ("OnePlus", "oneplus"), ("Itel", "itel"), ("Realme", "realme"), ("Nokia", "nokia"),
    ("ZTE", "zte"),

    # TVs & Audio
    ("Sony", "sony"), ("Hisense", "hisense"), ("TCL", "tcl"), ("Vitron", "vitron"),
    ("Star-X", "star-x"), ("Skyworth", "skyworth"), ("Panasonic", "panasonic"),
    ("JBL", "jbl"), ("Bose", "bose"), ("Harman Kardon", "harman-kardon"), ("Marshall", "marshall"),
    ("Sennheiser", "sennheiser"), ("Anker Soundcore", "anker-soundcore"), ("Oraimo", "oraimo"),
    ("Yamaha", "yamaha"),

    # Cameras & Gaming
    ("Canon", "canon"), ("Nikon", "nikon"), ("Fujifilm", "fujifilm"), ("GoPro", "gopro"),
    ("DJI", "dji"), ("Insta360", "insta360"), ("Blackmagic Design", "blackmagic-design"),
    ("Sony PlayStation", "playstation"), ("Microsoft Xbox", "xbox"), ("Nintendo", "nintendo"),
    ("Valve Steam", "valve-steam"), ("Meta Quest", "meta-quest"),

    # Printers & Networking
    ("Epson", "epson"), ("Brother", "brother"), ("Xprinter", "xprinter"), ("Zebra", "zebra"),
    ("Sunmi", "sunmi"), ("Kyocera", "kyocera"), ("TP-Link", "tp-link"), ("Ubiquiti", "ubiquiti"),
    ("MikroTik", "mikrotik"), ("Cisco", "cisco"), ("D-Link", "d-link"), ("Netgear", "netgear"),

    # Vehicles, Trucks & Bikes
    ("Toyota", "toyota"), ("Nissan", "nissan"), ("Subaru", "subaru"), ("Honda", "honda"),
    ("Mitsubishi", "mitsubishi"), ("Suzuki", "suzuki"), ("Mazda", "mazda"), ("Isuzu", "isuzu"),
    ("Ford", "ford"), ("Mercedes-Benz", "mercedes-benz"), ("BMW", "bmw"), ("Volkswagen", "volkswagen"),
    ("Mitsubishi Fuso", "mitsubishi-fuso"), ("Scania", "scania"), ("Sinotruk HOWO", "sinotruk-howo"),
    ("Hino", "hino"), ("FAW", "faw"), ("Shacman", "shacman"), ("Tata", "tata"),
    ("Ashok Leyland", "ashok-leyland"), ("MAN", "man"), ("Volvo", "volvo"),
    ("Bajaj", "bajaj"), ("TVS", "tvs"), ("Haojue", "haojue"), ("SanLG", "sanlg"),
    ("Boxer", "boxer"), ("Skygo", "skygo"), ("Kingo", "kingo"),

    # Solar, Energy & Generators
    ("Jinko Solar", "jinko-solar"), ("Canadian Solar", "canadian-solar"), ("Trina Solar", "trina-solar"),
    ("Longi", "longi"), ("JA Solar", "ja-solar"), ("Felicity Solar", "felicity-solar"),
    ("Must Power", "must-power"), ("Deye", "deye"), ("Growatt", "growatt"),
    ("Victron Energy", "victron-energy"), ("Chloride Exide", "chloride-exide"), ("Luminous", "luminous"),
    ("Kipor", "kipor"), ("Firman", "firman"), ("Lutian", "lutian"), ("Elepaq", "elepaq"),
    ("Perkins", "perkins"), ("Cummins", "cummins"), ("Caterpillar", "caterpillar"),

    # Tools & Machinery
    ("Bosch", "bosch"), ("Makita", "makita"), ("DeWalt", "dewalt"), ("Milwaukee", "milwaukee"),
    ("Stanley", "stanley"), ("Total Tools", "total-tools"), ("Ingco", "ingco"),
    ("Black+Decker", "black-decker"), ("Pedrollo", "pedrollo"), ("DAB", "dab"),
    ("Grundfos", "grundfos"), ("Shimge", "shimge"), ("Dayliff", "dayliff"),
    ("Massey Ferguson", "massey-ferguson"), ("John Deere", "john-deere"),

    # Auto Parts & Tyres
    ("Denso", "denso"), ("NGK", "ngk"), ("Brembo", "brembo"), ("Monroe", "monroe"),
    ("KYB", "kyb"), ("Valeo", "valeo"), ("Gates", "gates"), ("Mann-Filter", "mann-filter"),
    ("K&N", "k-n"), ("Sachs", "sachs"), ("AISIN", "aisin"), ("Bilstein", "bilstein"),
    ("Michelin", "michelin"), ("Bridgestone", "bridgestone"), ("Pirelli", "pirelli"),
    ("Continental", "continental"), ("Goodyear", "goodyear"), ("Yokohama", "yokohama"),
    ("Dunlop", "dunlop"), ("Maxxis", "maxxis")
]

def run_seed():
    with transaction.atomic():
        print("1. Seeding Brands Registry...")
        brands_dict = {}
        for name, slug in ALL_BRANDS:
            b, _ = Brand.objects.get_or_create(slug=slug, defaults={'name': name})
            if b.name != name:
                b.name = name
                b.save(update_fields=['name'])
            brands_dict[slug] = b

        print(f"✓ Total Brands in catalog: {Brand.objects.count()}")

        # ------------------------------------------------------------------
        # 2. APPLY SCHEMAS TO CATEGORIES (Targeting both current & sub slugs)
        # ------------------------------------------------------------------
        print("2. Applying Rich Specification Schemas to Categories...")
        
        category_schema_map = {
            # Computers & Laptops
            ('electronics-computers-laptops', 'laptops', 'laptops-computers', 'desktop-pcs', 'computers'): COMPUTERS_SCHEMA,
            # Smartphones & Tablets
            ('electronics-mobile-phones', 'smartphones-only', 'smartphones', 'tablets', 'mobile-phones'): SMARTPHONES_SCHEMA,
            # TVs & Audio
            ('electronics-tvs-audio', 'televisions', 'tvs-audio', 'soundbars-home-theatre', 'portable-bluetooth-speakers'): TVS_AUDIO_SCHEMA,
            # Cameras & Lenses
            ('electronics-cameras-lenses', 'cameras-photography', 'mirrorless-dslr-cameras', 'drones-quadcopters'): CAMERAS_SCHEMA,
            # Video Games & Consoles
            ('electronics-video-games-consoles', 'gaming-consoles', 'home-consoles', 'handheld-gaming'): GAMING_SCHEMA,
            # Printers & POS
            ('electronics-printers-scanners', 'printers-scanners-pos', 'inkjet-tank-printers', 'laser-printers-photocopiers'): PRINTERS_SCHEMA,
            # Trucks & Commercial
            ('vehicles-trucks-commercial-vehicles', 'trucks', 'commercial-vehicles'): TRUCKS_SCHEMA,
            # Solar & Energy
            ('solar-energy', 'solar-energy-systems', 'home-garden-solar'): SOLAR_SCHEMA,
            # Generators
            ('generators', 'generators-power'): GENERATORS_SCHEMA,
            # Power Tools & Pumps
            ('power-tools', 'pumps-compressors', 'welding-equipment'): POWER_TOOLS_SCHEMA,
        }

        for slug_tuple, schema in category_schema_map.items():
            for slug in slug_tuple:
                cats = Category.objects.filter(slug=slug)
                for cat in cats:
                    cat.spec_schema = schema
                    cat.save(update_fields=['spec_schema'])
                    print(f"  -> Injected {len(schema)} spec fields for category: {cat.slug} ({cat.name})")

        # ------------------------------------------------------------------
        # 2.5 ATTACH APPLICABLE BRANDS TO CATEGORIES
        # ------------------------------------------------------------------
        print("2.5 Attaching Category-Specific Brands...")
        category_brand_map = {
            ('electronics-computers-laptops', 'laptops', 'desktop-pcs', 'computers'): [
                "apple", "dell", "hp", "lenovo", "asus", "acer", "msi", "microsoft-surface", "samsung", "razer", "toshiba", "fujitsu", "huawei"
            ],
            ('electronics-mobile-phones', 'smartphones-only', 'smartphones', 'mobile-phones'): [
                "apple", "samsung", "tecno", "infinix", "xiaomi", "redmi", "poco", "google-pixel", "oppo", "vivo", "oneplus", "huawei", "realme", "honor", "nokia", "itel", "sony"
            ],
            ('electronics-tablets-ereaders', 'tablets'): [
                "apple", "samsung", "lenovo", "huawei", "xiaomi", "microsoft-surface"
            ],
            ('electronics-smartwatches-wearables', 'smartwatches'): [
                "apple", "samsung", "garmin", "fitbit", "huawei", "xiaomi", "amazfit", "fossil"
            ],
            ('electronics-tvs-audio', 'televisions', 'tvs-audio', 'soundbars-home-theatre'): [
                "samsung", "lg", "sony", "hisense", "tcl", "vitron", "jbl", "bose", "harman-kardon", "marshall", "sennheiser", "anker-soundcore"
            ],
            ('electronics-cameras-lenses', 'cameras-photography', 'mirrorless-dslr-cameras', 'drones-quadcopters'): [
                "canon", "nikon", "sony", "fujifilm", "gopro", "dji", "insta360"
            ],
            ('electronics-video-games-consoles', 'gaming-consoles', 'home-consoles', 'handheld-gaming'): [
                "sony-playstation", "microsoft-xbox", "nintendo", "steam-deck", "asus-rog"
            ],
            ('printers-pos-printers-copiers', 'printers-pos-systems', 'printers-pos-networking-routers', 'printers-scanners-pos', 'printers-pos-networking'): [
                "epson", "hp", "canon", "brother", "xprinter", "tp-link", "ubiquiti-unifi", "mikrotik", "d-link", "huawei", "cisco", "netgear", "tenda"
            ],
            ('vehicles-cars', 'cars', 'passenger-vehicles'): [
                "toyota", "nissan", "honda", "mercedes-benz", "bmw", "subaru", "mitsubishi", "ford", "volkswagen", "audi", "hyundai", "kia", "mazda", "land-rover", "suzuki", "isuzu", "volvo", "jeep", "lexus"
            ],
            ('vehicles-trucks-commercial-vehicles', 'trucks', 'commercial-vehicles'): [
                "isuzu", "mitsubishi-fuso", "scania", "sinotruk-howo", "hino", "mercedes-benz-trucks", "faw", "shacman", "tata", "ashok-leyland"
            ],
            ('vehicles-motorcycles', 'vehicles-tricycles-tuktuks', 'motorcycles', 'tricycles'): [
                "bajaj", "tvs", "yamaha", "honda", "haojue", "sanlg"
            ],
            ('vehicles-vehicle-parts-accessories', 'vehicles-tyres-rims-wheels', 'vehicle-parts'): [
                "bosch-auto", "denso", "ngk", "brembo", "monroe", "kyb", "valeo", "gates", "mann-filter", "aisin", "michelin", "bridgestone", "pirelli", "continental", "goodyear", "yokohama", "dunlop", "maxxis"
            ],
            ('solar-energy', 'solar-energy-systems', 'solar-energy-solar-panels', 'solar-energy-solar-inverters', 'solar-energy-solar-batteries'): [
                "jinko-solar", "canadian-solar", "felicity-solar", "must-solar", "deye", "growatt", "victron-energy", "chloride-exide", "luminous"
            ],
            ('generators', 'generators-power', 'tools-generators'): [
                "honda-generators", "kipor", "firman", "lutian", "elepaq", "perkins", "cummins"
            ],
            ('power-tools', 'pumps-compressors', 'welding-equipment', 'tools-power-tools-machinery'): [
                "bosch-pro", "makita", "dewalt", "milwaukee", "total-tools", "ingco", "pedrollo", "dab-pumps", "grundfos", "shimge"
            ],
        }

        for slug_tuple, brand_slug_list in category_brand_map.items():
            b_objs = [brands_dict[bs] for bs in brand_slug_list if bs in brands_dict]
            for cat_slug in slug_tuple:
                for cat in Category.objects.filter(slug=cat_slug):
                    cat.brands.add(*b_objs)
                    print(f"  -> Associated {len(b_objs)} brands with category: {cat.name} ({cat.slug})")

        # ------------------------------------------------------------------
        # 3. SEED REFERENCE PRODUCTS (Canonical 2010 - Present Models)
        # ------------------------------------------------------------------
        print("3. Seeding Canonical Reference Products (2010-Present)...")

        comp_cat = Category.objects.filter(slug__in=['electronics-computers-laptops', 'laptops']).first()
        phone_cat = Category.objects.filter(slug__in=['electronics-mobile-phones', 'smartphones-only']).first()
        tv_cat = Category.objects.filter(slug__in=['electronics-tvs-audio', 'televisions']).first()
        cam_cat = Category.objects.filter(slug__in=['electronics-cameras-lenses', 'cameras-photography']).first()
        game_cat = Category.objects.filter(slug__in=['electronics-video-games-consoles', 'gaming-consoles']).first()
        truck_cat = Category.objects.filter(slug__in=['vehicles-trucks-commercial-vehicles', 'trucks']).first()
        solar_cat = Category.objects.filter(slug__in=['solar-energy', 'solar-energy-systems']).first()
        tool_cat = Category.objects.filter(slug__in=['power-tools', 'machinery']).first()

        reference_products_data = [
            # Computers
            (comp_cat, "apple", "Apple MacBook Pro 14 M3 Pro", "apple-macbook-pro-14-m3-pro", {
                "form_factor": "Traditional Laptop", "processor_brand": "Apple Silicon",
                "processor_generation": "Apple M3 / M3 Pro / M3 Max", "processor_model": "Apple M3 Pro (11-Core)",
                "ram_size_gb": "18GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.2\"", "display_resolution": "Liquid Retina XDR",
                "graphics_type": "Apple Unified GPU", "operating_system": "macOS"
            }),
            (comp_cat, "apple", "Apple MacBook Air 13 M2", "apple-macbook-air-13-m2", {
                "form_factor": "Ultrabook", "processor_brand": "Apple Silicon",
                "processor_generation": "Apple M2 / M2 Pro / M2 Max", "processor_model": "Apple M2 (8-Core)",
                "ram_size_gb": "8GB", "storage_capacity": "256GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "13.6\"", "display_resolution": "Liquid Retina XDR",
                "graphics_type": "Apple Unified GPU", "operating_system": "macOS"
            }),
            (comp_cat, "dell", "Dell XPS 15 9530 (2023)", "dell-xps-15-9530", {
                "form_factor": "Traditional Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 13th Gen Core", "processor_model": "Core i7-13700H",
                "ram_size_gb": "16GB", "storage_capacity": "1TB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "15.6\"", "display_resolution": "3K / 3.5K OLED",
                "graphics_type": "Dedicated NVIDIA RTX 40-Series", "gpu_model": "RTX 4060 8GB",
                "operating_system": "Windows 11 Pro"
            }),
            (comp_cat, "lenovo", "Lenovo ThinkPad T14 Gen 4", "lenovo-thinkpad-t14-gen-4", {
                "form_factor": "Traditional Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 13th Gen Core", "processor_model": "Core i5-1335U",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "FHD+ (1920x1200)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Pro"
            }),
            (comp_cat, "hp", "HP EliteBook 840 G8", "hp-elitebook-840-g8", {
                "form_factor": "Ultrabook", "processor_brand": "Intel",
                "processor_generation": "Intel 11th Gen Core", "processor_model": "Core i7-1165G7",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 10 Pro"
            }),
            (comp_cat, "asus", "Asus ROG Zephyrus G14", "asus-rog-zephyrus-g14", {
                "form_factor": "Gaming Laptop", "processor_brand": "AMD",
                "processor_generation": "AMD Ryzen 8000/7000 Series", "processor_model": "Ryzen 9 8945HS",
                "ram_size_gb": "32GB", "storage_capacity": "1TB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "3K / 3.5K OLED",
                "graphics_type": "Dedicated NVIDIA RTX 40-Series", "gpu_model": "RTX 4070 8GB",
                "operating_system": "Windows 11 Home"
            }),

            # ═══════════════════════════════════════════════════════════════════
            # SMARTPHONES (2010 - PRESENT EXHAUSTIVE CANONICAL MODELS)
            # ═══════════════════════════════════════════════════════════════════
            # --- SAMSUNG S-SERIES ---
            (phone_cat, "samsung", "Samsung Galaxy S24 Ultra", "samsung-galaxy-s24-ultra", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "512GB",
                "network_generation": "5G", "screen_size_inch": "6.8\" - 6.9\"", "display_type": "Dynamic AMOLED 2X",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "200MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "Qualcomm Snapdragon", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy S24+", "samsung-galaxy-s24-plus", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Dynamic AMOLED 2X",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "Samsung Exynos", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy S24", "samsung-galaxy-s24", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.0\" - 6.4\"", "display_type": "Dynamic AMOLED 2X",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Samsung Exynos", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy S23 Ultra", "samsung-galaxy-s23-ultra", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "512GB",
                "network_generation": "5G", "screen_size_inch": "6.8\" - 6.9\"", "display_type": "Dynamic AMOLED 2X",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "200MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "Qualcomm Snapdragon", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy S23+ / S23", "samsung-galaxy-s23", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.0\" - 6.4\"", "display_type": "Dynamic AMOLED 2X",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Qualcomm Snapdragon", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy S23 FE", "samsung-galaxy-s23-fe", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "128GB",
                "network_generation": "5G", "screen_size_inch": "6.0\" - 6.4\"", "display_type": "Dynamic AMOLED 2X",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Samsung Exynos", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy S22 Ultra 5G", "samsung-galaxy-s22-ultra", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.8\" - 6.9\"", "display_type": "Dynamic AMOLED 2X",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "Qualcomm Snapdragon", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy S22+ / S22 5G", "samsung-galaxy-s22", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "128GB",
                "network_generation": "5G", "screen_size_inch": "6.0\" - 6.4\"", "display_type": "Dynamic AMOLED 2X",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Qualcomm Snapdragon", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy S21 Ultra / S21+ / S21 5G", "samsung-galaxy-s21-ultra", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.8\" - 6.9\"", "display_type": "Dynamic AMOLED 2X",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Qualcomm Snapdragon", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy S21 FE 5G", "samsung-galaxy-s21-fe", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "128GB",
                "network_generation": "5G", "screen_size_inch": "6.0\" - 6.4\"", "display_type": "Dynamic AMOLED 2X",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Qualcomm Snapdragon", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy S20 Ultra / S20+ / S20 5G", "samsung-galaxy-s20-ultra", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "128GB",
                "network_generation": "5G", "screen_size_inch": "6.8\" - 6.9\"", "display_type": "Dynamic AMOLED 2X",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "Qualcomm Snapdragon", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy S20 FE 5G", "samsung-galaxy-s20-fe", {
                "device_type": "Smartphone", "ram_size_gb": "6GB", "storage_internal": "128GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Qualcomm Snapdragon", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy S10+ / S10 / S10e", "samsung-galaxy-s10-plus", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "128GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.0\" - 6.4\"", "display_type": "Dynamic AMOLED 2X",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "10W - 15W Standard", "chipset_brand": "Qualcomm Snapdragon", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy S9+ / S9 / S8+ / S8", "samsung-galaxy-s9-plus", {
                "device_type": "Smartphone", "ram_size_gb": "6GB", "storage_internal": "64GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.0\" - 6.4\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "3000 - 3999 mAh",
                "charging_wattage": "10W - 15W Standard", "chipset_brand": "Qualcomm Snapdragon", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy S7 / S6 / S5 / S4 Classic", "samsung-galaxy-s7-edge", {
                "device_type": "Smartphone", "ram_size_gb": "4GB", "storage_internal": "32GB",
                "network_generation": "4G LTE", "screen_size_inch": "5.0\" - 5.9\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "3000 - 3999 mAh",
                "charging_wattage": "10W - 15W Standard", "chipset_brand": "Samsung Exynos", "os_platform": "Android"
            }),

            # --- SAMSUNG NOTE & FOLD/FLIP ---
            (phone_cat, "samsung", "Samsung Galaxy Z Fold 6 / Fold 5 / Fold 4", "samsung-galaxy-z-fold-6", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "512GB",
                "network_generation": "5G", "screen_size_inch": "7.0\" - 8.9\" (Compact Tablet)", "display_type": "Foldable AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Qualcomm Snapdragon", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy Z Flip 6 / Flip 5 / Flip 4", "samsung-galaxy-z-flip-6", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Foldable AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Qualcomm Snapdragon", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy Note 20 Ultra 5G", "samsung-galaxy-note-20-ultra", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.8\" - 6.9\"", "display_type": "Dynamic AMOLED 2X",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Qualcomm Snapdragon", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy Note 10+ / Note 10 / Note 9", "samsung-galaxy-note-10-plus", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "256GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.8\" - 6.9\"", "display_type": "Dynamic AMOLED 2X",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "Samsung Exynos", "os_platform": "Android"
            }),

            # --- SAMSUNG A-SERIES (FULL POPULAR LINEUP) ---
            (phone_cat, "samsung", "Samsung Galaxy A55 5G", "samsung-galaxy-a55-5g", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Samsung Exynos", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy A54 5G / A53 5G / A52s", "samsung-galaxy-a54-5g", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "128GB",
                "network_generation": "5G", "screen_size_inch": "6.0\" - 6.4\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Samsung Exynos", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy A35 5G / A34 5G / A33 5G", "samsung-galaxy-a35-5g", {
                "device_type": "Smartphone", "ram_size_gb": "6GB", "storage_internal": "128GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Samsung Exynos", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy A25 5G / A24 / A23", "samsung-galaxy-a25-5g", {
                "device_type": "Smartphone", "ram_size_gb": "6GB", "storage_internal": "128GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Samsung Exynos", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy A15 5G / A15 4G", "samsung-galaxy-a15", {
                "device_type": "Smartphone", "ram_size_gb": "6GB", "storage_internal": "128GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "90Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy A14 / A13 / A12 / A11", "samsung-galaxy-a14", {
                "device_type": "Smartphone", "ram_size_gb": "4GB", "storage_internal": "64GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "10W - 15W Standard", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "samsung", "Samsung Galaxy A05s / A05 / A04s / A04 / A03", "samsung-galaxy-a05s", {
                "device_type": "Smartphone", "ram_size_gb": "4GB", "storage_internal": "64GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "90Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Qualcomm Snapdragon", "os_platform": "Android"
            }),

            # --- APPLE IPHONE (2010 - PRESENT) ---
            (phone_cat, "apple", "Apple iPhone 16 Pro Max", "apple-iphone-16-pro-max", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.8\" - 6.9\"", "display_type": "LTPO OLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Apple A-Series", "os_platform": "iOS"
            }),
            (phone_cat, "apple", "Apple iPhone 16 Pro / 16 Plus / 16", "apple-iphone-16", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "128GB",
                "network_generation": "5G", "screen_size_inch": "6.0\" - 6.4\"", "display_type": "OLED",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "3000 - 3999 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Apple A-Series", "os_platform": "iOS"
            }),
            (phone_cat, "apple", "Apple iPhone 15 Pro Max", "apple-iphone-15-pro-max", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "LTPO OLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Apple A-Series", "os_platform": "iOS"
            }),
            (phone_cat, "apple", "Apple iPhone 15 Pro / 15 Plus / 15", "apple-iphone-15", {
                "device_type": "Smartphone", "ram_size_gb": "6GB", "storage_internal": "128GB",
                "network_generation": "5G", "screen_size_inch": "6.0\" - 6.4\"", "display_type": "OLED",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "3000 - 3999 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Apple A-Series", "os_platform": "iOS"
            }),
            (phone_cat, "apple", "Apple iPhone 14 Pro Max / 14 Pro", "apple-iphone-14-pro-max", {
                "device_type": "Smartphone", "ram_size_gb": "6GB", "storage_internal": "128GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "LTPO OLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Apple A-Series", "os_platform": "iOS"
            }),
            (phone_cat, "apple", "Apple iPhone 14 Plus / 14", "apple-iphone-14", {
                "device_type": "Smartphone", "ram_size_gb": "6GB", "storage_internal": "128GB",
                "network_generation": "5G", "screen_size_inch": "6.0\" - 6.4\"", "display_type": "OLED",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "3000 - 3999 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Apple A-Series", "os_platform": "iOS"
            }),
            (phone_cat, "apple", "Apple iPhone 13 Pro Max / 13 Pro", "apple-iphone-13-pro-max", {
                "device_type": "Smartphone", "ram_size_gb": "6GB", "storage_internal": "128GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "LTPO OLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Apple A-Series", "os_platform": "iOS"
            }),
            (phone_cat, "apple", "Apple iPhone 13 / 13 mini", "apple-iphone-13", {
                "device_type": "Smartphone", "ram_size_gb": "4GB", "storage_internal": "128GB",
                "network_generation": "5G", "screen_size_inch": "6.0\" - 6.4\"", "display_type": "OLED",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "3000 - 3999 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Apple A-Series", "os_platform": "iOS"
            }),
            (phone_cat, "apple", "Apple iPhone 12 Pro Max / 12 Pro / 12", "apple-iphone-12-pro-max", {
                "device_type": "Smartphone", "ram_size_gb": "6GB", "storage_internal": "128GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "OLED",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "3000 - 3999 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Apple A-Series", "os_platform": "iOS"
            }),
            (phone_cat, "apple", "Apple iPhone 11 Pro Max / 11 Pro / 11", "apple-iphone-11-pro-max", {
                "device_type": "Smartphone", "ram_size_gb": "4GB", "storage_internal": "64GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "OLED",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "3000 - 3999 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Apple A-Series", "os_platform": "iOS"
            }),
            (phone_cat, "apple", "Apple iPhone XS Max / XS / XR / X", "apple-iphone-xs-max", {
                "device_type": "Smartphone", "ram_size_gb": "4GB", "storage_internal": "64GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "OLED",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "3000 - 3999 mAh",
                "charging_wattage": "10W - 15W Standard", "chipset_brand": "Apple A-Series", "os_platform": "iOS"
            }),
            (phone_cat, "apple", "Apple iPhone 8 Plus / 8 / 7 / 6s / SE", "apple-iphone-8-plus", {
                "device_type": "Smartphone", "ram_size_gb": "3GB", "storage_internal": "64GB",
                "network_generation": "4G LTE", "screen_size_inch": "5.0\" - 5.9\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "< 3000 mAh",
                "charging_wattage": "10W - 15W Standard", "chipset_brand": "Apple A-Series", "os_platform": "iOS"
            }),

            # --- TECNO (EXHAUSTIVE LINEUP) ---
            # CAMON SERIES (Camera Flagships)
            (phone_cat, "tecno", "Tecno Camon 30 Premier 5G", "tecno-camon-30-premier-5g", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "512GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "LTPO OLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "65W - 80W Ultra Fast", "chipset_brand": "MediaTek Dimensity", "os_platform": "Android"
            }),
            (phone_cat, "tecno", "Tecno Camon 30 Pro 5G / Camon 30 5G", "tecno-camon-30-pro", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "144Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "65W - 80W Ultra Fast", "chipset_brand": "MediaTek Dimensity", "os_platform": "Android"
            }),
            (phone_cat, "tecno", "Tecno Camon 30 (4G)", "tecno-camon-30-4g", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "65W - 80W Ultra Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "tecno", "Tecno Camon 20 Premier 5G", "tecno-camon-20-premier-5g", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "512GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Dimensity", "os_platform": "Android"
            }),
            (phone_cat, "tecno", "Tecno Camon 20 Pro 5G / Camon 20 Pro 4G", "tecno-camon-20-pro", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "64MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "tecno", "Tecno Camon 20 / Camon 19 Pro / Camon 19", "tecno-camon-20", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "128GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "64MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "tecno", "Tecno Camon 18 Premier / Camon 18P / Camon 18", "tecno-camon-18", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "128GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "64MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "tecno", "Tecno Camon 17 Pro / Camon 16 / Camon 15 Classic", "tecno-camon-17", {
                "device_type": "Smartphone", "ram_size_gb": "6GB", "storage_internal": "128GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "90Hz", "main_camera_mp": "64MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),

            # SPARK SERIES (Popular Everyday Value)
            (phone_cat, "tecno", "Tecno Spark 20 Pro+ (Curved AMOLED 120Hz)", "tecno-spark-20-pro-plus", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "tecno", "Tecno Spark 20 Pro / Spark 20", "tecno-spark-20-pro", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "tecno", "Tecno Spark 20C / Spark 10 Pro / Spark 10", "tecno-spark-20c", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "128GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "90Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "tecno", "Tecno Spark 10C / Spark 9 Pro / Spark 9", "tecno-spark-10c", {
                "device_type": "Smartphone", "ram_size_gb": "4GB", "storage_internal": "128GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "90Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Unisoc", "os_platform": "Android"
            }),
            (phone_cat, "tecno", "Tecno Spark 8P / Spark 8 / Spark 7 Pro / Spark 6", "tecno-spark-8", {
                "device_type": "Smartphone", "ram_size_gb": "4GB", "storage_internal": "64GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "10W - 15W Standard", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),

            # POVA SERIES (Massive Battery & Gaming)
            (phone_cat, "tecno", "Tecno Pova 6 Pro 5G / Pova 6", "tecno-pova-6-pro", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.8\" - 6.9\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "6000 mAh",
                "charging_wattage": "65W - 80W Ultra Fast", "chipset_brand": "MediaTek Dimensity", "os_platform": "Android"
            }),
            (phone_cat, "tecno", "Tecno Pova 5 Pro 5G / Pova 5 (6000mAh)", "tecno-pova-5-pro", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.8\" - 6.9\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "6000 mAh",
                "charging_wattage": "65W - 80W Ultra Fast", "chipset_brand": "MediaTek Dimensity", "os_platform": "Android"
            }),
            (phone_cat, "tecno", "Tecno Pova 4 Pro / Pova 4 / Pova Neo 2", "tecno-pova-4", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "128GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.8\" - 6.9\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "90Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "6000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),

            # PHANTOM SERIES (Premium Foldables & Flagships)
            (phone_cat, "tecno", "Tecno Phantom V Fold (120Hz LTPO Foldable)", "tecno-phantom-v-fold", {
                "device_type": "Foldable Smartphone", "ram_size_gb": "12GB", "storage_internal": "512GB",
                "network_generation": "5G", "screen_size_inch": "7.8\" Foldable LTPO AMOLED", "display_type": "LTPO OLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Dimensity", "os_platform": "Android"
            }),
            (phone_cat, "tecno", "Tecno Phantom V Flip (Clamshell Foldable)", "tecno-phantom-v-flip", {
                "device_type": "Foldable Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.8\" - 6.9\"", "display_type": "LTPO OLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "64MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Dimensity", "os_platform": "Android"
            }),
            (phone_cat, "tecno", "Tecno Phantom X2 Pro 5G (Retractable Portrait Lens)", "tecno-phantom-x2-pro", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.8\" - 6.9\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Dimensity", "os_platform": "Android"
            }),

            # POP SERIES (Entry Level)
            (phone_cat, "tecno", "Tecno Pop 8 (Magic Ring, 90Hz)", "tecno-pop-8", {
                "device_type": "Smartphone", "ram_size_gb": "4GB", "storage_internal": "64GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "90Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "10W - 15W Standard", "chipset_brand": "Unisoc", "os_platform": "Android"
            }),
            (phone_cat, "tecno", "Tecno Pop 7 Pro / Pop 7 / Pop 6 / Pop 5", "tecno-pop-7", {
                "device_type": "Smartphone", "ram_size_gb": "2GB", "storage_internal": "32GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "10W - 15W Standard", "chipset_brand": "Unisoc", "os_platform": "Android"
            }),

            # --- INFINIX (EXHAUSTIVE LINEUP) ---
            # NOTE SERIES
            (phone_cat, "infinix", "Infinix Note 40 Pro+ 5G", "infinix-note-40-pro-plus-5g", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "100W - 120W HyperCharge", "chipset_brand": "MediaTek Dimensity", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Note 40 Pro 5G / Note 40 Pro 4G", "infinix-note-40-pro", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "65W - 80W Ultra Fast", "chipset_brand": "MediaTek Dimensity", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Note 40 4G / 5G", "infinix-note-40", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Note 30 VIP (50W Wireless)", "infinix-note-30-vip", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "65W - 80W Ultra Fast", "chipset_brand": "MediaTek Dimensity", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Note 30 Pro", "infinix-note-30-pro", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "65W - 80W Ultra Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Note 30 5G / Note 30 4G", "infinix-note-30", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "128GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "64MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Note 12 VIP (120W Charge)", "infinix-note-12-vip", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "100W - 120W HyperCharge", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Note 12 Pro 5G / Note 12 Pro 4G", "infinix-note-12-pro", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Note 12 G96 / Note 12 / Note 11 Pro", "infinix-note-12-g96", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "128GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Note 10 Pro / Note 8 / Note 7", "infinix-note-10-pro", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "128GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.8\" - 6.9\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "90Hz", "main_camera_mp": "64MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),

            # HOT SERIES
            (phone_cat, "infinix", "Infinix Hot 40 Pro", "infinix-hot-40-pro", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Hot 40 / Hot 40i", "infinix-hot-40", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "128GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "90Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Hot 30 / Hot 30 5G / Hot 30i / Hot 30 Play", "infinix-hot-30", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "128GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "90Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Hot 20 / Hot 20 5G / Hot 20i / Hot 20 Play", "infinix-hot-20", {
                "device_type": "Smartphone", "ram_size_gb": "6GB", "storage_internal": "128GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "90Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Hot 12 / Hot 12 Play / Hot 12i", "infinix-hot-12", {
                "device_type": "Smartphone", "ram_size_gb": "4GB", "storage_internal": "64GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "90Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "6000 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Hot 11 / Hot 11S / Hot 10 Play / Hot 9", "infinix-hot-11", {
                "device_type": "Smartphone", "ram_size_gb": "4GB", "storage_internal": "64GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "10W - 15W Standard", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),

            # SMART SERIES
            (phone_cat, "infinix", "Infinix Smart 8 Pro / Smart 8 Plus", "infinix-smart-8-pro", {
                "device_type": "Smartphone", "ram_size_gb": "4GB", "storage_internal": "128GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "90Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "6000 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Smart 8 / Smart 8 HD (Magic Ring)", "infinix-smart-8", {
                "device_type": "Smartphone", "ram_size_gb": "4GB", "storage_internal": "64GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "90Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "10W - 15W Standard", "chipset_brand": "Unisoc", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Smart 7 / Smart 7 Plus / Smart 7 HD", "infinix-smart-7", {
                "device_type": "Smartphone", "ram_size_gb": "4GB", "storage_internal": "64GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "10W - 15W Standard", "chipset_brand": "Unisoc", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Smart 6 / Smart 6 Plus / Smart 5", "infinix-smart-6", {
                "device_type": "Smartphone", "ram_size_gb": "2GB", "storage_internal": "32GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "60Hz", "main_camera_mp": "12MP - 13MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "10W - 15W Standard", "chipset_brand": "Unisoc", "os_platform": "Android"
            }),

            # ZERO & GT SERIES
            (phone_cat, "infinix", "Infinix Zero 30 5G (4K 60fps Vlog)", "infinix-zero-30-5g", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "144Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "65W - 80W Ultra Fast", "chipset_brand": "MediaTek Dimensity", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Zero Ultra (200MP, 180W Charge)", "infinix-zero-ultra", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.8\" - 6.9\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "200MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "200W+ Extreme", "chipset_brand": "MediaTek Dimensity", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Zero 20 / Zero 5G 2023 / Zero X Pro", "infinix-zero-20", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "90Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "4000 - 4800 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix GT 20 Pro 5G Gaming (Cyber Mecha)", "infinix-gt-20-pro", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "144Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Dimensity", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix GT 10 Pro 5G Gaming", "infinix-gt-10-pro", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "MediaTek Dimensity", "os_platform": "Android"
            }),

            # --- XIAOMI / REDMI / POCO ---
            (phone_cat, "xiaomi", "Xiaomi 14 Ultra / 14 Pro / 14", "xiaomi-14-ultra", {
                "device_type": "Smartphone", "ram_size_gb": "16GB", "storage_internal": "512GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "LTPO OLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "65W - 80W Ultra Fast", "chipset_brand": "Qualcomm Snapdragon", "os_platform": "Android"
            }),
            (phone_cat, "xiaomi", "Redmi Note 13 Pro+ 5G / Note 13 Pro", "redmi-note-13-pro-plus", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "512GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "200MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "100W - 120W HyperCharge", "chipset_brand": "MediaTek Dimensity", "os_platform": "Android"
            }),
            (phone_cat, "xiaomi", "Redmi Note 13 4G / 5G / Note 12", "redmi-note-13", {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "Qualcomm Snapdragon", "os_platform": "Android"
            }),
            (phone_cat, "xiaomi", "Redmi 13C / 12 / 10C / 9A / 9C", "redmi-13c", {
                "device_type": "Smartphone", "ram_size_gb": "6GB", "storage_internal": "128GB",
                "network_generation": "4G LTE", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "IPS LCD",
                "refresh_rate_hz": "90Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "MediaTek Helio (G-Series)", "os_platform": "Android"
            }),
            (phone_cat, "xiaomi", "Poco X6 Pro 5G / Poco F6 Pro / F5", "poco-x6-pro-5g", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "512GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "64MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "65W - 80W Ultra Fast", "chipset_brand": "MediaTek Dimensity", "os_platform": "Android"
            }),

            # --- GOOGLE PIXEL ---
            (phone_cat, "google-pixel", "Google Pixel 9 Pro XL / 9 Pro / 9", "google-pixel-9-pro-xl", {
                "device_type": "Smartphone", "ram_size_gb": "16GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.8\" - 6.9\"", "display_type": "LTPO OLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "33W - 45W Super Fast", "chipset_brand": "Google Tensor", "os_platform": "Android"
            }),
            (phone_cat, "google-pixel", "Google Pixel 8 Pro / Pixel 8 / 8a", "google-pixel-8-pro", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "128GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "LTPO OLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Google Tensor", "os_platform": "Android"
            }),
            (phone_cat, "google-pixel", "Google Pixel 7 Pro / 7 / 6 Pro / 6", "google-pixel-7-pro", {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "128GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "LTPO OLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "battery_capacity_mah": "5000 mAh",
                "charging_wattage": "18W - 25W Fast", "chipset_brand": "Google Tensor", "os_platform": "Android"
            }),

            # ═══════════════════════════════════════════════════════════════════
            # COMPUTERS & LAPTOPS (2010 - PRESENT EXHAUSTIVE CANONICAL MODELS)
            # ═══════════════════════════════════════════════════════════════════
            # --- APPLE MACBOOK ---
            (comp_cat, "apple", "Apple MacBook Pro 16 M3 Max", "apple-macbook-pro-16-m3-max", {
                "form_factor": "Mobile Workstation", "processor_brand": "Apple Silicon",
                "processor_generation": "Apple M3 / M3 Pro / M3 Max", "processor_model": "Apple M3 Max (16-Core)",
                "ram_size_gb": "64GB", "storage_capacity": "1TB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "16.2\"", "display_resolution": "Liquid Retina XDR",
                "graphics_type": "Apple Unified GPU", "operating_system": "macOS"
            }),
            (comp_cat, "apple", "Apple MacBook Pro 14 M3 Pro", "apple-macbook-pro-14-m3-pro", {
                "form_factor": "Traditional Laptop", "processor_brand": "Apple Silicon",
                "processor_generation": "Apple M3 / M3 Pro / M3 Max", "processor_model": "Apple M3 Pro (11-Core)",
                "ram_size_gb": "18GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.2\"", "display_resolution": "Liquid Retina XDR",
                "graphics_type": "Apple Unified GPU", "operating_system": "macOS"
            }),
            (comp_cat, "apple", "Apple MacBook Air 15 M3 / M2", "apple-macbook-air-15-m3", {
                "form_factor": "Ultrabook", "processor_brand": "Apple Silicon",
                "processor_generation": "Apple M3 / M3 Pro / M3 Max", "processor_model": "Apple M3 (8-Core)",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "15.3\"", "display_resolution": "Liquid Retina XDR",
                "graphics_type": "Apple Unified GPU", "operating_system": "macOS"
            }),
            (comp_cat, "apple", "Apple MacBook Air 13 M2 / M1", "apple-macbook-air-13-m2", {
                "form_factor": "Ultrabook", "processor_brand": "Apple Silicon",
                "processor_generation": "Apple M2 / M2 Pro / M2 Max", "processor_model": "Apple M2 (8-Core)",
                "ram_size_gb": "8GB", "storage_capacity": "256GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "13.6\"", "display_resolution": "Liquid Retina XDR",
                "graphics_type": "Apple Unified GPU", "operating_system": "macOS"
            }),
            (comp_cat, "apple", "Apple MacBook Pro 13 (Intel Core i5/i7 TouchBar 2016-2020)", "apple-macbook-pro-13-intel", {
                "form_factor": "Traditional Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 8th/9th Gen Core", "processor_model": "Core i5-8257U",
                "ram_size_gb": "8GB", "storage_capacity": "256GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "13.3\"", "display_resolution": "Liquid Retina XDR",
                "graphics_type": "Integrated Graphics", "operating_system": "macOS"
            }),
            (comp_cat, "apple", "Apple MacBook Pro 15 (Retina Intel Core i7 2012-2019)", "apple-macbook-pro-15-retina-intel", {
                "form_factor": "Traditional Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 4th-7th Gen Core", "processor_model": "Core i7-4870HQ",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "15.6\"", "display_resolution": "Liquid Retina XDR",
                "graphics_type": "Dedicated AMD Radeon", "operating_system": "macOS"
            }),
            (comp_cat, "apple", "Apple MacBook Air 13 (Classic Intel Core i5 2012-2017)", "apple-macbook-air-13-classic-intel", {
                "form_factor": "Ultrabook", "processor_brand": "Intel",
                "processor_generation": "Intel 4th-7th Gen Core", "processor_model": "Core i5-5250U",
                "ram_size_gb": "8GB", "storage_capacity": "128GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "13.3\"", "display_resolution": "HD (1366x768)",
                "graphics_type": "Integrated Graphics", "operating_system": "macOS"
            }),
            (comp_cat, "apple", "Apple iMac 24 M3 / M1 All-in-One", "apple-imac-24-m3", {
                "form_factor": "All-in-One (AIO)", "processor_brand": "Apple Silicon",
                "processor_generation": "Apple M3 / M3 Pro / M3 Max", "processor_model": "Apple M3 (8-Core CPU)",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "24.0\" (AIO)", "display_resolution": "4K UHD (3840x2160)",
                "graphics_type": "Apple Unified GPU", "operating_system": "macOS"
            }),

            # --- DELL ---
            (comp_cat, "dell", "Dell XPS 15 9530 / 9520", "dell-xps-15-9530", {
                "form_factor": "Traditional Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 13th Gen Core", "processor_model": "Core i7-13700H",
                "ram_size_gb": "16GB", "storage_capacity": "1TB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "15.6\"", "display_resolution": "3K / 3.5K OLED",
                "graphics_type": "Dedicated NVIDIA RTX 40-Series", "gpu_model": "RTX 4060 8GB",
                "operating_system": "Windows 11 Pro"
            }),
            (comp_cat, "dell", "Dell XPS 13 Plus 9320 / XPS 13 9310", "dell-xps-13-plus-9320", {
                "form_factor": "Ultrabook", "processor_brand": "Intel",
                "processor_generation": "Intel 12th Gen Core", "processor_model": "Core i7-1260P",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "13.3\"", "display_resolution": "FHD+ (1920x1200)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Pro"
            }),
            (comp_cat, "dell", "Dell Latitude 5440 / 5430 / 5420", "dell-latitude-5440", {
                "form_factor": "Traditional Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 13th Gen Core", "processor_model": "Core i5-1335U",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Pro"
            }),
            (comp_cat, "dell", "Dell Latitude 7420 / 7410 / 7490 / 7480", "dell-latitude-7420", {
                "form_factor": "Ultrabook", "processor_brand": "Intel",
                "processor_generation": "Intel 11th Gen Core", "processor_model": "Core i7-1185G7",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Pro"
            }),
            (comp_cat, "dell", "Dell Latitude E7470 / E7450 / E6430 Classic", "dell-latitude-e7470", {
                "form_factor": "Traditional Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 4th-7th Gen Core", "processor_model": "Core i5-6300U",
                "ram_size_gb": "8GB", "storage_capacity": "256GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 10 Pro"
            }),
            (comp_cat, "dell", "Dell Inspiron 15 3520 / 3511 / 5510", "dell-inspiron-15-3520", {
                "form_factor": "Traditional Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 12th Gen Core", "processor_model": "Core i5-1235U",
                "ram_size_gb": "8GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "15.6\"", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Home"
            }),
            (comp_cat, "dell", "Dell Alienware m16 / m18 Gaming Laptop", "dell-alienware-m16", {
                "form_factor": "Gaming Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 13th Gen Core", "processor_model": "Core i9-13900HX",
                "ram_size_gb": "32GB", "storage_capacity": "1TB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "16.0\"", "display_resolution": "2K / QHD (2560x1440)",
                "graphics_type": "Dedicated NVIDIA RTX 40-Series", "gpu_model": "RTX 4080 12GB",
                "operating_system": "Windows 11 Home"
            }),
            (comp_cat, "dell", "Dell OptiPlex 7010 / 5090 Desktop Tower", "dell-optiplex-7010", {
                "form_factor": "Desktop Tower", "processor_brand": "Intel",
                "processor_generation": "Intel 13th Gen Core", "processor_model": "Core i7-13700",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "24.0\" (AIO)", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Pro"
            }),

            # --- HP ---
            (comp_cat, "hp", "HP EliteBook 840 G10 / G9", "hp-elitebook-840-g10", {
                "form_factor": "Traditional Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 13th Gen Core", "processor_model": "Core i7-1355U",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "FHD+ (1920x1200)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Pro"
            }),
            (comp_cat, "hp", "HP EliteBook 840 G8 / G7 / G6 / G5", "hp-elitebook-840-g8", {
                "form_factor": "Ultrabook", "processor_brand": "Intel",
                "processor_generation": "Intel 11th Gen Core", "processor_model": "Core i7-1165G7",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 10 Pro"
            }),
            (comp_cat, "hp", "HP EliteBook 840 G4 / G3 / G2 / G1 Classic", "hp-elitebook-840-g3", {
                "form_factor": "Traditional Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 4th-7th Gen Core", "processor_model": "Core i5-6200U",
                "ram_size_gb": "8GB", "storage_capacity": "256GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 10 Pro"
            }),
            (comp_cat, "hp", "HP ProBook 450 G10 / G9 / G8", "hp-probook-450-g10", {
                "form_factor": "Traditional Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 13th Gen Core", "processor_model": "Core i5-1335U",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "15.6\"", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Pro"
            }),
            (comp_cat, "hp", "HP Spectre x360 14 / 16 2-in-1 Touch", "hp-spectre-x360-14", {
                "form_factor": "2-in-1 Convertible / Touch", "processor_brand": "Intel",
                "processor_generation": "Intel Core Ultra", "processor_model": "Core Ultra 7 155H",
                "ram_size_gb": "16GB", "storage_capacity": "1TB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "3K / 3.5K OLED",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Home"
            }),
            (comp_cat, "hp", "HP Envy x360 15 / 14 2-in-1", "hp-envy-x360-15", {
                "form_factor": "2-in-1 Convertible / Touch", "processor_brand": "AMD",
                "processor_generation": "AMD Ryzen 8000/7000 Series", "processor_model": "Ryzen 7 7730U",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "15.6\"", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Home"
            }),
            (comp_cat, "hp", "HP Omen 16 / Victus 15 Gaming Laptop", "hp-victus-15-gaming", {
                "form_factor": "Gaming Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 13th Gen Core", "processor_model": "Core i5-13420H",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "15.6\"", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Dedicated NVIDIA RTX 40-Series", "gpu_model": "RTX 4050 6GB",
                "operating_system": "Windows 11 Home"
            }),

            # --- LENOVO ---
            (comp_cat, "lenovo", "Lenovo ThinkPad X1 Carbon Gen 12 / 11 / 10", "lenovo-thinkpad-x1-carbon-gen-11", {
                "form_factor": "Ultrabook", "processor_brand": "Intel",
                "processor_generation": "Intel 13th Gen Core", "processor_model": "Core i7-1365U",
                "ram_size_gb": "32GB", "storage_capacity": "1TB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "2K / QHD (2560x1440)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Pro"
            }),
            (comp_cat, "lenovo", "Lenovo ThinkPad T14 Gen 4 / Gen 3 / Gen 2", "lenovo-thinkpad-t14-gen-4", {
                "form_factor": "Traditional Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 13th Gen Core", "processor_model": "Core i5-1335U",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "FHD+ (1920x1200)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Pro"
            }),
            (comp_cat, "lenovo", "Lenovo ThinkPad T490 / T480 / T470 / T460", "lenovo-thinkpad-t480", {
                "form_factor": "Traditional Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 8th/9th Gen Core", "processor_model": "Core i5-8250U",
                "ram_size_gb": "16GB", "storage_capacity": "256GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Pro"
            }),
            (comp_cat, "lenovo", "Lenovo ThinkPad E14 / E15 / E490 / E480", "lenovo-thinkpad-e14", {
                "form_factor": "Traditional Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 12th Gen Core", "processor_model": "Core i5-1235U",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Pro"
            }),
            (comp_cat, "lenovo", "Lenovo Legion Pro 7i / Legion 5 Gaming", "lenovo-legion-pro-7i", {
                "form_factor": "Gaming Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 13th Gen Core", "processor_model": "Core i9-13900HX",
                "ram_size_gb": "32GB", "storage_capacity": "1TB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "16.0\"", "display_resolution": "2K / QHD (2560x1440)",
                "graphics_type": "Dedicated NVIDIA RTX 40-Series", "gpu_model": "RTX 4080 12GB",
                "operating_system": "Windows 11 Home"
            }),
            (comp_cat, "lenovo", "Lenovo IdeaPad 3 / 5 / Slim 3", "lenovo-ideapad-3", {
                "form_factor": "Traditional Laptop", "processor_brand": "AMD",
                "processor_generation": "AMD Ryzen 5000 Series", "processor_model": "Ryzen 5 5500U",
                "ram_size_gb": "8GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "15.6\"", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Home"
            }),

            # --- ASUS & ACER & MSI & SURFACE ---
            (comp_cat, "asus", "Asus ROG Zephyrus G14 / G16 Gaming", "asus-rog-zephyrus-g14", {
                "form_factor": "Gaming Laptop", "processor_brand": "AMD",
                "processor_generation": "AMD Ryzen 8000/7000 Series", "processor_model": "Ryzen 9 8945HS",
                "ram_size_gb": "32GB", "storage_capacity": "1TB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "3K / 3.5K OLED",
                "graphics_type": "Dedicated NVIDIA RTX 40-Series", "gpu_model": "RTX 4070 8GB",
                "operating_system": "Windows 11 Home"
            }),
            (comp_cat, "asus", "Asus ZenBook 14 OLED / Pro 14", "asus-zenbook-14-oled", {
                "form_factor": "Ultrabook", "processor_brand": "Intel",
                "processor_generation": "Intel Core Ultra", "processor_model": "Core Ultra 7 155H",
                "ram_size_gb": "16GB", "storage_capacity": "1TB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "3K / 3.5K OLED",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Home"
            }),
            (comp_cat, "asus", "Asus TUF Gaming A15 / F15", "asus-tuf-gaming-a15", {
                "form_factor": "Gaming Laptop", "processor_brand": "AMD",
                "processor_generation": "AMD Ryzen 8000/7000 Series", "processor_model": "Ryzen 7 7735HS",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "15.6\"", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Dedicated NVIDIA RTX 40-Series", "gpu_model": "RTX 4060 8GB",
                "operating_system": "Windows 11 Home"
            }),
            (comp_cat, "acer", "Acer Nitro 16 / Nitro 5 Gaming Laptop", "acer-nitro-5-gaming", {
                "form_factor": "Gaming Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 12th Gen Core", "processor_model": "Core i5-12500H",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "15.6\"", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Dedicated NVIDIA RTX 30-Series", "gpu_model": "RTX 3050 4GB",
                "operating_system": "Windows 11 Home"
            }),
            (comp_cat, "acer", "Acer Swift Go 14 / Aspire 5", "acer-swift-go-14", {
                "form_factor": "Ultrabook", "processor_brand": "Intel",
                "processor_generation": "Intel 13th Gen Core", "processor_model": "Core i7-13700H",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "2K / QHD (2560x1440)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Home"
            }),
            (comp_cat, "msi", "MSI Katana 15 / Stealth 16 Gaming", "msi-katana-15", {
                "form_factor": "Gaming Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 13th Gen Core", "processor_model": "Core i7-13620H",
                "ram_size_gb": "16GB", "storage_capacity": "1TB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "15.6\"", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Dedicated NVIDIA RTX 40-Series", "gpu_model": "RTX 4060 8GB",
                "operating_system": "Windows 11 Home"
            }),
            (comp_cat, "microsoft-surface", "Microsoft Surface Pro 11 / Pro 9 2-in-1", "microsoft-surface-pro-9", {
                "form_factor": "2-in-1 Convertible / Touch", "processor_brand": "Intel",
                "processor_generation": "Intel 12th Gen Core", "processor_model": "Core i7-1255U",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "13.3\"", "display_resolution": "2K / QHD (2560x1440)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Home"
            }),
            (comp_cat, "microsoft-surface", "Microsoft Surface Laptop 7 / 6 / 5", "microsoft-surface-laptop-5", {
                "form_factor": "Ultrabook", "processor_brand": "Intel",
                "processor_generation": "Intel 12th Gen Core", "processor_model": "Core i5-1235U",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "13.6\"", "display_resolution": "2K / QHD (2560x1440)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Home"
            }),

            # ═══════════════════════════════════════════════════════════════════
            # TVS, AUDIO, CAMERAS, CONSOLES, COMMERCIAL, SOLAR & TOOLS
            # ═══════════════════════════════════════════════════════════════════
            # TVs & Audio
            (tv_cat, "samsung", "Samsung 65-inch Neo QLED 4K TV", "samsung-65-neo-qled-4k", {
                "product_subtype": "Television", "screen_size_inch": "65\"",
                "display_technology": "QLED", "display_resolution": "4K Ultra HD (3840x2160)",
                "smart_tv_platform": "Samsung Tizen OS"
            }),
            (tv_cat, "lg", "LG 55-inch C3 4K OLED TV", "lg-55-c3-oled-tv", {
                "product_subtype": "Television", "screen_size_inch": "55\"",
                "display_technology": "OLED", "display_resolution": "4K Ultra HD (3840x2160)",
                "smart_tv_platform": "LG webOS"
            }),
            (tv_cat, "sony", "Sony BRAVIA XR 65-inch 4K HDR TV", "sony-bravia-xr-65", {
                "product_subtype": "Television", "screen_size_inch": "65\"",
                "display_technology": "OLED", "display_resolution": "4K Ultra HD (3840x2160)",
                "smart_tv_platform": "Google TV"
            }),
            (tv_cat, "jbl", "JBL PartyBox 310 Bluetooth Speaker", "jbl-partybox-310", {
                "product_subtype": "Party Speaker / Hi-Fi Tower",
                "audio_power_output_rms_watts": "240W", "audio_channels": "2.0 Stereo",
                "waterproof_rating": "IPX4 (Splashproof)"
            }),

            # Gaming & Cameras
            (game_cat, "sony-playstation", "Sony PlayStation 5 Pro / Disc Edition", "sony-playstation-5", {
                "console_type": "Home Console (Disc Edition)", "platform": "PlayStation 5",
                "storage_capacity": "825GB SSD", "max_resolution_output": "4K UHD (60/120Hz)",
                "refresh_rate_vrr": "120Hz VRR Supported", "optical_drive_type": "4K Ultra HD Blu-ray"
            }),
            (game_cat, "microsoft-xbox", "Microsoft Xbox Series X (1TB)", "xbox-series-x", {
                "console_type": "Home Console (Disc Edition)", "platform": "Xbox Series X",
                "storage_capacity": "1TB NVMe SSD", "max_resolution_output": "4K UHD (60/120Hz)",
                "refresh_rate_vrr": "120Hz VRR Supported"
            }),
            (game_cat, "nintendo", "Nintendo Switch OLED Model", "nintendo-switch-oled", {
                "console_type": "Hybrid Console / Handheld", "platform": "Nintendo Switch",
                "storage_capacity": "64GB Internal", "max_resolution_output": "1080p (Docked) / 720p (Handheld)"
            }),
            (cam_cat, "sony", "Sony Alpha A7 IV Mirrorless Camera", "sony-alpha-a7-iv", {
                "photography_type": "Mirrorless Camera", "sensor_format": "Full Frame (35mm)",
                "sensor_resolution_mp": "26MP - 33MP", "max_video_resolution": "4K 30/60 fps",
                "lens_mount_compatibility": "Sony E-Mount",
                "stabilization_type": "5-Axis In-Body Sensor-Shift (IBIS)"
            }),
            (cam_cat, "canon", "Canon EOS R6 Mark II Mirrorless", "canon-eos-r6-mark-ii", {
                "photography_type": "Mirrorless Camera", "sensor_format": "Full Frame (35mm)",
                "sensor_resolution_mp": "24MP", "max_video_resolution": "4K 60 fps",
                "lens_mount_compatibility": "Canon RF-Mount"
            }),

            # Trucks & Commercial
            (truck_cat, "isuzu", "Isuzu Forward FRR Commercial Truck", "isuzu-forward-frr", {
                "commercial_type": "Medium Duty Truck (7-15 Ton)", "payload_capacity": "7 - 10 Tons",
                "axle_configuration": "4x2", "engine_fuel_type": "Diesel",
                "transmission": "Manual", "year": 2021
            }),
            (truck_cat, "scania", "Scania R500 Prime Mover (6x4)", "scania-r500-prime-mover", {
                "commercial_type": "Heavy Duty Prime Mover / Tractor Head", "payload_capacity": "30+ Tons",
                "axle_configuration": "6x4 (Double Differential)", "engine_fuel_type": "Diesel",
                "transmission": "Automated Manual (AMT)", "year": 2022
            }),

            # Solar & Tools
            (solar_cat, "felicity-solar", "Felicity Solar 10kWh LiFePO4 Battery", "felicity-solar-10kwh-lifepo4", {
                "solar_equipment_type": "Lithium LiFePO4 Battery",
                "power_wattage_rating": "48V 200Ah (10.24kWh LiFePO4)",
                "voltage_system": "48V DC", "battery_chemistry": "Lithium Iron Phosphate (LiFePO4)"
            }),
            (tool_cat, "bosch", "Bosch GSR 18V-50 Cordless Drill", "bosch-gsr-18v-50", {
                "tool_category": "Cordless Drill / Driver",
                "power_source_type": "Cordless Li-Ion Battery (18V / 20V)",
                "motor_technology": "Brushless Motor (Heavy Duty)"
            })
        ]

        for cat, brand_slug, name, slug, specs in reference_products_data:
            if not cat: continue
            brand = brands_dict.get(brand_slug)
            if not brand: continue
            rp, _ = ReferenceProduct.objects.update_or_create(
                slug=slug,
                defaults={
                    'name': name,
                    'brand': brand,
                    'category': cat,
                    'structured_specs': specs
                }
            )

        # ------------------------------------------------------------------
        # 4. SEED SAMPLE ACTIVE PRODUCTS (Instant Non-Zero Buyer Facets)
        # ------------------------------------------------------------------
        print("4. Creating Sample Verified Active Listings...")
        seller = User.objects.filter(is_staff=True).first() or User.objects.first()
        if not seller:
            seller = User.objects.create_user(username='verified_seller', email='seller@uzaspea.com', password='password123')

        sample_products = [
            (comp_cat, "apple", "MacBook Pro 14 M3 Pro (18GB RAM / 512GB SSD) Space Black", "macbook-pro-14-m3-pro-space-black", Decimal("4800000.00"), {
                "form_factor": "Traditional Laptop", "processor_brand": "Apple Silicon",
                "processor_generation": "Apple M3 / M3 Pro / M3 Max", "processor_model": "Apple M3 Pro",
                "ram_size_gb": "18GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.2\"", "display_resolution": "Liquid Retina XDR",
                "graphics_type": "Apple Unified GPU", "operating_system": "macOS"
            }),
            (comp_cat, "dell", "Dell XPS 15 9530 Core i7-13700H 16GB 1TB SSD RTX 4060 OLED", "dell-xps-15-9530-rtx4060-oled", Decimal("4200000.00"), {
                "form_factor": "Traditional Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 13th Gen Core", "processor_model": "Core i7-13700H",
                "ram_size_gb": "16GB", "storage_capacity": "1TB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "15.6\"", "display_resolution": "3K / 3.5K OLED",
                "graphics_type": "Dedicated NVIDIA RTX 40-Series", "gpu_model": "RTX 4060",
                "operating_system": "Windows 11 Pro"
            }),
            (comp_cat, "lenovo", "Lenovo ThinkPad T14 Gen 4 Core i5-1335U 16GB 512GB SSD", "lenovo-thinkpad-t14-gen-4-core-i5", Decimal("2600000.00"), {
                "form_factor": "Traditional Laptop", "processor_brand": "Intel",
                "processor_generation": "Intel 13th Gen Core", "processor_model": "Core i5-1335U",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "FHD+ (1920x1200)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 11 Pro"
            }),
            (comp_cat, "hp", "HP EliteBook 840 G8 Core i7-1165G7 16GB 512GB SSD Silver", "hp-elitebook-840-g8-i7-16gb", Decimal("1950000.00"), {
                "form_factor": "Ultrabook", "processor_brand": "Intel",
                "processor_generation": "Intel 11th Gen Core", "processor_model": "Core i7-1165G7",
                "ram_size_gb": "16GB", "storage_capacity": "512GB", "storage_type": "NVMe M.2 PCIe SSD",
                "screen_size_inch": "14.0\"", "display_resolution": "FHD (1920x1080)",
                "graphics_type": "Integrated Graphics", "operating_system": "Windows 10 Pro"
            }),
            (phone_cat, "apple", "Apple iPhone 15 Pro Max 256GB Natural Titanium (5G)", "apple-iphone-15-pro-max-256gb-natural", Decimal("3200000.00"), {
                "device_type": "Smartphone", "ram_size_gb": "8GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "LTPO OLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "os_platform": "iOS"
            }),
            (phone_cat, "samsung", "Samsung Galaxy S24 Ultra 5G 512GB Titanium Black", "samsung-galaxy-s24-ultra-512gb-black", Decimal("3400000.00"), {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "512GB",
                "network_generation": "5G", "screen_size_inch": "6.8\" - 6.9\"", "display_type": "Dynamic AMOLED 2X",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "200MP", "os_platform": "Android"
            }),
            (phone_cat, "tecno", "Tecno Camon 30 Premier 5G 512GB 12GB RAM Alpine Glow", "tecno-camon-30-premier-512gb-12gb", Decimal("1150000.00"), {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "512GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "LTPO OLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "48MP - 50MP", "os_platform": "Android"
            }),
            (phone_cat, "infinix", "Infinix Note 40 Pro+ 5G 256GB 12GB RAM Obsidian Black", "infinix-note-40-pro-plus-256gb-12gb", Decimal("890000.00"), {
                "device_type": "Smartphone", "ram_size_gb": "12GB", "storage_internal": "256GB",
                "network_generation": "5G", "screen_size_inch": "6.5\" - 6.7\"", "display_type": "Super AMOLED",
                "refresh_rate_hz": "120Hz", "main_camera_mp": "108MP", "os_platform": "Android"
            }),
            (tv_cat, "lg", "LG 55-inch C3 Series 4K OLED evo Smart TV (2023)", "lg-55-c3-4k-oled-evo-smart-tv", Decimal("3100000.00"), {
                "product_subtype": "Television", "screen_size_inch": "55\"", "display_technology": "OLED",
                "display_resolution": "4K Ultra HD (3840x2160)", "smart_tv_platform": "LG webOS"
            }),
            (tv_cat, "jbl", "JBL PartyBox 310 Portable Bluetooth Party Speaker 240W", "jbl-partybox-310-portable-speaker", Decimal("1750000.00"), {
                "product_subtype": "Party Speaker / Hi-Fi Tower", "audio_power_output_rms_watts": "240W",
                "audio_channels": "2.0 Stereo"
            }),
            (game_cat, "playstation", "Sony PlayStation 5 Console (Disc Edition 825GB)", "sony-ps5-console-disc-edition", Decimal("1650000.00"), {
                "console_type": "Home Console (Disc Edition)", "platform": "PlayStation 5",
                "storage_capacity": "825GB SSD", "max_resolution_output": "4K UHD (60/120Hz)"
            }),
            (truck_cat, "isuzu", "2021 Isuzu Forward FRR 8-Ton Cargo Truck (Diesel Manual)", "2021-isuzu-forward-frr-8-ton", Decimal("75000000.00"), {
                "commercial_type": "Medium Duty Truck (7-15 Ton)", "payload_capacity": "7 - 10 Tons",
                "axle_configuration": "4x2", "engine_fuel_type": "Diesel", "transmission": "Manual", "year": 2021
            }),
            (solar_cat, "felicity-solar", "Felicity Solar 48V 200Ah 10kWh LiFePO4 Lithium Battery Wall-Mount", "felicity-solar-48v-200ah-10kwh-battery", Decimal("6500000.00"), {
                "solar_equipment_type": "Lithium LiFePO4 Battery", "power_wattage_rating": "48V 200Ah (10.24kWh LiFePO4)",
                "voltage_system": "48V DC", "battery_chemistry": "Lithium Iron Phosphate (LiFePO4)"
            })
        ]

        for cat, brand_slug, name, slug, price, specs in sample_products:
            if not cat: continue
            brand = brands_dict.get(brand_slug)
            Product.objects.update_or_create(
                slug=slug,
                defaults={
                    'name': name,
                    'category': cat,
                    'brand': brand,
                    'price': price,
                    'stock': 10,
                    'is_available': True,
                    'condition': 'New',
                    'seller': seller,
                    'structured_specs': specs,
                    'specifications': specs
                }
            )

    print("✓ Successfully seeded Technical Schemas, Brands, Category Associations, Models & Active Products!")

class Command(BaseCommand):
    help = 'Seeds technical schemas, brands, category-brand associations, models, and reference products'

    def handle(self, *args, **options):
        run_seed()

if __name__ == '__main__':
    run_seed()
