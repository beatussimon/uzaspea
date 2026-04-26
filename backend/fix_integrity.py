import os
import django
from django.conf import settings

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from staff.models import StaffProfile, Department
from django.db import connection, IntegrityError

def fix_integrity():
    with connection.cursor() as cursor:
        try:
            # First, check if there are any invalid department_id values
            cursor.execute("SELECT id, department_id FROM staff_staffprofile")
            rows = cursor.fetchall()
            
            invalid_ids = []
            for row in rows:
                profile_id, dept_id = row
                if dept_id is not None:
                    # Check if dept_id is a valid integer and exists in Department
                    try:
                        int_id = int(dept_id)
                        if not Department.objects.filter(id=int_id).exists():
                            invalid_ids.append(profile_id)
                    except (ValueError, TypeError):
                        # Not an integer, definitely invalid for a FK
                        invalid_ids.append(profile_id)
            
            if invalid_ids:
                print(f"Found {len(invalid_ids)} invalid department references. Setting to NULL.")
                for pid in invalid_ids:
                    cursor.execute("UPDATE staff_staffprofile SET department_id = NULL WHERE id = %s", [pid])
                print("Update complete.")
            else:
                print("No invalid department references found.")
                
        except Exception as e:
            print(f"Error fixing integrity: {e}")

if __name__ == "__main__":
    fix_integrity()
