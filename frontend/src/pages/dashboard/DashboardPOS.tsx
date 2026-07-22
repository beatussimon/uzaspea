import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Search, ShoppingCart, Plus, Minus, Trash2, Printer, X } from 'lucide-react';
import SafeImage from '../../components/SafeImage';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';

interface Product {
  id: number;
  name: string;
  price: string;
  stock: number;
  images: any[];
  variants?: any[];
}

interface CartItem {
  id: string; // unique combo of product_id and variant_id
  product_id: number;
  variant_id: number | null;
  name: string;
  variant_name: string | null;
  price: number;
  quantity: number;
  max_stock: number;
}

const DashboardPOS: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [amountPaid, setAmountPaid] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  
  const printRef = useRef<HTMLDivElement>(null);

  const fetchProducts = () => {
    setLoading(true);
    const currentUser = localStorage.getItem('username');
    // Fetch a large number or implement infinite scroll. For POS, searching is better.
    api.get(`/api/products/?seller=${currentUser}&page=1`)
      .then(async (res) => {
        let prods = res.data.results || res.data;
        // Fetch variants for these products
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
    if (!searchQuery) return products;
    const lowerQ = searchQuery.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(lowerQ));
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
        amount_paid: amountPaid ? parseFloat(amountPaid) : cartTotal,
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
      fetchProducts(); // Refresh stock
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.response?.data?.detail || 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (printContent) {
      const originalContents = document.body.innerHTML;
      document.body.innerHTML = printContent.innerHTML;
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload(); // Reload to restore React bindings after print hack
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* Products Section */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#0A0A0A] rounded-xl border border-surface-border dark:border-surface-dark-border overflow-hidden">
        <div className="p-4 border-b border-surface-border dark:border-surface-dark-border">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight mb-4">Point of Sale</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search products by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg focus:outline-none focus:border-brand-500 dark:text-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner size="md" /></div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No products found.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <div key={product.id} className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden hover:shadow-md transition bg-white dark:bg-gray-900 flex flex-col">
                  <div className="aspect-square bg-gray-100 relative">
                    <SafeImage src={product.images?.[0]?.image || ''} alt={product.name} className="w-full h-full object-cover" />
                    {product.stock <= 0 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white font-bold px-3 py-1 bg-red-600 rounded-full text-xs">Out of Stock</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-2 mb-1">{product.name}</h3>
                    <p className="text-brand-600 dark:text-brand-400 font-bold text-sm mb-2">TSh {parseInt(product.price).toLocaleString()}</p>
                    <div className="mt-auto">
                      {product.variants && product.variants.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500 font-semibold uppercase">Select Option:</p>
                          <div className="flex flex-col gap-1.5">
                            {product.variants.map((v: any) => {
                              const vPrice = parseFloat(product.price) + parseFloat(v.price_adjustment);
                              return (
                                <button
                                  key={v.id}
                                  onClick={() => addToCart(product, v)}
                                  disabled={v.stock <= 0}
                                  className="text-left px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex justify-between items-center transition"
                                >
                                  <span className="truncate pr-2 dark:text-gray-300">{v.name}</span>
                                  <span className="font-bold text-brand-600 shrink-0">TSh {vPrice.toLocaleString()}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <Button 
                          onClick={() => addToCart(product)} 
                          disabled={product.stock <= 0}
                          className="w-full py-1.5 text-xs"
                          variant={product.stock <= 0 ? 'outline' : 'default'}
                        >
                          Add to Cart
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

      {/* Cart Section */}
      <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-[#0A0A0A] rounded-xl border border-surface-border dark:border-surface-dark-border overflow-hidden shrink-0">
        <div className="p-4 border-b border-surface-border dark:border-surface-dark-border bg-gray-50 dark:bg-neutral-900">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart size={20} /> Current Sale
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-gray-400 flex flex-col items-center">
              <ShoppingCart size={48} className="mb-4 opacity-20" />
              <p>Cart is empty</p>
              <p className="text-xs mt-2">Add items from the left to start a sale</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-neutral-900/50 rounded-xl border border-gray-100 dark:border-neutral-800">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1">{item.name}</h4>
                    {item.variant_name && <p className="text-xs text-gray-500">{item.variant_name}</p>}
                    <p className="text-brand-600 font-bold text-sm mt-1">TSh {item.price.toLocaleString()}</p>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 transition">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3 bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 px-2 py-1">
                    <button onClick={() => updateQuantity(item.id, -1)} disabled={item.quantity <= 1} className="text-gray-500 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"><Minus size={14}/></button>
                    <span className="text-sm font-bold w-6 text-center dark:text-white">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} disabled={item.quantity >= item.max_stock} className="text-gray-500 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"><Plus size={14}/></button>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white text-sm">TSh {(item.price * item.quantity).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-surface-border dark:border-surface-dark-border bg-gray-50 dark:bg-neutral-900">
          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Customer Name (Optional)</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full p-2 text-sm border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 dark:text-white mt-1 outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Amount Paid (Optional)</label>
              <input
                type="number"
                placeholder={`TSh ${cartTotal.toLocaleString()}`}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="w-full p-2 text-sm border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 dark:text-white mt-1 outline-none focus:border-brand-500"
              />
            </div>
          </div>
          
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-neutral-800">
            <span className="font-bold text-gray-600 dark:text-gray-400">Total</span>
            <span className="text-2xl font-black text-brand-600 dark:text-brand-400">TSh {cartTotal.toLocaleString()}</span>
          </div>

          <Button 
            onClick={handleCheckout} 
            disabled={cart.length === 0 || submitting}
            className="w-full py-3 text-lg"
          >
            {submitting ? 'Processing...' : 'Complete Sale'}
          </Button>
        </div>
      </div>

      {/* Receipt Modal */}
      {receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-fade-in-up">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="text-lg font-bold dark:text-white">Sale Successful</h2>
              <button onClick={() => setReceiptData(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div id="receipt-content" className="bg-white text-black p-4 text-sm font-mono border border-gray-200 rounded-lg shadow-inner">
                <div className="text-center mb-4">
                  <h3 className="font-bold text-lg">UZASPEA</h3>
                  <p className="text-xs text-gray-500">Receipt #{receiptData.id}</p>
                  <p className="text-xs text-gray-500">{new Date(receiptData.created_at).toLocaleString()}</p>
                </div>
                
                <div className="border-t border-b border-dashed border-gray-300 py-2 mb-4 space-y-2">
                  {receiptData?.orderitem_set?.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <div className="flex-1 pr-2">
                        <p>{item.quantity}x {item.product.name}</p>
                        {item.variant && <p className="text-xs text-gray-500 ml-4">{item.variant.name}</p>}
                      </div>
                      <span>{(parseFloat(item.price) * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span>TOTAL</span>
                  <span>TSh {parseFloat(receiptData?.total_amount || 0).toLocaleString()}</span>
                </div>
                
                <div className="flex justify-between text-xs mb-1">
                  <span>Customer</span>
                  <span>{receiptData?.delivery_info?.customer_name || 'Walk-in'}</span>
                </div>
                
                <div className="text-center mt-6 text-xs">
                  <p>Thank you for shopping with us!</p>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setReceiptData(null)}>Close</Button>
              <Button onClick={handlePrint} className="flex items-center gap-2">
                <Printer size={18} /> Print Receipt
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPOS;
