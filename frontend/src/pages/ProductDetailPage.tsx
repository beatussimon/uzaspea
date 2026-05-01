import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Star, X, Share2, Shield, MessageSquare, Bell } from 'lucide-react';
import api from '../api';
import { useCart } from '../context/CartContext';
import { ProductTabs } from '../ProductTabs';
import SafeImage from '../components/SafeImage';
import toast from 'react-hot-toast';
import VerifiedBadge from '../components/VerifiedBadge';
import Breadcrumbs from '../components/Breadcrumbs';
import { Skeleton } from '../components/Skeleton';

interface ProductData {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: string;
  stock: number;
  is_available: boolean;
  category: number;
  category_name: string;
  seller: number;
  seller_username: string;
  seller_verified: boolean;
  seller_tier: string;
  seller_profile_picture: string | null;
  condition: string;
  avg_rating: number;
  like_count: number;
  old_price?: string;
  images: { id: number; image: string }[];
  inspections: InspectionSummary[];
  is_verified: boolean;
}

interface InspectionSummary {
  id: number;
  inspection_id: string;
  status: string;
  verdict: 'pass' | 'conditional' | 'fail' | null;
  report_id: number | null;
  created_at: string;
}

interface ProductVariant {
  id: number;
  product: number;
  name: string;
  sku: string;
  price_adjustment: string;
  final_price: number;
  stock: number;
  is_available: boolean;
  image: string | null;
}

// ===== Fullscreen Image Lightbox =====
const ImageLightbox = ({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) => (
  <div
    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
    onClick={onClose}
  >
    <button
      onClick={onClose}
      className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition"
    >
      <X size={28} />
    </button>
    <img
      src={src}
      alt={alt}
      className="max-w-full max-h-full object-contain rounded"
      onClick={(e) => e.stopPropagation()}
    />
  </div>
);

const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [alertPrice, setAlertPrice] = useState('');
  
  const isAuthenticated = !!localStorage.getItem('access_token');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api.get(`/api/products/${slug}/`)
      .then((res) => {
        setProduct(res.data);
        setLikeCount(res.data.like_count);
        setLoading(false);
        // Fetch variants
        api.get(`/api/variants/?product=${res.data.id}`)
          .then((vRes) => setVariants(vRes.data.results || vRes.data))
          .catch(() => {});
      })
      .catch(() => {
        toast.error('Product not found');
        setLoading(false);
      });
  }, [slug]);

  const handleLike = async () => {
    if (!product) return;
    try {
      const res = await api.post(`/api/products/${product.slug}/like/`);
      setLiked(res.data.liked);
      setLikeCount(res.data.like_count);
    } catch {
      toast.error('Login to like products');
    }
  };

  // Working share — uses Web Share API or falls back to clipboard
  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareData = {
      title: product?.name || 'Check this out',
      text: `${product?.name} — TSh ${parseInt(product?.price || '0').toLocaleString()} on UZASPEA`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled share
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
      } catch {
        toast.error('Failed to copy link');
      }
    }
  };

  const handleAddToCart = () => {
    if (product) {
      const p = selectedVariant ? {
        ...product,
        price: selectedVariant.final_price,
        name: `${product.name} (${selectedVariant.name})`,
        stock: selectedVariant.stock,
        id: `${product.id}-${selectedVariant.id}` as any // Handle variant separated in cart
      } : product;
      addToCart(p, quantity);
    }
  };

  if (loading) {
    return (
      <div className="container-page py-10 space-y-10">
        <Skeleton className="w-48 h-4 mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="aspect-square rounded-xl" />
          <div className="space-y-6">
            <Skeleton className="w-3/4 h-10" />
            <Skeleton className="w-1/2 h-6" />
            <Skeleton className="w-full h-32" />
            <Skeleton className="w-full h-12" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Product not found</h2>
        <Link to="/" className="text-blue-600 mt-4 inline-block hover:underline">← Back to products</Link>
      </div>
    );
  }

  const images = product.images.length > 0
    ? product.images
    : [{ id: 0, image: '' }];

  const currentImageSrc = images[selectedImage]?.image || '';

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      {/* Lightbox */}
      {lightboxOpen && (
        <ImageLightbox
          src={currentImageSrc}
          alt={product.name}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* Breadcrumb */}
      <Breadcrumbs />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image Gallery — click opens fullscreen */}
        <div>
          <div
            className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden mb-4 shadow-sm cursor-zoom-in"
            onClick={() => setLightboxOpen(true)}
          >
            <SafeImage
              src={currentImageSrc}
              alt={product.name}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              loading="eager"
            />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(idx)}
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                    idx === selectedImage
                      ? 'border-blue-500 shadow-md'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'
                  }`}
                >
                  <SafeImage src={img.image} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex flex-col">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white leading-tight mb-3">
            {product.name}
          </h1>

          {/* Like + Share — repositioned & enlarged */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-base font-bold transition-all duration-200 ${
                liked
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-500 shadow-sm'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-red-400 hover:text-red-500'
              }`}
            >
              <Heart size={22} className={liked ? 'fill-current' : ''} />
              {likeCount}
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-blue-400 hover:text-blue-500 text-base font-bold transition-all duration-200 shadow-sm"
            >
              <Share2 size={22} />
              Share
            </button>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-6">
            <p className="text-4xl font-black text-brand-600 dark:text-brand-400 tracking-tight">
              TSh {selectedVariant ? selectedVariant.final_price.toLocaleString() : parseInt(product.price).toLocaleString()}
            </p>
            {product.old_price && parseInt(product.old_price) > parseInt(product.price) && !selectedVariant && (
              <p className="text-xl text-gray-400 line-through font-medium italic">
                TSh {parseInt(product.old_price).toLocaleString()}
              </p>
            )}
          </div>
          
          {/* Price Alert */}
          {isAuthenticated && (
            <div className="flex flex-wrap items-center gap-2 mb-6 -mt-2">
              <div className="relative">
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">TSh</span>
                 <input 
                   type="number" 
                   placeholder="Alert when price drops to..."
                   value={alertPrice} 
                   onChange={e => setAlertPrice(e.target.value)}
                   className="input text-sm pl-10 pr-3 py-1.5 w-60 h-9" 
                 />
              </div>
              <button 
                onClick={async () => {
                    if (!alertPrice) return toast.error('Enter a target price');
                    try {
                        await api.post('/api/price-alerts/', { product: product.id, target_price: alertPrice });
                        toast.success('Price alert set!');
                        setAlertPrice('');
                    } catch {
                        toast.error('Failed to set price alert');
                    }
                }} 
                className="btn-secondary h-9 py-0 px-4 text-xs font-bold flex items-center gap-1.5 border border-brand-200 text-brand-600 hover:bg-brand-50"
              >
                  <Bell size={14} /> Set Alert
              </button>
            </div>
          )}

          {/* Info rows */}
          <div className="space-y-3 mb-6">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Seller: <Link to={`/profile/${product.seller_username}`} className="text-blue-600 font-bold hover:underline">{product.seller_username}</Link>
                <VerifiedBadge tier={product.seller_tier} isVerified={product.seller_verified} className="w-5 h-5" />
              </span>
              <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <Link to={`/?category=${product.category_name}`} className="text-blue-600 font-bold hover:underline">{product.category_name}</Link>
              </span>
              {product.is_verified && (
                <span className="flex items-center gap-1.5 text-blue-700 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-900/30 text-[10px] font-black uppercase tracking-widest">
                  <Shield size={14} className="fill-current" />
                  Professionally Verified
                </span>
              )}
            </div>
            {/* FIX B-12: Message Seller */}
            {product.seller_username !== localStorage.getItem('username') && (
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={async () => {
                    try {
                      const res = await api.post('/api/conversations/', { seller: product.seller, product: product.id });
                      navigate(`/messages/${res.data.id}`);
                    } catch { toast.error('Login to message seller'); }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-200 dark:border-brand-800 text-brand-600 text-sm font-bold hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                >
                  <MessageSquare size={16} /> Message Seller
                </button>
              </div>
            )}
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 pl-1">
              <span className="font-medium">Stock: <span className="text-gray-900 dark:text-white font-bold">{product.stock}</span></span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                product.condition === 'New' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}>{product.condition}</span>
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2 mb-6 pl-1">
            {product.avg_rating > 0 ? (
              <>
                <div className="flex text-yellow-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} size={18} className={star <= product.avg_rating ? 'fill-current' : 'text-gray-200 dark:text-gray-700'} />
                  ))}
                </div>
                <span className="text-sm font-bold text-gray-500">({product.avg_rating}/5)</span>
              </>
            ) : (
              <span className="text-sm font-bold text-gray-400 italic">No reviews yet</span>
            )}
          </div>

          {/* Description */}
          <div className="bg-white dark:bg-gray-800/30 rounded-xl p-4 border border-gray-100 dark:border-gray-700 mb-8">
             <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Description</h3>
             <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm whitespace-pre-line">
               {product.description}
             </p>
          </div>

          {/* Variants Selector */}
          {variants.length > 0 && (
            <div className="mb-6 pl-1">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 block">
                Select Variant
              </label>
              <select
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                value={selectedVariant?.id || ''}
                onChange={(e) => {
                   const v = variants.find(x => x.id.toString() === e.target.value);
                   setSelectedVariant(v || null);
                   setQuantity(1); // Reset quantity when variant changes
                }}
              >
                <option value="">Default Option</option>
                {variants.map(v => (
                   <option key={v.id} value={v.id} disabled={!v.is_available || v.stock === 0}>
                     {v.name} {v.price_adjustment !== '0.00' ? `(TSh ${v.final_price.toLocaleString()})` : ''} {v.stock === 0 ? '- Out of Stock' : ''}
                   </option>
                ))}
              </select>
            </div>
          )}

          {/* Add to Cart — matches legacy quantity-selector */}
          {(selectedVariant ? selectedVariant.stock > 0 : product.stock > 0) ? (
            <div className="flex items-center gap-3 mt-auto">
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-gray-600 dark:text-gray-300 font-medium"
                >
                  -
                </button>
                <span className="px-4 py-2 font-medium text-gray-900 dark:text-white border-x border-gray-300 dark:border-gray-600 min-w-[40px] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(Math.min((selectedVariant ? selectedVariant.stock : product.stock), quantity + 1))}
                  className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-gray-600 dark:text-gray-300 font-medium"
                >
                  +
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition shadow-sm"
              >
                <ShoppingCart size={18} />
                Add to Cart
              </button>
            </div>
          ) : (
            <p className="text-red-500 font-semibold mt-auto">Out of Stock</p>
          )}

          {/* Inspection Upsell / Results */}
          <div className="mt-4 p-4 rounded-xl border border-brand-100 dark:border-brand-900/30 bg-brand-50/50 dark:bg-brand-900/10">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 bg-brand-100 dark:bg-brand-900/40 rounded-lg text-brand-600">
                <Shield size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  {product.inspections?.length > 0 ? 'Inspection History' : 'Professional Inspection'}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {product.inspections?.length > 0 
                    ? `This product has ${product.inspections.length} recorded inspection(s).`
                    : 'Get a comprehensive condition report by a certified inspector before you pay.'}
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              {product.inspections?.map((insp) => (
                <Link
                  key={insp.id}
                  to={`/verify/${insp.inspection_id}`}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                    insp.verdict === 'pass' 
                      ? 'bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-900/40' 
                      : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                  } hover:shadow-md`}
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                      {new Date(insp.created_at).toLocaleDateString()} • {insp.inspection_id}
                    </span>
                    <span className={`text-xs font-bold ${
                      insp.verdict === 'pass' ? 'text-green-600' : 'text-gray-700 dark:text-white'
                    }`}>
                      {insp.verdict ? `Verdict: ${insp.verdict.toUpperCase()}` : `Status: ${insp.status.replace('_', ' ').toUpperCase()}`}
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-brand-600 uppercase">View Report →</span>
                </Link>
              ))}

              <Link
                to={`/inspections/new?item_name=${encodeURIComponent(product.name)}&category_name=${encodeURIComponent(product.category_name)}&marketplace_product_id=${product.id}`}
                className="w-full btn-secondary py-2 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border-brand-200 hover:bg-brand-100 dark:border-brand-900/30 dark:hover:bg-brand-900/20 text-brand-600 mt-2"
              >
                {product.inspections?.length > 0 ? 'Request Re-Inspection' : 'Request Inspection'}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Reviews & Comments */}
      <ProductTabs productId={product.id} sellerUsername={product.seller_username} />
    </div>
  );
};

export default ProductDetailPage;
