import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uzachuo.settings")
django.setup()

from marketplace.models import Category
cats = Category.objects.filter(parent__isnull=True)
for c in cats:
    parent_count = c.products.filter(is_available=True).count()
    child_count = sum(child.products.filter(is_available=True).count() for child in c.children.all())
    print(f"Parent {c.name}: {parent_count} direct, {child_count} in children")
