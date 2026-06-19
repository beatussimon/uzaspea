from django.test import TestCase
from django.contrib.auth import get_user_model
from channels.testing import WebsocketCommunicator
from asgiref.sync import sync_to_async
from decimal import Decimal
import json

from marketplace.consumers import ChatConsumer
from marketplace.models import Category, Product, Conversation, Message

User = get_user_model()

class ChatConsumerTestCase(TestCase):
    def setUp(self):
        self.seller = User.objects.create_user(username="seller", password="password")
        self.buyer = User.objects.create_user(username="buyer", password="password")
        
        self.category = Category.objects.create(name="Gizmos", slug="gizmos")
        self.product = Product.objects.create(
            name="Super Gizmo",
            slug="super-gizmo",
            category=self.category,
            price=Decimal("50000.00"),
            stock=10,
            seller=self.seller,
            condition="New"
        )
        self.conversation = Conversation.objects.create(
            buyer=self.buyer,
            seller=self.seller,
            product=self.product
        )

    async def test_connect_authenticated(self):
        # Create communicator
        communicator = WebsocketCommunicator(ChatConsumer.as_asgi(), "ws/chat/")
        
        # Inject authenticated user into scope
        communicator.scope['user'] = self.buyer
        
        # Connect
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        # Disconnect
        await communicator.disconnect()

    async def test_connect_anonymous(self):
        from django.contrib.auth.models import AnonymousUser
        communicator = WebsocketCommunicator(ChatConsumer.as_asgi(), "ws/chat/")
        communicator.scope['user'] = AnonymousUser()
        
        # Connection should close/reject with 4001 or standard disconnect
        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)

    async def test_receive_message(self):
        communicator = WebsocketCommunicator(ChatConsumer.as_asgi(), "ws/chat/")
        communicator.scope['user'] = self.buyer
        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)
        
        # Send message content via WebSocket
        message_data = {
            'conversation_id': self.conversation.id,
            'content': 'Hello, Seller!'
        }
        await communicator.send_to(text_data=json.dumps(message_data))
        
        # Check if we receive confirmation echo
        response = await communicator.receive_from()
        data = json.loads(response)
        
        self.assertEqual(data['type'], 'chat_message')
        self.assertEqual(data['conversation_id'], self.conversation.id)
        self.assertEqual(data['message']['content'], 'Hello, Seller!')
        
        # Check that message was saved in DB
        message_count = await sync_to_async(Message.objects.filter(conversation=self.conversation).count)()
        self.assertEqual(message_count, 1)
        
        await communicator.disconnect()
