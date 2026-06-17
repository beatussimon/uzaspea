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
        'PAID': ['PROCESSING', 'CANCELLED'],
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
                if new_state == 'CANCELLED' and locked_order.status not in ['COMPLETED', 'DELIVERED', 'SHIPPED', 'CANCELLED']:
                    pass
                else:
                    raise ValueError(f"Invalid transition from {locked_order.status} to {new_state}")

            locked_order.status = new_state
            locked_order.save(update_fields=['status'])
            order.status = new_state  # Reflect on the instance passed

            # FIX: M-02 — restore stock on cancellation or expiration (only if stock was already decremented)
            if new_state in ('CANCELLED', 'EXPIRED') and old_state not in ('CART', 'CHECKOUT', 'CANCELLED', 'EXPIRED'):
                from django.db.models import F as _F
                from .models import Product as _Product
                items = locked_order.orderitem_set.all()
                for item in items:
                    _Product.objects.filter(pk=item.product_id).update(
                        stock=_F('stock') + item.quantity,
                        is_available=True
                    )

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
                    rate = Decimal('0.03') # 3% platform commission
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
