import React from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import SafeImage from '../components/SafeImage';

const CartPage: React.FC = () => {
  const { items, totalPrice, updateQuantity, removeFromCart, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShoppingBag size={64} className="text-gray-300 dark:text-gray-600" />
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Your cart is empty</h2>
        <p className="text-gray-500 dark:text-gray-400">Add some products to get started!</p>
        <Link
          to="/"
          className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shopping Cart</h1>
        <button
          onClick={clearCart}
          className="text-sm text-red-500 hover:text-red-700 transition"
        >
          Clear All
        </button>
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.productId}
            className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-4 transition hover:shadow-md"
          >
            <Link to={`/product/${item.slug}`} className="shrink-0">
              <SafeImage
                src={item.image}
                alt={item.name}
                className="w-20 h-20 object-cover rounded-lg"
              />
            </Link>

            <div className="flex-1 min-w-0">
              <Link
                to={`/product/${item.slug}`}
                className="font-semibold text-gray-900 dark:text-white truncate block hover:text-blue-600 transition"
              >
                {item.name}
              </Link>
              <p className="text-blue-600 dark:text-blue-400 font-bold mt-1">
                TSh {item.price.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{item.stock} in stock</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                className="p-1.5 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center font-medium text-gray-900 dark:text-white">
                {item.quantity}
              </span>
              <button
                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                className="p-1.5 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <Plus size={14} />
              </button>
            </div>

            <p className="font-bold text-gray-900 dark:text-white w-28 text-right">
              TSh {(item.price * item.quantity).toLocaleString()}
            </p>

            <button
              onClick={() => removeFromCart(item.productId)}
              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-600 dark:text-gray-400">
            {items.reduce((s, i) => s + i.quantity, 0)} item(s)
          </span>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            TSh {totalPrice.toLocaleString()}
          </span>
        </div>
        <Link
          to="/checkout"
          className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition shadow-md"
        >
          Proceed to Checkout
          <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
};

export default CartPage;
