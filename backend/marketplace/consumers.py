import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from urllib.parse import parse_qs


class OrderTrackingConsumer(AsyncWebsocketConsumer):
    """
    WebSocket for real-time order tracking.
    Connect to: ws/tracking/<order_id>/
    Buyer watches their specific order.
    Seller watches incoming orders via ws/tracking/seller/
    """

    async def connect(self):
        self.order_id = self.scope['url_route']['kwargs']['order_id']

        if self.order_id == 'seller':
            # Seller mode: subscribe to all orders containing their products
            user = self.scope.get('user')
            if user and user.is_authenticated:
                self.room_group_name = f'seller_orders_{user.id}'
            else:
                # Try token from query string
                qs = parse_qs(self.scope.get('query_string', b'').decode())
                token = qs.get('token', [None])[0]
                if token:
                    user = await self._get_user_from_token(token)
                    if user:
                        self.room_group_name = f'seller_orders_{user.id}'
                    else:
                        await self.close()
                        return
                else:
                    await self.close()
                    return
        elif self.order_id == 'buyer':
            # Buyer mode: subscribe to all of their own orders
            user = self.scope.get('user')
            if user and user.is_authenticated:
                self.room_group_name = f'buyer_orders_{user.id}'
            else:
                # Try token from query string
                qs = parse_qs(self.scope.get('query_string', b'').decode())
                token = qs.get('token', [None])[0]
                if token:
                    user = await self._get_user_from_token(token)
                    if user:
                        self.room_group_name = f'buyer_orders_{user.id}'
                    else:
                        await self.close()
                        return
                else:
                    await self.close()
                    return
        else:
            self.room_group_name = f'order_tracking_{self.order_id}'
            # FIX: M-07 — verify the connecting user owns this order
            user = self.scope.get('user')
            if not user or not user.is_authenticated:
                # Try token from query string for JWT clients
                qs = parse_qs(self.scope.get('query_string', b'').decode())
                token = qs.get('token', [None])[0]
                if token:
                    user = await self._get_user_from_token(token)
                if not user:
                    await self.close()
                    return
            # Verify this user owns the order
            order_belongs = await self._user_owns_order(user, self.order_id)
            if not order_belongs:
                await self.close()
                return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def tracking_update(self, event):
        """Receive tracking update from channel layer and send to WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'status_update',
            'order_id': event['order_id'],
            'status': event['status'],
            'notes': event.get('notes', ''),
            'timestamp': event.get('timestamp', ''),
            'old_status': event.get('old_status', ''),
        }))

    @database_sync_to_async
    def _get_user_from_token(self, token):
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
            from django.contrib.auth.models import User
            validated = AccessToken(token)
            return User.objects.get(id=validated['user_id'])
        except (TokenError, InvalidToken, Exception):
            # Using Exception as fallback, but explicitly acknowledging the specific expected exceptions
            return None

    @database_sync_to_async
    def _user_owns_order(self, user, order_id):
        """FIX: M-07 — check order ownership before allowing WS connection."""
        from marketplace.models import Order
        try:
            return Order.objects.filter(id=order_id, user=user).exists() or user.is_staff
        except Exception:
            return False

class ChatConsumer(AsyncWebsocketConsumer):
    """FIX HIGH-01: real-time message delivery via WebSocket."""

    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            # Try token from query string
            qs = parse_qs(self.scope.get('query_string', b'').decode())
            token = qs.get('token', [None])[0]
            if token:
                user = await self._get_user_from_token(token)
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return
        self.user = user
        self.group_name = f'chat_{user.id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'conversation_id': event['conversation_id'],
            'message': event['message'],
        }))

    async def receive(self, text_data):
        """Receive message from WebSocket, save to DB, broadcast to recipient."""
        import json
        from asgiref.sync import sync_to_async
        
        data = json.loads(text_data)
        conv_id = data.get('conversation_id')
        content = data.get('content', '').strip()
        
        if not conv_id or not content:
            return
        
        # Save message and get recipient
        result = await self._save_message(conv_id, content)
        if result is None:
            return
        
        msg_data, recipient_id = result
        
        # Broadcast to recipient's personal channel group
        await self.channel_layer.group_send(
            f'chat_{recipient_id}',
            {
                'type': 'chat_message',
                'conversation_id': conv_id,
                'message': msg_data,
            }
        )
        # Echo back to sender for confirmation
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'conversation_id': conv_id,
            'message': msg_data,
        }))

    @database_sync_to_async
    def _save_message(self, conv_id, content):
        from marketplace.models import Conversation, Message
        from marketplace.serializers import MessageSerializer
        try:
            conv = Conversation.objects.select_related('buyer', 'seller').get(id=conv_id)
            if self.user not in (conv.buyer, conv.seller):
                return None
            msg = Message.objects.create(conversation=conv, sender=self.user, content=content)
            conv.save()  # bump updated_at
            recipient = conv.seller if self.user == conv.buyer else conv.buyer
            return MessageSerializer(msg).data, recipient.id
        except Conversation.DoesNotExist:
            return None

    @database_sync_to_async
    def _get_user_from_token(self, token):
        try:
            from rest_framework_simplejwt.tokens import UntypedToken
            from rest_framework_simplejwt.authentication import JWTAuthentication
            UntypedToken(token)
            auth = JWTAuthentication()
            validated = auth.get_validated_token(token)
            return auth.get_user(validated)
        except Exception:
            return None
