import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Heart, Star, X, Share2, Shield, MessageSquare, MapPin, 
  Clock, ChevronLeft, ChevronRight, ChevronDown, ShieldCheck, MoreVertical, Navigation, 
  Search 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../context/SearchContext';
import { ProductTabs } from '../components/ProductTabs';
import SafeImage from '../components/SafeImage';
import toast from 'react-hot-toast';
import VerifiedBadge from '../components/VerifiedBadge';
import { Skeleton } from '../components/Skeleton';
import { timeAgo } from '../utils/timeAgo';
import { fetchProductCached } from '../components/layout/CategoryBar';
import { useMessages } from '../context/MessageContext';
import SEO from '../components/SEO';
import { createProductInquiryPayload, parseMessageContent } from '../utils/messageParser';

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
  category_slug?: string;
  category_parent_name?: string | null;
  category_parent_slug?: string | null;
  seller: number;
  seller_username: string;
  seller_full_name?: string;
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
  can_review?: boolean;
  requires_quote?: boolean;
  location_name?: string;
  latitude?: string;
  longitude?: string;
  created_at?: string;
  sale_price?: string | null;
  weight_kg?: string;
  size?: string;
  unit_of_measure?: string;
  minimum_order_quantity?: string;
  price_tiers?: { id: number; min_quantity: string; max_quantity: string | null; unit_price: string }[];
  brand_name?: string;
  brand_details?: { id: number; name: string; slug: string; logo?: string };
  reference_product_details?: { id: number; name: string; slug: string; model_name?: string; variant_name?: string; brand_details?: { name: string; slug: string } };
  structured_specs?: Record<string, any>;
  specifications?: Record<string, any>;
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

const formatUnit = (count: number, unit?: string) => {
  const raw = (unit || 'piece').trim();
  const u = raw.toLowerCase();
  const num = Math.abs(count);
  
  if (num === 1) {
    if (u === 'pieces') return 'piece';
    if (u === 'items') return 'item';
    if (u === 'units') return 'unit';
    return raw;
  }
  
  if (u.endsWith('s') || u.endsWith('kg') || u.endsWith('g') || u.endsWith('l') || u.endsWith('ml') || u.endsWith('m') || u.endsWith('cm')) {
    return raw;
  }
  if (u.endsWith('y') && !['a', 'e', 'i', 'o', 'u'].includes(u.charAt(u.length - 2))) {
    return raw.slice(0, -1) + 'ies';
  }
  return `${raw}s`;
};

const formatQtyNum = (num: number | string | undefined | null) => {
  if (num === undefined || num === null) return '0';
  const n = parseFloat(String(num));
  if (isNaN(n)) return '0';
  return Number.isInteger(n) ? String(n) : String(n);
};

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
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 p-3 text-white hover:bg-white/10 rounded-xl transition z-50"
        aria-label="Close fullscreen"
      >
        <X size={28} />
      </button>

      <div className="flex-1 relative w-full overflow-hidden flex items-center justify-center">
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

        {currentIndex > 0 && (
          <button 
            onClick={handlePrev}
            className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white hover:scale-110 transition-all active:scale-95 z-50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
          >
            <ChevronLeft size={48} strokeWidth={2} />
          </button>
        )}

        {currentIndex < images.length - 1 && (
          <button 
            onClick={handleNext}
            className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white hover:scale-110 transition-all active:scale-95 z-50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
          >
            <ChevronRight size={48} strokeWidth={2} />
          </button>
        )}
      </div>

      {images.length > 1 && (
        <div 
          className="hidden md:flex h-14 bg-black/60 border-t border-white/10 items-center justify-center gap-1.5 px-3 overflow-x-auto no-scrollbar w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => scrollToIndex(i)}
              className={`relative shrink-0 w-12 h-9 overflow-hidden rounded-sm border-0 ring-0 transition-all ${
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
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
         <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
           <MapPin size={14} className="text-brand-500" />
           Location
         </h3>
         {!isDesktop && (
           <button onClick={() => setShowMap(!showMap)} className="text-xs px-3 py-1 rounded-full text-brand-500 font-bold transition border border-brand-500/40">
             {showMap ? 'Hide Map' : 'Show Map'}
           </button>
         )}
      </div>
      {locationName && <p className={`text-sm text-gray-500 flex items-center gap-1.5 ${showMap ? 'mb-4' : ''}`}><MapPin size={14}/>{locationName}</p>}
      
      {showMap && (
        <div className="w-full h-64 md:h-80 rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-800 relative z-0 bg-gray-100 dark:bg-gray-800">
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
          <div className="absolute bottom-2 right-2 bg-white/90 dark:bg-black/90 px-3 py-1.5 text-[11px] rounded-lg shadow-lg z-10 backdrop-blur-md border border-gray-200 dark:border-gray-800 flex items-center gap-2.5">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-500 font-bold hover:underline flex items-center gap-1"
            >
              <Navigation size={12} /> Navigate
            </a>
            <span className="text-gray-300 dark:text-neutral-700">•</span>
            <a
              href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`}
              target="_blank"
              rel="noreferrer"
              className="text-brand-500 font-bold hover:underline"
            >
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
  const { openSearch } = useSearch();
  const { openDesktopChat, toggleDesktopChat, totalUnread: messageUnreadCount, sendMessage, conversations, messages, fetchMessages } = useMessages();
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
  const [isSpecsExpanded, setIsSpecsExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [showInspectionHistory, setShowInspectionHistory] = useState(false);
  const [customMessage, setCustomMessage] = useState('Hi, is this still available?');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  const existingConversation = useMemo(() => {
    if (!product || !conversations) return null;
    return conversations.find(
      (c) =>
        (c.seller_username && product.seller_username && c.seller_username.toLowerCase() === product.seller_username.toLowerCase()) ||
        (c.buyer_username && product.seller_username && c.buyer_username.toLowerCase() === product.seller_username.toLowerCase())
    ) || null;
  }, [product, conversations]);

  // Preload messages for this seller's conversation to check product-specific inquiry context
  useEffect(() => {
    if (existingConversation?.id && !messages[existingConversation.id]) {
      fetchMessages(existingConversation.id);
    }
  }, [existingConversation?.id, messages, fetchMessages]);

  const hasInquiredThisProduct = useMemo(() => {
    if (messageSent) return true;
    if (!product || !existingConversation) return false;

    // 1. Check if conversation was created specifically for this product
    if (existingConversation.product === product.id) return true;

    // 2. Check if any message in this conversation was an inquiry for this specific product
    const convMsgs = messages[existingConversation.id] || [];
    return convMsgs.some((m) => {
      const parsed = parseMessageContent(m.content);
      return parsed.product?.id === product.id;
    });
  }, [product, existingConversation, messages, messageSent]);

  const handleDirectSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = customMessage.trim();
    if (!textToSend || isSendingMessage || !product) return;
    if (!isAuthenticated) {
      const url = new URL(window.location.href);
      url.searchParams.set('auto_message', 'true');
      navigate('/login?next=' + encodeURIComponent(url.pathname + url.search));
      return;
    }

    setIsSendingMessage(true);
    const minSpinTimer = new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const sendPromise = (async () => {
        let convId: number | undefined = existingConversation?.id;
        if (!convId) {
          const convRes = await api.post('/api/conversations/', {
            seller: product.seller,
            product: product.id,
          });
          convId = convRes.data.id;
        }
        if (!convId) throw new Error('Failed to start conversation');

        const messagePayload = createProductInquiryPayload({
          id: product.id,
          name: product.name,
          price: product.price,
          currency: (product as any).currency || 'TZS',
          image: currentImageSrc || images[0]?.image || '',
          category_name: product.category_name,
        }, textToSend);

        await sendMessage(convId, messagePayload);
        return convId;
      })();

      // Ensure the IG story ring runs smoothly for at least 2 seconds so it feels deliberate and fluid
      await Promise.all([sendPromise, minSpinTimer]);

      setMessageSent(true);
      setCustomMessage(''); // Clear input so they can message again
      toast.success(t('message_sent', 'Message sent to seller!'));

      // Keep "Sent!" status active for 3 seconds then return to ready state
      setTimeout(() => {
        setMessageSent(false);
      }, 3500);
    } catch {
      await minSpinTimer;
      toast.error(t('failed_send_message', 'Failed to send message'));
    } finally {
      setIsSendingMessage(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    
    Promise.all([
      fetchProductCached(slug),
      api.get(`/api/variants/?product_slug=${slug}`).catch(() => ({ data: [] }))
    ])
      .then(([res, vRes]) => {
        setProduct(res.data);
        setLikeCount(res.data.like_count);
        setLiked(res.data.is_liked || false);
        setQuantity(parseFloat(res.data.minimum_order_quantity) || 1);
        
        const list = vRes.data.results || vRes.data;
        setVariants(list);
        if (res.data.stock <= 0 && list.length > 0) {
          const firstAvailable = list.find((v: any) => v.stock > 0);
          if (firstAvailable) {
            setSelectedVariant(firstAvailable);
          }
        }
        setLoading(false);
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
    const previousLiked = liked;
    const previousCount = likeCount;
    setLiked(!previousLiked);
    setLikeCount(previousLiked ? Math.max(0, previousCount - 1) : previousCount + 1);

    try {
      const res = await api.post(`/api/products/${product.slug}/like/`);
      setLiked(res.data.liked);
      setLikeCount(res.data.like_count);
    } catch {
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

      if (!isAuthenticated) {
        const returnUrl = location.pathname + location.search;
        sessionStorage.setItem('loginRedirect', returnUrl);
        sessionStorage.setItem('pendingCartItem', JSON.stringify({ product: p, quantity }));
        toast.error(t('login_to_add_cart', 'Please sign in to add items to your cart'));
        navigate(`/login?next=${encodeURIComponent(returnUrl)}`);
        return;
      }

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

  useEffect(() => {
    if (isAuthenticated && product && location.search.includes('auto_message=true')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('auto_message');
      navigate(url.pathname + url.search, { replace: true });
      
      const createConversationAndSend = async () => {
        try {
          const convRes = await api.post('/api/conversations/', { seller: product.seller, product: product.id });
          const convId = convRes.data.id;
          const prefillMessage = `Hi, is this still available?`;
          if (window.innerWidth >= 768) {
            openDesktopChat(convId, prefillMessage);
          } else {
            navigate(`/messages/${convId}`, { state: { prefillMessage, sendImmediately: true } });
          }
        } catch {
          toast.error('Failed to start conversation');
        }
      };
      createConversationAndSend();
    }
  }, [isAuthenticated, product, location.search, navigate]);

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
        <Link to="/" className="text-brand-500 mt-4 inline-block hover:underline">← {t('back_to_products')}</Link>
      </div>
    );
  }

  const currentImageSrc = images[selectedImage]?.image || '';
  const currentUsername = localStorage.getItem('username');
  const isOwnProduct = Boolean(currentUsername && product.seller_username?.toLowerCase() === currentUsername.toLowerCase());
  const effectivePrice = selectedVariant ? (parseInt(selectedVariant.price_adjustment) + parseInt(product.price)) : parseInt(product.sale_price || product.price);
  const isDiscounted = product.sale_price && !selectedVariant && !product.requires_quote && parseInt(product.price) > parseInt(product.sale_price);
  const discountPercent = isDiscounted ? Math.round(((parseInt(product.price) - parseInt(product.sale_price!)) / parseInt(product.price)) * 100) : 0;

  const productSchema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.name,
    "image": images.map(img => img.image).filter(Boolean),
    "description": product.description,
    "sku": product.id.toString(),
    "brand": {
      "@type": "Brand",
      "name": product.seller_username
    },
    "offers": {
      "@type": "Offer",
      "url": `${import.meta.env.VITE_SITE_URL || 'https://pasifiq.store'}/product/${product.slug}`,
      "priceCurrency": "TZS",
      "price": product.sale_price ? product.sale_price : product.price,
      "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "itemCondition": product.condition === 'New' ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition"
    }
  };
  
  if (product.avg_rating > 0) {
    (productSchema as any).aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": product.avg_rating,
      "reviewCount": product.like_count > 0 ? product.like_count : 1
    };
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
      <SEO 
        title={`${product.name} - SokoniMax`} 
        description={product.description.substring(0, 160)}
        image={currentImageSrc}
        type="product"
        schema={productSchema}
      />

      {/* Lightbox */}
      {lightboxOpen && (
        <ImageLightbox
          images={images}
          initialIndex={selectedImage}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* ═══ MOBILE IMAGE GRID (< lg only) ═══ */}
      <div className="block lg:hidden relative w-full bg-neutral-950 shrink-0">
        <div className="absolute top-3 left-3 right-3 z-40 flex items-center justify-between pointer-events-none">
          {/* Left: Close, Logo, Search */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onPointerDown={(e) => { e.preventDefault(); window.history.length > 1 ? navigate(-1) : navigate('/products'); }}
              className="w-10 h-10 flex items-center justify-center bg-[#242526]/80 hover:bg-[#3a3b3c] text-white rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xl backdrop-blur-md"
              aria-label="Close product view"
            >
              <X size={18} />
            </button>
            <button 
              onClick={() => navigate('/')} 
              className="w-10 h-10 flex items-center justify-center bg-[#242526]/80 hover:bg-[#3a3b3c] rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xl backdrop-blur-md p-2" 
              title="Go to Homepage"
            >
              <img src="/logo.png" alt="OKO" className="w-full h-full object-contain drop-shadow-md" />
            </button>
            <button
              onClick={openSearch}
              className="w-10 h-10 flex items-center justify-center bg-[#242526]/80 hover:bg-[#3a3b3c] text-white rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xl backdrop-blur-md"
              title="Search"
              aria-label="Search"
            >
              <Search size={17} />
            </button>
          </div>

          {/* Right: Message (with Story Ring), Like, Share, 3-Dots */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="relative flex items-center justify-center">
              {isSendingMessage && (
                <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 animate-spin p-[2.5px] pointer-events-none shadow-lg shadow-rose-500/30 transition-all duration-300" />
              )}
              {messageSent && !isSendingMessage && (
                <div className="absolute -inset-1 rounded-full border-2 border-emerald-400 animate-pulse pointer-events-none transition-all duration-300" />
              )}
              <button
                onClick={() => {
                  if (existingConversation && window.innerWidth >= 768) {
                    openDesktopChat(existingConversation.id);
                  } else if (window.innerWidth >= 768) {
                    toggleDesktopChat();
                  } else {
                    navigate(existingConversation ? `/messages/${existingConversation.id}` : '/messages');
                  }
                }}
                className="relative w-10 h-10 flex items-center justify-center bg-[#242526]/80 hover:bg-[#3a3b3c] text-white rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xl backdrop-blur-md z-10"
                title="Messages"
                aria-label="View messages"
              >
                <MessageSquare size={17} />
                {messageUnreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] font-black rounded-full w-3.5 h-3.5 flex items-center justify-center border border-black animate-pulse">
                    {messageUnreadCount > 99 ? '99' : messageUnreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Save / Wishlist */}
            <button
              onClick={handleLike}
              className={`relative w-10 h-10 flex items-center justify-center bg-[#242526]/80 hover:bg-[#3a3b3c] rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xl backdrop-blur-md ${liked ? 'text-red-500' : 'text-white'}`}
              title={liked ? 'Saved' : 'Save'}
              aria-label="Save listing"
            >
              <Heart size={17} className={liked ? 'fill-current text-red-500' : ''} />
              {likeCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] font-black rounded-full w-3.5 h-3.5 flex items-center justify-center border border-black">
                  {likeCount}
                </span>
              )}
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="w-10 h-10 flex items-center justify-center bg-[#242526]/80 hover:bg-[#3a3b3c] text-white rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xl backdrop-blur-md"
              title="Share"
              aria-label="Share listing"
            >
              <Share2 size={17} />
            </button>

            {/* 3-Dots More Options Menu */}
            <div className="relative" ref={actionMenuRef}>
              <button
                type="button"
                onClick={() => setActionMenuOpen((prev) => !prev)}
                className="w-10 h-10 flex items-center justify-center bg-[#242526]/80 hover:bg-[#3a3b3c] text-white rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xl backdrop-blur-md"
                title="More actions"
                aria-label="More actions"
              >
                <MoreVertical size={17} />
              </button>

              {actionMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-[#242526] border border-gray-200 dark:border-neutral-700 rounded-xl shadow-2xl z-50 py-1.5 text-xs font-semibold animate-slide-up">
                  <Link
                    to={`/inspections/new?item_name=${encodeURIComponent(product.name)}&category_name=${encodeURIComponent(product.category_name || '')}&marketplace_product_id=${product.id}&seller_username=${encodeURIComponent(product.seller_username || '')}`}
                    onClick={() => setActionMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-gray-800 dark:text-gray-200 hover:bg-amber-500/10 hover:text-amber-500 transition-colors"
                  >
                    <Shield size={15} className="text-amber-500 shrink-0" />
                    <span>Request Inspection</span>
                  </Link>

                  {product.latitude && product.longitude && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${product.latitude},${product.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setActionMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 text-gray-800 dark:text-gray-200 hover:bg-blue-500/10 hover:text-blue-500 transition-colors"
                    >
                      <Navigation size={15} className="text-blue-500 shrink-0" />
                      <span>Navigate to Item</span>
                    </a>
                  )}
                </div>
              )}
          </div>
        </div>
      </div>

        {images.length <= 1 ? (
          <div className="w-full aspect-square relative cursor-pointer" onClick={() => setLightboxOpen(true)}>
            {currentImageSrc && (
              <>
                <img src={currentImageSrc} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover filter blur-[50px] opacity-100 scale-110 select-none pointer-events-none" />
                <div className="absolute inset-0 bg-black/30 pointer-events-none" />
              </>
            )}
            <div className="relative z-10 w-full h-full flex items-center justify-center">
              {currentImageSrc ? (
                <SafeImage src={currentImageSrc} alt={product.name} category={product.category_name} className="max-w-full max-h-full object-contain drop-shadow-2xl" containMode="contain" loading="eager" />
              ) : (
                <SafeImage src="" alt={product.name} category={product.category_name} className="w-full h-full" transparent />
              )}
            </div>
          </div>
        ) : (
          <div className="w-full grid grid-cols-[2.2fr_1fr] gap-[2px]" style={{ aspectRatio: '1.08/1' }}>
            <div className="relative cursor-pointer overflow-hidden" onClick={() => { setSelectedImage(0); setLightboxOpen(true); }}>
              <img src={images[0]?.image || ''} alt={product.name} className="w-full h-full object-cover" loading="eager" />
            </div>
            <div className="flex flex-col gap-[2px]">
              {images.slice(1, 3).map((img, idx) => (
                <div key={idx} className="relative flex-1 cursor-pointer overflow-hidden" onClick={() => { setSelectedImage(idx + 1); setLightboxOpen(true); }}>
                  <img src={img.image || ''} alt={`${product.name} ${idx + 2}`} className="w-full h-full object-cover" loading="lazy" />
                  {idx === 1 && images.length > 3 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-lg font-bold">+{images.length - 3}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ DESKTOP IMAGE STAGE (lg+ only) ═══ */}
      <div className="hidden lg:flex relative lg:w-[58%] xl:w-[62%] lg:h-full bg-neutral-950 overflow-hidden flex-col items-center justify-center select-none group/stage shrink-0">
        
        {/* Top Floating Overlay: Left (X, Logo, Search) & Right (Messages, Save, Share, 3-dots) */}
        <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
          {/* Left Group */}
          <div className="flex items-center gap-2.5 pointer-events-auto">
            <button
              onPointerDown={(e) => { e.preventDefault(); window.history.length > 1 ? navigate(-1) : navigate('/products'); }}
              className="w-11 h-11 xl:w-12 xl:h-12 flex items-center justify-center bg-[#242526]/80 hover:bg-[#3a3b3c] text-white rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xl backdrop-blur-md"
              title="Close" aria-label="Close product view"
            >
              <X size={20} />
            </button>
            <button 
              onClick={() => navigate('/')} 
              className="w-11 h-11 xl:w-12 xl:h-12 flex items-center justify-center bg-[#242526]/80 hover:bg-[#3a3b3c] rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xl backdrop-blur-md p-2.5" 
              title="Go to Homepage"
            >
              <img src="/logo.png" alt="OKO" className="w-full h-full object-contain drop-shadow-md" />
            </button>
            <button
              onClick={openSearch}
              className="w-11 h-11 xl:w-12 xl:h-12 flex items-center justify-center bg-[#242526]/80 hover:bg-[#3a3b3c] text-white rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xl backdrop-blur-md"
              title="Search"
              aria-label="Search"
            >
              <Search size={19} />
            </button>
          </div>

          {/* Right Group */}
          <div className="flex items-center gap-2.5 pointer-events-auto">
            {/* Messages with IG Story Ring Loading */}
            <div className="relative flex items-center justify-center">
              {isSendingMessage && (
                <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 animate-spin p-[3px] pointer-events-none shadow-lg shadow-rose-500/30 transition-all duration-300" />
              )}
              {messageSent && !isSendingMessage && (
                <div className="absolute -inset-1 rounded-full border-2 border-emerald-400 animate-pulse pointer-events-none transition-all duration-300" />
              )}
              <button
                onClick={() => {
                  if (existingConversation && window.innerWidth >= 768) {
                    openDesktopChat(existingConversation.id);
                  } else if (window.innerWidth >= 768) {
                    toggleDesktopChat();
                  } else {
                    navigate(existingConversation ? `/messages/${existingConversation.id}` : '/messages');
                  }
                }}
                className="relative w-11 h-11 xl:w-12 xl:h-12 flex items-center justify-center bg-[#242526]/80 hover:bg-[#3a3b3c] text-white rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xl backdrop-blur-md z-10"
                title="Messages"
                aria-label="View messages"
              >
                <MessageSquare size={19} />
                {messageUnreadCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center border border-black animate-pulse">
                    {messageUnreadCount > 99 ? '99' : messageUnreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Save / Wishlist */}
            <button
              onClick={handleLike}
              className={`relative w-11 h-11 xl:w-12 xl:h-12 flex items-center justify-center bg-[#242526]/80 hover:bg-[#3a3b3c] rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xl backdrop-blur-md ${liked ? 'text-red-500' : 'text-white'}`}
              title={liked ? 'Saved' : 'Save'}
              aria-label="Save listing"
            >
              <Heart size={19} className={liked ? 'fill-current text-red-500' : ''} />
              {likeCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center border border-black">
                  {likeCount}
                </span>
              )}
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="w-11 h-11 xl:w-12 xl:h-12 flex items-center justify-center bg-[#242526]/80 hover:bg-[#3a3b3c] text-white rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xl backdrop-blur-md"
              title="Share"
              aria-label="Share listing"
            >
              <Share2 size={19} />
            </button>

            {/* 3-Dots More Options Menu */}
            <div className="relative" ref={actionMenuRef}>
              <button
                type="button"
                onClick={() => setActionMenuOpen((prev) => !prev)}
                className="w-11 h-11 xl:w-12 xl:h-12 flex items-center justify-center bg-[#242526]/80 hover:bg-[#3a3b3c] text-white rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xl backdrop-blur-md"
                title="More actions"
                aria-label="More actions"
              >
                <MoreVertical size={19} />
              </button>

              {actionMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-[#242526] border border-gray-200 dark:border-neutral-700 rounded-xl shadow-2xl z-50 py-1.5 text-xs font-semibold animate-slide-up">
                  <Link
                    to={`/inspections/new?item_name=${encodeURIComponent(product.name)}&category_name=${encodeURIComponent(product.category_name || '')}&marketplace_product_id=${product.id}&seller_username=${encodeURIComponent(product.seller_username || '')}`}
                    onClick={() => setActionMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-gray-800 dark:text-gray-200 hover:bg-amber-500/10 hover:text-amber-500 transition-colors"
                  >
                    <Shield size={15} className="text-amber-500 shrink-0" />
                    <span>Request Inspection</span>
                  </Link>

                  {product.latitude && product.longitude && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${product.latitude},${product.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setActionMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 text-gray-800 dark:text-gray-200 hover:bg-blue-500/10 hover:text-blue-500 transition-colors"
                    >
                      <Navigation size={15} className="text-blue-500 shrink-0" />
                      <span>Navigate to Item</span>
                    </a>
                  )}
                </div>
              )}
          </div>
        </div>
      </div>

        {/* Ambient blurred background */}
        {currentImageSrc && (
          <>
            <img src={currentImageSrc} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover filter blur-[50px] opacity-100 scale-110 select-none pointer-events-none" />
            <div className="absolute inset-0 bg-black/30 pointer-events-none" />
          </>
        )}

        {/* Main image */}
        <div 
          className="relative z-10 w-full h-full flex items-center justify-center cursor-zoom-in overflow-hidden"
          onClick={() => setLightboxOpen(true)}
          onTouchStart={(e) => { (e.currentTarget as any)._touchStartX = e.touches[0].clientX; (e.currentTarget as any)._touchStartY = e.touches[0].clientY; }}
          onTouchEnd={(e) => {
            const startX = (e.currentTarget as any)._touchStartX;
            const startY = (e.currentTarget as any)._touchStartY;
            if (startX == null) return;
            const dx = e.changedTouches[0].clientX - startX;
            const dy = e.changedTouches[0].clientY - startY;
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50 && images.length > 1) {
              e.preventDefault();
              if (dx < 0) setSelectedImage(prev => (prev < images.length - 1 ? prev + 1 : 0));
              else setSelectedImage(prev => (prev > 0 ? prev - 1 : images.length - 1));
            }
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={selectedImage} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.03 }} transition={{ duration: 0.2 }} className="w-full h-full flex items-center justify-center">
              {currentImageSrc ? (
                <SafeImage src={currentImageSrc} alt={product.name} category={product.category_name} className="max-w-full max-h-full object-contain drop-shadow-2xl transition-transform duration-300" containMode="contain" loading="eager" />
              ) : (
                <SafeImage src="" alt={product.name} category={product.category_name} className="w-full h-full" transparent />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Previous Arrow */}
        {images.length > 1 && (
          <button onClick={(e) => { e.stopPropagation(); setSelectedImage(prev => (prev > 0 ? prev - 1 : images.length - 1)); }}
            className="flex absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#242526]/80 hover:bg-[#3a3b3c] text-white rounded-full items-center justify-center shadow-2xl backdrop-blur-md transition-all hover:scale-110 active:scale-95 z-30 cursor-pointer"
            aria-label="Previous image">
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
        )}

        {/* Next Arrow */}
        {images.length > 1 && (
          <button onClick={(e) => { e.stopPropagation(); setSelectedImage(prev => (prev < images.length - 1 ? prev + 1 : 0)); }}
            className="flex absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#242526]/80 hover:bg-[#3a3b3c] text-white rounded-full items-center justify-center shadow-2xl backdrop-blur-md transition-all hover:scale-110 active:scale-95 z-30 cursor-pointer"
            aria-label="Next image">
            <ChevronRight size={24} strokeWidth={2.5} />
          </button>
        )}

        {/* Dot indicators */}
        {images.length > 1 && (
          <div className="flex absolute bottom-3 left-1/2 -translate-x-1/2 z-40 items-center gap-1.5">
            {images.map((_, idx) => (
              <button key={idx} onClick={(e) => { e.stopPropagation(); setSelectedImage(idx); }}
                className={`rounded-full transition-all cursor-pointer ${idx === selectedImage ? 'w-2.5 h-2.5 bg-white shadow-lg' : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'}`}
                aria-label={`Image ${idx + 1}`} />
            ))}
          </div>
        )}
      </div>

      {/* ═══ RIGHT SIDE: Product Info & Buy Sidebar ═══ */}
      <div className="w-full lg:w-[42%] xl:w-[38%] h-auto lg:h-full bg-white dark:bg-[#18191a] text-gray-900 dark:text-white border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-neutral-800 overflow-y-visible lg:overflow-y-auto p-5 sm:p-6 flex flex-col gap-6 shrink-0">
          
          {/* Header Area */}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white leading-tight tracking-tight">
              {product.name}
            </h1>
            
            {/* Verified Reference Badge if available */}
            {product.reference_product_details && (
              <div className="flex items-center gap-2">
                <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-wider border border-emerald-200 dark:border-emerald-800/50">
                  <ShieldCheck size={13} />
                  Verified {product.reference_product_details.brand_details?.name || product.brand_details?.name} {product.reference_product_details.model_name || ''} {product.reference_product_details.variant_name || ''}
                </div>
              </div>
            )}

            {/* Price below title */}
            <div className="flex items-center gap-3 flex-wrap mt-1">
              <span className="text-[28px] font-black text-gray-900 dark:text-white tracking-tight">
                {product.requires_quote 
                  ? t('price_on_request', 'Price on Request')
                  : `TSh ${effectivePrice.toLocaleString()}`
                }
              </span>
              {isDiscounted && (
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-gray-400 line-through decoration-red-500/50 decoration-2">
                    TSh {parseInt(product.price).toLocaleString()}
                  </span>
                  <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-md uppercase tracking-wider shadow-sm shadow-red-500/20">
                    {discountPercent}% {t('off_caps')}
                  </span>
                </div>
              )}
            </div>

            {/* Category, Brand & Condition Metadata Line */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium">
              {product.category_parent_slug && product.category_parent_slug !== product.category_slug && (
                <>
                  <Link 
                    to={`/products?category=${product.category_parent_slug}`} 
                    className="font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 hover:text-brand-500 dark:hover:text-brand-500 transition-colors"
                  >
                    {product.category_parent_name || product.category_parent_slug}
                  </Link>
                  <span className="text-neutral-300 dark:text-neutral-700">/</span>
                </>
              )}
              <Link 
                to={product.category_parent_slug && product.category_parent_slug !== product.category_slug
                  ? `/products?category=${product.category_parent_slug}&subcategory=${product.category_slug || product.category_name}`
                  : `/products?category=${product.category_slug || product.category_name}`} 
                className="font-bold uppercase tracking-widest text-brand-500 dark:text-brand-500 hover:text-brand-500 dark:hover:text-brand-500 transition-colors"
              >
                {product.category_name}
              </Link>

              {/* Integrated Brand */}
              {(product.brand_details || product.brand_name) && (
                <>
                  <span>•</span>
                  <Link
                    to={`/products?brand=${product.brand_details?.slug || (product.brand_name || '').toLowerCase().replace(/\s+/g, '-')}`}
                    className="font-bold uppercase tracking-widest text-gray-800 dark:text-gray-200 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
                  >
                    {product.brand_details?.name || product.brand_name}
                  </Link>
                </>
              )}

              <span>•</span>
              <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-wider ${
                product.condition === 'New' 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}>
                {product.condition}
              </span>
              {product.location_name && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-gray-400" />
                    {product.location_name}
                  </span>
                </>
              )}
              {product.created_at && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-gray-400" />
                    {timeAgo(product.created_at)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Variants */}
          {variants.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Select Variation</span>
                {selectedVariant && (
                  <span className="text-xs font-bold text-brand-500 dark:text-brand-500">
                    TSh {(parseInt(product.price) + parseInt(selectedVariant.price_adjustment)).toLocaleString()}
                  </span>
                )}
              </div>
                
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
                      <span className="text-[10px] uppercase text-red-500/80 dark:text-red-500/80 font-black ml-1">(Out of stock)</span>
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

          {/* UOM and Tiered Pricing info */}
          {((product.minimum_order_quantity && parseFloat(product.minimum_order_quantity) > 1) || (product.price_tiers && product.price_tiers.length > 0)) && (
            <div className="flex flex-col gap-2 p-4 rounded-2xl border border-transparent bg-gray-50 dark:bg-[#242526]">
                {product.minimum_order_quantity && parseFloat(product.minimum_order_quantity) > 1 && (
                  <div className="flex justify-between items-center text-xs text-brand-500 dark:text-brand-500">
                     <span className="font-semibold">Minimum Order (MOQ):</span>
                     <span className="font-bold">{formatQtyNum(product.minimum_order_quantity)} {formatUnit(parseFloat(product.minimum_order_quantity || '1'), product.unit_of_measure)}</span>
                  </div>
                )}
                {product.price_tiers && product.price_tiers.length > 0 && (
                  <div className="mt-2 text-xs border-t border-brand-500/50 dark:border-brand-500/50 pt-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">Volume Discounts:</span>
                    <div className="space-y-1">
                      {product.price_tiers.map(tier => (
                        <div key={tier.id} className="flex justify-between text-gray-600 dark:text-gray-400">
                          <span>{formatQtyNum(tier.min_quantity)} {tier.max_quantity ? `- ${formatQtyNum(tier.max_quantity)}` : '+'} {formatUnit(parseFloat(tier.min_quantity), product.unit_of_measure)}</span>
                          <span className="font-bold text-gray-900 dark:text-white">TSh {parseInt(tier.unit_price).toLocaleString()} / {product.unit_of_measure || 'piece'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Purchase Action Zone */}
          <div className="flex flex-col gap-3">
            {(selectedVariant ? selectedVariant.stock > 0 : product.stock > 0) ? (
              isOwnProduct ? (
                <div className="p-3.5 bg-gray-100 dark:bg-[#242526] rounded-full text-center border border-gray-200 dark:border-neutral-800 text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {t('this_is_your_listing')}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {/* Quantity Stepper */}
                  <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-full bg-gray-50 dark:bg-gray-900 overflow-hidden shrink-0 h-10 select-none">
                    <button 
                      type="button"
                      onClick={() => setQuantity(Math.max(parseFloat(product.minimum_order_quantity || '1'), quantity - 1))} 
                      className="w-9 h-full flex items-center justify-center hover:bg-gray-200/60 dark:hover:bg-gray-800 transition text-gray-700 dark:text-gray-300 font-bold text-sm cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <div className="flex items-center justify-center border-x border-gray-200 dark:border-gray-700 px-3.5 min-w-[3.8rem] h-full">
                      <span className="font-bold text-xs text-gray-900 dark:text-white whitespace-nowrap">
                        {quantity} {formatUnit(quantity, product.unit_of_measure)}
                      </span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setQuantity(Math.min((selectedVariant ? selectedVariant.stock : product.stock), quantity + 1))} 
                      className="w-9 h-full flex items-center justify-center hover:bg-gray-200/60 dark:hover:bg-gray-800 transition text-gray-700 dark:text-gray-300 font-bold text-sm cursor-pointer"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  {/* Add to Cart CTA */}
                  <button 
                    onClick={handleAddToCart} 
                    className="flex-1 min-w-[130px] flex items-center justify-center h-10 px-4 bg-amber-400 hover:bg-amber-500 text-black font-extrabold rounded-full transition shadow-md active:scale-98 text-xs sm:text-sm tracking-wide select-none cursor-pointer"
                  >
                    <span className="truncate">{t('add_to_cart')}</span>
                  </button>

                  {/* Stock count with natural phrasing */}
                  {(() => {
                    const rawStock = selectedVariant ? selectedVariant.stock : product.stock;
                    const formattedStock = formatQtyNum(rawStock);
                    const u = (product.unit_of_measure || 'piece').trim().toLowerCase();
                    const isGeneric = ['piece', 'pieces', 'item', 'items', 'unit', 'units'].includes(u);
                    return (
                      <span className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[11px] font-bold shrink-0">
                        {isGeneric ? `${formattedStock} in stock` : `${formattedStock} ${formatUnit(parseFloat(formattedStock), product.unit_of_measure)} in stock`}
                      </span>
                    );
                  })()}
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

          {/* Specifications */}
          {(() => {
            const allSpecs = {
              ...(product.specifications && typeof product.specifications === 'object' ? product.specifications : {}),
              ...(product.structured_specs && typeof product.structured_specs === 'object' ? product.structured_specs : {})
            };
            const specEntries = Object.entries(allSpecs).filter(([k, v]) => v !== null && v !== undefined && String(v).trim() !== '' && !k.startsWith('_'));
            if (specEntries.length === 0) return null;

            const INITIAL_SPECS_COUNT = 3;
            const hasMoreSpecs = specEntries.length > INITIAL_SPECS_COUNT;
            const visibleSpecs = isSpecsExpanded ? specEntries : specEntries.slice(0, INITIAL_SPECS_COUNT);

            return (
              <div>
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                  Specifications
                </h3>
                <div className="bg-gray-50 dark:bg-[#242526] rounded-2xl border border-gray-100 dark:border-neutral-800 overflow-hidden transition-all">
                  {visibleSpecs.map(([key, value], idx) => (
                    <div key={key} className={`flex items-center justify-between p-3.5 ${idx !== 0 ? 'border-t border-gray-200 dark:border-neutral-800' : ''}`}>
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 capitalize">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white text-right max-w-[60%]">
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </span>
                    </div>
                  ))}

                  {/* Centered Flip Chevron Toggle */}
                  {hasMoreSpecs && (
                    <button
                      type="button"
                      onClick={() => setIsSpecsExpanded(!isSpecsExpanded)}
                      aria-label={isSpecsExpanded ? "Collapse specifications" : "Expand specifications"}
                      className="w-full flex items-center justify-center py-2.5 hover:bg-gray-100 dark:hover:bg-neutral-800/60 border-t border-gray-200 dark:border-neutral-800 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <ChevronDown 
                        size={18} 
                        className={`transition-transform duration-300 ${isSpecsExpanded ? 'rotate-180' : ''}`} 
                      />
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

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

          {/* Merchant Trust & Info */}
          <div>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Seller Info</h3>
            <div className="flex flex-col gap-3 bg-gray-50 dark:bg-[#242526] p-4 rounded-2xl border border-transparent">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 flex items-center justify-center shrink-0">
                    {product.seller_profile_picture ? (
                      <img src={product.seller_profile_picture} alt={product.seller_username} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-black text-gray-500 dark:text-gray-400 uppercase">
                        {product.seller_username.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Link to={`/${product.seller_username}`} className="text-base font-bold text-gray-900 dark:text-white hover:underline transition">
                        {product.seller_full_name || product.seller_username}
                      </Link>
                      <VerifiedBadge tier={product.seller_tier} isVerified={product.seller_verified} className="w-3.5 h-3.5" />
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
              </div>
              
              {product.seller_username !== localStorage.getItem('username') && (
                <div className="flex flex-col gap-2 mt-1">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    {t('send_seller_message', 'Send Seller a Message')}
                  </p>

                  {hasInquiredThisProduct ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (existingConversation && window.innerWidth >= 768) {
                          openDesktopChat(existingConversation.id);
                        } else if (window.innerWidth >= 768) {
                          toggleDesktopChat();
                        } else {
                          navigate(existingConversation ? `/messages/${existingConversation.id}` : '/messages');
                        }
                      }}
                      className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition-all shadow-sm active:scale-98 cursor-pointer"
                    >
                      {t('view_message', 'View Message')}
                    </button>
                  ) : (
                    <form onSubmit={handleDirectSendMessage} className="flex gap-2">
                      <input
                        type="text"
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder="Hi, is this still available?"
                        className="flex-1 bg-white dark:bg-[#18191a] border border-gray-200 dark:border-neutral-700 rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-amber-400 dark:focus:border-amber-400 transition-colors shadow-2xs"
                      />
                      <button
                        type="submit"
                        disabled={isSendingMessage || !customMessage.trim()}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap cursor-pointer"
                      >
                        {isSendingMessage ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <span>Send</span>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Verification & Inspection Services */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-gray-50 dark:bg-[#242526] border border-gray-100 dark:border-neutral-800 text-xs space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {product.is_verified ? (
                  <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                ) : (
                  <Shield size={16} className="text-amber-500 shrink-0" />
                )}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-gray-900 dark:text-white truncate">
                    {product.is_verified ? t('verified_listing', 'Verified Item') : t('professional_inspection', 'Professional Inspection')}
                  </span>
                  {product.inspections && product.inspections.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                      {product.inspections.length} {product.inspections.length === 1 ? 'Report' : 'Reports'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {product.inspections && product.inspections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowInspectionHistory(prev => !prev)}
                    className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{showInspectionHistory ? t('hide_history', 'Hide') : t('view_history', 'View History')}</span>
                    <ChevronDown size={13} className={`transition-transform duration-200 ${showInspectionHistory ? 'rotate-180' : ''}`} />
                  </button>
                )}
                <Link
                  to={`/inspections/new?item_name=${encodeURIComponent(product.name)}&category_name=${encodeURIComponent(product.category_name || '')}&marketplace_product_id=${product.id}&seller_username=${encodeURIComponent(product.seller_username || '')}`}
                  className="text-xs font-bold text-gray-800 dark:text-gray-200 hover:text-brand-500 dark:hover:text-brand-400 bg-white dark:bg-[#18191a] border border-gray-200 dark:border-neutral-700 hover:border-brand-500 px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                >
                  {isOwnProduct 
                    ? (product.inspections?.length > 0 ? t('reinspect', 'Re-inspect') : t('request_inspection', 'Request Inspection'))
                    : t('request_inspection', 'Request Inspection')}
                </Link>
              </div>
            </div>

            {/* Collapsible Inspection History */}
            {showInspectionHistory && product.inspections && product.inspections.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-gray-200 dark:border-neutral-700/60 animate-fade-in">
                {product.inspections.map((insp) => (
                  <Link
                    key={insp.id}
                    to={`/verify/${insp.inspection_id}`}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#18191a] border border-gray-100 dark:border-neutral-800 hover:border-brand-500 transition-all text-xs"
                  >
                    <div>
                      <span className="text-gray-400 text-2xs block">
                        {new Date(insp.created_at).toLocaleDateString()} • #{insp.inspection_id}
                      </span>
                      <span className={`font-bold ${insp.verdict === 'pass' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {insp.verdict ? `Verdict: ${insp.verdict.toUpperCase()}` : `Status: ${insp.status.replace('_', ' ')}`}
                      </span>
                    </div>
                    <span className="text-2xs font-bold text-brand-500 hover:underline">View Report →</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Map Location */}
          {product.latitude && product.longitude && (
            <div>
              <ProductMap lat={product.latitude} lng={product.longitude} locationName={product.location_name} isDesktop={isDesktop} />
            </div>
          )}

          {/* Product Reviews & Comments */}
          <div>
            <ProductTabs 
              productId={product.id} 
              sellerUsername={product.seller_username} 
            />
          </div>
        </div>
    </div>
  );
};

export default ProductDetailPage;
