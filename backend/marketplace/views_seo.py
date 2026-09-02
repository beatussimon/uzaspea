import html
import json
import logging
from decimal import Decimal
from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse
from django.utils.html import escape
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from .models import Product, Category, User

logger = logging.getLogger(__name__)

SITE_URL = getattr(settings, 'SITE_URL', 'https://pasifiq.store').rstrip('/')
SITE_NAME = 'SokoniMax'
DEFAULT_DESCRIPTION = 'SokoniMax - Buy and sell car parts, vehicles, electronics, and goods in Tanzania. Verified sellers, secure payments, and fast delivery.'
DEFAULT_IMAGE = f"{SITE_URL}/logo.png"


def format_tzs(amount):
    try:
        val = int(Decimal(str(amount)))
        return f"{val:,}"
    except Exception:
        return str(amount)


class SeoRenderView(APIView):
    """
    High-performance, lightweight server-side pre-renderer for search engines and social bots.
    Emits 100% compliant Open Graph, Twitter Cards, Schema.org JSON-LD, and semantic HTML fallback.
    Cached in Redis for <5ms response time.
    """
    authentication_classes = []  # LAW 13: CSRF and Session bypass for public endpoint
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        raw_path = request.query_params.get('path', '/').strip()
        # Clean path
        path = raw_path.split('?')[0] if '?' in raw_path else raw_path
        query_string = raw_path.split('?')[1] if '?' in raw_path else ''
        
        # Check Redis cache
        cache_key = f"seo_render:{raw_path[:150]}"
        cached_html = cache.get(cache_key)
        if cached_html:
            return HttpResponse(cached_html, content_type="text/html; charset=utf-8")

        try:
            if path.startswith('/product/'):
                slug = path.replace('/product/', '').strip('/')
                html_content = self.render_product(slug, raw_path)
            elif path.startswith('/products'):
                html_content = self.render_products_catalog(query_string, raw_path)
            elif path in ['', '/']:
                html_content = self.render_homepage(raw_path)
            elif path in ['/help', '/terms', '/privacy', '/seller-contract']:
                html_content = self.render_static_page(path, raw_path)
            else:
                # Potential seller store /:username
                username = path.strip('/')
                html_content = self.render_seller_or_fallback(username, raw_path)

            # Cache successful response for 30 minutes
            cache.set(cache_key, html_content, 1800)
            return HttpResponse(html_content, content_type="text/html; charset=utf-8")
        except Exception as e:
            logger.exception(f"Error in SeoRenderView for path {raw_path}: {e}")
            fallback_html = self.render_fallback_shell(
                title=f"{SITE_NAME} - Tanzania Marketplace",
                description=DEFAULT_DESCRIPTION,
                canonical_url=f"{SITE_URL}{path}"
            )
            return HttpResponse(fallback_html, content_type="text/html; charset=utf-8")

    def render_product(self, slug, raw_path):
        product = Product.objects.filter(
            slug=slug, 
            is_available=True, 
            is_draft=False
        ).select_related('category', 'category__parent', 'seller', 'seller__profile', 'brand').prefetch_related('images').first()

        if not product:
            return self.render_404(raw_path)

        canonical_url = f"{SITE_URL}/product/{product.slug}"
        primary_image = product.images.first()
        if primary_image and primary_image.image:
            image_url = primary_image.image.url
            if not image_url.startswith('http'):
                image_url = f"{SITE_URL}{image_url}"
        else:
            image_url = DEFAULT_IMAGE

        all_images = []
        for img in product.images.all():
            if img.image:
                img_url = img.image.url
                if not img_url.startswith('http'):
                    img_url = f"{SITE_URL}{img_url}"
                all_images.append(img_url)
        if not all_images:
            all_images = [image_url]

        price_val = product.sale_price if (product.sale_price and product.sale_price < product.price) else product.price
        price_str = format_tzs(price_val)
        clean_desc = (product.description or '').strip()
        meta_desc = clean_desc[:160].replace('\n', ' ') if clean_desc else f"Buy {product.name} on {SITE_NAME} Tanzania. Best price: TSh {price_str}."

        title = f"{product.name} - TSh {price_str} | {SITE_NAME} Tanzania"
        brand_name = product.brand.name if product.brand else "SokoniMax"

        # Breadcrumbs
        breadcrumbs = [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL},
            {"@type": "ListItem", "position": 2, "name": "Products", "item": f"{SITE_URL}/products"}
        ]
        pos = 3
        if product.category.parent:
            breadcrumbs.append({
                "@type": "ListItem",
                "position": pos,
                "name": product.category.parent.name,
                "item": f"{SITE_URL}/products?category={product.category.parent.slug}"
            })
            pos += 1
        breadcrumbs.append({
            "@type": "ListItem",
            "position": pos,
            "name": product.category.name,
            "item": f"{SITE_URL}/products?category={product.category.slug}"
        })
        pos += 1
        breadcrumbs.append({
            "@type": "ListItem",
            "position": pos,
            "name": product.name,
            "item": canonical_url
        })

        # Schema.org Product
        schema = {
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": product.name,
            "image": all_images,
            "description": meta_desc,
            "sku": product.sku or str(product.id),
            "mpn": product.sku or str(product.id),
            "brand": {
                "@type": "Brand",
                "name": brand_name
            },
            "offers": {
                "@type": "Offer",
                "url": canonical_url,
                "priceCurrency": "TZS",
                "price": str(price_val),
                "priceValidUntil": "2027-12-31",
                "itemCondition": "https://schema.org/NewCondition" if product.condition == 'New' else "https://schema.org/UsedCondition",
                "availability": "https://schema.org/InStock" if product.stock > 0 else "https://schema.org/OutOfStock",
                "seller": {
                    "@type": "Organization",
                    "name": product.seller.username
                }
            }
        }

        if hasattr(product, 'average_rating') and product.average_rating() > 0:
            schema["aggregateRating"] = {
                "@type": "AggregateRating",
                "ratingValue": str(product.average_rating()),
                "reviewCount": str(max(product.get_like_count(), 1))
            }

        breadcrumb_schema = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": breadcrumbs
        }

        # Semantic HTML Body fallback for crawlers & non-JS readers
        body_content = f"""
        <article itemscope itemtype="https://schema.org/Product" style="max-width: 800px; margin: 40px auto; font-family: system-ui, sans-serif; padding: 0 16px;">
            <nav aria-label="Breadcrumb" style="margin-bottom: 20px; font-size: 14px; color: #666;">
                <a href="/">Home</a> &gt; <a href="/products">Products</a> &gt; 
                <a href="/products?category={product.category.slug}">{escape(product.category.name)}</a> &gt; 
                <span>{escape(product.name)}</span>
            </nav>
            <h1 itemprop="name" style="font-size: 28px; margin-bottom: 8px;">{escape(product.name)}</h1>
            <div style="font-size: 24px; font-weight: bold; color: #d97706; margin-bottom: 16px;">
                TSh {price_str}
            </div>
            <div style="margin-bottom: 24px;">
                <img itemprop="image" src="{escape(image_url)}" alt="{escape(product.name)}" style="max-width: 100%; height: auto; border-radius: 12px; border: 1px solid #eee;" />
            </div>
            <section style="margin-bottom: 24px;">
                <h2>Product Details</h2>
                <ul style="line-height: 1.8;">
                    <li><strong>Category:</strong> {escape(product.category.name)}</li>
                    <li><strong>Condition:</strong> {escape(product.condition)}</li>
                    <li><strong>Availability:</strong> {'In Stock' if product.stock > 0 else 'Out of Stock'}</li>
                    <li><strong>Seller:</strong> {escape(product.seller.username)}</li>
                    <li><strong>Location:</strong> {escape(product.location_name or 'Dar es Salaam, Tanzania')}</li>
                </ul>
            </section>
            <section style="margin-bottom: 24px;">
                <h2>Description</h2>
                <div itemprop="description" style="line-height: 1.6; white-space: pre-line;">{escape(clean_desc)}</div>
            </section>
        </article>
        """

        extra_head = f"""
        <meta property="og:type" content="product" />
        <meta property="og:title" content="{escape(title)}" />
        <meta property="og:description" content="{escape(meta_desc)}" />
        <meta property="og:image" content="{escape(image_url)}" />
        <meta property="og:url" content="{escape(canonical_url)}" />
        <meta property="og:site_name" content="{escape(SITE_NAME)}" />
        <meta property="product:price:amount" content="{escape(str(price_val))}" />
        <meta property="product:price:currency" content="TZS" />
        <meta property="product:availability" content="{'in stock' if product.stock > 0 else 'out of stock'}" />
        <meta property="product:condition" content="{escape(product.condition.lower())}" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="{escape(title)}" />
        <meta name="twitter:description" content="{escape(meta_desc)}" />
        <meta name="twitter:image" content="{escape(image_url)}" />

        <script type="application/ld+json">
        {json.dumps(schema)}
        </script>
        <script type="application/ld+json">
        {json.dumps(breadcrumb_schema)}
        </script>
        """

        return self.render_full_html(title, meta_desc, canonical_url, extra_head, body_content)

    def render_products_catalog(self, query_string, raw_path):
        from urllib.parse import parse_qs
        params = parse_qs(query_string)
        cat_slug = params.get('category', [''])[0]
        q_term = params.get('q', [''])[0]

        if q_term:
            # Internal search results page: noindex, follow to preserve crawl budget
            title = f"Search: {q_term} | {SITE_NAME} Tanzania"
            desc = f"Browse search results for '{q_term}' on {SITE_NAME} Tanzania. Buy new and used items directly from verified sellers."
            canonical = f"{SITE_URL}/products"
            robots = "noindex, follow"
        elif cat_slug:
            cat = Category.objects.filter(slug=cat_slug).first()
            cat_name = cat.name if cat else cat_slug.capitalize()
            title = f"Buy {cat_name} in Tanzania | {SITE_NAME}"
            desc = f"Explore genuine {cat_name} for sale in Tanzania on {SITE_NAME}. Verified sellers, fair prices, and direct contact."
            canonical = f"{SITE_URL}/products?category={cat_slug}"
            robots = "index, follow"
        else:
            title = f"Browse Products | {SITE_NAME} Tanzania"
            desc = "Find spare parts, electronics, vehicles, and items from verified sellers across Tanzania."
            canonical = f"{SITE_URL}/products"
            robots = "index, follow"

        # Fetch top 12 featured products for crawler discovery
        products = Product.objects.filter(is_available=True, is_draft=False, stock__gt=0).order_by('-created_at')[:12]
        links_html = "".join([
            f'<li><a href="/product/{p.slug}">{escape(p.name)} - TSh {format_tzs(p.price)}</a></li>'
            for p in products
        ])

        body_content = f"""
        <main style="max-width: 800px; margin: 40px auto; font-family: system-ui, sans-serif; padding: 0 16px;">
            <h1>{escape(title)}</h1>
            <p>{escape(desc)}</p>
            <h2>Featured Listings</h2>
            <ul style="line-height: 2;">{links_html}</ul>
        </main>
        """

        extra_head = f"""
        <meta name="robots" content="{robots}" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="{escape(title)}" />
        <meta property="og:description" content="{escape(desc)}" />
        <meta property="og:url" content="{escape(canonical)}" />
        <meta property="og:image" content="{DEFAULT_IMAGE}" />
        <meta name="twitter:card" content="summary" />
        """

        return self.render_full_html(title, desc, canonical, extra_head, body_content)

    def render_homepage(self, raw_path):
        title = f"{SITE_NAME} - Tanzania Marketplace for Spare Parts, Vehicles & Electronics"
        desc = DEFAULT_DESCRIPTION
        canonical = f"{SITE_URL}/"

        website_schema = {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "url": SITE_URL,
            "name": SITE_NAME,
            "potentialAction": {
                "@type": "SearchAction",
                "target": {
                    "@type": "EntryPoint",
                    "urlTemplate": f"{SITE_URL}/products?q={{search_term_string}}"
                },
                "query-input": "required name=search_term_string"
            }
        }

        org_schema = {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": SITE_NAME,
            "url": SITE_URL,
            "logo": f"{SITE_URL}/logo.png"
        }

        categories = Category.objects.filter(parent__isnull=True)[:10]
        cat_links = "".join([
            f'<li><a href="/products?category={c.slug}">{escape(c.name)}</a></li>'
            for c in categories
        ])

        body_content = f"""
        <main style="max-width: 800px; margin: 40px auto; font-family: system-ui, sans-serif; padding: 0 16px;">
            <h1>{SITE_NAME} - Tanzania's Trusted Marketplace</h1>
            <p>{escape(desc)}</p>
            <h2>Popular Categories</h2>
            <ul style="line-height: 2;">{cat_links}</ul>
            <p><a href="/products">View all products &rarr;</a></p>
        </main>
        """

        extra_head = f"""
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="{escape(title)}" />
        <meta property="og:description" content="{escape(desc)}" />
        <meta property="og:url" content="{escape(canonical)}" />
        <meta property="og:image" content="{DEFAULT_IMAGE}" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{json.dumps(website_schema)}</script>
        <script type="application/ld+json">{json.dumps(org_schema)}</script>
        """

        return self.render_full_html(title, desc, canonical, extra_head, body_content)

    def render_static_page(self, path, raw_path):
        name = path.replace('/', '').replace('-', ' ').title()
        title = f"{name} | {SITE_NAME} Tanzania"
        desc = f"{name} for {SITE_NAME} - verified e-commerce marketplace in Tanzania."
        canonical = f"{SITE_URL}{path}"

        body_content = f"""
        <main style="max-width: 800px; margin: 40px auto; font-family: system-ui, sans-serif; padding: 0 16px;">
            <h1>{escape(name)}</h1>
            <p>{escape(desc)}</p>
            <p><a href="/">&larr; Return to Homepage</a></p>
        </main>
        """
        extra_head = f"""
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="{escape(title)}" />
        <meta property="og:description" content="{escape(desc)}" />
        <meta property="og:url" content="{escape(canonical)}" />
        """
        return self.render_full_html(title, desc, canonical, extra_head, body_content)

    def render_seller_or_fallback(self, username, raw_path):
        user = User.objects.filter(username__iexact=username).first()
        if user:
            title = f"{user.username}'s Store | {SITE_NAME} Tanzania"
            desc = f"Buy items directly from {user.username} on {SITE_NAME}. Browse available inventory and contact verified seller."
            canonical = f"{SITE_URL}/{user.username}"

            products = Product.objects.filter(seller=user, is_available=True, is_draft=False)[:10]
            prod_links = "".join([
                f'<li><a href="/product/{p.slug}">{escape(p.name)} - TSh {format_tzs(p.price)}</a></li>'
                for p in products
            ])

            body_content = f"""
            <main style="max-width: 800px; margin: 40px auto; font-family: system-ui, sans-serif; padding: 0 16px;">
                <h1>{escape(user.username)}'s Store</h1>
                <p>{escape(desc)}</p>
                <h2>Active Listings</h2>
                <ul style="line-height: 2;">{prod_links or '<li>No active listings currently.</li>'}</ul>
            </main>
            """
            extra_head = f"""
            <meta name="robots" content="index, follow" />
            <meta property="og:title" content="{escape(title)}" />
            <meta property="og:description" content="{escape(desc)}" />
            <meta property="og:url" content="{escape(canonical)}" />
            """
            return self.render_full_html(title, desc, canonical, extra_head, body_content)

        return self.render_404(raw_path)

    def render_404(self, raw_path):
        title = f"Page Not Found | {SITE_NAME}"
        desc = "The page you are looking for does not exist or has been removed."
        canonical = f"{SITE_URL}{raw_path}"
        body_content = f"""
        <main style="max-width: 800px; margin: 40px auto; font-family: system-ui, sans-serif; text-align: center; padding: 40px 16px;">
            <h1>404 - Page Not Found</h1>
            <p>{escape(desc)}</p>
            <p><a href="/products">Browse all products &rarr;</a></p>
        </main>
        """
        extra_head = '<meta name="robots" content="noindex, follow" />'
        return self.render_full_html(title, desc, canonical, extra_head, body_content)

    def render_fallback_shell(self, title, description, canonical_url):
        return self.render_full_html(title, description, canonical_url, "", "")

    def render_full_html(self, title, description, canonical_url, extra_head, body_content):
        return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>{escape(title)}</title>
    <meta name="description" content="{escape(description)}" />
    <link rel="canonical" href="{escape(canonical_url)}" />
    <link rel="icon" type="image/png" href="/logo.png" />
    <link rel="apple-touch-icon" href="/logo.png" />
    <link rel="preconnect" href="{SITE_URL}" />
    {extra_head}
  </head>
  <body>
    <div id="root">
      {body_content}
    </div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>"""
