import django
import sys
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.filter(username='halima').first()

from marketplace.models import Subscription, PaymentConfirmation
sub = Subscription.objects.filter(user=user).first()
if sub:
    # Set to expired
    sub.end_date = timezone.now() - timedelta(days=5)
    sub.save()
    print('Subscription set to expired. End date:', sub.end_date)

    # Simulate payment confirmation approval
    payment = PaymentConfirmation.objects.create(
        user=user,
        tier=sub.tier,
        amount=sub.tier.price,
        reference='RENEW_001',
        status='PENDING'
    )
    print('Created payment:', payment)
    
    payment.status = 'APPROVED'
    payment.save()
    
    sub.refresh_from_db()
    print('After approval, subscription end date is:', sub.end_date)
