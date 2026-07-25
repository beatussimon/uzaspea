import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.api_views import CategoryViewSet

try:
    viewset = CategoryViewSet()
    qs = viewset.get_queryset()
    print("Queryset created.")
    # Evaluate queryset to trigger any SQL errors
    list(qs)
    print("Queryset evaluated successfully.")
except Exception as e:
    import traceback
    traceback.print_exc()
