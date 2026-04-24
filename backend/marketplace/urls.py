from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .api_views import (
    ProductViewSet, CategoryViewSet, ReviewViewSet,
    CommentViewSet, OrderViewSet, PaymentViewSet,
    CustomTokenObtainPairView, RegisterView,
    SponsoredListingViewSet, UserProfileViewSet
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

urlpatterns = [
    path('api/', include(router.urls)),
    path('api/auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/register/', RegisterView.as_view(), name='auth_register'),
]

