import os
import django
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uzachuo.settings")
django.setup()

from django.contrib.auth import get_user_model
from marketplace.models import Order, Product, Category, OrderItem, Payment, SiteSettings
from marketplace.services import OrderStateMachine
from warehouses.models import Warehouse, WarehouseIntake, WarehouseTransfer
from logistics.models import Shipment, PickupCode
from warehouses.views import PickupVerifyView
from rest_framework.test import APIRequestFactory
User = get_user_model()

def run_simulation():
    print("=== Starting Full Loop Simulation ===")
    
    # Ensure SiteSettings exists
    SiteSettings.objects.get_or_create(pk=1, defaults={'commission_rate': Decimal('10.00')})

    seller, _ = User.objects.get_or_create(username='sim_seller', defaults={'email': 'seller@sim.com'})
    buyer, _ = User.objects.get_or_create(username='sim_buyer', defaults={'email': 'buyer@sim.com'})
    staff, _ = User.objects.get_or_create(username='sim_staff', defaults={'email': 'staff@sim.com', 'is_staff': True})
    staff.is_staff = True
    staff.is_superuser = True
    staff.save()
    driver, _ = User.objects.get_or_create(username='sim_driver', defaults={'email': 'driver@sim.com'})

    category, _ = Category.objects.get_or_create(name='Sim Category')
    product, _ = Product.objects.get_or_create(
        name='Sim Product',
        seller=seller,
        category=category,
        defaults={'price': Decimal('1000.00'), 'stock': 10}
    )

    wh_origin, _ = Warehouse.objects.get_or_create(code='WH-ORG', defaults={'name': 'Origin Warehouse', 'address': '123 Org'})
    wh_dest, _ = Warehouse.objects.get_or_create(code='WH-DST', defaults={'name': 'Dest Warehouse', 'address': '456 Dst'})

    # 1. Order Creation
    print("\n1. Order Creation")
    order = Order.objects.create(
        user=buyer,
        status='CHECKOUT',
        shipping_method='PICKUP',
        delivery_info={'warehouse_code': wh_dest.code}
    )
    OrderItem.objects.create(order=order, product=product, quantity=1, price=product.price)
    order.update_total()
    
    OrderStateMachine.transition_order(order, 'AWAITING_PAYMENT')
    OrderStateMachine.transition_order(order, 'PENDING_VERIFICATION')
    
    # Payment
    payment = Payment.objects.create(
        order=order,
        amount=order.total_amount,
        status='VERIFIED',
        payment_method='M-PESA'
    )
    OrderStateMachine.transition_order(order, 'PAID')
    
    # Seller flow
    OrderStateMachine.transition_order(order, 'SELLER_CONFIRMED')
    OrderStateMachine.transition_order(order, 'PREPARING')
    OrderStateMachine.transition_order(order, 'PACKAGING')
    OrderStateMachine.transition_order(order, 'SHIPPED_TO_WAREHOUSE')
    
    # 2. Warehouse Intake
    print("\n2. Warehouse Intake")
    OrderStateMachine.transition_order(order, 'RECEIVED_AT_WAREHOUSE')
    intake = WarehouseIntake.objects.create(
        warehouse=wh_origin,
        order=order,
        intake_by=staff,
        package_condition='good'
    )
    print(f"Intake created: {intake.id}")
    
    # 3. Pricing confirmation
    print("\n3. Pricing Confirmation")
    order.shipping_fee = Decimal('500.00')
    order.update_total()
    OrderStateMachine.transition_order(order, 'AWAITING_DELIVERY_PAYMENT')
    
    # 4. Delivery Payment (simulate paid)
    OrderStateMachine.transition_order(order, 'ASSIGNED_TRANSPORT')
    
    # 5. Warehouse Transfer & Dispatch
    print("\n5. Warehouse Transfer & Dispatch")
    transfer = WarehouseTransfer.objects.filter(order=order).first()
    if transfer:
        transfer.status = 'in_transit'
        transfer.transfer_by = staff
        transfer.save()
        
    shipment = Shipment.objects.filter(order=order).first()
    if shipment:
        shipment.driver = driver
        shipment.status = 'in_transit'
        shipment.save()
    
    OrderStateMachine.transition_order(order, 'IN_TRANSIT')

    # 6. Logistics Shipment arrived
    print("\n6. Logistics Shipment (In Transit -> Arrived)")
    if shipment:
        shipment.status = 'arrived_at_hub'
        shipment.save()
    if transfer:
        transfer.status = 'completed'
        transfer.save()
        
    OrderStateMachine.transition_order(order, 'ARRIVED_AT_REGIONAL_WAREHOUSE')

    # 7. Warehouse Verification / Pickup
    print("\n7. Warehouse Verification / Pickup")
    OrderStateMachine.transition_order(order, 'READY_FOR_PICKUP')
    
    pickup = PickupCode.objects.filter(order=order).first()
    if pickup:
        print(f"Testing PickupVerifyView with code: {pickup.code}")
        factory = APIRequestFactory()
        request = factory.post('/api/warehouses/pickup/verify/', {'code': pickup.code}, format='json')
        from rest_framework.request import Request
        from rest_framework.test import force_authenticate
        force_authenticate(request, user=staff)
        view = PickupVerifyView.as_view()
        response = view(request)
        print(f"PickupVerifyView response: {response.data}")

    # 8. Order Completion
    print("\n8. Order Completion")
    OrderStateMachine.transition_order(order, 'COMPLETED')
    order.is_completed = True
    order.save()
    
    if shipment:
        shipment.status = 'delivered'
        shipment.save()
        
    print(f"Order completed! Final Status: {order.status}")

if __name__ == '__main__':
    run_simulation()
