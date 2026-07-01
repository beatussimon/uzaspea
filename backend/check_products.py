import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Product
from django.contrib.auth.models import User

user = User.objects.get(id=25)
print(f"User 25 username: {user.username}")

products = Product.objects.all()[:5]
for p in products:
    print(f"Product {p.id}: {p.name} (Seller: {p.seller.id})")
