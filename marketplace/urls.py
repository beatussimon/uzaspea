from django.urls import path, include
from . import views

urlpatterns = [
    path('', views.product_list, name='product_list'),
    path('product/create/', views.product_create, name='product_create'),
    path('product/<slug:slug>/', views.product_detail, name='product_detail'),
    path('product/<slug:slug>/update/', views.product_update, name='product_update'),
    path('product/<slug:slug>/delete/', views.product_delete, name='product_delete'),
    path('register/', views.register, name='register'),
    path('profile/', views.user_profile, name='user_profile'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('cart/add/<slug:slug>/', views.add_to_cart, name='add_to_cart'),
    path('cart/', views.view_cart, name='view_cart'),
    path('cart/remove/<int:product_id>/', views.remove_from_cart, name='remove_from_cart'),
    path('cart/update/<int:product_id>/', views.update_cart, name='update_cart'),
    path('checkout/', views.checkout, name='checkout'),
    path('orders/', views.order_list, name='order_list'),
    path('orders/<int:order_id>/', views.order_detail, name='order_detail'),
    path('search/', views.search_results, name='search_results'),
    # path('accounts/', include('django.contrib.auth.urls')),  <- In project urls.py
    #path('subscribe/', views.subscribe, name='subscribe'), # No longer needed
]