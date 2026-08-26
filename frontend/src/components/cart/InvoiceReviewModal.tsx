import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, MessageSquare, ArrowRight, Clock, Printer } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import PrintableInvoiceModal from '../orders/PrintableInvoiceModal';
import api from '../../api';
import toast from 'react-hot-toast';

interface InvoiceReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onOrderUpdated?: () => void;
}

export const InvoiceReviewModal: React.FC<InvoiceReviewModalProps> = ({
  isOpen,
  onClose,
  order: initialOrder,
  onOrderUpdated,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [order, setOrder] = useState<any>(initialOrder);
  const [isCounterMode, setIsCounterMode] = useState(false);
  const [proposedPrices, setProposedPrices] = useState<Record<string, string>>({});
  const [counterNote, setCounterNote] = useState('');
  const [submittingCounter, setSubmittingCounter] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    setOrder(initialOrder);
    if (initialOrder?.items) {
      const initPrices: Record<string, string> = {};
      initialOrder.items.forEach((item: any) => {
        initPrices[item.id] = String(item.price || 0);
      });
      setProposedPrices(initPrices);
    }
  }, [initialOrder]);

  if (!order) return null;

  const negData = order.negotiation_data || {};
  const isResolved = negData.resolved || (negData.counter_count >= 1 && order.status === 'INVOICE_GENERATED');
  const isCountered = order.status === 'BUYER_COUNTERED';
  const isPendingQuote = order.status === 'REQUESTED_INVOICE';
  const isInvoiceReady = order.status === 'INVOICE_GENERATED';
  const sellerUsername = order.seller_username || order.items?.[0]?.seller_username || 'Seller';

  const handleAcceptAndCheckout = async () => {
    try {
      setAccepting(true);
      if (order.status === 'INVOICE_GENERATED') {
        try {
          await api.post(`/api/orders/${order.id}/confirm-invoice/`);
        } catch {
          // May already be confirmed
        }
      }
      onClose();
      navigate(`/checkout?merchant=${encodeURIComponent(sellerUsername)}&order_id=${order.id}`);
    } catch (err) {
      console.error('Failed to accept invoice:', err);
      toast.error(t('failed_accept_invoice', 'Failed to proceed to checkout.'));
    } finally {
      setAccepting(false);
    }
  };

  const handleSendCounterOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingCounter(true);
    try {
      const cleanPrices: Record<string, number> = {};
      Object.entries(proposedPrices).forEach(([k, v]) => {
        const num = parseFloat(v);
        if (!isNaN(num) && num >= 0) {
          cleanPrices[k] = num;
        }
      });

      if (Object.keys(cleanPrices).length === 0) {
        toast.error(t('specify_price', 'Please enter at least one valid price.'));
        setSubmittingCounter(false);
        return;
      }

      const res = await api.post(`/api/orders/${order.id}/counter-invoice/`, {
        proposed_prices: cleanPrices,
        note: counterNote.trim(),
      });

      toast.success(t('counter_offer_submitted', 'Counter-offer sent to seller!'));
      setOrder((prev: any) => ({
        ...prev,
        status: res.data.status || 'BUYER_COUNTERED',
        negotiation_data: res.data.negotiation_data,
      }));
      setIsCounterMode(false);
      if (onOrderUpdated) onOrderUpdated();
    } catch (err: any) {
      console.error('Failed to send counter offer:', err);
      toast.error(err.response?.data?.error || t('failed_counter', 'Failed to submit counter-offer.'));
    } finally {
      setSubmittingCounter(false);
    }
  };

  const counterTotal = order.items?.reduce((sum: number, item: any) => {
    const p = parseFloat(proposedPrices[item.id]) || 0;
    return sum + p * (Number(item.quantity) || 1);
  }, 0) || 0;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`${t('invoice_review', 'Invoice Review')} — #${order.id}`}
        size="lg"
      >
        <div className="space-y-5">
          {/* Subtle Header Summary */}
          <div className="flex items-center justify-between pb-3 border-b border-surface-border dark:border-surface-dark-border text-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 dark:text-white">
                  @{sellerUsername}
                </span>
                <span className="text-2xs text-gray-400">
                  • {new Date(order.order_date || order.created_at || Date.now()).toLocaleDateString()}
                </span>
              </div>
              <p className="text-2xs text-gray-400 mt-0.5">
                {order.items?.length || 0} {t('items', 'items')}
              </p>
            </div>

            <div className="text-right">
              <span className="text-3xs uppercase tracking-wider text-gray-400 font-bold block">
                {t('total_amount', 'Total')}
              </span>
              <span className="text-base font-black text-gray-900 dark:text-white">
                TSh {Number(order.total_amount || 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Clean Notes & History */}
          {(negData.buyer_request_note || negData.seller_invoice_note || negData.counter_note || negData.seller_final_note) && (
            <div className="space-y-2 text-xs">
              <label className="block text-2xs font-bold text-gray-500 uppercase tracking-widest">
                {t('negotiation_history', 'Notes & Terms')}
              </label>
              <div className="space-y-1.5 text-xs">
                {negData.buyer_request_note && (
                  <div className="p-2.5 rounded-btn bg-surface-muted dark:bg-[#141414] border border-surface-border dark:border-surface-dark-border">
                    <span className="font-bold text-gray-700 dark:text-gray-300">Your Request: </span>
                    <span className="text-gray-500 dark:text-gray-400 italic">"{negData.buyer_request_note}"</span>
                  </div>
                )}
                {negData.seller_invoice_note && (
                  <div className="p-2.5 rounded-btn bg-surface-muted dark:bg-[#141414] border border-surface-border dark:border-surface-dark-border">
                    <span className="font-bold text-gray-700 dark:text-gray-300">Seller Note: </span>
                    <span className="text-gray-500 dark:text-gray-400 italic">"{negData.seller_invoice_note}"</span>
                  </div>
                )}
                {negData.counter_note && (
                  <div className="p-2.5 rounded-btn bg-surface-muted dark:bg-[#141414] border border-surface-border dark:border-surface-dark-border">
                    <span className="font-bold text-gray-700 dark:text-gray-300">Counter-Offer Note: </span>
                    <span className="text-gray-500 dark:text-gray-400 italic">"{negData.counter_note}"</span>
                  </div>
                )}
                {negData.seller_final_note && (
                  <div className="p-2.5 rounded-btn bg-surface-muted dark:bg-[#141414] border border-surface-border dark:border-surface-dark-border">
                    <span className="font-bold text-gray-700 dark:text-gray-300">Seller Final Response: </span>
                    <span className="text-gray-500 dark:text-gray-400 italic">"{negData.seller_final_note}"</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Counter Mode Form */}
          {isCounterMode ? (
            <form onSubmit={handleSendCounterOffer} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-2xs font-bold text-gray-500 uppercase tracking-widest">
                  {t('counter_instructions_title', 'Propose Your Desired Prices (1 Round)')}
                </label>
                <p className="text-2xs text-gray-400">
                  {t('counter_instructions', 'Adjust your desired unit prices below. The seller will review and set the final invoice.')}
                </p>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto divide-y divide-surface-border dark:divide-surface-dark-border pr-1">
                {(order.items || []).map((item: any) => (
                  <div
                    key={item.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {item.product_name} {item.variant_name ? `(${item.variant_name})` : ''}
                      </p>
                      <p className="text-2xs text-gray-400">
                        Qty: {item.quantity} • Seller: TSh {Number(item.price || 0).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-2xs font-bold text-gray-400">TSh</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={proposedPrices[item.id] || ''}
                        onChange={(e) => setProposedPrices({ ...proposedPrices, [item.id]: e.target.value })}
                        className="w-24 p-1 text-xs font-bold border border-surface-border dark:border-surface-dark-border rounded-btn bg-white dark:bg-[#111] text-gray-900 dark:text-white focus:ring-1 focus:ring-brand-500 outline-none text-right"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <label className="block text-2xs font-bold text-gray-500 uppercase tracking-widest">
                  {t('counter_note', 'Counter-Offer Note')}
                </label>
                <textarea
                  rows={2}
                  value={counterNote}
                  onChange={(e) => setCounterNote(e.target.value)}
                  placeholder={t('counter_note_placeholder', 'Explain reason for counter-offer (optional)...')}
                  className="input text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-surface-border dark:border-surface-dark-border">
                <div>
                  <span className="text-3xs uppercase tracking-wider text-gray-400 font-bold block">Proposed Total</span>
                  <span className="text-sm font-black text-gray-900 dark:text-white">
                    TSh {counterTotal.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" type="button" onClick={() => setIsCounterMode(false)}>
                    {t('cancel', 'Cancel')}
                  </Button>
                  <Button type="submit" loading={submittingCounter}>
                    {t('send_counter_offer', 'Send Counter-Offer')}
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            /* Normal Clean Invoice Review View */
            <div className="space-y-4">
              {/* Table of Items with Strikethrough for modified prices */}
              <div className="border border-surface-border dark:border-surface-dark-border rounded-btn overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted dark:bg-[#141414] border-b border-surface-border dark:border-surface-dark-border text-2xs uppercase tracking-wider text-gray-400 font-bold">
                    <tr>
                      <th className="p-2.5">{t('item', 'Item')}</th>
                      <th className="p-2.5 text-center">{t('quantity', 'Qty')}</th>
                      <th className="p-2.5 text-right">{t('unit_price', 'Unit Price')}</th>
                      <th className="p-2.5 text-right">{t('subtotal', 'Subtotal')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
                    {(order.items || []).map((item: any) => {
                      const unitPrice = Number(item.price || 0);
                      const catPrice = item.catalog_price ? Number(item.catalog_price) : null;
                      const hasPriceChange = catPrice !== null && catPrice > unitPrice && unitPrice > 0;

                      return (
                        <tr key={item.id} className="hover:bg-surface-muted/30 dark:hover:bg-[#141414]/30">
                          <td className="p-2.5 font-medium text-gray-900 dark:text-white">
                            {item.product_name} {item.variant_name ? `(${item.variant_name})` : ''}
                          </td>
                          <td className="p-2.5 text-center text-gray-500">
                            {item.quantity}
                          </td>
                          <td className="p-2.5 text-right font-medium text-gray-700 dark:text-gray-300">
                            {hasPriceChange && (
                              <span className="line-through text-gray-400 text-2xs mr-1">
                                TSh {catPrice?.toLocaleString()}
                              </span>
                            )}
                            <span className={hasPriceChange ? 'font-bold text-brand-500' : ''}>
                              {unitPrice > 0 ? `TSh ${unitPrice.toLocaleString()}` : t('price_on_request', 'Quote Req.')}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-bold text-gray-900 dark:text-white">
                            TSh {Number(item.subtotal || (unitPrice * item.quantity) || 0).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Status Notices based on exact response state */}
              {isPendingQuote && (
                <div className="p-2.5 rounded-btn bg-surface-muted dark:bg-[#141414] border border-surface-border dark:border-surface-dark-border text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <Clock size={15} className="shrink-0 text-gray-400" />
                  <span>{t('awaiting_seller_quote_desc', 'Your quote request has been sent. The seller has not entered prices yet. You will be notified once the invoice is generated.')}</span>
                </div>
              )}

              {isCountered && (
                <div className="p-2.5 rounded-btn bg-surface-muted dark:bg-[#141414] border border-surface-border dark:border-surface-dark-border text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <Clock size={15} className="shrink-0 text-gray-400" />
                  <span>{t('counter_pending_desc', 'Your counter-offer has been submitted. Awaiting the seller’s final invoice response.')}</span>
                </div>
              )}

              {isResolved && (
                <div className="p-2.5 rounded-btn bg-surface-muted dark:bg-[#141414] border border-surface-border dark:border-surface-dark-border text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0 text-brand-500" />
                  <span>{t('final_invoice_desc', 'Final agreed prices ready. You can proceed to checkout with these prices or leave as pending.')}</span>
                </div>
              )}

              {/* Action Buttons: strictly matching responsiveness of seller */}
              <div className="pt-3 border-t border-surface-border dark:border-surface-dark-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={onClose} className="whitespace-nowrap">
                    {isResolved ? t('keep_as_pending', 'Keep as Pending') : t('close', 'Close')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPrintModal(true)}
                    className="flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Printer size={14} className="shrink-0" />
                    <span>{t('print_invoice', 'Print Invoice')}</span>
                  </Button>
                </div>

                <div className="flex items-center gap-2 justify-end">
                  {/* Customer can ONLY negotiate if seller has generated prices, not yet countered, and not resolved */}
                  {isInvoiceReady && !isResolved && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCounterMode(true)}
                      className="flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <MessageSquare size={14} className="shrink-0" />
                      <span>{t('negotiate_price', 'Negotiate Price')}</span>
                    </Button>
                  )}

                  {/* Customer can ONLY accept/checkout if seller has generated prices (Round 1 or Final round) */}
                  {isInvoiceReady && (
                    <Button
                      size="sm"
                      onClick={handleAcceptAndCheckout}
                      loading={accepting}
                      className="flex items-center gap-1.5 whitespace-nowrap font-bold"
                    >
                      <CheckCircle2 size={15} className="shrink-0" />
                      <span>{isResolved ? t('proceed_to_checkout', 'Proceed to Checkout') : t('accept_and_checkout', 'Accept & Checkout')}</span>
                      <ArrowRight size={14} className="shrink-0" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Standardized Commercial Printable Invoice Modal */}
      {showPrintModal && (
        <PrintableInvoiceModal
          order={order}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </>
  );
};

export default InvoiceReviewModal;
