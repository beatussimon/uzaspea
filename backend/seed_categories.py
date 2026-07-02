import os
import django
from django.utils.text import slugify

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Category, Product

def seed():
    category_data = {
        "Vehicles": ["Cars", "Motorcycles", "Trucks & Commercial Vehicles", "Vehicle Parts & Accessories", "Boats & Watercraft"],
        "Electronics": ["Mobile Phones", "Computers & Laptops", "TVs & Audio", "Cameras & Lenses", "Video Games & Consoles"],
        "Real Estate": ["Houses & Apartments for Rent", "Houses & Apartments for Sale", "Land & Plots", "Commercial Property"],
        "Men's Fashion": ["Clothing", "Shoes", "Bags & Accessories", "Watches"],
        "Women's Fashion": ["Clothing", "Shoes", "Bags", "Jewelry & Watches"],
        "Home, Garden & Furniture": ["Furniture", "Home Decor", "Kitchen Appliances", "Gardening Tools", "Bedding & Bath"],
        "Health & Beauty": ["Makeup & Cosmetics", "Skin Care", "Hair Care", "Fragrances", "Vitamins & Supplements"],
        "Baby & Kids": ["Baby Clothing", "Kids Clothing", "Toys", "Strollers & Prams", "Nursery Furniture"],
        "Hobby, Sport & Art": ["Sports Equipment", "Bicycles", "Musical Instruments", "Books", "Arts & Crafts"],
        "Jobs": ["IT & Telecom Jobs", "Sales & Marketing Jobs", "Accounting & Finance Jobs", "Retail & Customer Service"],
        "Services": ["Building & Trades", "Cleaning Services", "Legal & Business Services", "Tutoring & Education"],
        "Agriculture & Food": ["Farm Machinery", "Livestock & Poultry", "Seeds & Plants", "Feeds & Supplements", "Farm Produce"],
        "Everything Else": ["Other Items"]
    }

    # 1. Create a temporary category to hold existing products safely
    temp_cat, _ = Category.objects.get_or_create(name="__TEMP_SAFE_CAT__", slug="temp-safe-cat")
    
    # Move all products to the temporary category
    products_count = Product.objects.update(category=temp_cat)
    print(f"Moved {products_count} products to temporary category.")

    # 2. Delete all other categories
    Category.objects.exclude(id=temp_cat.id).delete()
    print("Deleted old categories.")
    
    # 3. Create new categories
    first_main_cat = None
    for main_cat_name, sub_cats in category_data.items():
        print(f"Creating: {main_cat_name}")
        main_cat, _ = Category.objects.get_or_create(
            name=main_cat_name,
            slug=slugify(main_cat_name)
        )
        if not first_main_cat:
            first_main_cat = main_cat
            
        for sub_cat_name in sub_cats:
            Category.objects.get_or_create(
                name=sub_cat_name,
                slug=slugify(main_cat_name + "-" + sub_cat_name),
                parent=main_cat
            )
            
    # 4. Reassign products to the first new main category
    if first_main_cat:
        Product.objects.filter(category=temp_cat).update(category=first_main_cat)
        print(f"Reassigned {products_count} products to '{first_main_cat.name}'.")
        
    # 5. Delete temporary category
    temp_cat.delete()
    print("Seed complete! Created robust category tree.")

if __name__ == '__main__':
    seed()
