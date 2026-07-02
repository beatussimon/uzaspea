import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Product, Category

for p in Product.objects.all():
    desc = p.description.replace('\n', ' ') if p.description else ''
    print(f"ID:{p.id} | Name:{p.name} | Cat:{p.category.name if p.category else 'None'} | Desc:{desc}")
