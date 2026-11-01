import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {  } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { 
  Search, ShoppingCart, Plus, Trash2, Printer, X, ChevronUp, ChevronDown, 
  History, Receipt, Banknote, Tag, MapPin, Check, Loader2, FileText, Clock, 
  AlertCircle, CheckCircle2, Phone, Camera, UserCheck, RefreshCw, Send, Settings
} from 'lucide-react';
import SafeImage from '../../components/SafeImage';
import { useAuth } from '../../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { TableSkeleton, POSProductGridSkeleton } from '../../components/Skeleton';
import { getVariantDimensions, isColorValue } from '../../utils/variantUtils';
import { DateRangePicker, type DateRange } from '../../components/ui/DateRangePicker';
import { saveStoreBusinessMode } from '../../services/storeBusinessModeService';

export interface ProductModifier {
  name: string;
  price: number;
}

export interface SelectedAddon {
  name: string;
  price: number;
  quantity: number;
}

export interface Product {
  id: number;
  name: string;
  price: string;
  stock: number;
  images: any[];
  variants?: any[];
  requires_quote?: boolean;
  category_name?: string;
  category_slug?: string;
  pos_only?: boolean;
  sku?: string;
  is_service?: boolean;
  validity_days?: number | null;
  modifiers?: ProductModifier[];
}

export interface CartItem {
  id: string;
  product_id: number;
  variant_id: number | null;
  name: string;
  variant_name: string | null;
  price: number; // total unit price including selected addons
  base_price?: number;
  addons?: SelectedAddon[];
  attendant_name?: string;
  is_service?: boolean;
  validity_days?: number | null;
  quantity: number;
  max_stock: number;
}

export interface POSModuleConfig {
  preset: 'shop' | 'gym' | 'restaurant' | 'salon' | 'custom' | 'all';
  enableDiningModes: boolean; // Dine-in vs Takeaway vs Walk-in (Table #)
  enableMemberships: boolean; // Memberships & Service Passes, QR check-in
  enableInvoices: boolean;    // Invoices & Layaway
  enableAttendants: boolean;  // Staff attendant attribution
  enableDropOffClaim: boolean; // Drop-off & Claim tickets
}

export const DEFAULT_POS_CONFIG: POSModuleConfig = {
  preset: 'custom',
  enableDiningModes: false,
  enableMemberships: false,
  enableInvoices: false,
  enableAttendants: false,
  enableDropOffClaim: false,
};

export const getStoredPOSConfig = (_username?: string): POSModuleConfig => {
  try {
    if (localStorage.getItem('pos_module_config_v2')) {
      const parsed = JSON.parse(localStorage.getItem('pos_module_config_v2') || '{}');
      return {
        ...DEFAULT_POS_CONFIG,
        ...parsed,
      };
    }
  } catch {}
  
  return { ...DEFAULT_POS_CONFIG };
};

interface POSModeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: POSModuleConfig;
  onSave: (config: POSModuleConfig) => void;
}

const POSModeSettingsModal: React.FC<POSModeSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
}) => {
  const [localConfig, setLocalConfig] = useState<POSModuleConfig>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const applyPreset = (preset: 'shop' | 'gym' | 'restaurant' | 'salon' | 'all') => {
    let next: POSModuleConfig;
    if (preset === 'shop') {
      next = { preset: 'shop', enableDiningModes: false, enableMemberships: false, enableInvoices: true, enableAttendants: false, enableDropOffClaim: false };
    } else if (preset === 'gym') {
      next = { preset: 'gym', enableDiningModes: false, enableMemberships: true, enableInvoices: true, enableAttendants: false, enableDropOffClaim: false };
    } else if (preset === 'restaurant') {
      next = { preset: 'restaurant', enableDiningModes: true, enableMemberships: false, enableInvoices: true, enableAttendants: false, enableDropOffClaim: false };
    } else if (preset === 'salon') {
      next = { preset: 'salon', enableDiningModes: false, enableMemberships: true, enableInvoices: true, enableAttendants: true, enableDropOffClaim: true };
    } else {
      next = { preset: 'all', enableDiningModes: true, enableMemberships: true, enableInvoices: true, enableAttendants: true, enableDropOffClaim: true };
    }
    setLocalConfig(next);
  };

  const toggleModule = (key: keyof Omit<POSModuleConfig, 'preset'>) => {
    setLocalConfig(prev => ({
      ...prev,
      preset: 'custom',
      [key]: !prev[key],
    }));
  };

  const handleSave = () => {
    onSave(localConfig);
    // Automatically synchronize store operating mode across the app
    let targetMode: 'retail' | 'gym' | 'salon' | 'restaurant' | 'hybrid' | null = null;
    if (localConfig.preset === 'shop') targetMode = 'retail';
    else if (localConfig.preset === 'gym') targetMode = 'gym';
    else if (localConfig.preset === 'salon') targetMode = 'salon';
    else if (localConfig.preset === 'restaurant') targetMode = 'restaurant';
    else if (localConfig.preset === 'all') targetMode = 'hybrid';
    else if (localConfig.enableMemberships) targetMode = 'gym';

    if (targetMode) {
      saveStoreBusinessMode(targetMode);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 animate-[fadeIn_0.08s_ease-out]">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-[scaleIn_0.08s_ease-out]">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between">
          <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
            POS Mode & Feature Settings
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-300 hover:text-black dark:hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Quick Business Presets */}
          <div className="space-y-1.5">
            <span className="text-3xs font-bold uppercase tracking-wider text-neutral-400">Business Presets</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {[
                { id: 'shop', label: 'Retail Shop' },
                { id: 'gym', label: 'Gym & Club' },
                { id: 'restaurant', label: 'Restaurant' },
                { id: 'salon', label: 'Salon / Spa' },
                { id: 'all', label: 'All Modes' },
              ].map(p => {
                const isSelected = localConfig.preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id as any)}
                    className={`px-3 py-2.5 rounded-xl text-left transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold shadow-xs'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700/60 font-medium'
                    }`}
                  >
                    <span className="text-xs font-semibold leading-tight">{p.label}</span>
                    {isSelected && <Check size={12} className="shrink-0 text-amber-500 dark:text-amber-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="space-y-2 pt-2">
            <span className="text-3xs font-bold uppercase tracking-wider text-neutral-400">Custom Feature Toggles</span>

            {/* Dine-in vs Takeaway */}
            <div 
              onClick={() => toggleModule('enableDiningModes')}
              className="px-3.5 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition flex items-center justify-between cursor-pointer"
            >
              <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                Dine-in / Table # & Takeaway
              </span>
              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 ${localConfig.enableDiningModes ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out shadow-xs ${localConfig.enableDiningModes ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>

            {/* Membership and access */}
            <div 
              onClick={() => toggleModule('enableMemberships')}
              className="px-3.5 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition flex items-center justify-between cursor-pointer"
            >
              <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                Membership and access
              </span>
              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 ${localConfig.enableMemberships ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out shadow-xs ${localConfig.enableMemberships ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>

            {/* Invoices & Quotations */}
            <div 
              onClick={() => toggleModule('enableInvoices')}
              className="px-3.5 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition flex items-center justify-between cursor-pointer"
            >
              <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                Invoices & Quotations
              </span>
              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 ${localConfig.enableInvoices ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out shadow-xs ${localConfig.enableInvoices ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>

            {/* Staff / Attendant Attribution */}
            <div 
              onClick={() => toggleModule('enableAttendants')}
              className="px-3.5 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition flex items-center justify-between cursor-pointer"
            >
              <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                Staff / Attendant Attribution
              </span>
              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 ${localConfig.enableAttendants ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out shadow-xs ${localConfig.enableAttendants ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>

            {/* Drop-off / Claim */}
            <div 
              onClick={() => toggleModule('enableDropOffClaim')}
              className="px-3.5 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition flex items-center justify-between cursor-pointer"
            >
              <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                Drop-off / Claim
              </span>
              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 ${localConfig.enableDropOffClaim ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out shadow-xs ${localConfig.enableDropOffClaim ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-black font-bold text-xs transition cursor-pointer shadow-xs"
            >
              Save & Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface POSHistoryProps {
  onPrint: (order: any) => void;
  dateRange: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
}

const POSHistory: React.FC<POSHistoryProps> = ({ onPrint, dateRange, onDateRangeChange }) => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchHistory = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    let url = `/api/orders/incoming/?is_pos=true&page=${p}`;
    if (dateRange.startDate) url += `&start_date=${dateRange.startDate}`;
    if (dateRange.endDate) url += `&end_date=${dateRange.endDate}`;

    api.get(url)
      .then(res => {
        const data = res.data.results || res.data;
        const incoming = Array.isArray(data) ? data : [];
        if (reset) {
          setOrders(incoming);
        } else {
          setOrders(prev => {
            const ids = new Set(prev.map(o => o.id));
            return [...prev, ...incoming.filter(o => !ids.has(o.id))];
          });
        }
        setHasMore(Boolean(res.data?.next));
      })
      .catch(err => {
        console.error(err);
        if (reset) {
          toast.error(t('failed_to_load_pos_history', 'Failed to load POS history'));
        }
        setHasMore(false);
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [dateRange.startDate, dateRange.endDate, t]);

  useEffect(() => {
    fetchHistory(1, true);
  }, [fetchHistory]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || loading) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage((prev) => {
            const nextPage = prev + 1;
            fetchHistory(nextPage, false);
            return nextPage;
          });
        }
      },
      { rootMargin: '400px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchHistory]);

  const filteredOrders = useMemo(() => {
    if (!dateRange.startDate && !dateRange.endDate) return orders;
    return orders.filter(o => {
      if (!o.order_date) return false;
      try {
        const oDateStr = new Date(o.order_date).toISOString().slice(0, 10);
        if (dateRange.startDate && oDateStr < dateRange.startDate) return false;
        if (dateRange.endDate && oDateStr > dateRange.endDate) return false;
        return true;
      } catch (e) {
        return true;
      }
    });
  }, [orders, dateRange.startDate, dateRange.endDate]);

  if (loading) return <TableSkeleton rows={5} cols={7} withHeader={false} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2.5 pb-0.5">
        <div className="flex items-center gap-2">
          <History size={14} className="text-neutral-400" />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{t('sales_history', 'Sales History')}</span>
        </div>
        {onDateRangeChange && (
          <DateRangePicker 
            value={dateRange} 
            onChange={onDateRangeChange} 
            buttonClassName="rounded-full !py-1 text-xs font-semibold"
          />
        )}
      </div>

      <div className="card overflow-hidden !border-none !rounded-none !bg-transparent">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-2xs uppercase tracking-wider text-gray-600 dark:text-gray-300 font-bold">
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
          <tbody>
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
                      <button
                        type="button"
                        onClick={() => onPrint(order)}
                        className="inline-flex items-center text-2xs py-1 px-2.5 h-7 font-bold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-transparent border-0 cursor-pointer transition"
                      >
                        <Printer size={12} className="mr-1" /> {t('view_receipt', 'View Receipt')}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {loadingMore && (
        <div className="flex justify-center items-center py-4 gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
          <Loader2 size={16} className="animate-spin text-brand-500" />
          <span>{t('loading_more_sales', 'Loading more sales...')}</span>
        </div>
      )}

      {!hasMore && orders.length > 15 && (
        <p className="text-center py-4 text-2xs text-gray-400 font-medium">
          {t('end_of_sales_history', 'End of sales history')}
        </p>
      )}

      <div ref={sentinelRef} className="h-4" />
      </div>
    </div>
  );
};

interface POSInvoiceHistoryProps {
  onPrintInvoice: (invoice: any) => void;
  onPrintReceipt: (order: any) => void;
  onMarkPaid: (invoice: any) => void;
  onCancelInvoice: (invoice: any) => void;
  dateRange: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  refreshTrigger: number;
  onUnpaidCountChange?: (count: number) => void;
}

const POSInvoiceHistory: React.FC<POSInvoiceHistoryProps> = ({
  onPrintInvoice,
  onPrintReceipt,
  onMarkPaid,
  onCancelInvoice,
  dateRange,
  onDateRangeChange,
  refreshTrigger,
  onUnpaidCountChange
}) => {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchInvoices = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    let url = `/api/orders/incoming/?is_pos_invoice=true&page=${p}`;
    if (statusFilter === 'unpaid') url += '&status=INVOICE_GENERATED';
    else if (statusFilter === 'paid') url += '&status=COMPLETED';
    else if (statusFilter === 'cancelled') url += '&status=CANCELLED';

    if (searchQuery.trim()) url += `&q=${encodeURIComponent(searchQuery.trim())}`;
    if (dateRange.startDate) url += `&start_date=${dateRange.startDate}`;
    if (dateRange.endDate) url += `&end_date=${dateRange.endDate}`;

    api.get(url)
      .then(res => {
        const data = res.data.results || res.data;
        const incoming = Array.isArray(data) ? data : [];
        if (reset) {
          setInvoices(incoming);
        } else {
          setInvoices(prev => {
            const ids = new Set(prev.map(o => o.id));
            return [...prev, ...incoming.filter(o => !ids.has(o.id))];
          });
        }
        setHasMore(Boolean(res.data?.next));

        if (onUnpaidCountChange && statusFilter === 'all') {
          const unpaid = incoming.filter((inv: any) => inv.status === 'INVOICE_GENERATED').length;
          onUnpaidCountChange(unpaid);
        }
      })
      .catch(err => {
        console.error(err);
        if (reset) {
          toast.error(t('failed_to_load_pos_invoices', 'Failed to load POS invoices'));
        }
        setHasMore(false);
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [statusFilter, searchQuery, dateRange.startDate, dateRange.endDate, onUnpaidCountChange, t]);

  useEffect(() => {
    fetchInvoices(1, true);
  }, [fetchInvoices, refreshTrigger]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || loading) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage((prev) => {
            const nextPage = prev + 1;
            fetchInvoices(nextPage, false);
            return nextPage;
          });
        }
      },
      { rootMargin: '400px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchInvoices]);

  return (
    <div className="space-y-3">
      {/* Filters and Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: 'all', label: t('all_invoices', 'All Invoices') },
            { key: 'unpaid', label: t('pending', 'Pending') },
            { key: 'paid', label: t('paid', 'Paid') },
            { key: 'cancelled', label: t('cancelled', 'Cancelled') }
          ].map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key as any)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                statusFilter === f.key
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-bold shadow-xs'
                  : 'bg-surface-muted dark:bg-[#161616] text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {onDateRangeChange && (
            <DateRangePicker 
              value={dateRange} 
              onChange={onDateRangeChange} 
              buttonClassName="rounded-full !py-1 text-xs font-semibold"
            />
          )}
          <div className="relative min-w-[200px] sm:w-64">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t('search_invoices_placeholder', 'Search customer, phone, or invoice #...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-surface-muted dark:bg-[#161616] border-0 text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={8} withHeader={false} />
      ) : (
        <div className="card overflow-hidden !border-none !rounded-none !bg-transparent">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-2xs uppercase tracking-wider text-gray-600 dark:text-gray-300 font-bold">
                <tr>
                  <th className="p-3">{t('date', 'Date')}</th>
                  <th className="p-3">{t('invoice_number', 'Invoice #')}</th>
                  <th className="p-3">{t('customer', 'Customer')}</th>
                  <th className="p-3">{t('items', 'Items')}</th>
                  <th className="p-3 text-right">{t('total_due', 'Total Due')}</th>
                  <th className="p-3">{t('validity_due', 'Validity / Due')}</th>
                  <th className="p-3 text-center">{t('status', 'Status')}</th>
                  <th className="p-3 text-right">{t('actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400 text-xs">
                      {t('no_invoices_found', 'No in-store invoices found for the selected criteria.')}
                    </td>
                  </tr>
                ) : (
                  invoices.map(inv => {
                    const totalAmt = parseFloat(inv.total_amount || 0);
                    const isUnpaid = inv.status === 'INVOICE_GENERATED';
                    const isPaid = inv.status === 'COMPLETED';
                    const isCancelled = inv.status === 'CANCELLED';
                    const di = inv.delivery_info || {};
                    const dueDateStr = di.due_date;
                    const dueDate = dueDateStr ? new Date(dueDateStr) : null;
                    const isExpired = isUnpaid && dueDate && dueDate.getTime() < Date.now();
                    const itemsList = inv.relevant_items || inv.items || inv.orderitem_set || [];
                    const itemsCount = itemsList.length;

                    return (
                      <tr key={inv.id} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition">
                        <td className="p-3 text-gray-500 dark:text-gray-400">
                          {new Date(inv.order_date).toLocaleDateString()} {new Date(inv.order_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3 text-gray-900 dark:text-white font-bold">
                          INV-#{inv.id}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {di.customer_name || t('walk_in_customer', 'Walk-in Customer')}
                          </div>
                          {di.customer_phone && (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                              <Phone size={10} className="opacity-70" />
                              <span>{di.customer_phone}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-gray-600 dark:text-gray-300">
                          <span className="font-medium">{itemsCount} {itemsCount === 1 ? t('item', 'item') : t('items', 'items')}</span>
                        </td>
                        <td className="p-3 text-right font-extrabold text-gray-900 dark:text-white">
                          <div>TSh {totalAmt.toLocaleString()}</div>
                          {parseFloat(inv.discount_amount || di.discount_amount || 0) > 0 && (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              -TSh {parseFloat(inv.discount_amount || di.discount_amount).toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              <CheckCircle2 size={11} />
                              <span>{t('paid', 'Paid')}</span>
                            </span>
                          ) : isCancelled ? (
                            <span className="text-[11px] text-neutral-400 font-medium">
                              {di.cancellation_reason || t('cancelled', 'Cancelled')}
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                              <AlertCircle size={10} />
                              <span>{t('expired', 'Expired')} ({dueDate?.toLocaleDateString()})</span>
                            </span>
                          ) : dueDate ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                              <Clock size={11} />
                              <span>{t('due', 'Due')}: {dueDate.toLocaleDateString()}</span>
                              {di.validity_period && <span className="opacity-75">({di.validity_period})</span>}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {isUnpaid && (
                            <span className="text-2xs font-semibold text-amber-600 dark:text-amber-400">
                              {t('unpaid', 'Unpaid')}
                            </span>
                          )}
                          {isPaid && (
                            <span className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400">
                              {t('paid', 'Paid')}
                            </span>
                          )}
                          {isCancelled && (
                            <span className="text-2xs font-semibold text-neutral-500 dark:text-neutral-400">
                              {t('cancelled', 'Cancelled')}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {isUnpaid && (
                              <button
                                type="button"
                                onClick={() => onMarkPaid(inv)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs font-bold bg-brand-500 hover:bg-brand-600 text-black transition cursor-pointer shadow-2xs"
                                title={t('mark_as_paid_title', 'Record payment and convert to completed sale')}
                              >
                                <Banknote size={11} />
                                <span>{t('mark_paid', 'Mark as Paid')}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onPrintInvoice(inv)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-2xs font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                              title={t('view_print_invoice', 'View and print invoice')}
                            >
                              <Printer size={11} />
                              <span>{t('invoice', 'Invoice')}</span>
                            </button>
                            {isPaid && (
                              <button
                                type="button"
                                onClick={() => onPrintReceipt(inv)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-2xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                                title={t('view_receipt', 'View Receipt')}
                              >
                                <Receipt size={11} />
                                <span>{t('receipt', 'Receipt')}</span>
                              </button>
                            )}
                            {isUnpaid && (
                              <button
                                type="button"
                                onClick={() => onCancelInvoice(inv)}
                                className="p-1 text-gray-400 hover:text-red-500 transition cursor-pointer rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                title={t('cancel_invoice', 'Cancel Invoice')}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {loadingMore && (
            <div className="flex justify-center items-center py-4 gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <Loader2 size={16} className="animate-spin text-brand-500" />
              <span>{t('loading_more_invoices', 'Loading more invoices...')}</span>
            </div>
          )}

          {!hasMore && invoices.length > 15 && (
            <p className="text-center py-4 text-2xs text-gray-400 font-medium">
              {t('end_of_invoice_history', 'End of invoice history')}
            </p>
          )}

          <div ref={sentinelRef} className="h-4" />
        </div>
      )}
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
  addToCart: (product: any, variant?: any, addons?: SelectedAddon[], attendantName?: string) => void;
  onClose: () => void;
  t: (key: string, defaultText: string) => string;
  posConfig?: POSModuleConfig;
}

// In-card options matrix selector: pick Color, Size, Modifiers with real-time live price and clean Add action
const POSVariantMatrixOverlay: React.FC<POSVariantMatrixOverlayProps> = ({
  product,
  cart,
  addToCart,
  onClose,
  t,
  posConfig,
}) => {
  const variants = product.variants || [];
  const modifiersList: ProductModifier[] = useMemo(() => {
    if (Array.isArray(product.modifiers)) return product.modifiers;
    return [];
  }, [product.modifiers]);

  const isService = Boolean(product.is_service);

  // Selected add-ons: map of name -> quantity
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [attendantName, setAttendantName] = useState<string>('');

  const toggleAddon = (name: string, checked: boolean) => {
    setSelectedAddons(prev => {
      const next = { ...prev };
      if (checked) {
        next[name] = 1;
      } else {
        delete next[name];
      }
      return next;
    });
  };

  const updateAddonQty = (name: string, delta: number) => {
    setSelectedAddons(prev => {
      const current = prev[name] || 0;
      const nextVal = current + delta;
      const next = { ...prev };
      if (nextVal <= 0) {
        delete next[name];
      } else {
        next[name] = nextVal;
      }
      return next;
    });
  };

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
    const inCartVariant = variants.find(v => cart.some(ci => ci.id.startsWith(`${product.id}-${v.id}`)));
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

  // Base price for current variant (or base product)
  const basePrice = useMemo(() => {
    if (selectedVariant) {
      if (selectedVariant.final_price != null) return parseFloat(selectedVariant.final_price);
      return parseFloat(product.price) + parseFloat(selectedVariant.price_adjustment || 0);
    }
    return parseFloat(product.price || '0');
  }, [product.price, selectedVariant]);

  // Total add-ons price
  const addonsCost = useMemo(() => {
    return Object.entries(selectedAddons).reduce((sum, [name, qty]) => {
      const mod = modifiersList.find(m => m.name === name);
      return sum + (mod ? parseFloat(String(mod.price || 0)) * qty : 0);
    }, 0);
  }, [modifiersList, selectedAddons]);

  const liveTotalPrice = basePrice + addonsCost;
  const vStock = selectedVariant ? parseFloat(String(selectedVariant.stock || 0)) : parseFloat(String(product.stock || 0));
  const canAdd = isService || vStock > 0 || variants.length === 0;

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

  const isOptionInStock = (dimIdx: number, val: string) => {
    return variants.some((v: any) => {
      const parts = (v.name || '').split('/').map((p: string) => p.trim());
      return parts[dimIdx]?.toLowerCase() === val.toLowerCase() && parseFloat(String(v.stock || 0)) > 0;
    });
  };

  const getDimensionLabel = (dim: any) => {
    const vals = dim.values || [];
    if (vals.some((v: string) => isColorValue(v))) return t('color', 'Color');
    if (vals.some((v: string) => /^(xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|small|medium|large)$/i.test(v.trim()))) return t('size', 'Size');
    if (vals.some((v: string) => /\b(cm|mm|in|inch|inches)\b/i.test(v))) return t('dimensions', 'Length / Spec');
    if (vals.some((v: string) => /^\d{1,4}\s*(gb|tb|mb)/i.test(v))) return t('storage', 'Storage');
    if (dimensions.length === 1) return t('options', 'Options');
    return dim.label || t('option', 'Option');
  };

  const handleCommitToSale = () => {
    if (!canAdd) return;
    const preparedAddons: SelectedAddon[] = Object.entries(selectedAddons)
      .filter(([_, qty]) => qty > 0)
      .map(([name, qty]) => {
        const mod = modifiersList.find(m => m.name === name);
        return {
          name,
          price: mod ? parseFloat(String(mod.price || 0)) : 0,
          quantity: qty,
        };
      });

    addToCart(product, selectedVariant || null, preparedAddons, attendantName.trim() || undefined);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-[fadeIn_0.08s_ease-out]"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-[scaleIn_0.08s_ease-out] max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between shrink-0">
          <div className="min-w-0 flex-1 pr-2">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
              {product.name}
            </h3>
            <span className="text-3xs text-neutral-500 dark:text-neutral-400 block truncate mt-0.5">
              {variants.length > 0 ? `${variants.length} variations` : ''}
              {variants.length > 0 && modifiersList.length > 0 ? ' • ' : ''}
              {modifiersList.length > 0 ? `${modifiersList.length} add-ons` : ''}
              {variants.length === 0 && modifiersList.length === 0 ? 'Options & modifiers' : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-300 hover:text-black dark:hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
            title={t('close', 'Close')}
          >
            <X size={14} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="px-5 py-4 overflow-y-auto space-y-4 max-h-[60vh]">
          {/* Dimensions / Variations */}
          {dimensions.map((dim) => (
            <div key={dim.index} className="space-y-1.5">
              <div className="flex items-center justify-between text-2xs text-neutral-500 dark:text-neutral-400">
                <span className="uppercase tracking-wider font-bold text-3xs text-neutral-400 dark:text-neutral-500">
                  {getDimensionLabel(dim)}
                </span>
                <span className="text-neutral-900 dark:text-white font-semibold truncate max-w-[160px]">
                  {selectedOptions[dim.index] || '—'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dim.values.map((val: string) => {
                  const isSelected = selectedOptions[dim.index]?.toLowerCase() === val.toLowerCase();
                  const inStock = isOptionInStock(dim.index, val);

                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSelectOption(dim.index, val)}
                      className={`px-3 py-1.5 rounded-xl text-xs transition cursor-pointer ${
                        isSelected
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold shadow-xs'
                          : inStock || isService
                            ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                            : 'bg-neutral-100 dark:bg-neutral-800/50 text-neutral-400 line-through opacity-40 cursor-not-allowed'
                      }`}
                      title={`${val}${!inStock && !isService ? ` (${t('out_of_stock', 'Out of stock')})` : ''}`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Optional Add-ons / Modifiers */}
          {modifiersList.length > 0 && (
            <div className="pt-1 space-y-2">
              <span className="text-3xs uppercase font-bold tracking-wider text-neutral-400 dark:text-neutral-500 block">
                {t('addons_extras', 'Add-ons / Extras')}
              </span>
              <div className="space-y-1.5">
                {modifiersList.map((mod) => {
                  const isChecked = (selectedAddons[mod.name] || 0) > 0;
                  const qty = selectedAddons[mod.name] || 0;
                  const modPrice = parseFloat(String(mod.price || 0));

                  return (
                    <div 
                      key={mod.name} 
                      className={`flex items-center justify-between p-2.5 rounded-2xl transition cursor-pointer ${
                        isChecked 
                          ? 'bg-neutral-100 dark:bg-neutral-800/90 text-neutral-900 dark:text-white' 
                          : 'bg-neutral-50 dark:bg-neutral-800/40 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/70'
                      }`}
                      onClick={() => toggleAddon(mod.name, !isChecked)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleAddon(mod.name, e.target.checked);
                          }}
                          className="rounded accent-neutral-900 dark:accent-neutral-200 w-4 h-4 cursor-pointer shrink-0"
                        />
                        <span className="text-xs font-semibold truncate">{mod.name}</span>
                        <span className="text-2xs text-neutral-500 dark:text-neutral-400 font-medium shrink-0">
                          +{modPrice.toLocaleString()} TSh
                        </span>
                      </div>
                      {isChecked && (
                        <div 
                          className="flex items-center rounded-full bg-neutral-200 dark:bg-neutral-950 h-7 px-1 border-0 select-none shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => updateAddonQty(mod.name, -1)}
                            className="w-5 h-full flex items-center justify-center font-bold text-xs text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white transition cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <span className="leading-none">−</span>
                          </button>
                          <span className="w-5 text-center font-bold text-xs text-neutral-900 dark:text-white tabular-nums">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateAddonQty(mod.name, 1)}
                            className="w-5 h-full flex items-center justify-center font-bold text-xs text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white transition cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <span className="leading-none">+</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Attendant attribution (if service item and attendants enabled) */}
          {isService && posConfig?.enableAttendants && (
            <div className="pt-1">
              <label className="text-3xs uppercase font-bold tracking-wider text-neutral-400 dark:text-neutral-500 block mb-1">
                {t('attendant_staff', 'Staff / Attendant')}
              </label>
              <input
                type="text"
                value={attendantName}
                onChange={(e) => setAttendantName(e.target.value)}
                placeholder={t('attendant_placeholder', 'e.g. Barber Juma, Stylist Amina')}
                className="w-full text-xs bg-neutral-100 dark:bg-neutral-800/80 rounded-xl px-3 py-2 text-neutral-900 dark:text-white placeholder-neutral-400 outline-none border-0 focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600 transition"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="text-base font-black text-neutral-900 dark:text-white tabular-nums">
              TSh {liveTotalPrice.toLocaleString()}
            </div>
            <div className="text-3xs text-neutral-500 dark:text-neutral-400 tabular-nums font-medium truncate">
              {isService ? (
                <span className="text-neutral-500 dark:text-neutral-400 font-medium">{t('service', 'Service Available')}</span>
              ) : vStock > 0 ? (
                `${vStock} ${t('left', 'left')}`
              ) : (
                <span className="text-rose-500 font-semibold">{t('out_of_stock', 'Out of stock')}</span>
              )}
              {cart.filter(ci => ci.product_id === product.id).reduce((s, ci) => s + ci.quantity, 0) > 0 && (
                <span className="text-neutral-400">
                  {' '}• {cart.filter(ci => ci.product_id === product.id).reduce((s, ci) => s + ci.quantity, 0)} {t('in_sale', 'in sale')}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCommitToSale}
            disabled={!canAdd}
            className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-95 text-black text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {vStock <= 0 && !isService ? t('out_of_stock', 'Out of stock') : t('add_to_sale', 'Add to Sale')}
          </button>
        </div>
      </div>
    </div>
  );
};

const playAudioBeep = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    if (navigator.vibrate) navigator.vibrate(40);
  } catch {
    // Audio Context blocked or not supported
  }
};

interface POSContinuousScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  cart: CartItem[];
  cartTotal: number;
  addToCart: (product: any, variant?: any, addons?: SelectedAddon[], attendantName?: string) => void;
  onSelectProductForCustomization: (product: Product) => void;
  onPassCheckInComplete?: () => void;
  t: (key: string, defaultText: string) => string;
}

const POSContinuousScannerModal: React.FC<POSContinuousScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  cart,
  cartTotal,
  addToCart,
  onSelectProductForCustomization,
  onPassCheckInComplete,
  t,
}) => {
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [verifiedPass, setVerifiedPass] = useState<any>(null);
  const [claimTicket, setClaimTicket] = useState<any>(null);
  const scannedRecently = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) {
      setVerifiedPass(null);
      setClaimTicket(null);
      return;
    }

    const scannerElementId = 'pos-continuous-scanner-reader';
    const html5Qr = new Html5Qrcode(scannerElementId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
      ],
      verbose: false,
    });

    const handleScanSuccess = async (decodedText: string) => {
      const code = decodedText.trim();
      if (!code) return;

      // Anti-duplicate debounce: 1.5 seconds per code
      if (scannedRecently.current.has(code)) return;
      scannedRecently.current.add(code);
      setTimeout(() => {
        scannedRecently.current.delete(code);
      }, 1500);

      playAudioBeep();
      setLastScanned(code);

      // 1. Gym / Service Membership Pass
      if (code.toUpperCase().startsWith('SKN:PASS:')) {
        const passCode = code.substring(9).trim();
        try {
          const res = await api.get(`/api/orders/pos-verify-pass/?pass_code=${encodeURIComponent(passCode)}`);
          setVerifiedPass(res.data);
          if (res.data.valid) {
            toast.success(`Check-in verified: ${res.data.customer_name}`, { icon: '🟢' });
            if (onPassCheckInComplete) onPassCheckInComplete();
          } else {
            toast.error(res.data.message || 'Pass Expired', { icon: '🔴' });
          }
        } catch (err: any) {
          toast.error(err.response?.data?.error || 'Pass verification failed');
        }
        return;
      }

      // 2. Drop-off Claim Ticket (Laundry / Repair)
      if (code.toUpperCase().startsWith('SKN:CLM:')) {
        const orderId = code.substring(8).trim();
        try {
          const res = await api.get(`/api/orders/${orderId}/`);
          setClaimTicket(res.data);
          toast.success(`Claim ticket #${orderId} loaded`, { icon: '📋' });
        } catch {
          toast.error(`Claim ticket #${orderId} not found`);
        }
        return;
      }

      // 3. SokoniMax Product / Variant QR (SKN:P12:V34 or SKN:P12)
      const pMatch = code.match(/^SKN:P(\d+)(?::V(\d+))?$/i);
      if (pMatch) {
        const pId = parseInt(pMatch[1], 10);
        const vId = pMatch[2] ? parseInt(pMatch[2], 10) : null;
        const targetProd = products.find(p => p.id === pId);
        if (targetProd) {
          if (vId) {
            const targetVariant = (targetProd.variants || []).find(v => v.id === vId);
            if (targetVariant) {
              addToCart(targetProd, targetVariant);
              toast.success(`Added ${targetProd.name} (${targetVariant.name})`, { icon: '🛍️' });
            } else {
              addToCart(targetProd);
            }
          } else {
            const hasVariants = Boolean(targetProd.variants && targetProd.variants.length > 0);
            const hasModifiers = Boolean(targetProd.modifiers && targetProd.modifiers.length > 0);
            if (hasVariants || hasModifiers) {
              onClose();
              onSelectProductForCustomization(targetProd);
            } else {
              addToCart(targetProd);
              toast.success(`Added ${targetProd.name}`, { icon: '🛍️' });
            }
          }
        } else {
          toast.error(`Product ID ${pId} not in loaded inventory`);
        }
        return;
      }

      // 4. Barcode / SKU lookup
      const matchedProdBySku = products.find(p => p.sku && p.sku.toLowerCase() === code.toLowerCase());
      if (matchedProdBySku) {
        const hasVariants = Boolean(matchedProdBySku.variants && matchedProdBySku.variants.length > 0);
        const hasModifiers = Boolean(matchedProdBySku.modifiers && matchedProdBySku.modifiers.length > 0);
        if (hasVariants || hasModifiers) {
          onClose();
          onSelectProductForCustomization(matchedProdBySku);
        } else {
          addToCart(matchedProdBySku);
          toast.success(`Added ${matchedProdBySku.name}`, { icon: '🛍️' });
        }
        return;
      }

      // 5. Variant SKU lookup
      for (const p of products) {
        const vMatch = (p.variants || []).find(v => v.sku && v.sku.toLowerCase() === code.toLowerCase());
        if (vMatch) {
          addToCart(p, vMatch);
          toast.success(`Added ${p.name} (${vMatch.name})`, { icon: '🛍️' });
          return;
        }
      }

      toast.error(`Barcode / QR "${code}" not found in inventory`, { icon: '⚠️' });
    };

    html5Qr.start(
      { facingMode: 'environment' },
      { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
      handleScanSuccess,
      () => {}
    ).catch(err => {
      console.error('Camera start error:', err);
      toast.error('Unable to access camera for scanning');
    });

    return () => {
      if (html5Qr.isScanning) {
        html5Qr.stop().then(() => html5Qr.clear()).catch(() => {});
      }
    };
  }, [isOpen, products]);

  if (!isOpen) return null;

  const totalCartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const handleRenewExpiredPass = (pass: any) => {
    const targetProd = products.find(p => p.id === pass.product_id);
    if (targetProd) {
      const targetVar = pass.variant_id ? (targetProd.variants || []).find(v => v.id === pass.variant_id) : null;
      addToCart(targetProd, targetVar);
      toast.success(`Renewing ${pass.product_name} - loaded into cart`, { icon: '🔄' });
      setVerifiedPass(null);
      onClose();
    } else {
      toast.error('Plan product not found in inventory');
    }
  };

  const handleMarkCollected = async (orderId: number) => {
    try {
      await api.patch(`/api/orders/${orderId}/`, { status: 'DELIVERED' });
      toast.success(`Order #${orderId} marked as collected!`, { icon: '✅' });
      setClaimTicket(null);
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 animate-fade-in">
      <div className="bg-neutral-900 rounded-3xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl relative">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            {t('continuous_scanner', 'POS Continuous Scanner')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="p-4 relative flex flex-col items-center">
          <div 
            id="pos-continuous-scanner-reader" 
            className="w-full aspect-square max-w-[280px] rounded-2xl overflow-hidden bg-black relative shadow-inner"
          />

          <p className="text-3xs text-neutral-400 mt-2 text-center">
            Point camera at product barcodes, QR stickers, or member check-in passes
          </p>

          {lastScanned && (
            <div className="mt-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-3xs font-mono">
              Scanned: {lastScanned}
            </div>
          )}

          {/* Member Check-in Overlay Card */}
          {verifiedPass && (
            <div className="absolute inset-x-4 top-4 bottom-4 z-20 bg-neutral-950/95 border border-neutral-700 rounded-2xl p-4 flex flex-col justify-between animate-fade-in shadow-2xl">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    {verifiedPass.valid ? (
                      <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">✓</span>
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs">✕</span>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {verifiedPass.valid ? 'MEMBER VERIFIED' : 'MEMBERSHIP EXPIRED'}
                      </h4>
                      <span className="text-3xs text-neutral-400 font-mono">#{verifiedPass.pass_code}</span>
                    </div>
                  </div>
                  <button onClick={() => setVerifiedPass(null)} className="text-neutral-400 hover:text-white text-xs">✕</button>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-neutral-200">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Customer:</span>
                    <span className="font-bold text-white">{verifiedPass.customer_name}</span>
                  </div>
                  {verifiedPass.customer_phone && (
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Phone:</span>
                      <span className="font-mono text-neutral-300">{verifiedPass.customer_phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Plan:</span>
                    <span className="font-semibold text-amber-400">{verifiedPass.product_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Status:</span>
                    <span className={`font-bold ${verifiedPass.valid ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {verifiedPass.valid ? `${verifiedPass.days_remaining} day(s) left` : `Expired ${verifiedPass.days_ago || 0} day(s) ago`}
                    </span>
                  </div>
                  {verifiedPass.valid && (
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Check-ins:</span>
                      <span className="font-bold text-white">#{verifiedPass.check_in_count}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex gap-2">
                {!verifiedPass.valid && (
                  <button
                    type="button"
                    onClick={() => handleRenewExpiredPass(verifiedPass)}
                    className="flex-1 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <RefreshCw size={12} /> Renew in Cart
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setVerifiedPass(null)}
                  className="flex-1 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition cursor-pointer"
                >
                  {verifiedPass.valid ? 'Continue Scanning' : 'Dismiss'}
                </button>
              </div>
            </div>
          )}

          {/* Claim Ticket Overlay Card */}
          {claimTicket && (
            <div className="absolute inset-x-4 top-4 bottom-4 z-20 bg-neutral-950/95 border border-neutral-700 rounded-2xl p-4 flex flex-col justify-between animate-fade-in shadow-2xl">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Receipt size={16} className="text-amber-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white">CLAIM TICKET #{claimTicket.id}</h4>
                      <span className="text-3xs text-neutral-400">Status: {claimTicket.status}</span>
                    </div>
                  </div>
                  <button onClick={() => setClaimTicket(null)} className="text-neutral-400 hover:text-white text-xs">✕</button>
                </div>
                <div className="mt-3 space-y-1 text-xs text-neutral-200">
                  <p className="text-neutral-400">Customer: <strong className="text-white">{claimTicket.delivery_info?.customer_name || 'Customer'}</strong></p>
                  <p className="text-neutral-400">Total: <strong className="text-amber-400">TSh {parseFloat(claimTicket.total_amount || 0).toLocaleString()}</strong></p>
                </div>
              </div>
              <div className="pt-3 border-t border-white/10 flex gap-2">
                {claimTicket.status !== 'DELIVERED' && (
                  <button
                    type="button"
                    onClick={() => handleMarkCollected(claimTicket.id)}
                    className="flex-1 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    ✓ Mark as Collected
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setClaimTicket(null)}
                  className="flex-1 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Mini-Cart */}
        <div className="px-5 pb-5 pt-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-7 h-7 rounded-full bg-white/10 text-white flex items-center justify-center font-bold">
              {totalCartCount}
            </span>
            <div>
              <span className="text-3xs text-neutral-400 block uppercase">Register Cart</span>
              <span className="font-bold text-white tabular-nums">TSh {cartTotal.toLocaleString()}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-white hover:bg-neutral-200 active:scale-95 text-black text-xs font-bold transition cursor-pointer"
          >
            Review Cart
          </button>
        </div>
      </div>
    </div>
  );
};

interface POSServicePassesViewProps {
  onRenewPass: (pass: any) => void;
  onOpenScanner: () => void;
}

const POSServicePassesView: React.FC<POSServicePassesViewProps> = ({
  onRenewPass,
  onOpenScanner,
}) => {
  const [passes, setPasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');
  const [search, setSearch] = useState('');
  const [checkingInId, setCheckingInId] = useState<number | null>(null);

  const fetchPasses = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const params: any = {};
      if (filter !== 'all') params.status = filter;
      if (search.trim()) params.search = search.trim();
      const res = await api.get('/api/orders/pos-service-passes/', { params });
      setPasses(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (e) {
      console.error(e);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    fetchPasses(true);
  }, [fetchPasses]);

  const handleCheckIn = async (passCode: string, passId: number) => {
    setCheckingInId(passId);
    try {
      const res = await api.get(`/api/orders/pos-verify-pass/?pass_code=${encodeURIComponent(passCode)}`);
      if (res.data.valid) {
        toast.success(`Check-in recorded for ${res.data.customer_name} (Pass #${passCode})!`, { icon: '🟢' });
        // Optimistically increment count smoothly without table skeleton reload
        setPasses(prev => prev.map(p => p.id === passId ? {
          ...p,
          check_in_count: (p.check_in_count || 0) + 1,
          last_checked_in: new Date().toISOString()
        } : p));
        // Silent background sync
        fetchPasses(false);
      } else {
        toast.error(res.data.message || 'Pass has expired', { icon: '🔴' });
      }
    } catch {
      toast.error('Check-in failed');
    } finally {
      setCheckingInId(null);
    }
  };

  const handleWhatsAppReminder = (pass: any) => {
    const rawPhone = String(pass.customer_phone || '').replace(/\D/g, '');
    let cleanPhone = rawPhone;
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '255' + cleanPhone.slice(1);
    } else if (!cleanPhone.startsWith('255') && cleanPhone.length === 9) {
      cleanPhone = '255' + cleanPhone;
    }

    const expiryStr = new Date(pass.expires_at).toLocaleDateString();
    const msg = encodeURIComponent(
      `Habari ${pass.customer_name}, huu ni ukumbusho wa uanachama wako wa ${pass.product_name}${pass.variant_name ? ` (${pass.variant_name})` : ''} unaoisha tarehe ${expiryStr}. Tafadhali fanya upya kuendelea kufurahia huduma zetu! Asante.`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-3">
      {/* Filters and Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Passes' },
            { id: 'active', label: 'Active' },
            { id: 'expiring', label: 'Expiring This Week' },
            { id: 'expired', label: 'Expired' },
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                filter === f.id
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-bold shadow-xs'
                  : 'bg-surface-muted dark:bg-[#161616] text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-[200px] sm:w-64">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search member, phone, or pass #..."
              className="w-full pl-8 pr-8 py-1.5 text-xs rounded-xl bg-surface-muted dark:bg-[#161616] border-0 text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenScanner}
            className="px-3 py-1.5 rounded-full bg-surface-muted dark:bg-[#161616] hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <Camera size={13} />
            <span className="hidden sm:inline">Scan Check-In QR</span>
            <span className="sm:hidden">Scan</span>
          </button>
        </div>
      </div>

      {/* Passes Table */}
      {loading ? (
        <TableSkeleton rows={5} cols={7} withHeader={false} />
      ) : (
        <div className="card overflow-hidden !border-none !rounded-none !bg-transparent">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-2xs uppercase tracking-wider text-gray-600 dark:text-gray-300 font-bold">
                <tr>
                  <th className="p-3">PASS CODE</th>
                  <th className="p-3">MEMBER / CUSTOMER</th>
                  <th className="p-3">SERVICE PLAN</th>
                  <th className="p-3">EXPIRATION</th>
                  <th className="p-3 text-center">CHECK-INS</th>
                  <th className="p-3 text-center">STATUS</th>
                  <th className="p-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {passes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400 text-xs">
                      No membership passes found for the selected criteria.
                    </td>
                  </tr>
                ) : (
                  passes.map((pass: any) => {
                    const isExpired = !pass.is_valid || new Date(pass.expires_at) < new Date();
                    const daysLeft = Math.ceil((new Date(pass.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    const isExpiringSoon = !isExpired && daysLeft <= 7;

                    return (
                      <tr key={pass.id} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition">
                        <td className="p-3 font-mono text-gray-900 dark:text-white font-bold">
                          #{pass.pass_code}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {pass.customer_name}
                          </div>
                          {pass.customer_phone && (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                              <Phone size={10} className="opacity-70" />
                              <span>{pass.customer_phone}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-gray-700 dark:text-gray-300">
                          <div className="font-medium text-gray-900 dark:text-white">{pass.product_name}</div>
                          {pass.variant_name && (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              {pass.variant_name}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-gray-600 dark:text-gray-400">
                          <div className="text-gray-900 dark:text-white font-medium">
                            {new Date(pass.expires_at).toLocaleDateString()}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {isExpired ? 'Expired' : `${daysLeft} days remaining`}
                          </div>
                        </td>
                        <td className="p-3 text-center font-bold text-gray-900 dark:text-white">
                          {pass.check_in_count || 0}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-2xs font-semibold ${
                            isExpired
                              ? 'text-rose-500 dark:text-rose-400'
                              : isExpiringSoon
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-neutral-900 dark:text-white'
                          }`}>
                            {isExpired ? 'Expired' : isExpiringSoon ? 'Expiring Soon' : 'Active'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isExpired && (
                              <button
                                type="button"
                                disabled={checkingInId === pass.id}
                                onClick={() => handleCheckIn(pass.pass_code, pass.id)}
                                className="px-2.5 py-1 rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white text-2xs font-semibold transition flex items-center gap-1 cursor-pointer border-0 outline-none disabled:opacity-60"
                                title="Record member visit"
                              >
                                {checkingInId === pass.id ? (
                                  <Loader2 size={12} className="animate-spin text-neutral-400 shrink-0" />
                                ) : (
                                  <Check size={12} className="shrink-0" />
                                )}
                                <span>Check In</span>
                              </button>
                            )}

                            {pass.customer_phone && (
                              <button
                                type="button"
                                onClick={() => handleWhatsAppReminder(pass)}
                                className="px-2 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white text-2xs font-semibold transition flex items-center gap-1 cursor-pointer border-0"
                                title="Send WhatsApp renewal reminder"
                              >
                                <Send size={11} />
                                <span>WhatsApp</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => onRenewPass(pass)}
                              className="px-2 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white text-2xs font-semibold transition flex items-center gap-1 cursor-pointer border-0"
                              title="Renew membership in cart"
                            >
                              <RefreshCw size={11} />
                              <span>Renew</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const DashboardPOS: React.FC = () => {
  const { user, activeLocation, setActiveLocation, assignedLocations } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'sale' | 'history' | 'invoices' | 'passes'>('sale');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [orderType, setOrderType] = useState<'walk_in' | 'dine_in' | 'takeaway'>('walk_in');
  const [tableNumber, setTableNumber] = useState('');
  const [pickupRequired, setPickupRequired] = useState(false);
  const [pickupPromisedTime, setPickupPromisedTime] = useState('');
  const [historyDateRange, setHistoryDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
    label: t('all_time', 'All Time'),
  });
  const [invoiceDateRange, setInvoiceDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
    label: t('all_time', 'All Time'),
  });
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState(t('walk_in_customer', 'Walk-in Customer'));
  const [amountPaid, setAmountPaid] = useState('');

  // POS Invoice Generation & Settlement State
  const [checkoutMode, setCheckoutMode] = useState<'sale' | 'invoice'>('sale');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerTin, setCustomerTin] = useState('');
  const [validityPeriod, setValidityPeriod] = useState<string>('7d');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [invoiceModalData, setInvoiceModalData] = useState<any>(null);
  const [markPaidModalData, setMarkPaidModalData] = useState<any>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState<'CASH' | 'LIPA_MPESA' | 'AIRTEL_MONEY' | 'TIGO_PESA' | 'BANK_TRANSFER' | 'CARD'>('CASH');
  const [markPaidAmountTendered, setMarkPaidAmountTendered] = useState('');
  const [markPaidReference, setMarkPaidReference] = useState('');
  const [markPaidNotes, setMarkPaidNotes] = useState('');
  const [markPaidSubmitting, setMarkPaidSubmitting] = useState(false);
  const [invoiceRefreshKey, setInvoiceRefreshKey] = useState(0);
  const [unpaidInvoicesCount, setUnpaidInvoicesCount] = useState(0);

  // Discount & Promo Code System State
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [customDiscount, setCustomDiscount] = useState<number>(0);
  
  const [submitting, setSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [selectedProductForOptions, setSelectedProductForOptions] = useState<Product | null>(null);

  // POS Mode & Feature Configurations (Shop / Gym / Restaurant / Salon)
  const [posConfig, setPosConfig] = useState<POSModuleConfig>(() => getStoredPOSConfig(user?.username));
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isRecordsDropdownOpen, setIsRecordsDropdownOpen] = useState(false);
  const [recordsDropdownPos, setRecordsDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const recordsBtnRef = useRef<HTMLButtonElement>(null);
  const recordsDropdownRef = useRef<HTMLDivElement>(null);

  const toggleRecordsDropdown = () => {
    if (!isRecordsDropdownOpen && recordsBtnRef.current) {
      const rect = recordsBtnRef.current.getBoundingClientRect();
      setRecordsDropdownPos({
        top: rect.bottom + 6,
        right: Math.max(12, window.innerWidth - rect.right),
      });
      setIsRecordsDropdownOpen(true);
    } else {
      setIsRecordsDropdownOpen(false);
    }
  };

  useEffect(() => {
    if (!isRecordsDropdownOpen) return;
    const updatePos = () => {
      if (recordsBtnRef.current) {
        const rect = recordsBtnRef.current.getBoundingClientRect();
        setRecordsDropdownPos({
          top: rect.bottom + 6,
          right: Math.max(12, window.innerWidth - rect.right),
        });
      }
    };
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [isRecordsDropdownOpen]);

  const handleUpdateConfig = (newConfig: POSModuleConfig) => {
    setPosConfig(newConfig);
    try {
      localStorage.setItem('pos_module_config_v2', JSON.stringify(newConfig));
      localStorage.setItem('pos_module_config', JSON.stringify(newConfig));
    } catch {}
    toast.success('POS mode updated', { icon: '⚙️' });

    if (activeTab === 'invoices' && !newConfig.enableInvoices) {
      setActiveTab('sale');
    }
    if (activeTab === 'passes' && !newConfig.enableMemberships) {
      setActiveTab('sale');
    }
    if (!newConfig.enableDropOffClaim) {
      setPickupRequired(false);
      setPickupPromisedTime('');
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        recordsDropdownRef.current && 
        !recordsDropdownRef.current.contains(e.target as Node) &&
        recordsBtnRef.current &&
        !recordsBtnRef.current.contains(e.target as Node)
      ) {
        setIsRecordsDropdownOpen(false);
      }
    };
    if (isRecordsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRecordsDropdownOpen]);

  const printRef = useRef<HTMLDivElement>(null);
  const invoicePrintRef = useRef<HTMLDivElement>(null);
  const receiptScrollRef = useRef<HTMLDivElement>(null);

  // Fetch initial unpaid invoice count for badge
  useEffect(() => {
    api.get('/api/orders/incoming/?is_pos_invoice=true&status=INVOICE_GENERATED&page=1')
      .then(res => {
        const count = res.data?.count ?? (Array.isArray(res.data?.results) ? res.data.results.length : (Array.isArray(res.data) ? res.data.length : 0));
        setUnpaidInvoicesCount(count);
      })
      .catch(() => {});
  }, [invoiceRefreshKey]);

  // Auto-set default active location if not already selected
  useEffect(() => {
    if (!activeLocation && assignedLocations && assignedLocations.length > 0) {
      const main = assignedLocations.find(l => l.is_main) || assignedLocations[0];
      setActiveLocation(main);
    }
  }, [activeLocation, assignedLocations]);

  useEffect(() => {
    if (receiptData && receiptScrollRef.current) {
      receiptScrollRef.current.scrollTop = 0;
    }
  }, [receiptData]);

  const fetchProducts = () => {
    setLoading(true);
    const endpoint = `/api/products/?mine=true&is_draft=false&page=1&page_size=100`;

    api.get(endpoint)
      .then(async (res) => {
        let prods = res.data.results || res.data;
        if (Array.isArray(prods)) {
          if (activeLocation?.id) {
            try {
              const invRes = await api.get(`/api/locations/${activeLocation.id}/inventory/?page_size=250`);
              const stockMap = new Map();
              const invItems = invRes.data.results || invRes.data || [];
              invItems.forEach((it: any) => {
                const key = `${it.product}_${it.variant || 'none'}`;
                stockMap.set(key, it);
              });

              prods = prods.map((p: any) => {
                const baseStock = stockMap.get(`${p.id}_none`);
                const effectiveStock = baseStock !== undefined ? parseFloat(baseStock.quantity) : p.stock;
                const effectivePrice = (baseStock && baseStock.price_override) ? baseStock.price_override : p.price;
                
                const variants = Array.isArray(p.variants)
                  ? p.variants.filter((v: any) => v.is_available !== false).map((v: any) => {
                      const varStock = stockMap.get(`${p.id}_${v.id}`);
                      return {
                        ...v,
                        stock: varStock !== undefined ? parseFloat(varStock.quantity) : v.stock,
                        final_price: (varStock && varStock.price_override) ? varStock.price_override : v.final_price
                      };
                    })
                  : [];
                return {
                  ...p,
                  stock: effectiveStock,
                  price: effectivePrice,
                  variants
                };
              });
            } catch (e) {
              console.error('Failed to overlay location inventory', e);
            }
          } else {
            prods = prods.map((p: any) => ({
              ...p,
              variants: Array.isArray(p.variants)
                ? p.variants.filter((v: any) => v.is_available !== false)
                : []
            }));
          }
          setProducts(prods);
        }
      })
      .catch(() => toast.error(t('failed_to_load_products', 'Failed to load products')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, [activeLocation?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedProductForOptions !== null) {
        setSelectedProductForOptions(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProductForOptions]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (searchQuery) {
        return p.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [products, searchQuery]);

  const addToCart = useCallback((
    product: Product,
    variant: any = null,
    addons: SelectedAddon[] = [],
    attendantName?: string
  ) => {
    const isService = Boolean(product.is_service);
    const stock = variant ? parseFloat(String(variant.stock || 0)) : parseFloat(String(product.stock || 0));

    let basePrice = variant 
      ? (variant.final_price != null ? parseFloat(variant.final_price) : parseFloat(product.price) + parseFloat(variant.price_adjustment || 0))
      : parseFloat(product.price);
    
    if (!isService && stock <= 0) {
      toast.error(t('out_of_stock', 'Out of stock!'));
      return;
    }

    if (product.requires_quote) {
      const userPrice = window.prompt(t('pos_enter_price_prompt', 'Enter agreed-upon price (TSh) for {{name}}:', { name: product.name }));
      if (userPrice === null || isNaN(parseFloat(userPrice)) || parseFloat(userPrice) < 0) {
        toast.error(t('valid_price_required', 'Valid price is required for this product'));
        return;
      }
      basePrice = parseFloat(userPrice);
    }

    const addonsTotal = (addons || []).reduce((acc, a) => acc + (a.price * a.quantity), 0);
    const unitPrice = basePrice + addonsTotal;

    const addonKey = addons && addons.length > 0 
      ? `_add_${addons.map(a => `${a.name}:${a.quantity}`).sort().join(';')}` 
      : '';
    const attendantKey = attendantName ? `_att_${attendantName}` : '';
    const id = `${product.id}-${variant ? variant.id : 'null'}${addonKey}${attendantKey}`;

    setCart(prev => {
      const existing = prev.find(item => item.id === id);
      if (existing) {
        if (!isService && existing.quantity >= stock) {
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
        price: unitPrice,
        base_price: basePrice,
        addons: addons && addons.length > 0 ? addons : undefined,
        attendant_name: attendantName,
        is_service: isService,
        validity_days: variant?.validity_days || product.validity_days,
        quantity: 1,
        max_stock: isService ? 999999 : stock
      }];
    });
    
    toast.success(t('pos_added_to_sale', 'Added to sale'), { duration: 1500, icon: '🛍️' });
  }, [t]);

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQ = item.quantity + delta;
        if (newQ > 0 && (item.is_service || newQ <= item.max_stock)) {
          return { ...item, quantity: newQ };
        }
      }
      return item;
    }));
  };

  const setQuantity = (id: string, newQty: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const maxAllowed = item.is_service ? 999999 : item.max_stock;
        const clamped = Math.max(1, Math.min(maxAllowed, Math.floor(newQty)));
        return { ...item, quantity: clamped };
      }
      return item;
    }));
  };

  // Hardware USB Barcode Scanner listener (keyboard wedge)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const now = Date.now();
      if (now - lastKeyTime > 80) {
        buffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          e.preventDefault();
          const code = buffer.trim();
          playAudioBeep();
          
          const pMatch = code.match(/^SKN:P(\d+)(?::V(\d+))?$/i);
          if (pMatch) {
            const pId = parseInt(pMatch[1], 10);
            const vId = pMatch[2] ? parseInt(pMatch[2], 10) : null;
            const targetProd = products.find(p => p.id === pId);
            if (targetProd) {
              if (vId) {
                const targetVar = (targetProd.variants || []).find(v => v.id === vId);
                if (targetVar) addToCart(targetProd, targetVar);
              } else {
                addToCart(targetProd);
              }
              toast.success(`Scanned: ${targetProd.name}`, { icon: '📟' });
            }
          } else {
            const matched = products.find(p => p.sku && p.sku.toLowerCase() === code.toLowerCase());
            if (matched) {
              addToCart(matched);
              toast.success(`Scanned: ${matched.name}`, { icon: '📟' });
            } else {
              for (const p of products) {
                const v = (p.variants || []).find(varItem => varItem.sku && varItem.sku.toLowerCase() === code.toLowerCase());
                if (v) {
                  addToCart(p, v);
                  toast.success(`Scanned: ${p.name} (${v.name})`, { icon: '📟' });
                  break;
                }
              }
            }
          }
        }
        buffer = '';
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, addToCart]);

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
        customer_phone: customerPhone ? customerPhone.trim().replace(/[\s-]/g, '') : '',
        order_type: orderType,
        table_number: orderType === 'dine_in' ? tableNumber : '',
        pickup_required: pickupRequired,
        pickup_promised_time: pickupRequired ? pickupPromisedTime : '',
        amount_paid: amountPaid ? parseFloat(amountPaid) : null,
        promo_code: appliedPromo ? appliedPromo.code : null,
        discount_amount: discountAmount,
        location_id: activeLocation?.id || null,
        items: cart.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          price: item.price,
          addons: item.addons || [],
          attendant_name: item.attendant_name || '',
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
      setCustomerPhone('');
      setOrderType('walk_in');
      setTableNumber('');
      setPickupRequired(false);
      setPickupPromisedTime('');
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

  const handleCreateInvoice = async () => {
    if (cart.length === 0) {
      toast.error(t('pos_cart_empty', 'Cart is empty!'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_name: customerName,
        customer_phone: customerPhone ? customerPhone.trim().replace(/[\s-]/g, '') : '',
        customer_tin: customerTin,
        notes: invoiceNotes,
        validity_period: validityPeriod,
        promo_code: appliedPromo ? appliedPromo.code : null,
        discount_amount: discountAmount,
        location_id: activeLocation?.id || null,
        items: cart.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          price: item.price,
          addons: item.addons || [],
          attendant_name: item.attendant_name || '',
        }))
      };

      const res = await api.post('/api/orders/pos-create-invoice/', payload);
      toast.success(t('pos_invoice_generated', 'Invoice #{{id}} generated successfully!', { id: res.data.id }));
      setInvoiceModalData(res.data);
      setCart([]);
      setAppliedPromo(null);
      setPromoCode('');
      setCustomDiscount(0);
      setCustomerName(t('walk_in_customer', 'Walk-in Customer'));
      setCustomerPhone('');
      setCustomerTin('');
      setInvoiceNotes('');
      setAmountPaid('');
      setIsMobileCartOpen(false);
      setInvoiceRefreshKey(k => k + 1);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.response?.data?.detail || t('pos_invoice_failed', 'Failed to generate invoice'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenMarkPaid = (invoice: any) => {
    setMarkPaidModalData(invoice);
    setMarkPaidMethod('CASH');
    setMarkPaidAmountTendered(String(invoice.total_amount || ''));
    setMarkPaidReference('');
    setMarkPaidNotes('');
  };

  const handleConfirmMarkPaid = async () => {
    if (!markPaidModalData) return;
    setMarkPaidSubmitting(true);
    try {
      const res = await api.post(`/api/orders/${markPaidModalData.id}/pos-mark-paid/`, {
        payment_method: markPaidMethod,
        amount_paid: markPaidMethod === 'CASH' && markPaidAmountTendered ? parseFloat(markPaidAmountTendered) : markPaidModalData.total_amount,
        reference_number: markPaidReference,
        notes: markPaidNotes,
        location_id: activeLocation?.id || null,
      });

      toast.success(t('invoice_paid_recorded_sale', 'Invoice marked as paid! Sale recorded in Sales History.'));
      setMarkPaidModalData(null);
      setInvoiceRefreshKey(k => k + 1);
      fetchProducts(); // Refresh stock
      setReceiptData(res.data); // Show receipt immediately
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || t('failed_to_mark_paid', 'Failed to mark invoice as paid'));
    } finally {
      setMarkPaidSubmitting(false);
    }
  };

  const handleCancelInvoice = async (invoice: any) => {
    if (!window.confirm(t('confirm_cancel_invoice', 'Are you sure you want to cancel Invoice #{{id}}?', { id: invoice.id }))) {
      return;
    }
    try {
      await api.post(`/api/orders/${invoice.id}/pos-cancel-invoice/`, { reason: 'Cancelled by cashier' });
      toast.success(t('invoice_cancelled', 'Invoice cancelled'));
      setInvoiceRefreshKey(k => k + 1);
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('failed_to_cancel_invoice', 'Failed to cancel invoice'));
    }
  };

  const handlePrintInvoice = () => {
    const printContent = invoicePrintRef.current;
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

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(node => node.outerHTML)
      .join('');

    contentWindow.document.open();
    contentWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Invoice</title>
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
            #invoice-content {
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
      <header className="space-y-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex items-start sm:items-center justify-between md:justify-start gap-2.5 sm:gap-3 flex-wrap">
            <div className="min-w-0 flex-1 md:flex-initial">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
                {t('point_of_sale', 'Point of Sale (POS)')}
              </h1>
              <p 
                className="text-gray-500 dark:text-gray-400 text-[11px] sm:text-xs md:text-sm truncate mt-0.5"
                title={t('pos_subtitle', 'Make direct sales and print receipts. Click on a product to add.')}
              >
                {t('pos_subtitle', 'Make direct sales and print receipts. Click on a product to add.')}
              </p>
            </div>

            {/* Terminal Branch Selector / Badge */}
            {assignedLocations && assignedLocations.length > 1 ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLocationDropdownOpen(!locationDropdownOpen)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border border-primary-200/80 dark:border-primary-800/60 shadow-2xs hover:bg-primary-100 dark:hover:bg-primary-900/50 transition cursor-pointer"
                  title={t('switch_branch', 'Switch terminal branch')}
                >
                  <MapPin size={12} className="text-primary-600 dark:text-primary-400 shrink-0" />
                  <span className="truncate max-w-[130px] sm:max-w-[170px]">{activeLocation?.name || t('all_locations', 'Main Store')}</span>
                  <ChevronDown size={11} className={`opacity-60 transition-transform ${locationDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {locationDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setLocationDropdownOpen(false)} />
                    <div className="absolute left-0 top-full mt-1.5 w-56 bg-white dark:bg-neutral-900 border border-surface-border dark:border-surface-dark-border rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in duration-150">
                      <div className="px-3 py-1.5 text-3xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-neutral-800">
                        {t('terminal_location', 'Terminal Branch')}
                      </div>
                      {assignedLocations.map(loc => (
                        <button
                          key={loc.id}
                          type="button"
                          onClick={() => {
                            setActiveLocation(loc);
                            setLocationDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-gray-50 dark:hover:bg-neutral-800/80 transition cursor-pointer ${
                            activeLocation?.id === loc.id ? 'font-bold text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-950/20' : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <span className="truncate">{loc.name} {loc.is_main ? `(${t('main_hq', 'HQ')})` : ''}</span>
                          {activeLocation?.id === loc.id && <Check size={12} className="shrink-0 text-primary-600 dark:text-primary-400" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (activeLocation || assignedLocations[0]) ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 border border-gray-200/80 dark:border-neutral-700/60 shadow-2xs">
                <MapPin size={11} className="text-primary-600 dark:text-primary-400 shrink-0" />
                <span className="truncate max-w-[140px]">{activeLocation?.name || assignedLocations[0]?.name}</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-center md:justify-end gap-2 w-full md:w-auto shrink-0">
            {activeTab === 'sale' && (
              <div className="hidden md:block relative md:w-60 lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                <input
                  type="text"
                  placeholder={t('search_pos_input', 'Search products...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-muted dark:bg-[#161616] border-0 outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-neutral-700 rounded-full pl-8 pr-7 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center justify-between md:justify-end gap-1 sm:gap-1.5 shrink-0 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-semibold bg-surface-muted dark:bg-[#161616] hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition flex items-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer shrink-0"
                title="Continuous camera scanner for QR codes and manufacturer barcodes"
              >
                <Camera size={13} className="shrink-0" />
                <span className="hidden sm:inline">Scan QR / Barcode</span>
                <span className="hidden min-[360px]:inline sm:hidden">Scan QR</span>
                <span className="min-[360px]:hidden">Scan</span>
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('sale')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'sale'
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Receipt size={12} className="shrink-0 sm:w-[13px] sm:h-[13px]" />
                <span>{t('new_sale', 'New Sale')}</span>
              </button>
              {/* History & Records Dropdown */}
              <div className="relative">
                <button
                  ref={recordsBtnRef}
                  type="button"
                  onClick={toggleRecordsDropdown}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab !== 'sale'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                      : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  title="View sales records, invoices, or memberships"
                >
                  <History size={12} className="shrink-0 sm:w-[13px] sm:h-[13px]" />
                  <span>{t('records', 'Records')}</span>
                  {unpaidInvoicesCount > 0 && posConfig.enableInvoices && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  )}
                  <ChevronDown size={11} className={`transition-transform duration-150 shrink-0 ${isRecordsDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isRecordsDropdownOpen && recordsDropdownPos && createPortal(
                  <div 
                    ref={recordsDropdownRef}
                    style={{
                      position: 'fixed',
                      top: `${recordsDropdownPos.top}px`,
                      right: `${recordsDropdownPos.right}px`,
                      zIndex: 99999,
                    }}
                    className="w-56 rounded-2xl bg-neutral-800 text-white border-0 shadow-2xl py-1.5 animate-scale-in overflow-hidden"
                  >
                    {/* Sales History */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('history');
                        setIsRecordsDropdownOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 text-left text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                        activeTab === 'history'
                          ? 'bg-neutral-700 text-white font-bold'
                          : 'text-neutral-300 hover:text-white hover:bg-neutral-700/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <History size={13} className="text-neutral-400" />
                        <span>{t('sales_history', 'Sales History')}</span>
                      </div>
                      {activeTab === 'history' && <Check size={12} className="text-amber-500" />}
                    </button>

                    {/* Invoice History (if enabled) */}
                    {posConfig.enableInvoices && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('invoices');
                          setIsRecordsDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2.5 text-left text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                          activeTab === 'invoices'
                            ? 'bg-neutral-700 text-white font-bold'
                            : 'text-neutral-300 hover:text-white hover:bg-neutral-700/60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText size={13} className="text-neutral-400" />
                          <span>{t('invoice_history', 'Invoice History')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {unpaidInvoicesCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-black font-bold tabular-nums">
                              {unpaidInvoicesCount}
                            </span>
                          )}
                          {activeTab === 'invoices' && <Check size={12} className="text-amber-500" />}
                        </div>
                      </button>
                    )}

                    {/* Memberships (if enabled) */}
                    {posConfig.enableMemberships && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('passes');
                          setIsRecordsDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2.5 text-left text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                          activeTab === 'passes'
                            ? 'bg-neutral-700 text-white font-bold'
                            : 'text-neutral-300 hover:text-white hover:bg-neutral-700/60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <UserCheck size={13} className="text-neutral-400" />
                          <span>{t('memberships_tab', 'Memberships')}</span>
                        </div>
                        {activeTab === 'passes' && <Check size={12} className="text-amber-500" />}
                      </button>
                    )}
                  </div>,
                  document.body
                )}
              </div>

              {/* POS Mode Settings Icon Button */}
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-semibold bg-surface-muted dark:bg-[#161616] hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0"
                title="POS Mode & Module Settings (Food / Gym / Retail / Salon)"
              >
                <Settings size={12} className="shrink-0 sm:w-[13px] sm:h-[13px] text-gray-400" />
                <span className="capitalize whitespace-nowrap">
                  {posConfig.preset === 'all' ? 'Mode' : posConfig.preset}
                </span>
              </button>
            </div>

            {activeTab === 'sale' && (
              <div className="md:hidden relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                <input
                  type="text"
                  placeholder={t('search_pos_input', 'Search products...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-muted dark:bg-[#161616] border-0 outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-neutral-700 rounded-full pl-8 pr-7 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {activeTab === 'sale' ? (
        <div className="flex flex-col lg:flex-row gap-6 lg:items-stretch items-start lg:h-[calc(100vh-210px)] lg:min-h-[580px]">
          {/* Products Section */}
          <div className="flex-1 w-full bg-white dark:bg-[#141414] rounded-3xl border-0 outline-none ring-0 overflow-hidden flex flex-col h-full shadow-none">
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
                    const isService = Boolean(product.is_service);
                    const hasVariants = Boolean(product.variants && product.variants.length > 0);
                    const hasModifiers = Boolean(product.modifiers && product.modifiers.length > 0);
                    const requiresCustomization = hasVariants || hasModifiers;
                    const effectiveStock = hasVariants
                      ? product.variants!.reduce((sum: number, v: any) => sum + parseFloat(String(v.stock || 0)), 0)
                      : stockNum;

                    return (
                      <div 
                        key={product.id} 
                        onClick={() => {
                          if (requiresCustomization) {
                            setSelectedProductForOptions(product);
                          } else if (effectiveStock > 0 || isService) {
                            addToCart(product);
                          }
                        }}
                        className="group relative rounded-2xl overflow-hidden cursor-pointer border-0 bg-gray-100 dark:bg-[#141414] transition-all flex flex-col aspect-[3/4] select-none hover:shadow-card-hover"
                      >
                        {/* Image covering entire card - clearly visible, no dark fade */}
                        <div className="absolute inset-0 w-full h-full overflow-hidden bg-gray-100 dark:bg-[#161616]">
                          <SafeImage 
                            src={product.images?.[0]?.image || ''} 
                            alt={product.name} 
                            category={product.category_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          />
                          {!isService && effectiveStock <= 0 && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-20">
                              <span className="text-white font-bold uppercase px-2.5 py-1 bg-red-600 rounded-full text-2xs shadow-md">{t('out_of_stock', 'Out of Stock')}</span>
                            </div>
                          )}
                        </div>

                        {/* Top Badges */}
                        <div className="relative z-10 p-2 flex justify-between items-start pointer-events-none">
                          <div className="flex flex-col gap-1 items-start">
                            {!isService && (
                              <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-black/80 dark:bg-black/90 backdrop-blur-xs text-white border-0 shadow-sm">
                                {effectiveStock > 0 ? t('items_left', '{{count}} left', { count: Math.round(effectiveStock) }) : t('items_left', '0 left', { count: 0 })}
                              </span>
                            )}
                            {isService && (
                              <span className="text-3xs font-bold text-emerald-400 select-none whitespace-nowrap pl-0.5 pt-0.5">
                                Service
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (requiresCustomization) {
                                setSelectedProductForOptions(product);
                              } else if (effectiveStock > 0 || isService) {
                                addToCart(product);
                              }
                            }}
                            disabled={!isService && effectiveStock <= 0}
                            className="pointer-events-auto w-7 h-7 rounded-full bg-black/80 dark:bg-black/90 backdrop-blur-xs text-white border-0 shadow-sm hover:bg-neutral-800 disabled:opacity-40 flex items-center justify-center cursor-pointer transition-colors"
                            title={requiresCustomization ? t('select_variant', 'Select variation / options') : t('add_to_cart', 'Add to cart')}
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

                          {/* Price Row with POS badge */}
                          <div className="flex items-stretch justify-between gap-1.5 w-full">
                            {/* Price Bubble - Pure white text */}
                            {(() => {
                              const priceNum = parseInt(product.price || '0', 10);
                              const priceFormatted = `TSh ${priceNum.toLocaleString()}`;
                              return (
                                <div className="w-fit max-w-full px-2 py-0.5 rounded-full bg-black/85 dark:bg-black/95 backdrop-blur-xs border border-white/10 shadow-md flex items-center gap-1 whitespace-nowrap overflow-hidden">
                                  <span className={`font-black text-white tabular-nums leading-none tracking-tight whitespace-nowrap ${
                                    priceFormatted.length >= 14
                                      ? 'text-[10px] sm:text-2xs'
                                      : priceFormatted.length >= 11
                                        ? 'text-[11px] sm:text-xs'
                                        : 'text-xs sm:text-sm'
                                  }`}>
                                    {priceFormatted}
                                  </span>
                                  {hasVariants && (
                                    <span className="text-[9px] text-neutral-400 font-medium ml-0.5 whitespace-nowrap shrink-0">
                                      ({product.variants!.length})
                                    </span>
                                  )}
                                </div>
                              );
                            })()}

                            {/* POS Badge: black like the price, matching exact height */}
                            {product.pos_only && (
                              <div className="px-2 py-0.5 rounded-full text-2xs font-black tracking-wide text-white bg-black/85 dark:bg-black/95 backdrop-blur-xs border border-white/10 shadow-md flex items-center justify-center shrink-0">
                                POS
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Desktop Cart Sidebar */}
          <div className="hidden lg:flex w-[380px] bg-white dark:bg-[#141414] rounded-3xl border-0 outline-none ring-0 overflow-hidden flex-col shrink-0 h-full shadow-none">
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
              checkoutMode={checkoutMode}
              setCheckoutMode={setCheckoutMode}
              handleCreateInvoice={handleCreateInvoice}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              customerTin={customerTin}
              setCustomerTin={setCustomerTin}
              validityPeriod={validityPeriod}
              setValidityPeriod={setValidityPeriod}
              invoiceNotes={invoiceNotes}
              setInvoiceNotes={setInvoiceNotes}
              orderType={orderType}
              setOrderType={setOrderType}
              tableNumber={tableNumber}
              setTableNumber={setTableNumber}
              pickupRequired={pickupRequired}
              setPickupRequired={setPickupRequired}
              pickupPromisedTime={pickupPromisedTime}
              setPickupPromisedTime={setPickupPromisedTime}
              posConfig={posConfig}
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
                <div className="relative bg-white dark:bg-[#141414] w-full h-[85vh] rounded-t-card shadow-2xl flex flex-col animate-slide-up overflow-hidden border-0">
                  <div className="p-4 flex justify-between items-center">
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
                      checkoutMode={checkoutMode}
                      setCheckoutMode={setCheckoutMode}
                      handleCreateInvoice={handleCreateInvoice}
                      customerPhone={customerPhone}
                      setCustomerPhone={setCustomerPhone}
                      customerTin={customerTin}
                      setCustomerTin={setCustomerTin}
                      validityPeriod={validityPeriod}
                      setValidityPeriod={setValidityPeriod}
                      invoiceNotes={invoiceNotes}
                      setInvoiceNotes={setInvoiceNotes}
                      orderType={orderType}
                      setOrderType={setOrderType}
                      tableNumber={tableNumber}
                      setTableNumber={setTableNumber}
                      pickupRequired={pickupRequired}
                      setPickupRequired={setPickupRequired}
                      pickupPromisedTime={pickupPromisedTime}
                      setPickupPromisedTime={setPickupPromisedTime}
                      posConfig={posConfig}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'history' ? (
        <POSHistory 
          onPrint={(order) => setReceiptData(order)} 
          dateRange={historyDateRange} 
          onDateRangeChange={setHistoryDateRange}
        />
      ) : activeTab === 'invoices' ? (
        <POSInvoiceHistory
          onPrintInvoice={(inv) => setInvoiceModalData(inv)}
          onPrintReceipt={(order) => setReceiptData(order)}
          onMarkPaid={handleOpenMarkPaid}
          onCancelInvoice={handleCancelInvoice}
          dateRange={invoiceDateRange}
          onDateRangeChange={setInvoiceDateRange}
          refreshTrigger={invoiceRefreshKey}
          onUnpaidCountChange={setUnpaidInvoicesCount}
        />
      ) : (
        <POSServicePassesView
          onRenewPass={async (pass) => {
            const prodId = Number(pass.product || pass.product_id);
            const varId = pass.variant != null ? Number(pass.variant) : (pass.variant_id != null ? Number(pass.variant_id) : null);

            let targetProd = products.find(p => p.id === prodId);
            if (!targetProd && prodId) {
              try {
                const res = await api.get(`/api/products/${prodId}/`);
                targetProd = res.data;
              } catch (err) {
                console.error(err);
              }
            }

            if (targetProd) {
              const targetVar = varId ? (targetProd.variants || []).find((v: any) => v.id === varId) : null;
              addToCart(targetProd, targetVar);
              if (pass.customer_name) setCustomerName(pass.customer_name);
              if (pass.customer_phone) setCustomerPhone(pass.customer_phone);
              setActiveTab('sale');
              toast.success(`Renewing ${pass.product_name || targetProd.name} - loaded into register`, { icon: '🔄' });
            } else {
              toast.error('Product not found in current inventory');
            }
          }}
          onOpenScanner={() => setIsScannerOpen(true)}
        />
      )}

      {/* 58mm/80mm Thermal Receipt Modal */}
      {receiptData && (
        <div 
          onClick={() => setReceiptData(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 print:p-0 print:bg-white print:block"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative bg-surface-muted/40 dark:bg-[#161616] w-full max-w-sm rounded-card shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh] border-0 print:shadow-none print:rounded-none print:max-h-none print:h-auto print:max-w-none"
          >
            <button 
              onClick={() => setReceiptData(null)} 
              className="absolute top-3 right-3 text-neutral-400 hover:text-white transition z-30 print-hidden cursor-pointer p-1"
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

                {/* Logo & Branch Area */}
                <div className="text-center mb-3">
                  <img src="/logo_dark.png" alt="Sokonimax" className="w-24 mx-auto grayscale object-contain mb-1.5" style={{ maxWidth: '96px', maxHeight: '42px' }} />
                  <p className="font-bold text-xs text-gray-900 uppercase">
                    {receiptData?.delivery_info?.location_name || activeLocation?.name || user?.business_name || 'Uzaspea Store'}
                  </p>
                  {(receiptData?.delivery_info?.location_address || activeLocation?.address) && (
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {receiptData?.delivery_info?.location_address || activeLocation?.address}
                    </p>
                  )}
                  {(receiptData?.delivery_info?.location_phone || activeLocation?.phone) && (
                    <p className="text-[10px] text-gray-600">
                      Tel: {receiptData?.delivery_info?.location_phone || activeLocation?.phone}
                    </p>
                  )}
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
                
                {/* Dining Order Type Tag */}
                {receiptData?.delivery_info?.order_type && receiptData.delivery_info.order_type !== 'walk_in' && (
                  <div className="text-center font-bold text-xs uppercase border-y border-dashed border-gray-400 py-1 mb-2">
                    {receiptData.delivery_info.order_type === 'dine_in' 
                      ? `🍽️ DINE-IN ${receiptData.delivery_info.table_number ? `(TABLE ${receiptData.delivery_info.table_number})` : ''}`
                      : '🥡 TAKEAWAY / PACKAGED'}
                  </div>
                )}

                {/* Items List */}
                <div className="border-t border-b border-dashed border-gray-400 py-2 mb-3">
                  <div className="flex font-bold text-xs mb-1">
                    <span className="flex-1">{t('item', 'Item')}</span>
                    <span className="text-right">{t('amount', 'Amt')}</span>
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
                        {item.selected_addons && item.selected_addons.length > 0 && (
                          <div className="pl-2 text-[10px] text-gray-600 space-y-0.5">
                            {item.selected_addons.map((add: any, ai: number) => (
                              <div key={ai} className="flex justify-between">
                                <span>+ {add.quantity > 1 ? `${add.quantity}x ` : ''}{add.name}</span>
                                <span>+{(parseFloat(add.price || 0) * (add.quantity || 1)).toLocaleString()}/=</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {item.attendant_name && (
                          <div className="text-[9px] text-gray-500 italic pl-2">
                            Served by: {item.attendant_name}
                          </div>
                        )}
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
                
                {/* Issued Member Service Passes */}
                {(receiptData.service_passes || []).map((sp: any) => (
                  <div key={sp.id} className="border-t border-dashed border-gray-400 mt-3 pt-2 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-700">MEMBER CHECK-IN PASS</p>
                    <p className="text-xs font-black">{sp.product_name} {sp.variant_name ? `(${sp.variant_name})` : ''}</p>
                    <p className="text-[10px] text-gray-600">MEMBER: {sp.customer_name}</p>
                    <p className="text-[10px] font-bold text-gray-800">VALID UNTIL: {new Date(sp.expires_at).toLocaleDateString()}</p>
                    <div className="flex justify-center my-2">
                      <QRCodeSVG value={`SKN:PASS:${sp.pass_code}`} size={76} level="M" />
                    </div>
                    <p className="text-[9px] text-gray-500">Scan at entrance on each visit</p>
                  </div>
                ))}

                {/* Drop-off Claim Ticket (Laundry / Repair) */}
                {receiptData?.delivery_info?.pickup_required && (
                  <div className="border-t border-dashed border-gray-400 mt-3 pt-2 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-700">CLAIM / PICKUP TICKET</p>
                    <p className="text-xs font-black">CLAIM #{receiptData.id}</p>
                    <p className="text-[10px] text-gray-600">CUSTOMER: {receiptData.delivery_info?.customer_name || 'Customer'}</p>
                    {receiptData.delivery_info?.pickup_promised_time && (
                      <p className="text-[10px] font-bold text-gray-800">READY BY: {receiptData.delivery_info.pickup_promised_time}</p>
                    )}
                    <div className="flex justify-center my-2">
                      <QRCodeSVG value={`SKN:CLM:${receiptData.id}`} size={76} level="M" />
                    </div>
                    <p className="text-[9px] text-gray-500">Present this ticket when picking up</p>
                  </div>
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
            
            <div className="p-3 flex justify-center gap-2 print-hidden shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 text-white border-0 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Printer size={14} /> {t('print_receipt', 'Print Receipt')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Paid Settlement Modal */}
      {markPaidModalData && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
          onClick={() => !markPaidSubmitting && setMarkPaidModalData(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#141416] border-0 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4 animate-scale-in"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {t('mark_invoice_as_paid', 'Mark as Paid & Record Sale')}
                </h3>
                <p className="text-2xs text-gray-400 mt-0.5">
                  INV-#{markPaidModalData.id} • {markPaidModalData.delivery_info?.customer_name || t('walk_in_customer', 'Walk-in Customer')}
                </p>
              </div>
              <button
                type="button"
                disabled={markPaidSubmitting}
                onClick={() => setMarkPaidModalData(null)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Amount Due Display */}
            <div className="p-3.5 rounded-xl bg-surface-muted/60 dark:bg-[#1a1a1e] flex items-center justify-between">
              <div>
                <span className="text-3xs uppercase tracking-wider font-bold text-gray-400 block">{t('total_payable', 'Total Payable')}</span>
                <span className="text-lg font-black text-gray-900 dark:text-white tabular-nums">
                  TSh {parseFloat(markPaidModalData.total_amount || 0).toLocaleString()}
                </span>
              </div>
              <span className="text-2xs font-bold text-amber-600 dark:text-amber-400">
                {t('unpaid', 'Unpaid')}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t('payment_method', 'Payment Method')}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { key: 'CASH', label: 'Cash' },
                  { key: 'LIPA_MPESA', label: 'M-Pesa' },
                  { key: 'AIRTEL_MONEY', label: 'Airtel Money' },
                  { key: 'TIGO_PESA', label: 'Tigo Pesa' },
                  { key: 'BANK_TRANSFER', label: 'Bank Transfer' },
                  { key: 'CARD', label: 'Card / POS' }
                ].map(m => {
                  const isSelected = markPaidMethod === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMarkPaidMethod(m.key as any)}
                      className={`py-2.5 px-2 rounded-xl text-2xs border-0 flex items-center justify-center transition cursor-pointer ${
                        isSelected
                          ? 'bg-brand-500 text-black font-bold shadow-xs'
                          : 'bg-surface-muted dark:bg-[#1a1a1e] text-gray-600 dark:text-gray-400 font-semibold hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <span className="truncate max-w-full">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cash Tendered & Change (If Cash) */}
            {markPaidMethod === 'CASH' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-2xs font-semibold text-gray-500 dark:text-gray-400">
                    {t('cash_tendered', 'Cash Tendered')}
                  </label>
                  {(() => {
                    const tendered = parseFloat(markPaidAmountTendered || '0');
                    const total = parseFloat(markPaidModalData.total_amount || 0);
                    const change = Math.max(0, tendered - total);
                    return tendered > 0 ? (
                      <span className={`text-2xs font-bold tabular-nums ${tendered >= total ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {tendered >= total ? t('change_amount', 'Change: TSh {{amount}}', { amount: change.toLocaleString() }) : t('remaining_amount', 'Remaining: TSh {{amount}}', { amount: (total - tendered).toLocaleString() })}
                      </span>
                    ) : null;
                  })()}
                </div>

                <div className="flex items-center rounded-xl bg-surface-muted dark:bg-[#1a1a1e] border-0 px-3 py-2">
                  <span className="text-xs font-semibold text-gray-400 mr-2">TSh</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={markPaidAmountTendered ? (parseFloat(markPaidAmountTendered) ? parseFloat(markPaidAmountTendered).toLocaleString('en-US') : markPaidAmountTendered) : ''}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/,/g, '').replace(/[^\d.]/g, '');
                      setMarkPaidAmountTendered(clean);
                    }}
                    className="w-full bg-transparent text-sm font-semibold text-gray-900 dark:text-white outline-none tabular-nums"
                  />
                </div>

                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setMarkPaidAmountTendered(String(markPaidModalData.total_amount))}
                    className="flex-1 py-1.5 text-3xs font-semibold rounded-lg bg-surface-muted dark:bg-[#1a1a1e] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-800 transition cursor-pointer border-0"
                  >
                    {t('exact', 'Exact')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const tot = parseFloat(markPaidModalData.total_amount || 0);
                      setMarkPaidAmountTendered(String(Math.ceil(tot / 10000) * 10000));
                    }}
                    className="flex-1 py-1.5 text-3xs font-semibold rounded-lg bg-surface-muted dark:bg-[#1a1a1e] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-800 transition cursor-pointer border-0"
                  >
                    +Round 10k
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const tot = parseFloat(markPaidModalData.total_amount || 0);
                      setMarkPaidAmountTendered(String(Math.ceil((tot + 1) / 50000) * 50000));
                    }}
                    className="flex-1 py-1.5 text-3xs font-semibold rounded-lg bg-surface-muted dark:bg-[#1a1a1e] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-800 transition cursor-pointer border-0"
                  >
                    +Round 50k
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-2xs font-semibold text-gray-500 dark:text-gray-400">
                  {t('reference_number', 'Transaction / Reference # (Optional)')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. QK8927X29 or Bank Slip Reference"
                  value={markPaidReference}
                  onChange={(e) => setMarkPaidReference(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-muted dark:bg-[#1a1a1e] border-0 text-xs font-semibold text-gray-900 dark:text-white outline-none transition"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={markPaidSubmitting}
                onClick={() => setMarkPaidModalData(null)}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs text-gray-600 dark:text-gray-400 hover:bg-neutral-100 dark:hover:bg-[#1a1a1e] transition cursor-pointer"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={markPaidSubmitting}
                onClick={handleConfirmMarkPaid}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-brand-500 hover:bg-brand-600 text-black flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer shadow-xs disabled:opacity-50"
              >
                {markPaidSubmitting && <Loader2 size={14} className="animate-spin text-black" />}
                <span>{markPaidSubmitting ? t('processing', 'Processing...') : t('confirm_and_record_sale', 'Confirm & Record Sale')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal (80mm Proforma / Tax Invoice) */}
      {invoiceModalData && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
          onClick={() => setInvoiceModalData(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white dark:bg-[#161616] w-full max-w-sm rounded-card shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh] border-0"
          >
            <div className="flex items-center justify-between p-3.5 pb-1">
              <span className="text-xs font-bold text-gray-900 dark:text-white">
                {t('proforma_invoice', 'Proforma / POS Invoice')}
              </span>
              <div className="flex items-center gap-1.5">
                {invoiceModalData.status === 'INVOICE_GENERATED' && (
                  <button
                    type="button"
                    onClick={() => {
                      const inv = invoiceModalData;
                      setInvoiceModalData(null);
                      handleOpenMarkPaid(inv);
                    }}
                    className="inline-flex items-center px-2.5 py-1 text-2xs font-bold bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg transition cursor-pointer"
                  >
                    <span>{t('mark_paid', 'Mark Paid')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePrintInvoice}
                  className="inline-flex items-center px-2.5 py-1 text-2xs font-bold bg-brand-500 hover:bg-brand-600 text-black rounded-lg transition cursor-pointer"
                >
                  <span>{t('print', 'Print')}</span>
                </button>
                <button
                  onClick={() => setInvoiceModalData(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white transition cursor-pointer"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1 flex justify-center scrollbar-thin">
              <div
                id="invoice-content"
                ref={invoicePrintRef}
                className="bg-white text-black p-5 w-[80mm] min-w-[80mm] max-w-[80mm] shadow-md rounded-xl relative my-1 text-left"
                style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '12px', lineHeight: '1.4' }}
              >
                {/* Store Header */}
                <div className="text-center mb-3">
                  <img src="/logo_dark.png" alt="Sokonimax" className="w-24 mx-auto grayscale object-contain mb-1.5" style={{ maxWidth: '96px', maxHeight: '42px' }} />
                  <p className="font-bold text-xs text-gray-900 uppercase">
                    {invoiceModalData?.delivery_info?.location_name || activeLocation?.name || user?.business_name || 'Uzaspea Store'}
                  </p>
                  {(invoiceModalData?.delivery_info?.location_address || activeLocation?.address) && (
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {invoiceModalData?.delivery_info?.location_address || activeLocation?.address}
                    </p>
                  )}
                  {(invoiceModalData?.delivery_info?.location_phone || activeLocation?.phone) && (
                    <p className="text-[10px] text-gray-600">
                      Tel: {invoiceModalData?.delivery_info?.location_phone || activeLocation?.phone}
                    </p>
                  )}
                </div>

                {/* Document Title & Status Banner */}
                <div className="border-t border-dashed border-gray-400 py-2 mb-2 text-center text-xs">
                  <p className="font-extrabold tracking-wide uppercase">
                    {invoiceModalData.status === 'COMPLETED' ? t('tax_invoice', 'TAX INVOICE') : t('proforma_invoice', 'PROFORMA INVOICE')}
                  </p>
                  <p className="font-bold">INV-#{invoiceModalData.id}</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    {new Date(invoiceModalData.order_date || invoiceModalData.created_at || Date.now()).toLocaleString()}
                  </p>
                  <div className="mt-1">
                    {invoiceModalData.status === 'COMPLETED' ? (
                      <span className="font-bold text-black text-[10px]">
                        [ PAID - SALE COMPLETED ]
                      </span>
                    ) : invoiceModalData.status === 'CANCELLED' ? (
                      <span className="font-bold text-gray-600 text-[10px]">
                        [ CANCELLED ]
                      </span>
                    ) : (
                      <span className="font-bold text-black text-[10px]">
                        [ UNPAID - PAYMENT DUE ]
                      </span>
                    )}
                  </div>
                </div>

                {/* Bill To & Terms */}
                <div className="text-xs mb-3 space-y-0.5">
                  <p><strong>{t('customer', 'Customer:')}</strong> {invoiceModalData?.delivery_info?.customer_name || t('walk_in_customer', 'Walk-in Customer')}</p>
                  {invoiceModalData?.delivery_info?.customer_phone && (
                    <p><strong>{t('phone', 'Phone:')}</strong> {invoiceModalData.delivery_info.customer_phone}</p>
                  )}
                  {invoiceModalData?.delivery_info?.customer_tin && (
                    <p><strong>TIN / VRN:</strong> {invoiceModalData.delivery_info.customer_tin}</p>
                  )}
                  {invoiceModalData?.delivery_info?.due_date && (
                    <p><strong>{t('valid_until', 'Valid Until:')}</strong> {new Date(invoiceModalData.delivery_info.due_date).toLocaleDateString()} {invoiceModalData.delivery_info?.validity_period ? `(${invoiceModalData.delivery_info.validity_period})` : ''}</p>
                  )}
                  <p><strong>{t('issued_by', 'Issued By:')}</strong> {(user as any)?.first_name && (user as any)?.last_name ? `${(user as any).first_name} ${(user as any).last_name}` : user?.username || 'Store'}</p>
                </div>

                {/* Items List */}
                <div className="border-t border-b border-dashed border-gray-400 py-2 mb-3">
                  <div className="flex font-bold text-xs mb-1">
                    <span className="flex-1">{t('item', 'Item')}</span>
                    <span className="text-right">{t('amount', 'Amt')}</span>
                  </div>

                  {(invoiceModalData.relevant_items || invoiceModalData.items || invoiceModalData.orderitem_set || []).map((item: any, i: number) => {
                    const price = parseFloat(item.price) || 0;
                    const qty = parseInt(item.quantity) || 1;
                    const total = price * qty;
                    const name = item.product?.name || item.product_name || `Product #${item.product_id || item.product || i + 1}`;
                    const variantName = item.variant?.name || item.variant_name;

                    return (
                      <div key={i} className="text-[11px] mb-2 last:mb-0">
                        <div className="font-bold whitespace-normal leading-tight">{name}</div>
                        {variantName && <div className="text-[10px] text-gray-600">[{variantName}]</div>}
                        {item.selected_addons && item.selected_addons.length > 0 && (
                          <div className="pl-2 text-[10px] text-gray-600 space-y-0.5">
                            {item.selected_addons.map((add: any, ai: number) => (
                              <div key={ai} className="flex justify-between">
                                <span>+ {add.quantity > 1 ? `${add.quantity}x ` : ''}{add.name}</span>
                                <span>+{(parseFloat(add.price || 0) * (add.quantity || 1)).toLocaleString()}/=</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {item.attendant_name && (
                          <div className="text-[9px] text-gray-500 italic pl-2">
                            Served by: {item.attendant_name}
                          </div>
                        )}
                        <div className="flex justify-between mt-0.5">
                          <span className="text-gray-600">{qty} x {price.toLocaleString()}/=</span>
                          <span className="font-bold">{total.toLocaleString()}/=</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Subtotal & Discount */}
                {(() => {
                  const discountVal = parseFloat(invoiceModalData?.discount_amount || invoiceModalData?.delivery_info?.discount_amount || 0);
                  const rawTot = parseFloat(invoiceModalData?.total_amount || 0);
                  const subtotalVal = rawTot + discountVal;
                  return (
                    <div className="space-y-1 mb-2 text-xs">
                      {discountVal > 0 && (
                        <>
                          <div className="flex justify-between text-gray-600">
                            <span>{t('subtotal', 'SUBTOTAL')}</span>
                            <span>{Math.round(subtotalVal).toLocaleString()}/=</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>{t('discount', 'DISCOUNT')}</span>
                            <span>-{Math.round(discountVal).toLocaleString()}/=</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between font-extrabold text-sm border-t border-dashed border-gray-400 pt-1">
                        <span>{t('total_due', 'TOTAL DUE')}</span>
                        <span>TSh {Math.round(rawTot).toLocaleString()}/=</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Payment Instructions & QR */}
                <div className="border-t border-dashed border-gray-400 pt-2 mt-2 text-[11px] space-y-1 text-center">
                  <p className="font-bold uppercase tracking-wide">{t('payment_instructions', 'Payment Instructions')}</p>
                  <p className="text-[10px] text-gray-700">
                    Please quote <strong>INV-#{invoiceModalData.id}</strong> as payment reference.
                  </p>
                  {invoiceModalData?.delivery_info?.notes && (
                    <p className="text-[10px] italic text-gray-600 mt-1">
                      "{invoiceModalData.delivery_info.notes}"
                    </p>
                  )}
                  <div className="flex justify-center pt-2">
                    {user?.username && (
                      <QRCodeSVG value={`${window.location.origin}/${user.username}`} size={56} level="L" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POS Continuous Camera Scanner Modal */}
      <POSContinuousScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        products={products}
        cart={cart}
        cartTotal={cartTotal}
        addToCart={addToCart}
        onSelectProductForCustomization={(p) => setSelectedProductForOptions(p)}
        t={t}
      />

      {/* POS Mode & Feature Settings Modal */}
      <POSModeSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={posConfig}
        onSave={handleUpdateConfig}
      />

      {/* Product Options & Variations Modal Overlay */}
      {selectedProductForOptions && (
        <POSVariantMatrixOverlay
          product={selectedProductForOptions}
          cart={cart}
          addToCart={addToCart}
          onClose={() => setSelectedProductForOptions(null)}
          t={t}
          posConfig={posConfig}
        />
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
  submitting,
  checkoutMode = 'sale',
  setCheckoutMode,
  handleCreateInvoice,
  customerPhone = '',
  setCustomerPhone,
  customerTin = '',
  setCustomerTin,
  validityPeriod = '7d',
  setValidityPeriod,
  invoiceNotes = '',
  setInvoiceNotes,
  orderType = 'walk_in',
  setOrderType,
  tableNumber = '',
  setTableNumber,
  pickupRequired = false,
  setPickupRequired,
  pickupPromisedTime = '',
  setPickupPromisedTime,
  posConfig
}: any) => {
  const { t } = useTranslation();
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [showCustomDiscount, setShowCustomDiscount] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [cartDropdownOpen, setCartDropdownOpen] = useState(false);

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
    <div className="flex flex-col flex-1 h-full bg-white dark:bg-[#141414]">
      {/* 1. Customer Info & Header Controls */}
      <div className="px-3.5 pt-3 pb-1 space-y-1.5 shrink-0">
        {/* Row 1: Customer Name + Customer Phone in the same horizontal space + Items Count */}
        <div className="flex items-center gap-1.5">
          {/* Customer Name */}
          <div className="h-8 flex items-center gap-1.5 flex-1 min-w-0 bg-neutral-100 dark:bg-neutral-800/80 rounded-xl px-2.5 transition-colors focus-within:ring-1 focus-within:ring-neutral-400 dark:focus-within:ring-neutral-600">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t('walk_in_customer', 'Walk-in Customer')}
              className="bg-transparent border-0 text-xs font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-0 w-full p-0 leading-tight outline-none truncate"
              title={t('customer', 'Customer')}
            />
            {customerName && customerName !== t('walk_in_customer', 'Walk-in Customer') && customerName !== 'Walk-in Customer' && (
              <button
                type="button"
                onClick={() => setCustomerName(t('walk_in_customer', 'Walk-in Customer'))}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xs font-medium shrink-0 p-0.5 rounded transition cursor-pointer"
                title={t('reset_walk_in', 'Reset to Walk-in')}
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Customer Phone */}
          <div className="h-8 flex items-center gap-1 flex-1 min-w-0 bg-neutral-100 dark:bg-neutral-800/80 rounded-xl px-2.5 transition-colors focus-within:ring-1 focus-within:ring-neutral-400 dark:focus-within:ring-neutral-600">
            <Phone size={11} className="text-gray-400 shrink-0" />
            <input
              type="tel"
              value={customerPhone}
              maxLength={10}
              onChange={(e) => {
                let rawDigits = e.target.value.replace(/\D/g, '');
                if (rawDigits.startsWith('255') && rawDigits.length > 10) {
                  rawDigits = '0' + rawDigits.slice(3);
                }
                const cleaned = rawDigits.slice(0, 10);
                if (setCustomerPhone) {
                  setCustomerPhone(cleaned);
                }
              }}
              placeholder="Phone (07...)"
              className="w-full bg-transparent border-0 text-xs text-gray-800 dark:text-neutral-200 placeholder:text-gray-400 outline-none p-0 focus:ring-0 focus:outline-none truncate"
              title="Customer Phone"
            />
            {customerPhone && (
              <button
                type="button"
                onClick={() => setCustomerPhone && setCustomerPhone('')}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xs shrink-0 cursor-pointer"
                title="Clear phone"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Items count: locked shrink-0 with tabular-nums so 2 digits (e.g. 12 items, 99 items) never wrap or break */}
          <div className="shrink-0 flex items-center justify-end pl-1">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
              {cart.reduce((s: number, i: any) => s + i.quantity, 0)} {cart.reduce((s: number, i: any) => s + i.quantity, 0) === 1 ? t('item_one', 'item') : t('item_other', 'items')}
            </span>
          </div>
        </div>

        {/* Row 2: Dining Selector (if enabled) + Drop-off / Claim (if enabled) */}
        {(posConfig?.enableDiningModes || posConfig?.enableDropOffClaim) && (
          <div className="flex items-center justify-between gap-2 px-0.5 text-2xs">
            {posConfig?.enableDiningModes ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-800/80 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setOrderType && setOrderType('walk_in')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                      orderType === 'walk_in' ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:text-neutral-400'
                    }`}
                  >
                    Walk-in
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType && setOrderType('dine_in')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1 ${
                      orderType === 'dine_in' ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:text-neutral-400'
                    }`}
                  >
                    <span>Dine-in</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType && setOrderType('takeaway')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1 ${
                      orderType === 'takeaway' ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:text-neutral-400'
                    }`}
                  >
                    <span>Takeaway</span>
                  </button>
                </div>

                {orderType === 'dine_in' && (
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber && setTableNumber(e.target.value)}
                    placeholder="Table #"
                    className="w-16 px-1.5 py-0.5 text-2xs bg-gray-100 dark:bg-neutral-800 border-none rounded-md text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-amber-500 text-center font-bold"
                  />
                )}
              </div>
            ) : <div className="flex-1" />}

            {posConfig?.enableDropOffClaim && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0 text-3xs text-gray-500 hover:text-gray-700 dark:text-neutral-400">
                <input
                  type="checkbox"
                  checked={pickupRequired}
                  onChange={(e) => setPickupRequired && setPickupRequired(e.target.checked)}
                  className="rounded accent-amber-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Drop-off / Claim</span>
              </label>
            )}
          </div>
        )}

        {posConfig?.enableDropOffClaim && pickupRequired && (
          <div className="px-3 py-1.5 bg-amber-500/10 rounded-xl flex items-center justify-between gap-2 text-3xs text-amber-700 dark:text-amber-300">
            <span>Ready time / date:</span>
            <input
              type="text"
              value={pickupPromisedTime}
              onChange={(e) => setPickupPromisedTime && setPickupPromisedTime(e.target.value)}
              placeholder="e.g. Thu 3:00 PM"
              className="bg-white dark:bg-neutral-900 border border-amber-500/30 rounded px-1.5 py-0.5 text-3xs outline-none text-gray-900 dark:text-white"
            />
          </div>
        )}
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
                {item.addons && item.addons.length > 0 && (
                  <div className="text-[10px] text-amber-500/90 space-y-0.5 mt-0.5">
                    {item.addons.map((a: any, idx: number) => (
                      <span key={idx} className="block truncate">
                        + {a.quantity > 1 ? `${a.quantity}x ` : ''}{a.name} (+{(a.price * a.quantity).toLocaleString()})
                      </span>
                    ))}
                  </div>
                )}
                {item.attendant_name && (
                  <span className="text-[9px] text-emerald-500 font-medium block mt-0.5 italic">
                    Staff: {item.attendant_name}
                  </span>
                )}
                <span className="text-2xs text-gray-400 tabular-nums">
                  TSh {item.price.toLocaleString()}
                </span>
              </div>

              {/* Stepper + Item Total */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="flex items-center rounded-full bg-gray-100 dark:bg-neutral-800 h-7 sm:h-8 px-1 border-0 select-none shrink-0">
                  <button 
                    type="button"
                    onClick={() => updateQuantity(item.id, -1)} 
                    disabled={item.quantity <= 1} 
                    className="w-5 sm:w-6 h-full flex items-center justify-center font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white disabled:opacity-20 transition cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <span className="leading-none">−</span>
                  </button>
                  <CartQuantityInput
                    quantity={item.quantity}
                    maxStock={item.max_stock}
                    onChangeQty={(newQ) => setQuantity ? setQuantity(item.id, newQ) : null}
                    className="w-5 sm:w-6 text-center font-bold text-xs text-gray-900 dark:text-white bg-transparent border-none outline-none p-0 tabular-nums select-all cursor-text"
                  />
                  <button 
                    type="button"
                    onClick={() => updateQuantity(item.id, 1)} 
                    disabled={item.quantity >= item.max_stock} 
                    className="w-5 sm:w-6 h-full flex items-center justify-center font-bold text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white disabled:opacity-20 transition cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <span className="leading-none">+</span>
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
      <div className="px-4 py-2.5 shrink-0">
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

      {/* 4. Checkout Footer with Refined Typography & Split-Button Action */}
      <div className="p-4 shrink-0 space-y-3.5 bg-white dark:bg-[#141414] mt-auto">
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

        {/* Mode-Specific Inputs: Cash Tendered (Sale Mode) vs Invoice Metadata & Validity Presets (Invoice Mode) */}
        {checkoutMode === 'sale' ? (
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
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-3xs font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
                  {t('customer_phone', 'Customer Phone')}
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="0712345678"
                  value={customerPhone}
                  onChange={(e) => {
                    let rawDigits = e.target.value.replace(/\D/g, '');
                    if (rawDigits.startsWith('255') && rawDigits.length > 10) {
                      rawDigits = '0' + rawDigits.slice(3);
                    }
                    const cleaned = rawDigits.slice(0, 10);
                    if (setCustomerPhone) setCustomerPhone(cleaned);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-muted dark:bg-[#1a1a1e] border-0 text-xs text-gray-900 dark:text-white outline-none transition"
                />
              </div>
              <div>
                <label className="text-3xs font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
                  {t('customer_tin', 'TIN / VRN (Opt)')}
                </label>
                <input
                  type="text"
                  placeholder="123-456-789"
                  value={customerTin}
                  onChange={(e) => setCustomerTin && setCustomerTin(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-muted dark:bg-[#1a1a1e] border-0 text-xs text-gray-900 dark:text-white outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="text-3xs font-bold uppercase tracking-wider text-gray-400 block mb-1">
                {t('invoice_validity', 'Invoice Validity Period')}
              </label>
              <div className="grid grid-cols-5 gap-1">
                {[
                  { key: '24h', label: '24h' },
                  { key: '3d', label: '3 Days' },
                  { key: '7d', label: '7 Days' },
                  { key: '14d', label: '14 Days' },
                  { key: '30d', label: '30 Days' },
                ].map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setValidityPeriod && setValidityPeriod(p.key)}
                    className={`py-1 rounded-lg text-3xs font-bold transition cursor-pointer ${
                      validityPeriod === p.key
                        ? 'bg-amber-500 text-black'
                        : 'bg-surface-muted dark:bg-[#1a1a1e] text-gray-600 dark:text-gray-400 border-0 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <input
                type="text"
                placeholder={t('invoice_notes_placeholder', 'Add note or terms (optional)...')}
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes && setInvoiceNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-surface-muted dark:bg-[#1a1a1e] border-0 text-xs text-gray-900 dark:text-white outline-none transition"
              />
            </div>
          </div>
        )}

        {/* Action Button: Single Complete Sale button if invoices disabled, or Split Action Button if invoices enabled */}
        {posConfig?.enableInvoices ? (
          <div className="relative flex items-stretch rounded-xl shadow-sm">
            <button 
              type="button"
              onClick={checkoutMode === 'sale' ? handleCheckout : handleCreateInvoice} 
              disabled={cart.length === 0 || submitting}
              className={`flex-1 py-3 px-4 rounded-l-xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                checkoutMode === 'sale'
                  ? 'bg-brand-500 hover:bg-brand-400 text-black'
                  : 'bg-amber-500 hover:bg-amber-400 text-black'
              }`}
            >
              {checkoutMode === 'sale' ? (
                <>
                  <Receipt size={15} className="shrink-0 text-black stroke-[2.2]" />
                  <span className="text-black font-bold tracking-wide">
                    {submitting ? t('processing_sale', 'Processing sale...') : t('complete_sale', 'Complete Sale')}
                  </span>
                </>
              ) : (
                <>
                  <FileText size={15} className="shrink-0 text-black stroke-[2.2]" />
                  <span className="text-black font-bold tracking-wide">
                    {submitting ? t('generating_invoice', 'Generating invoice...') : t('generate_invoice', 'Generate Invoice')}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={cart.length === 0 || submitting}
              onClick={() => setCartDropdownOpen(prev => !prev)}
              aria-label="Select checkout action"
              className={`px-3 border-l rounded-r-xl transition flex items-center justify-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                checkoutMode === 'sale'
                  ? 'bg-brand-500 hover:bg-brand-400 text-black border-black/15'
                  : 'bg-amber-500 hover:bg-amber-400 text-black border-black/15'
              }`}
            >
              <ChevronDown size={14} className={`transition-transform duration-150 ${cartDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {cartDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCartDropdownOpen(false)} />
                <div className="absolute right-0 bottom-full mb-2 w-64 bg-neutral-800 text-white border-0 rounded-2xl shadow-2xl z-50 p-1.5 animate-in fade-in duration-150">
                  <div className="px-2.5 py-1.5 text-3xs font-bold uppercase tracking-wider text-neutral-400">
                    {t('select_action', 'Select POS Action')}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (setCheckoutMode) setCheckoutMode('sale');
                      setCartDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition cursor-pointer mt-0.5 ${
                      checkoutMode === 'sale'
                        ? 'bg-neutral-700 text-white font-bold'
                        : 'text-neutral-300 hover:text-white hover:bg-neutral-700/60'
                    }`}
                  >
                    <div>
                      <div className="font-bold flex items-center justify-between gap-1.5">
                        <span>{t('complete_sale', 'Complete Sale')}</span>
                        {checkoutMode === 'sale' && <Check size={12} className="text-amber-500" />}
                      </div>
                      <p className="text-[10px] text-neutral-400 font-normal mt-0.5">
                        {t('complete_sale_desc', 'Deduct stock immediately & print cash receipt')}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (setCheckoutMode) setCheckoutMode('invoice');
                      setCartDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition cursor-pointer mt-0.5 ${
                      checkoutMode === 'invoice'
                        ? 'bg-neutral-700 text-white font-bold'
                        : 'text-neutral-300 hover:text-white hover:bg-neutral-700/60'
                    }`}
                  >
                    <div>
                      <div className="font-bold flex items-center justify-between gap-1.5">
                        <span>{t('generate_invoice', 'Generate Invoice')}</span>
                        {checkoutMode === 'invoice' && <Check size={12} className="text-amber-500" />}
                      </div>
                      <p className="text-[10px] text-neutral-400 font-normal mt-0.5">
                        {t('generate_invoice_desc', 'Issue unpaid proforma / quote with payment terms')}
                      </p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button 
            type="button"
            onClick={handleCheckout} 
            disabled={cart.length === 0 || submitting}
            className="w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 bg-brand-500 hover:bg-brand-400 text-black shadow-sm"
          >
            <Receipt size={15} className="shrink-0 text-black stroke-[2.2]" />
            <span className="text-black font-bold tracking-wide">
              {submitting ? t('processing_sale', 'Processing sale...') : t('complete_sale', 'Complete Sale')}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default DashboardPOS;
