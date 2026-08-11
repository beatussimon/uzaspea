import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CreditCard, MapPin, Truck, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import api from '../api';
import toast from 'react-hot-toast';
import SafeImage from '../components/SafeImage';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/Input';
import { AddressAutocomplete } from '../components/AddressAutocomplete';

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const CITIES_COORDS: Record<string, { lat: number; lng: number }> = {
  'Dar es Salaam': { lat: -6.776012, lng: 39.178326 },
  'Mwanza': { lat: -2.5167, lng: 32.9000 },
  'Arusha': { lat: -3.3731, lng: 36.6858 },
  'Dodoma': { lat: -6.1630, lng: 35.7516 },
  'Zanzibar': { lat: -6.1659, lng: 39.1990 },
};

const CheckoutPage: React.FC = () => {
  const { t } = useTranslation();
  const { items, clearCartByMerchant } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const merchant = new URLSearchParams(location.search).get('merchant') || 'Unknown Store';
  
  const checkoutItems = useMemo(() => items.filter(i => (i.seller_username || 'Unknown Store') === merchant), [items, merchant]);
  const checkoutTotal = useMemo(() => checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0), [checkoutItems]);
  const hasQuoteItem = useMemo(() => checkoutItems.some(i => i.requires_quote), [checkoutItems]);

  const [submitting, setSubmitting] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [fulfillmentType, setFulfillmentType] = useState<string>('PLATFORM_DELIVERY');
  const [fulfillmentOptions, setFulfillmentOptions] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);  // HIGH-3
  
  const [selectedCity, setSelectedCity] = useState('Dar es Salaam');
  const [quotes, setQuotes] = useState<any[]>([]);
  const [selectedQuoteCode, setSelectedQuoteCode] = useState('standard');

  const [sellerCoords, setSellerCoords] = useState<{ lat: number; lng: number; region?: string } | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [citiesCoords, setCitiesCoords] = useState<Record<string, { lat: number; lng: number; code: string }>>({});
  
  const [regionsData, setRegionsData] = useState<any[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    deliveryAddress: '',
    notes: '',
  });
  const [isEditingDetails, setIsEditingDetails] = useState(true);

  useEffect(() => {
    const fetchSellerCoords = async () => {
      if (checkoutItems.length > 0) {
        const sellerUsername = checkoutItems[0].seller_username;
        if (sellerUsername) {
          try {
            const res = await api.get(`/api/profiles/${sellerUsername}/`);
            if (res.data.latitude && res.data.longitude) {
              setSellerCoords({
                lat: parseFloat(res.data.latitude),
                lng: parseFloat(res.data.longitude),
                region: res.data.location
              });
            } else if (res.data.location) {
               setSellerCoords({ lat: -6.8161, lng: 39.2803, region: res.data.location });
            }
          } catch (err) {
            console.error('Failed to fetch seller coords', err);
          }
        }
      }
    };
    fetchSellerCoords();
  }, [checkoutItems]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const username = localStorage.getItem('username');
        if (username) {
          const res = await api.get(`/api/profiles/${username}/`);
          const data = res.data;
          const fullName = `${data.user?.first_name || ''} ${data.user?.last_name || ''}`.trim() || data.username || '';
          const phone = data.phone_number || '';
          const deliveryAddress = data.location || '';
          
          setForm(prev => ({
            ...prev,
            fullName: prev.fullName || fullName,
            phone: prev.phone || phone,
            deliveryAddress: prev.deliveryAddress || deliveryAddress,
          }));
          if (data.location) {
            setSelectedCity(data.location);
          }
          if (fullName && phone && deliveryAddress) {
            setIsEditingDetails(false);
          }
        }
      } catch (err) {
        console.error('Failed to fetch user profile', err);
      }
    };
    fetchUserProfile();
  }, []);

  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const res = await api.get('/api/locations/regions/');
        setRegionsData(res.data.results || res.data || []);
      } catch (err) {
        console.error('Failed to load regions', err);
      }
    };
    fetchRegions();
  }, []);

  const availableDistricts = useMemo(() => {
    const r = regionsData.find(x => x.name === selectedCity);
    return r?.districts || [];
  }, [regionsData, selectedCity]);

  // Handle region change to explicitly set the first district
  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCity = e.target.value;
    setSelectedCity(newCity);
    const newCityData = regionsData.find((r: any) => r.name === newCity);
    if (newCityData?.districts?.length > 0) {
      setSelectedDistrict(newCityData.districts[0].name);
    } else {
      setSelectedDistrict('');
    }
  };

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await api.get('/api/warehouses/warehouses/');
        const list = res.data.results || res.data || [];
        setWarehouses(list);
        
        const dynamicCoords: Record<string, { lat: number; lng: number; code: string }> = {};
        list.forEach((w: any) => {
          if (w.region_name) {
            dynamicCoords[w.region_name] = {
              lat: Number(w.latitude ?? -6.3690),
              lng: Number(w.longitude ?? 34.8888),
              code: w.code
            };
          }
        });
        
        if (Object.keys(dynamicCoords).length > 0) {
          setCitiesCoords(dynamicCoords);
          const cities = Object.keys(dynamicCoords);
          setSelectedCity(prev => cities.includes(prev) ? prev : cities[0]);
        } else {
          const fallback: any = {};
          Object.entries(CITIES_COORDS).forEach(([k, v]) => {
            fallback[k] = { ...v, code: k === 'Mwanza' ? 'MWZ-01' : 'DAR-01' };
          });
          setCitiesCoords(fallback);
        }
      } catch (err) {
        console.error('Failed to load warehouses list', err);
        const fallback: any = {};
        Object.entries(CITIES_COORDS).forEach(([k, v]) => {
          fallback[k] = { ...v, code: k === 'Mwanza' ? 'MWZ-01' : 'DAR-01' };
        });
        setCitiesCoords(fallback);
      }
    };
    fetchWarehouses();
  }, []);

  const fetchQuotes = async (city: string) => {
    const coords = citiesCoords[city] || CITIES_COORDS[city];
    if (!coords) return;
    
    const totalWeight = checkoutItems.reduce((acc, item) => acc + (item.quantity * (item.weight_kg ?? 1.0)), 0);
    const sizesPriority: Record<string, number> = { 'small': 0, 'medium': 1, 'large': 2, 'oversized': 3 };
    let maxSize = 'small';
    for (const item of checkoutItems) {
      const itemSize = (item.size || 'small').toLowerCase();
      if ((sizesPriority[itemSize] || 0) > (sizesPriority[maxSize] || 0)) {
        maxSize = itemSize;
      }
    }

    const sellerLat = sellerCoords?.lat ?? -6.8161;
    const sellerLng = sellerCoords?.lng ?? 39.2803;
    const originWarehouseCode = ((): string => {
      if (sellerCoords?.region) {
        const matchingCity = Object.keys(citiesCoords).find(k => k.toLowerCase() === sellerCoords.region!.toLowerCase());
        if (matchingCity) return citiesCoords[matchingCity].code;
      }
      let nearestCode = 'DAR-01';
      let minDistance = Infinity;
      const listToUse = Object.keys(citiesCoords).length > 0 ? Object.values(citiesCoords).map(c => ({ code: c.code, latitude: c.lat, longitude: c.lng })) : [
        { code: 'WH-DAR-ES-SALAAM-01', latitude: -6.8161, longitude: 39.2803 },
        { code: 'WH-MWANZA-01', latitude: -2.5167, longitude: 32.9000 }
      ];
      for (const w of listToUse) {
        const wLat = Number(w.latitude);
        const wLng = Number(w.longitude);
        const d = Math.sqrt(Math.pow(wLat - sellerLat, 2) + Math.pow(wLng - sellerLng, 2));
        if (d < minDistance) {
          minDistance = d;
          nearestCode = w.code;
        }
      }
      return nearestCode;
    })();
    
    try {
      const res = await api.post('/api/logistics/pricing/quote/', {
        start_lat: sellerLat,
        start_lng: sellerLng,
        end_lat: coords.lat,
        end_lng: coords.lng,
        origin_code: originWarehouseCode,
        destination_code: coords.code,
        weight: totalWeight,
        size: maxSize
      });
      setQuotes(res.data.quotes || []);
      const hasSelected = (res.data.quotes || []).some((q: any) => q.code === selectedQuoteCode);
      if (!hasSelected && res.data.quotes?.length > 0) {
        const hasStd = res.data.quotes.find((q: any) => q.code === 'standard');
        setSelectedQuoteCode(hasStd ? 'standard' : res.data.quotes[0].code);
      }
    } catch (err) {
      console.error('Failed to load delivery pricing quotes', err);
    }
  };

  const fetchCheckoutOptions = async (city: string, abortSignal?: AbortSignal) => {
    const coords = citiesCoords[city] || CITIES_COORDS[city];
    if (!coords) {
      setFulfillmentOptions([]);
      setLoadingOptions(false);
      return;
    }
    const sellerLat = sellerCoords?.lat ?? -6.8161;
    const sellerLng = sellerCoords?.lng ?? 39.2803;
    const originWarehouseCode = ((): string => {
      if (sellerCoords?.region) {
        const matchingCity = Object.keys(citiesCoords).find(k => k.toLowerCase() === sellerCoords.region!.toLowerCase());
        if (matchingCity) return citiesCoords[matchingCity].code;
      }
      let nearestCode = 'DAR-01';
      let minDistance = Infinity;
      const listToUse = Object.keys(citiesCoords).length > 0 ? Object.values(citiesCoords).map(c => ({ code: c.code, latitude: c.lat, longitude: c.lng })) : [
        { code: 'WH-DAR-ES-SALAAM-01', latitude: -6.8161, longitude: 39.2803 },
        { code: 'WH-MWANZA-01', latitude: -2.5167, longitude: 32.9000 }
      ];
      for (const w of listToUse) {
        const wLat = Number(w.latitude);
        const wLng = Number(w.longitude);
        const d = Math.sqrt(Math.pow(wLat - sellerLat, 2) + Math.pow(wLng - sellerLng, 2));
        if (d < minDistance) { minDistance = d; nearestCode = w.code; }
      }
      return nearestCode;
    })();
    setLoadingOptions(true);  // HIGH-3
    try {
      const res = await api.post('/api/logistics/checkout-options/', {
        origin_code: originWarehouseCode,
        destination_code: coords.code,
      });
      if (abortSignal?.aborted) return;  // MED-1: discard stale response
      const opts = res.data.options || [];
      setFulfillmentOptions(opts);
      if (opts.length > 0) {
        const currentIsValid = opts.some((o: any) => o.fulfillment_type === fulfillmentType);
        if (!currentIsValid) {
          // MED-1: avoid side effect inside state updater
          setFulfillmentType(opts[0].fulfillment_type);
          setShippingMethod(opts[0].shipping_method);
        }
      }
    } catch (err) {
      if (abortSignal?.aborted) return;
      console.error('Failed to load fulfillment options', err);
      toast.error('Could not load delivery options. Please try again.');
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    if (checkoutItems.length === 0 || Object.keys(citiesCoords).length === 0) return;
    // MED-1: AbortController cancels in-flight requests when city changes rapidly
    const controller = new AbortController();
    fetchCheckoutOptions(selectedCity, controller.signal);
    if (shippingMethod === 'DELIVERY' && fulfillmentType !== 'DIRECT_DELIVERY') {
      fetchQuotes(selectedCity);
    }
    return () => controller.abort();
  }, [selectedCity, checkoutItems, sellerCoords, citiesCoords, warehouses]);

  const activeQuote = quotes.find(q => q.code === selectedQuoteCode);
  const estimatedShippingFee = shippingMethod === 'DELIVERY' 
    ? (activeQuote ? Number(activeQuote.price) : 0) 
    : 0;
  
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setValidatingPromo(true);
    try {
      const res = await api.post('/api/promo-codes/validate/', {
        code: promoCode.trim().toUpperCase(),
        merchant: merchant,
        subtotal: checkoutTotal
      });
      setAppliedPromo(res.data);
      toast.success(t('promo_applied', 'Promo code applied successfully!'));
    } catch (err: any) {
      setAppliedPromo(null);
      toast.error(err.response?.data?.error || err.response?.data?.detail || t('promo_invalid', 'Invalid promo code'));
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
  };

  const discountAmount = appliedPromo ? Number(appliedPromo.discount_amount) : 0;
  const finalTotal = Math.max(0, checkoutTotal - discountAmount);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  useEffect(() => {
    if (checkoutItems.length === 0 && !checkoutSuccess) {
      navigate('/cart', { replace: true });
    }
  }, [checkoutItems.length, navigate, checkoutSuccess]);

  if (checkoutItems.length === 0) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

      if (hasQuoteItem) {
        setSubmitting(true);
        try {
          const rfqData = {
            items: checkoutItems.map(i => {
              let pId = i.productId;
              if (typeof pId === 'string' && pId.includes('-')) pId = parseInt(pId.split('-')[0], 10);
              return { product_id: pId, quantity: i.quantity };
            }),
            shipping_method: shippingMethod,
            fulfillment_type: fulfillmentType
          };
          const res = await api.post('/api/orders/request-invoice/', rfqData);
          setCheckoutSuccess(true);
          clearCartByMerchant(merchant);
          toast.success(t('quote_requested_success', 'Quote requested successfully!'));
          setTimeout(() => navigate(`/orders?highlight=${res.data.order_id}`), 100);
        } catch (error: any) {
          toast.error(error.response?.data?.error || t('request_failed', 'Failed to request quote.'));
        } finally {
          setSubmitting(false);
        }
        return;
      }
    if (shippingMethod === 'DELIVERY' && (!form.fullName || !form.phone || !form.deliveryAddress)) {
      toast.error(t('fill_required_fields_error', 'Please fill in all required fields for delivery'));
      return;
    }

    setSubmitting(true);
    try {
      const nearestWarehouseCode = (() => {
        if (sellerCoords?.region) {
          const matchingCity = Object.keys(citiesCoords).find(k => k.toLowerCase() === sellerCoords.region!.toLowerCase());
          if (matchingCity) return citiesCoords[matchingCity].code;
        }
        let code = 'DAR-01';
        let minDistance = Infinity;
        const listToUse = Object.keys(citiesCoords).length > 0 ? Object.values(citiesCoords).map(c => ({ code: c.code, lat: c.lat, lng: c.lng })) : [
          { code: 'WH-DAR-ES-SALAAM-01', lat: -6.8161, lng: 39.2803 },
          { code: 'WH-MWANZA-01', lat: -2.5167, lng: 32.9000 }
        ];
        const sLat = sellerCoords?.lat ?? -6.8161;
        const sLng = sellerCoords?.lng ?? 39.2803;
        for (const w of listToUse) {
          const d = Math.sqrt(Math.pow(w.lat - sLat, 2) + Math.pow(w.lng - sLng, 2));
          if (d < minDistance) { minDistance = d; code = w.code; }
        }
        return code;
      })();

      const orderData = {
        items: checkoutItems.map((item) => {
          let productId = item.productId;
          let variantId = null;
          if (typeof productId === 'string' && productId.includes('-')) {
            const parts = productId.split('-');
            productId = parseInt(parts[0], 10);
            variantId = parseInt(parts[1], 10);
          }
          return {
            product: productId,
            variant: variantId,
            quantity: item.quantity,
          };
        }),
        total_amount: finalTotal,
        shipping_method: shippingMethod,
        fulfillment_type: fulfillmentType,
        shipping_fee: 0, 
        promo_code: appliedPromo ? appliedPromo.code : undefined,
        delivery_info: {
          full_name: form.fullName,
          phone: form.phone,
          address: `${form.deliveryAddress}, ${selectedDistrict}, ${selectedCity}`,
          region: selectedCity,
          district: selectedDistrict,
          notes: form.notes,
          shipping_speed: shippingMethod === 'DELIVERY' ? selectedQuoteCode : undefined,
          warehouse_code: nearestWarehouseCode,
          destination_warehouse_code: citiesCoords[selectedCity]?.code,
          estimated_shipping_fee: estimatedShippingFee,
          is_historical_estimate: activeQuote?.is_historical_estimate ?? false
        },
      };

      const res = await api.post('/api/orders/', orderData);
      const orderId = res.data.id;

      await api.post(`/api/orders/${orderId}/advance/`, { 
        status: 'AWAITING_PAYMENT',
        notes: 'Order placed, awaiting offline payment proof.' 
      });

      setCheckoutSuccess(true);
      clearCartByMerchant(merchant);
      toast.success(t('order_placed_success', 'Order placed successfully!'));
      setTimeout(() => {
        navigate(`/orders?highlight=${orderId}`);
      }, 100);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || t('order_placed_failed', 'Failed to place order'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-page max-w-5xl">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-heading-md font-black text-gray-900 dark:text-white uppercase">{t('checkout')}</h1>
        <p className="text-xs font-bold text-brand-500 dark:text-brand-500 uppercase tracking-wide">
          {t('seller')}: @{merchant}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Delivery Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4">
          <div className="card p-6">
            {/* City & District fields moved inside the Edit Details section below */}

            <h2 className="text-heading-sm font-bold text-gray-900 dark:text-white uppercase mb-4">{t('shipping_method')}</h2>
            <div className="mb-6">
              {loadingOptions ? (
                // HIGH-3: Skeleton while options load
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map(i => (
                    <div key={i} className="p-4 rounded-btn border-2 border-surface-border dark:border-surface-dark-border animate-pulse h-24 bg-gray-100 dark:bg-gray-800" />
                  ))}
                </div>
              ) : fulfillmentOptions.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">No delivery options available for this location.</p>
              ) : (
                <>
                  {/* Delivery Group */}
                  {fulfillmentOptions.some(o => o.shipping_method === 'DELIVERY') && (
                    <div className="mb-6">
                      <h3 className="text-xs font-bold text-brand-500 dark:text-brand-500 uppercase tracking-widest mb-3">Delivery Options</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fulfillmentOptions.filter(o => o.shipping_method === 'DELIVERY').map((opt) => {
                          const isSelected = fulfillmentType === opt.fulfillment_type;
                          return (
                            <button
                              key={opt.fulfillment_type}
                              type="button"
                              onClick={() => {
                                setFulfillmentType(opt.fulfillment_type);
                                setShippingMethod(opt.shipping_method);
                              }}
                              className={`p-4 rounded-btn border-2 flex flex-col items-start gap-2 transition-all duration-200 text-left ${
                                isSelected
                                  ? 'border-brand-500 '
                                  : 'border-surface-border dark:border-surface-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Truck size={18} className={isSelected ? 'text-brand-500' : 'text-gray-500'} />
                                <span className={`font-bold text-xs uppercase tracking-wider ${isSelected ? 'text-brand-500' : 'text-gray-700 dark:text-gray-300'}`}>{opt.name}</span>
                              </div>
                              <span className="text-xs text-gray-500">{opt.description}</span>
                              <span className="text-[10px] font-bold text-gray-400 mt-auto pt-2">
                                {fulfillmentType === 'PLATFORM_DELIVERY' && activeQuote && isSelected
                                  ? `~TSh ${activeQuote.price.toLocaleString()} estimated` : ''}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Pickup Group */}
                  {fulfillmentOptions.some(o => o.shipping_method === 'PICKUP') && (
                    <div>
                      <h3 className="text-xs font-bold text-brand-500 dark:text-brand-500 uppercase tracking-widest mb-3">Pickup Options</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fulfillmentOptions.filter(o => o.shipping_method === 'PICKUP').map((opt) => {
                          const isSelected = fulfillmentType === opt.fulfillment_type;
                          return (
                            <button
                              key={opt.fulfillment_type}
                              type="button"
                              onClick={() => {
                                setFulfillmentType(opt.fulfillment_type);
                                setShippingMethod(opt.shipping_method);
                              }}
                              className={`p-4 rounded-btn border-2 flex flex-col items-start gap-2 transition-all duration-200 text-left ${
                                isSelected
                                  ? 'border-brand-500 '
                                  : 'border-surface-border dark:border-surface-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <MapPin size={18} className={isSelected ? 'text-brand-500' : 'text-gray-500'} />
                                <span className={`font-bold text-xs uppercase tracking-wider ${isSelected ? 'text-brand-500' : 'text-gray-700 dark:text-gray-300'}`}>{opt.name}</span>
                              </div>
                              <span className="text-xs text-gray-500">{opt.description}</span>
                              <span className="text-[10px] font-bold text-gray-400 mt-auto pt-2">Free</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <AnimatePresence mode="popLayout">
              {shippingMethod === 'DELIVERY' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  exit={{ opacity: 0, height: 0 }} 
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <h2 className="text-heading-sm font-bold text-gray-900 dark:text-white mt-6 mb-4 uppercase">{t('delivery_options')}</h2>
                  <div className="space-y-4">

                    {/* HIGH-2: Only show warehouse quotes for platform-managed delivery */}
                    {fulfillmentType === 'PLATFORM_DELIVERY' && quotes.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-0.5">
                          {t('delivery_speed_pricing', 'Delivery Speed & Pricing')}
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {quotes.map((q) => {
                            const isSel = selectedQuoteCode === q.code;
                            return (
                              <button
                                key={q.code}
                                type="button"
                                onClick={() => setSelectedQuoteCode(q.code)}
                                className={`p-3 border rounded-btn flex flex-col justify-center items-center transition-all duration-200 ${
                                  isSel
                                    ? 'border-brand-500  text-brand-500'
                                    : 'border-surface-border dark:border-surface-dark-border text-gray-500 dark:text-gray-400 hover:bg-surface-muted dark:hover:bg-white/5'
                                }`}
                              >
                                <span className="text-xs font-bold capitalize">{q.name}</span>
                                <span className="text-xs font-black mt-1">~TSh {q.price.toLocaleString()}</span>
                              </button>
                            );
                          })}
                        </div>
                        <span className="text-[10px] text-gray-450 dark:text-gray-500 font-bold uppercase tracking-wide block mt-1">
                          {t('estimated_shipping_notice', 'Estimated — confirmed after warehouse receipt')}
                        </span>
                      </div>
                    )}

                    {/* DIRECT_DELIVERY notice */}
                    {fulfillmentType === 'DIRECT_DELIVERY' && (
                      <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 p-3 rounded-btn mb-4">
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-bold flex items-center gap-2">
                          <Truck size={14} />
                          The seller will ship directly to your address. Shipping fee is agreed with seller.
                        </p>
                      </div>
                    )}

                    {!isEditingDetails ? (
                      <div className="bg-gray-50 dark:bg-neutral-800/50 p-4 rounded-xl border border-surface-border dark:border-surface-dark-border">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <MapPin size={16} className="text-brand-500" /> Deliver To
                          </h3>
                          <button
                            type="button"
                            onClick={() => setIsEditingDetails(true)}
                            className="text-xs font-bold text-brand-500 hover:text-brand-500 dark:text-brand-500"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          <p className="font-bold">{form.fullName}</p>
                          <p>{form.phone}</p>
                          <p className="mt-1">{form.deliveryAddress}</p>
                          <p className="text-xs text-gray-500 mt-1">{selectedCity}{selectedDistrict ? `, ${selectedDistrict}` : ''}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 border border-surface-border dark:border-surface-dark-border p-5 rounded-xl bg-gray-50/50 dark:bg-neutral-800/20">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase">Shipping Details</h3>
                          {form.fullName && form.phone && form.deliveryAddress && (
                            <button
                              type="button"
                              onClick={() => setIsEditingDetails(false)}
                              className="text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white"
                            >
                              Cancel
                            </button>
                          )}
                        </div>

                        {/* City & District */}
                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="flex flex-col gap-1.5 w-full">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-0.5">
                              {t('city_region_label', 'City / Region *')}
                            </label>
                            <select
                              value={selectedCity}
                              onChange={handleCityChange}
                              className="flex h-10 w-full rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:border-brand-500 dark:border-surface-dark-border dark:bg-[#111] dark:text-white"
                              required
                            >
                              <option value="" disabled>Select a region</option>
                              {regionsData.length > 0 
                                ? regionsData.map((r: any) => <option key={r.name} value={r.name}>{r.name}</option>)
                                : Object.keys(citiesCoords).map((city) => <option key={city} value={city}>{city}</option>)
                              }
                            </select>
                          </div>

                          {availableDistricts.length > 0 && (
                            <div className="flex flex-col gap-1.5 w-full">
                              <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-0.5">
                                {t('district_label', 'District *')}
                              </label>
                              <select
                                value={selectedDistrict}
                                onChange={(e) => setSelectedDistrict(e.target.value)}
                                className="flex h-10 w-full rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:border-brand-500 dark:border-surface-dark-border dark:bg-[#111] dark:text-white"
                                required
                              >
                                {availableDistricts.map((d: any) => (
                                  <option key={d.name} value={d.name}>{d.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col md:flex-row gap-4">
                          <FormField id="fullName" name="fullName" label={t('first_name') + " & " + t('last_name') + " *"} type="text" required value={form.fullName} onChange={handleChange} placeholder={t('first_name')} />
                          <FormField id="phone" name="phone" label={t('phone_number') + " *"} type="tel" required value={form.phone} onChange={handleChange} placeholder="+255 7XX XXX XXX" />
                        </div>
                        
                        <div className="flex flex-col gap-1.5 w-full">
                          <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-0.5">{t('delivery_address') + " *"}</label>
                          <AddressAutocomplete
                            value={form.deliveryAddress}
                            onChange={(val, coords, region, district) => {
                              setForm(prev => ({ ...prev, deliveryAddress: val }));
                              if (coords) setDeliveryCoords(coords);
                              
                              if (region) {
                                // Find matching region in regionsData
                                const matchingRegion = regionsData.find((r: any) => 
                                  r.name.toLowerCase() === region.toLowerCase() || 
                                  region.toLowerCase().includes(r.name.toLowerCase()) ||
                                  r.name.toLowerCase().includes(region.toLowerCase())
                                );
                                
                                if (matchingRegion) {
                                  setSelectedCity(matchingRegion.name);
                                  
                                  if (district && matchingRegion.districts) {
                                    const matchingDistrict = matchingRegion.districts.find((d: any) =>
                                      d.name.toLowerCase() === district.toLowerCase() ||
                                      district.toLowerCase().includes(d.name.toLowerCase()) ||
                                      d.name.toLowerCase().includes(district.toLowerCase())
                                    );
                                    if (matchingDistrict) {
                                      setSelectedDistrict(matchingDistrict.name);
                                    } else {
                                      setSelectedDistrict(matchingRegion.districts[0]?.name || '');
                                    }
                                  } else {
                                    setSelectedDistrict(matchingRegion.districts?.[0]?.name || '');
                                  }
                                } else {
                                  // Fallback: Just set the raw region string
                                  setSelectedCity(region);
                                }
                              }
                            }}
                          />
                          {deliveryCoords && sellerCoords && (
                            <p className="text-xs font-bold text-brand-500 dark:text-brand-500 mt-1 flex items-center gap-1">
                              <MapPin size={12} />
                              ~{calculateDistance(sellerCoords.lat, sellerCoords.lng, deliveryCoords.lat, deliveryCoords.lng).toFixed(1)} km from the seller's store
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5 w-full">
                          <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-0.5">{t('notes_optional', 'Notes (optional)')}</label>
                          <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} className="flex w-full rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:border-brand-500 dark:border-surface-dark-border dark:bg-[#111] dark:text-white resize-none" placeholder={t('notes_placeholder', 'Special delivery instructions...')} />
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {shippingMethod === 'PICKUP' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  exit={{ opacity: 0, height: 0 }} 
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  {/* CRIT-3: Always collect contact info, even for pickups */}
                  <h2 className="text-heading-sm font-bold text-gray-900 dark:text-white mt-6 mb-4 uppercase">Your Details</h2>
                  <div className="space-y-4 mb-4">
                    <FormField id="fullName" name="fullName" label={t('first_name') + " & " + t('last_name') + " *"} type="text" required value={form.fullName} onChange={handleChange} placeholder={t('first_name')} />
                    <FormField id="phone" name="phone" label={t('phone_number') + " *"} type="tel" required value={form.phone} onChange={handleChange} placeholder="+255 7XX XXX XXX" />
                  </div>
                  <div className="  p-4 rounded-btn border border-brand-500/30 dark:border-brand-500/20">
                    <p className="text-xs font-bold text-brand-500 dark:text-brand-500 flex items-center gap-2">
                      <Shield size={14} />
                      {fulfillmentType === 'SELLER_PICKUP' 
                        ? t('seller_pickup_notice', "You will pick up your order directly from the seller's location. Contact details will be provided after checkout.")
                        : t('pickup_notice', 'Your order will be held at our local warehouse. A secure pickup code will be generated upon arrival.')}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button
            type="submit"
            loading={submitting}
            className="w-full flex items-center justify-center gap-2 mt-4"
          >
            {hasQuoteItem ? <Shield size={16} /> : <CreditCard size={16} />}
            {hasQuoteItem ? t('request_invoice', 'Request Invoice') : t('pay_product_price', 'Pay Product Price — TSh {{price}}', { price: finalTotal.toLocaleString() })}
          </Button>
        </form>

        {/* Order Summary */}
        <div className="card p-6 h-fit sticky top-24">
          <h2 className="text-heading-sm font-bold text-gray-900 dark:text-white uppercase mb-4">
            {t('order_summary')} (@{merchant})
          </h2>
          <div className="space-y-3 mb-4">
            {checkoutItems.map((item) => (
              <div key={item.productId} className="flex items-center gap-3">
                <SafeImage
                  src={item.image}
                  alt={item.name}
                  category={item.category}
                  className="w-10 h-10 object-cover rounded-btn border border-surface-border dark:border-surface-dark-border"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{item.name}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">x{item.quantity}</p>
                </div>
                <p className="text-xs font-black text-gray-900 dark:text-white">
                  TSh {(item.price * item.quantity).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {/* Promo Code Input */}
          <div className="border-t border-b border-surface-border dark:border-surface-dark-border py-3 my-4 space-y-2">
            <label className="block text-2xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('promo_code', 'Promo Code')}
            </label>
            {appliedPromo ? (
              <div className="flex justify-between items-center   border border-green-500/50 dark:border-green-500/30 p-2 rounded-btn">
                <div>
                  <span className="font-mono font-black text-xs text-green-500 dark:text-green-500">{appliedPromo.code}</span>
                  <span className="text-[10px] text-green-500 dark:text-green-500 block font-bold uppercase tracking-wider mt-0.5">Applied!</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemovePromo}
                  className="text-2xs font-bold text-red-500 hover:text-red-500 transition uppercase tracking-wide"
                >
                  {t('remove')}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. SAVE10"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="flex-1 p-2 border border-surface-border dark:border-surface-dark-border rounded-btn bg-white dark:bg-[#111] dark:text-white text-xs outline-none focus-visible:ring-1 focus-visible:ring-brand-500 font-mono"
                />
                <Button
                  type="button"
                  onClick={handleApplyPromo}
                  disabled={validatingPromo || !promoCode.trim()}
                  size="sm"
                >
                  {validatingPromo ? '...' : t('apply_btn', 'Apply')}
                </Button>
              </div>
            )}
          </div>

          <div className="border-t border-surface-border dark:border-surface-dark-border pt-3 space-y-2 text-xs">
            <div className="flex justify-between items-center font-bold">
              <span className="text-gray-500 dark:text-gray-400">{t('subtotal')}</span>
              <span className="text-gray-900 dark:text-white">
                TSh {checkoutTotal.toLocaleString()}
              </span>
            </div>
            {appliedPromo && (
              <div className="flex justify-between items-center text-green-500 dark:text-green-500 font-bold">
                <span>Discount ({appliedPromo.code})</span>
                <span>- TSh {Number(appliedPromo.discount_amount || 0).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center font-bold">
              <span className="text-gray-500 dark:text-gray-400">
                {fulfillmentType === 'DIRECT_DELIVERY'
                  ? t('shipping', 'Shipping')
                  : fulfillmentType === 'WAREHOUSE_PICKUP'
                  ? t('pickup_fee', 'Pickup Fee')
                  : t('shipping_billed_later', 'Shipping (Billed Later)')}
              </span>
              <span className="text-brand-500 dark:text-brand-500 uppercase text-[10px] tracking-wide"
                title={fulfillmentType === 'DIRECT_DELIVERY'
                  ? 'Shipping fee to be agreed with seller.'
                  : 'Final shipping is confirmed by warehouse staff after your item is dropped off.'}>
                {shippingMethod === 'PICKUP'
                  ? t('free', 'Free')
                  : fulfillmentType === 'DIRECT_DELIVERY'
                  ? t('agreed_with_seller', 'Agreed with seller')
                  : (estimatedShippingFee > 0 ? `Est. TSh ${estimatedShippingFee.toLocaleString()}` : 'TBD')}
              </span>
            </div>
            <div className="border-t border-surface-border dark:border-surface-dark-border pt-2 flex justify-between items-center">
              <span className="font-extrabold text-sm text-gray-950 dark:text-white uppercase">{t('due_today', 'Due Today')}</span>
              <span className="text-lg font-black text-brand-500 dark:text-brand-500">
                TSh {finalTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
