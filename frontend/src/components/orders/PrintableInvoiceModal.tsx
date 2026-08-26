import React, { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';

interface PrintableInvoiceModalProps {
  order: any;
  onClose: () => void;
}

export const PrintableInvoiceModal: React.FC<PrintableInvoiceModalProps> = ({ order, onClose }) => {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  const items = order.items || order.relevant_items || [];
  const sellerUsername = order.items?.[0]?.seller_username || order.seller_username || 'Seller';
  const buyerUsername = order.buyer || order.buyer_username || order.user?.username || 'Customer';
  const itemsSubtotal = items.reduce((s: number, i: any) => s + (Number(i.subtotal) || (Number(i.price) * Number(i.quantity))), 0);
  const negData = order.negotiation_data || {};
  const deliveryInfo = order.delivery_info || {};

  const verifyUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://sokonimax.com'}/orders?highlight=${order.id}`;

  const handlePrint = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Commercial Invoice #${order.id}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #111; background: #fff; margin: 0; padding: 0; font-size: 13px; line-height: 1.5; }
            .invoice-wrapper { max-width: 800px; margin: 0 auto; padding: 20px; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; border-bottom: 2px solid #111; padding-bottom: 15px; }
            .header-table td { vertical-align: top; }
            .logo { height: 48px; width: auto; object-fit: contain; }
            .title { font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin: 0; }
            .badge { display: inline-block; padding: 2px 8px; font-size: 10px; font-weight: 800; text-transform: uppercase; background: #f3f4f6; border-radius: 4px; }
            .grid-2 { display: table; width: 100%; margin-bottom: 25px; }
            .col { display: table-cell; width: 50%; vertical-align: top; padding-right: 15px; }
            .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 6px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
            .items-table th { text-align: left; padding: 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; border-bottom: 2px solid #e5e7eb; color: #4b5563; }
            .items-table td { padding: 10px; border-bottom: 1px solid #f3f4f6; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .strikethrough { text-decoration: line-through; color: #9ca3af; font-size: 11px; margin-right: 6px; }
            .totals-container { width: 100%; display: table; margin-top: 15px; }
            .totals-left { display: table-cell; width: 55%; vertical-align: top; padding-right: 20px; }
            .totals-right { display: table-cell; width: 45%; vertical-align: top; }
            .totals-table { width: 100%; border-collapse: collapse; }
            .totals-table td { padding: 6px 0; }
            .total-row { border-top: 2px solid #111; font-size: 16px; font-weight: 900; }
            .qr-box { display: inline-block; padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px; }
            .footer-note { margin-top: 40px; padding-top: 15px; border-top: 1px dashed #d1d5db; font-size: 11px; color: #6b7280; text-align: center; }
          </style>
        </head>
        <body>
          <div class="invoice-wrapper">
            ${content}
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white dark:bg-[#111] text-gray-900 dark:text-white w-full max-w-3xl rounded-2xl shadow-2xl border border-surface-border dark:border-surface-dark-border overflow-hidden flex flex-col max-h-[92vh] print:shadow-none print:rounded-none print:max-h-none print:border-0">
        {/* Modal Toolbar (hidden in print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border dark:border-surface-dark-border bg-surface-muted/50 dark:bg-[#161616] print:hidden">
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-brand-500" />
            <h3 className="font-extrabold text-sm uppercase tracking-wide">
              {t('commercial_invoice', 'Commercial Invoice')} #{order.id}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handlePrint} size="sm" className="flex items-center gap-1.5 font-bold">
              <Printer size={15} />
              {t('print_now', 'Print Invoice')}
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-8 overflow-y-auto flex-1 bg-white text-black font-sans print:p-0" ref={printRef}>
          {/* Header Row */}
          <div className="flex justify-between items-start pb-6 border-b-2 border-gray-900 mb-6">
            <div>
              {/* Colored, visible logo */}
              <img src="/logo.png" alt="SokoniMax" className="h-10 w-auto object-contain mb-2" />
              <h1 className="text-xl font-black uppercase tracking-tight text-black">
                SokoniMax Commercial Invoice
              </h1>
              <p className="text-xs text-gray-500 font-medium">
                Official Marketplace Invoice & Order Summary
              </p>
            </div>

            <div className="text-right space-y-1">
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

          {/* Store & Customer Details Grid with Names & Usernames */}
          <div className="grid grid-cols-2 gap-8 mb-6 text-xs">
            {/* Store Information */}
            <div className="space-y-1">
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
            <div className="space-y-1">
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
          <div className="mb-6 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300 text-gray-600 uppercase text-2xs font-extrabold tracking-wider">
                  <th className="py-2.5 px-2">#</th>
                  <th className="py-2.5 px-2">Item Description</th>
                  <th className="py-2.5 px-2 text-center">Qty</th>
                  <th className="py-2.5 px-2 text-right">Unit Price</th>
                  <th className="py-2.5 px-2 text-right">Subtotal</th>
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
                    <tr key={item.id || idx}>
                      <td className="py-3 px-2 text-gray-400 font-bold">{idx + 1}</td>
                      <td className="py-3 px-2">
                        <p className="font-bold text-black">{item.product_name}</p>
                        {item.variant_name && (
                          <p className="text-3xs text-gray-500 font-medium">Variant: {item.variant_name}</p>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-black">{qty}</td>
                      <td className="py-3 px-2 text-right">
                        {hasDiscount && (
                          <span className="line-through text-gray-400 text-3xs mr-1">
                            TSh {catPrice?.toLocaleString()}
                          </span>
                        )}
                        <span className="font-bold text-black">
                          {unitPrice > 0 ? `TSh ${unitPrice.toLocaleString()}` : 'Quote Req.'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right font-black text-black">
                        TSh {subtotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals & Notes Section */}
          <div className="grid grid-cols-2 gap-8 items-start pt-4 border-t border-gray-200 mb-6 text-xs">
            {/* Notes and QR verification */}
            <div className="space-y-3">
              {(negData.seller_invoice_note || negData.seller_final_note || negData.buyer_request_note) && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                  <p className="text-3xs uppercase font-extrabold tracking-wider text-gray-500">Invoice Terms & Notes</p>
                  {negData.seller_final_note && (
                    <p className="text-gray-700 italic">"{negData.seller_final_note}"</p>
                  )}
                  {!negData.seller_final_note && negData.seller_invoice_note && (
                    <p className="text-gray-700 italic">"{negData.seller_invoice_note}"</p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <div className="p-1.5 bg-white border border-gray-300 rounded shrink-0">
                  <QRCodeSVG value={verifyUrl} size={64} />
                </div>
                <div>
                  <p className="text-3xs font-extrabold uppercase tracking-wider text-gray-500">Verify Authenticity</p>
                  <p className="text-3xs text-gray-400">Scan QR code to view live order and verification records.</p>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-gray-100 text-gray-600">
                <span>Items Subtotal</span>
                <span className="font-bold text-black">TSh {itemsSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-t-2 border-gray-900 text-sm font-black text-black">
                <span>Total Items Value</span>
                <span className="text-base">TSh {itemsSubtotal.toLocaleString()}</span>
              </div>
              <p className="text-3xs text-gray-400 italic">
                * Delivery and transport fee is calculated and settled separately during order fulfillment.
              </p>
            </div>
          </div>

          {/* Footer Note */}
          <div className="pt-6 border-t border-dashed border-gray-300 text-center text-3xs text-gray-400 space-y-1">
            <p>Thank you for doing business with @{sellerUsername} via SokoniMax.</p>
            <p>For support or disputes, visit SokoniMax Help Center or contact support@sokonimax.com.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintableInvoiceModal;
