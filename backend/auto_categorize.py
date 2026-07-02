import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Product, Category

def get_other_category():
    cat = Category.objects.filter(name__icontains="Other").first()
    if cat: return cat
    
    # If not found, create it under "Everything Else" or as main
    parent = Category.objects.filter(name="Everything Else").first()
    cat, _ = Category.objects.get_or_create(name="Other Items", slug="other-items", parent=parent)
    return cat

keywords = {
    "Cars": ["car", "toyota", "nissan", "honda", "bmw", "mercedes", "ford", "subaru", "jeep"],
    "Vehicle Parts & Accessories": ["tire", "rim", "battery", "bumper", "engine", "spare part", "helmet", "valve", "headlight", "exhaust", "sensor", "seat cover", "windshield", "spark plug"],
    "Mobile Phones": ["iphone", "samsung", "pixel", "nokia", "tecno", "infinix", "smartphone", "phone"],
    "Computers & Laptops": ["laptop", "macbook", "dell", "hp", "lenovo", "thinkpad", "desktop", "imac", "computer"],
    "Clothing": ["shirt", "t-shirt", "trousers", "jeans", "jacket", "suit", "sweater", "hoodie", "dress", "skirt", "blouse"], 
    "Shoes": ["shoe", "sneaker", "boot", "sandal", "jordan", "nike", "adidas", "puma", "timberland", "crocs", "heels", "vans", "converse"],
}

def guess_category(text):
    text = text.lower()
    best_match = None
    best_score = 0
    for cat_name, words in keywords.items():
        score = 0
        for word in words:
            if word in text:
                score += 1
        if score > best_score:
            best_score = score
            best_match = cat_name
    
    if best_match:
        cat = Category.objects.filter(name=best_match).first()
        if cat: return cat
    return None

products = Product.objects.all()
other_cat = get_other_category()

count = 0
other_count = 0

for p in products:
    text = (p.name + " " + p.description).lower()
    cat = guess_category(text)
    
    if cat:
        p.category = cat
        count += 1
    elif other_cat:
        p.category = other_cat
        other_count += 1
        
    p.save()

# After migrating, delete the TEMP_SAFE_CAT
temp_cat = Category.objects.filter(name="__TEMP_SAFE_CAT__").first()
if temp_cat:
    temp_cat.delete()

print(f"Successfully auto-categorized {count} products. Placed {other_count} in 'Other Items'. Deleted temp category.")
