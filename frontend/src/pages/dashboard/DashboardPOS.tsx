import React, { useState, useEffect, useMemo, useRef } from 'react';
import {  } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { Search, ShoppingCart, Plus, Minus, Trash2, Printer, X, ChevronUp, History, Receipt, CalendarDays, User, Banknote, Tag, Percent } from 'lucide-react';
import SafeImage from '../../components/SafeImage';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { TableSkeleton, POSProductGridSkeleton } from '../../components/Skeleton';

interface Product {
  id: number;
  name: string;
  price: string;
  stock: number;
  images: any[];
  variants?: any[];
  requires_quote?: boolean;
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

  if (loading) return <TableSkeleton rows={5} cols={6} />;

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-surface-border dark:border-surface-dark-border bg-surface-muted/40 dark:bg-[#161616]/40 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Sales History</h2>
          <p className="text-2xs text-gray-500 dark:text-gray-400">View past walk-in customers and printed invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input 
              type="date" 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="input pl-8 py-1 text-xs"
            />
          </div>
          {dateFilter && (
            <Button variant="outline" size="sm" onClick={() => setDateFilter('')} className="text-xs">Clear</Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-surface-muted dark:bg-[#161616] text-2xs uppercase tracking-wider text-gray-400 font-bold border-b border-surface-border dark:border-surface-dark-border">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Invoice #</th>
              <th className="p-3">Customer</th>
              <th className="p-3 text-right">Total Sale</th>
              <th className="p-3 text-right">Cash Tendered</th>
              <th className="p-3 text-right">Change Given</th>
              <th className="p-3 text-center">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400 text-xs">
                  No sales found for the selected criteria.
                </td>
              </tr>
            ) : (
              filteredOrders.map(order => {
                const totalAmt = parseFloat(order.total_amount || 0);
                const tendered = parseFloat(order.delivery_info?.amount_tendered || order.delivery_info?.amount_paid || totalAmt);
                const change = parseFloat(order.delivery_info?.change_due || Math.max(0, tendered - totalAmt));

                return (
                  <tr key={order.id} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition">
                    <td className="p-3 text-gray-500 dark:text-gray-400">
                      {new Date(order.order_date).toLocaleDateString()} {new Date(order.order_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3 text-brand-600 dark:text-brand-400 font-bold">#{order.id}</td>
                    <td className="p-3 text-gray-700 dark:text-gray-300 font-medium">
                      {order.delivery_info?.customer_name || 'Walk-in Customer'}
                    </td>
                    <td className="p-3 text-right font-extrabold text-gray-900 dark:text-white">
                      <div>TSh {totalAmt.toLocaleString()}</div>
                      {parseFloat(order.discount_amount || order.delivery_info?.discount_amount || 0) > 0 && (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          -TSh {parseFloat(order.discount_amount || order.delivery_info?.discount_amount).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right font-semibold text-gray-700 dark:text-gray-300">
                      TSh {tendered.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {change > 0 ? `TSh ${change.toLocaleString()}` : '—'}
                    </td>
                    <td className="p-3 text-center">
                      <Button variant="outline" size="sm" onClick={() => onPrint(order)} className="text-2xs py-1 px-2.5 h-7 font-bold">
                        <Printer size={12} className="mr-1" /> View Receipt
                      </Button>
                    </td>
                  </tr>
                );
              })
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

  // Discount & Promo Code System State
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [customDiscount, setCustomDiscount] = useState<number>(0);
  const [availablePromos, setAvailablePromos] = useState<any[]>([]);
  
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
    
    // Fetch active promo codes belonging to the seller for fast 1-click POS selection
    const currentUser = localStorage.getItem('username');
    if (currentUser) {
      api.get(`/api/promo-codes/?seller=${currentUser}`)
        .then(res => {
          const list = res.data.results || res.data || [];
          setAvailablePromos(list.filter((p: any) => p.is_active));
        })
        .catch(() => {});
    }
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (searchQuery) {
        return p.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [products, searchQuery]);

  const addToCart = (product: Product, variant: any = null) => {
    const id = variant ? `${product.id}-${variant.id}` : `${product.id}-null`;
    const stock = variant ? variant.stock : product.stock;
    let price = variant ? parseFloat(product.price) + parseFloat(variant.price_adjustment) : parseFloat(product.price);
    
    if (stock <= 0) {
      toast.error('Out of stock!');
      return;
    }

    if (product.requires_quote) {
      const userPrice = window.prompt(`Enter agreed-upon price (TSh) for ${product.name}:`);
      if (userPrice === null || isNaN(parseFloat(userPrice)) || parseFloat(userPrice) < 0) {
        toast.error('Valid price is required for this product');
        return;
      }
      price = parseFloat(userPrice);
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

  // Discount calculation: Applied promo code takes precedence, otherwise custom discount
  const discountAmount = useMemo(() => {
    if (appliedPromo) {
      return Number(appliedPromo.discount_amount || 0);
    }
    if (customDiscount > 0) {
      return Math.min(cartTotal, customDiscount);
    }
    return 0;
  }, [appliedPromo, customDiscount, cartTotal]);

  const finalTotal = Math.max(0, cartTotal - discountAmount);

  // Silently re-evaluate applied promo code if cart items change
  useEffect(() => {
    if (!appliedPromo) return;
    if (cart.length === 0) {
      setAppliedPromo(null);
      return;
    }
    const currentUser = localStorage.getItem('username') || user?.username;
    const itemsPayload = cart.map(item => ({
      product_id: item.product_id,
      price: item.price,
      quantity: item.quantity
    }));
    api.post('/api/promo-codes/validate/', {
      code: appliedPromo.code,
      merchant: currentUser,
      subtotal: cartTotal,
      items: itemsPayload,
      is_pos: true,
    }).then(res => {
      setAppliedPromo(res.data);
    }).catch(() => {
      setAppliedPromo(null);
      toast.error(`Promo '${appliedPromo.code}' removed (requirements no longer met)`);
    });
  }, [cart, cartTotal]);

  const handleApplyPromo = async (codeOverride?: string) => {
    const codeToApply = (codeOverride || promoCode).trim();
    if (!codeToApply) {
      toast.error('Please enter a promo code');
      return;
    }
    if (cart.length === 0) {
      toast.error('Add items to cart first');
      return;
    }
    setValidatingPromo(true);
    try {
      const currentUser = localStorage.getItem('username') || user?.username;
      const itemsPayload = cart.map(item => ({
        product_id: item.product_id,
        price: item.price,
        quantity: item.quantity
      }));
      const res = await api.post('/api/promo-codes/validate/', {
        code: codeToApply,
        merchant: currentUser,
        subtotal: cartTotal,
        items: itemsPayload,
        is_pos: true,
      });
      setAppliedPromo(res.data);
      setPromoCode(res.data.code);
      setCustomDiscount(0);
      toast.success(`Promo code '${res.data.code}' applied! (-TSh ${Math.round(res.data.discount_amount).toLocaleString()})`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Invalid promo code');
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    toast.success('Promo code removed');
  };

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
        promo_code: appliedPromo ? appliedPromo.code : null,
        discount_amount: discountAmount,
        items: cart.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          price: item.price
        }))
      };

      const res = await api.post('/api/orders/pos-checkout/', payload);
      toast.success('Sale completed successfully!');
      setReceiptData(res.data);
      setCart([]);
      setAppliedPromo(null);
      setPromoCode('');
      setCustomDiscount(0);
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
    <div className="space-y-6 pb-24 lg:pb-0 relative">
      {/* Header & Tab Switcher */}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Point of Sale (POS)
            </h1>

          <div data-horizontal-scroll="true" className="flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0 overflow-x-auto scrollbar-none">
            <button 
              type="button"
              onClick={() => setActiveTab('sale')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'sale'
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                  : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
              }`}
            >
              <Receipt size={13} />
              <span>New Sale</span>
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                  : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
              }`}
            >
              <History size={13} />
              <span>Sales History</span>
            </button>
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Process walk-in customer sales, print physical receipts, and manage direct orders.
        </p>
      </header>

      {activeTab === 'sale' ? (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Products Section */}
          <div className="flex-1 w-full card overflow-hidden flex flex-col">
            {/* Search Header */}
            <div className="p-4 pb-2 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Store Catalog</h2>
                <p className="text-2xs text-gray-500 dark:text-gray-400">Click any product to add to the active register cart</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-muted/60 dark:bg-[#161616] border border-surface-border/60 dark:border-surface-dark-border/60 focus:border-brand-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition"
                />
              </div>
            </div>

            {/* Product Grid */}
            <div className="p-4 overflow-y-auto max-h-[calc(100vh-280px)]">
              {loading ? (
                <POSProductGridSkeleton count={8} />
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <ShoppingCart size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">No products found</p>
                  <p className="text-2xs text-gray-400 mt-0.5">Try searching for a different keyword.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                  {filteredProducts.map((product) => (
                    <div 
                      key={product.id} 
                      onClick={() => (!product.variants || product.variants.length === 0) && product.stock > 0 ? addToCart(product) : null}
                      className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-neutral-800 hover:bg-gray-100 dark:hover:bg-[#191919] hover:border-gray-300 dark:hover:border-neutral-700 transition flex flex-col justify-between group cursor-pointer shadow-2xs"
                    >
                      <div>
                        <div className="aspect-[4/3] rounded-lg bg-gray-200/50 dark:bg-[#1c1c1c] relative overflow-hidden mb-2">
                          <SafeImage src={product.images?.[0]?.image || ''} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          {product.stock <= 0 && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-10">
                              <span className="text-white font-medium uppercase px-2 py-0.5 bg-red-500 rounded-full text-3xs">Out of Stock</span>
                            </div>
                          )}
                          <div className="absolute top-1.5 right-1.5 bg-black/70 backdrop-blur-xs text-white px-2 py-0.5 rounded-full text-[10px] font-semibold">
                            {product.stock} left
                          </div>
                        </div>
                        
                        <h3 className="font-semibold text-gray-900 dark:text-white text-xs line-clamp-1 mb-0.5">{product.name}</h3>
                        <p className="text-brand-600 dark:text-brand-400 font-bold text-xs">TSh {parseInt(product.price).toLocaleString()}</p>
                      </div>
                      
                      <div className="mt-2.5">
                        {product.variants && product.variants.length > 0 ? (
                          <div className="space-y-1">
                            {product.variants.map((v: any) => (
                              <button
                                key={v.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCart(product, v);
                                }}
                                disabled={v.stock <= 0}
                                className="w-full text-left px-2 py-1 rounded-lg bg-white dark:bg-[#1c1c1c] border border-gray-200/80 dark:border-neutral-800 text-3xs font-medium hover:bg-gray-50 dark:hover:bg-[#222] disabled:opacity-40 flex justify-between items-center transition text-gray-700 dark:text-gray-300"
                              >
                                <span className="truncate pr-1">{v.name}</span>
                                <span className="font-semibold text-brand-600 dark:text-brand-400 shrink-0">+{parseFloat(v.price_adjustment).toLocaleString()}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(product);
                            }}
                            disabled={product.stock <= 0}
                            className="w-full py-1.5 px-2 rounded-lg bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 transition whitespace-nowrap active:scale-[0.98] shadow-xs"
                          >
                            <Plus size={13} className="shrink-0 text-black stroke-[2.5]" />
                            <span className="whitespace-nowrap text-black font-extrabold">Add to Cart</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Desktop Cart Sidebar */}
          <div className="hidden lg:flex w-[380px] card overflow-hidden flex-col shrink-0 sticky top-[80px]">
            <CartContent 
              cart={cart} 
              cartTotal={cartTotal}
              finalTotal={finalTotal}
              discountAmount={discountAmount}
              promoCode={promoCode}
              setPromoCode={setPromoCode}
              appliedPromo={appliedPromo}
              handleApplyPromo={handleApplyPromo}
              handleRemovePromo={handleRemovePromo}
              validatingPromo={validatingPromo}
              customDiscount={customDiscount}
              setCustomDiscount={setCustomDiscount}
              availablePromos={availablePromos}
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
            <div className="fixed bottom-16 inset-x-0 p-4 z-40 pointer-events-none">
              <div className="pointer-events-auto max-w-md mx-auto">
                <button 
                  onClick={() => setIsMobileCartOpen(true)}
                  className="w-full bg-gray-900 dark:bg-white text-white dark:text-black rounded-card shadow-2xl p-3.5 flex items-center justify-between active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <ShoppingCart size={20} />
                      {cart.length > 0 && (
                        <span className="absolute -top-2 -right-2 bg-brand-500 text-white text-3xs font-black rounded-full w-4 h-4 flex items-center justify-center border-2 border-gray-900 dark:border-white">
                          {cart.reduce((sum, item) => sum + item.quantity, 0)}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-xs">Current Register Sale</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="font-extrabold text-xs block">TSh {finalTotal.toLocaleString()}</span>
                      {discountAmount > 0 && (
                        <span className="text-[10px] text-gray-400 line-through block">TSh {cartTotal.toLocaleString()}</span>
                      )}
                    </div>
                    <ChevronUp size={16} className="opacity-60" />
                  </div>
                </button>
              </div>
            </div>

            {isMobileCartOpen && (
              <div className="fixed inset-0 z-50 flex flex-col justify-end">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs animate-fade-in" onClick={() => setIsMobileCartOpen(false)} />
                <div className="relative bg-white dark:bg-[#121212] w-full h-[85vh] rounded-t-card shadow-2xl flex flex-col animate-slide-up overflow-hidden border-t border-surface-border dark:border-surface-dark-border">
                  <div className="p-4 border-b border-surface-border dark:border-surface-dark-border flex justify-between items-center bg-surface-muted dark:bg-[#161616]">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <ShoppingCart size={16} className="text-brand-500" /> Current Sale
                    </h2>
                    <button onClick={() => setIsMobileCartOpen(false)} className="p-1 rounded-btn text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <CartContent 
                      cart={cart} 
                      cartTotal={cartTotal}
                      finalTotal={finalTotal}
                      discountAmount={discountAmount}
                      promoCode={promoCode}
                      setPromoCode={setPromoCode}
                      appliedPromo={appliedPromo}
                      handleApplyPromo={handleApplyPromo}
                      handleRemovePromo={handleRemovePromo}
                      validatingPromo={validatingPromo}
                      customDiscount={customDiscount}
                      setCustomDiscount={setCustomDiscount}
                      availablePromos={availablePromos}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 print:p-0 print:bg-white print:block">
          <div className="bg-white dark:bg-[#121212] w-full max-w-sm rounded-card shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh] border border-surface-border dark:border-surface-dark-border print:shadow-none print:rounded-none print:max-h-none print:h-auto print:max-w-none">
            
            <div className="bg-brand-500 p-3.5 text-center text-white relative shrink-0 print-hidden">
              <h2 className="text-sm font-black">Invoice #{receiptData.id}</h2>
              <button onClick={() => setReceiptData(null)} className="absolute top-2.5 right-2.5 text-white/80 hover:text-white bg-black/20 p-1 rounded-full backdrop-blur-xs transition">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto bg-surface-muted/50 dark:bg-[#161616]/50 flex-1 flex justify-center print:bg-white print:p-0 print:overflow-visible">
              
              {/* Actual Thermal Receipt Container */}
              <div 
                id="receipt-content" 
                className="bg-white text-black p-4 w-[80mm] min-w-[80mm] max-w-[80mm] min-h-max mx-auto shadow-xs relative" 
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
                <div className="text-center mb-3">
                  <img src="/logo_dark.png" alt="Sokonimax" className="w-24 mx-auto grayscale object-contain mb-1.5" style={{ maxWidth: '96px', maxHeight: '42px' }} />
                  <p className="text-[10px] text-gray-500">Premium Quality Products</p>
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
                
                {(() => {
                  const discountVal = parseFloat(receiptData?.discount_amount || receiptData?.delivery_info?.discount_amount || 0);
                  const promoCodeName = receiptData?.promo_code_code || receiptData?.promo_code || receiptData?.delivery_info?.promo_code;
                  if (discountVal > 0) {
                    const rawTot = parseFloat(receiptData?.total_amount || 0);
                    const subtotalVal = rawTot + discountVal;
                    return (
                      <>
                        <div className="text-xs flex justify-between text-gray-600 mb-1">
                          <span>SUBTOTAL</span>
                          <span>{Math.round(subtotalVal).toLocaleString()}/=</span>
                        </div>
                        <div className="text-xs flex justify-between text-gray-600 mb-1">
                          <span>DISCOUNT {promoCodeName ? `(${promoCodeName})` : ''}</span>
                          <span>-{Math.round(discountVal).toLocaleString()}/=</span>
                        </div>
                      </>
                    );
                  }
                  return null;
                })()}

                <div className="text-sm font-black flex justify-between mb-1">
                  <span>TOTAL TSH</span>
                  <span>{(() => {
                    const rawTot = parseFloat(receiptData?.total_amount || 0);
                    return Math.round(isNaN(rawTot) ? 0 : rawTot).toLocaleString() + '/=';
                  })()}</span>
                </div>
                
                {(receiptData?.delivery_info?.amount_tendered || receiptData?.delivery_info?.amount_paid) && (
                  <>
                    <div className="text-xs flex justify-between text-gray-600 mb-1">
                      <span>CASH TENDERED</span>
                      <span>{(() => {
                        const rawPaid = parseFloat(receiptData.delivery_info.amount_tendered || receiptData.delivery_info.amount_paid);
                        return Math.round(isNaN(rawPaid) ? 0 : rawPaid).toLocaleString() + '/=';
                      })()}</span>
                    </div>
                    <div className="text-xs flex justify-between text-gray-600">
                      <span>CHANGE</span>
                      <span>{(() => {
                        const rawPaid = parseFloat(receiptData.delivery_info.amount_tendered || receiptData.delivery_info.amount_paid || 0);
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
            
            <div className="p-3 bg-surface-muted dark:bg-[#161616] border-t border-surface-border dark:border-surface-dark-border flex gap-2 print-hidden shrink-0">
              <Button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold">
                <Printer size={14} /> Print Receipt
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
  finalTotal,
  discountAmount = 0,
  promoCode = '',
  setPromoCode,
  appliedPromo,
  handleApplyPromo,
  handleRemovePromo,
  validatingPromo = false,
  customDiscount = 0,
  setCustomDiscount,
  availablePromos = [],
  customerName, 
  setCustomerName, 
  amountPaid, 
  setAmountPaid, 
  updateQuantity, 
  removeFromCart, 
  handleCheckout, 
  submitting 
}: any) => {
  const [showCustomDiscount, setShowCustomDiscount] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const tenderVal = parseFloat(amountPaid || '0');
  const effectiveTotal = typeof finalTotal === 'number' ? finalTotal : Math.max(0, cartTotal - (discountAmount || 0));
  const changeDue = Math.max(0, tenderVal - effectiveTotal);

  return (
    <div className="flex flex-col h-full">
      {/* 1. Slim Integrated Customer & Status Header */}
      <div className="px-4 py-3.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <User size={15} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Walk-in Customer"
            className="bg-transparent border-none text-xs font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-0 w-full p-0 leading-tight outline-none"
            title="Customer Name"
          />
          {customerName && customerName !== 'Walk-in Customer' && (
            <button
              type="button"
              onClick={() => setCustomerName('Walk-in Customer')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xs font-bold shrink-0 p-0.5 rounded transition"
              title="Reset to Walk-in"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-400 shrink-0 whitespace-nowrap px-2">
          {cart.reduce((s: number, i: any) => s + i.quantity, 0)} {cart.reduce((s: number, i: any) => s + i.quantity, 0) === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* 2. Seamless Register Items List (Clean vertical rhythm, NO divider lines) */}
      <div className="flex-1 overflow-y-auto space-y-1 px-3">
        {cart.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center px-4">
            <div className="w-10 h-10 bg-surface-muted/60 dark:bg-[#161616] rounded-full flex items-center justify-center mb-2">
              <ShoppingCart size={18} className="text-gray-400 opacity-60" />
            </div>
            <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300">Register is empty</h3>
            <p className="text-3xs text-gray-400 mt-0.5">Click products in the catalog to add</p>
          </div>
        ) : (
          cart.map((item: any) => (
            <div key={item.id} className="py-2 px-1.5 rounded-lg hover:bg-surface-muted/40 dark:hover:bg-[#161616] flex items-center justify-between gap-2 group transition">
              <div className="flex-1 min-w-0 pr-1">
                <p className="font-bold text-xs text-gray-900 dark:text-white truncate">{item.name}</p>
                {item.variant_name && <span className="text-[10px] text-gray-400 block">{item.variant_name}</span>}
                <span className="text-2xs text-gray-500 dark:text-gray-400">
                  TSh {item.price.toLocaleString()}
                </span>
              </div>

              {/* Sleek inline quantity stepper */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center bg-surface-muted/70 dark:bg-[#181818] rounded-lg p-0.5">
                  <button 
                    type="button"
                    onClick={() => updateQuantity(item.id, -1)} 
                    disabled={item.quantity <= 1} 
                    className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 transition"
                  >
                    <Minus size={10} />
                  </button>
                  <span className="text-xs font-bold w-5 text-center text-gray-900 dark:text-white select-none">
                    {item.quantity}
                  </span>
                  <button 
                    type="button"
                    onClick={() => updateQuantity(item.id, 1)} 
                    disabled={item.quantity >= item.max_stock} 
                    className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 transition"
                  >
                    <Plus size={10} />
                  </button>
                </div>

                <span className="font-extrabold text-xs text-gray-900 dark:text-white w-20 text-right">
                  TSh {(item.price * item.quantity).toLocaleString()}
                </span>

                <button 
                  type="button"
                  onClick={() => removeFromCart(item.id)} 
                  className="text-gray-300 hover:text-red-500 dark:text-neutral-600 dark:hover:text-red-400 p-1 transition opacity-0 group-hover:opacity-100"
                  title="Remove"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Discount / Promo Code System Section */}
      <div className="px-4 py-2.5 bg-gray-50/70 dark:bg-[#121212] border-t border-b border-surface-border/50 dark:border-neutral-800/80 shrink-0">
        {appliedPromo || customDiscount > 0 ? (
          <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <Tag size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-bold text-emerald-800 dark:text-emerald-300 truncate">
                {appliedPromo ? appliedPromo.code : 'Manual Discount'}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-2xs shrink-0">
                (-TSh {discountAmount.toLocaleString()})
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (appliedPromo) {
                  handleRemovePromo();
                } else if (setCustomDiscount) {
                  setCustomDiscount(0);
                  setCustomInput('');
                }
              }}
              className="text-emerald-600 hover:text-red-500 dark:text-emerald-400 dark:hover:text-red-400 p-0.5 rounded transition shrink-0 ml-1 cursor-pointer"
              title="Remove discount"
            >
              <X size={13} />
            </button>
          </div>
        ) : showCustomDiscount ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Percent size={10} /> Custom Discount (TSh)
              </span>
              <button
                type="button"
                onClick={() => setShowCustomDiscount(false)}
                className="text-3xs font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                Use Promo Code
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">TSh</span>
                <input
                  type="number"
                  placeholder="Discount amount..."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = parseFloat(customInput || '0');
                      if (val > 0 && setCustomDiscount) {
                        setCustomDiscount(val);
                      }
                    }
                  }}
                  className="w-full bg-white dark:bg-[#161616] border border-gray-200 dark:border-neutral-800 rounded-lg pl-9 pr-2 py-1 text-xs font-bold text-gray-900 dark:text-white placeholder:text-gray-400 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(customInput || '0');
                  if (val > 0 && setCustomDiscount) {
                    setCustomDiscount(val);
                  }
                }}
                disabled={!customInput || parseFloat(customInput) <= 0}
                className="px-2.5 py-1 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-bold hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-40 transition shrink-0 cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Tag size={10} /> Promo Code / Discount
              </span>
              <button
                type="button"
                onClick={() => setShowCustomDiscount(true)}
                className="text-3xs font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
              >
                + Manual TSh
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Tag size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter promo code..."
                  value={promoCode}
                  onChange={(e) => setPromoCode && setPromoCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyPromo && handleApplyPromo();
                    }
                  }}
                  className="w-full bg-white dark:bg-[#161616] border border-gray-200 dark:border-neutral-800 rounded-lg pl-7 pr-2 py-1 text-xs font-bold text-gray-900 dark:text-white placeholder:text-gray-400 outline-none uppercase"
                />
              </div>
              <button
                type="button"
                onClick={() => handleApplyPromo && handleApplyPromo()}
                disabled={validatingPromo || !promoCode.trim()}
                className="px-2.5 py-1 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-bold hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-40 transition shrink-0 cursor-pointer"
              >
                {validatingPromo ? '...' : 'Apply'}
              </button>
            </div>

            {/* Quick Active Store Promo Chips */}
            {availablePromos && availablePromos.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
                <span className="text-[10px] text-gray-400 shrink-0 font-medium">Store codes:</span>
                {availablePromos.slice(0, 3).map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPromo && handleApplyPromo(p.code)}
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-neutral-800 hover:border-brand-500 text-gray-700 dark:text-gray-300 shrink-0 transition cursor-pointer"
                  >
                    {p.code} ({p.discount_type === 'percentage' ? `${p.value}%` : `TSh ${parseInt(p.value).toLocaleString()}`})
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Compact Checkout Footer with Quick Tender & Change */}
      <div className="p-4 shrink-0 space-y-3">
        {/* Total Breakdown */}
        <div className="space-y-1">
          {discountAmount > 0 && (
            <>
              <div className="flex justify-between items-baseline text-xs text-gray-500 dark:text-gray-400">
                <span>Subtotal</span>
                <span className="font-semibold">TSh {cartTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-baseline text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <span>Discount {appliedPromo ? `(${appliedPromo.code})` : ''}</span>
                <span>- TSh {discountAmount.toLocaleString()}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-baseline pt-0.5">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Due</span>
            <span className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
              TSh {effectiveTotal.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Quick Cash Tender Input & Shortcuts */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-2xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Banknote size={12} />
              <span>Cash Tendered</span>
            </label>
            {tenderVal > 0 && (
              <span className={`text-2xs font-bold ${tenderVal >= effectiveTotal ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                {tenderVal >= effectiveTotal 
                  ? `Change: TSh ${changeDue.toLocaleString()}` 
                  : `Remaining: TSh ${(effectiveTotal - tenderVal).toLocaleString()}`
                }
              </span>
            )}
          </div>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-xs">TSh</span>
            <input
              type="number"
              placeholder={effectiveTotal > 0 ? String(effectiveTotal) : '0'}
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="w-full bg-surface-muted/60 dark:bg-[#161616] rounded-xl pl-10 pr-3 py-2 text-xs font-bold text-gray-900 dark:text-white placeholder:text-gray-500 outline-none border-none focus:ring-0 transition"
            />
          </div>

          {/* Quick Tender Shortcuts */}
          {effectiveTotal > 0 && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => setAmountPaid(String(effectiveTotal))}
                className="flex-1 py-1 text-3xs font-bold rounded-lg bg-surface-muted/60 dark:bg-[#181818] hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 transition"
              >
                Exact
              </button>
              <button
                type="button"
                onClick={() => setAmountPaid(String(Math.ceil(effectiveTotal / 10000) * 10000))}
                className="flex-1 py-1 text-3xs font-bold rounded-lg bg-surface-muted/60 dark:bg-[#181818] hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 transition"
              >
                +Round 10k
              </button>
              <button
                type="button"
                onClick={() => setAmountPaid(String(Math.ceil((effectiveTotal + 1) / 50000) * 50000))}
                className="flex-1 py-1 text-3xs font-bold rounded-lg bg-surface-muted/60 dark:bg-[#181818] hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 transition"
              >
                +Round 50k
              </button>
              {amountPaid && (
                <button
                  type="button"
                  onClick={() => setAmountPaid('')}
                  className="px-2 py-1 text-3xs font-bold rounded-lg text-gray-400 hover:text-red-500 transition"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Complete Sale Action Button */}
        <button 
          type="button"
          onClick={handleCheckout} 
          disabled={cart.length === 0 || submitting}
          className="w-full py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] shadow-sm cursor-pointer disabled:cursor-not-allowed"
        >
          <Receipt size={14} className="shrink-0 text-black stroke-[2.5]" />
          <span className="text-black font-extrabold">{submitting ? 'Processing...' : 'Complete Sale'}</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardPOS;
