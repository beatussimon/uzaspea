import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uzachuo.settings")
django.setup()

from marketplace.models import Category
cats = Category.objects.all()
for c in cats:
    count = c.products.filter(is_available=True).count()
    if count == 0:
        print(f"Empty: {c.name}")
