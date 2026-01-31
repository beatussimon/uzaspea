import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import MobileNetwork

for network in MobileNetwork.objects.all():
    print(f"{network.name}:")
    numbers = list(network.lipa_numbers.all())
    if numbers:
        for n in numbers:
            print(f"  {n.number} ({n.name})")
    else:
        print("  No numbers")
