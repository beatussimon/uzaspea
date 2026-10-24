import React, { useRef, useState } from 'react';
import { X, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../context/AuthContext';
import { printElement } from '../../utils/printHelper';

interface ReceiptModalProps {
  order: any;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, onClose }) => {
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    if (!printRef.current) return;
    try {
      setIsPrinting(true);
      await printElement(printRef.current, {
        pageTitle: `Receipt #${order.id} - SokoniMax`,
        pageStyle: `
          @page { size: 80mm auto; margin: 0; }
          body { 
            width: 80mm !important; 
            margin: 0 !important; 
            padding: 4mm !important; 
            background: #ffffff !important;
            font-family: 'Courier New', Courier, monospace !important;
          }
          #receipt-content { 
            width: 72mm !important; 
            min-width: 72mm !important; 
            max-width: 72mm !important; 
            margin: 0 auto !important; 
            padding: 0 !important; 
            border: none !important; 
            box-shadow: none !important; 
          }
        `,
        bodyClass: 'bg-white text-black p-0 m-0',
      });
    } catch (err) {
      console.error('Failed to print receipt:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  const rawItems = order.items && order.items.length > 0
    ? order.items
    : order.orderitem_set && order.orderitem_set.length > 0
    ? order.orderitem_set
    : [];

  const shippingFee = parseFloat(order.shipping_fee || '0') || 0;
  const totalAmount = parseFloat(order.total_amount || '0') || 0;
  const discountVal = parseFloat(order.discount_amount || order.delivery_info?.discount_amount || '0') || 0;
  const promoCodeName = order.promo_code_code || order.promo_code || order.delivery_info?.promo_code;
  const rawSubtotal = totalAmount - shippingFee + discountVal;

  const rawDate = order.order_date || order.created_at;
  const formattedDate = (() => {
    if (!rawDate) return new Date().toLocaleString();
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? String(rawDate) : d.toLocaleString();
  })();

  const storeTitle = order.delivery_info?.location_name || order.fulfillment_location_name || order.seller_store_name || user?.business_name || (order.seller_username ? `@${order.seller_username}` : 'Uzaspea Store');
  const storeAddress = order.delivery_info?.location_address || order.delivery_info?.address;
  const storePhone = order.delivery_info?.location_phone || order.delivery_info?.phone;

  const customerName = order.delivery_info?.customer_name || (order.buyer ? `@${order.buyer}` : order.buyer_username ? `@${order.buyer_username}` : 'Customer');
  const billedByName = order.billed_by || (user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.username || 'Store Staff');

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 print:p-0 print:bg-white print:block"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative bg-surface-muted/40 dark:bg-[#161616] w-full max-w-sm rounded-card shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh] border-0 print:shadow-none print:rounded-none print:max-h-none print:h-auto print:max-w-none"
      >
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-neutral-400 hover:text-white transition z-30 print-hidden cursor-pointer p-1"
          aria-label="Close"
        >
          <X size={16} />
        </button>
        
        <div className="p-4 pt-4 overflow-y-auto flex-1 flex justify-center scrollbar-thin print:bg-white print:p-0 print:overflow-visible">
          {/* Actual Thermal Receipt Container */}
          <div 
            id="receipt-content" 
            className="bg-white text-black p-5 w-[80mm] min-w-[80mm] max-w-[80mm] min-h-max mx-auto shadow-md rounded-xl relative my-2" 
            ref={printRef}
            style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '12px', lineHeight: '1.4' }}
          >
            {/* Logo & Branch Area */}
            <div className="text-center mb-3">
              <img 
                src="/logo_dark.png" 
                alt="Sokonimax" 
                className="w-24 mx-auto grayscale object-contain mb-1.5" 
                style={{ maxWidth: '96px', maxHeight: '42px' }} 
              />
              <p className="font-bold text-xs text-gray-900 uppercase">
                {storeTitle}
              </p>
              {storeAddress && (
                <p className="text-[10px] text-gray-600 mt-0.5">
                  {storeAddress}
                </p>
              )}
              {storePhone && (
                <p className="text-[10px] text-gray-600">
                  Tel: {storePhone}
                </p>
              )}
            </div>
            
            <div className="border-t border-dashed border-gray-400 py-2 mb-2 text-center text-xs">
              <p className="font-bold">INVOICE #{order.id} {order.is_bulk_order ? '• [BULK ORDER]' : ''}</p>
              <p>{formattedDate}</p>
            </div>

            <div className="text-xs mb-3">
              <p><strong>Billed By:</strong> {billedByName}</p>
              <p><strong>Customer:</strong> {customerName}</p>
            </div>
            
            {/* Items List */}
            <div className="border-t border-b border-dashed border-gray-400 py-2 mb-3">
              <div className="flex font-bold text-xs mb-1">
                <span className="flex-1">Item</span>
                <span className="text-right">Amt</span>
              </div>
              
              {rawItems.map((item: any, i: number) => {
                const parsedPrice = parseFloat(item.price);
                const price = isNaN(parsedPrice) ? 0 : parsedPrice;
                const parsedQty = parseInt(item.quantity);
                const qty = isNaN(parsedQty) ? 1 : parsedQty;
                const total = price * qty;
                
                const name = item.product?.name || item.product_name || `Product #${item.product_id || item.product || i + 1}`;
                const variantName = item.variant?.name || item.variant_name;

                return (
                  <div key={i} className="text-[11px] mb-2 last:mb-0">
                    <div className="font-bold whitespace-normal leading-tight">{name}</div>
                    {variantName && <div className="text-[10px] text-gray-600">[{variantName}]</div>}
                    <div className="flex justify-between mt-0.5">
                      <span className="text-gray-600">{qty} x {price.toLocaleString()}/=</span>
                      <span className="font-bold">{total.toLocaleString()}/=</span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {discountVal > 0 && (
              <>
                <div className="text-xs flex justify-between text-gray-600 mb-1">
                  <span>SUBTOTAL</span>
                  <span>{Math.round(rawSubtotal).toLocaleString()}/=</span>
                </div>
                <div className="text-xs flex justify-between text-gray-600 mb-1">
                  <span>DISCOUNT {promoCodeName ? `(${promoCodeName})` : ''}</span>
                  <span>-{Math.round(discountVal).toLocaleString()}/=</span>
                </div>
              </>
            )}

            {shippingFee > 0 && (
              <div className="text-xs flex justify-between text-gray-600 mb-1">
                <span>DELIVERY FEE</span>
                <span>{Math.round(shippingFee).toLocaleString()}/=</span>
              </div>
            )}

            <div className="text-sm font-black flex justify-between mb-1">
              <span>TOTAL TSH</span>
              <span>{Math.round(totalAmount).toLocaleString()}/=</span>
            </div>
            
            {(order?.delivery_info?.amount_tendered || order?.delivery_info?.amount_paid) && (
              <>
                <div className="text-xs flex justify-between text-gray-600 mb-1">
                  <span>CASH TENDERED</span>
                  <span>{Math.round(parseFloat(order.delivery_info.amount_tendered || order.delivery_info.amount_paid)).toLocaleString()}/=</span>
                </div>
                <div className="text-xs flex justify-between text-gray-600">
                  <span>CHANGE</span>
                  <span>{Math.round(Math.max(0, (parseFloat(order.delivery_info.amount_tendered || order.delivery_info.amount_paid) || 0) - totalAmount)).toLocaleString()}/=</span>
                </div>
              </>
            )}
            
            <div className="border-t border-dashed border-gray-400 mt-3 pt-4 text-center">
              <p className="text-[10px] font-bold mb-3">Scan to visit our store!</p>
              <div className="flex justify-center">
                <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/orders?highlight=${order.id}`} size={64} level="L" />
              </div>
              <p className="text-[9px] mt-2 text-gray-500">Thank you for shopping with us.</p>
              <p className="text-[9px] text-gray-500">{typeof window !== 'undefined' ? window.location.host : ''}/{user?.username || ''}</p>
            </div>

          </div>
        </div>
        
        <div className="p-3 flex justify-center gap-2 print-hidden shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 text-white border-0 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Printer size={14} /> {isPrinting ? 'Preparing Print...' : 'Print Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
