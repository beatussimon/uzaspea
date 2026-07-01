import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Product
for p in Product.objects.all():
    if p.stock <= 0:
        print(f"Product {p.id} ({p.name}) is OUT OF STOCK.")
