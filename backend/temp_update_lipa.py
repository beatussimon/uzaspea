import django
import sys
from django.conf import settings
from marketplace.models import LipaNumber

# Update ID 5 and 6 to be system numbers
LipaNumber.objects.filter(id__in=[5, 6]).update(is_system=True)
print('Updated ID 5 and 6 to is_system=True')
