from django.db import models
from django.db.models import Avg
from django.urls import reverse
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from django.contrib.auth.models import User
from django.conf import settings
from django.utils import timezone
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.text import slugify


class SubscriptionTier(models.Model):
    name = models.CharField(max_length=50, unique=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    benefits = models.TextField(help_text="Comma-separated list or HTML for display")
    duration = models.PositiveIntegerField(help_text="Duration in days")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.price})"


class MobileNetwork(models.Model):
    name = models.CharField(max_length=50, unique=True)
    image = models.ImageField(upload_to='mobile-networks/')

    def __str__(self):
        return self.name


class LipaNumber(models.Model):
    network = models.ForeignKey(MobileNetwork, related_name='lipa_numbers', on_delete=models.CASCADE)
    number = models.CharField(max_length=30)
    name = models.CharField(max_length=50, help_text="Account or payee name")

    def __str__(self):
        return f"{self.network.name}: {self.number} ({self.name})"


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
    proof = models.ImageField(upload_to='payment_proofs/', blank=True, null=True)
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

    def save(self, *args, **kwargs):
        if not self.slug:  # FIX: C-09 — collision-safe slug generation
            from django.utils.text import slugify
            base = slugify(self.name)
            slug, n = base, 1
            while Category.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f'{base}-{n}'
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)

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

    def save(self, *args, **kwargs):
        if not self.slug:  # FIX: C-09 — collision-safe slug generation
            from django.utils.text import slugify
            base = slugify(self.name)
            slug, n = base, 1
            while Product.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f'{base}-{n}'
                n += 1
            self.slug = slug
        # Auto-set availability based on stock - FIX: M-03
        if self.stock <= 0:
            self.is_available = False
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('product_detail', kwargs={'slug': self.slug})

    # Use a regular method, *not* a property, for compatibility with annotation
    def average_rating(self):
        reviews = self.reviews.all()
        if reviews:
            return int(reviews.aggregate(Avg('rating'))['rating__avg'])
        return 0

    def get_first_image(self):
        first_image = self.images.first()
        return first_image.image if first_image else None

    def get_like_count(self):
        return self.likes.count()

    @property
    def is_verified(self):
        """Returns True if there is at least one published inspection report with a 'pass' verdict."""
        return self.inspections.filter(status='published', report__verdict='pass').exists()


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='product_images/')

    def __str__(self):
        return f"Image for {self.product.name}"


class Review(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    order = models.ForeignKey('Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='linked_reviews')
    rating = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    approved = models.BooleanField(default=False)

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


class Order(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    order_date = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_completed = models.BooleanField(default=False)

    STATUS_CHOICES = (
        ('CART', 'Cart'),
        ('CHECKOUT', 'Checkout'),
        ('AWAITING_PAYMENT', 'Awaiting Payment'),
        ('PENDING_VERIFICATION', 'Pending Verification'),
        ('PAID', 'Paid'),
        ('PROCESSING', 'Processing'),
        ('SHIPPED', 'Shipped'),
        ('DELIVERED', 'Delivered'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
        ('EXPIRED', 'Expired'),
    )
    SHIPPING_CHOICES = (
        ('PICKUP', 'Physical Pickup'),
        ('DELIVERY', 'Home Delivery'),
    )
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='CART')
    shipping_method = models.CharField(max_length=15, choices=SHIPPING_CHOICES, default='DELIVERY')
    shipping_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    delivery_info = models.JSONField(null=True, blank=True, default=dict)  # FIX: L-02 — store buyer's name/phone/address

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
    tier = models.CharField(max_length=20, choices=[('standard', 'Standard'), ('premium', 'Premium')], default='standard')
    location = models.CharField(max_length=100, blank=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', blank=True, null=True)
    banner_image = models.ImageField(upload_to='profile_banners/', blank=True, null=True)
    date_of_birth = models.DateField(null=True, blank=True)
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


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()


@receiver(post_save, sender=PaymentConfirmation)
def activate_subscription_on_payment_approval(sender, instance, **kwargs):
    """FIX: S-11 — Activate subscription when payment confirmation is approved."""
    if instance.status == 'approved':
        from datetime import timedelta
        sub, _ = Subscription.objects.get_or_create(
            user=instance.user,
            defaults={'tier': instance.tier}
        )
        sub.tier = instance.tier
        sub.is_active = True
        sub.start_date = timezone.now()
        sub.end_date = timezone.now() + timedelta(days=instance.tier.duration)
        sub.save()
        # Sync UserProfile tier - FIX: handle tier as string properly
        try:
            profile = instance.user.profile
            # tier is a SubscriptionTier object, map to profile tier string
            if instance.tier:
                profile.tier = 'premium'
            else:
                profile.tier = 'standard'
            profile.save(update_fields=['tier'])
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
    title = models.CharField(max_length=200, help_text="Short, catchy title for the ad")
    description = models.TextField(help_text="Why should buyers check this out?")
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    admin_notes = models.TextField(blank=True, null=True, help_text="Reason for rejection, or notes for the seller")
    duration_days = models.PositiveIntegerField(default=7, help_text="Duration of the promotion in days")
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Cost of the promotion")
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.title} - {self.product.name} ({self.status})"
