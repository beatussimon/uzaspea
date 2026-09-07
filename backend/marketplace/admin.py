from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import (
    UserProfile, Product, Category, Review, Order, OrderItem,
    SidebarOffer, SidebarNewsItem, Subscription, NewsletterSubscription,
    Like, Follow, ProductImage, SubscriptionTier, MobileNetwork, LipaNumber,
    Notification, Conversation, Message, SavedSearch, PriceAlert,
    Dispute, ProductVariant, SiteSettings, DeliveryZone,
    SellerApplication, PaymentConfirmation, SupportTicket, TeamMember, StoreImage, FAQ,
    PasswordResetRequest
)
from django.utils.html import format_html
import urllib.parse
from django.utils import timezone

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
    list_display = ('id', 'user', 'order_date', 'total_amount', 'status', 'shipping_method', 'fulfillment_type', 'is_completed')
    list_filter = ('status', 'shipping_method', 'fulfillment_type', 'is_completed', 'order_date')
    search_fields = ('user__username', 'id')
    readonly_fields = ('order_date', 'total_amount')
    raw_id_fields = ('user',)
    inlines = [OrderItemInline]
    list_per_page = 20
    fieldsets = (
        (None, {
            'fields': ('user', 'order_date', 'status', 'is_completed', 'total_amount')
        }),
        ('Shipping & Fulfillment', {
            'fields': ('shipping_method', 'fulfillment_type', 'shipping_fee', 'delivery_info'),
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
    list_display = ("network", "number", "name", "seller", "purpose", "is_system", "is_active", "display_order")
    list_filter = ("network", "is_active", "is_system", "purpose")
    search_fields = ("number", "network__name", "seller__username", "name")
    list_editable = ("is_active", "display_order", "is_system", "purpose")
    fieldsets = [
        (None, {'fields': ['seller', 'network', 'number', 'name', 'display_order']}),
        ('Classification', {'fields': ['purpose', 'is_system', 'is_active'],
                            'description': 'Set <strong>is_system = True</strong> and <strong>purpose = Logistics & Delivery Fees</strong> to show this number on the delivery payment screen.'}),
    ]

# FIX v5: Register new models
@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    fieldsets = [
        ('Platform Identity', {'fields': ['company_name', 'tagline', 'for_you_image']}),
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
    list_display = ['user', 'tier', 'is_verified', 'is_location_verified', 'location', 'latitude', 'longitude', 'phone_number']
    list_editable = ['is_verified', 'is_location_verified', 'tier']
    list_filter = ['tier', 'is_verified', 'is_location_verified']
    search_fields = ['user__username', 'phone_number', 'location', 'user__email']
    readonly_fields = ['user']
    fieldsets = (
        ('User & Subscription', {
            'fields': ('user', 'tier', 'is_verified', 'phone_number', 'whatsapp_number')
        }),
        ('Business Location & GPS (Admin Managed)', {
            'fields': ('location', 'latitude', 'longitude', 'is_location_verified'),
            'description': 'Business location and dispatch coordinates are managed by admin. Use "📍 Capture Device GPS" to set accurate coordinates directly from device GPS.'
        }),
        ('Store Profile Details', {
            'fields': ('bio', 'website', 'instagram_username', 'facebook_url', 'tiktok_username', 'twitter_username', 'youtube_url', 'linkedin_url', 'preferred_currency', 'profile_picture', 'banner_image', 'show_product_requests'),
            'classes': ('collapse',)
        }),
    )

    class Media:
        js = ('js/admin_gps_capture.js',)
# --- Vehicle Taxonomy ---
from .models import VehicleMake, VehicleModel, Vehicle, ProductVehicleFitment

@admin.register(VehicleMake)
class VehicleMakeAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    search_fields = ('name',)

@admin.register(VehicleModel)
class VehicleModelAdmin(admin.ModelAdmin):
    list_display = ('name', 'make', 'slug')
    search_fields = ('name', 'make__name')
    list_filter = ('make',)

@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ('year', 'make', 'model', 'trim', 'engine', 'region')
    search_fields = ('make__name', 'model__name', 'year', 'trim', 'engine')
    list_filter = ('make', 'year', 'region')

@admin.register(ProductVehicleFitment)
class ProductVehicleFitmentAdmin(admin.ModelAdmin):
    list_display = ('product', 'vehicle', 'is_verified')
    search_fields = ('product__name', 'vehicle__make__name', 'vehicle__model__name')
    list_filter = ('is_verified',)


@admin.register(PasswordResetRequest)
class PasswordResetRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'user_email', 'request_type_badge', 'status_badge', 'is_used', 'created_at', 'expires_at', 'dispatch_info')
    list_filter = ('status', 'request_type', 'is_used', 'created_at')
    search_fields = ('user__username', 'user__email', 'token', 'ip_address')
    readonly_fields = (
        'user', 'request_type', 'status_badge', 'reset_link_box', 'email_composer_box',
        'is_used', 'used_at', 'created_at', 'expires_at', 'dispatched_by', 'dispatched_at',
        'ip_address', 'user_agent'
    )
    fieldsets = (
        ('Request Summary', {
            'fields': ('user', 'request_type', 'status_badge', 'is_used', 'used_at', 'created_at', 'expires_at')
        }),
        ('Manual Admin Dispatch', {
            'fields': ('reset_link_box', 'email_composer_box'),
            'description': 'Copy the one-time link or the pre-formatted email draft below and dispatch it manually to the user’s registered email address.'
        }),
        ('Dispatch Audit', {
            'fields': ('dispatched_by', 'dispatched_at'),
            'classes': ('collapse',)
        }),
        ('Security & Request Metadata', {
            'fields': ('ip_address', 'user_agent'),
            'classes': ('collapse',)
        }),
    )
    actions = ['mark_as_dispatched', 'revoke_requests']

    @admin.display(description='Email')
    def user_email(self, obj):
        return obj.user.email or "— (No email)"

    @admin.display(description='Type')
    def request_type_badge(self, obj):
        if obj.request_type == 'settings_change':
            return format_html('<span style="background:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:12px; font-weight:600; font-size:11px;">Settings Change</span>')
        return format_html('<span style="background:#fef3c7; color:#92400e; padding:3px 8px; border-radius:12px; font-weight:600; font-size:11px;">Forgot Password</span>')

    @admin.display(description='Status')
    def status_badge(self, obj):
        styles = {
            'pending': 'background:#fef3c7; color:#b45309; border:1px solid #fde68a;',
            'dispatched': 'background:#dbeafe; color:#1d4ed8; border:1px solid #bfdbfe;',
            'completed': 'background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;',
            'expired': 'background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;',
            'superseded': 'background:#f3f4f6; color:#4b5563; border:1px solid #e5e7eb;',
        }
        st = obj.status
        if not obj.is_used and timezone.now() > obj.expires_at and st not in ['completed', 'expired', 'superseded']:
            st = 'expired'
        style = styles.get(st, styles['pending'])
        return format_html('<span style="{}; padding:4px 10px; border-radius:12px; font-weight:700; font-size:11px; text-transform:uppercase;">{}</span>', style, st)

    @admin.display(description='Dispatched')
    def dispatch_info(self, obj):
        if obj.dispatched_at:
            by = obj.dispatched_by.username if obj.dispatched_by else 'Admin'
            return f"{by} ({obj.dispatched_at.strftime('%m/%d %H:%M')})"
        return "Not yet"

    @admin.display(description='One-Time Reset Link')
    def reset_link_box(self, obj):
        url = obj.get_reset_url()
        is_active = obj.is_active()
        status_note = '<span style="color:#16a34a; font-weight:bold;">Active & Ready to Dispatch</span>' if is_active else '<span style="color:#dc2626; font-weight:bold;">Inactive / Expired / Used</span>'
        return format_html(
            '''
            <div style="max-width:650px; background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:8px;">
                <div style="margin-bottom:8px; font-size:12px;">Link Status: {}</div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <input id="reset_url_input_{}" type="text" readonly value="{}" style="flex:1; padding:8px 10px; font-family:monospace; font-size:12px; border:1px solid #cbd5e1; border-radius:6px; background:#fff;" />
                    <button type="button" onclick="navigator.clipboard.writeText('{}'); this.innerText='Copied!'; setTimeout(()=>this.innerText='Copy Link', 2000);" style="padding:8px 16px; background:#0f172a; color:#fff; border:none; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer;">Copy Link</button>
                </div>
            </div>
            ''',
            format_html(status_note),
            obj.id,
            url,
            url
        )

    @admin.display(description='Email Draft Preview')
    def email_composer_box(self, obj):
        draft = obj.get_email_draft()
        mailto_url = f"mailto:{draft['to']}?subject={urllib.parse.quote(draft['subject'])}&body={urllib.parse.quote(draft['body'])}"
        return format_html(
            '''
            <div style="max-width:650px; background:#f8fafc; border:1px solid #e2e8f0; padding:14px; border-radius:8px; font-size:13px;">
                <div style="margin-bottom:8px;"><strong>To:</strong> <span style="font-family:monospace; color:#0369a1;">{}</span></div>
                <div style="margin-bottom:10px;"><strong>Subject:</strong> <span>{}</span></div>
                <div style="margin-bottom:12px;">
                    <strong>Body:</strong>
                    <pre id="email_draft_body_{}" style="margin-top:6px; padding:10px; background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; font-family:sans-serif; font-size:12px; line-height:1.5; white-space:pre-wrap; max-height:220px; overflow-y:auto;">{}</pre>
                </div>
                <div style="display:flex; gap:10px;">
                    <button type="button" onclick="navigator.clipboard.writeText(document.getElementById('email_draft_body_{}').innerText); this.innerText='Draft Copied!'; setTimeout(()=>this.innerText='Copy Email Draft', 2000);" style="padding:8px 14px; background:#0284c7; color:#fff; border:none; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer;">Copy Email Draft</button>
                    <a href="{}" target="_blank" style="display:inline-block; padding:8px 14px; background:#16a34a; color:#fff; text-decoration:none; border-radius:6px; font-weight:600; font-size:12px;">Open in Mail Client</a>
                </div>
            </div>
            ''',
            draft['to'] or "(User has no email registered!)",
            draft['subject'],
            obj.id,
            draft['body'],
            obj.id,
            mailto_url
        )

    @admin.action(description='Mark selected as Dispatched')
    def mark_as_dispatched(self, request, queryset):
        count = queryset.filter(status='pending').update(
            status='dispatched',
            dispatched_by=request.user,
            dispatched_at=timezone.now()
        )
        self.message_user(request, f"Marked {count} request(s) as Dispatched.")

    @admin.action(description='Revoke / Expire selected requests')
    def revoke_requests(self, request, queryset):
        count = queryset.update(status='expired')
        self.message_user(request, f"Revoked {count} request(s).")

