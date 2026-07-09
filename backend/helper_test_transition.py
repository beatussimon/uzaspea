import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uzachuo.settings")
django.setup()

from marketplace.models import Order
from marketplace.services import OrderStateMachine

o = Order.objects.get(id=48)
print("Current Status:", o.status)
print("Valid Transitions:", OrderStateMachine.VALID_TRANSITIONS.get(o.status))

try:
    OrderStateMachine.transition_order(o, "PENDING_DELIVERY_VERIFICATION")
    print("Transition successful. New status:", o.status)
except Exception as e:
    print("Transition failed:", str(e))
