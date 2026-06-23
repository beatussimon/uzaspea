from django.utils import timezone
from django.db import transaction
from .models import Order, OrderItem, TrackingEvent


class OrderStateMachine:
    VALID_TRANSITIONS = {
        'CART': ['CHECKOUT', 'AWAITING_PAYMENT', 'CANCELLED'],
        'Pending': ['AWAITING_PAYMENT', 'CANCELLED'],  # FIX CRIT-04: bridge for legacy orders
        'CHECKOUT': ['AWAITING_PAYMENT', 'CANCELLED'],
        'AWAITING_PAYMENT': ['PENDING_VERIFICATION', 'EXPIRED', 'CANCELLED'],  # FIX L-15: removed self-loop
        'PENDING_VERIFICATION': ['PAID', 'AWAITING_PAYMENT', 'CANCELLED'],
        'PAID': ['SELLER_CONFIRMED', 'PROCESSING', 'CANCELLED'],
        'SELLER_CONFIRMED': ['PREPARING', 'CANCELLED'],
        'PREPARING': ['PACKAGING', 'CANCELLED'],
        'PACKAGING': ['SHIPPED_TO_WAREHOUSE', 'CANCELLED'],
        'SHIPPED_TO_WAREHOUSE': ['RECEIVED_AT_WAREHOUSE'],
        'RECEIVED_AT_WAREHOUSE': ['ASSIGNED_TRANSPORT', 'ARRIVED_AT_REGIONAL_WAREHOUSE'],
        'ASSIGNED_TRANSPORT': ['IN_TRANSIT'],
        'IN_TRANSIT': ['ARRIVED_AT_REGIONAL_WAREHOUSE', 'DELIVERED'],
        'ARRIVED_AT_REGIONAL_WAREHOUSE': ['READY_FOR_PICKUP', 'DELIVERED'],
        'READY_FOR_PICKUP': ['DELIVERED', 'COMPLETED'],
        'PROCESSING': ['SHIPPED', 'CANCELLED'],
        'SHIPPED': ['DELIVERED'],
        'DELIVERED': ['COMPLETED', 'DISPUTED'],  # FIX B-15: buyer can dispute after delivery
        'DISPUTED': ['PROCESSING', 'CANCELLED'],  # FIX B-15: staff resolves
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
                    'ASSIGNED_TRANSPORT', 'IN_TRANSIT',
                    'ARRIVED_AT_REGIONAL_WAREHOUSE', 'READY_FOR_PICKUP'
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
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"WebSocket broadcast failed for order {order.id}: {e}")
