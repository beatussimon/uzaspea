import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  schema?: Record<string, any> | Array<Record<string, any>>;
  canonicalUrl?: string;
  noindex?: boolean;
  price?: string | number;
  priceCurrency?: string;
  availability?: string;
  condition?: string;
  children?: React.ReactNode;
}

const SEO: React.FC<SEOProps> = ({ 
  title = 'SokoniMax - Buy & Sell New and Used Items in Tanzania', 
  description = 'SokoniMax - Buy confidently new and used items in Tanzania. All sellers on this platform are verified.',
  image = '/logo.png',
  type = 'website',
  schema,
  canonicalUrl,
  noindex = false,
  price,
  priceCurrency = 'TZS',
  availability,
  condition,
  children
}) => {
  const location = useLocation();
  const siteUrl = (import.meta.env.VITE_SITE_URL || 'https://pasifiq.store').replace(/\/$/, '');
  
  // Calculate clean canonical URL (strip tracking, auth, and volatile filter query parameters)
  const resolvedCanonical = React.useMemo(() => {
    if (canonicalUrl) return canonicalUrl;
    
    // Whitelist only essential navigation query params like category
    const searchParams = new URLSearchParams(location.search);
    const cleanParams = new URLSearchParams();
    
    if (searchParams.has('category')) {
      cleanParams.set('category', searchParams.get('category')!);
      if (searchParams.has('subcategory')) {
        cleanParams.set('subcategory', searchParams.get('subcategory')!);
      }
    }
    
    const queryString = cleanParams.toString();
    return `${siteUrl}${location.pathname}${queryString ? `?${queryString}` : ''}`;
  }, [canonicalUrl, location.pathname, location.search, siteUrl]);

  const absoluteImageUrl = image.startsWith('http') ? image : `${siteUrl}${image.startsWith('/') ? image : `/${image}`}`;

  return (
    <Helmet>
      {/* Standard Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={noindex ? 'noindex, follow' : 'index, follow'} />
      <link rel="canonical" href={resolvedCanonical} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={resolvedCanonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absoluteImageUrl} />
      <meta property="og:site_name" content="SokoniMax" />

      {/* Product Open Graph Tags */}
      {type === 'product' && price && (
        <meta property="product:price:amount" content={String(price)} />
      )}
      {type === 'product' && price && (
        <meta property="product:price:currency" content={priceCurrency} />
      )}
      {type === 'product' && availability && (
        <meta property="product:availability" content={availability} />
      )}
      {type === 'product' && condition && (
        <meta property="product:condition" content={condition.toLowerCase()} />
      )}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={resolvedCanonical} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImageUrl} />

      {/* Structured Data / JSON-LD */}
      {schema && (
        Array.isArray(schema) ? (
          schema.map((s, idx) => (
            <script key={idx} type="application/ld+json">
              {JSON.stringify(s)}
            </script>
          ))
        ) : (
          <script type="application/ld+json">
            {JSON.stringify(schema)}
          </script>
        )
      )}

      {children}
    </Helmet>
  );
};

export default SEO;
