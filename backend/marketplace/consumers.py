import json
import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone

from uzachuo.auth_cookies import consume_ws_ticket

logger = logging.getLogger(__name__)


@database_sync_to_async
def authenticate_ws_scope(scope):
    """
    Authenticates WebSocket connections via 30s single-use opaque `?ticket=<ticket>`
    (or active Django session) and enforces Country Geofencing when enabled.
    Returns `(user_or_none, geo_allowed_bool)`.
    """
    user = scope.get('user')
    if user and getattr(user, 'is_authenticated', False):
        user = User.objects.filter(id=user.id, is_active=True).first()
    else:
        user = None
        qs = parse_qs((scope.get('query_string') or b'').decode('utf-8', errors='ignore'))
        ticket = (qs.get('ticket') or [None])[0]
        if ticket:
            user_id = consume_ws_ticket(ticket)
            if user_id:
                user = User.objects.filter(id=user_id, is_active=True).first()

    try:
        from uzachuo.geofence import check_ws_geofence
        if not check_ws_geofence(scope, user):
            return user, False
    except ImportError:
        pass
    except Exception as exc:
        logger.warning(f"WS geofence check error: {exc}")

    return user, True


@database_sync_to_async
def get_effective_seller_id_for_orders(user):
    """Resolve business owner ID if user is an active team member with manage_orders."""
    try:
        from marketplace.models import TeamMember
        from uzachuo.permissions import _user_is_active_business_owner
        tm = TeamMember.objects.filter(
            user=user, invitation_status='accepted', is_active=True
        ).select_related('owner', 'owner__profile').first()
        if tm and _user_is_active_business_owner(tm.owner):
            perms = tm.permissions if isinstance(tm.permissions, dict) else {}
            if perms.get('manage_orders', False):
                return tm.owner_id
    except Exception:
        pass
    return user.id


class OrderTrackingConsumer(AsyncWebsocketConsumer):
    """
    WebSocket for real-time order tracking.
    Connect to: ws/tracking/<order_id>/?ticket=<opaque_ticket>
    """

    async def connect(self):
        user, geo_ok = await authenticate_ws_scope(self.scope)
        if not geo_ok:
            await self.close(code=4451)
            return
        if not user:
            await self.close(code=4001)
            return

        self.user = user
        self.order_id = self.scope['url_route']['kwargs']['order_id']

        if self.order_id == 'seller':
            target_seller_id = await get_effective_seller_id_for_orders(user)
            self.room_group_name = f'seller_orders_{target_seller_id}'
        elif self.order_id == 'buyer':
            self.room_group_name = f'buyer_orders_{user.id}'
        elif self.order_id.startswith('warehouse_'):
            wh_code = self.order_id.split('_', 1)[1]
            can_access = await self._user_can_access_warehouse_code(user, wh_code)
            if not can_access:
                await self.close(code=4003)
                return
            self.room_group_name = f'warehouse_orders_{wh_code}'
        else:
            order_belongs = await self._user_owns_order(user, self.order_id)
            if not order_belongs:
                await self.close(code=4003)
                return
            self.room_group_name = f'order_tracking_{self.order_id}'

        try:
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        except Exception as e:
            logger.warning(f"WebSocket group_add failed: {e}")
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def tracking_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'status_update',
            'order_id': event['order_id'],
            'status': event['status'],
            'notes': event.get('notes', ''),
            'timestamp': event.get('timestamp', ''),
            'old_status': event.get('old_status', ''),
        }))

    @database_sync_to_async
    def _user_can_access_warehouse_code(self, user, wh_code: str) -> bool:
        if not wh_code:
            return False
        from warehouses.models import Warehouse
        from warehouses.views import user_can_access_warehouse
        warehouse = Warehouse.objects.filter(code=wh_code, is_active=True).first()
        if not warehouse:
            return False
        return user_can_access_warehouse(user, warehouse)

    @database_sync_to_async
    def _user_owns_order(self, user, order_id) -> bool:
        from marketplace.models import Order, OrderItem
        from uzachuo.permissions import get_effective_sellers
        try:
            oid = int(order_id)
        except (TypeError, ValueError):
            return False
        if user.is_superuser or user.is_staff:
            return True
        if Order.objects.filter(id=oid, user=user).exists():
            return True
        sellers = get_effective_sellers(user, required_permission='manage_orders')
        if sellers and OrderItem.objects.filter(order_id=oid, product__seller_id__in=sellers).exists():
            return True
        return False


class ChatConsumer(AsyncWebsocketConsumer):
    """Real-time message delivery via WebSocket with strict ticket auth & ownership filters."""

    async def connect(self):
        user, geo_ok = await authenticate_ws_scope(self.scope)
        if not geo_ok:
            await self.close(code=4451)
            return
        if not user:
            await self.close(code=4001)
            return

        self.user = user
        self.group_name = f'chat_{user.id}'
        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
        except Exception as e:
            logger.warning(f"ChatConsumer group_add failed: {e}")
        await self.accept()

        now_iso = await self._set_presence(is_online=True)
        partner_ids = await self._get_all_partner_ids()
        for pid in partner_ids:
            try:
                await self.channel_layer.group_send(
                    f'chat_{pid}',
                    {
                        'type': 'presence_update',
                        'user_id': self.user.id,
                        'is_online': True,
                        'last_seen': now_iso,
                    }
                )
            except Exception:
                pass

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

        if hasattr(self, 'user') and self.user:
            now_iso = await self._set_presence(is_online=False)
            partner_ids = await self._get_all_partner_ids()
            for pid in partner_ids:
                try:
                    await self.channel_layer.group_send(
                        f'chat_{pid}',
                        {
                            'type': 'presence_update',
                            'user_id': self.user.id,
                            'is_online': False,
                            'last_seen': now_iso,
                        }
                    )
                except Exception:
                    pass

    @database_sync_to_async
    def _set_presence(self, is_online: bool) -> str:
        now_iso = timezone.now().isoformat()
        if is_online:
            cache.set(f'user:seen:{self.user.id}', now_iso, timeout=60)
        else:
            cache.delete(f'user:seen:{self.user.id}')
        cache.set(f'user:last_seen:{self.user.id}', now_iso, timeout=86400 * 30)
        return now_iso

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'conversation_id': event['conversation_id'],
            'message': event['message'],
        }))

    async def chat_typing(self, event):
        await self.send(text_data=json.dumps({
            'type': 'typing',
            'conversation_id': event['conversation_id'],
            'sender_id': event['sender_id'],
            'is_typing': event['is_typing'],
        }))

    async def chat_delivery_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_delivery_update',
            'message_ids': event['message_ids'],
        }))

    async def chat_read_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_read_update',
            'conversation_id': event['conversation_id'],
            'message_ids': event['message_ids'],
        }))

    async def presence_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'presence_update',
            'user_id': event['user_id'],
            'is_online': event['is_online'],
            'last_seen': event['last_seen'],
        }))

    async def receive(self, text_data):
        if not text_data or len(text_data) > 16384:
            return
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            try:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Invalid JSON format'
                }))
            except Exception:
                pass
            return

        if not isinstance(data, dict):
            return

        msg_type = data.get('type')
        conv_id = data.get('conversation_id')

        if msg_type == 'typing':
            is_typing = bool(data.get('is_typing', False))
            recipient_id = await self._get_recipient_id(conv_id)
            if recipient_id:
                await self.channel_layer.group_send(
                    f'chat_{recipient_id}',
                    {
                        'type': 'chat_typing',
                        'conversation_id': conv_id,
                        'sender_id': self.user.id,
                        'is_typing': is_typing,
                    }
                )
            return

        if msg_type == 'presence_ping':
            now_iso = await self._set_presence(is_online=True)
            if conv_id:
                recipient_id = await self._get_recipient_id(conv_id)
                if recipient_id:
                    await self.channel_layer.group_send(
                        f'chat_{recipient_id}',
                        {
                            'type': 'presence_update',
                            'user_id': self.user.id,
                            'is_online': True,
                            'last_seen': now_iso,
                        }
                    )
            return

        if msg_type == 'delivery_receipt':
            raw_ids = data.get('message_ids', [])
            if not isinstance(raw_ids, list) or not raw_ids:
                return
            sender_id, updated_ids = await self._mark_messages_delivered(raw_ids)
            if sender_id and updated_ids:
                await self.channel_layer.group_send(
                    f'chat_{sender_id}',
                    {
                        'type': 'chat_delivery_update',
                        'message_ids': updated_ids,
                    }
                )
            return

        if msg_type == 'read_receipt':
            raw_ids = data.get('message_ids', [])
            if not isinstance(raw_ids, list) or not raw_ids or not conv_id:
                return
            sender_id, updated_ids = await self._mark_messages_read(raw_ids, conv_id=conv_id)
            if sender_id and updated_ids:
                await self.channel_layer.group_send(
                    f'chat_{sender_id}',
                    {
                        'type': 'chat_read_update',
                        'conversation_id': conv_id,
                        'message_ids': updated_ids,
                    }
                )
            return

        content = str(data.get('content') or '').strip()[:4000]
        if not conv_id or not content:
            return

        result = await self._save_message(conv_id, content)
        if result is None:
            return

        msg_data, recipient_id = result

        await self.channel_layer.group_send(
            f'chat_{recipient_id}',
            {
                'type': 'chat_message',
                'conversation_id': conv_id,
                'message': msg_data,
            }
        )

        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'conversation_id': conv_id,
            'message': msg_data,
        }))

        await self._send_offline_push(recipient_id, content, conv_id)

    @database_sync_to_async
    def _send_offline_push(self, recipient_id, msg_content, conv_id):
        try:
            from marketplace.tasks import send_webpush_notification_task
            send_webpush_notification_task.apply_async(
                args=[
                    recipient_id,
                    f'New message from {self.user.username}',
                    msg_content,
                    f'/messages/{conv_id}'
                ],
                retry=False
            )
        except Exception as e:
            logger.warning(f"Failed to queue web push in chat: {e}")

    @database_sync_to_async
    def _get_recipient_id(self, conv_id):
        from marketplace.models import Conversation
        try:
            conv = Conversation.objects.get(id=int(conv_id))
            if self.user.id not in (conv.buyer_id, conv.seller_id):
                return None
            return conv.seller_id if self.user.id == conv.buyer_id else conv.buyer_id
        except Exception:
            return None

    @database_sync_to_async
    def _get_all_partner_ids(self):
        from marketplace.models import Conversation
        try:
            convs = Conversation.objects.filter(
                Q(buyer=self.user) | Q(seller=self.user)
            ).values_list('buyer_id', 'seller_id')
            partners = set()
            for b_id, s_id in convs:
                if b_id and b_id != self.user.id:
                    partners.add(b_id)
                if s_id and s_id != self.user.id:
                    partners.add(s_id)
            return list(partners)
        except Exception:
            return []

    @database_sync_to_async
    def _save_message(self, conv_id, content):
        from marketplace.models import Conversation, Message
        from marketplace.serializers import MessageSerializer
        try:
            conv = Conversation.objects.select_related('buyer', 'seller').get(id=int(conv_id))
            if self.user.id not in (conv.buyer_id, conv.seller_id):
                return None
            msg = Message.objects.create(conversation=conv, sender=self.user, content=content)
            conv.save(update_fields=['updated_at'])
            recipient_id = conv.seller_id if self.user.id == conv.buyer_id else conv.buyer_id
            return MessageSerializer(msg).data, recipient_id
        except Exception:
            return None

    @database_sync_to_async
    def _mark_messages_delivered(self, message_ids):
        from marketplace.models import Message
        try:
            clean_ids = [int(i) for i in message_ids[:100] if str(i).isdigit()]
            if not clean_ids:
                return None, []
            msgs = (
                Message.objects.filter(id__in=clean_ids, is_delivered=False)
                .filter(Q(conversation__buyer=self.user) | Q(conversation__seller=self.user))
                .exclude(sender=self.user)
            )
            matched = list(msgs.values_list('id', 'sender_id'))
            if not matched:
                return None, []
            sender_id = matched[0][1]
            updated_ids = [m[0] for m in matched]
            Message.objects.filter(id__in=updated_ids).update(is_delivered=True)
            return sender_id, updated_ids
        except Exception:
            return None, []

    @database_sync_to_async
    def _mark_messages_read(self, message_ids, conv_id=None):
        from marketplace.models import Message
        try:
            clean_ids = [int(i) for i in message_ids[:100] if str(i).isdigit()]
            if not clean_ids:
                return None, []
            qs = (
                Message.objects.filter(id__in=clean_ids, is_read=False)
                .filter(Q(conversation__buyer=self.user) | Q(conversation__seller=self.user))
                .exclude(sender=self.user)
            )
            if conv_id is not None:
                qs = qs.filter(conversation_id=int(conv_id))
            matched = list(qs.values_list('id', 'sender_id'))
            if not matched:
                return None, []
            sender_id = matched[0][1]
            updated_ids = [m[0] for m in matched]
            Message.objects.filter(id__in=updated_ids).update(is_read=True, is_delivered=True)
            return sender_id, updated_ids
        except Exception:
            return None, []


class ShipmentTrackingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user, geo_ok = await authenticate_ws_scope(self.scope)
        if not geo_ok:
            await self.close(code=4451)
            return
        if not user:
            await self.close(code=4001)
            return

        self.user = user
        self.shipment_id = self.scope['url_route']['kwargs']['shipment_id']
        self.room_group_name = f'shipment_tracking_{self.shipment_id}'

        allowed = await self._is_authorized(user, self.shipment_id)
        if not allowed:
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def shipment_ping(self, event):
        await self.send(text_data=json.dumps({
            'type': 'location_ping',
            'shipment_id': event['shipment_id'],
            'lat': event['lat'],
            'lng': event['lng'],
            'recorded_at': event['recorded_at'],
            'source': event.get('source', 'driver')
        }))

    @database_sync_to_async
    def _is_authorized(self, user, shipment_id) -> bool:
        if not user or not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        try:
            from logistics.models import Shipment
            from marketplace.models import OrderItem
            shipment = Shipment.objects.select_related('order').get(id=int(shipment_id))
            if shipment.driver_id == user.id or shipment.order.user_id == user.id:
                return True
            return OrderItem.objects.filter(order=shipment.order, product__seller=user).exists()
        except Exception:
            return False


class NotificationConsumer(AsyncWebsocketConsumer):
    """Real-time user & inspection notification stream on `ws/notifications/?ticket=<opaque>`."""

    async def connect(self):
        user, geo_ok = await authenticate_ws_scope(self.scope)
        if not geo_ok:
            await self.close(code=4451)
            return
        if not user:
            await self.close(code=4001)
            return

        self.user = user
        self.group_name = f'notifications_{user.id}'
        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
        except Exception as e:
            logger.warning(f"NotificationConsumer group_add failed: {e}")
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def notification_push(self, event):
        await self.send(text_data=json.dumps({
            'type': 'notification.push',
            'notification': event.get('notification', {}),
        }))
