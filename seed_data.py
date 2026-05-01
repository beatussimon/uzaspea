import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uzachuo.settings")
django.setup()

from django.contrib.auth.models import User
from marketplace.models import Category, Product

# Ensure admin user exists
admin_user = User.objects.filter(username='admin').first()
if not admin_user:
    admin_user = User.objects.create_superuser('admin', 'admin@uzaspea.com', 'admin123')

# Create Categories
electronics, _ = Category.objects.get_or_create(name='Electronics', slug='electronics')
vehicles, _ = Category.objects.get_or_create(name='Vehicles', slug='vehicles')
fashion, _ = Category.objects.get_or_create(name='Fashion', slug='fashion')

# Create Products
products_data = [
    {
        'name': 'Samsung Galaxy S23',
        'description': 'Latest Samsung flagship phone in excellent condition.',
        'price': 1500000.00,
        'stock': 10,
        'category': electronics,
        'condition': 'New'
    },
    {
        'name': 'Toyota IST 2014',
        'description': 'Used Toyota IST, low mileage, imported from Japan.',
        'price': 12000000.00,
        'stock': 1,
        'category': vehicles,
        'condition': 'Used'
    },
    {
        'name': 'Men\'s Leather Jacket',
        'description': 'Premium quality leather jacket for men.',
        'price': 45000.00,
        'stock': 50,
        'category': fashion,
        'condition': 'New'
    }
]

for p_data in products_data:
    Product.objects.get_or_create(
        name=p_data['name'],
        defaults={
            'description': p_data['description'],
            'price': p_data['price'],
            'stock': p_data['stock'],
            'category': p_data['category'],
            'condition': p_data['condition'],
            'seller': admin_user
        }
    )

print("Database successfully seeded with categories and products.")