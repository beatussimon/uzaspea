import os
import django
import sys

sys.path.append('/home/bea/uzaspea/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from inspections.models import InspectionRequest, InspectorProfile

try:
    r = InspectionRequest.objects.latest('created_at')
    print(f"LATEST REQUEST: ID={r.id}, Item={r.item_name}, Category={r.category.name} (ID={r.category.id})")
    
    # Check inspectors
    inspectors = InspectorProfile.objects.filter(is_available=True)
    print(f"TOTAL AVAILABLE INSPECTORS: {inspectors.count()}")
    for p in inspectors:
        cats = [c.id for c in p.certified_categories.all()]
        print(f"Inspector: {p.user.username}, Certified IDs: {cats}")
        if r.category.id in cats:
            print(f"  -> MATCHES category {r.category.id}")
        else:
            print(f"  -> DOES NOT match category {r.category.id}")

except Exception as e:
    print(f"ERROR: {e}")
