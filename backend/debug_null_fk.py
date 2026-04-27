import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from inspections.serializers import InspectionReportSerializer
from inspections.models import InspectionReport
from django.contrib.auth.models import User

# Check if a report with NULL approved_by exists
report = InspectionReport.objects.filter(approved_by__isnull=True).first()
if report:
    print(f"Testing report {report.id} with approved_by=None")
    serializer = InspectionReportSerializer(report)
    try:
        data = serializer.data
        print("Success!")
    except Exception as e:
        print(f"CRASH: {e}")
else:
    print("No report with approved_by=None found.")
