import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Product, Order
from django.db.models import Count, Sum, DecimalField, Q
from django.db.models.functions import Coalesce
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone

now = timezone.now()
seven_days_ago = now - timedelta(days=7)
weekly_order_ids = Order.objects.filter(
    order_date__gte=seven_days_ago,
    status__in=['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED']
).values_list('id', flat=True)

try:
    base_qs = Product.objects.select_related('category', 'seller').prefetch_related('images', 'likes').filter(
        is_available=True
    ).annotate(
        weekly_sales=Coalesce(Sum(
            'orderitem__quantity',
            filter=Q(orderitem__order_id__in=weekly_order_ids)
        ), Decimal('0'), output_field=DecimalField()),
        like_count=Count('likes', distinct=True)
    )
    print(list(base_qs[:1]))
    print('SUCCESS WITH orderitem')
except Exception as e:
    print('ERROR WITH orderitem:', e)

try:
    base_qs = Product.objects.select_related('category', 'seller').prefetch_related('images', 'likes').filter(
        is_available=True
    ).annotate(
        weekly_sales=Coalesce(Sum(
            'orderitem_set__quantity',
            filter=Q(orderitem_set__order_id__in=weekly_order_ids)
        ), Decimal('0'), output_field=DecimalField()),
        like_count=Count('likes', distinct=True)
    )
    print(list(base_qs[:1]))
    print('SUCCESS WITH orderitem_set')
except Exception as e:
    print('ERROR WITH orderitem_set:', e)

