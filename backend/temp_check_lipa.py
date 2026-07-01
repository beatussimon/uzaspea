import django
import sys
from django.conf import settings
from marketplace.models import LipaNumber

# Get all lipa numbers owned by superusers
numbers = LipaNumber.objects.filter(seller__is_superuser=True)
for n in numbers:
    print(f'ID: {n.id}, Seller: {n.seller.username}, Name: {n.name}, Number: {n.number}, Purpose: {n.purpose}, Is System: {n.is_system}')
