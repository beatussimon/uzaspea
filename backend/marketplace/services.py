from django.utils import timezone
from .models import Order, OrderItem, TrackingEvent


class OrderStateMachine:
    VALID_TRANSITIONS = {
        'CART': ['CHECKOUT', 'AWAITING_PAYMENT', 'CANCELLED'],
        'Pending': ['AWAITING_PAYMENT', 'CANCELLED'],  # FIX CRIT-04: bridge for legacy orders
        'CHECKOUT': ['AWAITING_PAYMENT', 'CANCELLED'],
        'AWAITING_PAYMENT': ['PENDING_VERIFICATION', 'EXPIRED', 'CANCELLED'],  # FIX L-15: removed self-loop
        'PENDING_VERIFICATION': ['PAID', 'AWAITING_PAYMENT', 'REJECTED', 'CANCELLED'],
        'PAID': ['PROCESSING', 'REFUNDED', 'CANCELLED'],
        'PROCESSING': ['SHIPPED', 'CANCELLED'],
        'SHIPPED': ['DELIVERED'],
        'DELIVERED': ['COMPLETED', 'DISPUTED'],  # FIX B-15: buyer can dispute after delivery
        'DISPUTED': ['PROCESSING', 'CANCELLED'],  # FIX B-15: staff resolves
        'COMPLETED': [],
        'CANCELLED': [],
        'EXPIRED': [],
        'REJECTED': [],
        'REFUNDED': [],
    }

    @classmethod
    def transition_order(cls, order, new_state, notes="", visible_to_customer=True):
        old_state = order.status
        if new_state not in cls.VALID_TRANSITIONS.get(order.status, []):
            # FIX: L-08 — cannot cancel once shipped, delivered, or completed
            if new_state == 'CANCELLED' and order.status not in ['COMPLETED', 'DELIVERED', 'SHIPPED']:
                pass
            else:
                raise ValueError(f"Invalid transition from {order.status} to {new_state}")

        order.status = new_state
        order.save(update_fields=['status'])

        # FIX: M-02 — restore stock on cancellation (only if stock was already decremented)
        if new_state == 'CANCELLED' and old_state not in ('CART', 'CHECKOUT'):
            from django.db.models import F as _F
            from .models import Product as _Product
            items = order.orderitem_set.all()
            for item in items:
                _Product.objects.filter(pk=item.product_id).update(
                    stock=_F('stock') + item.quantity,
                    is_available=True
                )

        event = TrackingEvent.objects.create(
            order=order,
            status=new_state,
            notes=notes or f'Status changed from {old_state} to {new_state}',
            visible_to_customer=visible_to_customer
        )

        cls._broadcast_update(order, new_state, old_state, event)

    @classmethod
    def _broadcast_update(cls, order, new_state, old_state, event):
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
