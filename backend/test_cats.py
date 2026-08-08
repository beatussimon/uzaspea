import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Category
from django.db.models import Count

for c in Category.objects.filter(parent__isnull=True).annotate(
    p_count=Count('products', distinct=True)
):
    print(c.name, c.p_count)
