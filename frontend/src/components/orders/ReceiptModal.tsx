import React, { useRef, useState } from 'react';
import { X, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../context/AuthContext';
import { printElement } from '../../utils/printHelper';

interface ReceiptModalProps {
  order: any;
  onClose: () => void;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, onClose }) => {
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

  const shippingFee = parseInt(order.shipping_fee || '0');
  const totalAmount = parseInt(order.total_amount || '0');
  const displaySubtotal = totalAmount - shippingFee;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 print:p-0 print:bg-white print:block">
      <div className="bg-gray-50 dark:bg-neutral-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh] print:shadow-none print:rounded-none print:max-h-none print:h-auto print:max-w-none">
        
        <div className="bg-brand-500 p-4 text-center text-white relative shrink-0 print-hidden">
          <h2 className="text-xl font-black">Invoice #{order.id}</h2>
          <button onClick={onClose} className="absolute top-3 right-3 text-white/70 hover:text-white bg-black/20 p-1 rounded-full backdrop-blur-md transition">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto bg-gray-100 dark:bg-neutral-800 flex-1 flex justify-center print:bg-white print:p-0 print:overflow-visible">
          
          <div 
            id="receipt-content" 
            className="bg-white text-black p-4 w-[80mm] min-w-[80mm] max-w-[80mm] min-h-max mx-auto shadow-sm relative" 
            ref={printRef}
            style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '12px', lineHeight: '1.4' }}
          >
            <div className="text-center mb-4">
              <img 
                src="/logo_dark.png" 
                alt="Sokonimax" 
                className="w-24 mx-auto grayscale object-contain mb-2" 
                style={{ maxWidth: '96px', maxHeight: '42px' }}
              />
              <h3 className="font-black text-lg tracking-widest leading-none">SOKONIMAX</h3>
              <p className="text-[10px] text-gray-500 mt-1">Premium Quality Products</p>
            </div>
            
            <div className="border-t border-dashed border-gray-400 py-2 mb-2 text-center text-xs">
              <p className="font-bold">INVOICE #{order.id} {order.is_bulk_order ? '• [BULK ORDER]' : ''}</p>
              <p>{(() => {
                const rawDate = order.order_date || order.created_at;
                if (!rawDate) return new Date().toLocaleString();
                const d = new Date(rawDate);
                return isNaN(d.getTime()) ? String(rawDate) : d.toLocaleString();
              })()}</p>
            </div>

            <div className="text-xs mb-3">
              <p><strong>Store:</strong> @{order.items?.[0]?.seller_username || 'Sokonimax'}</p>
              <p><strong>Customer:</strong> {order.delivery_info?.customer_name || user?.username || 'Customer'}</p>
            </div>
            
            <div className="border-t border-b border-dashed border-gray-400 py-2 mb-3">
              <div className="flex font-bold text-xs mb-1">
                <span className="flex-1">Item</span>
                <span className="w-10 text-center">Qty</span>
                <span className="w-16 text-right">Amt</span>
              </div>
              
              {(order.items || []).map((item: any, i: number) => {
                const price = parseFloat(item.price) || 0;
                const qty = parseInt(item.quantity) || 1;
                const itemSubtotal = parseFloat(item.subtotal) || (price * qty);
                const name = item.product_name || `Product #${item.product_id || i + 1}`;
                const variantName = item.variant_name;

                return (
                  <div key={i} className="text-[11px] mb-2 last:mb-0">
                    <div className="font-bold whitespace-normal leading-tight">{name}</div>
                    {variantName && <div className="text-[10px] text-gray-600">[{variantName}]</div>}
                    <div className="flex justify-between items-center mt-1 text-[11px]">
                      <span className="flex-1 text-gray-500 text-[10px]">{price > 0 ? `@${price.toLocaleString()}/=` : 'TBD'}</span>
                      <span className="w-10 text-center font-bold text-gray-800">{qty}</span>
                      <span className="w-16 text-right font-bold">{itemSubtotal > 0 ? `${itemSubtotal.toLocaleString()}/=` : 'TBD'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="text-xs font-bold flex justify-between mb-1 text-gray-600">
              <span>SUBTOTAL</span>
              <span>{Math.round(displaySubtotal).toLocaleString()}/=</span>
            </div>

            <div className="text-xs font-bold flex justify-between mb-1 text-gray-600">
              <span>DELIVERY FEE</span>
              <span>
                {shippingFee > 0 
                  ? `${shippingFee.toLocaleString()}/=`
                  : ['COMPLETED', 'DELIVERED', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'ARRIVED_AT_REGIONAL_WAREHOUSE', 'SHIPPED', 'ASSIGNED_TRANSPORT'].includes(order.status)
                    ? 'FREE'
                    : 'TBD'}
              </span>
            </div>
            
            <div className="text-sm font-black flex justify-between mb-2 pt-1 border-t border-dashed border-gray-400">
              <span>TOTAL TSH</span>
              <span>{Math.round(totalAmount).toLocaleString()}/=</span>
            </div>
            
            <div className="border-t border-dashed border-gray-400 mt-3 pt-4 text-center">
              <p className="text-[10px] font-bold mb-3">Scan to view your order!</p>
              <div className="flex justify-center">
                <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : 'https://sokonimax.com'}/orders?highlight=${order.id}`} size={64} level="L" />
              </div>
              <p className="text-[9px] mt-2 text-gray-500">Thank you for shopping with us.</p>
              <p className="text-[9px] text-gray-500">{typeof window !== 'undefined' ? window.location.host : 'sokonimax.com'}</p>
            </div>

          </div>
        </div>
        
        <div className="px-4 py-3 bg-white dark:bg-neutral-900 border-t border-gray-100 dark:border-neutral-800 flex gap-3 print-hidden shrink-0">
          <button 
            onClick={handlePrint} 
            disabled={isPrinting}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-900 hover:bg-black text-white shadow-lg font-bold disabled:opacity-50 transition"
          >
            <Printer size={18} /> {isPrinting ? 'Preparing Print...' : 'Print Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
