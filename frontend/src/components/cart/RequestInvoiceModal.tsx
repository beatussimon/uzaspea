import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Info } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import SafeImage from '../SafeImage';
import api from '../../api';
import toast from 'react-hot-toast';

interface RequestInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  merchant: string;
  items: any[];
  onInvoiceCreated: (orderId: number) => void;
}

export const RequestInvoiceModal: React.FC<RequestInvoiceModalProps> = ({
  isOpen,
  onClose,
  merchant,
  items,
  onInvoiceCreated,
}) => {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');

  const hasQuoteItems = items.some(i => i.requires_quote);
  const pricedItemsTotal = items.reduce((sum, item) => {
    return item.requires_quote ? sum : sum + (Number(item.price) || 0) * (Number(item.quantity) || 1);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    setSubmitting(true);
    try {
      const payload = {
        items: items.map(i => {
          let pId = i.productId;
          let vId = null;
          if (typeof pId === 'string' && pId.includes('-')) {
            const parts = pId.split('-');
            pId = parseInt(parts[0], 10);
            vId = parseInt(parts[1], 10);
          }
          return {
            product_id: pId,
            variant_id: vId,
            quantity: i.quantity,
          };
        }),
        note: note.trim(),
        shipping_method: 'DELIVERY',
        fulfillment_type: 'PLATFORM_DELIVERY',
      };

      const res = await api.post('/api/orders/request-invoice/', payload);
      toast.success(t('invoice_request_sent', 'Invoice request submitted to seller!'));
      onInvoiceCreated(res.data.order_id);
      onClose();
    } catch (err: any) {
      console.error('Failed to request invoice:', err);
      toast.error(err.response?.data?.error || t('request_failed', 'Failed to request invoice.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('request_bulk_invoice', 'Request Bulk Invoice & Quote')}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Subtle Store Header */}
        <div className="flex items-center justify-between pb-3 border-b border-surface-border dark:border-surface-dark-border text-xs">
          <div>
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-400">
              {t('store', 'Store')}
            </span>
            <p className="font-bold text-gray-900 dark:text-white">
              @{merchant}
            </p>
          </div>
          <span className="text-2xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {items.reduce((s, i) => s + i.quantity, 0)} {t('items_total', 'total units')}
          </span>
        </div>

        {/* Clean Items List */}
        <div className="space-y-2">
          <label className="block text-2xs font-bold text-gray-500 uppercase tracking-widest">
            {t('order_items', 'Order Items')} ({items.length})
          </label>
          <div className="max-h-56 overflow-y-auto divide-y divide-surface-border dark:divide-surface-dark-border pr-1">
            {items.map((item) => (
              <div
                key={item.productId}
                className="py-2.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <SafeImage
                    src={item.image}
                    alt={item.name}
                    category={item.category}
                    className="w-10 h-10 object-cover rounded-btn border border-surface-border dark:border-surface-dark-border shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-gray-900 dark:text-white truncate">
                      {item.name}
                    </p>
                    <p className="text-2xs text-gray-400 mt-0.5">
                      Qty: {item.quantity}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    {item.requires_quote
                      ? t('price_on_request', 'Quote Req.')
                      : `TSh ${(item.price * item.quantity).toLocaleString()}`}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {hasQuoteItems && (
            <div className="flex items-center gap-2 pt-2 text-2xs text-gray-500 dark:text-gray-400">
              <Info size={14} className="shrink-0 text-brand-500" />
              <span>{t('quote_notice', 'Items marked Quote Req. will have final unit prices set by the seller.')}</span>
            </div>
          )}
        </div>

        {/* Note / Terms */}
        <div className="space-y-1.5">
          <label className="block text-2xs font-bold text-gray-500 uppercase tracking-widest">
            {t('buyer_note', 'Notes / Proposed Terms')} <span className="text-gray-400 lowercase font-normal">({t('optional', 'optional')})</span>
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t(
              'buyer_note_placeholder',
              'e.g. Requesting wholesale bulk rate, needed by Friday...'
            )}
            className="input text-xs resize-none"
          />
        </div>

        {/* Footer with properly aligned Total and action buttons */}
        <div className="pt-4 border-t border-surface-border dark:border-surface-dark-border flex items-center justify-between gap-4">
          <div className="text-left space-y-0.5">
            <span className="text-3xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold block">
              {t('estimated_total', 'Estimated Subtotal')}
            </span>
            <span className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white leading-tight block">
              TSh {pricedItemsTotal.toLocaleString()}
              {hasQuoteItems && <span className="text-2xs text-gray-400 font-normal ml-1">(+ Quotes)</span>}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={submitting}>
              {t('cancel', 'Cancel')}
            </Button>
            <Button type="submit" size="sm" loading={submitting} className="flex items-center gap-1.5 whitespace-nowrap font-bold">
              <Send size={14} className="shrink-0" />
              <span>{t('send_request', 'Send Request')}</span>
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default RequestInvoiceModal;
