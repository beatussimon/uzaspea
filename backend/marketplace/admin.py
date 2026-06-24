from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import (
    UserProfile, Product, Category, Review, Order, OrderItem,
    SidebarOffer, SidebarNewsItem, Subscription, NewsletterSubscription,
    Like, Follow, ProductImage, SubscriptionTier, MobileNetwork, LipaNumber,
    Notification, Conversation, Message, SavedSearch, PriceAlert,
    Dispute, ProductVariant, SiteSettings, DeliveryZone,
    SellerApplication, PaymentConfirmation, SupportTicket, TeamMember, StoreImage, FAQ
)
from django.utils.html import format_html

# Unregister the default User admin to avoid AlreadyRegistered exception
admin.site.unregister(User)

class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Profile'
    fields = ('phone_number', 'is_verified', 'tier', 'profile_picture', 'bio', 'location', 'instagram_username', 'website')
    readonly_fields = ('image_preview',)

    @admin.display(description="Image")
    def image_preview(self, obj):
        first_image = obj.get_first_image()  # <-- corrected: obj, not obj.product
        if first_image:
            return format_html('<img src="{}" width="50" height="auto" />', first_image.url)
        return "No Image"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'get_is_verified', 'date_joined')
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'profile__is_verified')
    search_fields = ('username', 'email', 'first_name', 'last_name', 'userprofile__phone_number')
    ordering = ('username',)
    readonly_fields = ('last_login', 'date_joined')

    @admin.display(boolean=True, description='Verified')
    def get_is_verified(self, obj):
        return obj.profile.is_verified

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    readonly_fields = ('image_preview',)

    @admin.display(description='Image Preview')
    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" width="100" height="auto" />', obj.image.url)
        return "No Image"

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    raw_id_fields = ('product',)
    readonly_fields = ('subtotal', 'product_name', 'product_price', 'product_image')

    @admin.display(description='Product Name')
    def product_name(self, obj):
        return obj.product.name

    @admin.display(description='Price')
    def product_price(self, obj):
        return obj.product.price

    @admin.display(description='Image')
    def product_image(self, obj):
        first_image = obj.product.get_first_image()
        if first_image:
            return format_html('<img src="{}" width="50" height="auto" />', first_image.url)
        return "No Image"


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

    @admin.display(description='Image')  # <-- replaces .short_description
    def image_preview(self, obj):
        first_image = obj.get_first_image()
        if first_image:
            return format_html('<img src="{}" width="50" height="auto" />', first_image.url)
        return 'No Image'


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
    list_display = ('product', 'user', 'rating', 'created_at', 'approved')
    list_filter = ('product', 'user', 'rating', 'approved', 'created_at')
    search_fields = ('product__name', 'user__username', 'comment')
    raw_id_fields = ('product', 'user')
    actions = ['approve_reviews']
    list_per_page = 20

    @admin.action(description="Mark selected reviews as approved")
    def approve_reviews(self, request, queryset):
        queryset.update(approved=True)

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'order_date', 'total_amount', 'status', 'is_completed')
    list_filter = ('user', 'order_date', 'status', 'is_completed')
    search_fields = ('user__username', 'id')
    readonly_fields = ('order_date', 'total_amount')
    raw_id_fields = ('user',)
    inlines = [OrderItemInline]
    list_per_page = 20
    fieldsets = (
        (None, {
            'fields': ('user', 'order_date', 'status', 'is_completed', 'total_amount')
        }),
    )

@admin.register(SidebarOffer)
class SidebarOfferAdmin(admin.ModelAdmin):
    list_display = ('title', 'active', 'link', 'image_preview')
    list_filter = ('active',)
    search_fields = ('title', 'description')
    readonly_fields = ('image_preview',)

    @admin.display(description='Image Preview')
    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" width="100" height="auto" />', obj.image.url)
        return "No Image"


@admin.register(SidebarNewsItem)
class SidebarNewsItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'pub_date', 'active', 'image_preview')
    list_filter = ('pub_date', 'active')
    search_fields = ('title', 'content')
    readonly_fields = ('pub_date', 'image_preview')

    @admin.display(description='Image Preview')
    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" width="100" height="auto" />', obj.image.url)
        return "No Image"


@admin.register(NewsletterSubscription)
class NewsletterSubscriptionAdmin(admin.ModelAdmin):
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

# --- Subscription & Payment Admin ---

class LipaNumberInline(admin.TabularInline):
    model = LipaNumber
    extra = 1

@admin.register(MobileNetwork)
class MobileNetworkAdmin(admin.ModelAdmin):
    list_display = ("name", "image_tag")
    inlines = [LipaNumberInline]
    readonly_fields = ("image_tag",)

    @admin.display(description="Image Preview")
    def image_tag(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="max-height:40px;max-width:80px;object-fit:contain;" />', 
                obj.image.url
            )
        return "-"


@admin.register(SubscriptionTier)
class SubscriptionTierAdmin(admin.ModelAdmin):
    list_display = ('name', 'tier_level', 'price', 'commission_rate', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name',)
    fieldsets = [
        ('Tier Info', {'fields': ['name', 'tier_level', 'is_active']}),
        ('Pricing', {'fields': ['price', 'commission_rate']}),
        ('Benefits', {'fields': ['benefits']}),
    ]

@admin.register(LipaNumber)
class LipaNumberAdmin(admin.ModelAdmin):
    list_display = ("network", "number")
    search_fields = ("number", "network__name")

# FIX v5: Register new models
@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    fieldsets = [
        ('Platform Identity', {'fields': ['company_name', 'tagline']}),
        ('Contact', {'fields': ['support_email', 'support_phone', 'whatsapp_number', 'address', 'working_hours']}),
        ('Social', {'fields': ['facebook_url', 'instagram_url', 'twitter_url']}),
        ('Business Rules', {'fields': ['commission_rate']}),
    ]
    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()  # Only one row allowed
    def has_delete_permission(self, request, obj=None):
        return False  # Singleton — never delete

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'notification_type', 'title', 'is_read', 'created_at')
    list_filter = ('notification_type', 'is_read')

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('buyer', 'seller', 'product', 'updated_at')

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('conversation', 'sender', 'is_read', 'created_at')

@admin.register(Dispute)
class DisputeAdmin(admin.ModelAdmin):
    list_display = ('order', 'opened_by', 'status', 'created_at')
    list_filter = ('status',)

@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ('product', 'name', 'stock', 'price_adjustment', 'is_available')

@admin.register(DeliveryZone)
class DeliveryZoneAdmin(admin.ModelAdmin):
    list_display = ('seller', 'zone_name', 'delivery_fee', 'is_active')

@admin.register(SavedSearch)
class SavedSearchAdmin(admin.ModelAdmin):
    list_display = ('user', 'query', 'category', 'created_at')

@admin.register(PriceAlert)
class PriceAlertAdmin(admin.ModelAdmin):
    list_display = ('user', 'product', 'target_price', 'is_active', 'triggered_at')

@admin.register(SellerApplication)
class SellerApplicationAdmin(admin.ModelAdmin):
    list_display = ('user', 'business_name', 'requested_tier', 'business_registration_number', 'tin_number', 'status', 'created_at')
    list_filter = ('status', 'requested_tier')
    search_fields = ('user__username', 'business_name', 'business_registration_number', 'tin_number')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = [
        ('Applicant', {'fields': ['user', 'requested_tier', 'status', 'reviewed_by']}),
        ('Business Identity', {'fields': ['business_name', 'business_registration_number', 'tin_number', 'business_address', 'business_region']}),
        ('Documents', {'fields': ['id_document', 'business_document']}),
        ('Timestamps', {'fields': ['created_at', 'updated_at']}),
    ]

    @admin.action(description='Approve selected applications')
    def approve_applications(self, request, queryset):
        for app in queryset.filter(status='pending'):
            app.status = 'approved'
            app.reviewed_by = request.user
            app.save()

    @admin.action(description='Reject selected applications')
    def reject_applications(self, request, queryset):
        queryset.filter(status='pending').update(status='rejected')

    actions = ['approve_applications', 'reject_applications']

@admin.register(PaymentConfirmation)
class PaymentConfirmationAdmin(admin.ModelAdmin):
    list_display = ('user', 'tier', 'amount', 'status', 'created_at')
    list_filter = ('status', 'tier')

@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'tier', 'is_active', 'start_date', 'end_date')
    list_filter = ('is_active', 'tier')

@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ('user', 'subject', 'status', 'created_at')
    list_filter = ('status',)

@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ('owner', 'user', 'created_at')

@admin.register(StoreImage)
class StoreImageAdmin(admin.ModelAdmin):
    list_display = ('profile', 'uploaded_at')

@admin.register(FAQ)
class FAQAdmin(admin.ModelAdmin):
    list_display = ('question', 'order')

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'tier', 'is_verified', 'is_location_verified', 'phone_number', 'location']
    list_editable = ['is_verified', 'is_location_verified', 'tier']
    list_filter = ['tier', 'is_verified', 'is_location_verified']
    search_fields = ['user__username', 'phone_number', 'location']
    readonly_fields = ['user']