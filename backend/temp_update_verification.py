import django
import sys
from django.conf import settings
from marketplace.models import UserProfile

updated = UserProfile.objects.filter(tier__in=['seller_pro', 'business'], is_verified=False).update(is_verified=True)
print(f'Updated {updated} profiles to be verified.')
