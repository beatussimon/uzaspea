import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import SafeImage from '../components/SafeImage';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../components/ui/Dialogs';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';

const CartPage: React.FC = () => {
  const { t } = useTranslation();
  const { showConfirm } = useDialog();
  const { items, updateQuantity, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="container-page max-w-4xl py-12">
        <EmptyState
          icon={ShoppingBag}
          title={t('empty_cart')}
          description={t('empty_cart_subtitle', 'Add some products to get started!')}
          action={{
            label: t('browse_products'),
            onClick: () => navigate('/'),
          }}
        />
      </div>
    );
  }

  const groupedItems = items.reduce((acc, item) => {
    const merchant = item.seller_username || 'Unknown Store';
    if (!acc[merchant]) acc[merchant] = [];
    acc[merchant].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  const handleClearCart = async () => {
    const confirmed = await showConfirm(
      t('clear_cart_confirm', 'Remove all items from your cart?'),
      t('clear_cart_title', 'Clear Cart')
    );
    if (confirmed) {
      clearCart();
    }
  };

  return (
    <div className="container-page max-w-4xl">
      <PageHeader
        title={t('shopping_cart')}
        actions={
          <Button
            variant="ghost"
            onClick={handleClearCart}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold"
          >
            {t('clear_all')}
          </Button>
        }
      />

      <div className="space-y-8">
        {Object.entries(groupedItems).map(([merchant, storeItems]) => {
          const storeSubtotal = storeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
          
          return (
            <div key={merchant} className="card overflow-hidden">
              <div className="p-4 bg-surface-muted dark:bg-[#111]/45 border-b border-surface-border dark:border-surface-dark-border flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={16} className="text-brand-600 dark:text-brand-400" />
                  <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">
                    {t('seller')}: <span className="text-brand-600 dark:text-brand-400 font-extrabold">@{merchant}</span>
                  </h3>
                </div>
              </div>
              
              <div className="p-4 space-y-4">
                {storeItems.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center gap-4 border-b border-surface-border dark:border-surface-dark-border pb-4 last:border-0 last:pb-0"
                  >
                    <Link to={`/product/${item.slug}`} className="shrink-0">
                      <SafeImage
                        src={item.image}
                        alt={item.name}
                        category={item.category}
                        className="w-16 h-16 object-cover rounded-btn border border-surface-border dark:border-surface-dark-border"
                      />
                    </Link>
 
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/product/${item.slug}`}
                        className="font-bold text-gray-900 dark:text-white truncate block hover:text-brand-600 dark:hover:text-brand-400 transition"
                      >
                        {item.name}
                      </Link>
                      <p className="text-brand-600 dark:text-brand-400 font-extrabold mt-1 text-sm">
                        TSh {item.price.toLocaleString()}
                      </p>
                      <p className="text-2xs font-bold text-gray-400 uppercase tracking-wide mt-0.5">
                        {item.stock} {t('in_stock')}
                      </p>
                    </div>
 
                    <div className="flex items-center gap-2 bg-surface-muted dark:bg-[#111] rounded-btn p-1 border border-surface-border dark:border-surface-dark-border">
                      <button
                        onClick={() => updateQuantity(item.productId, Math.max(0.01, item.quantity - 1))}
                        className="p-1 rounded-btn hover:bg-white dark:hover:bg-[#0A0A0A] transition shadow-sm text-gray-600 dark:text-gray-300"
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.productId, parseFloat(e.target.value) || 1)}
                        className="w-12 text-center font-bold text-gray-900 dark:text-white text-xs bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                      />
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="p-1 rounded-btn hover:bg-white dark:hover:bg-[#0A0A0A] transition shadow-sm text-gray-600 dark:text-gray-300"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
 
                    <p className="font-extrabold text-gray-900 dark:text-white w-28 text-right hidden sm:block text-sm">
                      TSh {(item.price * item.quantity).toLocaleString()}
                    </p>
 
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="p-2 text-red-400 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-btn transition shrink-0 ml-2"
                      title="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="bg-surface-muted dark:bg-[#111]/45 p-4 border-t border-surface-border dark:border-surface-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-2xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  <span>{storeItems.reduce((s, i) => s + i.quantity, 0)} {t('quantity')}</span>
                  <span className="hidden sm:inline px-1">•</span>
                  <span className="text-gray-900 dark:text-white font-extrabold text-xs">
                    {t('subtotal')}: TSh {storeSubtotal.toLocaleString()}
                  </span>
                </div>
                <Button
                  onClick={() => navigate(`/checkout?merchant=${encodeURIComponent(merchant)}`)}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {t('checkout')} {merchant} <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CartPage;
