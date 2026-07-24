import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from django.contrib.auth.models import User
from marketplace.models import OrderItem, Order, Category, Product
print('Users with last_login:', User.objects.filter(last_login__isnull=False).count())
print('Users total:', User.objects.count())
print('Order statuses:', list(Order.objects.values_list('status', flat=True).distinct()))
print('Total Orders:', Order.objects.count())
print('Total Products:', Product.objects.count())
print('Total Categories with products:', Category.objects.filter(products__isnull=False).distinct().count())
