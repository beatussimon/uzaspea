import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Product, Category

mapping = {
    "Vehicle Parts & Accessories": [176, 175, 174, 173, 172, 171, 170, 169, 140, 164, 135, 163, 134, 162, 133, 161, 132, 160, 131, 159, 130, 158, 129, 157, 128, 156, 127, 155, 126, 154, 125, 153, 124, 152, 123, 151, 122],
    "Motorcycles": [168, 139, 148, 119, 145, 116],
    "Cars": [167, 138, 166, 137, 165, 136, 150, 121, 147, 118, 146, 117, 144, 115, 143, 114, 141, 112],
    "Trucks & Commercial Vehicles": [149, 120, 142, 113],
    "Other Items": [185, 184, 183, 182, 181, 180, 179, 178, 177]
}

count = 0
for cat_name, ids in mapping.items():
    cat = Category.objects.filter(name=cat_name).first()
    if cat:
        updated = Product.objects.filter(id__in=ids).update(category=cat)
        count += updated
        print(f"Updated {updated} products to {cat_name}")
    else:
        print(f"Could not find category: {cat_name}")

print(f"Total updated: {count}")
