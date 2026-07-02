import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Star, X, Share2, Shield, MessageSquare, Bell, ChevronDown, ChevronUp, MapPin, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import { useCart } from '../context/CartContext';
import { ProductTabs } from '../ProductTabs';
import SafeImage from '../components/SafeImage';
import toast from 'react-hot-toast';
import VerifiedBadge from '../components/VerifiedBadge';
import Breadcrumbs from '../components/Breadcrumbs';
import { Skeleton } from '../components/Skeleton';
import { timeAgo } from '../utils/timeAgo';

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
  location_name?: string;
  created_at?: string;
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
const ImageLightbox = ({ 
  images, 
  initialIndex, 
  onClose 
}: { 
  images: any[]; 
  initialIndex: number; 
  onClose: () => void;
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && currentIndex < images.length - 1) scrollToIndex(currentIndex + 1);
      if (e.key === 'ArrowLeft' && currentIndex > 0) scrollToIndex(currentIndex - 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, images.length, onClose]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: scrollRef.current.offsetWidth * currentIndex, behavior: 'auto' });
    }
  }, []);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollLeft = scrollRef.current.scrollLeft;
    const width = scrollRef.current.offsetWidth;
    const index = Math.round(scrollLeft / width);
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  const scrollToIndex = (index: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ left: scrollRef.current.offsetWidth * index, behavior: 'smooth' });
    setCurrentIndex(index);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex < images.length - 1) scrollToIndex(currentIndex + 1);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) scrollToIndex(currentIndex - 1);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" onClick={onClose}>
      
      {/* Top right close button (modeled as exit-fullscreen) */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 p-3 text-white hover:bg-white/10 rounded-xl transition z-50"
        aria-label="Close fullscreen"
      >
        <X size={28} />
      </button>

      {/* Main Image Slider */}
      <div className="flex-1 relative w-full overflow-hidden flex items-center justify-center">
        
        {/* Swipeable Container */}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar w-full h-full"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <div key={i} className="flex-none w-full h-full snap-center flex items-center justify-center p-4 md:p-12">
              <img
                src={img.image || ''}
                alt={`Image ${i + 1}`}
                className="max-w-full max-h-full object-contain drop-shadow-2xl"
                draggable={false}
              />
            </div>
          ))}
        </div>

        {/* Left Arrow */}
        {currentIndex > 0 && (
          <button 
            onClick={handlePrev}
            className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white hover:scale-110 transition-all active:scale-95 z-50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
          >
            <ChevronLeft size={48} strokeWidth={2} />
          </button>
        )}

        {/* Right Arrow */}
        {currentIndex < images.length - 1 && (
          <button 
            onClick={handleNext}
            className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white hover:scale-110 transition-all active:scale-95 z-50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
          >
            <ChevronRight size={48} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Thumbnails strip at bottom */}
      {images.length > 1 && (
        <div 
          className="h-24 md:h-32 bg-black/80 border-t border-white/10 flex items-center justify-center gap-2 p-4 overflow-x-auto no-scrollbar w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => scrollToIndex(i)}
              className={`relative h-full aspect-[4/3] shrink-0 overflow-hidden rounded bg-gray-900 transition-all ${
                currentIndex === i 
                  ? 'ring-2 ring-brand-500 opacity-100 scale-105' 
                  : 'opacity-50 hover:opacity-80'
              }`}
            >
              <img 
                src={img.image || ''} 
                alt={`Thumbnail ${i + 1}`}
                className="w-full h-full object-cover"
                draggable={false}
              />
            </button>
          ))}
        </div>
      )}

    </div>
  );
};

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
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const isAuthenticated = !!localStorage.getItem('access_token');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api.get(`/api/products/${slug}/`)
      .then((res) => {
        setProduct(res.data);
        setLikeCount(res.data.like_count);
        setLiked(res.data.is_liked || false);
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
      text: `${product?.name} — TSh ${parseInt(product?.price || '0').toLocaleString()} on SokoniMax`,
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
        <Link to="/" className="text-brand-600 mt-4 inline-block hover:underline">← Back to products</Link>
      </div>
    );
  }

  const images = product.images.length > 0
    ? product.images
    : [{ id: 0, image: '' }];

  const currentImageSrc = images[selectedImage]?.image || '';
  const isOwnProduct = product.seller_username === localStorage.getItem('username');

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      {/* Lightbox */}
      {lightboxOpen && (
        <ImageLightbox
          images={images}
          initialIndex={selectedImage}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* Breadcrumb */}
      <Breadcrumbs />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left Column: Image Gallery + Comments (Desktop) */}
        <div className="flex flex-col gap-6 w-full">
          <div className="flex flex-col md:flex-row-reverse gap-4">
            <div
              className="flex-1 aspect-square bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm cursor-zoom-in relative"
              onClick={() => setLightboxOpen(true)}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedImage}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.3 }}
                  className="w-full h-full"
                >
                  <SafeImage
                    src={currentImageSrc}
                    alt={product.name}
                    category={product.category_name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500 ease-out"
                    loading="eager"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            {images.length > 1 && (
              <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto pb-2 md:pb-0 md:w-20 shrink-0 no-scrollbar">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(idx)}
                    className={`shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                      idx === selectedImage
                        ? 'border-brand-500 shadow-md scale-100 ring-2 ring-brand-500/20 ring-offset-2 dark:ring-offset-gray-900'
                        : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 scale-95 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <SafeImage src={img.image} alt="" category={product.category_name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Comments on Desktop */}
          {isDesktop && (
            <div className="mt-4">
              <ProductTabs productId={product.id} sellerUsername={product.seller_username} />
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex flex-col">
          {/* Top Badge Bar */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Link 
              to={`/?category=${product.category_name}`} 
              className="text-xs font-black uppercase tracking-widest text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            >
              {product.category_name}
            </Link>
            <span className="text-gray-300 dark:text-gray-600 font-bold">•</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              product.condition === 'New' 
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30' 
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200/30 dark:border-gray-700/30'
            }`}>
              {product.condition}
            </span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight mb-2 tracking-tight">
            {product.name}
          </h1>

          {/* Meta-info row */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-6">
            {product.location_name && (
              <span className="flex items-center gap-1">
                <MapPin size={13} className="text-gray-400" />
                {product.location_name}
              </span>
            )}
            {product.created_at && (
              <span className="flex items-center gap-1">
                <Clock size={13} className="text-gray-400" />
                Posted {timeAgo(product.created_at)}
              </span>
            )}
          </div>

          {/* Premium Price & Alert Card */}
          <div className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-800/40 dark:to-gray-900/40 rounded-3xl p-6 border border-gray-105 dark:border-gray-700/80 mb-6 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Price</span>
                <div className="flex flex-wrap items-baseline gap-3">
                  <p className="text-4xl font-black text-brand-600 dark:text-brand-400 tracking-tight">
                    TSh {selectedVariant ? selectedVariant.final_price.toLocaleString() : parseInt(product.price).toLocaleString()}
                  </p>
                  {product.old_price && parseInt(product.old_price) > parseInt(product.price) && !selectedVariant && (
                    <div className="flex items-center gap-2">
                      <span className="text-lg text-gray-400 line-through font-medium">
                        TSh {parseInt(product.old_price).toLocaleString()}
                      </span>
                      <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-md uppercase tracking-wider shadow-sm shadow-red-500/20">
                        {Math.round(((parseInt(product.old_price) - parseInt(product.price)) / parseInt(product.old_price)) * 100)}% OFF
                      </span>
                    </div>
                  )}
                </div>
              </div>
                      {/* Like / Wishlist & Share buttons directly on price block */}
              <div className="flex gap-2">
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all duration-200 active:scale-95 ${
                    liked
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/20 text-red-500 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-red-400 hover:text-red-500'
                  }`}
                >
                  <Heart size={18} className={liked ? 'fill-current' : ''} />
                  <span className="text-xs font-bold">{likeCount}</span>
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center justify-center p-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:border-brand-500 hover:text-brand-500 transition shadow-sm bg-white dark:bg-gray-800"
                  title="Share Product"
                >
                  <Share2 size={18} />
                </button>
              </div>
            </div>

            {/* Price Alert Bar integrated inside the Card */}
            {isAuthenticated && (
              <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700/60 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">TSh</span>
                  <input 
                    type="number" 
                    placeholder="Alert when price drops to..."
                    value={alertPrice} 
                    onChange={e => setAlertPrice(e.target.value)}
                    className="w-full p-2.5 pl-10 pr-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-xs focus:ring-2 focus:ring-brand-500 outline-none transition" 
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
                  className="px-4 py-2.5 bg-white dark:bg-gray-800 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Bell size={13} /> Set Alert
                </button>
              </div>
            )}
          </div>

          {/* Premium Merchant Trust Card */}
          <div className="bg-white dark:bg-gray-800/10 rounded-3xl p-5 border border-gray-100 dark:border-gray-700/80 mb-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center border border-brand-100 dark:border-brand-800 shrink-0">
                  {product.seller_profile_picture ? (
                    <img src={product.seller_profile_picture} alt={product.seller_username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-black text-brand-600 dark:text-brand-400 uppercase">
                      {product.seller_username.charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Link to={`/profile/${product.seller_username}`} className="font-bold text-gray-900 dark:text-white hover:text-brand-600 hover:underline transition">
                      {product.seller_username}
                    </Link>
                    <VerifiedBadge tier={product.seller_tier} isVerified={product.seller_verified} className="w-4 h-4" />
                  </div>
                  {/* Merchant Rating */}
                  <div className="flex items-center gap-1 mt-1">
                    {product.avg_rating > 0 ? (
                      <>
                        <div className="flex text-amber-400">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} size={13} className={star <= product.avg_rating ? 'fill-current' : 'text-gray-200 dark:text-gray-700'} />
                          ))}
                        </div>
                        <span className="text-[10px] font-bold text-gray-500">({product.avg_rating}/5)</span>
                      </>
                    ) : (
                      <span className="text-[10px] text-gray-400 italic font-medium">No reviews yet</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Message Seller Button */}
              {product.seller_username !== localStorage.getItem('username') && (
                <button
                  onClick={async () => {
                    try {
                      const convRes = await api.post('/api/conversations/', { seller: product.seller, product: product.id });
                      await api.post(`/api/conversations/${convRes.data.id}/messages/`, {
                        content: `Hi, I'm interested in your listing: "${product.name}" (TZS ${Number(product.price).toLocaleString()}). Could you provide more details?`
                      });
                      navigate(`/messages?conv=${convRes.data.id}`);
                    } catch { toast.error('Login to message seller'); }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-brand-50 dark:bg-brand-900/30 border border-brand-100 dark:border-brand-900/40 text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-wider hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-all shadow-sm"
                >
                  <MessageSquare size={14} /> Contact
                </button>
              )}
            </div>
          </div>

          {/* Description Section */}
          <div className="bg-white dark:bg-gray-800/10 rounded-3xl p-5 border border-gray-100 dark:border-gray-700/80 mb-6 shadow-sm">
             <button 
                onClick={() => setIsDescExpanded(!isDescExpanded)}
                className="w-full flex items-center justify-between group"
             >
                 <h3 className="text-xs font-black text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 uppercase tracking-widest transition-colors">Description</h3>
                 {isDescExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
             </button>
             
             <AnimatePresence>
                 {isDescExpanded && (
                     <motion.div 
                         initial={{ height: 0, opacity: 0 }}
                         animate={{ height: 'auto', opacity: 1 }}
                         exit={{ height: 0, opacity: 0 }}
                         transition={{ duration: 0.3 }}
                         className="overflow-hidden"
                     >
                         <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm whitespace-pre-line mt-4">
                           {product.description}
                         </p>
                     </motion.div>
                 )}
             </AnimatePresence>
             {!isDescExpanded && (
                 <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm whitespace-pre-line mt-4 line-clamp-3">
                   {product.description}
                 </p>
             )}
          </div>

          {/* Premium Cart and Actions Panel */}
          <div className="bg-white dark:bg-gray-800/10 rounded-3xl p-6 border border-gray-100 dark:border-gray-700/60 mb-6 space-y-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Availability</span>
              {product.stock > 0 ? (
                <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 rounded-full text-xs font-bold">
                  {product.stock} in stock
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded-full text-xs font-bold">
                  Out of stock
                </span>
              )}
            </div>

            {/* Variant selector */}
            {variants.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Select Option</label>
                <select
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-900 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition"
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
                       {v.name} {v.price_adjustment !== '0.00' ? `(+TSh ${parseInt(v.price_adjustment).toLocaleString()})` : ''} {v.stock === 0 ? '- Out of Stock' : ''}
                     </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quantity Picker & Add to Cart Action */}
            {(selectedVariant ? selectedVariant.stock > 0 : product.stock > 0) ? (
              isOwnProduct ? (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-center border border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  This is your own listing
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-900 overflow-hidden shrink-0">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3.5 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-600 dark:text-gray-300 font-bold text-base"
                    >
                      −
                    </button>
                    <span className="px-4 py-3 font-extrabold text-gray-900 dark:text-white border-x border-gray-200 dark:border-gray-700 min-w-[44px] text-center text-sm">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(Math.min((selectedVariant ? selectedVariant.stock : product.stock), quantity + 1))}
                      className="px-3.5 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-600 dark:text-gray-300 font-bold text-base"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white font-extrabold rounded-2xl transition shadow-lg shadow-brand-600/25 active:scale-98"
                  >
                    <ShoppingCart size={18} />
                    Add to Cart
                  </button>
                </div>
              )
            ) : (
              <p className="text-red-500 font-bold text-center py-2 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-sm">Out of Stock</p>
            )}
          </div>

          {/* Premium Verification & Inspection Services */}
          {(isOwnProduct || (product.inspections && product.inspections.length > 0)) && (
            <div className="p-6 rounded-3xl border border-brand-100/80 dark:border-brand-900/30 bg-gradient-to-br from-brand-50/50 to-white dark:from-brand-950/10 dark:to-gray-900/20 shadow-sm mb-6">
              <div className="flex items-start gap-3.5 mb-4">
                <div className="p-3 bg-brand-100 dark:bg-brand-900/40 rounded-2xl text-brand-600 dark:text-brand-400">
                  <Shield size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      {product.inspections?.length > 0 ? 'Inspection History' : 'Professional Inspection'}
                    </h4>
                    {product.is_verified && (
                      <span className="px-2 py-0.5 bg-brand-600 text-white text-[8px] font-black rounded-full uppercase tracking-widest shadow-sm shadow-brand-600/30">Verified</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                    {product.inspections?.length > 0 
                      ? `This product has verified inspection records on file.`
                      : 'Request a certified inspector to examine this item for safety & verification.'}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2.5">
                {product.inspections?.map((insp) => (
                  <Link
                    key={insp.id}
                    to={`/verify/${insp.inspection_id}`}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 ${
                      insp.verdict === 'pass' 
                        ? 'bg-emerald-50/40 border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-900/30 hover:border-emerald-200' 
                        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:shadow-md'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                        {new Date(insp.created_at).toLocaleDateString()} • {insp.inspection_id}
                      </span>
                      <span className={`text-xs font-extrabold mt-0.5 ${
                        insp.verdict === 'pass' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-white'
                      }`}>
                        {insp.verdict ? `Verdict: ${insp.verdict.toUpperCase()}` : `Status: ${insp.status.replace('_', ' ').toUpperCase()}`}
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-widest">Report →</span>
                  </Link>
                ))}

                {isOwnProduct && (
                  <div className="flex gap-2">
                    <Link
                      to={`/inspections/new?item_name=${encodeURIComponent(product.name)}&category_name=${encodeURIComponent(product.category_name)}&marketplace_product_id=${product.id}`}
                      className="w-full py-3 rounded-2xl bg-white dark:bg-gray-800 border border-brand-200 dark:border-brand-800 hover:bg-brand-50 dark:hover:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-widest text-center transition shadow-sm"
                    >
                      {product.inspections?.length > 0 ? 'Request Re-Inspection' : 'Request Inspection'}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}        </div>

        </div>

      {/* Tabs: Reviews & Comments (Mobile/Tablet) */}
      {!isDesktop && (
        <div className="mt-8">
          <ProductTabs productId={product.id} sellerUsername={product.seller_username} />
        </div>
      )}
    </div>
  );
};

export default ProductDetailPage;
