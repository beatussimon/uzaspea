import React from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import SafeImage from '../components/SafeImage';

const CartPage: React.FC = () => {
  const { items, updateQuantity, removeFromCart, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShoppingBag size={64} className="text-gray-300 dark:text-gray-600" />
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Your cart is empty</h2>
        <p className="text-gray-500 dark:text-gray-400">Add some products to get started!</p>
        <Link
          to="/"
          className="mt-4 px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition shadow-md"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  const groupedItems = items.reduce((acc, item) => {
    const merchant = item.seller_username || 'Unknown Store';
    if (!acc[merchant]) acc[merchant] = [];
    acc[merchant].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shopping Cart</h1>
        <button
          onClick={() => { if (window.confirm('Remove all items from your cart?')) clearCart(); }}
          className="text-sm text-red-500 hover:text-red-700 transition font-bold"
        >
          Clear All
        </button>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedItems).map(([merchant, storeItems]) => {
          const storeSubtotal = storeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
          
          return (
            <div key={merchant} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={18} className="text-brand-600 dark:text-brand-400" />
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    Store: <span className="text-brand-600 dark:text-brand-400">@{merchant}</span>
                  </h3>
                </div>
              </div>
              
              <div className="p-4 space-y-4">
                {storeItems.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center gap-4 border-b border-gray-100 dark:border-gray-700 pb-4 last:border-0 last:pb-0"
                  >
                    <Link to={`/product/${item.slug}`} className="shrink-0">
                      <SafeImage
                        src={item.image}
                        alt={item.name}
                        category={item.category}
                        className="w-20 h-20 object-cover rounded-lg border dark:border-gray-700"
                      />
                    </Link>

                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/product/${item.slug}`}
                        className="font-semibold text-gray-900 dark:text-white truncate block hover:text-brand-600 transition"
                      >
                        {item.name}
                      </Link>
                      <p className="text-brand-600 dark:text-brand-400 font-bold mt-1">
                        TSh {item.price.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.stock} in stock</p>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 rounded-lg p-1 border dark:border-gray-700">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-800 transition shadow-sm text-gray-600 dark:text-gray-300"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-bold text-gray-900 dark:text-white text-sm">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-800 transition shadow-sm text-gray-600 dark:text-gray-300"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <p className="font-bold text-gray-900 dark:text-white w-28 text-right hidden sm:block">
                      TSh {(item.price * item.quantity).toLocaleString()}
                    </p>

                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition shrink-0 ml-2"
                      title="Remove item"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-medium">
                  <span>{storeItems.reduce((s, i) => s + i.quantity, 0)} item(s) from this store</span>
                  <span className="hidden sm:inline px-2 text-gray-300 dark:text-gray-600">•</span>
                  <span className="text-gray-900 dark:text-white font-bold">Subtotal: TSh {storeSubtotal.toLocaleString()}</span>
                </div>
                <Link
                  to={`/checkout?merchant=${encodeURIComponent(merchant)}`}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg transition shadow-sm hover:shadow-md active:scale-95"
                >
                  Checkout {merchant} <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CartPage;
