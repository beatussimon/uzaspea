import os
import django
from django.utils.text import slugify
from django.db.models import Count

# Set up Django environment -- VERY IMPORTANT for standalone scripts
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "my_marketplace.settings")  # Replace 'my_marketplace'
django.setup()

from marketplace.models import Product  # Replace 'marketplace' with your app name


def fix_duplicate_slugs():
    """Finds and fixes duplicate product slugs."""

    # Find duplicate slugs and their counts
    duplicates = Product.objects.values('slug').annotate(count=Count('id')).filter(count__gt=1)

    for dup in duplicates:
        slug = dup['slug']
        count = dup['count']
        print(f"Found {count} products with slug: {slug}")

        # Get all products with this slug, *excluding* the first one
        products = Product.objects.filter(slug=slug).order_by('id')[1:]  # Keep the first

        counter = 1
        for product in products:
            original_slug = slugify(product.name)
            new_slug = f"{original_slug}-{counter}"
            #check if the new slug created exists to avoid another error
            while Product.objects.filter(slug=new_slug).exists():
                counter += 1
                new_slug = f"{original_slug}-{counter}"
            print(f"  Updating product ID {product.id}: {product.slug} -> {new_slug}")
            product.slug = new_slug
            product.save()  # Save the updated slug


    print("Slug update complete.")

if __name__ == '__main__':
    fix_duplicate_slugs()