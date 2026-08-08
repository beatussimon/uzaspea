import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uzachuo.settings")
django.setup()

from marketplace.models import Category
cats = Category.objects.filter(parent__isnull=True)
for c in cats:
    print(f"Parent: {c.name} ({c.products.count()})")
    for child in c.children.all():
        print(f"  Child: {child.name} ({child.products.count()})")
