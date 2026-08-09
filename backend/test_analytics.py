import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "uzachuo.settings")
django.setup()

from django.db.models import Sum, F, Q
from marketplace.models import Product, User

user = User.objects.first()

try:
    top_products = Product.objects.filter(seller=user).annotate(
        sales=Sum(
            'orderitem__quantity', 
            filter=Q(orderitem__order__status__in=['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'])
        ),
        revenue=Sum(
            F('orderitem__quantity') * F('orderitem__price'),
            filter=Q(orderitem__order__status__in=['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'])
        )
    ).filter(sales__gt=0).order_by('-sales')[:5]
    print(list(top_products))
    print("SUCCESS")
except Exception as e:
    import traceback
    traceback.print_exc()
