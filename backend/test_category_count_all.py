import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uzachuo.settings")
django.setup()

from marketplace.models import Category
cats = Category.objects.all()
for c in cats:
    print(f"{c.name}: {c.products.count()} (parent: {c.parent.name if c.parent else 'None'})")
