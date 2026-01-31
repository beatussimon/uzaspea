from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import UserProfile, Product, Category, Review, Order, OrderItem, SidebarOffer, SidebarNewsItem, Subscription, Like, Follow, ProductImage
from django.utils.html import format_html

# Unregister the default User admin to avoid AlreadyRegistered exception
admin.site.unregister(User)

class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Profile'
    fields = ('phone_number', 'is_verified', 'tier', 'profile_picture', 'bio', 'location', 'instagram_username', 'website')
    readonly_fields = ('image_preview',)

    def image_preview(self, obj):
        if obj.profile_picture:
            return format_html('<img src="{}" width="150" height="auto" />', obj.profile_picture.url)
        return "No Image"
    image_preview.short_description = 'Profile Picture Preview'

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'get_is_verified', 'date_joined')
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'profile__is_verified')
    search_fields = ('username', 'email', 'first_name', 'last_name', 'userprofile__phone_number')
    ordering = ('username',)
    readonly_fields = ('last_login', 'date_joined')

    def get_is_verified(self, obj):
        return obj.profile.is_verified
    get_is_verified.short_description = 'Verified'
    get_is_verified.boolean = True  # Displays as a green checkmark or red cross in the admin

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    readonly_fields = ('image_preview',)

    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" width="100" height="auto" />', obj.image.url)
        return "No Image"
    image_preview.short_description = 'Image Preview'

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    raw_id_fields = ('product',)
    readonly_fields = ('subtotal', 'product_name', 'product_price', 'product_image')

    def product_name(self, obj):
        return obj.product.name
    product_name.short_description = 'Product Name'

    def product_price(self, obj):
        return obj.product.price
    product_price.short_description = 'Price'

    def product_image(self, obj):
        first_image = obj.product.get_first_image()
        if first_image:
            return format_html('<img src="{}" width="50" height="auto" />', first_image.url)
        return "No Image"
    product_image.short_description = 'Image'

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'price', 'stock', 'category', 'seller', 'is_available', 'condition', 'created_at',
                    'updated_at', 'image_preview')
    list_filter = ('is_available', 'category', 'seller', 'condition', 'created_at')
    search_fields = ('name', 'description', 'seller__username', 'category__name',
                     'category__parent__name')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('created_at', 'updated_at', 'image_preview')
    raw_id_fields = ('seller', 'category')
    inlines = [ProductImageInline]
    list_per_page = 20

    def image_preview(self, obj):
        first_image = obj.product.get_first_image()
        if first_image:
            return format_html('<img src="{}" width="50" height="auto" />', first_image.url)
        return 'No Image'

    image_preview.short_description = 'Image'
    fieldsets = (
        (None, {
            'fields': ('name', 'slug', 'description', 'price', 'stock', 'category', 'seller', 'is_available', 'condition')
        }),
        ('Advanced options', {
            'classes': ('collapse',),
            'fields': ('created_at', 'updated_at'),
        }),
    )

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'parent', 'description')
    list_filter = ('parent',)
    search_fields = ('name', 'description', 'parent__name')
    prepopulated_fields = {'slug': ('name',)}
    raw_id_fields = ('parent',)
    list_per_page = 20

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('product', 'user', 'rating', 'created_at', 'parent', 'approved')
    list_filter = ('product', 'user', 'rating', 'approved', 'created_at')
    search_fields = ('product__name', 'user__username', 'comment')
    raw_id_fields = ('product', 'user', 'parent')
    actions = ['approve_reviews']
    list_per_page = 20

    def approve_reviews(self, request, queryset):
        queryset.update(approved=True)
    approve_reviews.short_description = "Mark selected reviews as approved"

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'order_date', 'total_amount', 'status', 'is_completed', 'shipping_address_display')
    list_filter = ('user', 'order_date', 'status', 'is_completed')
    search_fields = ('user__username', 'id', 'shipping_address__address_line_1', 'shipping_address__city')
    readonly_fields = ('order_date', 'total_amount')
    raw_id_fields = ('user',)
    inlines = [OrderItemInline]
    list_per_page = 20
    fieldsets = (
        (None, {
            'fields': ('user', 'order_date', 'status', 'is_completed', 'total_amount')
        }),
        ('Shipping Address', {
            'fields': ('shipping_address',)
        }),
    )

    def shipping_address_display(self, obj):
        if obj.shipping_address:
            return f"{obj.shipping_address.address_line_1}, {obj.shipping_address.city}"
        return "-"
    shipping_address_display.short_description = 'Shipping Address'

@admin.register(SidebarOffer)
class SidebarOfferAdmin(admin.ModelAdmin):
    list_display = ('title', 'active', 'link', 'image_preview')
    list_filter = ('active',)
    search_fields = ('title', 'description')
    readonly_fields = ('image_preview',)

    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" width="100" height="auto" />', obj.image.url)
        return "No Image"
    image_preview.short_description = 'Image Preview'

@admin.register(SidebarNewsItem)
class SidebarNewsItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'pub_date', 'active', 'image_preview')
    list_filter = ('pub_date', 'active')
    search_fields = ('title', 'content')
    readonly_fields = ('pub_date', 'image_preview')

    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" width="100" height="auto" />', obj.image.url)
        return "No Image"
    image_preview.short_description = 'Image Preview'

@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('email', 'category', 'created_at')
    list_filter = ('category', 'created_at')
    search_fields = ('email', 'category__name')
    readonly_fields = ('created_at',)

@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ('user', 'product', 'created_at')
    list_filter = ('user', 'product', 'created_at')
    search_fields = ('user__username', 'product__name')
    raw_id_fields = ('user', 'product')

@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ('follower', 'following', 'created_at')
    list_filter = ('follower', 'following', 'created_at')
    search_fields = ('follower__username', 'following__username')
    raw_id_fields = ('follower', 'following')