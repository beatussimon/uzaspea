import React, { useRef, useState } from 'react';
import { X, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { printElement } from '../../utils/printHelper';

interface PrintableInvoiceModalProps {
  order: any;
  onClose: () => void;
}

export const PrintableInvoiceModal: React.FC<PrintableInvoiceModalProps> = ({ order, onClose }) => {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!order) return null;

  const items = order.items || order.relevant_items || [];
  const sellerUsername = order.items?.[0]?.seller_username || order.seller_username || 'Seller';
  const buyerUsername = order.buyer || order.buyer_username || order.user?.username || 'Customer';
  const itemsSubtotal = items.reduce((s: number, i: any) => s + (Number(i.subtotal) || (Number(i.price) * Number(i.quantity))), 0);
  const negData = order.negotiation_data || {};
  const deliveryInfo = order.delivery_info || {};

  const verifyUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://sokonimax.com'}/orders?highlight=${order.id}`;

  const handlePrint = async () => {
    if (!printRef.current) return;
    try {
      setIsPrinting(true);
      await printElement(printRef.current, {
        pageTitle: `SokoniMax Invoice #${order.id}`,
        pageStyle: '@page { size: A4 portrait; margin: 12mm 14mm; }',
      });
    } catch (err) {
      console.error('Failed to print invoice:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white dark:bg-[#111] text-gray-900 dark:text-white w-full max-w-3xl rounded-2xl shadow-2xl border border-surface-border dark:border-surface-dark-border overflow-hidden flex flex-col max-h-[92vh] print:shadow-none print:rounded-none print:max-h-none print:border-0">
        {/* Modal Toolbar (hidden in print) */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-surface-border dark:border-surface-dark-border bg-surface-muted/50 dark:bg-[#161616] print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-brand-500/10 dark:bg-brand-500/15 text-brand-500 shrink-0">
              <Printer size={16} />
            </div>
            <h3 className="font-extrabold text-sm uppercase tracking-wide text-gray-900 dark:text-white truncate">
              SokoniMax Invoice #{order.id}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-black font-extrabold text-xs shadow-sm hover:shadow transition-all whitespace-nowrap active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <Printer size={14} className="shrink-0" />
              <span>{isPrinting ? t('preparing_print', 'Preparing...') : t('print_invoice', 'Print Invoice')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-surface-muted dark:hover:bg-neutral-800 rounded-xl transition cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-white text-black font-sans print:p-0" ref={printRef}>
          {/* Header Row */}
          <div className="flex justify-between items-start pb-4 border-b-2 border-gray-900 mb-4">
            <div>
              {/* Prominent main SokoniMax logo */}
              <img 
                src="/logo_dark.png" 
                alt="SokoniMax" 
                className="h-14 w-auto max-h-[58px] max-w-[220px] object-contain mb-1" 
                style={{ maxHeight: '58px', maxWidth: '220px' }}
              />
              <p className="text-xs text-gray-500 font-medium">
                Official Marketplace Invoice & Order Summary
              </p>
            </div>

            <div className="text-right space-y-0.5 pt-1">
              <p className="text-base font-black text-black">INVOICE #{order.id}</p>
              <p className="text-xs text-gray-500">
                Date: {new Date(order.order_date || order.created_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
              <div className="flex items-center justify-end gap-1.5 pt-1">
                <span className="px-2 py-0.5 rounded text-2xs font-extrabold uppercase tracking-wider bg-gray-100 text-gray-800 border border-gray-300">
                  {order.status?.replace('_', ' ')}
                </span>
                {order.is_bulk_order && (
                  <span className="px-2 py-0.5 rounded text-2xs font-extrabold uppercase tracking-wider bg-black text-white">
                    Bulk Order
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Store & Customer Details Grid */}
          <div className="grid grid-cols-2 gap-6 mb-4 text-xs bg-gray-50/80 p-3 rounded-lg border border-gray-200">
            {/* Store Information */}
            <div className="space-y-0.5">
              <p className="text-2xs font-extrabold uppercase tracking-wider text-gray-400">
                Seller / Store Information
              </p>
              <p className="font-extrabold text-sm text-black">
                {order.seller_store_name || order.seller_name || `@${sellerUsername}`}
              </p>
              <p className="text-gray-600 font-medium">
                @{sellerUsername} • SokoniMax Verified Merchant
              </p>
            </div>

            {/* Buyer Information */}
            <div className="space-y-0.5">
              <p className="text-2xs font-extrabold uppercase tracking-wider text-gray-400">
                Billed / Shipped To
              </p>
              <p className="font-extrabold text-sm text-black">
                {deliveryInfo.full_name || deliveryInfo.contact_name || order.buyer_full_name || buyerUsername}
              </p>
              <p className="text-gray-600 font-medium">
                @{buyerUsername}
              </p>
              {deliveryInfo.phone && <p className="text-gray-600">Phone: {deliveryInfo.phone}</p>}
              {deliveryInfo.address && <p className="text-gray-600">Address: {deliveryInfo.address}</p>}
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-4 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-100/60 text-gray-600 uppercase text-2xs font-extrabold tracking-wider">
                  <th className="py-2 px-2 w-8">#</th>
                  <th className="py-2 px-2 w-auto">Item Description</th>
                  <th className="py-2 px-2 text-center w-12">Qty</th>
                  <th className="py-2 px-2 text-right w-44">Unit Price</th>
                  <th className="py-2 px-2 text-right w-36">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item: any, idx: number) => {
                  const unitPrice = Number(item.price || 0);
                  const qty = Number(item.quantity || 1);
                  const subtotal = Number(item.subtotal || (unitPrice * qty));
                  const catPrice = item.catalog_price ? Number(item.catalog_price) : null;
                  const hasDiscount = catPrice !== null && catPrice > unitPrice && unitPrice > 0;

                  return (
                    <tr key={item.id || idx} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                      <td className="py-2.5 px-2 text-gray-400 font-bold">{idx + 1}</td>
                      <td className="py-2.5 px-2">
                        <p className="font-bold text-black">{item.product_name}</p>
                        {item.variant_name && (
                          <p className="text-3xs text-gray-500 font-medium">Variant: {item.variant_name}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-black">{qty}</td>
                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        {hasDiscount && (
                          <span className="line-through text-gray-400 text-3xs mr-1.5 whitespace-nowrap inline-block">
                            TSh {catPrice?.toLocaleString()}
                          </span>
                        )}
                        <span className="font-bold text-black whitespace-nowrap inline-block">
                          {unitPrice > 0 ? `TSh ${unitPrice.toLocaleString()}` : 'Quote Req.'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-black text-black whitespace-nowrap">
                        TSh {subtotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals & Notes Section */}
          <div className="grid grid-cols-2 gap-6 items-start pt-3 border-t border-gray-200 mb-4 text-xs">
            {/* Notes and QR verification */}
            <div className="space-y-2.5">
              {(negData.seller_invoice_note || negData.seller_final_note || negData.buyer_request_note) && (
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-0.5">
                  <p className="text-3xs uppercase font-extrabold tracking-wider text-gray-500">Invoice Terms & Notes</p>
                  {negData.seller_final_note && (
                    <p className="text-gray-700 italic">"{negData.seller_final_note}"</p>
                  )}
                  {!negData.seller_final_note && negData.seller_invoice_note && (
                    <p className="text-gray-700 italic">"{negData.seller_invoice_note}"</p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2.5 pt-1">
                <div className="p-1 bg-white border border-gray-300 rounded shrink-0">
                  <QRCodeSVG value={verifyUrl} size={56} level="M" />
                </div>
                <div>
                  <p className="text-3xs font-extrabold uppercase tracking-wider text-gray-500">Verify Authenticity</p>
                  <p className="text-3xs text-gray-400">Scan QR code to view live order and verification records.</p>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="space-y-1.5">
              <div className="flex justify-between py-1 border-b border-gray-100 text-gray-600">
                <span>Items Subtotal</span>
                <span className="font-bold text-black">TSh {itemsSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5 border-t-2 border-gray-900 text-sm font-black text-black">
                <span>Total Items Value</span>
                <span className="text-base">TSh {itemsSubtotal.toLocaleString()}</span>
              </div>
              <p className="text-3xs text-gray-400 italic">
                * Delivery and transport fee is calculated and settled separately during order fulfillment.
              </p>
            </div>
          </div>

          {/* Footer Note */}
          <div className="pt-4 border-t border-dashed border-gray-300 text-center text-3xs text-gray-400 space-y-0.5">
            <p>Thank you for doing business with @{sellerUsername} via SokoniMax.</p>
            <p>For support or disputes, visit SokoniMax Help Center or contact support@sokonimax.com.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintableInvoiceModal;

