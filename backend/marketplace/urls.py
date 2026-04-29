from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .api_views import (
    ProductViewSet, CategoryViewSet, ReviewViewSet,
    CommentViewSet, OrderViewSet, PaymentViewSet,
    CustomTokenObtainPairView, RegisterView,
    SponsoredListingViewSet, UserProfileViewSet,
    LipaNumberViewSet, FAQViewSet, SupportTicketViewSet, ChangePasswordView,
    VerifySuperuserView, NotificationViewSet, ConversationViewSet,
    SavedSearchViewSet, PriceAlertViewSet, DisputeViewSet,
    DeliveryZoneViewSet, SiteSettingsView
)

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'reviews', ReviewViewSet, basename='review')
router.register(r'comments', CommentViewSet, basename='comment')
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'sponsored', SponsoredListingViewSet, basename='sponsored')
router.register(r'profiles', UserProfileViewSet, basename='profile')
router.register(r'lipa-numbers', LipaNumberViewSet, basename='lipa-number')
router.register(r'faq', FAQViewSet, basename='faq')
router.register(r'support-tickets', SupportTicketViewSet, basename='support-ticket')
# FIX v5: new viewsets
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'conversations', ConversationViewSet, basename='conversation')
router.register(r'saved-searches', SavedSearchViewSet, basename='saved-search')
router.register(r'price-alerts', PriceAlertViewSet, basename='price-alert')
router.register(r'disputes', DisputeViewSet, basename='dispute')
router.register(r'delivery-zones', DeliveryZoneViewSet, basename='delivery-zone')

urlpatterns = [
    path('api/', include(router.urls)),
    path('api/auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/register/', RegisterView.as_view(), name='auth_register'),
    path('api/auth/change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('api/auth/verify-superuser/', VerifySuperuserView.as_view(), name='verify_superuser'),  # FIX D-02/D-03
    path('api/site-settings/', SiteSettingsView.as_view(), name='site-settings'),  # FIX B-18
]
