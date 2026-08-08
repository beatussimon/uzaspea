import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Category
from django.db.models import Count

parents = Category.objects.filter(parent__isnull=True).prefetch_related('children')
for c in parents:
    count = c.products.count() + sum([child.products.count() for child in c.children.all()])
    print(c.name, count)
