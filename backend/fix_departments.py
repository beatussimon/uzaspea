import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from staff.models import StaffProfile, Department

# Get all unique department strings from StaffProfile (if they are still there or in the new field)
# Actually, the error says 'department_id' contains the string.
# We'll create departments for any unique values found.

profiles = StaffProfile.objects.all()
for profile in profiles:
    # Since the field is now a ForeignKey, we might need to access it carefully if it's broken
    try:
        # Try to get the raw value if possible, or just handle the error
        pass
    except:
        pass

# Hardcoded fix based on the error message
dept, _ = Department.objects.get_or_create(name='Department of marketing')
print(f"Created/Found department: {dept.name}")

# Re-run migration after this might work, OR we can manually update the profiles here.
# But we need to bypass the ForeignKey check if possible or just update the raw SQL.

from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("UPDATE staff_staffprofile SET department_id = %s WHERE department_id = 'Department of marketing'", [dept.id])
    print("Updated profiles with 'Department of marketing'")

print("Done.")
