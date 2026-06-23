import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { BarChart3, ShieldAlert } from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Area, AreaChart
} from 'recharts';
const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];
import { SHORT_STATUS_LABELS as STATUS_LABELS } from '../../constants/orderStatus';

// ============ Dashboard Overview ============
const DashboardOverview: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/products/seller_stats/')
      .then((res) => setStats(res.data))
      .catch(() => toast.error('Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  const trendUp = (stats?.revenue_trend_pct || 0) >= 0;
  const trendIcon = trendUp ? '↑' : '↓';
  const trendColor = trendUp ? 'text-green-500' : 'text-red-500';

  const kpis = [
    { label: 'Products', value: stats?.total_products || 0, sub: '', color: '#3b82f6' },
    { label: 'Orders', value: stats?.total_orders || 0, sub: '', color: '#10b981' },
    { label: 'Revenue (7D)', value: `TSh ${(stats?.total_revenue || 0).toLocaleString()}`, sub: `${trendIcon} ${Math.abs(stats?.revenue_trend_pct || 0)}%`, color: '#8b5cf6', subColor: trendColor },
    { label: 'Avg Order', value: `TSh ${(stats?.avg_order_value || 0).toLocaleString()}`, sub: '', color: '#f59e0b' },
    { label: 'Avg Rating', value: stats?.avg_rating || '—', sub: `${stats?.total_reviews || 0} reviews`, color: '#ef4444' },
    { label: 'Low Stock', value: stats?.stock_alerts?.length || 0, sub: 'items ≤ 3', color: '#ec4899' },
  ];

  // Prepare pie data
  const pieData = Object.entries(stats?.orders_by_status || {}).map(([k, v]) => ({ name: STATUS_LABELS[k] || k, value: v as number }));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Store Analytics</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi, i) => (
          <div key={i} className="card p-4 flex flex-col items-center text-center animate-fade-in" style={{ animationDelay: `${i*100}ms` }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{kpi.label}</span>
            <span className="text-lg font-black text-gray-900 dark:text-white" style={{ color: kpi.color }}>{kpi.value}</span>
            {kpi.sub && <span className={`text-[10px] font-bold mt-1 ${kpi.subColor}`}>{kpi.sub}</span>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Area Chart */}
        <div className="lg:col-span-2 card p-5 flex flex-col h-[350px]">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center justify-between">
            Revenue Pipeline
            <BarChart3 size={16} className="text-brand-500" />
          </h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height={280}>
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
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">Order Status</h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height={280}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Top Performing Products</h3>
              <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded uppercase">Best Sellers</span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {(stats?.top_products || []).map((p: any, i: number) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center font-bold text-gray-400 text-xs">#{i+1}</div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{p.name}</p>
                      <p className="text-[10px] text-gray-500">{p.sold} sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-brand-600">TSh {p.revenue.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {stats?.has_advanced_analytics && (
            <div className="card p-5 space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Commission Paid (This Month)</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                TZS {(stats.commission_paid || 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">Calculated at {stats.commission_rate || 10}% on completed orders</p>
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="card overflow-hidden border-orange-100 dark:border-orange-900/20">
          <div className="px-5 py-4 border-b border-orange-50 dark:border-orange-900/10 flex items-center justify-between bg-orange-50/30">
            <h3 className="text-sm font-bold text-orange-800 dark:text-orange-300">Stock Alerts</h3>
            <ShieldAlert size={16} className="text-orange-500" />
          </div>
          {(stats?.stock_alerts?.length || 0) > 0 ? (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {stats.stock_alerts.map((s: any, i: number) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.stock === 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                    {s.stock === 0 ? 'OUT OF STOCK' : `${s.stock} left`}
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="px-5 py-8 text-center text-gray-400 text-sm">All products well-stocked 🎉</p>}
        </div>
      </div>
    </div>
  );
};


export default DashboardOverview;
