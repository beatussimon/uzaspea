import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uzachuo.settings")
django.setup()

from django.test import Client
from marketplace.models import User

for u in User.objects.all():
    client = Client()
    client.force_login(u)
    resp = client.get('/api/analytics/seller/')
    if resp.status_code == 500:
        print(f"User {u.username} gave 500")
        print(resp.content)
    elif resp.status_code != 200:
        print(f"User {u.username} gave {resp.status_code}")
