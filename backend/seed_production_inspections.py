import os
import django
import sys

sys.path.append('/home/bea/uzaspea/backend')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uzachuo.settings")
django.setup()

from inspections.models import InspectionCategory, ChecklistItem, ChecklistTemplate
from marketplace.models import Category

def run():
    print("Linking InspectionCategories to marketplace Categories...")
    
    # 1. Sync existing categories based on slug matching
    market_cats = {c.slug: c for c in Category.objects.all()}
    inspection_cats = InspectionCategory.objects.all()
    
    linked_count = 0
    for icat in inspection_cats:
        if not icat.marketplace_category and icat.slug in market_cats:
            icat.marketplace_category = market_cats[icat.slug]
            icat.save()
            linked_count += 1
            print(f"Linked '{icat.name}' to marketplace category.")
            
    print(f"Linked {linked_count} existing categories.")

    # 2. Comprehensive Checklists to seed
    seed_data = [
        {
            "slug": "motorcycles",
            "name": "Motorcycles",
            "sections": {
                "Engine & Drivetrain": [
                    ("Engine Starts Smoothly", "pass_fail", True),
                    ("No Oil Leaks", "pass_fail", True),
                    ("Exhaust System Condition", "pass_fail", True),
                    ("Chain/Belt Tension", "pass_fail", True),
                    ("Transmission Shifting", "pass_fail", True),
                ],
                "Brakes & Wheels": [
                    ("Front Brake Pad Wear", "pass_fail", True),
                    ("Rear Brake Pad Wear", "pass_fail", True),
                    ("Tire Tread Depth (mm)", "value", True),
                    ("Wheel Alignment", "pass_fail", True),
                    ("Spoke/Rim Condition", "pass_fail", True),
                ],
                "Electrical & Controls": [
                    ("Headlight (High/Low)", "pass_fail", True),
                    ("Turn Signals & Horn", "pass_fail", True),
                    ("Battery Voltage (V)", "value", True),
                    ("Gauges/Dash Display", "pass_fail", True),
                    ("Clutch Lever Play", "pass_fail", True),
                ],
                "Body & Frame": [
                    ("Frame Straightness", "pass_fail", True),
                    ("Paint/Fairing Condition", "pass_fail", True),
                    ("Seat Condition", "pass_fail", True),
                    ("Suspension Fork Seals", "pass_fail", True),
                    ("Rear Shock Condition", "pass_fail", True),
                ]
            }
        },
        {
            "slug": "trucks",
            "name": "Trucks & Commercial Vehicles",
            "sections": {
                "Powertrain (Heavy Duty)": [
                    ("Diesel Engine Performance", "pass_fail", True),
                    ("Turbocharger Condition", "pass_fail", True),
                    ("Cooling System (Radiator/Hoses)", "pass_fail", True),
                    ("Transmission PTO (if applicable)", "pass_fail", False),
                    ("Driveshaft/U-Joints", "pass_fail", True),
                ],
                "Chassis & Suspension": [
                    ("Leaf Springs/Air Ride", "pass_fail", True),
                    ("Frame Rails Integrity", "pass_fail", True),
                    ("Steering Linkage", "pass_fail", True),
                    ("Fifth Wheel/Hitch Condition", "pass_fail", True),
                ],
                "Braking System": [
                    ("Air Brake System Pressure (psi)", "value", True),
                    ("Slack Adjusters", "pass_fail", True),
                    ("Brake Drum/Rotor Condition", "pass_fail", True),
                    ("Parking Brake Function", "pass_fail", True),
                ],
                "Cab & Electrical": [
                    ("Dashboard Warning Lights", "pass_fail", True),
                    ("Wipers & Washers", "pass_fail", True),
                    ("Mirrors (Heated/Power)", "pass_fail", True),
                    ("Air Conditioning/Heating", "pass_fail", True),
                    ("Trailer Light Connection", "pass_fail", True),
                ],
                "Tires & Wheels": [
                    ("Steer Tires Tread (mm)", "value", True),
                    ("Drive Tires Tread (mm)", "value", True),
                    ("Dual Tire Spacing/Condition", "pass_fail", True),
                    ("Lug Nuts Torque Check", "pass_fail", True),
                ]
            }
        },
        {
            "slug": "tvs",
            "name": "Televisions",
            "sections": {
                "Display & Picture": [
                    ("Screen Condition (No Cracks)", "pass_fail", True),
                    ("Dead/Stuck Pixels", "pass_fail", True),
                    ("Backlight Bleed/Uniformity", "pass_fail", True),
                    ("Color Accuracy", "pass_fail", True),
                    ("Refresh Rate Smoothness", "pass_fail", True),
                ],
                "Audio": [
                    ("Internal Speakers Clarity", "pass_fail", True),
                    ("No Audio Distortion/Buzz", "pass_fail", True),
                    ("Volume Range Output", "pass_fail", True),
                ],
                "Connectivity & Smart Features": [
                    ("HDMI Ports Functioning", "pass_fail", True),
                    ("USB Ports Functioning", "pass_fail", True),
                    ("Wi-Fi Connection", "pass_fail", True),
                    ("Smart OS Responsiveness", "pass_fail", True),
                    ("Remote Control Operation", "pass_fail", True),
                ],
                "Power & Build": [
                    ("Power Cable/Port Condition", "pass_fail", True),
                    ("Stand/Wall Mount Integrity", "pass_fail", True),
                    ("Bezel & Casing Condition", "pass_fail", True),
                ]
            }
        },
        {
            "slug": "commercial-property",
            "name": "Commercial Property",
            "sections": {
                "Exterior & Structure": [
                    ("Roofing Condition", "pass_fail", True),
                    ("Foundation & Load-Bearing Walls", "pass_fail", True),
                    ("Facade & Cladding", "pass_fail", True),
                    ("Parking Lot/Paving Condition", "pass_fail", True),
                    ("Drainage Systems", "pass_fail", True),
                ],
                "Interior & HVAC": [
                    ("HVAC Systems (Heating/Cooling)", "pass_fail", True),
                    ("Air Quality/Ventilation", "pass_fail", True),
                    ("Flooring & Ceiling Condition", "pass_fail", True),
                    ("Restroom Plumbing", "pass_fail", True),
                    ("Elevator Operation", "pass_fail", True),
                ],
                "Safety & Compliance": [
                    ("Fire Suppression (Sprinklers/Extinguishers)", "pass_fail", True),
                    ("Emergency Exits & Lighting", "pass_fail", True),
                    ("ADA Accessibility", "pass_fail", True),
                    ("Security/Alarm Systems", "pass_fail", True),
                ],
                "Electrical Systems": [
                    ("Main Breaker Panels", "pass_fail", True),
                    ("Lighting Fixtures", "pass_fail", True),
                    ("Data & Telecom Wiring", "pass_fail", True),
                    ("Generator/Backup Power", "pass_fail", False),
                ]
            }
        },
        {
            "slug": "land",
            "name": "Land",
            "sections": {
                "Terrain & Soil": [
                    ("Topography (Flat/Sloped/Hilly)", "text", True),
                    ("Soil Quality/Type", "text", True),
                    ("Signs of Erosion", "pass_fail", True),
                    ("Flood Risk Indicators", "pass_fail", True),
                ],
                "Boundaries & Access": [
                    ("Fencing/Markers Present", "pass_fail", True),
                    ("Public Road Access", "pass_fail", True),
                    ("Easements/Right of Way Visible", "pass_fail", True),
                    ("Gate Condition", "pass_fail", False),
                ],
                "Utilities & Resources": [
                    ("Water Source Availability", "pass_fail", True),
                    ("Electricity Access", "pass_fail", True),
                    ("Sewer/Septic Suitability", "pass_fail", True),
                    ("Timber/Mineral Value Noted", "pass_fail", False),
                ],
                "Environmental": [
                    ("Waste/Debris Present", "pass_fail", True),
                    ("Protected Vegetation/Wetlands", "pass_fail", True),
                ]
            }
        },
        {
            "slug": "agricultural-equipment",
            "name": "Agricultural Equipment",
            "sections": {
                "Engine & Hydraulics": [
                    ("Engine Start & Idle", "pass_fail", True),
                    ("Hydraulic Pump Pressure", "pass_fail", True),
                    ("Hydraulic Hoses/Fittings (No Leaks)", "pass_fail", True),
                    ("Cooling System (Radiator)", "pass_fail", True),
                    ("Exhaust Emissions", "pass_fail", True),
                ],
                "Drive & Operation": [
                    ("Transmission Performance", "pass_fail", True),
                    ("PTO (Power Take-Off) Function", "pass_fail", True),
                    ("Steering & Articulation", "pass_fail", True),
                    ("Brake Effectiveness", "pass_fail", True),
                ],
                "Attachments & Implements": [
                    ("Three-Point Hitch Condition", "pass_fail", True),
                    ("Loader Arms/Bucket (if applicable)", "pass_fail", False),
                    ("Cutting/Tilling Blades Wear", "pass_fail", False),
                ],
                "Cab & Safety": [
                    ("ROPS (Roll-Over Protection)", "pass_fail", True),
                    ("Seatbelt Condition", "pass_fail", True),
                    ("Cab AC/Heating", "pass_fail", False),
                    ("Work Lights Functioning", "pass_fail", True),
                    ("Tire Tread (Deep Lugs)", "pass_fail", True),
                ]
            }
        }
    ]

    for cat_data in seed_data:
        # Create or update category
        icat, created = InspectionCategory.objects.get_or_create(
            slug=cat_data["slug"],
            defaults={"name": cat_data["name"]}
        )
        
        # Link to marketplace if exists
        if not icat.marketplace_category:
            m_cat = market_cats.get(cat_data["slug"])
            if m_cat:
                icat.marketplace_category = m_cat
                icat.save()
                
        template, _ = ChecklistTemplate.objects.get_or_create(category=icat)

        # Check existing items
        existing_items = ChecklistItem.objects.filter(template=template).count()
        if existing_items == 0:
            print(f"Creating checklists for '{icat.name}'...")
            items_to_create = []
            order = 0
            for section, items in cat_data["sections"].items():
                for label, item_type, is_mandatory in items:
                    items_to_create.append(ChecklistItem(
                        template=template,
                        section=section,
                        label=label,
                        item_type=item_type,
                        is_mandatory=is_mandatory,
                        order=order
                    ))
                    order += 1
            ChecklistItem.objects.bulk_create(items_to_create)
            print(f" -> Added {len(items_to_create)} items.")
        else:
            print(f"'{icat.name}' already has {existing_items} items. Skipping checklist creation.")

    print("Seeding complete.")

if __name__ == '__main__':
    run()
