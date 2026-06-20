import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, MapPin, Phone, User, Truck, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import api from '../api';
import toast from 'react-hot-toast';
import SafeImage from '../components/SafeImage';

const CheckoutPage: React.FC = () => {
  const { items, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    deliveryAddress: '',
    notes: '',
  });

  useEffect(() => {
    if (shippingMethod === 'DELIVERY' && items.length > 0) {
      const sellerUsername = items[0]?.seller_username;
      if (sellerUsername) {
        api.get(`/api/delivery-zones/?seller=${sellerUsername}`)
          .then(res => setDeliveryZones(res.data.results || res.data))
          .catch(() => {});
      }
    }
  }, [shippingMethod, items]);

  const selectedZone = deliveryZones.find(z => z.id.toString() === selectedZoneId);
  const shippingFee = shippingMethod === 'DELIVERY' 
    ? (deliveryZones.length > 0 ? (selectedZone ? Number(selectedZone.delivery_fee) : 0) : 5000) 
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
    if (shippingMethod === 'DELIVERY' && deliveryZones.length > 0 && !selectedZoneId) {
      toast.error('Please select a delivery zone');
      return;
    }

    setSubmitting(true);
    try {
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
          address: form.deliveryAddress,
          notes: form.notes,
        },
      };

      const res = await api.post('/api/orders/', orderData);
      const orderId = res.data.id;

      // FIX: C-02 — Advance status to AWAITING_PAYMENT after creation
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
                  {deliveryZones.length > 0 
                    ? (selectedZone ? `TSh ${Number(selectedZone.delivery_fee).toLocaleString()}` : 'Select zone')
                    : 'TSh 5,000'}
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
                  {deliveryZones.length > 0 && (
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <MapPin size={14} /> Delivery Zone *
                      </label>
                      <select
                        value={selectedZoneId}
                        onChange={(e) => setSelectedZoneId(e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition"
                        required
                      >
                        <option value="">Select a delivery zone</option>
                        {deliveryZones.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.zone_name} — TSh {Number(zone.delivery_fee).toLocaleString()}
                          </option>
                        ))}
                      </select>
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
                      placeholder="Street, Area, City"
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
                      Your order will be held at our main branch in Dar es Salaam. Please bring your Order ID.
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
