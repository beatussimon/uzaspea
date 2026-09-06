import React, { useState, useEffect, useRef } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { TrendingUp, ShieldAlert, Package, ShoppingCart, Banknote, Star, AlertTriangle, Printer, ChevronDown, Check } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { KpiCard } from '../../components/ui/KpiCard';
import { ReportPrintHeader } from '../../components/print/ReportPrintHeader';
import { DateRangePicker, DateRange } from '../../components/ui/DateRangePicker';
import { useAuth } from '../../context/AuthContext';
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
  CardListSkeleton
} from '../../components/Skeleton';
import { cn } from '../../lib/utils';

// ============ Dashboard Overview ============
const DashboardOverview: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
    label: t('all_time', 'All Time')
  });

  // Top Products limit customization
  const [topProductsLimit, setTopProductsLimit] = useState<number>(5);
  const [isTopLimitOpen, setIsTopLimitOpen] = useState<boolean>(false);
  const [customTopInput, setCustomTopInput] = useState<string>('');
  const topLimitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (topLimitRef.current && !topLimitRef.current.contains(e.target as Node)) {
        setIsTopLimitOpen(false);
      }
    };
    if (isTopLimitOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isTopLimitOpen]);

  useEffect(() => {
    setLoading(true);
    let url = '/api/products/seller_stats/';
    const params = new URLSearchParams();
    if (dateRange.startDate) params.append('start_date', dateRange.startDate);
    if (dateRange.endDate) params.append('end_date', dateRange.endDate);
    params.append('top_limit', '50');
    if (params.toString()) url += `?${params.toString()}`;

    api.get(url)
      .then((res) => setStats(res.data))
      .catch(() => toast.error('Failed to load stats'))
      .finally(() => setLoading(false));
  }, [dateRange]);

  const trendUp = (stats?.revenue_trend_pct || 0) >= 0;

  const kpis = [
    {
      label: t('products', 'Products'),
      value: stats?.total_products || 0,
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
      className: stats?.stock_alerts?.length > 0 ? 'border-red-500/30' : undefined,
    },
  ];

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
        <div className="flex items-center justify-between gap-2 flex-nowrap min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
            {t('store_analytics', 'Store Analytics')}
          </h1>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <Button 
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="font-bold flex items-center justify-center gap-1.5 text-xs px-2.5 sm:px-3 py-1.5 sm:py-2 shrink-0 whitespace-nowrap"
              title="Export to PDF"
              aria-label="Export to PDF"
            >
              <Printer size={15} className="shrink-0" />
              <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export'}</span>
            </Button>
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Real-time sales breakdown, order conversion pipeline, and inventory status.
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
          <div className="grid grid-cols-5 gap-2 p-3 border border-gray-300 rounded-lg bg-gray-50/80 text-center" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            <div className="border-r border-gray-200 pr-2">
              <p className="text-[10px] uppercase font-bold text-gray-500">Total Products</p>
              <p className="text-sm font-black text-black mt-0.5">{stats?.total_products || 0}</p>
            </div>
            <div className="border-r border-gray-200 pr-2">
              <p className="text-[10px] uppercase font-bold text-gray-500">Total Orders</p>
              <p className="text-sm font-black text-black mt-0.5">{stats?.total_orders || 0}</p>
            </div>
            <div className="border-r border-gray-200 pr-2">
              <p className="text-[10px] uppercase font-bold text-gray-500">Total Revenue</p>
              <p className="text-sm font-black text-black mt-0.5">{kpis[2]?.fullValue || `TSh ${(stats?.total_revenue || 0).toLocaleString()}`}</p>
            </div>
            <div className="border-r border-gray-200 pr-2">
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
              <div className="flex items-center justify-between border-b border-black pb-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-black">
                  Top Performing Products ({dateRange.label})
                </h3>
                <span className="text-[10px] font-bold text-gray-500">
                  {stats.top_products.length} Products Ranked
                </span>
              </div>
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-100/80 text-black">
                    <th className="py-1.5 px-2 w-12 text-center font-bold">RANK</th>
                    <th className="py-1.5 px-2 w-auto font-bold">PRODUCT NAME</th>
                    <th className="py-1.5 px-3 w-28 text-right font-bold">UNITS SOLD</th>
                    <th className="py-1.5 px-3 w-40 text-right font-bold">REVENUE (TZS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.top_products.map((p: any, idx: number) => (
                    <tr key={idx} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                      <td className="py-1.5 px-2 text-center font-bold text-gray-500">#{idx + 1}</td>
                      <td className="py-1.5 px-2 font-bold text-black truncate">{p.name}</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-black">{p.sold}</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-black">
                        {parseFloat(p.revenue || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-black font-black bg-gray-50" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
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
              <div className="flex items-center justify-between border-b border-black pb-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-black">
                  Store Products Catalog & Stock Status
                </h3>
                <span className="text-[10px] font-bold text-gray-500">
                  {stats.products_summary.length} Items Listed
                </span>
              </div>
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-100/80 text-black">
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
                      <tr key={prod.id || idx} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
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
                <tfoot>
                  <tr className="border-t-2 border-black font-black bg-gray-50" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
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
              <div className="flex items-center justify-between border-b border-black pb-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-black">
                  Items Sold Activity ({dateRange.label})
                </h3>
                <span className="text-[10px] font-bold text-gray-500">
                  {stats.items_sold_list.length} Records
                </span>
              </div>
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-100/80 text-black">
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
                    <tr key={item.id || idx} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
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
                <tfoot>
                  <tr className="border-t-2 border-black font-black bg-gray-50" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
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
              <div className="flex items-center justify-between border-b border-black pb-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-red-600">
                  Stock Depletion & Reorder Alerts
                </h3>
                <span className="text-[10px] font-bold text-red-600">
                  {stats.stock_alerts.length} Items Critical
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {stats.stock_alerts.map((s: any, idx: number) => (
                  <div key={idx} className="p-2 border border-red-200 rounded bg-red-50/50 flex items-center justify-between text-xs" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
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
          <div className="pt-4 border-t border-gray-300 flex items-center justify-between text-[10px] text-gray-500" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
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
            <CardListSkeleton count={3} />
            <CardListSkeleton count={2} />
          </div>
        </div>
      ) : (
        <div className={cn("space-y-6", loading && "opacity-75 transition-opacity")}>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 print-hide">
            {kpis.map((kpi, i) => (
              <KpiCard
                key={i}
                label={kpi.label}
                value={kpi.value}
                fullValue={kpi.fullValue}
                icon={kpi.icon}
                trend={kpi.trend}
                sub={kpi.sub}
                className={cn(kpi.className, i === 4 && "col-span-2 sm:col-span-1")}
              />
            ))}
          </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print-hide">
        {/* Revenue Area Chart */}
        <div className="lg:col-span-2 card p-5 flex flex-col h-[350px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>Revenue Pipeline</span>
              <span className="text-2xs font-normal text-gray-400">({dateRange.label})</span>
            </h3>
            <div className="flex items-center gap-2">
              {stats?.revenue_trend_pct !== undefined && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border bg-transparent ${stats.revenue_trend_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'text-red-600 dark:text-red-400 border-red-500/30'}`}>
                  {stats.revenue_trend_pct >= 0 ? '+' : ''}{stats.revenue_trend_pct}%
                </span>
              )}
              <TrendingUp size={16} className="text-brand-500" />
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
        <div className="card p-5 flex flex-col h-[350px]">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Order Status</h3>
          <div className="h-[280px] w-full min-h-[280px]">
            <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={280} debounce={50}>
              <PieChart>
                <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
        {/* Top Products */}
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="p-3 border-b border-surface-border dark:border-surface-dark-border bg-surface-muted/40 dark:bg-[#161616]/40 flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white">Top Performing Products</h3>
              
              <div className="flex items-center gap-2">
                {/* Customizable Limit Dropdown Pill */}
                <div className="relative" ref={topLimitRef}>
                  <button
                    type="button"
                    onClick={() => setIsTopLimitOpen(!isTopLimitOpen)}
                    className="text-[11px] font-medium text-gray-700 dark:text-gray-300 bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border hover:border-gray-400 dark:hover:border-neutral-600 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 transition select-none"
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

                <span className="text-[11px] font-medium text-brand-600 dark:text-brand-400 bg-transparent border border-brand-500/40 px-2.5 py-0.5 rounded-full capitalize">Best Sellers</span>
              </div>
            </div>
            <div className="divide-y divide-surface-border dark:divide-surface-dark-border max-h-96 overflow-y-auto">
              {(stats?.top_products || []).slice(0, topProductsLimit).map((p: any, i: number) => (
                <div key={i} className="p-3 flex items-center justify-between hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition">
                  <div className="flex items-center gap-3 overflow-hidden pr-2">
                    <div className="w-7 h-7 shrink-0 rounded-btn bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border flex items-center justify-center font-bold text-gray-400 text-xs">#{i+1}</div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{p.name}</p>
                      <p className="text-3xs text-gray-400 truncate">{p.sold} sold</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 max-w-[120px]">
                    <p className="text-xs font-extrabold text-brand-600 dark:text-brand-400 truncate" title={`TSh ${(p.revenue ?? 0).toLocaleString()}`}>TSh {(p.revenue ?? 0).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {(!stats?.top_products || stats.top_products.length === 0) && (
                <div className="p-6 text-center text-xs text-gray-400">
                  No product sales recorded for this period
                </div>
              )}
            </div>
          </div>

          <KpiCard
            label="Commission Paid (This Month)"
            value={formatCompactCurrency(stats?.commission_paid || 0, 'TZS')}
            fullValue={`TZS ${(stats?.commission_paid || 0).toLocaleString()}`}
            icon={Banknote}
            sub={`Calculated at ${stats?.commission_rate || 10}% on completed orders`}
          />
        </div>

        {/* Low Stock Alerts */}
        <div className="card overflow-hidden">
          <div className="p-3 border-b border-surface-border dark:border-surface-dark-border bg-surface-muted/40 dark:bg-[#161616]/40 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-amber-500" /> Stock Alerts
            </h3>
            <span className="text-3xs text-gray-400 font-bold">{stats?.stock_alerts?.length || 0} alerts</span>
          </div>
          {(stats?.stock_alerts?.length || 0) > 0 ? (
            <div className="divide-y divide-surface-border dark:divide-surface-dark-border">
              {stats.stock_alerts.map((s: any, i: number) => (
                <div key={i} className="p-3 flex items-center justify-between hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition">
                  <span className="text-xs font-medium text-gray-900 dark:text-white truncate pr-2">{s.name}</span>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border capitalize shrink-0 bg-transparent ${s.stock === 0 ? 'text-red-600 dark:text-red-400 border-red-500/40' : 'text-amber-600 dark:text-amber-400 border-amber-500/40'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.stock === 0 ? 'bg-red-500' : 'bg-amber-500'}`} />
                    {s.stock === 0 ? 'Out of Stock' : `${s.stock} left`}
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="px-5 py-8 text-center text-gray-400 text-xs">All products well-stocked 🎉</p>}
        </div>
      </div>

      {/* Items Sold List */}
      {stats?.has_advanced_analytics && stats?.items_sold_list?.length > 0 && (
        <div className="card overflow-hidden !border-none print:shadow-none print:m-0 print:p-0">
          <div className="p-3 border-b border-surface-border dark:border-surface-dark-border bg-surface-muted/40 dark:bg-[#161616]/40 flex items-center justify-between print-hide">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white">Items Sold ({dateRange.label})</h3>
            <span className="text-3xs font-bold text-gray-400 uppercase">Recent 100</span>
          </div>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left">
              <thead className="bg-surface-muted dark:bg-[#161616] text-2xs uppercase tracking-wider text-gray-400 font-bold border-b border-surface-border dark:border-surface-dark-border">
                <tr>
                  <th className="px-3 py-2.5 font-bold w-8 text-center">S/N</th>
                  <th className="px-3 py-2.5 font-bold whitespace-nowrap">Date & Time</th>
                  <th className="px-3 py-2.5 font-bold min-w-[150px]">Product</th>
                  <th className="px-3 py-2.5 font-bold text-right">Qty</th>
                  <th className="px-3 py-2.5 font-bold text-right">Cost (Unit)</th>
                  <th className="px-3 py-2.5 font-bold text-right">Price (Unit)</th>
                  <th className="px-3 py-2.5 font-bold text-right">Total Rev</th>
                  <th className="px-3 py-2.5 font-bold text-center whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border print:divide-gray-300">
                {stats.items_sold_list.map((item: any, idx: number) => (
                  <tr key={item.id} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition text-xs print:text-2xs">
                    <td className="px-3 py-2.5 text-center text-gray-400 print:text-black font-medium">{idx + 1}</td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 print:text-black whitespace-nowrap">
                      {new Date(item.date).toLocaleDateString()} <span className="text-3xs text-gray-400 print:text-gray-600 ml-1">{new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-gray-900 dark:text-white print:text-black" title={item.product_name}>
                      <div className="line-clamp-1 max-w-[200px] print:line-clamp-none print:max-w-none">{item.product_name}</div>
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
                    <td className="px-3 py-2.5 font-extrabold text-brand-600 dark:text-brand-400 print:text-black text-right whitespace-nowrap">
                      {formatCompactCurrency(item.total)}
                    </td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-surface-muted text-gray-600 dark:bg-[#161616] dark:text-gray-400 border border-surface-border dark:border-surface-dark-border capitalize print:bg-transparent print:border print:border-gray-300 print:text-black">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-surface-border dark:border-surface-dark-border print:border-black font-extrabold">
                <tr className="bg-surface-muted/40 dark:bg-[#161616]/40 print:bg-transparent text-xs print:text-2xs">
                  <td colSpan={3} className="px-3 py-3 text-right text-gray-900 dark:text-white print:text-black uppercase tracking-wider text-2xs">
                    Grand Total
                  </td>
                  <td className="px-3 py-3 text-right text-gray-900 dark:text-white print:text-black">
                    {stats.items_sold_list.reduce((acc: number, item: any) => acc + item.quantity, 0)}
                  </td>
                  <td className="px-4 py-4 text-right text-gray-900 dark:text-white print:text-black whitespace-nowrap">
                    {formatCompactCurrency(stats.items_sold_list.reduce((acc: number, item: any) => acc + ((item.buying_price || 0) * item.quantity), 0))} (Est. Cost)
                  </td>
                  <td className="px-4 py-4 text-right text-brand-500 dark:text-brand-500 print:text-black whitespace-nowrap font-bold" colSpan={2}>
                    {formatCompactCurrency(stats.items_sold_list.reduce((acc: number, item: any) => acc + item.total, 0))} (Revenue)
                  </td>
                  <td className="px-4 py-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
