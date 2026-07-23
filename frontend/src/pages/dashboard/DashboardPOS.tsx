import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Search, ShoppingCart, Plus, Minus, Trash2, Printer, X, ChevronUp, History, Receipt, CalendarDays } from 'lucide-react';
import SafeImage from '../../components/SafeImage';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';

interface Product {
  id: number;
  name: string;
  price: string;
  stock: number;
  images: any[];
  variants?: any[];
}

interface CartItem {
  id: string;
  product_id: number;
  variant_id: number | null;
  name: string;
  variant_name: string | null;
  price: number;
  quantity: number;
  max_stock: number;
}

const POSHistory = ({ onPrint }: { onPrint: (order: any) => void }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = () => {
    setLoading(true);
    api.get('/api/orders/incoming/?is_pos=true')
      .then(res => {
        setOrders(res.data.results || res.data);
      })
      .catch(err => {
        console.error(err);
        toast.error('Failed to load POS history');
      })
      .finally(() => setLoading(false));
  };

  const filteredOrders = useMemo(() => {
    if (!dateFilter) return orders;
    return orders.filter(o => {
      if (!o.order_date) return false;
      try {
        const oDateStr = new Date(o.order_date).toISOString().slice(0, 10);
        return oDateStr === dateFilter || o.order_date.startsWith(dateFilter);
      } catch (e) {
        return o.order_date.startsWith(dateFilter);
      }
    });
  }, [orders, dateFilter]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-[#0A0A0A] rounded-2xl border border-surface-border dark:border-surface-dark-border shadow-sm overflow-hidden p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Sales History</h2>
          <p className="text-sm text-gray-500">View past walk-in customers and invoices</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="date" 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {dateFilter && (
            <Button variant="outline" size="sm" onClick={() => setDateFilter('')}>Clear</Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-gray-200 dark:border-neutral-800 text-gray-500 uppercase tracking-widest text-xs font-bold">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Invoice #</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-400">
                  No sales found for the selected criteria.
                </td>
              </tr>
            ) : (
              filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition">
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-300">
                    {new Date(order.order_date).toLocaleDateString()} {new Date(order.order_date).toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-4 text-brand-600 font-bold">#{order.id}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                    {order.delivery_info?.customer_name || 'Walk-in Customer'}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-gray-900 dark:text-white">
                    TSh {parseFloat(order.total_amount).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Button variant="outline" size="sm" onClick={() => onPrint(order)} className="text-xs py-1 px-3 h-8">
                      <Printer size={14} className="mr-1.5" /> View Receipt
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DashboardPOS: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'sale' | 'history'>('sale');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [amountPaid, setAmountPaid] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const fetchProducts = () => {
    setLoading(true);
    const currentUser = localStorage.getItem('username');
    api.get(`/api/products/?seller=${currentUser}&page=1`)
      .then(async (res) => {
        let prods = res.data.results || res.data;
        try {
          const vRes = await api.get(`/api/variants/`);
          const variants = vRes.data.results || vRes.data;
          
          prods = prods.map((p: any) => ({
            ...p,
            variants: variants.filter((v: any) => v.product === p.id && v.is_available !== false)
          }));
        } catch (e) {
          console.error("Failed to load variants", e);
        }
        setProducts(prods);
      })
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const inStockVariants = p.variants ? p.variants.filter((v: any) => v.stock > 0 && v.is_available !== false) : [];
      const hasVariantStock = inStockVariants.length > 0;
      const hasBaseStock = p.stock > 0;
      
      const isAvailable = (p.variants && p.variants.length > 0) ? hasVariantStock : hasBaseStock;
      if (!isAvailable) return false;

      if (searchQuery) {
        return p.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    }).map(p => {
      if (p.variants && p.variants.length > 0) {
        return {
          ...p,
          variants: p.variants.filter((v: any) => v.stock > 0 && v.is_available !== false)
        };
      }
      return p;
    });
  }, [products, searchQuery]);

  const addToCart = (product: Product, variant: any = null) => {
    const id = variant ? `${product.id}-${variant.id}` : `${product.id}-null`;
    const stock = variant ? variant.stock : product.stock;
    const price = variant ? parseFloat(product.price) + parseFloat(variant.price_adjustment) : parseFloat(product.price);
    
    if (stock <= 0) {
      toast.error('Out of stock!');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === id);
      if (existing) {
        if (existing.quantity >= stock) {
          toast.error('Maximum stock reached!');
          return prev;
        }
        return prev.map(item => item.id === id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, {
        id,
        product_id: product.id,
        variant_id: variant ? variant.id : null,
        name: product.name,
        variant_name: variant ? variant.name : null,
        price,
        quantity: 1,
        max_stock: stock
      }];
    });
    
    toast.success('Added to sale', { duration: 1500, icon: '🛍️' });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQ = item.quantity + delta;
        if (newQ > 0 && newQ <= item.max_stock) {
          return { ...item, quantity: newQ };
        }
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [cart]);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty!');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_name: customerName,
        amount_paid: amountPaid ? parseFloat(amountPaid) : null,
        items: cart.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity
        }))
      };

      const res = await api.post('/api/orders/pos-checkout/', payload);
      toast.success('Sale completed successfully!');
      setReceiptData(res.data);
      setCart([]);
      setCustomerName('Walk-in Customer');
      setAmountPaid('');
      setIsMobileCartOpen(false);
      fetchProducts(); // Refresh stock
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.response?.data?.detail || 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const contentWindow = iframe.contentWindow;
    if (!contentWindow) return;

    // Extract all stylesheets and style blocks to retain Tailwind classes
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(node => node.outerHTML)
      .join('');

    contentWindow.document.open();
    contentWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Receipt</title>
          ${styles}
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { 
              margin: 0; 
              padding: 0; 
              background: white; 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact;
            }
            #receipt-content {
              box-shadow: none !important;
              margin: 0 !important;
              padding: 10px !important;
            }
          </style>
        </head>
        <body>
          ${printContent.outerHTML}
        </body>
      </html>
    `);
    contentWindow.document.close();

    // Small delay to ensure styles and images (like logo.png) are loaded in the iframe
    setTimeout(() => {
      contentWindow.focus();
      contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  };

  return (
    <div className="flex flex-col gap-6 h-auto min-h-[calc(100vh-140px)] pb-24 lg:pb-0 relative">
      
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#111] p-1.5 rounded-xl w-fit shrink-0">
        <button 
          onClick={() => setActiveTab('sale')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'sale' ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          <Receipt size={16} /> New Sale
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          <History size={16} /> Sales History
        </button>
      </div>

      {activeTab === 'sale' ? (
        <div className="flex flex-col lg:flex-row gap-6 flex-1">
          {/* Products Section */}
          <div className="flex-1 flex flex-col bg-white dark:bg-[#0A0A0A] rounded-2xl border border-surface-border dark:border-surface-dark-border shadow-sm overflow-hidden">
            
            {/* Header & Search */}
            <div className="p-4 md:p-6 border-b border-surface-border dark:border-surface-dark-border bg-gray-50/50 dark:bg-neutral-900/20">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Point of Sale</h2>
                  <p className="text-xs md:text-sm text-gray-500 font-medium mt-1">Tap products to add to current sale</p>
                </div>
                <div className="relative w-full md:w-80 lg:w-96">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search products by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:text-white text-sm shadow-sm transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/30 dark:bg-[#0A0A0A]">
              {loading ? (
                <div className="flex justify-center py-20"><Spinner size="lg" /></div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <ShoppingCart size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium text-gray-600 dark:text-gray-300">No products found</p>
                  <p className="text-sm mt-1">Try adjusting your search query.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:gap-5">
                  {filteredProducts.map((product) => (
                    <div key={product.id} className="group relative bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-xl overflow-hidden hover:shadow-lg hover:shadow-brand-500/5 hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
                      <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                        <SafeImage src={product.images?.[0]?.image || ''} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        {product.stock <= 0 && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
                            <span className="text-white font-black uppercase tracking-wider px-3 py-1 bg-red-600 rounded-full text-[9px] shadow-lg">Out of Stock</span>
                          </div>
                        )}
                        <div className="absolute top-1.5 right-1.5 bg-white/90 dark:bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded-md shadow-sm border border-black/5 text-[9px] font-bold text-gray-900 dark:text-white">
                          {product.stock} left
                        </div>
                      </div>
                      
                      <div className="p-2.5 md:p-3 flex flex-col flex-1">
                        <h3 className="font-bold text-gray-900 dark:text-white text-xs line-clamp-2 mb-1 group-hover:text-brand-600 transition-colors">{product.name}</h3>
                        <p className="text-brand-600 dark:text-brand-400 font-black text-sm mb-2">TSh {parseInt(product.price).toLocaleString()}</p>
                        
                        <div className="mt-auto">
                          {product.variants && product.variants.length > 0 ? (
                            <div className="space-y-1.5">
                              <div className="flex flex-col gap-1.5">
                                {product.variants.map((v: any) => {
                                  return (
                                    <button
                                      key={v.id}
                                      onClick={() => addToCart(product, v)}
                                      disabled={v.stock <= 0}
                                      className="w-full text-left px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-[10px] font-semibold hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex justify-between items-center transition-all group/btn"
                                    >
                                      <span className="truncate pr-1 dark:text-gray-300 group-hover/btn:text-brand-700 dark:group-hover/btn:text-brand-300">{v.name}</span>
                                      <span className="font-bold text-brand-600 shrink-0">+{parseFloat(v.price_adjustment).toLocaleString()}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <Button 
                              onClick={() => addToCart(product)} 
                              disabled={product.stock <= 0}
                              className="w-full py-1.5 text-[11px] font-bold shadow-sm rounded-lg"
                              variant={product.stock <= 0 ? 'outline' : 'default'}
                            >
                              <Plus size={12} className="mr-1" /> Add
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Desktop Cart Sidebar */}
          <div className="hidden lg:flex w-[400px] flex-col bg-white dark:bg-[#0A0A0A] rounded-2xl border border-surface-border dark:border-surface-dark-border shadow-sm overflow-hidden shrink-0 h-[calc(100vh-140px)] sticky top-[80px]">
            <CartContent 
              cart={cart} 
              cartTotal={cartTotal} 
              customerName={customerName} 
              setCustomerName={setCustomerName} 
              amountPaid={amountPaid} 
              setAmountPaid={setAmountPaid} 
              updateQuantity={updateQuantity} 
              removeFromCart={removeFromCart} 
              handleCheckout={handleCheckout} 
              submitting={submitting} 
            />
          </div>

          {/* Mobile Cart Floating Action Bar & Modal */}
          <div className="lg:hidden">
            {/* Floating Bar pinned to bottom */}
            <div className="fixed bottom-16 inset-x-0 p-4 z-40 bg-gradient-to-t from-white via-white to-transparent dark:from-black dark:via-black pointer-events-none">
              <div className="pointer-events-auto max-w-md mx-auto">
                <button 
                  onClick={() => setIsMobileCartOpen(true)}
                  className="w-full bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl shadow-2xl p-4 flex items-center justify-between active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <ShoppingCart size={24} />
                      {cart.length > 0 && (
                        <span className="absolute -top-2 -right-2 bg-brand-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-gray-900 dark:border-white">
                          {cart.reduce((sum, item) => sum + item.quantity, 0)}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-sm">View Current Sale</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-black">TSh {cartTotal.toLocaleString()}</span>
                    <ChevronUp size={20} className="opacity-50" />
                  </div>
                </button>
              </div>
            </div>

            {/* Mobile Slide-Up Cart Modal */}
            {isMobileCartOpen && (
              <div className="fixed inset-0 z-50 flex flex-col justify-end">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsMobileCartOpen(false)} />
                <div className="relative bg-white dark:bg-[#0A0A0A] w-full h-[85vh] rounded-t-3xl shadow-2xl flex flex-col animate-slide-up overflow-hidden">
                  <div className="flex justify-center py-3 bg-gray-50 dark:bg-neutral-900">
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
                  </div>
                  <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center bg-white dark:bg-[#0A0A0A]">
                    <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                      Current Sale
                    </h2>
                    <button onClick={() => setIsMobileCartOpen(false)} className="p-2 bg-gray-100 dark:bg-neutral-800 rounded-full text-gray-500 active:scale-95">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <CartContent 
                      cart={cart} 
                      cartTotal={cartTotal} 
                      customerName={customerName} 
                      setCustomerName={setCustomerName} 
                      amountPaid={amountPaid} 
                      setAmountPaid={setAmountPaid} 
                      updateQuantity={updateQuantity} 
                      removeFromCart={removeFromCart} 
                      handleCheckout={handleCheckout} 
                      submitting={submitting} 
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <POSHistory onPrint={(order) => setReceiptData(order)} />
      )}

      {/* 58mm/80mm Thermal Receipt Modal */}
      {receiptData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 print:p-0 print:bg-white print:block">
          <div className="bg-gray-50 dark:bg-neutral-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh] print:shadow-none print:rounded-none print:max-h-none print:h-auto print:max-w-none">
            
            <div className="bg-brand-500 p-4 text-center text-white relative shrink-0 print-hidden">
              <h2 className="text-xl font-black">Invoice #{receiptData.id}</h2>
              <button onClick={() => setReceiptData(null)} className="absolute top-3 right-3 text-white/70 hover:text-white bg-black/20 p-1 rounded-full backdrop-blur-md transition">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto bg-gray-100 dark:bg-neutral-800 flex-1 flex justify-center print:bg-white print:p-0 print:overflow-visible">
              
              {/* Actual Thermal Receipt Container */}
              <div 
                id="receipt-content" 
                className="bg-white text-black p-4 w-[80mm] min-w-[80mm] max-w-[80mm] min-h-max mx-auto shadow-sm relative" 
                ref={printRef}
                style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '12px', lineHeight: '1.4' }}
              >
                
                <style type="text/css" media="print">
                  {`
                    @page { size: 80mm auto; margin: 0; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; margin: 0; padding: 0; }
                    #receipt-content { 
                      width: 80mm !important; 
                      min-width: 80mm !important;
                      max-width: 80mm !important;
                      margin: 0 auto; 
                      padding: 10px !important; 
                      border: none !important; 
                      box-shadow: none !important;
                    }
                    .print-hidden { display: none !important; }
                  `}
                </style>

                {/* Logo Area */}
                <div className="text-center mb-4">
                  <img src="/logo.png" alt="Sokonimax" className="w-20 mx-auto grayscale object-contain mb-2" />
                  <h3 className="font-black text-lg tracking-widest leading-none">SOKONIMAX</h3>
                  <p className="text-[10px] text-gray-500 mt-1">Premium Quality Products</p>
                </div>
                
                <div className="border-t border-dashed border-gray-400 py-2 mb-2 text-center text-xs">
                  <p className="font-bold">INVOICE #{receiptData.id}</p>
                  <p>{(() => {
                    const rawDate = receiptData.order_date || receiptData.created_at;
                    if (!rawDate) return new Date().toLocaleString();
                    const d = new Date(rawDate);
                    return isNaN(d.getTime()) ? String(rawDate) : d.toLocaleString();
                  })()}</p>
                </div>

                <div className="text-xs mb-3">
                  <p><strong>Billed By:</strong> {(user as any)?.first_name && (user as any)?.last_name ? `${(user as any).first_name} ${(user as any).last_name}` : user?.username || 'Store'}</p>
                  <p><strong>Customer:</strong> {receiptData?.delivery_info?.customer_name || 'Walk-in Customer'}</p>
                </div>
                
                {/* Items List */}
                <div className="border-t border-b border-dashed border-gray-400 py-2 mb-3">
                  <div className="flex font-bold text-xs mb-1">
                    <span className="flex-1">Item</span>
                    <span className="w-10 text-center">Qty</span>
                    <span className="w-16 text-right">Amt</span>
                  </div>
                  
                  {/* Using receiptData.items instead of orderitem_set based on backend serializer */}
                  {(receiptData.items || receiptData.orderitem_set || []).map((item: any, i: number) => {
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
                
                <div className="text-sm font-black flex justify-between mb-1">
                  <span>TOTAL TSH</span>
                  <span>{(() => {
                    const rawTot = parseFloat(receiptData?.total_amount || 0);
                    return Math.round(isNaN(rawTot) ? 0 : rawTot).toLocaleString() + '/=';
                  })()}</span>
                </div>
                
                {receiptData?.delivery_info?.amount_paid && (
                  <>
                    <div className="text-xs flex justify-between text-gray-600 mb-1">
                      <span>CASH TENDERED</span>
                      <span>{(() => {
                        const rawPaid = parseFloat(receiptData.delivery_info.amount_paid);
                        return Math.round(isNaN(rawPaid) ? 0 : rawPaid).toLocaleString() + '/=';
                      })()}</span>
                    </div>
                    <div className="text-xs flex justify-between text-gray-600">
                      <span>CHANGE</span>
                      <span>{(() => {
                        const rawPaid = parseFloat(receiptData.delivery_info.amount_paid || 0);
                        const rawTot = parseFloat(receiptData.total_amount || 0);
                        const paid = isNaN(rawPaid) ? 0 : rawPaid;
                        const tot = isNaN(rawTot) ? 0 : rawTot;
                        return Math.round(Math.max(0, paid - tot)).toLocaleString() + '/=';
                      })()}</span>
                    </div>
                  </>
                )}
                
                <div className="border-t border-dashed border-gray-400 mt-3 pt-4 text-center">
                  <p className="text-[10px] font-bold mb-3">Scan to visit our store!</p>
                  <div className="flex justify-center">
                    {user?.username ? (
                      <QRCodeSVG value={`${window.location.origin}/${user.username}`} size={64} level="L" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200" />
                    )}
                  </div>
                  <p className="text-[9px] mt-2 text-gray-500">Thank you for shopping with us.</p>
                  <p className="text-[9px] text-gray-500">{window.location.host}/{user?.username || ''}</p>
                </div>

              </div>
            </div>
            
            <div className="px-4 py-3 bg-white dark:bg-neutral-900 border-t border-gray-100 dark:border-neutral-800 flex gap-3 print-hidden shrink-0">
              <Button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-900 hover:bg-black text-white shadow-lg">
                <Printer size={18} /> Print Receipt
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Reusable Cart Content Component
const CartContent = ({ 
  cart, 
  cartTotal, 
  customerName, 
  setCustomerName, 
  amountPaid, 
  setAmountPaid, 
  updateQuantity, 
  removeFromCart, 
  handleCheckout, 
  submitting 
}: any) => (
  <>
    <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3 bg-white dark:bg-[#0A0A0A]">
      {cart.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center px-6">
          <div className="w-20 h-20 bg-gray-50 dark:bg-neutral-900 rounded-full flex items-center justify-center mb-4 border border-gray-100 dark:border-neutral-800">
            <ShoppingCart size={32} className="text-gray-300 dark:text-neutral-700" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Your cart is empty</h3>
          <p className="text-sm text-gray-500">Tap products from the left to add them to the current sale.</p>
        </div>
      ) : (
        cart.map((item: any) => (
          <div key={item.id} className="flex flex-col p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm hover:border-gray-200 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1 pr-3">
                <h4 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-2 leading-tight mb-1">{item.name}</h4>
                {item.variant_name && <p className="text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-neutral-800 inline-block px-2 py-0.5 rounded-md mb-1">{item.variant_name}</p>}
                <p className="text-brand-600 dark:text-brand-400 font-black text-sm mt-0.5">TSh {item.price.toLocaleString()}</p>
              </div>
              <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-xl transition-all">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-neutral-800/50">
              <div className="flex items-center gap-1 bg-gray-50 dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700 p-1">
                <button onClick={() => updateQuantity(item.id, -1)} disabled={item.quantity <= 1} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white dark:hover:bg-neutral-800 hover:shadow-sm disabled:opacity-30 transition-all"><Minus size={14}/></button>
                <span className="text-sm font-bold w-6 text-center dark:text-white">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, 1)} disabled={item.quantity >= item.max_stock} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white dark:hover:bg-neutral-800 hover:shadow-sm disabled:opacity-30 transition-all"><Plus size={14}/></button>
              </div>
              <span className="font-black text-gray-900 dark:text-white text-base tracking-tight">TSh {(item.price * item.quantity).toLocaleString()}</span>
            </div>
          </div>
        ))
      )}
    </div>

    <div className="p-5 border-t border-surface-border dark:border-surface-dark-border bg-gray-50/80 dark:bg-neutral-900/50 backdrop-blur-md shrink-0">
      <div className="space-y-4 mb-5">
        <div>
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Customer Details</label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Walk-in Customer"
            className="w-full p-3 text-sm font-medium border border-gray-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 dark:text-white mt-1.5 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-sm transition-all"
          />
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Amount Tendered</label>
          <div className="relative mt-1.5">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">TSh</span>
            <input
              type="number"
              placeholder={cartTotal.toLocaleString()}
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="w-full pl-12 pr-4 py-3 text-sm font-medium border border-gray-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-sm transition-all"
            />
          </div>
        </div>
      </div>
      
      <div className="flex justify-between items-end mb-5 p-4 bg-white dark:bg-neutral-900 rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm">
        <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Total Due</span>
        <span className="text-2xl font-black text-brand-600 dark:text-brand-400 leading-none tracking-tight">TSh {cartTotal.toLocaleString()}</span>
      </div>

      <Button 
        onClick={handleCheckout} 
        disabled={cart.length === 0 || submitting}
        className="w-full py-4 text-base font-black tracking-wide rounded-xl shadow-lg shadow-brand-500/20"
      >
        {submitting ? 'Processing...' : 'Complete Sale'}
      </Button>
    </div>
  </>
);

export default DashboardPOS;
