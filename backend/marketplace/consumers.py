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
        else:
            self.room_group_name = f'order_tracking_{self.order_id}'

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
            from django.contrib.auth.models import User
            validated = AccessToken(token)
            return User.objects.get(id=validated['user_id'])
        except Exception:
            return None
