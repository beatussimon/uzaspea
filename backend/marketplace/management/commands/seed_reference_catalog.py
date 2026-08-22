import os
import re
import json
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify
from marketplace.models import Category, Brand, ReferenceProduct

class Command(BaseCommand):
    help = 'Seeds categories, schemas, brands, and reference products from Markdown artifacts.'

    def parse_markdown_table(self, lines):
        if not lines: return []
        headers = [col.strip() for col in lines[0].split('|')[1:-1]]
        data = []
        for line in lines[2:]:  # skip headers and separator
            if not line.strip() or not line.startswith('|'):
                break
            cells = [col.strip() for col in line.split('|')[1:-1]]
            row = dict(zip(headers, cells))
            data.append(row)
        return data

    def handle(self, *args, **options):
        # We assume the artifacts are available at this path inside the docker container:
        wsl_base = "/app/media"
        cat_file = os.path.join(wsl_base, "reference_data_categories_and_schemas.md")
        prod_file = os.path.join(wsl_base, "reference_data_products_and_brands.md")
        
        if not os.path.exists(cat_file) or not os.path.exists(prod_file):
            self.stdout.write(self.style.ERROR(f"Artifact files not found in {wsl_base}"))
            return

        with open(cat_file, 'r', encoding='utf-8') as f:
            cat_content = f.read()

        with open(prod_file, 'r', encoding='utf-8') as f:
            prod_content = f.read()

        with transaction.atomic():
            self.stdout.write("1. Processing Categories & Schemas...")
            self.process_categories_and_schemas(cat_content)

            self.stdout.write("2. Processing Brands & Products...")
            self.process_products(prod_content)
            
        self.stdout.write(self.style.SUCCESS("Seeding completed successfully!"))

    def process_categories_and_schemas(self, content):
        # Find all category tables
        # They look like:
        # | Slug | Name | Parent | Status | is_leaf |
        # |---|---|---|---|---|
        # | `vehicles` | ...
        
        tables = re.findall(r'(\|(?: [^|]+ \|)+)\n\|(?:-+\|)+\n((?:\|(?: [^|]+ \|)+\n?)+)', content)
        
        for header_line, body in tables:
            lines = [header_line] + ["|---|---|"] + body.strip().split('\n')
            if 'Slug' in header_line and 'Name' in header_line:
                rows = self.parse_markdown_table(lines)
                for row in rows:
                    slug = row.get('Slug', '').replace('`', '').strip()
                    name = row.get('Name', '').strip()
                    parent_slug = row.get('Parent', '').replace('`', '').strip()
                    is_leaf_str = row.get('is_leaf', '').strip().lower()
                    is_leaf = True if is_leaf_str == 'yes' else False
                    
                    if not slug or not name: continue
                    if parent_slug == '—': parent_slug = None
                    
                    parent_cat = None
                    if parent_slug:
                        parent_cat, _ = Category.objects.get_or_create(slug=parent_slug, defaults={'name': parent_slug})
                        
                    cat, created = Category.objects.update_or_create(
                        slug=slug,
                        defaults={
                            'name': name,
                            'parent': parent_cat,
                            'is_leaf': is_leaf
                        }
                    )
        
        # Now process schemas
        schema_blocks = re.findall(r'### [^\(]+\(`([^`]+)`\)\n\n```json\n(.*?)\n```', content, re.DOTALL)
        for slug, json_str in schema_blocks:
            try:
                schema_data = json.loads(json_str)
                Category.objects.filter(slug=slug).update(spec_schema=schema_data)
                self.stdout.write(f"Updated schema for category: {slug}")
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed to parse JSON for {slug}: {e}"))

    def process_products(self, content):
        sections = re.split(r'\n## \d+\. ', content)
        
        for section in sections:
            if not section.strip(): continue
            lines = section.strip().split('\n')
            section_title = lines[0].strip()
            
            category_slug = None
            if "Smartphones" in section_title:
                category_slug = "smartphones-only"
            elif "Laptops" in section_title:
                category_slug = "laptops-only"
            elif "Televisions" in section_title:
                category_slug = "televisions"
            elif "Cars" in section_title:
                category_slug = "cars-suvs"
            elif "Commercial" in section_title:
                category_slug = "trucks"
            elif "Motorcycles" in section_title:
                category_slug = "motorcycles"
            elif "Home Appliances" in section_title:
                category_slug = "refrigerators-freezers" 
            elif "Solar" in section_title:
                category_slug = "solar-energy"
            elif "Agriculture" in section_title:
                category_slug = "farm-machinery"
            elif "Generators" in section_title:
                category_slug = "generators"
            else:
                continue

            try:
                cat = Category.objects.get(slug=category_slug)
            except Category.DoesNotExist:
                cat = Category.objects.first()

            table_lines = [l for l in lines if l.startswith('|')]
            if len(table_lines) > 2:
                rows = self.parse_markdown_table(table_lines)
                for row in rows:
                    brand_name = row.get('Brand', row.get('Make', None))
                    if not brand_name:
                        if "Samsung" in section_title: brand_name = "Samsung"
                        elif "Apple" in section_title: brand_name = "Apple"
                        else: brand_name = "Unknown"
                        
                    brand_name = brand_name.strip()
                    model_name = row.get('Model', row.get('Series', 'Unknown')).strip()
                    
                    if not brand_name or not model_name: continue
                    
                    brand, _ = Brand.objects.get_or_create(
                        name=brand_name,
                        defaults={'slug': slugify(brand_name)}
                    )
                    
                    specs = {k: v for k, v in row.items() if k not in ['Brand', 'Make', 'Model', 'Series']}
                    
                    base_slug = slugify(f"{brand.name} {model_name}")
                    ref_slug = base_slug
                    counter = 1
                    while ReferenceProduct.objects.filter(slug=ref_slug).exclude(brand=brand, name=model_name).exists():
                        ref_slug = f"{base_slug}-{counter}"
                        counter += 1
                    
                    ref_prod, created = ReferenceProduct.objects.update_or_create(
                        brand=brand,
                        name=model_name,
                        defaults={
                            'slug': ref_slug,
                            'category': cat,
                            'structured_specs': specs
                        }
                    )
