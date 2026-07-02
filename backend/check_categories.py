import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Product, Category

cats = Category.objects.all()
for c in cats:
    count = Product.objects.filter(category=c).count()
    if count > 0:
        print(f"{c.name} ({c.id}): {count}")
