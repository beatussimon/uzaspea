import os, sys, django
sys.path.append('/home/bea/uzaspea/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
try:
    django.setup()
    from marketplace.models import Order
    from marketplace.services import OrderStateMachine
    order = Order.objects.last()
    if order:
        print('Testing order:', order.id, order.status)
        OrderStateMachine.transition_order(order, 'AWAITING_PAYMENT')
        print('Success')
    else:
        print('No orders found')
except Exception as e:
    import traceback
    traceback.print_exc()
