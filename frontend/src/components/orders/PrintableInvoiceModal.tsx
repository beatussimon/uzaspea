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
  const sellerContact = order.seller_contacts?.[0] || {};
  const buyerContact = order.buyer_contact || {};

  const rawSellerUsername = order.seller_username || order.items?.[0]?.seller_username || sellerContact.username || '';
  const sellerUsername = (rawSellerUsername || 'Seller').replace(/^@+/, '');

  const rawBuyerUsername = order.buyer_username || order.buyer || order.user?.username || buyerContact.username || '';
  const buyerUsername = (rawBuyerUsername || 'Customer').replace(/^@+/, '');

  const sellerStore = order.seller_store_name || order.items?.[0]?.seller_store_name || sellerContact.store_name;
  const sellerFullName = order.seller_name || order.items?.[0]?.seller_name || sellerContact.full_name;
  const sellerDisplayName = sellerStore || sellerFullName || sellerUsername;

  const itemsSubtotal = items.reduce((s: number, i: any) => s + (Number(i.subtotal) || (Number(i.price) * Number(i.quantity))), 0);
  const negData = order.negotiation_data || {};
  const deliveryInfo = order.delivery_info || {};

  const buyerFullName = deliveryInfo.full_name || deliveryInfo.contact_name || order.buyer_full_name || buyerContact.full_name || (order.user?.first_name ? `${order.user.first_name} ${order.user.last_name || ''}`.trim() : '');
  const buyerDisplayName = buyerFullName || buyerUsername;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sokonimax.com';
  const tokenParam = order.verification_token ? `?sig=${order.verification_token}` : '';
  const verifyUrl = `${origin}/verify/invoice/${order.id}${tokenParam}`;

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
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 print:p-0 print:bg-white print:block"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative bg-surface-muted/40 dark:bg-[#161616] w-full max-w-3xl rounded-card shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh] border-0 print:shadow-none print:rounded-none print:max-h-none print:h-auto print:max-w-none"
      >
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-neutral-400 hover:text-white transition z-30 print-hidden cursor-pointer p-1.5 rounded-full hover:bg-white/10"
          aria-label="Close"
          title="Close"
        >
          <X size={18} />
        </button>

        {/* Printable Area Container */}
        <div className="p-4 pt-10 sm:p-6 sm:pt-6 overflow-y-auto flex-1 flex justify-center scrollbar-thin print:bg-white print:p-0 print:overflow-visible">
          {/* Actual Printable Invoice Container */}
          <div 
            id="invoice-content"
            ref={printRef}
            className="bg-white dark:bg-[#161616] text-black dark:text-gray-100 p-6 md:p-8 w-full max-w-2xl min-h-max mx-auto shadow-md dark:shadow-none rounded-xl relative my-2 font-sans border-0 print:bg-white print:text-black print:border-none print:shadow-none print:rounded-none print:p-0 print:m-0 print:max-w-none"
          >
            {/* Header Row */}
          <div className="flex justify-between items-start pb-4 border-b-2 border-gray-900 dark:border-white/20 print:border-gray-900 mb-4">
            <div>
              {/* Prominent main SokoniMax logo */}
              <img 
                src="/logo_dark.png" 
                alt="SokoniMax" 
                className="h-14 w-auto max-h-[58px] max-w-[220px] object-contain mb-1 brightness-0 dark:invert print:filter-none print:brightness-100 print:invert-0" 
                style={{ maxHeight: '58px', maxWidth: '220px' }}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-500 font-medium">
                Official Marketplace Invoice & Order Summary
              </p>
            </div>

            <div className="text-right space-y-0.5 pt-1">
              <p className="text-base font-black text-black dark:text-white print:text-black">INVOICE #{order.id}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-500">
                Date: {new Date(order.order_date || order.created_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
              <div className="flex items-center justify-end gap-1.5 pt-1">
                <span className="text-2xs font-extrabold uppercase tracking-wider text-gray-700 dark:text-gray-300 print:text-gray-700">
                  {order.status?.replace('_', ' ')}
                </span>
                {order.is_bulk_order && (
                  <span className="px-2 py-0.5 rounded text-2xs font-extrabold uppercase tracking-wider bg-black dark:bg-white/20 text-white print:bg-black print:text-white">
                    Bulk Order
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Store & Customer Details Grid */}
          <div className="grid grid-cols-2 gap-6 mb-4 text-xs py-1">
            {/* Store Information */}
            <div className="space-y-0.5">
              <p className="text-2xs font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 print:text-gray-400">
                Seller / Store Information
              </p>
              <p className="font-extrabold text-sm text-black dark:text-white print:text-black">
                {sellerDisplayName}
              </p>
              <p className="text-gray-600 dark:text-gray-300 print:text-gray-600 font-medium">
                @{sellerUsername} • SokoniMax Verified Merchant
              </p>
            </div>

            {/* Buyer Information */}
            <div className="space-y-0.5">
              <p className="text-2xs font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 print:text-gray-400">
                Billed / Shipped To
              </p>
              <p className="font-extrabold text-sm text-black dark:text-white print:text-black">
                {buyerDisplayName}
              </p>
              <p className="text-gray-600 dark:text-gray-300 print:text-gray-600 font-medium">
                @{buyerUsername}
              </p>
              {deliveryInfo.phone && <p className="text-gray-600 dark:text-gray-300 print:text-gray-600">Phone: {deliveryInfo.phone}</p>}
              {deliveryInfo.address && <p className="text-gray-600 dark:text-gray-300 print:text-gray-600">Address: {deliveryInfo.address}</p>}
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-4 overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse min-w-[500px] sm:min-w-0 table-fixed">
              <thead>
                <tr className="border-b border-gray-300 dark:border-white/10 print:border-gray-300 text-gray-600 dark:text-gray-400 print:text-gray-600 uppercase text-2xs font-extrabold tracking-wider">
                  <th className="py-2 px-2 w-8">#</th>
                  <th className="py-2 px-2 w-auto">Item Description</th>
                  <th className="py-2 px-2 text-center w-12">Qty</th>
                  <th className="py-2 px-2 text-right w-44">Unit Price</th>
                  <th className="py-2 px-2 text-right w-36">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10 print:divide-gray-200">
                {items.map((item: any, idx: number) => {
                  const unitPrice = Number(item.price || 0);
                  const qty = Number(item.quantity || 1);
                  const subtotal = Number(item.subtotal || (unitPrice * qty));
                  const catPrice = item.catalog_price ? Number(item.catalog_price) : null;
                  const hasDiscount = catPrice !== null && catPrice > unitPrice && unitPrice > 0;

                  return (
                    <tr key={item.id || idx} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                      <td className="py-2 px-2 text-gray-400 dark:text-gray-500 print:text-gray-400 font-bold">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <p className="font-bold text-black dark:text-white print:text-black">{item.product_name}</p>
                        {item.variant_name && (
                          <p className="text-3xs text-gray-500 dark:text-gray-400 print:text-gray-500 font-medium">Variant: {item.variant_name}</p>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-black dark:text-white print:text-black">{qty}</td>
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        {hasDiscount && (
                          <span className="line-through text-gray-400 dark:text-gray-500 print:text-gray-400 text-3xs mr-1.5 whitespace-nowrap inline-block">
                            TSh {catPrice?.toLocaleString()}
                          </span>
                        )}
                        <span className="font-bold text-black dark:text-white print:text-black whitespace-nowrap inline-block">
                          {unitPrice > 0 ? `TSh ${unitPrice.toLocaleString()}` : 'Quote Req.'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-black text-black dark:text-white print:text-black whitespace-nowrap">
                        TSh {subtotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals & Notes Section */}
          <div className="flex flex-row items-start gap-3 sm:grid sm:grid-cols-2 sm:gap-6 pt-3 border-t border-gray-200 dark:border-white/10 print:grid print:grid-cols-2 print:gap-6 mb-4 text-xs">
            {/* Notes and QR verification */}
            <div className="shrink-0 w-[68px] sm:w-auto space-y-2.5">
              {(negData.seller_invoice_note || negData.seller_final_note || negData.buyer_request_note) && (
                <div className="space-y-0.5">
                  <p className="text-3xs uppercase font-extrabold tracking-wider text-gray-500 dark:text-gray-400 print:text-gray-500">Invoice Terms & Notes</p>
                  {negData.seller_final_note && (
                    <p className="text-gray-700 dark:text-gray-300 print:text-gray-700 italic">"{negData.seller_final_note}"</p>
                  )}
                  {!negData.seller_final_note && negData.seller_invoice_note && (
                    <p className="text-gray-700 dark:text-gray-300 print:text-gray-700 italic">"{negData.seller_invoice_note}"</p>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2.5 pt-1">
                <div className="shrink-0 bg-white p-1 rounded-sm border border-gray-200 dark:border-white/20">
                  <QRCodeSVG value={verifyUrl} size={56} level="M" />
                </div>
                <div className="max-w-[70px] sm:max-w-none text-left">
                  <p className="hidden sm:flex print:flex text-3xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 print:text-emerald-600">Verify Authenticity</p>
                  <p className="text-[8px] sm:text-3xs text-gray-400 dark:text-gray-500 print:text-gray-400 leading-tight">Scan QR code to view live order and verification records.</p>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex justify-between items-baseline gap-2 py-1.5 text-xs sm:text-sm font-black text-black dark:text-white print:text-black">
                <span className="whitespace-nowrap">Total Items Value</span>
                <span className="text-sm sm:text-base font-black whitespace-nowrap">TSh {itemsSubtotal.toLocaleString()}</span>
              </div>
              <p className="text-3xs text-gray-400 dark:text-gray-500 print:text-gray-400 italic">
                * Delivery and transport fee is calculated and settled separately during order fulfillment.
              </p>
            </div>
          </div>

          {/* Footer Note */}
          <div className="pt-4 border-t border-dashed border-gray-300 dark:border-white/10 print:border-gray-300 text-center text-3xs text-gray-400 dark:text-gray-500 print:text-gray-400 space-y-0.5">
            <p>Thank you for doing business with @{sellerUsername} via SokoniMax.</p>
            <p>For support or disputes, visit SokoniMax Help Center or contact support@sokonimax.com.</p>
          </div>
        </div>
      </div>

      {/* Bottom Print Action (POS Receipt Style) */}
      <div className="p-3 flex justify-center gap-2 print-hidden shrink-0">
        <button
          type="button"
          onClick={handlePrint}
          disabled={isPrinting}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 text-white border-0 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
        >
          <Printer size={14} />
          <span>{isPrinting ? t('preparing_print', 'Preparing...') : t('print_invoice', 'Print Invoice')}</span>
        </button>
      </div>
    </div>
  </div>
);
};

export default PrintableInvoiceModal;

