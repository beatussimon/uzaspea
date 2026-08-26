import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight, MessageSquare, FileText, Clock } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useMessages } from '../context/MessageContext';
import SafeImage from '../components/SafeImage';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../components/ui/Dialogs';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import RequestInvoiceModal from '../components/cart/RequestInvoiceModal';
import InvoiceReviewModal from '../components/cart/InvoiceReviewModal';
import api from '../api';
import toast from 'react-hot-toast';

const CartPage: React.FC = () => {
  const { t } = useTranslation();
  const { showConfirm } = useDialog();
  const { items, updateQuantity, removeFromCart, clearCart } = useCart();
  const { startOrderInquiryChat } = useMessages();
  const navigate = useNavigate();

  // Invoicing Mode per Merchant: toggles between standard checkout and bulk invoicing mode
  const [invoicingModes, setInvoicingModes] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('sokonimax_cart_bulk_modes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [activeInvoices, setActiveInvoices] = useState<Record<string, any>>({});
  const [requestInvoiceMerchant, setRequestInvoiceMerchant] = useState<string | null>(null);
  const [reviewInvoiceOrder, setReviewInvoiceOrder] = useState<any | null>(null);
  const [messagingMerchant, setMessagingMerchant] = useState<string | null>(null);

  // Group items by merchant
  const groupedItems = items.reduce((acc, item) => {
    const merchant = item.seller_username || 'Unknown Store';
    if (!acc[merchant]) acc[merchant] = [];
    acc[merchant].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  // Auto-enable invoicing mode if merchant has items requiring quote or has active invoice
  useEffect(() => {
    setInvoicingModes(prev => {
      let changed = false;
      const updated = { ...prev };
      Object.entries(groupedItems).forEach(([merchant, storeItems]) => {
        if (updated[merchant] === undefined) {
          if (storeItems.some(i => i.requires_quote) || activeInvoices[merchant]) {
            updated[merchant] = true;
            changed = true;
          }
        }
      });
      if (changed) {
        try {
          localStorage.setItem('sokonimax_cart_bulk_modes', JSON.stringify(updated));
        } catch {}
        return updated;
      }
      return prev;
    });
  }, [items, activeInvoices]);

  // Fetch any active pending invoices for the user
  const fetchActiveInvoices = useCallback(async () => {
    try {
      const [res1, res2, res3] = await Promise.all([
        api.get('/api/orders/?status=REQUESTED_INVOICE'),
        api.get('/api/orders/?status=INVOICE_GENERATED'),
        api.get('/api/orders/?status=BUYER_COUNTERED'),
      ]);
      const allActive = [
        ...(res1.data.results || res1.data || []),
        ...(res2.data.results || res2.data || []),
        ...(res3.data.results || res3.data || []),
      ];
      
      const invoicesMap: Record<string, any> = {};
      allActive.forEach((order: any) => {
        const seller = order.items?.[0]?.seller_username;
        if (seller && !invoicesMap[seller]) {
          invoicesMap[seller] = order;
        }
      });
      setActiveInvoices(invoicesMap);
    } catch (err) {
      console.warn('Failed to load active invoices', err);
    }
  }, []);

  useEffect(() => {
    fetchActiveInvoices();
  }, [fetchActiveInvoices]);

  const toggleInvoicingMode = (merchant: string) => {
    setInvoicingModes(prev => {
      const nextVal = !prev[merchant];
      const updated = { ...prev, [merchant]: nextVal };
      try {
        localStorage.setItem('sokonimax_cart_bulk_modes', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleMessageSeller = async (merchant: string, storeItems: typeof items) => {
    try {
      setMessagingMerchant(merchant);
      const itemsSummary = storeItems
        .map(i => `${i.quantity}x ${i.name}`)
        .slice(0, 4)
        .join(', ');
      const activeOrder = activeInvoices[merchant];
      const prefillMsg = activeOrder
        ? `Hello @${merchant}, inquiring about Invoice #${activeOrder.id} (${itemsSummary}).`
        : `Hello @${merchant}, inquiring about bulk order for ${itemsSummary}.`;

      const sellerId = storeItems[0]?.seller_id;
      await startOrderInquiryChat(merchant, prefillMsg, sellerId);
    } catch (e) {
      toast.error('Failed to open chat with seller.');
    } finally {
      setMessagingMerchant(null);
    }
  };

  const handleClearCart = async () => {
    const confirmed = await showConfirm(
      t('clear_cart_confirm', 'Remove all items from your cart?'),
      t('clear_cart_title', 'Clear Cart')
    );
    if (confirmed) {
      clearCart();
    }
  };

  if (items.length === 0) {
    return (
      <div className="container-page max-w-4xl py-12">
        <EmptyState
          icon={ShoppingBag}
          title={t('empty_cart')}
          description={t('empty_cart_subtitle', 'Add some products to get started!')}
          action={{
            label: t('browse_products'),
            onClick: () => navigate('/products'),
          }}
        />
      </div>
    );
  }

  return (
    <div className="container-page max-w-4xl">
      <PageHeader
        title={t('shopping_cart')}
        actions={
          <Button
            variant="ghost"
            onClick={handleClearCart}
            className="text-red-500 hover:text-red-500 font-bold"
          >
            {t('clear_all')}
          </Button>
        }
      />

      <div className="space-y-8">
        {Object.entries(groupedItems).map(([merchant, storeItems]) => {
          const storeSubtotal = storeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
          const isBulkMode = !!invoicingModes[merchant];
          const activeInvoice = activeInvoices[merchant];
          const hasQuoteItem = storeItems.some(i => i.requires_quote);

          return (
            <div key={merchant} className="card overflow-hidden border border-surface-border dark:border-surface-dark-border">
              {/* Header with Merchant Info and Bulk Mode Toggle */}
              <div className="p-4 bg-surface-muted dark:bg-[#111]/60 border-b border-surface-border dark:border-surface-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={16} className="text-brand-500 dark:text-brand-500 shrink-0" />
                  <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">
                    {t('seller')}: <span className="text-brand-500 dark:text-brand-500 font-extrabold">@{merchant}</span>
                  </h3>
                  {isBulkMode && (
                    <span className="px-2 py-0.5 rounded text-3xs font-bold uppercase tracking-wider bg-surface-muted dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300">
                      {t('bulk_mode_badge', 'Bulk Mode')}
                    </span>
                  )}
                </div>

                {/* Bulk Order / Invoicing Toggle Switch */}
                <div className="flex items-center gap-2.5">
                  <span className="text-2xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('bulk_negotiate_toggle', 'Bulk / Invoicing')}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isBulkMode}
                    onClick={() => toggleInvoicingMode(merchant)}
                    className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full transition-colors duration-150 ease-in-out focus:outline-none ${
                      isBulkMode ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition duration-150 ease-in-out my-0.5 ml-0.5 ${
                        isBulkMode ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Items List */}
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
                        className="font-bold text-gray-900 dark:text-white truncate block hover:text-brand-500 dark:hover:text-brand-500 transition text-sm"
                      >
                        {item.name}
                      </Link>
                      <p className="text-brand-500 dark:text-brand-500 font-extrabold mt-1 text-sm">
                        {item.requires_quote ? t('price_on_request', 'Price on Request') : `TSh ${item.price.toLocaleString()}`}
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
                      {item.requires_quote ? '--' : `TSh ${(item.price * item.quantity).toLocaleString()}`}
                    </p>

                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="p-2 text-red-500 hover:text-red-500 rounded-btn transition shrink-0 ml-2"
                      title="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Bottom Footer Actions */}
              <div className="bg-surface-muted dark:bg-[#111]/45 p-4 border-t border-surface-border dark:border-surface-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {isBulkMode && activeInvoice ? (
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Clock size={16} className="text-brand-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white text-xs truncate">
                        {activeInvoice.status === 'REQUESTED_INVOICE' && t('invoice_requested_pending', 'Invoice Requested — Awaiting Seller Quote')}
                        {activeInvoice.status === 'INVOICE_GENERATED' && t('invoice_ready_review', 'Invoice Ready for Review')}
                        {activeInvoice.status === 'BUYER_COUNTERED' && t('counter_offer_review', 'Counter-Offer Awaiting Seller Response')}
                      </p>
                      <p className="text-3xs text-gray-400 mt-0.5">
                        Order #{activeInvoice.id} • {new Date(activeInvoice.order_date || activeInvoice.created_at).toLocaleDateString()}
                        {activeInvoice.total_amount > 0 && ` • TSh ${Number(activeInvoice.total_amount).toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-2xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    <span>{storeItems.reduce((s, i) => s + i.quantity, 0)} {t('quantity')}</span>
                    <span className="hidden sm:inline px-1">•</span>
                    <span className="text-gray-900 dark:text-white font-extrabold text-xs">
                      {t('subtotal')}: TSh {storeSubtotal.toLocaleString()}{' '}
                      {hasQuoteItem && <span className="text-gray-400 font-normal">(+ Quotes)</span>}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 shrink-0">
                  {/* When Invoicing Mode is ON */}
                  {isBulkMode ? (
                    <>
                      {/* Message Seller Icon Button */}
                      <button
                        type="button"
                        onClick={() => handleMessageSeller(merchant, storeItems)}
                        disabled={messagingMerchant === merchant}
                        title={t('message_seller_about_order', 'Message Seller About This Order')}
                        className="p-2 rounded-btn border border-surface-border dark:border-surface-dark-border bg-white dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-brand-500 transition flex items-center justify-center"
                      >
                        <MessageSquare size={15} />
                      </button>

                      {/* Request Invoice Button or Review Button */}
                      {activeInvoice ? (
                        <Button
                          onClick={() => setReviewInvoiceOrder(activeInvoice)}
                          size="sm"
                          className="flex items-center gap-2 font-bold"
                        >
                          <FileText size={14} />
                          {activeInvoice.status === 'INVOICE_GENERATED' ? t('review_invoice', 'Review Invoice') : t('view_invoice', 'View Invoice')}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => setRequestInvoiceMerchant(merchant)}
                          size="sm"
                          className="flex items-center gap-1.5 font-bold"
                        >
                          <FileText size={14} />
                          {t('request_invoice_btn', 'Request Invoice')}
                        </Button>
                      )}
                    </>
                  ) : (
                    /* Standard Checkout Flow */
                    <Button
                      onClick={() => navigate(`/checkout?merchant=${encodeURIComponent(merchant)}`)}
                      size="sm"
                      className="flex items-center gap-2 font-bold"
                    >
                      {t('checkout')} @{merchant} <ArrowRight size={14} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Request Bulk Invoice Modal */}
      {requestInvoiceMerchant && (
        <RequestInvoiceModal
          isOpen={!!requestInvoiceMerchant}
          onClose={() => setRequestInvoiceMerchant(null)}
          merchant={requestInvoiceMerchant}
          items={groupedItems[requestInvoiceMerchant] || []}
          onInvoiceCreated={() => {
            fetchActiveInvoices();
          }}
        />
      )}

      {/* Review Invoice Modal */}
      {reviewInvoiceOrder && (
        <InvoiceReviewModal
          isOpen={!!reviewInvoiceOrder}
          onClose={() => setReviewInvoiceOrder(null)}
          order={reviewInvoiceOrder}
          onOrderUpdated={() => {
            fetchActiveInvoices();
          }}
        />
      )}
    </div>
  );
};

export default CartPage;
