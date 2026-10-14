import React, { useState, useEffect, useMemo, useRef } from 'react';
import {  } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Search, ShoppingCart, Plus, Minus, Trash2, Printer, X, ChevronUp, ChevronDown, History, Receipt, CalendarDays, Banknote, Tag } from 'lucide-react';
import SafeImage from '../../components/SafeImage';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { TableSkeleton, POSProductGridSkeleton } from '../../components/Skeleton';
import { getVariantDimensions, isColorValue } from '../../utils/variantUtils';

interface Product {
  id: number;
  name: string;
  price: string;
  stock: number;
  images: any[];
  variants?: any[];
  requires_quote?: boolean;
  category_name?: string;
  category_slug?: string;
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
  const { t } = useTranslation();
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
        toast.error(t('failed_to_load_pos_history', 'Failed to load POS history'));
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
    <div className="card overflow-hidden !border-none !rounded-none">
      <div className="p-4 border-b border-surface-border dark:border-surface-dark-border bg-surface-muted/40 dark:bg-[#161616]/40 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t('sales_history', 'Sales History')}</h2>
          <p className="text-2xs text-gray-500 dark:text-gray-400">{t('sales_history_desc', 'View past walk-in customers and printed invoices')}</p>
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
            <Button variant="outline" size="sm" onClick={() => setDateFilter('')} className="text-xs">{t('clear', 'Clear')}</Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-2xs uppercase tracking-wider text-gray-600 dark:text-gray-300 font-bold border-b border-surface-border dark:border-surface-dark-border">
            <tr>
              <th className="p-3">{t('date', 'Date')}</th>
              <th className="p-3">{t('invoice_number', 'Invoice #')}</th>
              <th className="p-3">{t('customer', 'Customer')}</th>
              <th className="p-3 text-right">{t('total_sale', 'Total Sale')}</th>
              <th className="p-3 text-right">{t('cash_tendered', 'Cash Tendered')}</th>
              <th className="p-3 text-right">{t('change_given', 'Change Given')}</th>
              <th className="p-3 text-center">{t('receipt', 'Receipt')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400 text-xs">
                  {t('no_sales_found', 'No sales found for the selected criteria.')}
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
                    <td className="p-3 text-gray-900 dark:text-white font-bold">#{order.id}</td>
                    <td className="p-3 text-gray-700 dark:text-gray-300 font-medium">
                      {order.delivery_info?.customer_name || t('walk_in_customer', 'Walk-in Customer')}
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
                        <Printer size={12} className="mr-1" /> {t('view_receipt', 'View Receipt')}
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

// Interactive Quantity Input Component allowing instant inline editing of quantity
const CartQuantityInput: React.FC<{
  quantity: number;
  maxStock: number;
  onChangeQty: (newQty: number) => void;
  className?: string;
}> = ({ quantity, maxStock, onChangeQty, className }) => {
  const [val, setVal] = useState<string>(String(quantity));

  useEffect(() => {
    setVal(String(quantity));
  }, [quantity]);

  const commit = (inputVal: string) => {
    const parsed = parseInt(inputVal, 10);
    if (isNaN(parsed) || parsed < 1) {
      setVal('1');
      onChangeQty(1);
    } else if (parsed > maxStock) {
      toast.error(`Max stock available: ${maxStock}`);
      setVal(String(maxStock));
      onChangeQty(maxStock);
    } else {
      setVal(String(parsed));
      onChangeQty(parsed);
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={val}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const clean = e.target.value.replace(/[^0-9]/g, '');
        setVal(clean);
        const parsed = parseInt(clean, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= maxStock) {
          onChangeQty(parsed);
        }
      }}
      onBlur={() => commit(val)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit(val);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={
        className ||
        "w-6 sm:w-7 text-xs font-semibold text-center bg-transparent border-none outline-none text-gray-900 dark:text-white tabular-nums p-0 focus:ring-1 focus:ring-brand-500/60 rounded cursor-text"
      }
      title="Click to edit quantity"
    />
  );
};

interface POSVariantMatrixOverlayProps {
  product: Product;
  cart: CartItem[];
  addToCart: (product: any, variant?: any) => void;
  onClose: () => void;
  t: (key: string, defaultText: string) => string;
}

// In-card options matrix selector: pick Color, Size, Specs with clean Add action
const POSVariantMatrixOverlay: React.FC<POSVariantMatrixOverlayProps> = ({
  product,
  cart,
  addToCart,
  onClose,
  t,
}) => {
  const variants = product.variants || [];

  // Extract dimensions (e.g. Color, Size, Spec)
  const dimensions = useMemo(() => {
    const rawDims = getVariantDimensions(variants, product.category_slug, product.category_name, t);
    if (rawDims.length > 0) return rawDims;

    // Fallback if variants exist without slash notation
    const vals: string[] = [];
    variants.forEach((v: any) => {
      if (v.name && !vals.includes(v.name)) vals.push(v.name);
    });
    if (vals.length > 0) {
      return [{
        index: 0,
        label: t('option', 'Option'),
        values: vals,
        isVisual: false,
      }];
    }
    return [];
  }, [variants, product.category_slug, product.category_name, t]);

  // Selected option values per dimension index
  const [selectedOptions, setSelectedOptions] = useState<Record<number, string>>(() => {
    const inCartVariant = variants.find(v => cart.some(ci => ci.id === `${product.id}-${v.id}`));
    const inStockVariant = variants.find(v => parseFloat(String(v.stock || 0)) > 0);
    const initialVariant = inCartVariant || inStockVariant || variants[0];

    if (!initialVariant) return {};
    const parts = (initialVariant.name || '').split('/').map((p: string) => p.trim());
    const initial: Record<number, string> = {};
    dimensions.forEach((dim, idx) => {
      initial[idx] = parts[idx] || dim.values[0] || '';
    });
    return initial;
  });

  // Resolve currently active variant based on selected options
  const selectedVariant = useMemo(() => {
    if (variants.length === 0) return null;

    // 1. Exact match across all dimensions
    const exact = variants.find((v: any) => {
      const parts = (v.name || '').split('/').map((p: string) => p.trim());
      return dimensions.every((_dim, idx) => {
        const target = selectedOptions[idx];
        return target && parts[idx]?.toLowerCase() === target.toLowerCase();
      });
    });
    if (exact) return exact;

    // 2. Closest partial match
    let best = variants[0];
    let bestScore = -1;
    for (const v of variants) {
      const parts = (v.name || '').split('/').map((p: string) => p.trim());
      let score = 0;
      dimensions.forEach((_dim, idx) => {
        if (parts[idx]?.toLowerCase() === selectedOptions[idx]?.toLowerCase()) {
          score += 2;
        }
      });
      if (parseFloat(String(v.stock || 0)) > 0) score += 1;
      if (score > bestScore) {
        bestScore = score;
        best = v;
      }
    }
    return best;
  }, [variants, dimensions, selectedOptions]);

  // Handle clicking an option chip on a dimension
  const handleSelectOption = (dimIdx: number, val: string) => {
    let match = variants.find((v: any) => {
      const parts = (v.name || '').split('/').map((p: string) => p.trim());
      return dimensions.every((_dim, idx) => {
        const targetVal = idx === dimIdx ? val : selectedOptions[idx];
        return targetVal && parts[idx]?.toLowerCase() === targetVal.toLowerCase();
      });
    });

    if (!match) {
      const candidates = variants.filter((v: any) => {
        const parts = (v.name || '').split('/').map((p: string) => p.trim());
        return parts[dimIdx]?.toLowerCase() === val.toLowerCase();
      });

      if (candidates.length > 0) {
        let bestCandidate = candidates[0];
        let bestScore = -1;
        for (const c of candidates) {
          const parts = (c.name || '').split('/').map((p: string) => p.trim());
          let score = 0;
          dimensions.forEach((_dim, idx) => {
            if (idx !== dimIdx && parts[idx]?.toLowerCase() === selectedOptions[idx]?.toLowerCase()) {
              score += 2;
            }
          });
          if (parseFloat(String(c.stock || 0)) > 0) score += 1;
          if (score > bestScore) {
            bestScore = score;
            bestCandidate = c;
          }
        }
        match = bestCandidate;
      }
    }

    if (match) {
      const parts = (match.name || '').split('/').map((p: string) => p.trim());
      const nextOptions: Record<number, string> = {};
      dimensions.forEach((_dim, idx) => {
        nextOptions[idx] = parts[idx] || (idx === dimIdx ? val : selectedOptions[idx] || '');
      });
      setSelectedOptions(nextOptions);
    } else {
      setSelectedOptions(prev => ({ ...prev, [dimIdx]: val }));
    }
  };

  // Check if an option value has stock across variants
  const isOptionInStock = (dimIdx: number, val: string) => {
    return variants.some((v: any) => {
      const parts = (v.name || '').split('/').map((p: string) => p.trim());
      return parts[dimIdx]?.toLowerCase() === val.toLowerCase() && parseFloat(String(v.stock || 0)) > 0;
    });
  };

  // Clean, concise label for each dimension
  const getDimensionLabel = (dim: any) => {
    const vals = dim.values || [];
    if (vals.some((v: string) => isColorValue(v))) return t('color', 'Color');
    if (vals.some((v: string) => /^(xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|small|medium|large)$/i.test(v.trim()))) return t('size', 'Size');
    if (vals.some((v: string) => /\b(cm|mm|in|inch|inches)\b/i.test(v))) return t('dimensions', 'Length / Spec');
    if (vals.some((v: string) => /^\d{1,4}\s*(gb|tb|mb)/i.test(v))) return t('storage', 'Storage');
    if (dimensions.length === 1) return t('options', 'Options');
    return dim.label || t('option', 'Option');
  };

  // Stock data for the resolved variant
  const vStock = parseFloat(String(selectedVariant?.stock || 0));

  return (
    <div 
      className="absolute inset-0 z-30 bg-neutral-950/95 dark:bg-black/95 backdrop-blur-md p-2.5 rounded-2xl flex flex-col animate-fade-in pointer-events-auto cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-white/10 shrink-0">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white truncate leading-tight">{product.name}</p>
          <span className="text-3xs text-neutral-400 block truncate">
            {variants.length} {t('variations', 'variations')}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
          title={t('close', 'Close')}
        >
          <X size={12} />
        </button>
      </div>

      {/* Options Matrix (Rows of chips per dimension) */}
      <div className="flex-1 overflow-y-auto space-y-2 py-1.5 pr-0.5 scrollbar-thin">
        {dimensions.map((dim) => (
          <div key={dim.index} className="space-y-1">
            <div className="flex items-center justify-between text-3xs text-neutral-400">
              <span className="uppercase tracking-wider font-semibold text-[9px]">{getDimensionLabel(dim)}</span>
              <span className="text-neutral-200 font-semibold truncate max-w-[120px]">{selectedOptions[dim.index] || '—'}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {dim.values.map((val: string) => {
                const isSelected = selectedOptions[dim.index]?.toLowerCase() === val.toLowerCase();
                const inStock = isOptionInStock(dim.index, val);

                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSelectOption(dim.index, val)}
                    className={`px-2 py-0.5 rounded-lg text-2xs transition cursor-pointer ${
                      isSelected
                        ? 'bg-white text-neutral-950 font-bold shadow-xs border border-white'
                        : inStock
                          ? 'bg-white/[0.08] hover:bg-white/[0.15] text-neutral-200 hover:text-white border border-white/10'
                          : 'bg-white/[0.02] text-neutral-500 border border-white/5 line-through opacity-40'
                    }`}
                    title={`${val}${!inStock ? ` (${t('out_of_stock', 'Out of stock')})` : ''}`}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer (Stock / In-sale status & Add button) */}
      <div className="pt-2 border-t border-white/10 flex justify-between items-center shrink-0 mt-auto">
        <div className="min-w-0 flex-1 pr-2 text-3xs text-neutral-400 tabular-nums font-medium truncate">
          <span>{vStock > 0 ? `${vStock} left` : t('out_of_stock', 'Out of stock')}</span>
          {cart.filter(ci => ci.product_id === product.id).reduce((s, ci) => s + ci.quantity, 0) > 0 && (
            <span className="text-neutral-500">
              {' '}• {cart.filter(ci => ci.product_id === product.id).reduce((s, ci) => s + ci.quantity, 0)} {t('in_sale', 'in sale')}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (selectedVariant && vStock > 0) {
              addToCart(product, selectedVariant);
              onClose();
            }
          }}
          disabled={!selectedVariant || vStock <= 0}
          className="px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-2xs font-medium border border-white/10 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        >
          {vStock <= 0 ? t('out_of_stock', 'Out of stock') : t('add', 'Add')}
        </button>
      </div>
    </div>
  );
};

const DashboardPOS: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'sale' | 'history'>('sale');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState(t('walk_in_customer', 'Walk-in Customer'));
  const [amountPaid, setAmountPaid] = useState('');

  // Discount & Promo Code System State
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [customDiscount, setCustomDiscount] = useState<number>(0);
  
  const [submitting, setSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [activeVariantCardId, setActiveVariantCardId] = useState<number | null>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const receiptScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (receiptData && receiptScrollRef.current) {
      receiptScrollRef.current.scrollTop = 0;
    }
  }, [receiptData]);

  const fetchProducts = () => {
    setLoading(true);
    const currentUser = localStorage.getItem('username');
    const endpoint = currentUser
      ? `/api/products/?seller=${encodeURIComponent(currentUser)}&page=1&page_size=100`
      : `/api/products/?mine=true&page=1&page_size=100`;

    api.get(endpoint)
      .then((res) => {
        let prods = res.data.results || res.data;
        if (Array.isArray(prods)) {
          prods = prods.map((p: any) => ({
            ...p,
            variants: Array.isArray(p.variants)
              ? p.variants.filter((v: any) => v.is_available !== false)
              : []
          }));
          setProducts(prods);
        }
      })
      .catch(() => toast.error(t('failed_to_load_products', 'Failed to load products')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeVariantCardId !== null) {
        setActiveVariantCardId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeVariantCardId]);

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
    let price = variant 
      ? (variant.final_price != null ? parseFloat(variant.final_price) : parseFloat(product.price) + parseFloat(variant.price_adjustment || 0))
      : parseFloat(product.price);
    
    if (stock <= 0) {
      toast.error(t('out_of_stock', 'Out of stock!'));
      return;
    }

    if (product.requires_quote) {
      const userPrice = window.prompt(t('pos_enter_price_prompt', 'Enter agreed-upon price (TSh) for {{name}}:', { name: product.name }));
      if (userPrice === null || isNaN(parseFloat(userPrice)) || parseFloat(userPrice) < 0) {
        toast.error(t('valid_price_required', 'Valid price is required for this product'));
        return;
      }
      price = parseFloat(userPrice);
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === id);
      if (existing) {
        if (existing.quantity >= stock) {
          toast.error(t('max_stock_reached', 'Maximum stock reached!'));
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
    
    toast.success(t('pos_added_to_sale', 'Added to sale'), { duration: 1500, icon: '🛍️' });
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

  const setQuantity = (id: string, newQty: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const clamped = Math.max(1, Math.min(item.max_stock, Math.floor(newQty)));
        return { ...item, quantity: clamped };
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
      toast.error(t('promo_removed_requirements', "Promo '{{code}}' removed (requirements no longer met)", { code: appliedPromo.code }));
    });
  }, [cart, cartTotal]);

  const handleApplyPromo = async (codeOverride?: string): Promise<boolean> => {
    const codeToApply = (codeOverride || promoCode).trim();
    if (!codeToApply) {
      toast.error(t('enter_promo_code', 'Please enter a promo code'));
      return false;
    }
    if (cart.length === 0) {
      toast.error(t('add_items_first', 'Add items to cart first'));
      return false;
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
      toast.success(t('promo_code_applied', "Promo code '{{code}}' applied! (-TSh {{amount}})", { code: res.data.code, amount: Math.round(res.data.discount_amount).toLocaleString() }));
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || t('invalid_promo_code', 'Invalid promo code'));
      return false;
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    toast.success(t('promo_removed', 'Promo code removed'));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error(t('pos_cart_empty', 'Cart is empty!'));
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
      toast.success(t('pos_sale_completed', 'Sale completed successfully!'));
      setReceiptData(res.data);
      setCart([]);
      setAppliedPromo(null);
      setPromoCode('');
      setCustomDiscount(0);
      setCustomerName(t('walk_in_customer', 'Walk-in Customer'));
      setAmountPaid('');
      setIsMobileCartOpen(false);
      fetchProducts(); // Refresh stock
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.response?.data?.detail || t('pos_checkout_failed', 'Checkout failed'));
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
            {t('point_of_sale', 'Point of Sale (POS)')}
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
              <span>{t('new_sale', 'New Sale')}</span>
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
              <span>{t('sales_history', 'Sales History')}</span>
            </button>
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {t('pos_subtitle', 'Process walk-in customer sales, print physical receipts, and manage direct orders.')}
        </p>
      </header>

      {activeTab === 'sale' ? (
        <div className="flex flex-col lg:flex-row gap-6 lg:items-stretch items-start lg:h-[calc(100vh-210px)] lg:min-h-[580px]">
          {/* Products Section */}
          <div className="flex-1 w-full card overflow-hidden flex flex-col h-full">
            {/* Search Header */}
            <div className="p-4 pb-2 flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t('store_catalog', 'Store Catalog')}</h2>
                <p className="text-2xs text-gray-500 dark:text-gray-400">{t('store_catalog_desc', 'Click any product to add to the active register cart')}</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder={t('search_products', 'Search products...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-muted/60 dark:bg-[#161616] border border-surface-border/60 dark:border-surface-dark-border/60 focus:border-brand-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition"
                />
              </div>
            </div>

            {/* Product Grid */}
            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              {loading ? (
                <POSProductGridSkeleton count={8} />
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <ShoppingCart size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('no_products_found', 'No products found')}</p>
                  <p className="text-2xs text-gray-400 mt-0.5">{t('try_different_keyword', 'Try searching for a different keyword.')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                  {filteredProducts.map((product) => {
                    const stockNum = parseFloat(String(product.stock || 0));
                    const hasVariants = Boolean(product.variants && product.variants.length > 0);
                    const isVariantOpen = activeVariantCardId === product.id;
                    const effectiveStock = hasVariants
                      ? product.variants!.reduce((sum: number, v: any) => sum + parseFloat(String(v.stock || 0)), 0)
                      : stockNum;

                    return (
                      <div 
                        key={product.id} 
                        onClick={() => {
                          if (hasVariants) {
                            setActiveVariantCardId(prev => prev === product.id ? null : product.id);
                          } else if (effectiveStock > 0) {
                            addToCart(product);
                          }
                        }}
                        className={`group relative rounded-2xl overflow-hidden cursor-pointer border bg-gray-100 dark:bg-[#141414] transition-all flex flex-col aspect-[3/4] select-none ${
                          isVariantOpen
                            ? 'border-neutral-700 shadow-xl ring-1 ring-white/10'
                            : 'border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-600 hover:shadow-card-hover'
                        }`}
                      >
                        {/* Image covering entire card - clearly visible, no dark fade */}
                        <div className="absolute inset-0 w-full h-full overflow-hidden bg-gray-100 dark:bg-[#161616]">
                          <SafeImage 
                            src={product.images?.[0]?.image || ''} 
                            alt={product.name} 
                            category={product.category_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          />
                          {effectiveStock <= 0 && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-20">
                              <span className="text-white font-bold uppercase px-2.5 py-1 bg-red-600 rounded-full text-2xs shadow-md">{t('out_of_stock', 'Out of Stock')}</span>
                            </div>
                          )}
                        </div>

                        {/* Top Badges */}
                        <div className="relative z-10 p-2 flex justify-between items-start pointer-events-none">
                          <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-black/80 dark:bg-black/90 backdrop-blur-xs text-white border border-white/10 shadow-sm">
                            {effectiveStock > 0 ? t('items_left', '{{count}} left', { count: Math.round(effectiveStock) }) : t('items_left', '0 left', { count: 0 })}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasVariants) {
                                setActiveVariantCardId(prev => prev === product.id ? null : product.id);
                              } else if (effectiveStock > 0) {
                                addToCart(product);
                              }
                            }}
                            disabled={effectiveStock <= 0}
                            className="pointer-events-auto w-7 h-7 rounded-full bg-black/80 dark:bg-black/90 backdrop-blur-xs text-white border border-white/10 shadow-sm group-hover:bg-white group-hover:text-black group-hover:border-transparent hover:!bg-neutral-200 disabled:opacity-40 flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                            title={hasVariants ? t('select_variant', 'Select variation') : t('add_to_cart', 'Add to cart')}
                          >
                            <Plus size={14} className="stroke-[2.5]" />
                          </button>
                        </div>

                        {/* Bottom Floating Bubbles Overlay (Clean layout, no extra space wasted) */}
                        <div className="relative z-10 mt-auto p-2 flex flex-col justify-end gap-1.5 pointer-events-none">
                          {/* Name Bubble */}
                          <div className="w-fit max-w-full px-2.5 py-0.5 rounded-full bg-black/85 dark:bg-black/95 backdrop-blur-xs border border-white/10 shadow-md overflow-hidden">
                            <h3 className="font-bold text-xs text-white truncate leading-tight">{product.name}</h3>
                          </div>

                          {/* Price Bubble - Pure white text */}
                          <div className="w-fit max-w-full px-2.5 py-0.5 rounded-full bg-black/85 dark:bg-black/95 backdrop-blur-xs border border-white/10 shadow-md flex items-center gap-1 overflow-hidden">
                            <span className="font-black text-white text-xs sm:text-sm tabular-nums leading-tight">
                              TSh {parseInt(product.price).toLocaleString()}
                            </span>
                            {hasVariants && (
                              <span className="text-3xs text-neutral-400 font-medium ml-0.5">
                                ({product.variants!.length})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* In-Card Variation Selection Matrix Overlay */}
                        {isVariantOpen && hasVariants && (
                          <POSVariantMatrixOverlay
                            product={product}
                            cart={cart}
                            addToCart={addToCart}
                            onClose={() => setActiveVariantCardId(null)}
                            t={t}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Desktop Cart Sidebar */}
          <div className="hidden lg:flex w-[380px] card overflow-hidden flex-col shrink-0 h-full">
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
              customerName={customerName} 
              setCustomerName={setCustomerName} 
              amountPaid={amountPaid} 
              setAmountPaid={setAmountPaid} 
              updateQuantity={updateQuantity} 
              setQuantity={setQuantity}
              removeFromCart={removeFromCart} 
              handleCheckout={handleCheckout} 
              submitting={submitting} 
            />
          </div>

          {/* Mobile Cart Floating Action Bar & Modal */}
          <div className="lg:hidden">
            <div 
              className="fixed z-40 pointer-events-none flex justify-center"
              style={{
                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
                left: '72px',
                right: '72px'
              }}
            >
              <div className="pointer-events-auto w-full max-w-[420px]">
                <button 
                  type="button"
                  onClick={() => setIsMobileCartOpen(true)}
                  className="w-full h-11 bg-white dark:bg-white text-black dark:text-black rounded-full shadow-xl border border-black/10 px-3.5 sm:px-4 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer select-none"
                  aria-label={t('current_sale', 'Current Sale')}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative shrink-0">
                      <ShoppingCart size={17} className="text-black" />
                      {cart.length > 0 && (
                        <span className="absolute -top-1.5 -right-2 bg-brand-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center border-2 border-white">
                          {cart.reduce((sum: number, item: any) => sum + item.quantity, 0)}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-xs text-black whitespace-nowrap truncate">{t('current_sale', 'Current Sale')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <div className="text-right">
                      <span className="font-semibold text-xs text-black whitespace-nowrap tabular-nums block">
                        TSh {finalTotal.toLocaleString()}
                      </span>
                      {discountAmount > 0 && (
                        <span className="text-[10px] text-gray-400 line-through block leading-none">
                          TSh {cartTotal.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <ChevronUp size={16} className="text-black shrink-0 opacity-70" />
                  </div>
                </button>
              </div>
            </div>

            {isMobileCartOpen && (
              <div className="fixed inset-0 z-50 flex flex-col justify-end">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs animate-fade-in" onClick={() => setIsMobileCartOpen(false)} />
                <div className="relative bg-white dark:bg-[#121212] w-full h-[85vh] rounded-t-card shadow-2xl flex flex-col animate-slide-up overflow-hidden border-t border-surface-border dark:border-surface-dark-border">
                  <div className="p-4 flex justify-between items-center bg-surface-muted dark:bg-[#161616]">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                      {t('current_sale', 'Current Sale')}
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
                      customerName={customerName} 
                      setCustomerName={setCustomerName} 
                      amountPaid={amountPaid} 
                      setAmountPaid={setAmountPaid} 
                      updateQuantity={updateQuantity} 
                      setQuantity={setQuantity}
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
        <div 
          onClick={() => setReceiptData(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 print:p-0 print:bg-white print:block"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative bg-surface-muted/40 dark:bg-[#161616] w-full max-w-sm rounded-card shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh] border border-surface-border dark:border-surface-dark-border print:shadow-none print:rounded-none print:max-h-none print:h-auto print:max-w-none"
          >
            <button 
              onClick={() => setReceiptData(null)} 
              className="absolute top-3 right-3 text-neutral-400 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full backdrop-blur-xs transition z-30 print-hidden cursor-pointer"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            
            <div ref={receiptScrollRef} className="p-4 pt-4 overflow-y-auto flex-1 flex justify-center scrollbar-thin print:bg-white print:p-0 print:overflow-visible">
              
              {/* Actual Thermal Receipt Container */}
              <div 
                id="receipt-content" 
                className="bg-white text-black p-5 w-[80mm] min-w-[80mm] max-w-[80mm] min-h-max mx-auto shadow-md rounded-xl relative my-2" 
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
                  <p className="text-[10px] text-gray-500">{t('pos_receipt_tagline', 'Premium Quality Products')}</p>
                </div>
                
                <div className="border-t border-dashed border-gray-400 py-2 mb-2 text-center text-xs">
                  <p className="font-bold">{t('invoice_number', 'INVOICE #')}{receiptData.id}</p>
                  <p>{(() => {
                    const rawDate = receiptData.order_date || receiptData.created_at;
                    if (!rawDate) return new Date().toLocaleString();
                    const d = new Date(rawDate);
                    return isNaN(d.getTime()) ? String(rawDate) : d.toLocaleString();
                  })()}</p>
                </div>

                <div className="text-xs mb-3">
                  <p><strong>{t('billed_by', 'Billed By:')}</strong> {(user as any)?.first_name && (user as any)?.last_name ? `${(user as any).first_name} ${(user as any).last_name}` : user?.username || 'Store'}</p>
                  <p><strong>{t('customer', 'Customer:')}</strong> {receiptData?.delivery_info?.customer_name || t('walk_in_customer', 'Walk-in Customer')}</p>
                </div>
                
                {/* Items List */}
                <div className="border-t border-b border-dashed border-gray-400 py-2 mb-3">
                  <div className="flex font-bold text-xs mb-1">
                    <span className="flex-1">{t('item', 'Item')}</span>
                    <span className="w-10 text-center">{t('qty', 'Qty')}</span>
                    <span className="w-16 text-right">{t('amount', 'Amt')}</span>
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
                          <span>{t('subtotal', 'SUBTOTAL')}</span>
                          <span>{Math.round(subtotalVal).toLocaleString()}/=</span>
                        </div>
                        <div className="text-xs flex justify-between text-gray-600 mb-1">
                          <span>{t('discount', 'DISCOUNT')} {promoCodeName ? `(${promoCodeName})` : ''}</span>
                          <span>-{Math.round(discountVal).toLocaleString()}/=</span>
                        </div>
                      </>
                    );
                  }
                  return null;
                })()}

                <div className="text-sm font-black flex justify-between mb-1">
                  <span>{t('total_amount', 'TOTAL TSH')}</span>
                  <span>{(() => {
                    const rawTot = parseFloat(receiptData?.total_amount || 0);
                    return Math.round(isNaN(rawTot) ? 0 : rawTot).toLocaleString() + '/=';
                  })()}</span>
                </div>
                
                {(receiptData?.delivery_info?.amount_tendered || receiptData?.delivery_info?.amount_paid) && (
                  <>
                    <div className="text-xs flex justify-between text-gray-600 mb-1">
                      <span>{t('cash_tendered', 'CASH TENDERED')}</span>
                      <span>{(() => {
                        const rawPaid = parseFloat(receiptData.delivery_info.amount_tendered || receiptData.delivery_info.amount_paid);
                        return Math.round(isNaN(rawPaid) ? 0 : rawPaid).toLocaleString() + '/=';
                      })()}</span>
                    </div>
                    <div className="text-xs flex justify-between text-gray-600">
                      <span>{t('change', 'CHANGE')}</span>
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
                  <p className="text-[10px] font-bold mb-3">{t('scan_store_receipt', 'Scan to visit our store!')}</p>
                  <div className="flex justify-center">
                    {user?.username ? (
                      <QRCodeSVG value={`${window.location.origin}/${user.username}`} size={64} level="L" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200" />
                    )}
                  </div>
                  <p className="text-[9px] mt-2 text-gray-500">{t('receipt_thank_you', 'Thank you for shopping with us.')}</p>
                  <p className="text-[9px] text-gray-500">{window.location.host}/{user?.username || ''}</p>
                </div>

              </div>
            </div>
            
            <div className="p-3 border-t border-surface-border dark:border-neutral-800 flex justify-center gap-2 print-hidden shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 text-white border border-white/10 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Printer size={14} /> {t('print_receipt', 'Print Receipt')}
              </button>
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
  customerName, 
  setCustomerName, 
  amountPaid, 
  setAmountPaid, 
  updateQuantity, 
  setQuantity,
  removeFromCart, 
  handleCheckout, 
  submitting 
}: any) => {
  const { t } = useTranslation();
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [showCustomDiscount, setShowCustomDiscount] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const tenderVal = parseFloat(amountPaid || '0');
  const effectiveTotal = typeof finalTotal === 'number' ? finalTotal : Math.max(0, cartTotal - (discountAmount || 0));
  const changeDue = Math.max(0, tenderVal - effectiveTotal);

  const applyPromoAndCollapse = async () => {
    if (!handleApplyPromo) return;
    const ok = await handleApplyPromo();
    if (ok) {
      setIsDiscountOpen(false);
    }
  };

  const applyCustomAndCollapse = () => {
    const val = parseFloat(customInput || '0');
    if (val > 0 && setCustomDiscount) {
      setCustomDiscount(val);
      if (handleRemovePromo) handleRemovePromo();
      setIsDiscountOpen(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full bg-white dark:bg-[#0A0A0A]">
      {/* 1. Customer & Status Header */}
      <div className="px-4 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder={t('walk_in_customer', 'Walk-in Customer')}
            className="bg-transparent border-none text-xs font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-0 w-full p-0 leading-tight outline-none"
            title={t('customer', 'Customer')}
          />
          {customerName && customerName !== t('walk_in_customer', 'Walk-in Customer') && customerName !== 'Walk-in Customer' && (
            <button
              type="button"
              onClick={() => setCustomerName(t('walk_in_customer', 'Walk-in Customer'))}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xs font-medium shrink-0 p-0.5 rounded transition cursor-pointer"
              title={t('reset_walk_in', 'Reset to Walk-in')}
            >
              <X size={12} />
            </button>
          )}
        </div>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-400 shrink-0 whitespace-nowrap px-1 tabular-nums">
          {cart.reduce((s: number, i: any) => s + i.quantity, 0)} {cart.reduce((s: number, i: any) => s + i.quantity, 0) === 1 ? t('item_one', 'item') : t('item_other', 'items')}
        </span>
      </div>

      {/* 2. Register Items List */}
      <div className="flex-1 overflow-y-auto space-y-1 p-3 min-h-0">
        {cart.length === 0 ? (
          <div className="h-full min-h-[140px] py-8 flex flex-col items-center justify-center text-center px-4">
            <div className="w-10 h-10 bg-gray-100 dark:bg-[#161616] rounded-full flex items-center justify-center mb-2">
              <ShoppingCart size={18} className="text-gray-400 opacity-60" />
            </div>
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t('pos_cart_empty', 'Register is empty')}</h3>
            <p className="text-3xs text-gray-400 mt-0.5">{t('pos_cart_empty_hint', 'Click products in the catalog to add')}</p>
          </div>
        ) : (
          cart.map((item: any) => (
            <div key={item.id} className="py-2 px-2 rounded-xl hover:bg-gray-50 dark:hover:bg-[#141414] flex items-center justify-between gap-2.5 group transition">
              <div className="flex-1 min-w-0 pr-1">
                <p className="font-semibold text-xs text-gray-900 dark:text-white truncate">{item.name}</p>
                {item.variant_name && <span className="text-[10px] text-gray-400 block">{item.variant_name}</span>}
                <span className="text-2xs text-gray-400 tabular-nums">
                  TSh {item.price.toLocaleString()}
                </span>
              </div>

              {/* Stepper + Item Total */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="flex items-center bg-gray-100 dark:bg-[#181818] rounded-lg p-0.5 border border-gray-200/50 dark:border-neutral-800/80">
                  <button 
                    type="button"
                    onClick={() => updateQuantity(item.id, -1)} 
                    disabled={item.quantity <= 1} 
                    className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 transition cursor-pointer"
                  >
                    <Minus size={10} />
                  </button>
                  <CartQuantityInput
                    quantity={item.quantity}
                    maxStock={item.max_stock}
                    onChangeQty={(newQ) => setQuantity ? setQuantity(item.id, newQ) : null}
                  />
                  <button 
                    type="button"
                    onClick={() => updateQuantity(item.id, 1)} 
                    disabled={item.quantity >= item.max_stock} 
                    className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 transition cursor-pointer"
                  >
                    <Plus size={10} />
                  </button>
                </div>

                {/* Single-line tabular price without awkward wrapping */}
                <span className="font-semibold text-xs text-gray-900 dark:text-white text-right whitespace-nowrap tabular-nums shrink-0">
                  TSh {(item.price * item.quantity).toLocaleString()}
                </span>

                <button 
                  type="button"
                  onClick={() => removeFromCart(item.id)} 
                  className="text-gray-400 hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-400 p-1 transition cursor-pointer shrink-0"
                  title={t('remove', 'Remove')}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Discount / Promo Code Section */}
      <div className="px-4 py-2.5 bg-gray-50/50 dark:bg-[#111111] shrink-0">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
          <button
            type="button"
            onClick={() => setIsDiscountOpen(!isDiscountOpen)}
            className="flex items-center gap-1.5 font-medium hover:text-gray-900 dark:hover:text-white transition cursor-pointer select-none min-w-0"
          >
            <Tag size={13} className="text-gray-400 shrink-0" />
            <span className="truncate">{t('promo_or_discount', 'Promo code / Discount')}</span>
            {appliedPromo && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-3xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                {appliedPromo.code}
              </span>
            )}
            {!appliedPromo && customDiscount > 0 && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-3xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                -TSh {customDiscount.toLocaleString()}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2.5 shrink-0 ml-2">
            {isDiscountOpen && (
              <button
                type="button"
                onClick={() => setShowCustomDiscount(!showCustomDiscount)}
                className="text-2xs font-medium text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
              >
                {showCustomDiscount ? t('use_promo_code', 'Use promo code') : t('custom_amount', '+ Custom amount')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsDiscountOpen(!isDiscountOpen)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-0.5 cursor-pointer flex items-center justify-center"
              aria-label="Toggle discount"
            >
              <ChevronDown 
                size={14} 
                className={`transition-transform duration-200 ${isDiscountOpen ? 'rotate-180' : ''}`} 
              />
            </button>
          </div>
        </div>

        {isDiscountOpen && (
          <div className="mt-2.5">
            {showCustomDiscount ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1 flex items-center rounded-lg bg-white dark:bg-[#181818] border border-gray-200 dark:border-neutral-800 focus-within:border-brand-500 px-2.5 py-1.5 transition">
                  <span className="text-gray-400 text-xs font-medium mr-1.5 select-none">TSh</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={customInput ? Number(customInput.replace(/,/g, '')).toLocaleString('en-US') : ''}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/,/g, '').replace(/[^\d]/g, '');
                      setCustomInput(clean);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyCustomAndCollapse();
                      }
                    }}
                    className="w-full bg-transparent text-xs font-medium text-gray-900 dark:text-white placeholder:text-gray-400 outline-none tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyCustomAndCollapse}
                  disabled={!customInput || parseFloat(customInput) <= 0}
                  className="px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition shrink-0 cursor-pointer"
                >
                  {t('apply', 'Apply')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder={t('enter_code', 'Enter code')}
                    value={promoCode}
                    onChange={(e) => setPromoCode && setPromoCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyPromoAndCollapse();
                      }
                    }}
                    className="w-full bg-white dark:bg-[#181818] border border-gray-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 placeholder:font-normal placeholder:normal-case placeholder:tracking-normal outline-none uppercase tracking-wide focus:border-brand-500 transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyPromoAndCollapse}
                  disabled={validatingPromo || !promoCode.trim()}
                  className="px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition shrink-0 cursor-pointer"
                >
                  {validatingPromo ? '...' : t('apply', 'Apply')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Checkout Footer with Refined Typography & Comma-Separated Tender Input */}
      <div className="p-4 shrink-0 space-y-3.5 bg-white dark:bg-[#0A0A0A] mt-auto">
        {/* Total Breakdown */}
        <div className="space-y-1.5">
          {discountAmount > 0 && (
            <>
              <div className="flex justify-between items-baseline text-xs text-gray-500 dark:text-gray-400">
                <span className="font-normal">{t('subtotal', 'Subtotal')}</span>
                <span className="font-medium tabular-nums text-gray-700 dark:text-gray-300">
                  TSh {cartTotal.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-baseline text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span>{t('discount', 'Discount')} {appliedPromo ? `(${appliedPromo.code})` : customDiscount > 0 ? '(Custom)' : ''}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (appliedPromo) {
                        handleRemovePromo();
                      }
                      if (customDiscount > 0 && setCustomDiscount) {
                        setCustomDiscount(0);
                        setCustomInput('');
                      }
                    }}
                    className="text-2xs text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 underline cursor-pointer transition ml-0.5"
                    title={t('clear_discount', 'Clear discount')}
                  >
                    {t('clear', 'clear')}
                  </button>
                </div>
                <span className="tabular-nums">- TSh {discountAmount.toLocaleString()}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{t('total_due', 'Total Due')}</span>
            <div className="flex items-baseline gap-1 text-right">
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 select-none">TSh</span>
              <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white tabular-nums">
                {effectiveTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Cash Tendered Input & Shortcuts */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Banknote size={13} className="text-gray-400" />
              <span>{t('cash_tendered', 'Cash tendered')}</span>
            </label>
            {tenderVal > 0 && (
              <span className={`text-xs font-medium tabular-nums ${tenderVal >= effectiveTotal ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                {tenderVal >= effectiveTotal 
                  ? t('change_amount', 'Change: TSh {{amount}}', { amount: changeDue.toLocaleString() })
                  : t('remaining_amount', 'Remaining: TSh {{amount}}', { amount: (effectiveTotal - tenderVal).toLocaleString() })
                }
              </span>
            )}
          </div>

          <div className="flex items-center rounded-xl bg-surface-muted/50 dark:bg-[#161616] border border-surface-border/50 dark:border-neutral-800 focus-within:border-brand-500 px-3 py-2 transition">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 shrink-0 select-none mr-2">TSh</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder={effectiveTotal > 0 ? effectiveTotal.toLocaleString() : '0'}
              value={amountPaid ? (parseFloat(amountPaid) ? parseFloat(amountPaid).toLocaleString('en-US') : amountPaid) : ''}
              onChange={(e) => {
                const clean = e.target.value.replace(/,/g, '').replace(/[^\d.]/g, '');
                setAmountPaid(clean);
              }}
              className="w-full bg-transparent text-sm font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 outline-none tabular-nums"
            />
            {amountPaid && (
              <button
                type="button"
                onClick={() => setAmountPaid('')}
                className="text-gray-400 hover:text-red-500 text-xs px-1 cursor-pointer"
                title={t('clear', 'Clear')}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Quick Tender Shortcuts */}
          {effectiveTotal > 0 && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => setAmountPaid(String(effectiveTotal))}
                className="flex-1 py-1.5 text-2xs font-semibold rounded-lg bg-gray-100 dark:bg-[#181818] hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 border border-gray-200/60 dark:border-neutral-800 transition cursor-pointer"
              >
                {t('exact', 'Exact')}
              </button>
              <button
                type="button"
                onClick={() => setAmountPaid(String(Math.ceil(effectiveTotal / 10000) * 10000))}
                className="flex-1 py-1.5 text-2xs font-semibold rounded-lg bg-gray-100 dark:bg-[#181818] hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 border border-gray-200/60 dark:border-neutral-800 transition cursor-pointer"
              >
                +Round 10k
              </button>
              <button
                type="button"
                onClick={() => setAmountPaid(String(Math.ceil((effectiveTotal + 1) / 50000) * 50000))}
                className="flex-1 py-1.5 text-2xs font-semibold rounded-lg bg-gray-100 dark:bg-[#181818] hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 border border-gray-200/60 dark:border-neutral-800 transition cursor-pointer"
              >
                +Round 50k
              </button>
            </div>
          )}
        </div>

        {/* Complete Sale Action Button */}
        <button 
          type="button"
          onClick={handleCheckout} 
          disabled={cart.length === 0 || submitting}
          className="w-full py-3 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-black font-bold text-xs flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-sm cursor-pointer disabled:cursor-not-allowed"
        >
          <Receipt size={15} className="shrink-0 text-black stroke-[2]" />
          <span className="text-black font-bold tracking-wide">{submitting ? t('processing_sale', 'Processing sale...') : t('complete_sale', 'Complete Sale')}</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardPOS;
