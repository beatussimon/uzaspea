import os
import django
import sys

sys.path.append('/home/bea/uzaspea/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from inspections.models import InspectionRequest

try:
    r = InspectionRequest.objects.get(id=2)
    print(f"REQUEST 2 STATUS: {r.status}")
except Exception as e:
    print(f"ERROR: {e}")
