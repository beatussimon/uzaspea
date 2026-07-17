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

  const [submitting, setSubmitting] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  
  const [selectedCity, setSelectedCity] = useState('Dar es Salaam');
  const [quotes, setQuotes] = useState<any[]>([]);
  const [selectedQuoteCode, setSelectedQuoteCode] = useState('standard');

  const [sellerCoords, setSellerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [citiesCoords, setCitiesCoords] = useState<Record<string, { lat: number; lng: number; code: string }>>({});

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    deliveryAddress: '',
    notes: '',
  });

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
              });
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
          setForm(prev => ({
            ...prev,
            fullName: prev.fullName || `${data.user?.first_name || ''} ${data.user?.last_name || ''}`.trim() || data.username || '',
            phone: prev.phone || data.phone_number || '',
            deliveryAddress: prev.deliveryAddress || data.location || '',
          }));
          if (data.location) {
            setSelectedCity(data.location);
          }
        }
      } catch (err) {
        console.error('Failed to fetch user profile', err);
      }
    };
    fetchUserProfile();
  }, []);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await api.get('/api/warehouses/warehouses/');
        const list = res.data.results || res.data || [];
        setWarehouses(list);
        
        const dynamicCoords: Record<string, { lat: number; lng: number; code: string }> = {};
        list.forEach((w: any) => {
          if (w.region && w.latitude !== null && w.longitude !== null) {
            dynamicCoords[w.region] = {
              lat: Number(w.latitude),
              lng: Number(w.longitude),
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
    
    try {
      const res = await api.post('/api/logistics/pricing/quote/', {
        start_lat: sellerCoords?.lat ?? -6.8161,
        start_lng: sellerCoords?.lng ?? 39.2803,
        end_lat: coords.lat,
        end_lng: coords.lng,
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

  useEffect(() => {
    if (shippingMethod === 'DELIVERY' && checkoutItems.length > 0 && Object.keys(citiesCoords).length > 0) {
      fetchQuotes(selectedCity);
    }
  }, [shippingMethod, selectedCity, checkoutItems, sellerCoords, citiesCoords]);

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
    if (shippingMethod === 'DELIVERY' && (!form.fullName || !form.phone || !form.deliveryAddress)) {
      toast.error(t('fill_required_fields_error', 'Please fill in all required fields for delivery'));
      return;
    }

    setSubmitting(true);
    try {
      const getNearestWarehouseCode = (lat: number, lng: number): string => {
        let nearestCode = 'DAR-01';
        let minDistance = Infinity;
        const listToUse = warehouses.length > 0 ? warehouses : [
          { code: 'DAR-01', latitude: -6.8161, longitude: 39.2803 },
          { code: 'MWZ-01', latitude: -2.5167, longitude: 32.9000 }
        ];
        for (const w of listToUse) {
          const wLat = Number(w.latitude);
          const wLng = Number(w.longitude);
          const d = Math.sqrt(Math.pow(wLat - lat, 2) + Math.pow(wLng - lng, 2));
          if (d < minDistance) {
            minDistance = d;
            nearestCode = w.code;
          }
        }
        return nearestCode;
      };

      const sellerLat = sellerCoords?.lat ?? -6.8161;
      const sellerLng = sellerCoords?.lng ?? 39.2803;
      const nearestWarehouseCode = getNearestWarehouseCode(sellerLat, sellerLng);

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
        shipping_fee: 0, 
        promo_code: appliedPromo ? appliedPromo.code : undefined,
        delivery_info: {
          full_name: form.fullName,
          phone: form.phone,
          address: `${form.deliveryAddress}, ${selectedCity}`,
          notes: form.notes,
          shipping_speed: shippingMethod === 'DELIVERY' ? selectedQuoteCode : undefined,
          warehouse_code: nearestWarehouseCode,
          destination_warehouse_code: citiesCoords[selectedCity]?.code,
          estimated_shipping_fee: estimatedShippingFee
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
        <p className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wide">
          {t('seller')}: @{merchant}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Delivery Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4">
          <div className="card p-6">
            <h2 className="text-heading-sm font-bold text-gray-900 dark:text-white uppercase mb-4">{t('shipping_method')}</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                type="button"
                onClick={() => setShippingMethod('DELIVERY')}
                className={`p-4 rounded-btn border-2 flex flex-col items-center gap-2 transition-all duration-200 ${
                  shippingMethod === 'DELIVERY'
                    ? 'border-brand-600 bg-brand-50/10 text-brand-600'
                    : 'border-surface-border dark:border-surface-dark-border text-gray-500'
                }`}
              >
                <Truck size={20} />
                <span className="font-bold text-xs uppercase tracking-wider">{t('home_delivery')}</span>
                <span className="text-[10px] font-bold">
                  {shippingMethod === 'DELIVERY' && activeQuote
                    ? `~TSh ${activeQuote.price.toLocaleString()}`
                    : t('estimated', 'Estimated')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShippingMethod('PICKUP')}
                className={`p-4 rounded-btn border-2 flex flex-col items-center gap-2 transition-all duration-200 ${
                  shippingMethod === 'PICKUP'
                    ? 'border-brand-600 bg-brand-50/10 text-brand-600'
                    : 'border-surface-border dark:border-surface-dark-border text-gray-500'
                }`}
              >
                <MapPin size={20} />
                <span className="font-bold text-xs uppercase tracking-wider">{t('pickup')}</span>
                <span className="text-[10px] font-bold">{t('free', 'Free')}</span>
              </button>
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
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-0.5">
                        {t('city_region_label', 'City / Region *')}
                      </label>
                      <select
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                        className="flex h-10 w-full rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:border-brand-500 dark:border-surface-dark-border dark:bg-[#111] dark:text-white"
                        required
                      >
                        {Object.keys(citiesCoords).map((city) => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>

                    {quotes.length > 0 && (
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
                                    ? 'border-brand-600 bg-brand-50/10 text-brand-600'
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

                    <FormField
                      id="fullName"
                      name="fullName"
                      label={t('first_name') + " & " + t('last_name') + " *"}
                      type="text"
                      required
                      value={form.fullName}
                      onChange={handleChange}
                      placeholder={t('first_name')}
                    />

                    <FormField
                      id="phone"
                      name="phone"
                      label={t('phone_number') + " *"}
                      type="tel"
                      required
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="+255 7XX XXX XXX"
                    />

                    <FormField
                      id="deliveryAddress"
                      name="deliveryAddress"
                      label={t('delivery_address') + " *"}
                      type="text"
                      required
                      value={form.deliveryAddress}
                      onChange={handleChange}
                      placeholder="Street, Area"
                    />

                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-0.5">
                        {t('notes_optional', 'Notes (optional)')}
                      </label>
                      <textarea
                        name="notes"
                        value={form.notes}
                        onChange={handleChange}
                        rows={3}
                        className="flex w-full rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:border-brand-500 dark:border-surface-dark-border dark:bg-[#111] dark:text-white resize-none"
                        placeholder={t('notes_placeholder', 'Special delivery instructions...')}
                      />
                    </div>
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
                  <div className="bg-brand-50/10 dark:bg-brand-900/10 p-4 rounded-btn border border-brand-100/30 dark:border-brand-900/20 mt-6">
                    <p className="text-xs font-bold text-brand-700 dark:text-brand-300 flex items-center gap-2">
                      <Shield size={14} />
                      {t('pickup_notice', 'Your order will be held at our main warehouse. A secure pickup code will be generated upon arrival.')}
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
            <CreditCard size={16} />
            {t('pay_product_price', 'Pay Product Price — TSh {{price}}', { price: finalTotal.toLocaleString() })}
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
              <div className="flex justify-between items-center bg-green-50 dark:bg-green-950/20 border border-green-100/50 dark:border-green-900/30 p-2 rounded-btn">
                <div>
                  <span className="font-mono font-black text-xs text-green-700 dark:text-green-400">{appliedPromo.code}</span>
                  <span className="text-[10px] text-green-600 dark:text-green-500 block font-bold uppercase tracking-wider mt-0.5">Applied!</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemovePromo}
                  className="text-2xs font-bold text-red-500 hover:text-red-700 transition uppercase tracking-wide"
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
              <div className="flex justify-between items-center text-green-600 dark:text-green-500 font-bold">
                <span>Discount ({appliedPromo.code})</span>
                <span>- TSh {Number(appliedPromo.discount_amount).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center font-bold">
              <span className="text-gray-500 dark:text-gray-400">{t('shipping_billed_later', 'Shipping (Billed Later)')}</span>
              <span className="text-brand-600 dark:text-brand-400 uppercase text-[10px] tracking-wide" title="Final shipping is confirmed by warehouse staff after your item is dropped off.">
                {shippingMethod === 'PICKUP' ? t('free', 'Free') : (estimatedShippingFee > 0 ? `Est. TSh ${estimatedShippingFee.toLocaleString()}` : 'TBD')}
              </span>
            </div>
            <div className="border-t border-surface-border dark:border-surface-dark-border pt-2 flex justify-between items-center">
              <span className="font-extrabold text-sm text-gray-950 dark:text-white uppercase">{t('due_today', 'Due Today')}</span>
              <span className="text-lg font-black text-brand-600 dark:text-brand-400">
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
