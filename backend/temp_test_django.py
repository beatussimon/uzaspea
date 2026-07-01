import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from django.contrib.auth import get_user_model
from marketplace.models import Subscription
from django.utils import timezone
User = get_user_model()
user = User.objects.get(username='bsans')
sub = Subscription.objects.filter(user=user).order_by('-start_date').first()
print(f'Start Date: {sub.start_date}')
print(f'End Date: {sub.end_date}')
print(f'Active according to Django: {timezone.now() <= sub.end_date}')
