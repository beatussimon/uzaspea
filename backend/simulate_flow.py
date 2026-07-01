import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from django.contrib.auth import get_user_model
from marketplace.models import Order, OrderItem, Product, Category
from warehouses.models import Warehouse, WarehouseIntake, WarehouseTransfer
from logistics.models import Shipment, PickupCode
from marketplace.services import OrderStateMachine
from decimal import Decimal
from django.utils import timezone

User = get_user_model()

def run_simulation():
    print("\n--- SIMULATION STARTED ---")
    
    # 1. SETUP
    buyer, _ = User.objects.get_or_create(username='sim_buyer_end2end')
    seller, _ = User.objects.get_or_create(username='sim_seller_end2end')
    staff, _ = User.objects.get_or_create(username='sim_staff_end2end', defaults={'is_staff': True})
    
    wh_origin, _ = Warehouse.objects.get_or_create(code='WH-ORIG', defaults={'name': 'Origin Warehouse'})
    wh_dest, _ = Warehouse.objects.get_or_create(code='WH-DEST', defaults={'name': 'Destination Warehouse'})
    
    cat, _ = Category.objects.get_or_create(name='Test Cat E2E')
    prod, _ = Product.objects.get_or_create(name='Test Prod E2E', defaults={'price': 100, 'stock': 50, 'seller': seller, 'category': cat})
    
    # 2. PLACE ORDER
    print("1. Placing Order (Buyer checkout)")
    order = Order.objects.create(
        user=buyer,
        status='CHECKOUT',
        delivery_info={'warehouse_code': wh_dest.code}  # Buyer wants to pick up at destination hub!
    )
    OrderItem.objects.create(order=order, product=prod, price=100, quantity=1)
    
    OrderStateMachine.transition_order(order, 'PAID_PRODUCT', notes='Buyer paid for product')
    print(f" -> Order is now {order.status}. Delivery Info: {order.delivery_info}")
    
    # 3. WAREHOUSE INTAKE
    print("\n2. Seller drops off at Origin Warehouse")
    OrderStateMachine.transition_order(order, 'SHIPPED_TO_WAREHOUSE')
    
    intake = WarehouseIntake.objects.create(warehouse=wh_origin, order=order, intake_by=staff)
    OrderStateMachine.transition_order(order, 'RECEIVED_AT_WAREHOUSE')
    order.refresh_from_db()
    print(f" -> Order is now {order.status}. Created Intake.")
    
    transfer = WarehouseTransfer.objects.filter(order=order).last()
    if transfer:
        print(f" -> Auto-created WarehouseTransfer from {transfer.source_warehouse.code} to {transfer.destination_warehouse.code}")
    else:
        print(" -> ERROR: WarehouseTransfer not created!")
        sys.exit(1)
        
    # 4. PRICING AND DELIVERY PAYMENT
    print("\n3. Pricing & Payment")
    order.shipping_fee = Decimal('1500.00')
    order.save()
    OrderStateMachine.transition_order(order, 'AWAITING_DELIVERY_PAYMENT')
    print(f" -> Order is {order.status}. Waiting for buyer to pay 1500.")
    
    OrderStateMachine.transition_order(order, 'ASSIGNED_TRANSPORT')
    print(f" -> Buyer Paid! Order is {order.status}")
    
    # 5. DISPATCH AND IN-TRANSIT
    print("\n4. Dispatch to Logistics")
    transfer.status = 'in_transit'
    transfer.save()
    OrderStateMachine.transition_order(order, 'IN_TRANSIT')
    
    shipment = Shipment.objects.create(order=order, status='in_transit', carrier_type='driver')
    print(f" -> Logistics took over. Shipment is {shipment.status}. Order is {order.status}")
    
    # 6. ARRIVAL AT DESTINATION HUB
    print("\n5. Logistics marks Arrived at Hub")
    if shipment.status != 'arrived_at_hub':
        shipment.status = 'arrived_at_hub'
        shipment.save()
        
        t = WarehouseTransfer.objects.filter(order=order).order_by('-id').first()
        if t and t.status != 'completed':
            t.status = 'completed'
            t.received_at = timezone.now()
            t.save()
        
        OrderStateMachine.transition_order(order, 'ARRIVED_AT_REGIONAL_WAREHOUSE')
    
    order.refresh_from_db()
    transfer.refresh_from_db()
    print(f" -> Order is {order.status}. Transfer status: {transfer.status}.")
    
    # 7. DESTINATION INTAKE -> READY FOR PICKUP
    print("\n6. Destination Hub prepares for pickup")
    OrderStateMachine.transition_order(order, 'READY_FOR_PICKUP')
    print(f" -> Order is {order.status}. Pickup code generated.")
    
    pickup_code = PickupCode.objects.filter(order=order).last()
    if not pickup_code:
        print(" -> ERROR: PickupCode not generated!")
        sys.exit(1)
        
    # 8. BUYER VERIFICATION
    print(f"\n7. Buyer arrives with code: {pickup_code.code}")
    print(" -> Simulating /api/warehouses/pickup/verify/ endpoint")
    
    pickup_code.is_used = True
    pickup_code.used_at = timezone.now()
    pickup_code.verified_by = staff
    pickup_code.save()
    
    OrderStateMachine.transition_order(order, 'DELIVERED', notes="Buyer picked up item")
    OrderStateMachine.transition_order(order, 'COMPLETED', notes="Transaction completed, escrow released")
    
    print(f"\nSUCCESS! Final Order Status: {order.status}")
    print("--- SIMULATION COMPLETE ---")

if __name__ == '__main__':
    run_simulation()
