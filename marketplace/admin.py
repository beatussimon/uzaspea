from django.contrib import admin
from .models import Product, Category, Review, Order, OrderItem, UserProfile, ProductImage, SidebarOffer, SidebarNewsItem, Subscription
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User

# --- User and Profile Admin ---

admin.site.unregister(User)  # Unregister default User admin

class UserProfileInline(admin.StackedInline):  # Use StackedInline for a more spacious layout
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Profile'
    # Make phone number and verification stand out.
    fields = ('phone_number', 'is_verified', 'instagram_username', 'website')


@admin.register(User)  # Use the decorator for User as well
class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'is_verified')
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'profile__is_verified')  # Filter by verified status!
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('username',)  # Consistent ordering

    def is_verified(self, obj):
        return obj.profile.is_verified
    is_verified.boolean = True
    is_verified.short_description = 'Verified'

# --- Product and Category Admin ---

# Define inlines *before* using them
class ProductImageInline(admin.TabularInline):  # Or StackedInline - choose your preference
    model = ProductImage
    extra = 1  # How many extra image slots to show at a time
    # Add a nice preview of the images:
    readonly_fields = ('image_preview',)

    def image_preview(self, obj):
        from django.utils.html import mark_safe
        if obj.image:
            return mark_safe(f'<img src="{obj.image.url}" width="150" height="auto" />')
        return "No Image"

class OrderItemInline(admin.TabularInline):  # Or StackedInline
    model = OrderItem
    extra = 0 # No extra empty forms by default.
    raw_id_fields = ('product',) # Avoid dropdown with 1000s of products.
    readonly_fields = ('subtotal',)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'price', 'stock', 'category', 'seller', 'is_available', 'condition', 'created_at', 'updated_at')
    list_filter = ('is_available', 'category', 'seller', 'condition')  # Added condition
    search_fields = ('name', 'description', 'seller__username', 'category__name', 'category__parent__name') # Include parent
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('created_at', 'updated_at')  # Make these read-only
    # Use raw_id_fields for better performance with many users/categories
    raw_id_fields = ('seller', 'category')
    # Add inlines for a better user experience.
    inlines = [ProductImageInline]


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'parent', 'description') # Include parent
    list_filter = ('parent',)  # Filter by parent category
    search_fields = ('name', 'description', 'parent__name')
    prepopulated_fields = {'slug': ('name',)}
    raw_id_fields = ('parent',) # Good practice

# --- Review, Order, OrderItem Admin (Basic, but functional) ---

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('product', 'user', 'rating', 'created_at', 'parent')
    list_filter = ('product', 'user', 'rating')
    search_fields = ('product__name', 'user__username', 'comment')
    raw_id_fields = ('product', 'user', 'parent')

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'order_date', 'total_amount', 'status')
    list_filter = ('user', 'order_date', 'is_completed', 'status')
    search_fields = ('user__username', 'id')
    readonly_fields = ('order_date', 'total_amount') # Read only.
    raw_id_fields = ('user',)
    # Show order items inline for easier management
    inlines = [OrderItemInline]

# --- Sidebar Content Admin ---
@admin.register(SidebarOffer)
class SidebarOfferAdmin(admin.ModelAdmin):
    list_display = ('title', 'active', 'link')
    list_filter = ('active',)
    search_fields = ('title', 'description')

@admin.register(SidebarNewsItem)
class SidebarNewsItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'pub_date', 'active')
    list_filter = ('pub_date', 'active')
    search_fields = ('title', 'content')
    readonly_fields = ('pub_date',) # No need to edit pub_date

#---- Subscription ---
@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('email', 'category', 'created_at')
    list_filter = ('category', 'created_at')
    search_fields = ('email', 'category__name')
    readonly_fields = ('created_at',)  # Don't allow editing creation date