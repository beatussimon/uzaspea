import os
import django
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Product, Vehicle, ProductVehicleFitment, Category

# Find an auto category
auto_cats = Category.objects.filter(slug__icontains='vehicle') | Category.objects.filter(slug__icontains='part')
auto_cat = auto_cats.first()

if not auto_cat:
    print('No auto category found. Using first category.')
    auto_cat = Category.objects.first()

products = Product.objects.all()[:20] # Take 20 existing products
vehicles = list(Vehicle.objects.all()[:100]) # Take some vehicles

if not products:
    print('No products exist to update!')
else:
    print(f'Updating {products.count()} products to test fitments...')
    for p in products:
        p.category = auto_cat
        # assign OEM part number
        specs = p.specifications or {}
        specs['oem_part_number'] = f'OEM-{random.randint(10000, 99999)}'
        p.specifications = specs
        p.save()
        
        # assign 1-3 random vehicles
        ProductVehicleFitment.objects.filter(product=p).delete()
        selected = random.sample(vehicles, random.randint(1, 3))
        for v in selected:
            ProductVehicleFitment.objects.create(product=p, vehicle=v)
            
    print('Successfully mapped test products to vehicles.')
