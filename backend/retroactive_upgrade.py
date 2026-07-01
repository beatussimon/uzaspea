import django
from django.conf import settings
import sys

from marketplace.models import SellerApplication, PaymentConfirmation
from django.contrib.auth import get_user_model

User = get_user_model()

# Upgrade from SellerApplication
approved_apps = SellerApplication.objects.filter(status='approved')
for app in approved_apps:
    if not app.user.is_seller:
        print(f'Upgrading {app.user.username} from app')
        app.user.is_seller = True
        app.user.save(update_fields=['is_seller'])

# Upgrade from PaymentConfirmation
approved_payments = PaymentConfirmation.objects.filter(status='approved')
for p in approved_payments:
    if not p.user.is_seller:
        print(f'Upgrading {p.user.username} from payment')
        p.user.is_seller = True
        p.user.save(update_fields=['is_seller'])

print('Done.')
