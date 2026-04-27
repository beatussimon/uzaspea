import os
import django
import sys

sys.path.append('/home/bea/uzaspea/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from inspections.models import InspectionRequest, InspectionCategory, InspectorProfile

try:
    r = InspectionRequest.objects.get(id=1)
    print(f"REQUEST 1: Item={r.item_name}, Category={r.category.name} (ID={r.category.id})")
    
    # New Logic: Include ancestors
    cat = r.category
    target_ids = [a.id for a in cat.get_ancestors()] + [cat.id]
    print(f"Target Category IDs (self + ancestors): {target_ids}")
    
    matches = InspectorProfile.objects.filter(is_available=True, certified_categories__id__in=target_ids).distinct()
    print(f"MATCHING INSPECTORS: {matches.count()}")
    for p in matches:
        print(f"  - {p.user.username} (Certified in: {[c.name for c in p.certified_categories.all()]})")

except Exception as e:
    print(f"ERROR: {e}")
