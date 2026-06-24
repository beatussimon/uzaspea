import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, MapPin, Phone, User, Truck, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import api from '../api';
import toast from 'react-hot-toast';
import SafeImage from '../components/SafeImage';

const CITIES_COORDS: Record<string, { lat: number; lng: number }> = {
  'Dar es Salaam': { lat: -6.776012, lng: 39.178326 },
  'Mwanza': { lat: -2.5167, lng: 32.9000 },
  'Arusha': { lat: -3.3731, lng: 36.6858 },
  'Dodoma': { lat: -6.1630, lng: 35.7516 },
  'Zanzibar': { lat: -6.1659, lng: 39.1990 },
};

const CheckoutPage: React.FC = () => {
  const { items, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  
  const [selectedCity, setSelectedCity] = useState('Dar es Salaam');
  const [quotes, setQuotes] = useState<any[]>([]);
  const [selectedQuoteCode, setSelectedQuoteCode] = useState('standard');

  const [sellerCoords, setSellerCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    deliveryAddress: '',
    notes: '',
  });

  useEffect(() => {
    const fetchSellerCoords = async () => {
      if (items.length > 0) {
        const sellerUsername = items[0].seller_username;
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
  }, [items]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const username = localStorage.getItem('username');
        if (username) {
          const res = await api.get(`/api/profiles/${username}/`);
          const data = res.data;
          setForm(prev => ({
            ...prev,
            fullName: prev.fullName || data.username || '',
            phone: prev.phone || data.phone_number || '',
            deliveryAddress: prev.deliveryAddress || data.location || '',
          }));
          if (data.location && Object.keys(CITIES_COORDS).includes(data.location)) {
            setSelectedCity(data.location);
          }
        }
      } catch (err) {
        console.error('Failed to fetch user profile', err);
      }
    };
    fetchUserProfile();
  }, []);

  const fetchQuotes = async (city: string) => {
    const coords = CITIES_COORDS[city];
    if (!coords) return;
    
    const totalWeight = items.reduce((acc, item) => acc + (item.quantity * (item.weight_kg ?? 1.0)), 0);
    const sizesPriority: Record<string, number> = { 'small': 0, 'medium': 1, 'large': 2, 'oversized': 3 };
    let maxSize = 'small';
    for (const item of items) {
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
      // If selected quote is not in new list, pick standard or first
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
    if (shippingMethod === 'DELIVERY' && items.length > 0) {
      fetchQuotes(selectedCity);
    }
  }, [shippingMethod, selectedCity, items, sellerCoords]);

  const activeQuote = quotes.find(q => q.code === selectedQuoteCode);
  const shippingFee = shippingMethod === 'DELIVERY' 
    ? (activeQuote ? Number(activeQuote.price) : 5000) 
    : 0;
  const finalTotal = totalPrice + shippingFee;

  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  useEffect(() => {
    if (items.length === 0 && !checkoutSuccess) {
      navigate('/cart', { replace: true });
    }
  }, [items.length, navigate, checkoutSuccess]);

  if (items.length === 0) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (shippingMethod === 'DELIVERY' && (!form.fullName || !form.phone || !form.deliveryAddress)) {
      toast.error('Please fill in all required fields for delivery');
      return;
    }

    setSubmitting(true);
    try {
      const getNearestWarehouseCode = (lat: number, lng: number): string => {
        const warehouses = [
          { code: 'DAR-01', lat: -6.8161, lng: 39.2803 },
          { code: 'MWZ-01', lat: -2.5167, lng: 32.9000 }
        ];
        let nearestCode = 'DAR-01';
        let minDistance = Infinity;
        for (const w of warehouses) {
          const d = Math.sqrt(Math.pow(w.lat - lat, 2) + Math.pow(w.lng - lng, 2));
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
        items: items.map((item) => ({
          product: item.productId,
          quantity: item.quantity,
        })),
        total_amount: finalTotal,
        shipping_method: shippingMethod,
        shipping_fee: shippingFee,
        delivery_info: {
          full_name: form.fullName,
          phone: form.phone,
          address: `${form.deliveryAddress}, ${selectedCity}`,
          notes: form.notes,
          shipping_speed: shippingMethod === 'DELIVERY' ? selectedQuoteCode : undefined,
          warehouse_code: nearestWarehouseCode
        },
      };

      const res = await api.post('/api/orders/', orderData);
      const orderId = res.data.id;

      // Advance status to AWAITING_PAYMENT after creation
      await api.post(`/api/orders/${orderId}/advance/`, { 
        status: 'AWAITING_PAYMENT',
        notes: 'Checkout completed.' 
      });

      setCheckoutSuccess(true);
      clearCart();
      toast.success('Order placed successfully!');
      setTimeout(() => {
        navigate(`/orders?highlight=${orderId}`);
      }, 100);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Delivery Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Shipping Method</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                type="button"
                onClick={() => setShippingMethod('DELIVERY')}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition ${
                  shippingMethod === 'DELIVERY'
                    ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20 text-brand-600'
                    : 'border-gray-100 dark:border-gray-700 text-gray-500'
                }`}
              >
                <Truck size={24} />
                <span className="font-bold text-sm">Home Delivery</span>
                <span className="text-xs">
                  {shippingMethod === 'DELIVERY' && activeQuote
                    ? `TSh ${activeQuote.price.toLocaleString()}`
                    : 'From TSh 2,000'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShippingMethod('PICKUP')}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition ${
                  shippingMethod === 'PICKUP'
                    ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20 text-brand-600'
                    : 'border-gray-100 dark:border-gray-700 text-gray-500'
                }`}
              >
                <MapPin size={24} />
                <span className="font-bold text-sm">Physical Pickup</span>
                <span className="text-xs">Free</span>
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
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mt-6 mb-4">Delivery Information</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <MapPin size={14} /> City / Region *
                      </label>
                      <select
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition"
                        required
                      >
                        {Object.keys(CITIES_COORDS).map((city) => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>

                    {/* Delivery Speeds quote selection */}
                    {quotes.length > 0 && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Delivery Speed & Pricing
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {quotes.map((q) => {
                            const isSel = selectedQuoteCode === q.code;
                            return (
                              <button
                                key={q.code}
                                type="button"
                                onClick={() => setSelectedQuoteCode(q.code)}
                                className={`p-3 border rounded-xl flex flex-col justify-center items-center transition ${
                                  isSel
                                    ? 'border-brand-600 bg-brand-50/10 text-brand-600'
                                    : 'border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800'
                                }`}
                              >
                                <span className="text-xs font-bold capitalize">{q.name}</span>
                                <span className="text-xs font-black mt-1">TSh {q.price.toLocaleString()}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <User size={14} /> Full Name *
                      </label>
                      <input
                        type="text"
                        name="fullName"
                        value={form.fullName}
                        onChange={handleChange}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition"
                        placeholder="Enter your full name"
                        required
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <Phone size={14} /> Phone Number *
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition"
                        placeholder="+255 7XX XXX XXX"
                        required
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <MapPin size={14} /> Delivery Address *
                      </label>
                      <input
                        type="text"
                        name="deliveryAddress"
                        value={form.deliveryAddress}
                        onChange={handleChange}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition"
                        placeholder="Street, Area"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                        Notes (optional)
                      </label>
                      <textarea
                        name="notes"
                        value={form.notes}
                        onChange={handleChange}
                        rows={3}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition resize-none"
                        placeholder="Special delivery instructions..."
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
                  <div className="bg-brand-50 dark:bg-brand-900/20 p-4 rounded-xl border border-brand-100 dark:border-brand-800 mt-6">
                    <p className="text-sm text-brand-700 dark:text-brand-300 flex items-center gap-2">
                      <Shield size={16} />
                      Your order will be held at our main hub in Kariakoo. A secure pickup code will be generated upon arrival.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-4 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-bold rounded-xl transition shadow-xl shadow-brand-600/20"
          >
            <CreditCard size={20} />
            {submitting ? 'Placing Order...' : `Place Order — TSh ${finalTotal.toLocaleString()}`}
          </button>
        </form>

        {/* Order Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6 h-fit sticky top-24">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Order Summary</h2>
          <div className="space-y-3 mb-4">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3">
                <SafeImage
                  src={item.image}
                  alt={item.name}
                  category={item.category}
                  className="w-12 h-12 object-cover rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">x{item.quantity}</p>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  TSh {(item.price * item.quantity).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t dark:border-gray-700 pt-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-600 dark:text-gray-400">Subtotal</span>
              <span className="font-medium text-gray-900 dark:text-white">
                TSh {totalPrice.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-600 dark:text-gray-400">Shipping</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {shippingMethod === 'PICKUP' ? 'Free' : (shippingFee > 0 ? `TSh ${shippingFee.toLocaleString()}` : 'Pending')}
              </span>
            </div>
            <div className="border-t dark:border-gray-700 pt-2 flex justify-between items-center">
              <span className="font-bold text-gray-900 dark:text-white">Total</span>
              <span className="text-xl font-black text-brand-600 dark:text-brand-400">
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
