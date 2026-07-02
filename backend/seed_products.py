import os
import django
import random
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')
django.setup()

from marketplace.models import Category, Product, SponsoredListing, Review
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

User = get_user_model()

def run():
    print("Seeding dummy products...")
    
    # Get or create a dummy user
    seller, _ = User.objects.get_or_create(username='dummy_seller', defaults={'email': 'dummy@seller.com'})
    seller.set_password('password123')
    seller.tier_id = 3 # business
    seller.is_verified = True
    seller.save()
    
    buyer, _ = User.objects.get_or_create(username='dummy_buyer', defaults={'email': 'buyer@dummy.com'})
    buyer.set_password('password123')
    buyer.save()

    categories = Category.objects.all()
    if not categories.exists():
        print("No categories found. Run manage.py seed first.")
        return

    adjectives = ['Pro', 'Max', 'Ultra', 'Premium', 'Basic', 'Vintage', 'Modern', 'Compact']
    
    count = 0
    promo_count = 0
    for cat in categories:
        for i in range(8):
            name = f"{random.choice(adjectives)} {cat.name} Item {i+1}"
            price = random.randint(1000, 5000000)
            
            # create product
            product = Product.objects.create(
                seller=seller,
                category=cat,
                name=name,
                description=f"This is a fantastic {name}. Perfect for all your {cat.name.lower()} needs.",
                price=Decimal(price),
                condition=random.choice(['New', 'Used']),
                is_available=True,
                stock=random.randint(1, 100),
            )
            count += 1
            
            # Add some reviews so avg_rating works
            if random.random() > 0.3:
                Review.objects.create(
                    product=product,
                    user=buyer,
                    rating=random.randint(3, 5),
                    comment="Great product!"
                )

            # 20% chance to be sponsored
            if random.random() < 0.2:
                SponsoredListing.objects.create(
                    product=product,
                    user=seller,
                    status='approved',
                    amount=Decimal('5000.00'),
                    expires_at=timezone.now() + timedelta(days=30)
                )
                promo_count += 1

    print(f"Successfully created {count} products, {promo_count} are sponsored!")

if __name__ == '__main__':
    run()
