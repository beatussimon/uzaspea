import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Category, Product

print("Temp Safe Cat count:", Category.objects.filter(name='__TEMP_SAFE_CAT__').count())
print("Products in temp safe cat:", Product.objects.filter(category__name='__TEMP_SAFE_CAT__').count())
for p in Product.objects.filter(category__name='__TEMP_SAFE_CAT__'):
    print(p.id, p.name)
