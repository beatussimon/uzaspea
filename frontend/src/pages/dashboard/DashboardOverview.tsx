import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { BarChart3, ShieldAlert, Package, ShoppingCart, DollarSign, Star, AlertTriangle, Printer } from 'lucide-react';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { KpiCard } from '../../components/ui/KpiCard';
import { ReportPrintHeader } from '../../components/print/ReportPrintHeader';
import { DateRangePicker, DateRange } from '../../components/ui/DateRangePicker';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Area, AreaChart
} from 'recharts';
const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];
import { SHORT_STATUS_LABELS as STATUS_LABELS } from '../../constants/orderStatus';

const formatCompactCurrency = (num: number, currency = 'TSh') => {
  if (!num || isNaN(num)) return `${currency} 0`;
  if (num >= 1_000_000) {
    return `${currency} ${(num / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
  }
  if (num >= 10_000) {
    return `${currency} ${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return `${currency} ${num.toLocaleString()}`;
};

const CommissionPaidCard = ({ amount, rate }: { amount: number; rate: number }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClose = (e?: Event) => {
      if (e && e.type === 'click' && cardRef.current && cardRef.current.contains(e.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('click', handleClose);
      window.addEventListener('scroll', handleClose, { capture: true });
    }
    return () => {
      document.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, { capture: true });
    };
  }, [isOpen]);

  return (
    <div 
      ref={cardRef}
      onClick={(e) => {
        e.stopPropagation();
        setIsOpen(prev => !prev);
      }}
      className="card p-5 space-y-2 relative overflow-hidden group cursor-pointer select-none active:scale-[0.98] transition-all"
    >
      {isOpen && (
        <div className="absolute inset-x-2 top-2 z-30 bg-gray-900 dark:bg-white text-white dark:text-gray-900 p-2.5 rounded-xl shadow-2xl text-center text-xs font-black border border-white/10 dark:border-black/10 animate-fade-in">
          <p className="text-[9px] uppercase tracking-wider opacity-70 mb-0.5 font-bold">Commission Paid</p>
          <p className="text-xs sm:text-sm font-black tracking-tight">TZS {amount.toLocaleString()}</p>
        </div>
      )}
      <div className="absolute -right-4 -bottom-4 text-brand-500 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
        <DollarSign size={120} />
      </div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Commission Paid (This Month)</p>
      <p className="text-2xl font-black text-gray-900 dark:text-white">
        {formatCompactCurrency(amount, 'TZS')}
      </p>
      <p className="text-xs text-gray-400">Calculated at {rate}% on completed orders</p>
    </div>
  );
};

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

  useEffect(() => {
    setLoading(true);
    let url = '/api/products/seller_stats/';
    const params = new URLSearchParams();
    if (dateRange.startDate) params.append('start_date', dateRange.startDate);
    if (dateRange.endDate) params.append('end_date', dateRange.endDate);
    if (params.toString()) url += `?${params.toString()}`;

    api.get(url)
      .then((res) => setStats(res.data))
      .catch(() => toast.error('Failed to load stats'))
      .finally(() => setLoading(false));
  }, [dateRange]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

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
      icon: DollarSign,
      trend: {
        value: `${Math.abs(stats?.revenue_trend_pct || 0)}%`,
        direction: trendUp ? 'up' as const : 'down' as const,
      },
    },
    {
      label: t('avg_order', 'Avg Order'),
      value: formatCompactCurrency(stats?.avg_order_value || 0),
      fullValue: `TSh ${(stats?.avg_order_value || 0).toLocaleString()}`,
      icon: DollarSign,
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

  return (
    <div className="space-y-6 print:space-y-0 print:m-0">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print-hide">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('store_analytics', 'Store Analytics')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Real-time sales breakdown, order conversion pipeline, and inventory status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button 
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="font-bold flex items-center gap-1.5"
            title="Export to PDF"
          >
            <Printer size={14} />
            <span>Export</span>
          </Button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print-hide">
        {kpis.map((kpi, i) => (
          <KpiCard
            key={i}
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
        <div className="lg:col-span-2 card p-5 flex flex-col h-[350px]">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-between">
            <span>Revenue Pipeline</span>
            <BarChart3 size={16} className="text-brand-500" />
          </h3>
          <div className="h-[280px] w-full min-h-[280px]">
            <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={280} debounce={50}>
               <AreaChart data={stats?.revenue_data || []}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `TSh ${v/1000}k`} />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRev)" />
               </AreaChart>
            </ResponsiveContainer>
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
            <div className="p-3 border-b border-surface-border dark:border-surface-dark-border bg-surface-muted/40 dark:bg-[#161616]/40 flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white">Top Performing Products</h3>
              <span className="text-3xs font-black text-brand-600 dark:text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full uppercase">Best Sellers</span>
            </div>
            <div className="divide-y divide-surface-border dark:divide-surface-dark-border">
              {(stats?.top_products || []).map((p: any, i: number) => (
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
            </div>
          </div>

          <CommissionPaidCard 
            amount={stats?.commission_paid || 0} 
            rate={stats?.commission_rate || 10} 
          />

          {/* Store QR Code */}
          <div className="card p-5 space-y-4">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white border-b border-surface-border dark:border-surface-dark-border pb-2">Your Store QR Code</h3>
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="bg-white p-2.5 rounded-btn border-2 border-brand-500 shadow-xs shrink-0">
                {user?.username ? (
                  <QRCodeSVG 
                    value={`${window.location.origin}/${user.username}`} 
                    size={100} 
                    level="H" 
                    includeMargin={true}
                    fgColor="#000000"
                  />
                ) : (
                  <div className="w-[100px] h-[100px] bg-gray-100 rounded-lg animate-pulse" />
                )}
              </div>
              <div className="space-y-1.5 text-center sm:text-left">
                <p className="text-xs font-bold text-gray-900 dark:text-white">Scan to visit store</p>
                <p className="text-2xs text-gray-500 dark:text-gray-400">
                  Customers can scan this code to browse your products and place direct orders.
                </p>
                <a 
                  href={`/${user?.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-3 py-1.5 bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 font-bold text-2xs rounded-btn hover:bg-brand-500/20 transition"
                >
                  View Storefront
                </a>
              </div>
            </div>
          </div>
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
                  <span className={`text-3xs font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${s.stock === 0 ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
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
          {/* Print-only Header (Redesigned) */}
          <ReportPrintHeader 
            title="Sales Report" 
            user={{...user, store_profile: stats?.store_profile}} 
            date={new Date().toLocaleDateString() + ' - ' + dateRange.label}
          />

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
                      <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-surface-muted text-gray-600 dark:bg-[#161616] dark:text-gray-400 border border-surface-border dark:border-surface-dark-border print:bg-transparent print:border print:border-gray-300 print:text-black">
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
  );
};


export default DashboardOverview;
