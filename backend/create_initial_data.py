import os
import django
from django.utils.text import slugify

# Set up Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "my_marketplace.settings")  # Replace with your project name!
django.setup()

from django.contrib.auth.models import User
from marketplace.models import Category, Product, ProductImage  # Import ProductImage


def create_products():
    # Create some users if they don't exist
    user1, created = User.objects.get_or_create(username='seller1', email='seller1@example.com')
    if created:
        user1.set_password('password123')
        user1.save()

    user2, created = User.objects.get_or_create(username='seller2', email='seller2@example.com')
    if created:
        user2.set_password('password456')
        user2.save()

    # --- Create Categories and Subcategories ---
    # Use get_or_create *correctly* with defaults for ALL fields.
    electronics, _ = Category.objects.get_or_create(
        name='Electronics',
        defaults={'description': 'Electronic gadgets and devices', 'parent': None, 'slug': slugify('Electronics')}
    )
    laptops, _ = Category.objects.get_or_create(
        name='Laptops',
        parent=electronics,
        defaults={'description': 'Laptop computers', 'slug': slugify('Laptops')}
    )
    phones, _ = Category.objects.get_or_create(
        name='Phones',
        parent=electronics,
        defaults={'description': 'Mobile phones', 'slug': slugify('Phones')}
    )
    clothing, _ = Category.objects.get_or_create(
        name='Clothing',
        defaults={'description': 'Clothing and apparel', 'parent': None, 'slug': slugify('Clothing')}
    )
    mens, _ = Category.objects.get_or_create(
        name="Men's",
        parent=clothing,
        defaults={'description': "Men's Clothing", 'slug': slugify("Men's")}
    )
    womens, _ = Category.objects.get_or_create(
        name="Women's",
        parent=clothing,
        defaults={'description': "Women's Clothing", 'slug': slugify("Women's")}
    )
    books, _ = Category.objects.get_or_create(
        name='Books',
        defaults={'description': 'Books and reading materials', 'parent': None, 'slug': slugify('Books')}
    )
    fiction, _ = Category.objects.get_or_create(
        name='Fiction',
        parent=books,
        defaults={'description': 'Fiction books', 'slug': slugify('Fiction')}
    )
    nonfiction, _ = Category.objects.get_or_create(
        name='Non-Fiction',
        parent=books,
        defaults={'description': 'Non-Fiction books', 'slug': slugify('Non-Fiction')}
    )
    home, _ = Category.objects.get_or_create(
        name='Home & Kitchen',
        defaults={'description': 'Home goods and kitchen appliances', 'parent': None, 'slug': slugify('Home & Kitchen')}
    )
    furniture, _ = Category.objects.get_or_create(
        name='Furniture',
        parent=home,
        defaults={'description': 'Home and office furniture', 'slug': slugify('Furniture')}
    )
    appliances, _ = Category.objects.get_or_create(
        name='Appliances',
        parent=home,
        defaults={'description': 'Home appliances', 'slug': slugify('Appliances')}
    )
    vehicles, _ = Category.objects.get_or_create(name='Vehicles', defaults={'description': 'Cars, motorcycles, trucks, etc.', 'parent': None, 'slug':slugify('Vehicles')})
    cars, _ = Category.objects.get_or_create(name='Cars', parent=vehicles, defaults={'description': 'Passenger cars', 'slug': slugify('Cars')})
    trucks, _ = Category.objects.get_or_create(name='Trucks', parent=vehicles, defaults={'description': 'Trucks and heavy-duty vehicles', 'slug':slugify('Trucks')})
    motorcycles, _ = Category.objects.get_or_create(name='Motorcycles', parent=vehicles, defaults={'description': 'Motorcycles and scooters','slug': slugify('Motorcycles')})
    suvs, _ = Category.objects.get_or_create(name='SUVs', parent=vehicles, defaults={'description':"Sports Utility Vehicles", 'slug':slugify('SUVs')})

    parts, _ = Category.objects.get_or_create(name='Vehicle Spares', defaults={'description': 'Spare parts for vehicles', 'parent': None, 'slug':slugify('Vehicle Spares')})
    engine_parts, _ = Category.objects.get_or_create(name='Engine Parts', parent=parts, defaults={'description': 'Engine components', 'slug':slugify('Engine Parts')})
    body_parts, _ = Category.objects.get_or_create(name='Body Parts', parent=parts, defaults={'description': 'Body panels, doors, etc.', 'slug': slugify('Body Parts')})
    tires, _ = Category.objects.get_or_create(name='Tires & Wheels', parent=parts, defaults={'description': 'Tires and wheel sets', 'slug':slugify('Tires and Wheels')})
    electrical, _ = Category.objects.get_or_create(name="Electrical", parent=parts, defaults={'description': "Car's Electrical parts", 'slug':slugify('Electrical')})
    accessories, _ = Category.objects.get_or_create(name="Accessories", parent=parts, defaults={'description': "Vehicle Accessories", 'slug':slugify('Accessories')})
    oils, _ = Category.objects.get_or_create(name="Oil & Lubricants", parent= parts, defaults={'description':"Oils and Lubricants", 'slug':slugify('Oil and Lubricants')})

    products_data = [
          {'name': "Dell Inspiron 15", 'description': "Mid-range laptop for everyday use.", 'price': 699.00, 'stock': 60, 'category': laptops, 'seller': user1, 'condition': 'New'},
        {'name': "MacBook Air M2", 'description': "Thin and light laptop with great battery life.", 'price': 1199.00, 'stock': 40, 'category': laptops, 'seller': user2, 'condition': 'New'},
        {'name': "iPhone 14", 'description': "Popular smartphone with a great camera.", 'price': 799.00, 'stock': 120, 'category': phones, 'seller': user1, 'condition': 'New'},
        {'name': "Samsung Galaxy S23", 'description': "Excellent Android phone with a versatile camera system.", 'price': 799.99, 'stock': 90, 'category': phones, 'seller': user2, 'condition': 'New'},
        {'name': "Sony WH-CH710N Headphones", 'description': "Affordable noise-canceling headphones.", 'price': 149.00, 'stock': 200, 'category': electronics, 'seller': user1, 'condition': 'New'},
      {'name': "Men's Oxford Shirt", 'description': 'Classic button-down shirt for a formal look.', 'price': 39.99, 'stock': 150, 'category': mens, 'seller': user2, 'condition': 'New'},
        {'name': "Women's Maxi Dress", 'description': 'Flowing maxi dress for various occasions.', 'price': 49.99, 'stock': 160, 'category': womens, 'seller': user1, 'condition': 'New'},
        {'name': "Men's Leather Belt", 'description': 'Genuine leather belt for a classic look.', 'price': 29.99, 'stock': 180, 'category': mens, 'seller': user2, 'condition': 'New'},
        {'name': "Women's Ankle Boots", 'description': 'Stylish ankle boots for everyday wear.', 'price': 69.99, 'stock': 100, 'category': womens, 'seller': user1, 'condition': 'New'},
        {'name': "Men's Chino Pants", 'description': 'Versatile chino pants for smart-casual wear.', 'price': 44.99, 'stock': 140, 'category': mens, 'seller': user2, 'condition': 'New'},

        {'name': 'The Silent Patient', 'description': 'Psychological thriller novel.', 'price': 16.99, 'stock': 80, 'category': fiction, 'seller': user1, 'condition': 'New'},
        {'name': 'Educated', 'description': 'Memoir by Tara Westover.', 'price': 19.99, 'stock': 90, 'category': nonfiction, 'seller': user2, 'condition': 'New'},
        {'name': 'Where the Crawdads Sing', 'description': 'Coming-of-age novel by Delia Owens.', 'price': 12.50, 'stock': 110, 'category': fiction, 'seller': user1, 'condition': 'Used'},
        {'name': 'The Subtle Art of Not Giving a F*ck', 'description': 'Self-help book by Mark Manson.', 'price': 14.00, 'stock': 70, 'category': nonfiction, 'seller': user2, 'condition': 'New'},
        {'name': 'Dune', 'description': 'Science fiction novel by Frank Herbert.', 'price': 10.99, 'stock': 100, 'category': fiction, 'seller': user1, 'condition': 'New'},
      {'name': "Dining Table Set", 'description': "Dining table with 4 chairs, modern design.", 'price': 599.00, 'stock': 20, 'category': furniture, 'seller': user2, 'condition': 'New'},
        {'name': "Office Chair", 'description': "Ergonomic office chair with adjustable height.", 'price': 149.99, 'stock': 50, 'category': furniture, 'seller': user1, 'condition': 'New'},
        {'name': "Refrigerator with Ice Maker", 'description': "Large capacity refrigerator with built-in ice maker.", 'price': 1299.00, 'stock': 10, 'category': appliances, 'seller': user2, 'condition': 'New'},
        {'name': "Microwave Oven", 'description': "Countertop microwave oven, 1000W.", 'price': 79.99, 'stock': 40, 'category': appliances, 'seller': user1, 'condition': 'New'},
        {'name': "Washing Machine (Front Load)", 'description': "High-efficiency front-load washing machine.", 'price': 699.99, 'stock': 30, 'category': appliances, 'seller': user2, 'condition': 'New'},
      {'name': "2016 Toyota RAV4", 'description': "Used SUV, good condition, all-wheel drive.", 'price': 18500, 'stock': 1, 'category': suvs, 'seller': user1, 'condition': 'Used'},
        {'name': "2019 Honda CBR600RR", 'description': "Used sportbike, excellent condition, low mileage.", 'price': 9500, 'stock': 1, 'category': motorcycles, 'seller': user2, 'condition': 'Used'},
        {'name': "2022 Ford Escape", 'description': "New compact SUV, fuel-efficient.", 'price': 25000, 'stock': 4, 'category': suvs, 'seller': user1, 'condition': 'New'},
        {'name': "2018 BMW 5 Series", 'description': "Used luxury sedan, well-maintained.", 'price': 28000, 'stock': 1, 'category': cars, 'seller': user2, 'condition': 'Used'},
        {'name': "2024 Suzuki Hayabusa", 'description': "New hyperbike, ultimate performance.", 'price': 18500, 'stock': 2, 'category': motorcycles, 'seller': user1, 'condition': 'New'},
        {'name': 'Toyota Camry Brake Rotors (Front Pair)', 'description': 'OEM brake rotors, fits 2012-2017 Camry.', 'price': 120, 'stock': 15, 'category': engine_parts, 'seller': user2, 'condition': 'New'},
        {'name': 'Ford F-150 Door Handle (Driver Side)', 'description': 'Replacement door handle, fits 2015-2020 F-150.', 'price': 45, 'stock': 25, 'category': body_parts, 'seller': user1, 'condition': 'New'},
        {'name': "Bridgestone Dueler H/L Alenza Tire", 'description': "265/65R18 All-Season Tire", 'price': 210, 'stock': 30, 'category': tires, 'seller': user2, 'condition': 'New'},
        {'name': 'BMW X5 Alternator', 'description': 'Remanufactured alternator for 2014-2018 X5.', 'price': 250, 'stock': 7, 'category': electrical, 'seller': user1, 'condition': 'Used'},
        {'name': "Car Phone Mount", 'description':"Adjustable phone mount for car dashboard or windshield.", 'price': 20, 'stock': 60, 'category': accessories, 'seller': user2, 'condition':'New'},
        {'name':"Valvoline MaxLife Motor Oil", 'description':"5W-30 High Mileage Synthetic Blend", 'price': 55, 'stock': 45, 'category': oils, 'seller': user1, 'condition':'New'},
        {'name': "Used Ford Mustang Engine", 'description': "5.0L V8 engine, 60,000 miles, good condition.", 'price': 2500, 'stock': 1, 'category': engine_parts, 'seller': user2, 'condition': 'Used'},
         {'name': 'Honda Civic Tail Light Assembly (Right)', 'description': 'OEM tail light, fits 2016-2021 Civic.', 'price': 130, 'stock': 9, 'category': body_parts, 'seller': user1, 'condition': 'New'},
        {'name': "Goodyear Eagle Sport All-Season Tire", 'description': "225/45R17 Performance Tire", 'price': 150, 'stock': 30, 'category': tires, 'seller': user2, 'condition': 'New'},
        {'name': 'Toyota Camry Starter Motor', 'description': 'Rebuilt starter for 2012-2017 Camry.', 'price': 110, 'stock': 8, 'category': electrical, 'seller': user1, 'condition': 'Used'},
    ]
    for product_data in products_data:
      # Create the product.  Important: use get_or_create to avoid duplicates!
        name = product_data['name']
        slug = slugify(name)
        counter = 1
        while Product.objects.filter(slug=slug).exists():
            slug = f"{slugify(name)}-{counter}"  # Append counter to slug
            counter += 1

        product, created = Product.objects.get_or_create(
            name=name,
            slug = slug, # Use the unique slug
            seller=product_data['seller'],
            category=product_data['category'],
            defaults={
                'description': product_data['description'],
                'price': product_data['price'],
                'stock': product_data['stock'],
                'is_available': True,  # Make them available by default
                'condition': product_data['condition'],
            }
        )
        if created:
            print(f"Created product: {product.name}")
        else:
            print(f"Product already exists (or slug collision handled): {product.name}")



if __name__ == "__main__":
    create_products()
    print("Products creation/update completed.")