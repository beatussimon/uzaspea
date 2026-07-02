import os, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'
django.setup()

from marketplace.models import SponsoredProduct
sp = SponsoredProduct.objects.filter(status='active').first()
if sp:
    print(f"Sponsored product ID: {sp.product_id}")
    print(f"Product name: {sp.product.name}")
else:
    print("No active sponsored products")

# Check what the API actually returns
from marketplace.serializers import SponsoredProductSerializer
from rest_framework.test import APIRequestFactory
factory = APIRequestFactory()
request = factory.get('/')

qs = SponsoredProduct.objects.filter(status='active')[:2]
for s in qs:
    data = SponsoredProductSerializer(s, context={'request': request}).data
    print(f"\n--- Serialized sponsored product ---")
    print(f"Top-level keys: {list(data.keys())}")
    if 'product_details' in data:
        pd = data['product_details']
        print(f"product_details keys: {list(pd.keys()) if isinstance(pd, dict) else type(pd)}")
        if isinstance(pd, dict) and 'id' in pd:
            print(f"product_details.id = {pd['id']}")
    if 'product' in data:
        print(f"product (raw FK) = {data['product']}")
