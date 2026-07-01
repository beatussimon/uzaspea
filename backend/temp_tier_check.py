import django
import sys
from marketplace.models import SellerApplication, UserProfile

for app in SellerApplication.objects.all():
    profile = UserProfile.objects.filter(user=app.user).first()
    print(f'App ID: {app.id}, Status: {app.status}, Requested Tier: {app.requested_tier.tier_level}')
    if profile:
        print(f'User: {app.user.username}, Profile Tier: {profile.tier}')
    else:
        print('No profile')
