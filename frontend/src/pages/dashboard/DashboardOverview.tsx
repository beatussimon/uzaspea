import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { 
  Package, ShoppingCart, Banknote, Star, AlertTriangle, Printer, 
  ChevronDown, Check, Sparkles, Users, UserCheck, Clock, CheckCircle2, 
  Tag, Receipt
} from 'lucide-react';
import { 
  useStoreBusinessMode, 
  BUSINESS_MODE_CONFIG, 
  StoreBusinessMode 
} from '../../services/storeBusinessModeService';
import { KpiCard } from '../../components/ui/KpiCard';
import { ReportPrintHeader } from '../../components/print/ReportPrintHeader';
import { DateRangePicker, DateRange } from '../../components/ui/DateRangePicker';
import { LocationSelector } from '../../components/dashboard/LocationSelector';
import { useAuth, useUserRoles } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { printElement } from '../../utils/printHelper';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Area, AreaChart
} from 'recharts';
const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];
import { SHORT_STATUS_LABELS as STATUS_LABELS } from '../../constants/orderStatus';

const formatCompactCurrency = (rawNum: number | string | undefined | null, currency = 'TSh') => {
  if (rawNum === undefined || rawNum === null) return `${currency} 0`;
  const num = typeof rawNum === 'string' ? parseFloat(rawNum.replace(/,/g, '')) : Number(rawNum);
  if (!num || isNaN(num)) return `${currency} 0`;
  if (num >= 1_000_000_000) {
    return `${currency} ${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (num >= 1_000_000) {
    return `${currency} ${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (num >= 1_000) {
    return `${currency} ${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return `${currency} ${num.toLocaleString()}`;
};

import {
  KpiGridSkeleton,
  ChartSkeleton,
  TableSkeleton
} from '../../components/Skeleton';
import { cn } from '../../lib/utils';
import NetworkErrorState from '../../components/common/NetworkErrorState';
import { classifyApiError, type ClassifiedError } from '../../utils/errorUtils';

// ============ Dashboard Overview ============
const DashboardOverview: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, activeLocation } = useAuth();
  const roles = useUserRoles();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<ClassifiedError | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
    label: t('all_time', 'All Time')
  });

  const {
    businessMode,
    passExpiryWindow,
    setBusinessMode,
    setPassExpiryWindow,
    config,
    isRetailMode,
    isGymMode,
    isSalonMode,
    isRestaurantMode,
    isServiceMode,
    hasMemberships,
  } = useStoreBusinessMode(stats?.business_mode, stats?.membership_stats?.expiry_days);

  // Business Mode & Expiry Dropdowns
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [isExpiryMenuOpen, setIsExpiryMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const expiryMenuRef = useRef<HTMLDivElement>(null);

  // Top Products limit customization
  const [topProductsLimit, setTopProductsLimit] = useState<number>(10);
  const [isTopLimitOpen, setIsTopLimitOpen] = useState<boolean>(false);
  const [customTopInput, setCustomTopInput] = useState<string>('');
  const topLimitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (topLimitRef.current && !topLimitRef.current.contains(e.target as Node)) {
        setIsTopLimitOpen(false);
      }
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setIsModeMenuOpen(false);
      }
      if (expiryMenuRef.current && !expiryMenuRef.current.contains(e.target as Node)) {
        setIsExpiryMenuOpen(false);
      }
    };
    if (isTopLimitOpen || isModeMenuOpen || isExpiryMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isTopLimitOpen, isModeMenuOpen, isExpiryMenuOpen]);

  const fetchStats = React.useCallback(() => {
    setLoading(true);
    setFetchError(null);
    let url = '/api/products/seller_stats/';
    const params = new URLSearchParams();
    if (dateRange.startDate) params.append('start_date', dateRange.startDate);
    if (dateRange.endDate) params.append('end_date', dateRange.endDate);
    if (activeLocation?.id) params.append('location_id', String(activeLocation.id));
    params.append('top_limit', '50');
    params.append('business_mode', businessMode);
    params.append('expiry_days', String(passExpiryWindow));
    if (params.toString()) url += `?${params.toString()}`;

    api.get(url)
      .then((res) => {
        setStats(res.data);
        setFetchError(null);
      })
      .catch((err) => {
        setFetchError(classifyApiError(err));
      })
      .finally(() => setLoading(false));
  }, [dateRange, activeLocation, businessMode, passExpiryWindow]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const handleOffline = () => {
      if (loading && !stats) {
        setFetchError(classifyApiError({ code: 'ERR_NETWORK', message: 'Network Error' }));
        setLoading(false);
      }
    };
    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, [loading, stats]);

  const trendUp = (stats?.revenue_trend_pct || 0) >= 0;

  const kpis = useMemo(() => {
    // 1. Gym & Fitness Mode (Memberships / Passes Focus)
    if (businessMode === 'gym' || (hasMemberships && stats?.membership_stats?.active_passes > 0)) {
      return [
        {
          label: t('services_and_passes', 'Services & Passes'),
          value: stats?.total_services ?? stats?.total_products ?? 0,
          sub: `${stats?.total_products || 0} total listings`,
          icon: Tag,
        },
        {
          label: t('active_members', 'Active Members'),
          value: stats?.membership_stats?.active_passes || 0,
          sub: `${stats?.membership_stats?.total_passes_issued || 0} passes issued`,
          icon: UserCheck,
          className: 'border-emerald-500/30',
        },
        {
          label: t('revenue', `Revenue (${dateRange.label})`),
          value: formatCompactCurrency(stats?.total_revenue || 0),
          fullValue: `TSh ${(stats?.total_revenue || 0).toLocaleString()}`,
          icon: Banknote,
          trend: {
            value: `${Math.abs(stats?.revenue_trend_pct || 0)}%`,
            direction: trendUp ? 'up' as const : 'down' as const,
          },
        },
        {
          label: t('expiring_soon', `Expiring (${passExpiryWindow}d)`),
          value: stats?.membership_stats?.expiring_passes || 0,
          sub: 'renewal watchlist',
          icon: Clock,
          className: (stats?.membership_stats?.expiring_passes || 0) > 0 ? 'border-amber-500/40 text-amber-500' : undefined,
        },
        {
          label: t('check_ins', 'Club Check-ins'),
          value: stats?.membership_stats?.total_check_ins || 0,
          sub: 'member visits',
          icon: CheckCircle2,
        },
        {
          label: t('avg_rating', 'Avg Rating'),
          value: stats?.avg_rating || '—',
          sub: `${stats?.total_reviews || 0} reviews`,
          icon: Star,
        },
      ];
    }

    // 2. Salon & Spa or General Services Mode (Service & Client Focus)
    if (businessMode === 'salon' || businessMode === 'service') {
      return [
        {
          label: t('services', 'Services'),
          value: stats?.total_services ?? stats?.total_products ?? 0,
          sub: `${stats?.total_products || 0} offerings`,
          icon: Tag,
        },
        {
          label: t('clients_served', 'Clients Served'),
          value: stats?.total_orders || 0,
          sub: 'service bookings',
          icon: Users,
        },
        {
          label: t('revenue', `Revenue (${dateRange.label})`),
          value: formatCompactCurrency(stats?.total_revenue || 0),
          fullValue: `TSh ${(stats?.total_revenue || 0).toLocaleString()}`,
          icon: Banknote,
          trend: {
            value: `${Math.abs(stats?.revenue_trend_pct || 0)}%`,
            direction: trendUp ? 'up' as const : 'down' as const,
          },
        },
        {
          label: t('avg_rating', 'Avg Rating'),
          value: stats?.avg_rating || '—',
          sub: `${stats?.total_reviews || 0} reviews`,
          icon: Star,
        },
        {
          label: t('avg_ticket', 'Avg Ticket'),
          value: formatCompactCurrency(stats?.avg_order_value || 0),
          sub: 'per service client',
          icon: Receipt,
        },
        {
          label: t('top_category', 'Top Category'),
          value: stats?.category_breakdown?.[0]?.category || 'General',
          sub: `${stats?.category_breakdown?.[0]?.items || 0} rendered`,
          icon: Sparkles,
        },
      ];
    }

    // 3. Restaurant & Cafe Mode (Food & Dining Focus)
    if (businessMode === 'restaurant') {
      return [
        {
          label: t('menu_items', 'Menu Items'),
          value: stats?.total_products || 0,
          sub: 'food & drinks',
          icon: Tag,
        },
        {
          label: t('dining_orders', 'Orders Served'),
          value: stats?.total_orders || 0,
          sub: 'dine-in & takeaway',
          icon: ShoppingCart,
        },
        {
          label: t('revenue', `Revenue (${dateRange.label})`),
          value: formatCompactCurrency(stats?.total_revenue || 0),
          fullValue: `TSh ${(stats?.total_revenue || 0).toLocaleString()}`,
          icon: Banknote,
          trend: {
            value: `${Math.abs(stats?.revenue_trend_pct || 0)}%`,
            direction: trendUp ? 'up' as const : 'down' as const,
          },
        },
        {
          label: t('low_stock', 'Low Stock / Items Left'),
          value: stats?.stock_alerts?.length || 0,
          sub: 'drinks & food ≤ 3',
          icon: AlertTriangle,
          className: (stats?.stock_alerts?.length || 0) > 0 ? 'border-red-500/30' : undefined,
        },
        {
          label: t('avg_ticket', 'Avg Order Value'),
          value: formatCompactCurrency(stats?.avg_order_value || 0),
          sub: 'per dining ticket',
          icon: Receipt,
        },
        {
          label: t('top_category', 'Top Dish Category'),
          value: stats?.category_breakdown?.[0]?.category || 'Menu',
          sub: `${stats?.category_breakdown?.[0]?.items || 0} ordered`,
          icon: Sparkles,
        },
      ];
    }

    // 4. Retail (Physical Goods) & Hybrid Default
    return [
      {
        label: businessMode === 'hybrid' ? t('catalog_items', 'Catalog Items') : t('products', 'Products'),
        value: stats?.total_products || 0,
        sub: businessMode === 'hybrid' ? `${stats?.total_services || 0} services • ${stats?.total_physical_products || 0} goods` : undefined,
        icon: Package,
      },
      {
        label: t('orders', 'Orders'),
        value: stats?.total_orders || 0,
        icon: ShoppingCart,
      },
      {
        label: t('revenue', `Revenue (${dateRange.label})`),
        value: formatCompactCurrency(stats?.total_revenue || 0),
        fullValue: `TSh ${(stats?.total_revenue || 0).toLocaleString()}`,
        icon: Banknote,
        trend: {
          value: `${Math.abs(stats?.revenue_trend_pct || 0)}%`,
          direction: trendUp ? 'up' as const : 'down' as const,
        },
      },
      {
        label: t('avg_rating', 'Avg Rating'),
        value: stats?.avg_rating || '—',
        sub: `${stats?.total_reviews || 0} reviews`,
        icon: Star,
      },
      {
        label: t('low_stock', 'Low Stock'),
        value: stats?.stock_alerts?.length || 0,
        sub: 'items ≤ 3',
        icon: AlertTriangle,
        className: (stats?.stock_alerts?.length || 0) > 0 ? 'border-red-500/30' : undefined,
      },
      {
        label: roles.isSellerLite ? t('avg_order_value', 'Avg Order Value') : t('recommendation_reach', 'Rec Reach (30d)'),
        value: roles.isSellerLite ? formatCompactCurrency(stats?.avg_order_value || 0) : `${(stats?.rec_reach?.clicks || 0).toLocaleString()} clicks`,
        sub: roles.isSellerLite ? 'per checkout' : `${stats?.rec_reach?.orders || 0} orders • TSh ${(stats?.rec_reach?.revenue || 0).toLocaleString()}`,
        icon: roles.isSellerLite ? Receipt : Sparkles,
        className: 'border-brand-500/30',
      },
    ];
  }, [businessMode, hasMemberships, stats, dateRange.label, trendUp, passExpiryWindow, roles.isSellerLite, t]);

  // Prepare pie data
  const pieData = Object.entries(stats?.orders_by_status || {}).map(([k, v]) => ({ name: STATUS_LABELS[k] || k, value: v as number }));

  const printReportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPdf = async () => {
    if (!printReportRef.current) return;
    try {
      setIsExporting(true);
      await printElement(printReportRef.current, {
        pageTitle: `Store Analytics Report - SokoniMax`,
        pageStyle: `@page { size: A4 portrait; margin: 12mm 14mm; }`,
      });
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2 flex-nowrap min-w-0 min-h-[40px]">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white whitespace-nowrap sm:truncate shrink-0">
              {config.analyticsLabel}
            </h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 flex-nowrap">
            {/* Business Mode Dropdown Pill */}
            <div className="relative" ref={modeMenuRef}>
              <button
                type="button"
                onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 sm:py-2 text-xs font-semibold rounded-btn bg-surface-muted dark:bg-[#161616] hover:bg-surface-muted/80 dark:hover:bg-[#202020] text-gray-900 dark:text-white shrink-0 cursor-pointer transition select-none border-0"
                title="Switch business analytics mode"
              >
                <Tag size={13} className="text-amber-500 shrink-0" />
                <span className="hidden sm:inline font-bold">{config.shortLabel}</span>
                <ChevronDown size={11} className={`text-gray-400 transition-transform ${isModeMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isModeMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-[#141414] border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-2xl z-40 p-1.5 space-y-1 animate-fade-in text-gray-900 dark:text-gray-100">
                  <div className="px-2 py-1 text-3xs font-bold uppercase tracking-wider text-gray-400">
                    Business Mode Focus
                  </div>
                  {(Object.keys(BUSINESS_MODE_CONFIG) as StoreBusinessMode[]).map((mk) => {
                    const m = BUSINESS_MODE_CONFIG[mk];
                    const isSelected = businessMode === mk;
                    return (
                      <button
                        key={mk}
                        type="button"
                        onClick={() => {
                          setBusinessMode(mk);
                          setIsModeMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white font-bold'
                            : 'text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-neutral-800/50 font-medium'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="leading-tight truncate">{m.label.split('(')[0].trim()}</p>
                          <p className="text-[10px] text-gray-400 dark:text-neutral-500 font-normal truncate">{m.shortLabel}</p>
                        </div>
                        {isSelected && <Check size={13} className="text-amber-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <LocationSelector />
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <button 
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-bold rounded-btn bg-surface-muted dark:bg-[#161616] hover:bg-surface-muted/80 dark:hover:bg-[#202020] text-gray-900 dark:text-white shrink-0 whitespace-nowrap cursor-pointer transition border-0 disabled:opacity-50 active:scale-[0.97]"
              title="Export to PDF"
              aria-label="Export to PDF"
            >
              <Printer size={15} className="shrink-0" />
              <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export'}</span>
            </button>
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {isGymMode
            ? 'Real-time membership pass issuances, upcoming renewal watchlist, club check-ins, and revenue pipeline.'
            : isRestaurantMode
            ? 'Real-time dining orders, top-selling menu items, food & drink stock levels, and revenue.'
            : isServiceMode || isSalonMode
            ? 'Real-time service sales breakdown, client appointments, and treatment revenue.'
            : 'Real-time sales breakdown, order conversion pipeline, and inventory status.'}
        </p>
      </header>

      {/* Hidden Isolated Printable Report Header & Full Analytics Content for PDF Export */}
      <div className="hidden">
        <div ref={printReportRef} className="p-4 bg-white text-black font-sans w-full space-y-6">
          <ReportPrintHeader 
            title="Store Analytics & Sales Report" 
            user={{ ...user, store_profile: stats?.store_profile }} 
            date={`${new Date().toLocaleDateString()} (${dateRange.label})`}
            logoUrl="/logo_dark.png"
          />
          
          {/* KPI Metrics Summary Strip */}
          <div className="grid grid-cols-5 gap-4 py-2 text-center" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500">Total Products</p>
              <p className="text-sm font-black text-black mt-0.5">{stats?.total_products || 0}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500">Total Orders</p>
              <p className="text-sm font-black text-black mt-0.5">{stats?.total_orders || 0}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500">Total Revenue</p>
              <p className="text-sm font-black text-black mt-0.5">{kpis[2]?.fullValue || `TSh ${(stats?.total_revenue || 0).toLocaleString()}`}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500">Avg Rating</p>
              <p className="text-sm font-black text-black mt-0.5">{stats?.avg_rating || '—'} <span className="text-[10px] font-normal text-gray-500">({stats?.total_reviews || 0})</span></p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-500">Stock Alerts</p>
              <p className="text-sm font-black text-black mt-0.5">{stats?.stock_alerts?.length || 0}</p>
            </div>
          </div>

          {/* Section 1: Top Performing Products */}
          {stats?.top_products && stats.top_products.length > 0 && (
            <div className="space-y-2" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div className="flex items-center justify-between border-b border-gray-300 pb-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-black">
                  Top Performing Products ({dateRange.label})
                </h3>
                <span className="text-[10px] font-bold text-gray-500">
                  {stats.top_products.length} Products Ranked
                </span>
              </div>
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-gray-300 text-black">
                    <th className="py-1.5 px-2 w-12 text-center font-bold">RANK</th>
                    <th className="py-1.5 px-2 w-auto font-bold">PRODUCT NAME</th>
                    <th className="py-1.5 px-3 w-28 text-right font-bold">UNITS SOLD</th>
                    <th className="py-1.5 px-3 w-40 text-right font-bold">REVENUE (TZS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.top_products.map((p: any, idx: number) => (
                    <tr key={`print-top-${idx}-${p.name || ''}`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                      <td className="py-1.5 px-2 text-center font-bold text-gray-500">#{idx + 1}</td>
                      <td className="py-1.5 px-2 font-bold text-black truncate">{p.name}</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-black">{p.sold}</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-black">
                        {parseFloat(p.revenue || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="table-row-group" style={{ display: 'table-row-group' }}>
                  <tr className="border-t border-gray-300 font-bold" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <td colSpan={2} className="py-2 px-2 text-right text-2xs uppercase">TOTAL TOP PRODUCTS REVENUE:</td>
                    <td className="py-2 px-3 text-right font-mono font-black">
                      {stats.top_products.reduce((acc: number, item: any) => acc + (item.sold || 0), 0)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-black text-black">
                      {stats.top_products.reduce((acc: number, item: any) => acc + (parseFloat(item.revenue || 0)), 0).toLocaleString()} TZS
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Section 2: Store Products Catalog & Inventory Health */}
          {stats?.products_summary && stats.products_summary.length > 0 && (
            <div className="space-y-2" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div className="flex items-center justify-between border-b border-gray-300 pb-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-black">
                  Store Products Catalog & Stock Status
                </h3>
                <span className="text-[10px] font-bold text-gray-500">
                  {stats.products_summary.length} Items Listed
                </span>
              </div>
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-gray-300 text-black">
                    <th className="py-1.5 px-2 w-10 text-center font-bold">S/N</th>
                    <th className="py-1.5 px-2 w-auto font-bold">PRODUCT</th>
                    <th className="py-1.5 px-2 w-28 font-bold">SKU</th>
                    <th className="py-1.5 px-2 w-28 font-bold">CATEGORY</th>
                    <th className="py-1.5 px-3 w-32 text-right font-bold">PRICE (TZS)</th>
                    <th className="py-1.5 px-2 w-16 text-right font-bold">STOCK</th>
                    <th className="py-1.5 px-2 w-24 text-center font-bold">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.products_summary.map((prod: any, idx: number) => {
                    const isOutOfStock = prod.stock === 0;
                    const isLowStock = prod.stock > 0 && prod.stock <= 3;
                    return (
                      <tr key={`print-prod-${prod.id != null ? prod.id : idx}`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                        <td className="py-1.5 px-2 text-center text-gray-500 font-bold">{idx + 1}</td>
                        <td className="py-1.5 px-2 font-bold text-black truncate">{prod.name}</td>
                        <td className="py-1.5 px-2 text-gray-600 font-mono text-[11px]">{prod.sku || '-'}</td>
                        <td className="py-1.5 px-2 text-gray-600 truncate">{prod.category || '-'}</td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-black">
                          {parseFloat(prod.price || 0).toLocaleString()}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-black">{prod.stock}</td>
                        <td className="py-1.5 px-2 text-center text-[10px] font-bold">
                          {isOutOfStock ? (
                            <span className="text-red-600 uppercase">Out of Stock</span>
                          ) : isLowStock ? (
                            <span className="text-amber-600 uppercase">Low Stock</span>
                          ) : (
                            <span className="text-emerald-700 uppercase">In Stock</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="table-row-group" style={{ display: 'table-row-group' }}>
                  <tr className="border-t border-gray-300 font-bold" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <td colSpan={4} className="py-2 px-2 text-right text-2xs uppercase">TOTAL INVENTORY VALUE:</td>
                    <td className="py-2 px-3 text-right font-mono font-black">
                      {stats.products_summary.reduce((acc: number, p: any) => acc + (parseFloat(p.price || 0) * (p.stock || 0)), 0).toLocaleString()} TZS
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-black">
                      {stats.products_summary.reduce((acc: number, p: any) => acc + (p.stock || 0), 0)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Section 3: Items Sold Detailed Activity */}
          {stats?.items_sold_list && stats.items_sold_list.length > 0 && (
            <div className="space-y-2" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div className="flex items-center justify-between border-b border-gray-300 pb-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-black">
                  Items Sold Activity ({dateRange.label})
                </h3>
                <span className="text-[10px] font-bold text-gray-500">
                  {stats.items_sold_list.length} Records
                </span>
              </div>
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-gray-300 text-black">
                    <th className="py-1.5 px-1.5 w-8 text-center font-bold">S/N</th>
                    <th className="py-1.5 px-2 w-24 font-bold">DATE</th>
                    <th className="py-1.5 px-2 w-auto font-bold">PRODUCT</th>
                    <th className="py-1.5 px-2 w-12 text-right font-bold">QTY</th>
                    <th className="py-1.5 px-2 w-28 text-right font-bold">UNIT PRICE</th>
                    <th className="py-1.5 px-3 w-32 text-right font-bold">TOTAL REV</th>
                    <th className="py-1.5 px-2 w-24 text-center font-bold">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.items_sold_list.map((item: any, idx: number) => (
                    <tr key={`print-item-sold-${item.id != null ? item.id : ''}-${idx}`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                      <td className="py-1.5 px-1.5 text-center text-gray-500 font-bold">{idx + 1}</td>
                      <td className="py-1.5 px-2 text-gray-600 text-[11px] whitespace-nowrap">
                        {new Date(item.date).toLocaleDateString()}
                      </td>
                      <td className="py-1.5 px-2 font-bold text-black truncate">{item.product_name}</td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-black">{item.quantity}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-gray-700">
                        {parseFloat(item.price || 0).toLocaleString()}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-black">
                        {parseFloat(item.total || 0).toLocaleString()}
                      </td>
                      <td className="py-1.5 px-2 text-center text-[10px] font-semibold uppercase">
                        {item.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="table-row-group" style={{ display: 'table-row-group' }}>
                  <tr className="border-t border-gray-300 font-bold" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <td colSpan={3} className="py-2 px-2 text-right text-2xs uppercase">TOTAL SALES:</td>
                    <td className="py-2 px-2 text-right font-mono font-black">
                      {stats.items_sold_list.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0)}
                    </td>
                    <td></td>
                    <td className="py-2 px-3 text-right font-mono font-black text-black">
                      {stats.items_sold_list.reduce((acc: number, item: any) => acc + (parseFloat(item.total || 0)), 0).toLocaleString()} TZS
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Section 4: Low Stock Warnings */}
          {stats?.stock_alerts && stats.stock_alerts.length > 0 && (
            <div className="space-y-2" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div className="flex items-center justify-between border-b border-gray-300 pb-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-red-600">
                  Stock Depletion & Reorder Alerts
                </h3>
                <span className="text-[10px] font-bold text-red-600">
                  {stats.stock_alerts.length} Items Critical
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {stats.stock_alerts.map((s: any, idx: number) => (
                  <div key={`print-alert-${idx}-${s.name || ''}`} className="py-1 px-0 flex items-center justify-between text-xs" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <span className="font-bold text-black truncate pr-2">{s.name}</span>
                    <span className="font-mono font-extrabold text-red-600 shrink-0">
                      {s.stock === 0 ? 'OUT OF STOCK' : `${s.stock} left`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Report Footer */}
          <div className="pt-4 flex items-center justify-between text-[10px] text-gray-500" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            <span>Generated on {new Date().toLocaleString()} via SokoniMax Store Analytics</span>
            <span>All amounts in Tanzanian Shillings (TZS) • Confidential</span>
          </div>
        </div>
      </div>

      {loading && !stats ? (
        <div className="space-y-6">
          <KpiGridSkeleton count={5} cols={5} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ChartSkeleton type="area" />
            </div>
            <ChartSkeleton type="pie" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TableSkeleton rows={4} cols={4} />
            <TableSkeleton rows={4} cols={3} />
          </div>
        </div>
      ) : fetchError && !stats ? (
        <NetworkErrorState
          error={fetchError}
          onRetry={fetchStats}
          isRetrying={loading}
        />
      ) : (
        <div className={cn("space-y-6", loading && "opacity-75 transition-opacity")}>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 print-hide">
            {kpis.map((kpi, i) => (
              <KpiCard
                key={`kpi-${kpi.label || i}`}
                label={kpi.label}
                value={kpi.value}
                fullValue={kpi.fullValue}
                icon={kpi.icon}
                trend={kpi.trend}
                sub={kpi.sub}
                className={kpi.className}
              />
            ))}
          </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print-hide">
        {/* Revenue Area Chart */}
        <div className="lg:col-span-2 card !border-none p-5 flex flex-col h-[350px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>Revenue Pipeline</span>
              <span className="text-2xs font-normal text-gray-400">({dateRange.label})</span>
            </h3>
            <div className="flex items-center gap-2">
              {stats?.revenue_trend_pct !== undefined && (
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                  {stats.revenue_trend_pct >= 0 ? '+' : ''}{stats.revenue_trend_pct}%
                </span>
              )}
            </div>
          </div>
          <div className="h-[270px] w-full min-h-[270px] flex-1">
            {stats?.revenue_data && stats.revenue_data.length > 0 ? (
              <ResponsiveContainer width="100%" height={270} minWidth={0} minHeight={270} debounce={50}>
                <AreaChart data={stats.revenue_data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                  <XAxis 
                    dataKey="date" 
                    fontSize={10} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#888888' }}
                  />
                  <YAxis 
                    fontSize={10} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#888888' }}
                    tickFormatter={(v) => formatCompactCurrency(v, '')} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(18, 18, 18, 0.95)', 
                      borderColor: '#333333', 
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                      color: '#ffffff',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                    }}
                    formatter={(val: any) => [`TSh ${Number(val || 0).toLocaleString()}`, 'Revenue']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#3b82f6" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorRev)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                <p className="text-xs font-semibold">No revenue transactions in this period</p>
                <p className="text-3xs text-gray-500 mt-1">Sales will appear here as orders are placed</p>
              </div>
            )}
          </div>
        </div>

        {/* Status Pie Chart */}
        <div className="card !border-none p-5 flex flex-col h-[350px]">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Order Status</h3>
          <div className="h-[280px] w-full min-h-[280px]">
            <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={280} debounce={50}>
              <PieChart>
                <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-hide">
        {/* Top Performers */}
        <div className="card overflow-hidden !border-none !rounded-none !bg-transparent">
            <div className="h-12 px-3 bg-transparent flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white">{config.topPerformersLabel}</h3>
              
              <div className="flex items-center gap-2">
                {/* Customizable Limit Dropdown Pill */}
                <div className="relative" ref={topLimitRef}>
                  <button
                    type="button"
                    onClick={() => setIsTopLimitOpen(!isTopLimitOpen)}
                    className="text-[11px] font-medium text-gray-700 dark:text-gray-300 bg-surface-muted dark:bg-[#161616] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 transition select-none"
                    title="Customize item limit"
                  >
                    <span>Top {topProductsLimit}</span>
                    <ChevronDown size={11} className={`text-gray-400 transition-transform ${isTopLimitOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isTopLimitOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-[#141414] border border-gray-200 dark:border-neutral-800 rounded-xl shadow-xl z-30 p-1.5 space-y-1 animate-fade-in text-gray-900 dark:text-gray-100">
                      <div className="space-y-0.5">
                        {[3, 5, 10, 20].map((num) => {
                          const isSelected = topProductsLimit === num;
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => {
                                setTopProductsLimit(num);
                                setIsTopLimitOpen(false);
                              }}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition flex items-center justify-between ${
                                isSelected
                                  ? 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white font-semibold'
                                  : 'text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-neutral-800/50'
                              }`}
                            >
                              <span>Top {num}</span>
                              {isSelected && <Check size={12} className="text-gray-900 dark:text-white" />}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom count input */}
                      <div className="pt-1.5 border-t border-gray-100 dark:border-neutral-800/80 p-1 space-y-1.5">
                        <label className="block text-2xs font-medium text-gray-500 dark:text-neutral-400">Custom count</label>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const val = parseInt(customTopInput, 10);
                            if (!isNaN(val) && val > 0 && val <= 50) {
                              setTopProductsLimit(val);
                              setIsTopLimitOpen(false);
                              setCustomTopInput('');
                            } else {
                              toast.error('Enter a number between 1 and 50');
                            }
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <input
                            type="number"
                            min="1"
                            max="50"
                            placeholder="e.g. 15"
                            value={customTopInput}
                            onChange={(e) => setCustomTopInput(e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-neutral-800 rounded-lg text-gray-900 dark:text-white outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus:border-gray-400 dark:focus:border-neutral-600 transition"
                          />
                          <button
                            type="submit"
                            className="px-2.5 py-1 text-xs font-semibold bg-gray-900 text-white dark:bg-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-neutral-200 transition shrink-0"
                          >
                            Set
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left">
                <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-2xs uppercase tracking-wider text-gray-600 dark:text-gray-300 font-bold">
                  <tr>
                    <th className="px-3 py-2.5 font-bold w-10 text-center">#</th>
                    <th className="px-3 py-2.5 font-bold">{isServiceMode || isGymMode || isSalonMode ? 'Service / Pass' : isRestaurantMode ? 'Dish / Drink' : 'Product'}</th>
                    <th className="px-3 py-2.5 font-bold text-right">{isGymMode ? 'Passes' : isServiceMode || isSalonMode ? 'Rendered' : isRestaurantMode ? 'Ordered' : 'Sold'}</th>
                    <th className="px-3 py-2.5 font-bold text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.top_products || []).slice(0, topProductsLimit).map((p: any, i: number) => (
                    <tr key={`top-prod-${i}-${p.name || ''}`} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition text-xs">
                      <td className="px-3 py-2.5 text-center text-gray-400 font-medium">{i + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-gray-900 dark:text-white truncate max-w-[200px]" title={p.name}>
                        {p.name}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-gray-700 dark:text-gray-300">
                        {p.sold}
                      </td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-gray-900 dark:text-white whitespace-nowrap">
                        TSh {(p.revenue ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {(!stats?.top_products || stats.top_products.length === 0) && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-xs text-gray-400">
                        No sales recorded for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        {/* Right Widget: Membership Expirations Watchlist OR Service Categories OR Stock Alerts */}
        {!isRestaurantMode && !isRetailMode && (isGymMode || (hasMemberships && (stats?.membership_stats?.expiring_passes_list?.length || 0) > 0)) ? (
          <div className="card overflow-hidden !border-none !rounded-none !bg-transparent">
            <div className="h-12 px-3 bg-transparent flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                Membership Expirations Watchlist
              </h3>
              
              <div className="flex items-center gap-2">
                {/* Customizable Expiry Window Pill */}
                <div className="relative" ref={expiryMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsExpiryMenuOpen(!isExpiryMenuOpen)}
                    className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 bg-surface-muted dark:bg-[#161616] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 transition cursor-pointer select-none"
                    title="Change expiration alert window"
                  >
                    <span>Next {passExpiryWindow}d</span>
                    <ChevronDown size={11} className={`text-gray-400 transition-transform ${isExpiryMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpiryMenuOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-[#141414] border border-gray-200 dark:border-neutral-800 rounded-xl shadow-xl z-30 p-1.5 space-y-1 animate-fade-in text-gray-900 dark:text-gray-100">
                      <div className="px-2 py-1 text-3xs font-bold uppercase tracking-wider text-gray-400">
                        Renewal Alert Window
                      </div>
                      {[3, 7, 14, 30].map((days) => {
                        const isSelected = passExpiryWindow === days;
                        return (
                          <button
                            key={days}
                            type="button"
                            onClick={() => {
                              setPassExpiryWindow(days);
                              setIsExpiryMenuOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white font-semibold'
                                : 'text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-neutral-800/50'
                            }`}
                          >
                            <span>{days} Days {days === 7 ? '(Default)' : ''}</span>
                            {isSelected && <Check size={12} className="text-amber-500" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <span className="text-2xs font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider">
                  {stats?.membership_stats?.expiring_passes || 0} alerts
                </span>
              </div>
            </div>

            {(stats?.membership_stats?.expiring_passes_list || []).length > 0 ? (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left">
                  <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-2xs uppercase tracking-wider text-gray-600 dark:text-gray-300 font-bold">
                    <tr>
                      <th className="px-3 py-2.5 font-bold w-8 text-center">#</th>
                      <th className="px-3 py-2.5 font-bold">Member</th>
                      <th className="px-3 py-2.5 font-bold">Pass / Plan</th>
                      <th className="px-3 py-2.5 font-bold text-left whitespace-nowrap">Expires</th>
                      <th className="px-3 py-2.5 font-bold text-center w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.membership_stats.expiring_passes_list.map((p: any, i: number) => (
                      <tr key={`pass-exp-${p.id || i}`} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition text-xs">
                        <td className="px-3 py-2.5 text-center text-gray-400 font-medium">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white max-w-[180px]">
                          <div className="flex flex-col min-w-0">
                            <span className="truncate font-bold">{p.customer_name}</span>
                            {p.customer_phone && (
                              <span className="text-[10px] text-gray-400 dark:text-neutral-500 font-mono truncate">
                                {p.customer_phone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 dark:text-neutral-300 truncate max-w-[150px]" title={p.pass_name}>
                          {p.pass_name}
                        </td>
                        <td className="px-3 py-2.5 text-left whitespace-nowrap">
                          {p.days_remaining === 0 ? (
                            <span className="text-2xs font-extrabold uppercase text-red-500">Today</span>
                          ) : (
                            <span className="text-2xs font-bold text-amber-500">
                              {p.days_remaining}d left
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => navigate('/dashboard/pos', { state: { renewMemberPhone: p.customer_phone, renewMemberName: p.customer_name } })}
                            className="px-2.5 py-1 text-2xs font-bold bg-brand-500 hover:bg-brand-400 text-black rounded-lg transition shadow-2xs cursor-pointer"
                            title="Renew membership in POS"
                          >
                            Renew
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-gray-400 text-xs">
                All memberships active and in good standing 🎉
              </p>
            )}
          </div>
        ) : (isServiceMode || isSalonMode) && (stats?.category_breakdown?.length || 0) > 0 ? (
          /* Service Category Breakdown Table */
          <div className="card overflow-hidden !border-none !rounded-none !bg-transparent">
            <div className="h-12 px-3 bg-transparent flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                Service Category Breakdown
              </h3>
              <span className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                {stats?.category_breakdown?.length || 0} categories
              </span>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left">
                <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-2xs uppercase tracking-wider text-gray-600 dark:text-gray-300 font-bold">
                  <tr>
                    <th className="px-3 py-2.5 font-bold w-10 text-center">#</th>
                    <th className="px-3 py-2.5 font-bold">Category</th>
                    <th className="px-3 py-2.5 font-bold text-right">Rendered</th>
                    <th className="px-3 py-2.5 font-bold text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.category_breakdown.map((cat: any, i: number) => (
                    <tr key={`cat-${i}`} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition text-xs">
                      <td className="px-3 py-2.5 text-center text-gray-400 font-medium">{i + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-gray-900 dark:text-white truncate">
                        {cat.category}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-gray-700 dark:text-gray-300">
                        {cat.items}
                      </td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-gray-900 dark:text-white whitespace-nowrap">
                        TSh {Number(cat.revenue || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Low Stock Alerts (Physical Goods / Restaurant Drinks & Food Stock Alerts) */
          <div className="card overflow-hidden !border-none !rounded-none !bg-transparent">
            <div className="h-12 px-3 bg-transparent flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                {isRestaurantMode ? t('food_drink_stock_alerts', 'Food & Drink Stock Alerts') : t('stock_alerts', 'Stock Alerts')}
              </h3>
              <span className="text-2xs font-bold text-gray-400 uppercase tracking-wider">{stats?.stock_alerts?.length || 0} alerts</span>
            </div>
            {(stats?.stock_alerts?.length || 0) > 0 ? (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left">
                  <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-2xs uppercase tracking-wider text-gray-600 dark:text-gray-300 font-bold">
                    <tr>
                      <th className="px-3 py-2.5 font-bold w-10 text-center">#</th>
                      <th className="px-3 py-2.5 font-bold">{isRestaurantMode ? t('item_drink', 'Food / Drink Item') : t('product', 'Product')}</th>
                      <th className="px-3 py-2.5 font-bold text-left w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.stock_alerts.map((s: any, i: number) => (
                      <tr key={`stock-alert-${i}-${s.name || ''}-${s.location_name || ''}`} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition text-xs">
                        <td className="px-3 py-2.5 text-center text-gray-400 font-medium">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white max-w-[220px]" title={s.name}>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate">{s.name}</span>
                            {s.location_name && (
                              <span className="text-[10px] text-gray-400 dark:text-neutral-500 font-normal truncate">
                                {s.location_name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-left whitespace-nowrap w-28">
                          <span className={`text-xs font-semibold ${s.stock === 0 ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'}`}>
                            {s.stock === 0 ? 'Out of Stock' : `${s.stock} Left`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="px-5 py-8 text-center text-gray-400 text-xs">{isRestaurantMode ? 'All drinks and food items well-stocked 🎉' : 'All inventory well-stocked 🎉'}</p>}
          </div>
        )}
      </div>

      {/* Multi-Branch Performance Widget (Business Tier HQ Consolidated View) */}
      {stats?.location_breakdown && stats.location_breakdown.length > 0 && !activeLocation && (
        <div className="space-y-3 print-hide">
          <div className="flex items-start sm:items-center justify-between gap-3 px-1">
            <div className="space-y-0.5 min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                Branch Performance & Sales Contribution
              </h3>
              <p className="text-2xs sm:text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Consolidated revenue and fulfillment volume by physical store branch
              </p>
            </div>
            <span className="hidden sm:inline-block text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0">
              {stats.location_breakdown.length} Branches Active
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {stats.location_breakdown.map((b: any, idx: number) => {
              const sharePct = stats.total_revenue > 0 ? Math.round((b.revenue / stats.total_revenue) * 100) : 0;
              return (
                <div key={`loc-${b.location_id != null ? b.location_id : 'main'}-${idx}`} className="card !border-none p-3.5 sm:p-4 space-y-2.5 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-gray-900 dark:text-white truncate">
                      {b.name}
                    </span>
                    <span className="text-2xs font-bold text-gray-400 dark:text-neutral-500">
                      {sharePct}% of sales
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-black text-gray-900 dark:text-white">
                      TSh {Number(b.revenue || 0).toLocaleString()}
                    </span>
                    <span className="text-2xs text-gray-500 font-medium">
                      {b.orders} orders
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-neutral-800 overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(sharePct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Items Sold Activity List */}
      {(stats?.has_advanced_analytics || roles.isSellerLite || stats?.items_sold_list !== undefined) && (
        <div className="card overflow-hidden !border-none !rounded-none !bg-transparent print:shadow-none print:m-0 print:p-0">
          <div className="h-12 px-3 bg-transparent flex items-center justify-between gap-2 print-hide">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white">{config.salesActivityLabel} ({dateRange.label})</h3>
            {stats.items_sold_list && stats.items_sold_list.length > 0 && (
              <span className="text-2xs font-bold text-gray-400 uppercase tracking-wider">Recent {stats.items_sold_list.length}</span>
            )}
          </div>
          {stats.items_sold_list && stats.items_sold_list.length > 0 ? (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left">
                <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-2xs uppercase tracking-wider text-gray-600 dark:text-gray-300 font-bold">
                  <tr>
                    <th className="px-3 py-2.5 font-bold w-8 text-center">S/N</th>
                    <th className="px-3 py-2.5 font-bold whitespace-nowrap">Date & Time</th>
                    <th className="px-3 py-2.5 font-bold min-w-[150px]">{isServiceMode || isGymMode || isSalonMode ? 'Service / Pass' : isRestaurantMode ? 'Menu Item' : 'Product'}</th>
                    <th className="px-3 py-2.5 font-bold text-right">Qty</th>
                    <th className="px-3 py-2.5 font-bold text-right">Cost (Unit)</th>
                    <th className="px-3 py-2.5 font-bold text-right">Price (Unit)</th>
                    <th className="px-3 py-2.5 font-bold text-right">Total Rev</th>
                    <th className="px-3 py-2.5 font-bold text-center whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="print:divide-y print:divide-gray-300">
                  {stats.items_sold_list.map((item: any, idx: number) => (
                    <tr key={`item-sold-${item.id != null ? item.id : ''}-${idx}`} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition text-xs print:text-2xs">
                      <td className="px-3 py-2.5 text-center text-gray-400 print:text-black font-medium">{idx + 1}</td>
                      <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 print:text-black whitespace-nowrap">
                        {new Date(item.date).toLocaleDateString()} <span className="text-3xs text-gray-400 print:text-gray-600 ml-1">{new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-gray-900 dark:text-white print:text-black" title={item.product_name}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="line-clamp-1 max-w-[200px] print:line-clamp-none print:max-w-none">{item.product_name}</span>
                          {item.validity_days ? (
                            <span className="text-3xs font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
                              Pass: {item.validity_days}d
                            </span>
                          ) : null}
                          {item.attendant_name ? (
                            <span className="text-3xs text-gray-400 dark:text-neutral-500 shrink-0">
                              • {item.attendant_name}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-gray-700 dark:text-gray-300 print:text-black text-right">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 print:text-black text-right whitespace-nowrap">
                        {item.buying_price ? formatCompactCurrency(item.buying_price) : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 print:text-black text-right whitespace-nowrap">
                        {formatCompactCurrency(item.price)}
                      </td>
                      <td className="px-3 py-2.5 font-extrabold text-gray-900 dark:text-white print:text-black text-right whitespace-nowrap">
                        {formatCompactCurrency(item.total)}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="table-row-group print:border-t print:border-gray-300 font-extrabold" style={{ display: 'table-row-group' }}>
                  <tr className="bg-neutral-100/60 dark:bg-neutral-800/60 print:bg-transparent text-xs print:text-2xs">
                    <td colSpan={3} className="px-3 py-3 text-right text-gray-900 dark:text-white print:text-black uppercase tracking-wider text-2xs">
                      Grand Total
                    </td>
                    <td className="px-3 py-3 text-right text-gray-900 dark:text-white print:text-black">
                      {stats.items_sold_list.reduce((acc: number, item: any) => acc + item.quantity, 0)}
                    </td>
                    <td className="px-4 py-4 text-right text-gray-900 dark:text-white print:text-black whitespace-nowrap">
                      {stats.items_sold_list.some((item: any) => (item.buying_price || 0) > 0)
                        ? `${formatCompactCurrency(stats.items_sold_list.reduce((acc: number, item: any) => acc + ((item.buying_price || 0) * item.quantity), 0))} (Est. Cost)`
                        : '-'}
                    </td>
                    <td className="px-4 py-4 text-right text-gray-900 dark:text-white print:text-black whitespace-nowrap font-bold" colSpan={2}>
                      {formatCompactCurrency(stats.items_sold_list.reduce((acc: number, item: any) => acc + item.total, 0))} (Revenue)
                    </td>
                    <td className="px-4 py-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-gray-400 font-medium print-hide">
              No sales activity during this period.
            </div>
          )}
        </div>
      )}
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
