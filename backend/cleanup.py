import os
import django
from django.db.models import Count

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Review

duplicates = Review.objects.values('user_id', 'product_id').annotate(count=Count('id')).filter(count__gt=1)
for d in duplicates:
    reviews = Review.objects.filter(user_id=d['user_id'], product_id=d['product_id'])
    for r in reviews[1:]:
        print(f"Deleting duplicate review {r.id}")
        r.delete()

print("Deduplication complete.")
