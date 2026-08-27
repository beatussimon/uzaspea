import os, sys, django
from django.utils.text import slugify

sys.path.insert(0, '/home/bea/uzaspea/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from django.core.cache import cache
from marketplace.models import Category, Product, Brand, ReferenceProduct

MASTER_TAXONOMY = [
    {
        "name": "Electronics",
        "slug": "electronics",
        "icon": "laptop",
        "subcategories": [
            {"name": "Computers & Laptops", "slug": "electronics-computers-laptops"},
            {"name": "Mobile Phones", "slug": "electronics-mobile-phones"},
            {"name": "Tablets & E-Readers", "slug": "electronics-tablets-ereaders"},
            {"name": "TVs & Audio", "slug": "electronics-tvs-audio"},
            {"name": "Cameras & Lenses", "slug": "electronics-cameras-lenses"},
            {"name": "Video Games & Consoles", "slug": "electronics-video-games-consoles"},
            {"name": "Smartwatches & Wearables", "slug": "electronics-smartwatches-wearables"},
            {"name": "Computer Accessories & Parts", "slug": "electronics-computer-accessories"},
            {"name": "Headphones & Earphones", "slug": "electronics-headphones-earphones"},
        ]
    },
    {
        "name": "Vehicles",
        "slug": "vehicles",
        "icon": "car",
        "subcategories": [
            {"name": "Cars", "slug": "vehicles-cars"},
            {"name": "Motorcycles", "slug": "vehicles-motorcycles"},
            {"name": "Tricycles & Tuk-Tuks (Bajaj)", "slug": "vehicles-tricycles-tuktuks"},
            {"name": "Trucks & Commercial Vehicles", "slug": "vehicles-trucks-commercial-vehicles"},
            {"name": "Vehicle Parts & Accessories", "slug": "vehicles-vehicle-parts-accessories"},
            {"name": "Tyres, Rims & Wheels", "slug": "vehicles-tyres-rims-wheels"},
            {"name": "Boats & Watercraft", "slug": "vehicles-boats-watercraft"},
            {"name": "Heavy Machinery & Construction", "slug": "vehicles-heavy-machinery"},
        ]
    },
    {
        "name": "Solar & Energy",
        "slug": "solar-energy",
        "icon": "zap",
        "subcategories": [
            {"name": "Solar Panels", "slug": "solar-energy-solar-panels"},
            {"name": "Solar Inverters & Controllers", "slug": "solar-energy-solar-inverters"},
            {"name": "Solar & Deep Cycle Batteries", "slug": "solar-energy-solar-batteries"},
            {"name": "Generators & Power Plants", "slug": "solar-energy-generators"},
            {"name": "Solar Water Pumps & Heaters", "slug": "solar-energy-water-pumps-heaters"},
            {"name": "Solar Street Lights & Floodlights", "slug": "solar-energy-street-lights"},
        ]
    },
    {
        "name": "Tools, Hardware & Industrial",
        "slug": "tools-hardware-industrial",
        "icon": "wrench",
        "subcategories": [
            {"name": "Power Tools & Machinery", "slug": "tools-power-tools-machinery"},
            {"name": "Hand Tools & Tool Sets", "slug": "tools-hand-tools"},
            {"name": "Water Pumps & Irrigation", "slug": "tools-water-pumps-irrigation"},
            {"name": "Welding & Gas Equipment", "slug": "tools-welding-equipment"},
            {"name": "Electrical & Wiring Supplies", "slug": "tools-electrical-supplies"},
            {"name": "Safety Gear & PPE", "slug": "tools-safety-gear"},
            {"name": "Building & Hardware Materials", "slug": "tools-building-materials"},
        ]
    },
    {
        "name": "Home, Furniture & Appliances",
        "slug": "home-furniture-appliances",
        "icon": "home",
        "subcategories": [
            {"name": "Large Home Appliances", "slug": "home-large-appliances"},
            {"name": "Kitchen & Small Appliances", "slug": "home-kitchen-small-appliances"},
            {"name": "Living Room Furniture", "slug": "home-living-room-furniture"},
            {"name": "Bedroom & Mattresses", "slug": "home-bedroom-furniture"},
            {"name": "Office Furniture", "slug": "home-office-furniture"},
            {"name": "Home Decor, Rugs & Lighting", "slug": "home-decor-lighting"},
            {"name": "Cookware & Dining", "slug": "home-cookware-dining"},
        ]
    },
    {
        "name": "Men's Fashion",
        "slug": "mens-fashion",
        "icon": "shirt",
        "subcategories": [
            {"name": "Clothing", "slug": "mens-fashion-clothing"},
            {"name": "Shoes", "slug": "mens-fashion-shoes"},
            {"name": "Bags & Accessories", "slug": "mens-fashion-bags-accessories"},
            {"name": "Watches", "slug": "mens-fashion-watches"},
            {"name": "Activewear & Sportswear", "slug": "mens-fashion-activewear"},
        ]
    },
    {
        "name": "Women's Fashion",
        "slug": "womens-fashion",
        "icon": "shirt",
        "subcategories": [
            {"name": "Dresses & Clothing", "slug": "womens-fashion-clothing"},
            {"name": "Shoes & Heels", "slug": "womens-fashion-shoes"},
            {"name": "Handbags & Purses", "slug": "womens-fashion-handbags"},
            {"name": "Jewelry & Watches", "slug": "womens-fashion-jewelry-watches"},
            {"name": "Beauty & Fashion Accessories", "slug": "womens-fashion-accessories"},
        ]
    },
    {
        "name": "Health & Beauty",
        "slug": "health-beauty",
        "icon": "heart",
        "subcategories": [
            {"name": "Skin Care & Body Care", "slug": "health-beauty-skin-care"},
            {"name": "Hair Care & Extensions", "slug": "health-beauty-hair-care"},
            {"name": "Fragrances & Perfumes", "slug": "health-beauty-fragrances"},
            {"name": "Makeup & Cosmetics", "slug": "health-beauty-makeup"},
            {"name": "Clippers & Personal Grooming", "slug": "health-beauty-grooming"},
            {"name": "Medical Supplies & Monitors", "slug": "health-beauty-medical-supplies"},
        ]
    },
    {
        "name": "Printers, POS & Networking",
        "slug": "printers-pos-networking",
        "icon": "printer",
        "subcategories": [
            {"name": "Printers & Copiers", "slug": "printers-pos-printers-copiers"},
            {"name": "POS & Barcode Systems", "slug": "printers-pos-systems"},
            {"name": "Networking & Routers", "slug": "printers-pos-networking-routers"},
            {"name": "CCTV, Security & Alarms", "slug": "printers-pos-cctv-security"},
            {"name": "Office Supplies & Stationery", "slug": "printers-pos-office-supplies"},
        ]
    },
    {
        "name": "Sports, Fitness & Outdoor",
        "slug": "sports-fitness-outdoor",
        "icon": "trophy",
        "subcategories": [
            {"name": "Gym & Fitness Equipment", "slug": "sports-gym-fitness"},
            {"name": "Football & Team Sports", "slug": "sports-football-team-sports"},
            {"name": "Bicycles & Cycling Gear", "slug": "sports-bicycles-cycling"},
            {"name": "Outdoor & Camping", "slug": "sports-outdoor-camping"},
        ]
    },
    {
        "name": "Agriculture & Farm Produce",
        "slug": "agriculture-farm-produce",
        "icon": "sprout",
        "subcategories": [
            {"name": "Farm Machinery & Tractors", "slug": "agriculture-farm-machinery"},
            {"name": "Livestock, Poultry & Feeds", "slug": "agriculture-livestock-poultry"},
            {"name": "Seeds, Fertilizers & Agrochemicals", "slug": "agriculture-seeds-fertilizers"},
            {"name": "Irrigation & Greenhouse Equipment", "slug": "agriculture-irrigation"},
            {"name": "Fresh Produce & Grains", "slug": "agriculture-fresh-produce"},
        ]
    },
    {
        "name": "Baby, Kids & Toys",
        "slug": "baby-kids-toys",
        "icon": "baby",
        "subcategories": [
            {"name": "Baby Gear & Strollers", "slug": "baby-gear-strollers"},
            {"name": "Kids Clothing & Shoes", "slug": "baby-kids-clothing"},
            {"name": "Toys & Educational Games", "slug": "baby-toys-games"},
        ]
    },
    {
        "name": "Real Estate",
        "slug": "real-estate",
        "icon": "home",
        "subcategories": [
            {"name": "Houses & Apartments for Rent", "slug": "real-estate-houses-apartments-for-rent"},
            {"name": "Houses & Apartments for Sale", "slug": "real-estate-houses-apartments-for-sale"},
            {"name": "Land & Plots", "slug": "real-estate-land-plots"},
            {"name": "Commercial Property & Offices", "slug": "real-estate-commercial-property"},
        ]
    },
    {
        "name": "Services & Maintenance",
        "slug": "services-maintenance",
        "icon": "briefcase",
        "subcategories": [
            {"name": "Construction & Trades", "slug": "services-construction-trades"},
            {"name": "Auto & Mechanics Repair", "slug": "services-auto-repair"},
            {"name": "Electronics & Phone Repair", "slug": "services-electronics-repair"},
            {"name": "Events, Media & Catering", "slug": "services-events-media"},
        ]
    },
    {
        "name": "Other Items",
        "slug": "other-items",
        "icon": "package",
        "subcategories": [
            {"name": "General Items", "slug": "other-items-general"},
        ]
    }
]

def seed_all_categories():
    print("=== SEEDING EXHAUSTIVE CATEGORY TAXONOMY ===")
    
    # Clean up test/junk categories
    Category.objects.filter(slug__in=['sim-category', 'temp-safe-cat']).delete()
    
    total_roots = 0
    total_subs = 0

    for cat_def in MASTER_TAXONOMY:
        root_name = cat_def["name"]
        root_slug = cat_def["slug"]
        
        root_cat, created = Category.objects.get_or_create(
            slug=root_slug,
            defaults={"name": root_name, "parent": None}
        )
        if not created and root_cat.name != root_name:
            root_cat.name = root_name
            root_cat.save()
            
        total_roots += 1
        print(f"\n[+] Domain: {root_name} ({root_slug})")

        for sub_def in cat_def["subcategories"]:
            sub_name = sub_def["name"]
            sub_slug = sub_def["slug"]
            
            sub_cat, sub_created = Category.objects.get_or_create(
                slug=sub_slug,
                defaults={"name": sub_name, "parent": root_cat}
            )
            if sub_cat.parent_id != root_cat.id or sub_cat.name != sub_name:
                sub_cat.parent = root_cat
                sub_cat.name = sub_name
                sub_cat.save()
                
            total_subs += 1
            print(f"    └─ Sub: {sub_name} ({sub_slug})")

    # Clear Django cache keys
    cache.delete('categories_list_v6')
    cache.clear()
    print("\n✓ Cleared categories cache!")
    print(f"✓ Completed: {total_roots} Root Category Domains and {total_subs} Subcategories active in database!")

if __name__ == '__main__':
    seed_all_categories()
