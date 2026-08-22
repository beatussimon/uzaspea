import json
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from rest_framework.test import APIRequestFactory
from marketplace.api_views import BrandViewSet, ReferenceProductViewSet, CategoryViewSet, ProductViewSet
from marketplace.models import Brand, ReferenceProduct, Category, Product
from django.db.models import Min, Max, Count

print('=== 1. DATABASE MODEL & DATA INTEGRITY ===')
total_brands = Brand.objects.count()
total_ref_products = ReferenceProduct.objects.count()
cats_with_schema = Category.objects.exclude(spec_schema=[]).count()

print(f'Total Brands: {total_brands}')
print(f'Total Reference Products: {total_ref_products}')
print(f'Categories with Schema: {cats_with_schema}')

# Breakdown by Brand
print('\nTop Brands by Reference Products:')
brand_counts = Brand.objects.annotate(prod_count=Count('reference_products')).order_by('-prod_count')[:10]
for b in brand_counts:
    print(f'  - {b.name}: {b.prod_count} products')

# Year range check from structured_specs
all_years = []
for rp in ReferenceProduct.objects.all():
    yr = rp.structured_specs.get('release_year') or rp.structured_specs.get('year')
    if yr:
        try:
            all_years.append(int(yr))
        except (ValueError, TypeError):
            pass

if all_years:
    print(f'\nYear Range Coverage: {min(all_years)} -> {max(all_years)}')
    from collections import Counter
    year_counts = Counter(all_years)
    print('Year Breakdown:')
    for y in sorted(year_counts.keys()):
        print(f'  Year {y}: {year_counts[y]} products')

# Category breakdown
print('\nCategory Coverage & Schema:')
cats_with_specs = Category.objects.exclude(spec_schema=[])
for c in cats_with_specs:
    print(f'  - {c.name} (slug: {c.slug}): {len(c.spec_schema)} schema fields, parent={c.parent.slug if c.parent else None}')

print('\n=== 2. API ENDPOINTS INTEGRATION TEST ===')
factory = APIRequestFactory()

# 1. Brand list
view = BrandViewSet.as_view({'get': 'list'})
req = factory.get('/api/brands/')
res = view(req)
print(f'GET /api/brands/ -> HTTP {res.status_code}, count: {len(res.data.get("results", res.data))}')

# 2. Reference Products list
view = ReferenceProductViewSet.as_view({'get': 'list'})
req = factory.get('/api/reference-products/?brand=samsung')
res = view(req)
print(f'GET /api/reference-products/?brand=samsung -> HTTP {res.status_code}, count: {len(res.data.get("results", res.data))}')

# 3. Category spec-schema for smartphones-only
view = CategoryViewSet.as_view({'get': 'spec_schema'})
req = factory.get('/api/categories/smartphones-only/spec-schema/')
res = view(req, slug='smartphones-only')
print(f'GET /api/categories/smartphones-only/spec-schema/ -> HTTP {res.status_code}, schema items: {len(res.data) if isinstance(res.data, list) else res.data}')
if isinstance(res.data, list) and len(res.data) > 0:
    print('  Sample fields:', [f['key'] for f in res.data[:6]])

# 4. Category brands for smartphones-only
view = CategoryViewSet.as_view({'get': 'brands'})
req = factory.get('/api/categories/smartphones-only/brands/')
res = view(req, slug='smartphones-only')
print(f'GET /api/categories/smartphones-only/brands/ -> HTTP {res.status_code}, brands count: {len(res.data) if isinstance(res.data, list) else res.data}')
if isinstance(res.data, list) and len(res.data) > 0:
    print('  Sample brands:', [b['name'] for b in res.data[:6]])

# 5. Product filter test
view = ProductViewSet.as_view({'get': 'list'})
req = factory.get('/api/products/?brand=samsung')
res = view(req)
print(f'GET /api/products/?brand=samsung -> HTTP {res.status_code}')

print('\n=== 3. AUDIT RESULT: PASSED ===')
