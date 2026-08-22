from marketplace.models import Brand, ReferenceProduct
print(f"Brands: {Brand.objects.count()}")
print(f"Products: {ReferenceProduct.objects.count()}")
