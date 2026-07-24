import os
import django
from datetime import timedelta
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from django.utils import timezone
from django.db.models import Sum, Count, Avg, Q
from django.contrib.auth.models import User
from marketplace.models import OrderItem, Order, Category, Product

now = timezone.now()
thirty_days_ago = now - timedelta(days=30)
seven_days_ago = now - timedelta(days=7)

active_users_count = User.objects.filter(last_login__gte=thirty_days_ago).count()
products_sold_dict = OrderItem.objects.filter(
    order__status__in=['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED']
).aggregate(total=Sum('quantity'))
products_sold = products_sold_dict['total'] or 0
weekly_visits = User.objects.filter(last_login__gte=seven_days_ago).count()
hot_categories = Category.objects.annotate(pc=Count('products')).filter(pc__gt=0).count()

print("Active Users (30d):", active_users_count)
print("Products Sold:", products_sold)
print("Weekly Visits (7d):", weekly_visits)
print("Hot Categories:", hot_categories)
