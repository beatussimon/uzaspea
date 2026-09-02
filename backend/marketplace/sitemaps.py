from django.contrib.sitemaps import Sitemap
from django.contrib.auth.models import User
from .models import Product, Category

class StaticViewSitemap(Sitemap):
    priority = 0.8
    changefreq = 'weekly'
    protocol = 'https'

    def items(self):
        # Actual public SPA routes
        return ['', 'products', 'help', 'terms', 'privacy', 'seller-contract']

    def location(self, item):
        if not item:
            return '/'
        return f'/{item}'

class CategorySitemap(Sitemap):
    changefreq = 'daily'
    priority = 0.9
    protocol = 'https'

    def items(self):
        return Category.objects.all().order_by('name')

    def location(self, item):
        return f'/products?category={item.slug}'

class ProductSitemap(Sitemap):
    changefreq = 'daily'
    priority = 1.0
    protocol = 'https'

    def items(self):
        return Product.objects.filter(
            is_available=True, 
            is_draft=False, 
            stock__gt=0
        ).select_related('category', 'seller', 'brand').prefetch_related('images').order_by('-updated_at')

    def lastmod(self, obj):
        return obj.updated_at

    def location(self, obj):
        return f'/product/{obj.slug}'

class SellerSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.7
    protocol = 'https'

    def items(self):
        # Active sellers who have published listings
        return User.objects.filter(
            products__is_available=True,
            products__is_draft=False
        ).distinct().order_by('username')

    def location(self, item):
        return f'/{item.username}'
