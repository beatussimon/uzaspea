import os
import django
import sys

sys.path.append('/home/bea/uzaspea/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from inspections.models import InspectionCategory

try:
    for c in InspectionCategory.objects.all():
        parent_name = c.parent.name if c.parent else "None"
        print(f"ID={c.id}, Name={c.name}, Parent={parent_name}")
except Exception as e:
    print(f"ERROR: {e}")
