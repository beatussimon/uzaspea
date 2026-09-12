from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .api_views import (
    ProductViewSet, CategoryViewSet, ReviewViewSet,
    CommentViewSet, OrderViewSet, PaymentViewSet,
    CustomTokenObtainPairView, CustomTokenRefreshView, RegisterView, AcceptTermsView,
    SponsoredListingViewSet, UserProfileViewSet,
    LipaNumberViewSet, FAQViewSet, SupportTicketViewSet, ChangePasswordView,
    RequestPasswordChangeView, ForgotPasswordRequestView, VerifyResetTokenView, ConfirmPasswordResetView,
    PasswordResetRequestStaffViewSet,
    VerifySuperuserView, NotificationViewSet, ConversationViewSet,
    SavedSearchViewSet, PriceAlertViewSet, DisputeViewSet,
    DeliveryZoneViewSet, SiteSettingsView, ProductVariantViewSet,
    MobileNetworkViewSet, TrendingAnalyticsView, reverse_geocode, tanzania_regions, geocode_search,
    SubscriptionTierViewSet, UserPaymentConfirmationViewSet, SellerApplicationViewSet, SellerSiteVisitViewSet,
    TeamMemberViewSet, UserSubscriptionViewSet, TeamRolePresetsView, PromoCodeViewSet,
    ProductRequestViewSet, SellerAnalyticsView,
    VehicleMakeViewSet, VehicleModelViewSet, VehicleViewSet,
    BrandViewSet, ReferenceProductViewSet,
    ReservedUsernameStaffViewSet, CheckUsernameView
)

from .discovery_views import DiscoveryFeedView, CategoryRecommendationsView

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'product-requests', ProductRequestViewSet, basename='product-request')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'vehicle-makes', VehicleMakeViewSet, basename='vehicle-make')
router.register(r'vehicle-models', VehicleModelViewSet, basename='vehicle-model')
router.register(r'vehicles', VehicleViewSet, basename='vehicle')
router.register(r'brands', BrandViewSet, basename='brand')
router.register(r'reference-products', ReferenceProductViewSet, basename='reference-product')
router.register(r'reviews', ReviewViewSet, basename='review')
router.register(r'comments', CommentViewSet, basename='comment')
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'sponsored', SponsoredListingViewSet, basename='sponsored')
router.register(r'profiles', UserProfileViewSet, basename='profile')
router.register(r'lipa-numbers', LipaNumberViewSet, basename='lipa-number')
router.register(r'mobile-networks', MobileNetworkViewSet, basename='mobile-network')
router.register(r'faq', FAQViewSet, basename='faq')
router.register(r'support-tickets', SupportTicketViewSet, basename='support-ticket')
router.register(r'subscription-tiers', SubscriptionTierViewSet, basename='subscription-tier')
router.register(r'subscription-payments', UserPaymentConfirmationViewSet, basename='subscription-payment')
router.register(r'seller-applications', SellerApplicationViewSet, basename='seller-application')
router.register(r'seller-site-visits', SellerSiteVisitViewSet, basename='seller-site-visit')
router.register(r'team-members', TeamMemberViewSet, basename='team-member')
router.register(r'subscriptions', UserSubscriptionViewSet, basename='subscription')
router.register(r'promo-codes', PromoCodeViewSet, basename='promo-code')
# FIX v5: new viewsets
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'conversations', ConversationViewSet, basename='conversation')
router.register(r'saved-searches', SavedSearchViewSet, basename='saved-search')
router.register(r'price-alerts', PriceAlertViewSet, basename='price-alert')
router.register(r'disputes', DisputeViewSet, basename='dispute')
router.register(r'delivery-zones', DeliveryZoneViewSet, basename='delivery-zone')
router.register(r'variants', ProductVariantViewSet, basename='variant')
router.register(r'staff-admin/password-requests', PasswordResetRequestStaffViewSet, basename='staff-password-request')
router.register(r'staff-admin/reserved-usernames', ReservedUsernameStaffViewSet, basename='staff-reserved-usernames')
urlpatterns = [
    path('api/products/discovery/', DiscoveryFeedView.as_view(), name='products-discovery'),
    path('api/products/recommendations/', CategoryRecommendationsView.as_view(), name='products-recommendations'),
    path('api/', include(router.urls)),
    path('api/auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/check-username/', CheckUsernameView.as_view(), name='check_username'),
    path('api/auth/register/', RegisterView.as_view(), name='auth_register'),
    path('api/auth/accept-terms/', AcceptTermsView.as_view(), name='accept_terms'),
    path('api/auth/change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('api/auth/request-password-change/', RequestPasswordChangeView.as_view(), name='request_password_change'),
    path('api/auth/forgot-password/', ForgotPasswordRequestView.as_view(), name='forgot_password'),
    path('api/auth/verify-reset-token/', VerifyResetTokenView.as_view(), name='verify_reset_token'),
    path('api/auth/confirm-password-reset/', ConfirmPasswordResetView.as_view(), name='confirm_password_reset'),
    path('api/auth/verify-superuser/', VerifySuperuserView.as_view(), name='verify_superuser'),  # FIX D-02/D-03
    path('api/site-settings/', SiteSettingsView.as_view(), name='site-settings'),  # FIX B-18
    path('api/analytics/trending/', TrendingAnalyticsView.as_view(), name='analytics-trending'),
    path('api/analytics/seller/', SellerAnalyticsView.as_view(), name='analytics-seller'),
    path('api/health/reverse_geocode/', reverse_geocode, name='reverse-geocode'),
    path('api/locations/regions/', tanzania_regions, name='tanzania-regions'),
    path('api/locations/search/', geocode_search, name='locations-search'),
    path('api/team-role-presets/', TeamRolePresetsView.as_view(), name='team-role-presets'),
    path('api/push/subscribe/', __import__('marketplace.api_views').api_views.PushSubscriptionView.as_view(), name='push-subscribe'),
    path('api/push/unsubscribe/', __import__('marketplace.api_views').api_views.PushSubscriptionView.as_view(), name='push-unsubscribe'),
    path('api/push/vapid-key/', __import__('marketplace.api_views').api_views.PushVapidKeyView.as_view(), name='push-vapid-key'),
]
