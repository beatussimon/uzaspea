import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { Heart, ShoppingCart, Star, X, Share2, Shield, MessageSquare, MapPin, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { ProductTabs } from '../components/ProductTabs';
import SafeImage from '../components/SafeImage';
import toast from 'react-hot-toast';
import VerifiedBadge from '../components/VerifiedBadge';
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
  latitude?: string;
  longitude?: string;
  created_at?: string;
  sale_price?: string | null;
  unit_of_measure?: string;
  minimum_order_quantity?: string;
  price_tiers?: { id: number; min_quantity: string; max_quantity: string | null; unit_price: string }[];
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
          className="h-24 md:h-32 bg-black/80 border-t border-white/10 flex items-center justify-start md:justify-center gap-2 p-4 overflow-x-auto no-scrollbar w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => scrollToIndex(i)}
              className={`relative h-full aspect-[4/3] shrink-0 overflow-hidden rounded-none border-0 ring-0 transition-all ${
                currentIndex === i 
                  ? 'opacity-100 scale-105' 
                  : 'opacity-50 hover:opacity-90 scale-100'
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

const ProductMap = ({ lat, lng, isDesktop, locationName }: { lat: string | number, lng: string | number, isDesktop: boolean, locationName?: string }) => {
  const [showMap, setShowMap] = React.useState(isDesktop);

  if (!lat || !lng) return null;

  return (
    <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-4">
         <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
           <MapPin className="text-brand-500" />
           Location
         </h3>
         {!isDesktop && (
           <button onClick={() => setShowMap(!showMap)} className="text-xs px-3 py-1.5 rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400 font-bold hover:bg-brand-100 transition border border-brand-100 dark:border-brand-800">
             {showMap ? 'Hide Map' : 'Show Map'}
           </button>
         )}
      </div>
      {locationName && <p className="text-sm text-gray-500 mb-4 flex items-center gap-1.5"><MapPin size={14}/>{locationName}</p>}
      
      {showMap && (
        <div className="w-full h-64 md:h-96 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 relative z-0 bg-gray-100 dark:bg-gray-800">
          <iframe
            title="Location Map"
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            marginHeight={0}
            marginWidth={0}
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(lng)-0.02}%2C${Number(lat)-0.02}%2C${Number(lng)+0.02}%2C${Number(lat)+0.02}&layer=mapnik&marker=${lat}%2C${lng}`}
            className="w-full h-full"
          />
          <div className="absolute bottom-2 right-2 bg-white/90 dark:bg-black/90 px-3 py-1.5 text-[11px] rounded-lg shadow-lg z-10 backdrop-blur-md border border-gray-200 dark:border-gray-800">
            <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`} target="_blank" rel="noreferrer" className="text-brand-600 dark:text-brand-400 font-bold hover:underline flex items-center gap-1">
               Open Map
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const initialProduct = (location.state as any)?.initialProduct || null;

  const [product, setProduct] = useState<ProductData | null>(initialProduct);
  const [loading, setLoading] = useState(!initialProduct);
  const [selectedImage, setSelectedImage] = useState(0);
  const [liked, setLiked] = useState(initialProduct?.is_liked || false);
  const [likeCount, setLikeCount] = useState(initialProduct?.like_count || 0);
  const [quantity, setQuantity] = useState(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  const images = React.useMemo(() => {
    if (!product) return [{ id: 0, image: '' }];
    const baseImages = (product.images && product.images.length > 0)
      ? product.images
      : [{ id: 0, image: '' }];
    
    const vImages = variants
      .filter(v => v.image)
      .map(v => ({ id: `v-${v.id}`, image: v.image as string, variantId: v.id }));
      
    const combined: Array<{ id: string | number; image: string; variantId?: number }> = [...baseImages];
    for (const vImg of vImages) {
      if (!combined.find(img => img.image === vImg.image)) {
        combined.push(vImg);
      }
    }
    return combined;
  }, [product, variants]);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!slug) return;
    if (!product) setLoading(true);
    api.get(`/api/products/${slug}/`)
      .then((res) => {
        setProduct(res.data);
        setLikeCount(res.data.like_count);
        setLiked(res.data.is_liked || false);
        setQuantity(parseFloat(res.data.minimum_order_quantity) || 1);
        setLoading(false);
        // Fetch variants
        api.get(`/api/variants/?product=${res.data.id}`)
          .then((vRes) => {
            const list = vRes.data.results || vRes.data;
            setVariants(list);
            if (res.data.stock <= 0 && list.length > 0) {
              const firstAvailable = list.find((v: any) => v.stock > 0);
              if (firstAvailable) {
                setSelectedVariant(firstAvailable);
              }
            }
          })
          .catch(() => {});
      })
      .catch(() => {
        toast.error('Product not found');
        setLoading(false);
      });
  }, [slug]);

  const handleLike = async () => {
    if (!product) return;
    if (!isAuthenticated) {
      navigate('/login?next=' + encodeURIComponent(location.pathname + location.search));
      return;
    }
    // Optimistic update
    const previousLiked = liked;
    const previousCount = likeCount;
    setLiked(!previousLiked);
    setLikeCount(previousLiked ? Math.max(0, previousCount - 1) : previousCount + 1);

    try {
      const res = await api.post(`/api/products/${product.slug}/like/`);
      setLiked(res.data.liked);
      setLikeCount(res.data.like_count);
    } catch {
      // Revert on failure
      setLiked(previousLiked);
      setLikeCount(previousCount);
      toast.error('Failed to update like status');
    }
  };

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
      } catch {}
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
        id: `${product.id}-${selectedVariant.id}` as any
      } : product;
      addToCart(p, quantity);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!images || images.length <= 1 || lightboxOpen) return;
      if (e.key === 'ArrowLeft') {
        setSelectedImage(prev => (prev > 0 ? prev - 1 : images.length - 1));
      } else if (e.key === 'ArrowRight') {
        setSelectedImage(prev => (prev < images.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images, lightboxOpen]);

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
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">{t('product_not_found')}</h2>
        <Link to="/" className="text-brand-600 mt-4 inline-block hover:underline">← {t('back_to_products')}</Link>
      </div>
    );
  }

  const currentImageSrc = images[selectedImage]?.image || '';
  const currentUsername = localStorage.getItem('username');
  const isOwnProduct = Boolean(currentUsername && product.seller_username?.toLowerCase() === currentUsername.toLowerCase());

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
      {/* Lightbox */}
      {lightboxOpen && (
        <ImageLightbox
          images={images}
          initialIndex={selectedImage}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* LEFT SIDE: Media Stage (Full width on mobile, 100vh on desktop) */}
      <div className="relative w-full lg:w-[58%] xl:w-[62%] h-[52vh] min-h-[340px] sm:h-[56vh] lg:h-full bg-neutral-950 overflow-hidden flex flex-col items-center justify-between select-none group/stage shrink-0">
        
        {/* 1. TOP-LEFT OVERLAY: Close (X) + OKO Logo */}
        <div className="absolute top-3.5 left-3.5 z-40 flex items-center gap-3">
          {/* Bare X close button */}
          <button
            onPointerDown={(e) => {
              e.preventDefault(); // Prevent default touch behavior
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/products');
              }
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-white/90 hover:text-white hover:bg-black/50 rounded-full transition-all active:scale-95 cursor-pointer drop-shadow-lg"
            title="Close"
            aria-label="Close product view"
          >
            <X size={22} />
          </button>

          {/* Bare OKO Logo */}
          <button
            onClick={() => navigate('/')}
            className="h-8 sm:h-9 flex items-center justify-center transition-all active:scale-95 cursor-pointer drop-shadow-lg"
            title="Go to Homepage"
          >
            <img src="/logo.png" alt="OKO" className="h-full w-auto object-contain" />
          </button>
        </div>

        {/* 2. AMBIENT BLURRED BACKGROUND FILL */}
        {currentImageSrc && (
          <img
            src={currentImageSrc}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover filter blur-3xl opacity-40 scale-125 select-none pointer-events-none"
          />
        )}

        {/* 3. MAIN CRISP IMAGE (Constrained above thumbnail strip to prevent overlap) */}
        <div 
          className="relative z-10 w-full flex-1 flex items-center justify-center p-3 sm:p-6 pb-16 sm:pb-20 lg:pb-20 cursor-zoom-in overflow-hidden"
          onClick={() => setLightboxOpen(true)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedImage}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.03 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full flex items-center justify-center"
            >
              {currentImageSrc ? (
                <SafeImage
                  src={currentImageSrc}
                  alt={product.name}
                  category={product.category_name}
                  className="max-w-full max-h-[34vh] sm:max-h-[40vh] lg:max-h-[72vh] object-contain drop-shadow-2xl transition-transform duration-300"
                  containMode="contain"
                  loading="eager"
                />
              ) : (
                <SafeImage
                  src=""
                  alt={product.name}
                  category={product.category_name}
                  className="w-full h-full"
                  transparent
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 4. OVERLAID PREVIOUS ARROW (<) - Hidden on mobile */}
        {images.length > 1 && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(prev => (prev > 0 ? prev - 1 : images.length - 1));
            }}
            className="hidden sm:flex absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-[#242526]/80 hover:bg-[#3a3b3c] text-white rounded-full items-center justify-center shadow-2xl backdrop-blur-md transition-all hover:scale-110 active:scale-95 z-30 cursor-pointer"
            aria-label="Previous image"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
        )}

        {/* 5. OVERLAID NEXT ARROW (>) - Hidden on mobile */}
        {images.length > 1 && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(prev => (prev < images.length - 1 ? prev + 1 : 0));
            }}
            className="hidden sm:flex absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-[#242526]/80 hover:bg-[#3a3b3c] text-white rounded-full items-center justify-center shadow-2xl backdrop-blur-md transition-all hover:scale-110 active:scale-95 z-30 cursor-pointer"
            aria-label="Next image"
          >
            <ChevronRight size={24} strokeWidth={2.5} />
          </button>
        )}

        {/* 7. BARE FLOATING THUMBNAILS AT BOTTOM (Positioned cleanly below image area, never overlapping) */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 max-w-[95%] overflow-x-auto no-scrollbar px-1 py-0.5">
            {images.map((img, idx) => (
              <button
                key={img.id}
                onMouseEnter={() => setSelectedImage(idx)}
                onClick={() => setSelectedImage(idx)}
                className={`relative shrink-0 w-12 h-9 sm:w-14 sm:h-10 md:w-16 md:h-12 overflow-hidden border-0 ring-0 rounded-none transition-all cursor-pointer ${
                  idx === selectedImage
                    ? 'opacity-100 scale-105 shadow-2xl'
                    : 'opacity-50 hover:opacity-90 scale-100'
                }`}
              >
                <SafeImage src={img.image} alt="" category={product.category_name} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT SIDE: Product Info & Buy Sidebar */}
      <div className="w-full lg:w-[42%] xl:w-[38%] h-auto lg:h-full bg-white dark:bg-[#18191a] text-gray-900 dark:text-white border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-neutral-800 overflow-y-visible lg:overflow-y-auto p-5 sm:p-6 lg:p-7 flex flex-col gap-5 shrink-0">
          {/* Header Area */}
          <div>
            <div className="flex flex-wrap justify-between items-start gap-4 mb-2">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link 
                    to={`/?category=${product.category_name}`} 
                    className="text-xs font-black uppercase tracking-widest text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                  >
                    {product.category_name}
                  </Link>
                  <span className="text-gray-300 dark:text-gray-600 font-bold">•</span>
                  <span className={`px-2 py-0.5 rounded-card text-[10px] font-black uppercase tracking-wider ${
                    product.condition === 'New' 
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}>
                    {product.condition}
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white leading-tight tracking-tight">
                  {product.name}
                </h1>
              </div>

              {/* Action Buttons (Like, Share) */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 bg-surface-muted dark:bg-[#242526] rounded-full p-1 pr-2 border border-gray-200 dark:border-gray-800">
                  <button
                    onClick={handleLike}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
                      liked
                        ? 'bg-red-500 text-white shadow-md'
                        : 'bg-white dark:bg-[#3a3b3c] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#4e4f50] shadow-sm'
                    }`}
                    title="Like"
                  >
                    <Heart size={16} className={liked ? 'fill-current' : ''} />
                  </button>
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300 px-1">{likeCount}</span>
                </div>
                <button
                  onClick={handleShare}
                  className="w-10 h-10 bg-surface-muted dark:bg-[#242526] hover:bg-gray-200 dark:hover:bg-[#3a3b3c] text-gray-700 dark:text-gray-200 rounded-full flex items-center justify-center transition-all active:scale-95 border border-gray-200 dark:border-gray-800"
                  title="Share"
                >
                  <Share2 size={18} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              {product.location_name && (
                <span className="flex items-center gap-1">
                  <MapPin size={13} className="text-gray-400" />
                  {product.location_name}
                </span>
              )}
              {product.created_at && (
                <span className="flex items-center gap-1">
                  <Clock size={13} className="text-gray-400" />
                  {t('posted')} {timeAgo(product.created_at)}
                </span>
              )}
            </div>
          </div>

          <hr className="border-gray-200 dark:border-neutral-800 my-1" />

          {/* Price & Badge */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                TSh {(selectedVariant ? parseInt(selectedVariant.price_adjustment) + parseInt(product.price) : parseInt(product.sale_price || product.price)).toLocaleString()}
              </span>
              {product.sale_price && !selectedVariant && (
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-400 line-through decoration-red-500/50 decoration-2">
                    TSh {parseInt(product.price).toLocaleString()}
                  </span>
                  <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-md uppercase tracking-wider shadow-sm shadow-red-500/20">
                    {Math.round(((parseInt(product.price) - parseInt(product.sale_price)) / parseInt(product.price)) * 100)}% {t('off_caps')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {variants.length > 0 && (
            <>
              <hr className="border-gray-200 dark:border-neutral-800 my-1" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">Select Variation</span>
                  {selectedVariant && (
                    <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                      TSh {(parseInt(product.price) + parseInt(selectedVariant.price_adjustment)).toLocaleString()}
                    </span>
                  )}
                </div>
                
                {/* Visual variant selector */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setSelectedVariant(null);
                      setSelectedImage(0);
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border-2 ${
                      !selectedVariant 
                        ? 'border-amber-400 bg-amber-400/10 text-amber-500 dark:text-amber-400 dark:border-amber-400' 
                        : 'border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    Standard
                  </button>
                  {variants.map(v => (
                    <button
                      key={v.id}
                      onClick={() => {
                        setSelectedVariant(v);
                        if (v.image) {
                          const idx = images.findIndex((img: any) => img.variantId === v.id || img.image === v.image);
                          if (idx !== -1) setSelectedImage(idx);
                        }
                      }}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all border-2 flex items-center gap-2 ${
                        selectedVariant?.id === v.id
                          ? 'border-amber-400 bg-amber-400/10 text-amber-500 dark:text-amber-400 dark:border-amber-400'
                          : v.stock <= 0
                            ? 'border-transparent bg-gray-50 text-gray-400 cursor-not-allowed dark:bg-gray-800/50 dark:text-gray-600'
                            : 'border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      {v.image && (
                        <SafeImage src={v.image} alt={v.name} category="product" className={`w-5 h-5 rounded-full object-cover shrink-0 ${v.stock <= 0 ? 'opacity-50 grayscale' : ''}`} />
                      )}
                      <span className={v.stock <= 0 ? 'line-through opacity-70' : ''}>{v.name}</span>
                      {v.stock <= 0 ? (
                        <span className="text-[10px] uppercase text-red-500/80 dark:text-red-400/80 font-black ml-1">(Out of stock)</span>
                      ) : v.price_adjustment !== '0.00' && (
                        <span className="opacity-75 text-xs ml-1">
                          (+TSh {parseInt(v.price_adjustment).toLocaleString()})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <hr className="border-gray-200 dark:border-neutral-800 my-1" />

          {/* UOM and Tiered Pricing info */}
          <div className="flex flex-col gap-2 mb-3 bg-brand-50/50 dark:bg-brand-900/10 p-3 rounded-xl border border-brand-100 dark:border-brand-800/30">
            <div className="flex justify-between items-center text-xs">
               <span className="font-semibold text-gray-600 dark:text-gray-400">Unit of Measure:</span>
               <span className="font-bold text-gray-900 dark:text-white capitalize">{product.unit_of_measure || 'piece'}</span>
            </div>
            {product.minimum_order_quantity && parseFloat(product.minimum_order_quantity) > 1 && (
              <div className="flex justify-between items-center text-xs text-brand-600 dark:text-brand-400">
                 <span className="font-semibold">Minimum Order (MOQ):</span>
                 <span className="font-bold">{product.minimum_order_quantity} {product.unit_of_measure}</span>
              </div>
            )}
            {product.price_tiers && product.price_tiers.length > 0 && (
              <div className="mt-2 text-xs border-t border-brand-200/50 dark:border-brand-800/50 pt-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">Volume Discounts:</span>
                <div className="space-y-1">
                  {product.price_tiers.map(tier => (
                    <div key={tier.id} className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>{parseFloat(tier.min_quantity)} {tier.max_quantity ? `- ${parseFloat(tier.max_quantity)}` : '+'} {product.unit_of_measure}s</span>
                      <span className="font-bold text-gray-900 dark:text-white">TSh {parseInt(tier.unit_price).toLocaleString()} / {product.unit_of_measure}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cart & Action Buttons */}
          <div className="flex flex-col gap-3">
            {(selectedVariant ? selectedVariant.stock > 0 : product.stock > 0) ? (
              isOwnProduct ? (
                <div className="p-3.5 bg-gray-100 dark:bg-[#242526] rounded-full text-center border border-gray-200 dark:border-neutral-800 text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {t('this_is_your_listing')}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-full bg-gray-50 dark:bg-gray-900 overflow-hidden shrink-0">
                    <button onClick={() => setQuantity(Math.max(parseFloat(product.minimum_order_quantity || '1'), quantity - 1))} className="px-2.5 py-1.5 sm:px-3 sm:py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-600 dark:text-gray-300 font-bold text-xs">−</button>
                    <input type="number" min={product.minimum_order_quantity || "1"} max={selectedVariant ? selectedVariant.stock : product.stock} step="any" value={quantity} onChange={e => setQuantity(parseFloat(e.target.value) || (parseFloat(product.minimum_order_quantity || '1')))} className="bg-transparent font-extrabold text-gray-900 dark:text-white border-x border-gray-200 dark:border-gray-700 w-16 text-center text-xs focus:outline-none" />
                    <button onClick={() => setQuantity(Math.min((selectedVariant ? selectedVariant.stock : product.stock), quantity + 1))} className="px-2.5 py-1.5 sm:px-3 sm:py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-600 dark:text-gray-300 font-bold text-xs">+</button>
                  </div>
                  <button onClick={handleAddToCart} className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-4 bg-amber-400 hover:bg-amber-500 text-black font-extrabold rounded-full transition shadow-md active:scale-98 text-xs sm:text-sm tracking-wide">
                    <ShoppingCart size={15} strokeWidth={2.5} className="shrink-0" />
                    <span className="truncate">{t('add_to_cart')}</span>
                  </button>
                  <span className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[11px] font-bold shrink-0">
                    {selectedVariant ? selectedVariant.stock : product.stock} {t('in_stock')}
                  </span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-3">
                <button disabled className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold rounded-full cursor-not-allowed text-xs">
                  {t('out_of_stock')}
                </button>
              </div>
            )}
          </div>

          <hr className="border-gray-200 dark:border-neutral-800 my-1" />

          {/* Description */}
          <div>
             <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{t('description')}</h3>
             <p className={`text-gray-700 dark:text-gray-300 leading-relaxed text-base whitespace-pre-line ${!isDescExpanded ? 'line-clamp-4' : ''}`}>
               {product.description}
             </p>
             {product.description && product.description.length > 200 && (
               <button onClick={() => setIsDescExpanded(!isDescExpanded)} className="mt-2 text-xs font-bold text-gray-900 dark:text-white hover:underline uppercase tracking-wider">
                 {isDescExpanded ? t('see_less') : t('see_more')}
               </button>
             )}
          </div>

          <hr className="border-gray-200 dark:border-neutral-800 my-1" />

          {/* Merchant Trust */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                {product.seller_profile_picture ? (
                  <img src={product.seller_profile_picture} alt={product.seller_username} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl md:text-2xl font-black text-gray-500 dark:text-gray-400 uppercase">
                    {product.seller_username.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <Link to={`/${product.seller_username}`} className="text-base md:text-lg font-bold text-gray-900 dark:text-white hover:underline transition">
                    {product.seller_username}
                  </Link>
                  <VerifiedBadge tier={product.seller_tier} isVerified={product.seller_verified} className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-1">
                  {product.avg_rating > 0 ? (
                    <>
                      <div className="flex text-amber-400">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} size={11} className={star <= product.avg_rating ? 'fill-current' : 'text-gray-200 dark:text-gray-700'} />
                        ))}
                      </div>
                      <span className="text-[10px] font-bold text-gray-500">({product.avg_rating})</span>
                    </>
                  ) : (
                    <span className="text-[10px] text-gray-400 italic">{t('no_reviews_yet', 'No reviews yet')}</span>
                  )}
                </div>
              </div>
            </div>
            
            {product.seller_username !== localStorage.getItem('username') && (
              <button
                onClick={async () => {
                  try {
                    const convRes = await api.post('/api/conversations/', { seller: product.seller, product: product.id });
                    const convId = convRes.data.id;
                    // Only send context message if it's the first message or a new product inquiry
                    if (!convRes.data.last_message || convRes.data.product !== product.id) {
                      await api.post(`/api/conversations/${convId}/messages/`, {
                        content: `Hi, I'm interested in your listing: "${product.name}" (TZS ${Number(product.price).toLocaleString()}). Could you provide more details?`
                      });
                    }
                    navigate(`/messages/${convId}`);
                  } catch { toast.error('Login to message seller'); }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold transition-colors"
              >
                <MessageSquare size={14} /> {t('contact')}
              </button>
            )}
          </div>

          {/* Verification & Inspection Services */}
          {(isOwnProduct || (product.inspections && product.inspections.length > 0)) && (
            <>
              <hr className="border-gray-200 dark:border-neutral-800 my-1" />
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-brand-500" />
                  <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                    {product.inspections?.length > 0 ? t('inspection_history') : t('professional_inspection')}
                  </h4>
                  {product.is_verified && (
                    <span className="px-1.5 py-0.5 bg-brand-600 text-white text-[8px] font-black rounded-card uppercase tracking-widest">Verified</span>
                  )}
                </div>
                
                <div className="space-y-2">
                  {product.inspections?.map((insp) => (
                    <Link key={insp.id} to={`/verify/${insp.inspection_id}`} className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                      insp.verdict === 'pass' ? 'bg-emerald-50/40 border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-900/30' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                    }`}>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                          {new Date(insp.created_at).toLocaleDateString()} • {insp.inspection_id}
                        </span>
                        <span className={`text-[11px] font-extrabold mt-0.5 ${insp.verdict === 'pass' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>
                          {insp.verdict ? `Verdict: ${insp.verdict.toUpperCase()}` : `Status: ${insp.status.replace('_', ' ').toUpperCase()}`}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase">{t('report')} →</span>
                    </Link>
                  ))}

                  {isOwnProduct && (
                    <Link to={`/inspections/new?item_name=${encodeURIComponent(product.name)}&category_name=${encodeURIComponent(product.category_name)}&marketplace_product_id=${product.id}`}
                      className="block w-full py-2.5 rounded-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest text-center transition"
                    >
                      {product.inspections?.length > 0 ? t('request_reinspection') : t('request_inspection')}
                    </Link>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Map Location */}
          {product.latitude && product.longitude && (
            <ProductMap lat={product.latitude} lng={product.longitude} locationName={product.location_name} isDesktop={isDesktop} />
          )}

          {/* Product Reviews & Comments */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
            <ProductTabs productId={product.id} sellerUsername={product.seller_username} />
          </div>
        </div>
    </div>
  );
};

export default ProductDetailPage;
