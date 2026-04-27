import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, MapPin, Phone, User, Truck, Shield } from 'lucide-react';
import { useCart } from '../context/CartContext';
import api from '../api';
import toast from 'react-hot-toast';
import SafeImage from '../components/SafeImage';

const CheckoutPage: React.FC = () => {
  const { items, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    deliveryAddress: '',
    notes: '',
  });

  const shippingFee = shippingMethod === 'DELIVERY' ? 5000 : 0;
  const finalTotal = totalPrice + shippingFee;

  if (items.length === 0) {
    navigate('/cart');
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
      clearCart();
      toast.success('Order placed successfully!');
      navigate(`/orders?highlight=${res.data.id}`);
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
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                    : 'border-gray-100 dark:border-gray-700 text-gray-500'
                }`}
              >
                <Truck size={24} />
                <span className="font-bold text-sm">Home Delivery</span>
                <span className="text-xs">TSh 5,000</span>
              </button>
              <button
                type="button"
                onClick={() => setShippingMethod('PICKUP')}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition ${
                  shippingMethod === 'PICKUP'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                    : 'border-gray-100 dark:border-gray-700 text-gray-500'
                }`}
              >
                <MapPin size={24} />
                <span className="font-bold text-sm">Physical Pickup</span>
                <span className="text-xs">Free</span>
              </button>
            </div>

            {shippingMethod === 'DELIVERY' && (
              <>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Delivery Information</h2>
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <User size={14} /> Full Name *
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={form.fullName}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
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
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
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
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
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
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition resize-none"
                      placeholder="Special delivery instructions..."
                    />
                  </div>
                </div>
              </>
            )}

            {shippingMethod === 'PICKUP' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 animate-fade-in">
                <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <Shield size={16} />
                  Your order will be held at our main branch in Dar es Salaam. Please bring your Order ID.
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl transition shadow-xl shadow-blue-600/20"
          >
            <CreditCard size={20} />
            {submitting ? 'Placing Order...' : `Place Order — TSh ${finalTotal.toLocaleString()}`}
          </button>
        </form>

        {/* Order Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6 h-fit">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Order Summary</h2>
          <div className="space-y-3 mb-4">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3">
                <SafeImage
                  src={item.image}
                  alt={item.name}
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
          <div className="border-t dark:border-gray-700 pt-3 flex justify-between items-center">
            <span className="font-medium text-gray-600 dark:text-gray-400">Total</span>
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
              TSh {totalPrice.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
