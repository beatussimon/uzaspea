import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Star, X, Share2, Shield, MessageSquare, MapPin, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
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
  latitude?: string;
  longitude?: string;
  created_at?: string;
  sale_price?: string | null;
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
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  

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

  const images = React.useMemo(() => {
    if (!product) return [{ id: 0, image: '' }];
    const baseImages = (product.images && product.images.length > 0)
      ? product.images
      : [{ id: 0, image: '' }];
    
    const vImages = variants
      .filter(v => v.image)
      .map(v => ({ id: `v-${v.id}`, image: v.image as string, variantId: v.id }));
      
    // Deduplicate exact same URLs if needed, but simple append works for gallery
    const combined: Array<{ id: string | number; image: string; variantId?: number }> = [...baseImages];
    for (const vImg of vImages) {
      if (!combined.find(img => img.image === vImg.image)) {
        combined.push(vImg);
      }
    }
    return combined;
  }, [product, variants]);

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: Image Gallery + Comments (Desktop) */}
        <div className="flex flex-col gap-6 w-full lg:col-span-6">
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

              {/* Floating Like + Share on image */}
              <div className="absolute top-4 right-4 flex flex-col gap-3 z-10" onClick={e => e.stopPropagation()}>
                <button
                  onClick={handleLike}
                  className={`w-14 h-14 rounded-full backdrop-blur-md flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95 ${
                    liked
                      ? 'bg-red-50/90 dark:bg-red-950/80 text-red-500'
                      : 'bg-white/90 dark:bg-gray-800/90 text-gray-500 hover:text-red-500 hover:bg-red-50/90 dark:hover:bg-red-950/80'
                  }`}
                  title="Like"
                >
                  <Heart size={28} className={liked ? 'fill-current' : ''} />
                </button>
                {likeCount > 0 && (
                  <span className="text-center text-[11px] font-black text-white drop-shadow">{likeCount}</span>
                )}
                <button
                  onClick={handleShare}
                  className="w-14 h-14 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-md flex items-center justify-center shadow-lg text-gray-500 hover:text-brand-500 hover:bg-brand-50/90 dark:hover:bg-brand-950/80 transition-all duration-200 active:scale-95"
                  title="Share"
                >
                  <Share2 size={28} />
                </button>
              </div>
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
        <div className="flex flex-col gap-6 w-full lg:col-span-6">
          {/* Header Area */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Link 
                to={`/?category=${product.category_name}`} 
                className="text-xs font-black uppercase tracking-widest text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
              >
                {product.category_name}
              </Link>
              <span className="text-gray-300 dark:text-gray-600 font-bold">•</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                product.condition === 'New' 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}>
                {product.condition}
              </span>
            </div>

            <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight mb-2 tracking-tight">
              {product.name}
            </h1>

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

          <hr className="border-gray-100 dark:border-gray-800" />

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
            <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">Select Variation</span>
                {selectedVariant && (
                  <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                    TSh {(parseInt(product.price) + parseInt(selectedVariant.price_adjustment)).toLocaleString()}
                  </span>
                )}
              </div>
              
              {/* Visual variant selector instead of select dropdown */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setSelectedVariant(null);
                    setSelectedImage(0); // Go back to default image
                  }}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                    !selectedVariant 
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-500' 
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
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 flex items-center gap-2 ${
                      selectedVariant?.id === v.id
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-500'
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
          )}

          <hr className="border-gray-100 dark:border-gray-800" />

          {/* Cart & Variants */}
          <div className="flex flex-col gap-4">
            {(selectedVariant ? selectedVariant.stock > 0 : product.stock > 0) ? (
              isOwnProduct ? (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-center border border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {t('this_is_your_listing')}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 overflow-hidden shrink-0">
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-600 dark:text-gray-300 font-bold text-sm">−</button>
                    <span className="px-3 py-2.5 font-extrabold text-gray-900 dark:text-white border-x border-gray-200 dark:border-gray-700 min-w-[40px] text-center text-sm">{quantity}</span>
                    <button onClick={() => setQuantity(Math.min((selectedVariant ? selectedVariant.stock : product.stock), quantity + 1))} className="px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-600 dark:text-gray-300 font-bold text-sm">+</button>
                  </div>
                  <button onClick={handleAddToCart} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold rounded-xl transition shadow-sm active:scale-98 text-sm">
                    <ShoppingCart size={16} /> {t('add_to_cart')}
                  </button>
                  <span className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold whitespace-nowrap">
                    {selectedVariant ? selectedVariant.stock : product.stock} {t('in_stock')}
                  </span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-3">
                <button disabled className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold rounded-xl cursor-not-allowed text-sm">
                  {t('out_of_stock')}
                </button>
              </div>
            )}
          </div>

          <hr className="border-gray-100 dark:border-gray-800" />

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

          <hr className="border-gray-100 dark:border-gray-800" />

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
                  <Link to={`/profile/${product.seller_username}`} className="text-base md:text-lg font-bold text-gray-900 dark:text-white hover:underline transition">
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
                    await api.post(`/api/conversations/${convRes.data.id}/messages/`, {
                      content: `Hi, I'm interested in your listing: "${product.name}" (TZS ${Number(product.price).toLocaleString()}). Could you provide more details?`
                    });
                    navigate(`/messages?conv=${convRes.data.id}`);
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
              <hr className="border-gray-100 dark:border-gray-800" />
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-brand-500" />
                  <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                    {product.inspections?.length > 0 ? t('inspection_history') : t('professional_inspection')}
                  </h4>
                  {product.is_verified && (
                    <span className="px-1.5 py-0.5 bg-brand-600 text-white text-[8px] font-black rounded uppercase tracking-widest">Verified</span>
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
                      className="block w-full py-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest text-center transition"
                    >
                      {product.inspections?.length > 0 ? t('request_reinspection') : t('request_inspection')}
                    </Link>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Map Location (Right Column) */}
          {product.latitude && product.longitude && (
            <ProductMap lat={product.latitude} lng={product.longitude} locationName={product.location_name} isDesktop={isDesktop} />
          )}
        </div>

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
