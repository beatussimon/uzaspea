from django.utils import timezone
from django.db import transaction
from .models import Order, OrderItem, TrackingEvent


class OrderStateMachine:
    VALID_TRANSITIONS = {
        'CART': ['CHECKOUT', 'AWAITING_PAYMENT', 'PAID_PRODUCT', 'CANCELLED'],
        'Pending': ['AWAITING_PAYMENT', 'CANCELLED'],  # FIX CRIT-04: bridge for legacy orders
        'CHECKOUT': ['PAID_PRODUCT', 'AWAITING_PAYMENT', 'CANCELLED'],
        'PAID_PRODUCT': ['SHIPPED_TO_WAREHOUSE', 'CANCELLED'],
        'AWAITING_PAYMENT': ['PENDING_VERIFICATION', 'EXPIRED', 'CANCELLED'],  # FIX L-15: removed self-loop
        'PENDING_VERIFICATION': ['PAID', 'AWAITING_PAYMENT', 'CANCELLED'],
        'PAID': ['SELLER_CONFIRMED', 'PROCESSING', 'CANCELLED'],
        'SELLER_CONFIRMED': ['PREPARING', 'CANCELLED'],
        'PREPARING': ['PACKAGING', 'CANCELLED'],
        'PACKAGING': ['SHIPPED_TO_WAREHOUSE', 'CANCELLED'],
        'SHIPPED_TO_WAREHOUSE': ['RECEIVED_AT_WAREHOUSE'],
        'RECEIVED_AT_WAREHOUSE': ['AWAITING_DELIVERY_PAYMENT', 'ASSIGNED_TRANSPORT', 'ARRIVED_AT_REGIONAL_WAREHOUSE'],
        'AWAITING_DELIVERY_PAYMENT': ['PENDING_DELIVERY_VERIFICATION', 'CANCELLED'],
        'PENDING_DELIVERY_VERIFICATION': ['ASSIGNED_TRANSPORT', 'AWAITING_DELIVERY_PAYMENT', 'CANCELLED'],
        'ASSIGNED_TRANSPORT': ['IN_TRANSIT', 'OUT_FOR_DELIVERY'],
        'IN_TRANSIT': ['ARRIVED_AT_REGIONAL_WAREHOUSE', 'READY_FOR_VEHICLE_HANDOVER', 'DELIVERED'],
        'OUT_FOR_DELIVERY': ['DELIVERED', 'FAILED_DELIVERY'],
        'ARRIVED_AT_REGIONAL_WAREHOUSE': ['ASSIGNED_TRANSPORT', 'READY_FOR_PICKUP', 'READY_FOR_VEHICLE_HANDOVER', 'DELIVERED'],
        'READY_FOR_VEHICLE_HANDOVER': ['DELIVERED', 'COMPLETED'],
        'READY_FOR_PICKUP': ['DELIVERED', 'COMPLETED'],
        'PROCESSING': ['SHIPPED', 'CANCELLED'],
        'SHIPPED': ['DELIVERED', 'IN_TRANSIT'],
        'DELIVERED': ['COMPLETED', 'DISPUTED'],  # FIX B-15: buyer can dispute after delivery
        'DISPUTED': ['PROCESSING', 'CANCELLED'],  # FIX B-15: staff resolves
        'FAILED_DELIVERY': ['READY_FOR_PICKUP', 'ARRIVED_AT_REGIONAL_WAREHOUSE', 'CANCELLED'],
        'COMPLETED': [],
        'CANCELLED': [],
        'EXPIRED': [],
    }

    @classmethod
    def transition_order(cls, order, new_state, notes="", visible_to_customer=True):
        with transaction.atomic():
            locked_order = Order.objects.select_for_update().get(id=order.id)
            old_state = locked_order.status
            
            if new_state not in cls.VALID_TRANSITIONS.get(locked_order.status, []):
                # FIX: L-08 — cannot cancel once shipped, delivered, completed, or already cancelled
                cant_cancel_states = [
                    'COMPLETED', 'DELIVERED', 'SHIPPED', 'CANCELLED',
                    'SHIPPED_TO_WAREHOUSE', 'RECEIVED_AT_WAREHOUSE',
                    'ASSIGNED_TRANSPORT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
                    'ARRIVED_AT_REGIONAL_WAREHOUSE', 'READY_FOR_PICKUP',
                    'READY_FOR_VEHICLE_HANDOVER', 'FAILED_DELIVERY'
                ]
                if new_state == 'CANCELLED' and locked_order.status not in cant_cancel_states:
                    pass
                else:
                    raise ValueError(f"Invalid transition from {locked_order.status} to {new_state}")

            locked_order.status = new_state
            locked_order.save(update_fields=['status'])
            order.status = new_state  # Reflect on the instance passed

            # FIX: M-02 — restore stock on cancellation or expiration (only if stock was already decremented)
            if new_state in ('CANCELLED', 'EXPIRED') and old_state not in ('CANCELLED', 'EXPIRED'):
                from django.db.models import F as _F
                from .models import Product as _Product, ProductVariant as _ProductVariant
                items = locked_order.orderitem_set.select_for_update().all()
                for item in items:
                    if item.variant_id:
                        _ProductVariant.objects.filter(pk=item.variant_id).update(
                            stock=_F('stock') + item.quantity,
                            is_available=True
                        )
                        _Product.objects.filter(pk=item.product_id).update(is_available=True)
                    else:
                        _Product.objects.filter(pk=item.product_id).update(
                            stock=_F('stock') + item.quantity,
                            is_available=True
                        )
                
                # FIX MED-7: Zero out platform fee on cancellation to prevent accounting leaks
                locked_order.platform_fee = 0
                locked_order.save(update_fields=['platform_fee'])
                order.platform_fee = 0

            if new_state == 'READY_FOR_PICKUP':
                from logistics.models import PickupCode
                from marketplace.models import push_notification
                PickupCode.objects.get_or_create(order=locked_order)
                try:
                    push_notification(
                        locked_order.user, 'order_status', 'Ready for Pickup',
                        f'Your order #{locked_order.id} is ready for pickup. Check your orders page for the collection code.',
                        f'/orders'
                    )
                except Exception:
                    pass

            if new_state == 'AWAITING_DELIVERY_PAYMENT':
                from marketplace.models import push_notification
                try:
                    push_notification(
                        locked_order.user, 'order_status', 'Delivery fee awaiting payment',
                        f'Your order #{locked_order.id} has arrived at our warehouse. A delivery fee of TSh {locked_order.shipping_fee:,.0f} is now due — please pay to continue.',
                        f'/orders?highlight={locked_order.id}'
                    )
                except Exception:
                    pass

            if new_state == 'RECEIVED_AT_WAREHOUSE':
                from marketplace.models import push_notification
                from warehouses.models import WarehouseIntake
                try:
                    seller_ids_notified = set()
                    for item in locked_order.orderitem_set.select_related('product__seller'):
                        if item.product.seller_id not in seller_ids_notified:
                            seller_ids_notified.add(item.product.seller_id)
                            intake = WarehouseIntake.objects.filter(order=locked_order).order_by('-created_at').first()
                            if intake and intake.package_condition != 'good':
                                push_notification(
                                    item.product.seller, 'order_status', 'Warehouse flagged a condition issue',
                                    f'Order #{locked_order.id} arrived at our warehouse marked "{intake.package_condition}". Our team will follow up.',
                                    f'/dashboard/orders?highlight={locked_order.id}'
                                )
                            else:
                                push_notification(
                                    item.product.seller, 'order_status', 'Shipment received at warehouse',
                                    f'Order #{locked_order.id} was received in good condition at our warehouse.',
                                    f'/dashboard/orders?highlight={locked_order.id}'
                                )
                except Exception:
                    pass

            if new_state == 'FAILED_DELIVERY':
                from marketplace.models import push_notification
                try:
                    push_notification(
                        locked_order.user, 'order_status', 'Delivery attempt failed',
                        f'We attempted to deliver order #{locked_order.id} but were unable to complete it. {notes or "Our team will follow up shortly."}',
                        f'/orders?highlight={locked_order.id}'
                    )
                except Exception:
                    pass

            # Phase 2: Platform Economics - Log commission on COMPLETED
            if new_state == 'COMPLETED' and old_state != 'COMPLETED':
                from billing.models import CommissionLedgerEntry
                from decimal import Decimal
                
                # Orders might contain items from multiple sellers. Group totals by seller.
                seller_totals = {}
                for item in locked_order.orderitem_set.select_related('product__seller').all():
                    seller = item.product.seller
                    item_total = item.quantity * item.price
                    if seller not in seller_totals:
                        seller_totals[seller] = Decimal('0.00')
                    seller_totals[seller] += Decimal(str(item_total))
                
                # Create a ledger entry for each seller
                for seller, amount in seller_totals.items():
                    from marketplace.models import SiteSettings
                    settings_obj = SiteSettings.get()
                    rate = settings_obj.commission_rate / Decimal('100')
                    commission_amount = amount * rate
                    CommissionLedgerEntry.objects.create(
                        order=locked_order,
                        seller=seller,
                        order_amount=amount,
                        commission_rate=rate * 100,
                        commission_amount=commission_amount,
                        entry_type=CommissionLedgerEntry.EntryType.COMMISSION
                    )

            # MED-7: Reverse commission when an order is cancelled after commission was charged.
            # The real path is DELIVERED→DISPUTED→CANCELLED (COMPLETED→CANCELLED is blocked
            # by the state machine), so we check for existing COMMISSION entries rather than
            # relying on old_state == 'COMPLETED'.
            if new_state == 'CANCELLED':
                from billing.models import CommissionLedgerEntry
                existing_entries = CommissionLedgerEntry.objects.filter(
                    order=locked_order,
                    entry_type=CommissionLedgerEntry.EntryType.COMMISSION
                )
                if existing_entries.exists():
                    # Only create reversals that haven't been created yet (idempotency guard)
                    already_reversed = CommissionLedgerEntry.objects.filter(
                        order=locked_order,
                        entry_type=CommissionLedgerEntry.EntryType.REVERSAL
                    ).exists()
                    if not already_reversed:
                        for entry in existing_entries:
                            CommissionLedgerEntry.objects.create(
                                order=locked_order,
                                seller=entry.seller,
                                order_amount=-entry.order_amount,
                                commission_rate=entry.commission_rate,
                                commission_amount=-entry.commission_amount,
                                entry_type=CommissionLedgerEntry.EntryType.REVERSAL
                            )

            event = TrackingEvent.objects.create(
                order=locked_order,
                status=new_state,
                notes=notes or f'Status changed from {old_state} to {new_state}',
                visible_to_customer=visible_to_customer
            )

        cls._broadcast_update(order, new_state, old_state, event)

    @classmethod
    def _broadcast_update(cls, order, new_state, old_state, event):
        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            channel_layer = get_channel_layer()
            if not channel_layer:
                return

            payload = {
                "type": "tracking_update",
                "order_id": order.id,
                "status": new_state,
                "old_status": old_state,
                "notes": event.notes,
                "timestamp": event.created_at.isoformat(),
            }

            # 1. Broadcast to order-specific group (buyer watching their order)
            async_to_sync(channel_layer.group_send)(
                f"order_tracking_{order.id}",
                payload
            )

            # 2. Broadcast to buyer's global room (for Orders list updates)
            async_to_sync(channel_layer.group_send)(
                f"buyer_orders_{order.user_id}",
                payload
            )

            # 3. Broadcast to all sellers who have products in this order
            from .models import OrderItem
            seller_ids = (
                OrderItem.objects.filter(order=order)
                .values_list('product__seller_id', flat=True)
                .distinct()
            )
            for seller_id in seller_ids:
                async_to_sync(channel_layer.group_send)(
                    f"seller_orders_{seller_id}",
                    payload
                )

            # 4. Broadcast to relevant warehouse queues if the order is tracked at a warehouse
            if order.delivery_info and isinstance(order.delivery_info, dict):
                current_wh = order.delivery_info.get('current_warehouse_code')
                dest_wh = order.delivery_info.get('destination_warehouse_code')
                origin_wh = order.delivery_info.get('warehouse_code')
                
                wh_codes = set(filter(None, [current_wh, dest_wh, origin_wh]))
                for wh_code in wh_codes:
                    async_to_sync(channel_layer.group_send)(
                        f"warehouse_orders_{wh_code}",
                        payload
                    )

        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"WebSocket broadcast failed for order {order.id}: {e}")
