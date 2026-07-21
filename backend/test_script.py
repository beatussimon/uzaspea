import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import UserProfile, Review
p = UserProfile.objects.filter(user__username='bsans').first()
print('seller_rating=', p.seller_rating if p else 'Not found')
