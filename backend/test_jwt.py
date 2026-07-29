import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from rest_framework_simplejwt.tokens import AccessToken
import sys

token = sys.argv[1]

try:
    decoded = AccessToken(token)
    print("Token is valid!")
    print(decoded.payload)
except Exception as e:
    print("Token validation failed:")
    print(e)
