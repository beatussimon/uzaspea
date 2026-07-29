import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from marketplace.models import Review
r = Review.objects.get(pk=15)
print('Review 15 Order ID:', r.order_id if r.order else 'None')
