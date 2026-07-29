import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()
from django.conf import settings
print("SECRET_KEY:", settings.SECRET_KEY)
