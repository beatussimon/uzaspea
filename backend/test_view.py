import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uzachuo.settings")
django.setup()

from django.test import Client
from marketplace.models import User

for user in User.objects.all():
    client = Client()
    client.force_login(user)
    try:
        response = client.get('/api/analytics/seller/')
        if response.status_code == 500:
            print(f"User {user.id} ({user.username}) caused 500!")
            print(response.content.decode())
    except Exception as e:
        print(f"Exception for user {user.id}: {e}")
