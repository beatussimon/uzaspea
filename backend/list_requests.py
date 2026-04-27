import os
import django
import sys

sys.path.append('/home/bea/uzaspea/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from inspections.models import InspectionRequest

try:
    for r in InspectionRequest.objects.all().order_by('-created_at'):
        print(f"ID={r.id}, Item={r.item_name}, Status={r.status}")
except Exception as e:
    print(f"ERROR: {e}")
