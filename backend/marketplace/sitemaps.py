from django.contrib.sitemaps import Sitemap
from django.urls import reverse
from .models import Product, Category

class StaticViewSitemap(Sitemap):
    priority = 0.8
    changefreq = 'weekly'

    def items(self):
        # Map standard frontend SPA routes
        return ['home', 'about', 'contact', 'terms', 'privacy']

    def location(self, item):
        if item == 'home':
            return '/'
        return f'/{item}'

class CategorySitemap(Sitemap):
    changefreq = 'daily'
    priority = 0.9

    def items(self):
        return Category.objects.all()

class ProductSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.7

    def items(self):
        return Product.objects.filter(is_available=True)

    def lastmod(self, obj):
        return obj.updated_at
