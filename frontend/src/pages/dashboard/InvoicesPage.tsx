import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { FileText, Printer, Edit3, CheckCircle, Clock, MessageSquare, Sparkles, Search, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import PrintableInvoiceModal from '../../components/orders/PrintableInvoiceModal';
import toast from 'react-hot-toast';

type TabKey = 'all' | 'action_required' | 'sent' | 'done';

const InvoicesPage: React.FC = () => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [printOrder, setPrintOrder] = useState<any>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [sellerNote, setSellerNote] = useState('');
  const [shippingFee, setShippingFee] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      // Fetch active invoice statuses as well as bulk orders
      const [resQuotes, resBulk] = await Promise.all([
        api.get('/api/orders/incoming/?status=REQUESTED_INVOICE,BUYER_COUNTERED,INVOICE_GENERATED'),
        api.get('/api/orders/incoming/?is_bulk_order=true'),
      ]);
      
      const quotesData = resQuotes.data.results || resQuotes.data || [];
      const bulkData = resBulk.data.results || resBulk.data || [];
      
      // Merge unique orders by ID
      const orderMap = new Map<number, any>();
      [...quotesData, ...bulkData].forEach((o: any) => {
        orderMap.set(o.id, o);
      });
      
      const allOrders = Array.from(orderMap.values()).sort(
        (a, b) => new Date(b.order_date || b.created_at).getTime() - new Date(a.order_date || a.created_at).getTime()
      );
      setOrders(allOrders);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const openQuoteModal = (order: any) => {
    setSelectedOrder(order);
    const initialPrices: Record<string, string> = {};
    (order.items || order.relevant_items || []).forEach((item: any) => {
      const proposed = order.negotiation_data?.proposed_prices?.[String(item.id)];
      initialPrices[item.id] = proposed !== undefined ? String(proposed) : String(item.price || 0);
    });
    setPrices(initialPrices);
    setSellerNote(order.negotiation_data?.seller_final_note || order.negotiation_data?.seller_invoice_note || '');
    setShippingFee(order.shipping_fee ? String(order.shipping_fee) : '0');
  };

  const handleGenerateInvoice = async (acceptCounter = false) => {
    if (!selectedOrder) return;
    try {
      setIsGenerating(true);
      const payload: any = {
        accept_counter: acceptCounter,
        seller_note: sellerNote.trim(),
        shipping_fee: parseFloat(shippingFee) || 0,
      };

      if (!acceptCounter) {
        payload.prices = prices;
      }

      await api.post(`/api/orders/${selectedOrder.id}/generate-invoice/`, payload);
      toast.success(
        acceptCounter
          ? t('counter_accepted', "Buyer's counter-offer accepted!")
          : t('invoice_generated', 'Invoice generated and sent to customer!')
      );
      setSelectedOrder(null);
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('error_generating_invoice', 'Failed to generate invoice.'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Filter orders by tab and search
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Tab filter
      if (activeTab === 'action_required') {
        if (order.status !== 'REQUESTED_INVOICE' && order.status !== 'BUYER_COUNTERED') return false;
      } else if (activeTab === 'sent') {
        if (order.status !== 'INVOICE_GENERATED') return false;
      } else if (activeTab === 'done') {
        if (['REQUESTED_INVOICE', 'BUYER_COUNTERED', 'INVOICE_GENERATED', 'CANCELLED'].includes(order.status)) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idMatch = String(order.id).includes(q);
        const buyerMatch = (order.buyer || order.buyer_username || '').toLowerCase().includes(q);
        const itemsMatch = (order.items || order.relevant_items || []).some((i: any) =>
          (i.product_name || '').toLowerCase().includes(q)
        );
        if (!idMatch && !buyerMatch && !itemsMatch) return false;
      }

      return true;
    });
  }, [orders, activeTab, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: orders.length,
      action_required: orders.filter(o => o.status === 'REQUESTED_INVOICE' || o.status === 'BUYER_COUNTERED').length,
      sent: orders.filter(o => o.status === 'INVOICE_GENERATED').length,
      done: orders.filter(o => !['REQUESTED_INVOICE', 'BUYER_COUNTERED', 'INVOICE_GENERATED', 'CANCELLED'].includes(o.status)).length,
    };
  }, [orders]);

  if (loading) {
    return <div className="flex justify-center p-12"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('invoices', 'Invoices & Bulk Orders')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {t('invoices_desc', 'Manage customer requests for quotes, counter-offers, and invoice records.')}
          </p>
        </div>
      </header>

      {/* Filter Pills & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
            }`}
          >
            {t('all', 'All')}
            <span className={`px-1.5 py-0.5 rounded-full text-3xs font-black ${
              activeTab === 'all' ? 'bg-white/20 dark:bg-black/20 text-inherit' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}>
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('action_required')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'action_required'
                ? 'bg-brand-500 text-white shadow-xs'
                : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
            }`}
          >
            {t('action_required', 'Action Required')}
            {counts.action_required > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-3xs font-black ${
                activeTab === 'action_required' ? 'bg-white text-brand-600' : 'bg-brand-500 text-white'
              }`}>
                {counts.action_required}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sent')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'sent'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
            }`}
          >
            {t('awaiting_buyer', 'Awaiting Buyer')}
            <span className={`px-1.5 py-0.5 rounded-full text-3xs font-black ${
              activeTab === 'sent' ? 'bg-white/20 dark:bg-black/20 text-inherit' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}>
              {counts.sent}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('done')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'done'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
            }`}
          >
            {t('done_accepted', 'Done / Accepted')}
            <span className={`px-1.5 py-0.5 rounded-full text-3xs font-black ${
              activeTab === 'done' ? 'bg-white/20 dark:bg-black/20 text-inherit' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}>
              {counts.done}
            </span>
          </button>
        </div>

        {/* Search Box */}
        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search_invoices', 'Search Order #, Buyer, item...')}
            className="input pl-8 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('no_invoices', 'No Invoices Found')}
          description={t('no_invoices_matching', 'No invoices found matching your selected filters.')}
        />
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => {
            const itemsList = order.items || order.relevant_items || [];
            const negData = order.negotiation_data || {};
            const isExpanded = expandedId === order.id;

            return (
              <div
                key={order.id}
                className="card overflow-hidden transition-all duration-200"
              >
                {/* Collapsible Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="p-4 cursor-pointer hover:bg-surface-muted/40 dark:hover:bg-[#161616]/40 transition flex flex-col md:flex-row gap-4 justify-between items-start md:items-center select-none"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-gray-900 dark:text-white">Order #{order.id}</span>
                      <span className="text-2xs text-gray-400">@{order.buyer || order.buyer_username || 'Customer'}</span>
                      
                      {/* Standard Status Badge */}
                      <StatusBadge status={order.status} size="sm" />

                      {order.is_bulk_order && (
                        <span className="px-2 py-0.5 rounded-pill text-[10px] font-bold uppercase tracking-tight bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {t('bulk_order', 'Bulk Order')}
                        </span>
                      )}

                      <span className="text-2xs font-extrabold text-gray-900 dark:text-white ml-auto md:ml-0">
                        Total: TSh {Number(order.total_amount || order.seller_subtotal || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-2xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {new Date(order.order_date || order.created_at).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Package size={12} /> {itemsList.length} {t('items', 'items')}
                      </span>
                    </div>
                  </div>

                  {/* Actions & Chevron */}
                  <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                    {/* Action: Set initial prices */}
                    {order.status === 'REQUESTED_INVOICE' && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          openQuoteModal(order);
                        }}
                        size="sm"
                        className="flex items-center gap-1.5 font-bold"
                      >
                        <Edit3 size={14} />
                        {t('set_prices', 'Set Prices')}
                      </Button>
                    )}

                    {/* Action: Respond to counter */}
                    {order.status === 'BUYER_COUNTERED' && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          openQuoteModal(order);
                        }}
                        size="sm"
                        className="flex items-center gap-1.5 font-bold"
                      >
                        <MessageSquare size={14} />
                        {t('respond_counter', 'Respond to Counter')}
                      </Button>
                    )}

                    {/* Print Invoice Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPrintOrder(order);
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <Printer size={13} />
                      <span className="hidden sm:inline">{t('print', 'Print')}</span>
                    </Button>

                    <div className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Collapsible Body */}
                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-surface-border dark:border-surface-dark-border space-y-3 text-xs bg-surface-muted/20 dark:bg-[#131313]/30">
                    {/* Buyer Notes */}
                    {negData.buyer_request_note && (
                      <div className="p-2.5 rounded-btn bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border text-gray-600 dark:text-gray-400 italic">
                        <strong className="not-italic text-gray-900 dark:text-white">Buyer Request: </strong>
                        "{negData.buyer_request_note}"
                      </div>
                    )}

                    {/* Counter Offer Highlight */}
                    {order.status === 'BUYER_COUNTERED' && negData.counter_note && (
                      <div className="p-2.5 rounded-btn bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 italic">
                        <strong className="not-italic font-bold">Buyer Counter-Offer Note: </strong>
                        "{negData.counter_note}"
                      </div>
                    )}

                    {/* Items List Table */}
                    <div className="border border-surface-border dark:border-surface-dark-border rounded-btn overflow-hidden mt-2">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-muted dark:bg-[#161616] text-2xs uppercase tracking-wider text-gray-400 font-bold border-b border-surface-border dark:border-surface-dark-border">
                          <tr>
                            <th className="p-2.5">Item Description</th>
                            <th className="p-2.5 text-center">Qty</th>
                            <th className="p-2.5 text-right">Unit Price</th>
                            <th className="p-2.5 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
                          {itemsList.map((item: any) => {
                            const hasDiscount = item.catalog_price && Number(item.catalog_price) > Number(item.price);
                            return (
                              <tr key={item.id} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30">
                                <td className="p-2.5 font-medium text-gray-900 dark:text-white">
                                  {item.product_name} {item.variant_name ? `(${item.variant_name})` : ''}
                                </td>
                                <td className="p-2.5 text-center text-gray-500">{item.quantity}</td>
                                <td className="p-2.5 text-right font-medium text-gray-700 dark:text-gray-300">
                                  {hasDiscount && (
                                    <span className="line-through text-gray-400 text-3xs mr-1">
                                      TSh {Number(item.catalog_price).toLocaleString()}
                                    </span>
                                  )}
                                  <span className={hasDiscount ? 'font-bold text-brand-500' : ''}>
                                    {Number(item.price) > 0 ? `TSh ${Number(item.price).toLocaleString()}` : 'Quote Req.'}
                                  </span>
                                </td>
                                <td className="p-2.5 text-right font-bold text-gray-900 dark:text-white">
                                  TSh {Number(item.subtotal || (Number(item.price) * Number(item.quantity)) || 0).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer Actions inside Expanded View */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="text-2xs text-gray-400">
                        {order.shipping_fee > 0 && `Shipping Fee: TSh ${Number(order.shipping_fee).toLocaleString()} • `}
                        Grand Total: <strong className="text-gray-900 dark:text-white text-xs">TSh {Number(order.total_amount || order.seller_subtotal || 0).toLocaleString()}</strong>
                      </div>

                      {order.status === 'INVOICE_GENERATED' && (
                        <Button variant="outline" size="sm" onClick={() => openQuoteModal(order)} className="flex items-center gap-1.5">
                          <Edit3 size={13} />
                          {t('adjust_invoice', 'Adjust Invoice Prices')}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quote / Invoice Generation Modal */}
      {selectedOrder && (
        <Modal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={
            selectedOrder.status === 'BUYER_COUNTERED'
              ? `${t('respond_to_counter', 'Respond to Counter-Offer')} — #${selectedOrder.id}`
              : `${t('generate_invoice', 'Generate Bulk Invoice')} — #${selectedOrder.id}`
          }
          size="md"
        >
          <div className="space-y-4">
            {/* Buyer Counter Offer Callout */}
            {selectedOrder.status === 'BUYER_COUNTERED' && (
              <div className="p-3 rounded-btn bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 dark:text-white">
                    {t('buyer_proposed_terms', "Customer's Offer")}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleGenerateInvoice(true)}
                    loading={isGenerating}
                    className="flex items-center gap-1 text-xs font-bold"
                  >
                    <Sparkles size={13} />
                    {t('accept_buyer_prices', "Accept Offer (1-Click)")}
                  </Button>
                </div>
                {selectedOrder.negotiation_data?.counter_note && (
                  <p className="text-gray-500 dark:text-gray-400 italic text-2xs">
                    "{selectedOrder.negotiation_data.counter_note}"
                  </p>
                )}
              </div>
            )}

            <p className="text-2xs text-gray-500">
              {selectedOrder.status === 'BUYER_COUNTERED'
                ? t('enter_final_prices_desc', 'Set final unit prices below for the customer.')
                : t('enter_prices_desc', 'Enter the agreed unit prices for the requested items.')}
            </p>
            
            {/* Item Price Inputs */}
            <div className="space-y-2 max-h-56 overflow-y-auto divide-y divide-surface-border dark:divide-surface-dark-border pr-1">
              {((selectedOrder.items || selectedOrder.relevant_items) || []).map((item: any) => {
                const buyerProposed = selectedOrder.negotiation_data?.proposed_prices?.[String(item.id)];
                return (
                  <div
                    key={item.id}
                    className="py-2 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {item.product_name} {item.variant_name ? `(${item.variant_name})` : ''}
                      </p>
                      <p className="text-2xs text-gray-400">
                        Qty: {item.quantity}
                        {buyerProposed !== undefined && ` • Buyer Offer: TSh ${Number(buyerProposed).toLocaleString()}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-2xs font-bold text-gray-400">TSh</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={prices[item.id] || ''}
                        onChange={(e) => setPrices({ ...prices, [item.id]: e.target.value })}
                        placeholder="0.00"
                        className="w-24 p-1 text-xs font-bold border border-surface-border dark:border-surface-dark-border rounded-btn bg-white dark:bg-[#111] text-gray-900 dark:text-white focus:ring-1 focus:ring-brand-500 outline-none text-right"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Seller Note */}
            <div className="space-y-1">
              <label className="block text-2xs font-bold text-gray-500 uppercase tracking-widest">
                {selectedOrder.status === 'BUYER_COUNTERED'
                  ? t('seller_final_note_label', 'Final Response Note')
                  : t('seller_note_label', 'Invoice Note / Terms')}
              </label>
              <textarea
                rows={2}
                value={sellerNote}
                onChange={(e) => setSellerNote(e.target.value)}
                placeholder={t('seller_note_placeholder', 'Add optional payment or terms note...')}
                className="input text-xs resize-none"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-surface-border dark:border-surface-dark-border">
              <div>
                <span className="text-3xs uppercase tracking-wider text-gray-400 font-bold block">
                  {t('new_invoice_total', 'Total Items Value')}
                </span>
                <span className="text-sm font-black text-gray-900 dark:text-white">
                  TSh{' '}
                  {(((selectedOrder.items || selectedOrder.relevant_items) || []).reduce(
                    (sum: number, item: any) => sum + (parseFloat(prices[item.id]) || 0) * (Number(item.quantity) || 1),
                    0
                  )).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)} disabled={isGenerating}>
                  {t('cancel', 'Cancel')}
                </Button>
                <Button size="sm" onClick={() => handleGenerateInvoice(false)} loading={isGenerating} className="flex items-center gap-1.5 font-bold">
                  <CheckCircle size={14} />
                  {selectedOrder.status === 'BUYER_COUNTERED' ? t('send_final_invoice', 'Send Final Invoice') : t('send_invoice', 'Send Invoice')}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Standardized Printable Invoice Modal */}
      {printOrder && (
        <PrintableInvoiceModal
          order={printOrder}
          onClose={() => setPrintOrder(null)}
        />
      )}
    </div>
  );
};

export default InvoicesPage;
