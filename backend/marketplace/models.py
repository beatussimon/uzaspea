from django.db import models
from django.db.models import Avg, Count
from django.urls import reverse
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from django.conf import settings
from django.utils import timezone
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils.text import slugify
import logging
from decimal import Decimal
import secrets

logger = logging.getLogger(__name__)


def validate_image(image):
    """FIX D-06: validate image size and format."""
    max_size_mb = 5
    if image.size > max_size_mb * 1024 * 1024:
        raise ValidationError(f'Image must be under {max_size_mb}MB. Yours is {image.size // (1024*1024)}MB.')
    valid_types = ['image/jpeg', 'image/png', 'image/webp']
    if hasattr(image, 'content_type') and image.content_type not in valid_types:
        raise ValidationError('Only JPEG, PNG, and WebP images are allowed.')

def validate_document(file):
    valid_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    max_size_mb = 10
    if file.size > max_size_mb * 1024 * 1024:
        raise ValidationError(f'File must be under {max_size_mb}MB.')
    if hasattr(file, 'content_type') and file.content_type not in valid_types:
        raise ValidationError('Only PDF, JPEG, PNG, and WebP files are accepted.')

def convert_and_save_image(instance, field_name='image'):
    """
    Shared helper to resize image to 1200px width (preserving ratio)
    and convert it to WebP format.
    """
    image_field = getattr(instance, field_name)
    if image_field:
        try:
            import os
            from PIL import Image as PILImage
            from django.core.files.base import ContentFile
            from io import BytesIO
            
            img_path = image_field.path
            img = PILImage.open(img_path)
            
            # Resize if necessary
            if img.width > 1200:
                ratio = 1200 / img.width
                img = img.resize((1200, int(img.height * ratio)), PILImage.LANCZOS)
            
            # Convert to WebP
            if img.format != 'WEBP':
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGBA")
                else:
                    img = img.convert("RGB")
                
                webp_io = BytesIO()
                img.save(webp_io, format='WEBP', quality=80)
                
                # Delete the old file
                old_path = image_field.path
                if os.path.exists(old_path):
                    os.remove(old_path)
                
                # Create new filename
                base_name = os.path.splitext(os.path.basename(image_field.name))[0]
                new_filename = f"{base_name}.webp"
                
                # Save the new file content into the ImageField
                image_field.save(new_filename, ContentFile(webp_io.getvalue()), save=False)
                
                # Call super save again to update the db path
                instance.save(update_fields=[field_name])
        except Exception as e:
            logger.exception("Failed to convert image to WebP format: %s", str(e))


class SubscriptionTier(models.Model):
    name = models.CharField(max_length=50, unique=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    benefits = models.TextField(help_text="Comma-separated list or HTML for display")
    duration = models.PositiveIntegerField(help_text="Duration in days")
    is_active = models.BooleanField(default=True)
    TIER_LEVEL_CHOICES = [
        ('customer', 'Customer'),
        ('seller_pro', 'Seller Pro'),
        ('business', 'Business'),
    ]
    tier_level = models.CharField(
        max_length=20, choices=TIER_LEVEL_CHOICES, default='customer'
    )
    commission_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('10.00'),
        help_text="Platform commission % charged to sellers on this tier"
    )

    def __str__(self):
        return f"{self.name} ({self.price})"


class MobileNetwork(models.Model):
    name = models.CharField(max_length=50, unique=True)
    image = models.ImageField(upload_to='mobile-networks/')

    def __str__(self):
        return self.name


class LipaNumber(models.Model):
    seller = models.ForeignKey(          # FIX X-01: per-seller payment info
        User, on_delete=models.CASCADE, related_name='lipa_numbers'
    )
    network = models.ForeignKey(MobileNetwork, related_name='lipa_numbers', on_delete=models.CASCADE)
    number = models.CharField(max_length=30)
    name = models.CharField(max_length=100, help_text="Account or payee name shown to buyer")
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)
    is_system = models.BooleanField(default=False, help_text="True if this is a global platform payment method")
    
    PURPOSE_CHOICES = [
        ('general', 'General'),
        ('subscriptions', 'Subscriptions & Upgrades'),
        ('commissions', 'Commission Payments'),
    ]
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES, default='general')

    class Meta:
        ordering = ['display_order', 'network__name']
        unique_together = ('seller', 'network', 'number')

    def __str__(self):
        return f"{self.seller.username} — {self.network.name}: {self.number} ({self.name})"


class Subscription(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='subscriptions')
    tier = models.ForeignKey(SubscriptionTier, on_delete=models.PROTECT, null=True, blank=True)
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=False)

    def __str__(self):
        tier_name = self.tier.name if self.tier_id else 'No Tier'  # FIX: C-06
        return f"{self.user.username} - {tier_name} ({'Active' if self.is_active else 'Inactive'})"


class PaymentConfirmation(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payment_confirmations')
    tier = models.ForeignKey(SubscriptionTier, on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reference = models.CharField(max_length=100)
    proof = models.ImageField(upload_to='payment_proofs/', blank=True, null=True, validators=[validate_image])
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.tier.name} ({self.status})"


class Category(models.Model):
    def get_descendants(self, include_self=False):
        """Efficient BFS using only O(depth) queries instead of O(nodes) queries."""  # FIX: C-08
        ids = [self.id] if include_self else []
        queue = list(
            Category.objects.filter(parent=self).values_list('id', flat=True)
        )
        while queue:
            ids.extend(queue)
            queue = list(
                Category.objects.filter(parent_id__in=queue).values_list('id', flat=True)
            )
        return Category.objects.filter(id__in=ids)

    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(unique=True, blank=True)
    description = models.TextField(blank=True)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            base = slugify(self.name) or "category"
            self.slug = base

        from django.db import IntegrityError, transaction
        try:
            with transaction.atomic():
                super().save(*args, **kwargs)
        except IntegrityError:
            from django.utils.text import slugify
            base = slugify(self.name) or "category"
            n = 1
            while True:
                self.slug = f'{base}-{n}'
                try:
                    with transaction.atomic():
                        super().save(*args, **kwargs)
                    break
                except IntegrityError:
                    n += 1

    def __str__(self):
        if self.parent:
            return f"{self.parent} -> {self.name}"
        return self.name

    def get_absolute_url(self):
        return reverse('product_list') + f"?category={self.slug}"

    def get_ancestors(self):  # For breadcrumbs (optional, but good)
        ancestors = []
        parent = self.parent
        while parent:
            ancestors.insert(0, parent)  # Add to the *beginning* of the list
            parent = parent.parent
        return ancestors


class Product(models.Model):
    CONDITION_CHOICES = (
        ('New', 'New'),
        ('Used', 'Used'),
    )

    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.PositiveIntegerField(default=0)
    is_available = models.BooleanField(default=True)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='products')
    seller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='products')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    condition = models.CharField(max_length=4, choices=CONDITION_CHOICES, default='New')
    
    # Location data
    location_name = models.CharField(max_length=255, null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    weight_kg = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('1.00'))
    size = models.CharField(
        max_length=20,
        choices=[
            ('small', 'Small'),
            ('medium', 'Medium'),
            ('large', 'Large'),
            ('oversized', 'Oversized'),
        ],
        default='small'
    )

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            base = slugify(self.name) or "product"
            self.slug = base
        # Auto-set availability based on stock - FIX: M-03
        if self.stock <= 0:
            self.is_available = False
        elif not self.is_available and self.stock > 0:
            self.is_available = True

        from django.db import IntegrityError, transaction
        try:
            with transaction.atomic():
                super().save(*args, **kwargs)
        except IntegrityError:
            from django.utils.text import slugify
            base = slugify(self.name) or "product"
            n = 1
            while True:
                self.slug = f'{base}-{n}'
                try:
                    with transaction.atomic():
                        super().save(*args, **kwargs)
                    break
                except IntegrityError:
                    n += 1

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('product_detail', kwargs={'slug': self.slug})

    def average_rating(self):
        reviews = self.reviews.all()
        if reviews:
            return int(sum(r.rating for r in reviews) / len(reviews))
        return 0

    def get_first_image(self):
        first_image = self.images.first()
        return first_image.image if first_image else None

    def get_like_count(self):
        return self.likes.count()

    @property
    def is_verified(self):
        """Returns True if there is at least one published inspection report with a 'pass' verdict."""
        if hasattr(self, 'annotated_is_verified'):
            return self.annotated_is_verified
        return self.inspections.filter(status='published', report__verdict='pass').exists()


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='product_images/', validators=[validate_image])  # FIX D-06

    def __str__(self):
        return f"Image for {self.product.name}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and self.image:
            convert_and_save_image(self, 'image')


class Review(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    order = models.ForeignKey('Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='linked_reviews')
    rating = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    approved = models.BooleanField(default=True)

    class Meta:
        unique_together = ('user', 'product')  # One review per user per product

    def __str__(self):
        return f"Review by {self.user.username} for {self.product.name}"


class ProductComment(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    body = models.TextField()
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    created_at = models.DateTimeField(auto_now_add=True)
    likes_count = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"Comment by {self.user.username}"


def generate_delivery_code():
    return str(secrets.randbelow(900000) + 100000)

class Order(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    order_date = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_completed = models.BooleanField(default=False)
    delivery_code = models.CharField(max_length=6, default=generate_delivery_code, blank=True, null=True)

    STATUS_CHOICES = (
        ('CART', 'Cart'),
        ('CHECKOUT', 'Checkout'),
        ('AWAITING_PAYMENT', 'Awaiting Payment'),
        ('PENDING_VERIFICATION', 'Pending Verification'),
        ('PAID', 'Paid'),
        ('PAID_PRODUCT', 'Paid Product'),
        ('SELLER_CONFIRMED', 'Seller Confirmed'),
        ('PREPARING', 'Preparing'),
        ('PACKAGING', 'Packaging'),
        ('SHIPPED_TO_WAREHOUSE', 'Shipped To Warehouse'),
        ('RECEIVED_AT_WAREHOUSE', 'Received At Warehouse'),
        ('AWAITING_DELIVERY_PAYMENT', 'Awaiting Delivery Payment'),
        ('PENDING_DELIVERY_VERIFICATION', 'Pending Delivery Verification'),
        ('ASSIGNED_TRANSPORT', 'Assigned Transport'),
        ('IN_TRANSIT', 'In Transit'),
        ('ARRIVED_AT_REGIONAL_WAREHOUSE', 'Arrived At Regional Warehouse'),
        ('READY_FOR_PICKUP', 'Ready For Pickup'),
        ('READY_FOR_VEHICLE_HANDOVER', 'Ready For Vehicle Handover'),
        ('PROCESSING', 'Processing'),
        ('SHIPPED', 'Shipped'),
        ('OUT_FOR_DELIVERY', 'Out For Delivery'),
        ('DELIVERED', 'Delivered'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
        ('FAILED_DELIVERY', 'Failed Delivery'),
        ('EXPIRED', 'Expired'),
        ('DISPUTED', 'Disputed'),
    )
    SHIPPING_CHOICES = (
        ('PICKUP', 'Physical Pickup'),
        ('DELIVERY', 'Home Delivery'),
    )
    status = models.CharField(max_length=40, choices=STATUS_CHOICES, default='CART')
    shipping_method = models.CharField(max_length=15, choices=SHIPPING_CHOICES, default='DELIVERY')
    shipping_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    delivery_info = models.JSONField(null=True, blank=True, default=dict)  # FIX: L-02 — store buyer's name/phone/address
    delivery_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    delivery_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    def __str__(self):
        return f"Order #{self.id} by {self.user.username}"

    def get_absolute_url(self):
        return reverse('order_detail', args=[str(self.id)])

    def update_total(self):
        # FIX: C-05 — use item.price (locked at order time), not item.product.price (live)
        total = sum(item.quantity * item.price for item in self.orderitem_set.all())
        self.total_amount = total + self.shipping_fee
        self.save(update_fields=['total_amount'])


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='orderitem_set')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    variant = models.ForeignKey(  # FIX B-16
        'ProductVariant', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='order_items'
    )
    quantity = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.quantity} of {self.product.name} in Order #{self.order.id}"

    def subtotal(self):
        return self.quantity * self.price


class TrackingEvent(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='timeline_events')
    status = models.CharField(max_length=30)
    visible_to_customer = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Tracking {self.order.id} -> {self.status}"


class Payment(models.Model):
    AUTHORITY_CHOICES = [
        ('ADMIN', 'Admin'),
        ('STORE', 'Store'),
    ]
    STATUS_CHOICES = [
        ('PENDING_VERIFICATION', 'Pending Verification'),
        ('VERIFIED', 'Verified'),
        ('REJECTED', 'Rejected'),
    ]
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments', null=True, blank=True)
    verification_authority = models.CharField(max_length=10, choices=AUTHORITY_CHOICES, default='STORE')
    payment_method = models.CharField(max_length=50, default='OFFLINE')
    proof_image = models.ImageField(upload_to='payment_proofs/', blank=True, null=True)
    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='PENDING_VERIFICATION')
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment {self.id} for Order #{self.order_id if self.order else 'Sub'} ({self.status})"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    is_verified = models.BooleanField(default=False, db_index=True)
    phone_number = models.CharField(max_length=20, blank=True, validators=[RegexValidator(r'^\+?1?\d{9,15}$', message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed.")])
    instagram_username = models.CharField(max_length=30, blank=True)
    website = models.URLField(blank=True)
    bio = models.TextField(blank=True, null=True)
    tier = models.CharField(
        max_length=20,
        choices=[('customer', 'Customer'), ('seller_pro', 'Seller Pro'), ('business', 'Business')],
        default='customer'
    )
    location = models.CharField(max_length=100, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_location_verified = models.BooleanField(default=False)
    profile_picture = models.ImageField(upload_to='profile_pictures/', blank=True, null=True, validators=[validate_image])  # FIX D-06
    banner_image = models.ImageField(upload_to='profile_banners/', blank=True, null=True, validators=[validate_image])  # FIX D-06
    date_of_birth = models.DateField(null=True, blank=True)
    preferred_currency = models.CharField(  # FIX B-23
        max_length=3,
        choices=[('TZS', 'Tanzanian Shilling'), ('USD', 'US Dollar')],
        default='TZS'
    )
    # FIX: S-12 — removed conflicting M2M field; Use Follow model for following relationships

    def __str__(self):
        return self.user.username

    def get_followers_count(self):
        # FIX: S-12 — Follow.following reverse accessor
        return self.followers.count()

    def get_following_count(self):
        # FIX: S-12
        from .models import Follow
        return Follow.objects.filter(follower=self.user).count()

    @property
    def seller_rating(self):
        """FIX B-14: aggregate rating from approved reviews on seller's products."""
        from .models import Review
        result = Review.objects.filter(
            product__seller=self.user, approved=True
        ).aggregate(avg=Avg('rating'), count=Count('id'))
        return {
            'average': round(float(result['avg'] or 0), 1),
            'count': result['count'],
        }


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if kwargs.get('raw'):
        return
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if kwargs.get('raw'):
        return
    if hasattr(instance, 'profile'):
        instance.profile.save()


@receiver(post_save, sender=PaymentConfirmation)
def activate_subscription_on_payment_approval(sender, instance, **kwargs):
    """FIX: S-11 — Activate subscription when payment confirmation is approved."""
    if instance.status.lower() == 'approved':
        from datetime import timedelta
        # Get the latest subscription or create a new one
        sub = Subscription.objects.filter(user=instance.user).order_by('-start_date').first()
        if not sub:
            sub = Subscription(user=instance.user)
            
        sub.tier = instance.tier
        sub.is_active = True
        sub.start_date = timezone.now()
        sub.end_date = timezone.now() + timedelta(days=instance.tier.duration)
        sub.save()
        # Sync UserProfile tier
        try:
            profile = instance.user.profile
            if instance.tier:
                profile.tier = instance.tier.tier_level
                if instance.tier.tier_level in ['seller_pro', 'business']:
                    profile.is_verified = True
            profile.save(update_fields=['tier', 'is_verified'])
        except UserProfile.DoesNotExist:
            pass


# --- Sidebar Models ---

class SidebarOffer(models.Model):
    title = models.CharField(max_length=100)
    description = models.TextField()
    image = models.ImageField(upload_to='sidebar_offers/', blank=True, null=True)
    link = models.URLField(blank=True)  # Link to a product page, category, or external site
    active = models.BooleanField(default=True)  # to show or hide
    button_text = models.CharField(
        max_length=50,
        default="Learn More",
        help_text="Custom text for the offer button"
    )
    VISIBILITY_CHOICES = [
        ('public', 'Public'),
        ('subscribed', 'Subscribed'),
    ]
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default='public')

    def __str__(self):
        return self.title


class SidebarNewsItem(models.Model):
    title = models.CharField(max_length=200)
    content = models.TextField()
    pub_date = models.DateTimeField(auto_now_add=True)
    link = models.URLField(blank=True)  # Link to readmore.
    active = models.BooleanField(default=True)
    image = models.ImageField(upload_to='sidebar_news/', blank=True, null=True)

    class Meta:
        ordering = ['-pub_date']  # Show recent first.
        verbose_name_plural = "Sidebar News Items"

    def __str__(self):
        return self.title


# --- Newsletter Subscription ---
class NewsletterSubscription(models.Model):
    email = models.EmailField()  # FIX: S-13 — removed unique=True; unique_together handles per-category uniqueness
    category = models.ForeignKey(Category, on_delete=models.CASCADE, null=True, blank=True)  # Allow no specific category
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('email', 'category')  # Prevent duplicate subscription per category

    def __str__(self):
        if self.category:
            return f"{self.email} (Category: {self.category.name})"
        return f"{self.email} (All Categories)"


# --- Follow Model ---
class Follow(models.Model):
    follower = models.ForeignKey(User, related_name='following', on_delete=models.CASCADE)
    following = models.ForeignKey(UserProfile, related_name='followers', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('follower', 'following')  # Prevent duplicate follows
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.follower.username} follows {self.following.user.username}'


# --- Like Model ---
class Like(models.Model):
    user = models.ForeignKey(User, related_name='likes', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, related_name='likes', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'product')  # Prevent duplicate likes
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username} likes {self.product.name}'


# --- Sponsored Listing ---
class SponsoredListing(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('expired', 'Expired'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sponsored_listings')
    product = models.ForeignKey('Product', on_delete=models.CASCADE, related_name='sponsored_campaigns')
    title = models.CharField(max_length=200, blank=True, null=True, help_text="Short, catchy title for the ad")
    description = models.TextField(blank=True, null=True, help_text="Why should buyers check this out?")
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    admin_notes = models.TextField(blank=True, null=True, help_text="Reason for rejection, or notes for the seller")
    duration_days = models.PositiveIntegerField(default=7, help_text="Duration of the promotion in days")
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Cost of the promotion")
    transaction_reference = models.CharField(max_length=100, blank=True, null=True, help_text="Transaction reference code")
    payment_proof = models.ImageField(upload_to='promotion_proofs/', blank=True, null=True, help_text="Screenshot proof of payment")
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.title or 'Untitled'} - {self.product.name} ({self.status})"


# --- Support Models ---
class FAQ(models.Model):
    question = models.CharField(max_length=500)
    answer = models.TextField()
    category = models.CharField(max_length=50, choices=[
        ('orders', 'Orders'), ('payments', 'Payments'),
        ('inspections', 'Inspections'), ('account', 'Account'),
        ('general', 'General')
    ], default='general')
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['category', 'order']

class SupportTicket(models.Model):
    STATUS_CHOICES = [('open','Open'),('in_progress','In Progress'),('resolved','Resolved'),('closed','Closed')]
    CATEGORY_CHOICES = [('order_issue','Order Issue'),('payment_issue','Payment Issue'),
                        ('account_issue','Account Issue'),('inspection_issue','Inspection Issue'),
                        ('bug_report','Bug Report'),('other','Other')]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='support_tickets', null=True, blank=True)
    name = models.CharField(max_length=100)
    email = models.EmailField()
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    subject = models.CharField(max_length=255)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='assigned_tickets')
    staff_notes = models.TextField(blank=True)
    staff_reply = models.TextField(blank=True, help_text="Response visible to the ticket creator")
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']


# ─── Notification System (B-11) ──────────────────────────────────
class Notification(models.Model):
    TYPE_CHOICES = [
        ('order_status', 'Order Status Change'),
        ('payment_verified', 'Payment Verified'),
        ('new_follower', 'New Follower'),
        ('new_review', 'New Review on Your Product'),
        ('review_approved', 'Your Review Was Approved'),
        ('new_message', 'New Message'),
        ('inspection_update', 'Inspection Update'),
        ('sponsored_approved', 'Promotion Approved'),
        ('sponsored_expired', 'Promotion Expired'),
        ('low_stock', 'Low Stock Alert'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    link = models.CharField(max_length=255, blank=True, help_text='Frontend route e.g. /orders?highlight=42')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username}: {self.title}'



def push_notification(user, notification_type, title, message, link=''):
    """FIX B-11: Helper to create a notification and broadcast via WebSocket."""
    n = Notification.objects.create(
        user=user, notification_type=notification_type,
        title=title, message=message, link=link
    )
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync
    channel_layer = get_channel_layer()
    try:
        async_to_sync(channel_layer.group_send)(
            f'notifications_{user.id}',
            {'type': 'notification.push', 'notification': {
                'id': n.id, 'type': notification_type,
                'title': title, 'message': message, 'link': link,
            }}
        )
    except Exception as e:
        logger.warning(f'WS notification broadcast failed for user {user.id}: {e}')  # FIX MED-05
    return n


# ─── Messaging System (B-12) ─────────────────────────────────────
class Conversation(models.Model):
    buyer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='buyer_conversations')
    seller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='seller_conversations')
    product = models.ForeignKey('Product', on_delete=models.SET_NULL, null=True, blank=True, related_name='conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('buyer', 'seller', 'product')
        ordering = ['-updated_at']

    def __str__(self):
        return f'{self.buyer.username} ↔ {self.seller.username}'


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender.username}: {self.content[:50]}'


# ─── Saved Searches & Price Alerts (B-13) ────────────────────────
class SavedSearch(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_searches')
    query = models.CharField(max_length=255, blank=True)
    category = models.ForeignKey('Category', on_delete=models.SET_NULL, null=True, blank=True)
    min_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    max_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    condition = models.CharField(max_length=20, blank=True)
    notify_on_match = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_checked = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class PriceAlert(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='price_alerts')
    product = models.ForeignKey('Product', on_delete=models.CASCADE, related_name='price_alerts')
    target_price = models.DecimalField(max_digits=12, decimal_places=2)
    is_active = models.BooleanField(default=True)
    triggered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'product')


# ─── Dispute System (B-15) ───────────────────────────────────────
class Dispute(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('under_review', 'Under Review'),
        ('resolved_buyer', 'Resolved — Favour Buyer'),
        ('resolved_seller', 'Resolved — Favour Seller'),
        ('closed', 'Closed'),
    ]
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='dispute')
    opened_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='opened_disputes')
    reason = models.TextField()
    evidence_description = models.TextField(blank=True)
    evidence_image = models.ImageField(upload_to='dispute_evidence/', blank=True, null=True, validators=[validate_image])
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    assigned_staff = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_disputes')
    resolution_notes = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Dispute on {self.order.id} ({self.status})'


# ─── Product Variants (B-16) ─────────────────────────────────────
class ProductVariant(models.Model):
    product = models.ForeignKey('Product', on_delete=models.CASCADE, related_name='variants')
    name = models.CharField(max_length=100, help_text='e.g. "Red / XL" or "128GB Black"')
    sku = models.CharField(max_length=50, blank=True)
    price_adjustment = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text='Added to base product price. Can be negative.'
    )
    stock = models.PositiveIntegerField(default=0)
    is_available = models.BooleanField(default=True)
    image = models.ImageField(upload_to='variant_images/', blank=True, null=True, validators=[validate_image])

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and self.image:
            convert_and_save_image(self, 'image')

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.product.name} — {self.name}'

    @property
    def final_price(self):
        return self.product.price + self.price_adjustment


# ─── Site Settings (B-18) ────────────────────────────────────────
class SiteSettings(models.Model):
    """Singleton model — only one row. Edit via Django admin."""
    company_name = models.CharField(max_length=100, default='SokoniMax')
    tagline = models.CharField(max_length=255, blank=True)
    support_email = models.EmailField(blank=True)
    support_phone = models.CharField(max_length=30, blank=True)
    whatsapp_number = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    facebook_url = models.URLField(blank=True)
    instagram_url = models.URLField(blank=True)
    twitter_url = models.URLField(blank=True)
    working_hours = models.CharField(max_length=100, blank=True, default='Mon–Fri 8am–6pm EAT')
    commission_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('10.00'),
        help_text="Default platform commission % charged to sellers"
    )
    driver_payout_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('70.00'),
        help_text="Percentage of an order's shipping fee paid out to the delivering driver for standard (non-vehicle) deliveries."
    )

    class Meta:
        verbose_name = 'Site Settings'
        verbose_name_plural = 'Site Settings'

    def save(self, *args, **kwargs):
        self.pk = 1  # Force singleton
        super().save(*args, **kwargs)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return 'Site Settings'


# ─── Delivery Zones (B-21) ───────────────────────────────────────
class DeliveryZone(models.Model):
    seller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='delivery_zones')
    zone_name = models.CharField(max_length=100, help_text='e.g. "Dar es Salaam", "Upcountry"')
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    estimated_days = models.CharField(max_length=50, blank=True, help_text='e.g. "1–2 days"')
    is_active = models.BooleanField(default=True)
    notes = models.CharField(max_length=255, blank=True, help_text='Additional info shown to buyer')

    class Meta:
        ordering = ['delivery_fee']
        unique_together = ('seller', 'zone_name')

    def __str__(self):
        return f'{self.seller.username}: {self.zone_name} — TSh {self.delivery_fee}'


# ─── Seller Upgrade Applications ───────────────────────────────
class SellerApplication(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='seller_applications')
    requested_tier = models.ForeignKey(SubscriptionTier, on_delete=models.PROTECT)
    business_name = models.CharField(max_length=150)
    business_registration_number = models.CharField(
        max_length=50, blank=True,
        help_text="BRELA registration number or business license number"
    )
    tin_number = models.CharField(max_length=30, blank=True,
        help_text="Tanzania Revenue Authority TIN number")
    business_address = models.TextField(blank=True)
    business_region = models.CharField(max_length=100, blank=True)
    id_document = models.FileField(upload_to='seller_applications/id/', validators=[validate_document])
    business_document = models.FileField(upload_to='seller_applications/business/', blank=True, null=True, validators=[validate_document])
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_seller_applications')
    rejection_reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.business_name} ({self.status})"


@receiver(post_save, sender=SellerApplication)
def handle_seller_application_status_change(sender, instance, **kwargs):
    if kwargs.get('raw'):
        return
    if instance.status == 'approved':
        from datetime import timedelta
        sub, _ = Subscription.objects.get_or_create(
            user=instance.user,
            defaults={'tier': instance.requested_tier}
        )
        sub.tier = instance.requested_tier
        sub.is_active = True
        sub.start_date = timezone.now()
        sub.end_date = timezone.now() + timedelta(days=instance.requested_tier.duration)
        sub.save()

        # Sync UserProfile tier
        try:
            profile = instance.user.profile
            profile.tier = instance.requested_tier.tier_level
            if instance.requested_tier.tier_level in ['seller_pro', 'business']:
                profile.is_verified = True
            profile.save(update_fields=['tier', 'is_verified'])
        except UserProfile.DoesNotExist:
            pass

        push_notification(
            instance.user,
            'subscription_approved',
            'Seller Upgrade Approved',
            f'Your application for {instance.requested_tier.name} has been approved!',
            link='/upgrade'
        )

    elif instance.status == 'rejected':
        push_notification(
            instance.user,
            'subscription_rejected',
            'Seller Upgrade Rejected',
            f'Your application for {instance.requested_tier.name} was rejected. Reason: {instance.rejection_reason or "No reason provided."}',
            link='/upgrade'
        )


# --- Cache Invalidation Signals ---
from django.core.cache import cache

@receiver(post_save, sender=Product)
@receiver(post_delete, sender=Product)
def invalidate_product_cache(sender, instance, **kwargs):
    # Targeted view cache invalidation; leaves sessions intact
    if hasattr(cache, 'delete_pattern'):
        try:
            cache.delete_pattern("*views.decorators.cache*")
            cache.delete_pattern(f"*product:{instance.slug}*")
        except Exception:
            cache.clear()
    else:
        cache.clear()

@receiver(post_save, sender=Category)
@receiver(post_delete, sender=Category)
def invalidate_category_cache(sender, instance, **kwargs):
    if hasattr(cache, 'delete_pattern'):
        try:
            cache.delete_pattern("*views.decorators.cache*")
        except Exception:
            cache.clear()
    else:
        cache.clear()


class TeamMember(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='team_members')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='team_memberships')
    permissions = models.JSONField(default=dict, help_text="JSON representation of permissions, e.g. {'manage_orders': true, 'manage_products': true}")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('owner', 'user')

    def __str__(self):
        return f"{self.user.username} in {self.owner.username}'s team"


class StoreImage(models.Model):
    profile = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='store_images')
    image = models.ImageField(upload_to='store_pictures/', validators=[validate_image])
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['uploaded_at']

    def __str__(self):
        return f"Store image for {self.profile.user.username} ({self.id})"


