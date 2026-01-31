from django.urls import path, include
from . import views
from .views import subscription_payment_view, follow_user, subscription_choose_tier

urlpatterns = [
    # path('select-tier/', views.select_tier, name='select_tier'), # Removed: view does not exist
    path('', views.product_list, name='product_list'),
    path('register/', views.register, name='register'),
    # User Profile and related URLs
    path('user/<str:username>/', views.user_profile, name='user_profile'),  # For viewing ANY user's profile
    path('profile/edit/', views.edit_profile, name='edit_profile'),  # For editing the CURRENT user's profile
    path('follow/', follow_user, name='follow_user'), #keep this line for follow user.
    path('dashboard/', views.dashboard, name='dashboard'),

    # Product related URLs
    path('product/create/', views.product_create, name='product_create'),
    path('product/<slug:slug>/', views.product_detail, name='product_detail'),
    path('product/<slug:slug>/update/', views.product_update, name='product_update'),
    path('product/<slug:slug>/delete/', views.product_delete, name='product_delete'),
    path('related-products/<slug:slug>/', views.get_related_products, name='related_products'),

    # path('user/products/', views.user_products, name='user_products'), # No longer needed

    # Cart and Checkout URLs
    path('cart/add/<slug:slug>/', views.add_to_cart, name='add_to_cart'),  # Uses slug
    path('cart/', views.view_cart, name='view_cart'),
    path('cart/remove/<int:product_id>/', views.remove_from_cart, name='remove_from_cart'), # Uses product_id
    path('cart/update/<int:product_id>/', views.update_cart, name='update_cart'), # Uses product_id
    path('checkout/', views.checkout, name='checkout'),

    # Order related URLs
    path('orders/', views.order_list, name='order_list'),
    path('orders/<int:order_id>/', views.order_detail, name='order_detail'),

    # Search URL
    path('search/', views.search_results, name='search_results'),
    #path('search/ajax/', views.search_results_ajax, name='search_results_ajax'), #add ajax search

    # Liking the product 
    path('like/<int:product_id>/', views.like_product, name='like_product'), # Add this line
    # path('subscription-tiers/', views.subscription_tiers, name='subscription_tiers'),  # Removed: view does not exist

    # Subscription system (clean user-facing flow)
    path('subscription/upgrade/', views.subscription_choose_tier, name='subscription_choose_tier'),
    path('subscription/payment/', views.subscription_payment_view, name='subscription_payment'),
    path('subscription/confirm/', views.subscription_confirm_payment, name='subscription_confirm_payment'),
    path('subscription/status/', views.subscription_status, name='subscription_status'),
]
