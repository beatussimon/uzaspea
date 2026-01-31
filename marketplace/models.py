from django.db import models
from django.contrib.auth.models import User
from django.urls import reverse
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from django.db.models import Avg
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.text import slugify


class Category(models.Model):
    def get_descendants(self, include_self=False):
        """
        Returns a queryset of all descendant categories (children, grandchildren, etc.).
        If include_self is True, includes the current category as well.
        """
        descendants = set()
        def add_children(cat):
            for child in cat.children.all():
                descendants.add(child)
                add_children(child)
        add_children(self)
        if include_self:
            descendants.add(self)
        return Category.objects.filter(id__in=[c.id for c in descendants])
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(unique=True, blank=True)
    description = models.TextField(blank=True)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')

    class Meta:
        verbose_name_plural = "Categories"

    def save(self, *args, **kwargs):
        from django.utils.text import slugify  # Import here
        if not self.slug:
            self.slug = slugify(self.name)
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
      from django.utils.text import slugify # Add this
      if not self.slug:
          self.slug = slugify(self.name)
      super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('product_detail', kwargs={'slug': self.slug})

    # Use a regular method, *not* a property, for compatibility with annotation
    def average_rating(self):
        reviews = self.reviews.all()
        if reviews:
          # Use the 'rating' field directly; aggregate returns a dictionary
          return int(reviews.aggregate(Avg('rating'))['rating__avg'])
        return 0

    def get_first_image(self):
        first_image = self.images.first()
        return first_image.image if first_image else None
    #Return like count
    def get_like_count(self):
        return self.likes.count()



class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='product_images/')

    def __str__(self):
        return f"Image for {self.product.name}"


class Review(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    rating = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    approved = models.BooleanField(default=False)  # Add this line

    def __str__(self):
        return f"Review by {self.user.username} for {self.product.name}"

class Order(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    order_date = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_completed = models.BooleanField(default=False)

    STATUS_CHOICES = (
        ('Pending', 'Pending'),
        ('Processing', 'Processing'),
        ('Shipped', 'Shipped'),
        ('Delivered', 'Delivered'),
        ('Cancelled', 'Cancelled'),
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')

    def __str__(self):
        return f"Order #{self.id} by {self.user.username}"

    def get_absolute_url(self):
        return reverse('order_detail', args=[str(self.id)])

    def update_total(self):
        total = sum(item.quantity * item.product.price for item in self.orderitem_set.all())
        self.total_amount = total
        self.save()

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='orderitem_set')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.quantity} of {self.product.name} in Order #{self.order.id}"

    def subtotal(self):
        return self.quantity * self.price

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    is_verified = models.BooleanField(default=False, db_index=True)  # Add db_index=True!
    phone_number = models.CharField(max_length=20, blank=True, validators=[RegexValidator(r'^\+?1?\d{9,15}$', message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed.")]) #added a validator
    instagram_username = models.CharField(max_length=30, blank=True)
    website = models.URLField(blank=True)
    bio = models.TextField(blank=True, null=True)
    tier = models.CharField(max_length=20, choices=[('standard', 'Standard'), ('premium', 'Premium')], default='standard')
    location = models.CharField(max_length=100, blank=True)  # Add location
    profile_picture = models.ImageField(upload_to='profile_pictures/', blank=True, null=True)
    following = models.ManyToManyField(User, related_name='followers', blank=True, symmetrical=False) # Add following

    def __str__(self):
        return self.user.username
    def get_followers_count(self):
        return self.user.followers.count()

    def get_following_count(self):
        return self.user.following.count()

@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
    instance.profile.save()

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
    link = models.URLField(blank=True) # Link to readmore.
    active = models.BooleanField(default = True)
    image = models.ImageField(upload_to='sidebar_news/', blank = True, null = True)


    class Meta:
        ordering = ['-pub_date'] # Show recent first.
        verbose_name_plural = "Sidebar News Items"

    def __str__(self):
        return self.title
# Model for subscriptions

class Subscription(models.Model):
    email = models.EmailField(unique=True)  # Ensure unique emails
    category = models.ForeignKey(Category, on_delete=models.CASCADE, null=True, blank=True) # Allow no specific category
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('email', 'category') # Prevent duplicate subscription
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
         unique_together = ('follower', 'following') #Prevent duplicate follows
         ordering = ['-created_at']


     def __str__(self):
         return f'{self.follower.username} follows {self.following.user.username}'

#Like model
class Like(models.Model):
     user = models.ForeignKey(User, related_name='likes', on_delete=models.CASCADE)
     product = models.ForeignKey(Product, related_name='likes', on_delete=models.CASCADE)
     created_at = models.DateTimeField(auto_now_add=True)

     class Meta:
         unique_together = ('user', 'product') # Prevent duplicate likes
         ordering = ['-created_at']

     def __str__(self):
         return f'{self.user.username} likes {self.product.name}'