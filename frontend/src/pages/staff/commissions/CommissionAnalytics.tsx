import React, { useState, useEffect } from 'react';
import {
  TrendingUp, AlertCircle, CheckCircle,
  Clock, DollarSign, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend
} from 'recharts';
import api from '../../../api';
import { KpiCard } from '../../../components/ui/KpiCard';
import { Spinner } from '../../../components/ui/Spinner';

interface CommissionAnalyticsData {
  kpis: {
    total_collected: number;
    this_month_collected: number;
    total_outstanding: number;
    overdue_count: number;
    pending_review_count: number;
    pending_review_amount: number;
    collection_rate: number;
    avg_commission_per_seller: number;
    total_invoiced: number;
  };
  monthly_trend: Array<{
    month: string;
    invoiced: number;
    collected: number;
    orders_count: number;
  }>;
  status_distribution: Array<{
    name: string;
    count: number;
    amount: number;
    color: string;
  }>;
  top_debtors: Array<{
    seller_username: string;
    store_url: string;
    phone_number: string;
    amount_due: number;
    commission: number;
    period: string;
    days_overdue: number;
  }>;
}

export const CommissionAnalytics: React.FC = () => {
  const [data, setData] = useState<CommissionAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/staff/commission-payments/analytics/');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load commission analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="card p-6 flex items-center justify-center min-h-[140px] text-gray-500 text-sm">
        <Spinner size="sm" className="mr-2" /> Loading commission revenue insights...
      </div>
    );
  }

  if (!data) return null;

  const { kpis, monthly_trend, status_distribution, top_debtors } = data;
  const totalInvoices = status_distribution.reduce((acc, s) => acc + s.count, 0) || 1;

  return (
    <div className="card p-4 sm:p-5 space-y-4 border border-surface-border/80 shadow-xs">
      {/* Header with Collapsible Toggle & Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <TrendingUp size={18} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Commission Settlements & Revenue Analytics
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {kpis.collection_rate}% collected
              </span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Overview of monthly platform commission billing, receipts verified, and outstanding collections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={fetchAnalytics}
            title="Refresh analytics"
            className="p-1.5 rounded-lg hover:bg-surface-muted text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer"
          >
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-muted hover:bg-surface-border/40 text-gray-600 dark:text-gray-300 transition cursor-pointer"
          >
            {collapsed ? (
              <>Show Graphs <ChevronDown size={14} /></>
            ) : (
              <>Hide Graphs <ChevronUp size={14} /></>
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total Commission Paid"
          value={`TZS ${kpis.total_collected.toLocaleString()}`}
          sub={`+TZS ${kpis.this_month_collected.toLocaleString()} this month`}
          icon={CheckCircle}
          color="#10b981"
        />
        <KpiCard
          label="Outstanding / Overdue"
          value={`TZS ${kpis.total_outstanding.toLocaleString()}`}
          sub={`${kpis.overdue_count} overdue invoices`}
          icon={AlertCircle}
          color="#ef4444"
          className="border-red-500/20 bg-red-500/[0.02]"
        />
        <KpiCard
          label="Pending Review"
          value={kpis.pending_review_count}
          sub={`TZS ${kpis.pending_review_amount.toLocaleString()} receipts`}
          icon={Clock}
          color="#f59e0b"
        />
        <KpiCard
          label="Collection Rate"
          value={`${kpis.collection_rate}%`}
          sub={`Avg TZS ${kpis.avg_commission_per_seller.toLocaleString()} / seller`}
          icon={DollarSign}
          color="#3b82f6"
        />
      </div>

      {/* Graphs & Detailed Breakdown (Collapsible) */}
      {!collapsed && (
        <div className="pt-2 space-y-4 border-t border-surface-border/50">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Chart 1: Invoiced vs Collected Commission Comparison */}
            <div className="lg:col-span-7 bg-surface-muted/40 dark:bg-[#121212]/50 p-4 rounded-xl border border-surface-border/40">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Billed vs Collected Commission (Last 6 Months)
                </h3>
                <span className="text-[11px] text-gray-400">Performance comparison</span>
              </div>
              <div className="h-52 sm:h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly_trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#888' }}
                      axisLine={{ stroke: '#444', opacity: 0.2 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#888' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161616',
                        borderColor: '#333',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#fff',
                      }}
                      formatter={(val: any) => [`TZS ${Number(val || 0).toLocaleString()}`, '']}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconSize={10}
                      wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                    />
                    <Bar
                      name="Invoiced"
                      dataKey="invoiced"
                      fill="#6b7280"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      name="Collected"
                      dataKey="collected"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Distribution & Top Debtors */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4 bg-surface-muted/40 dark:bg-[#121212]/50 p-4 rounded-xl border border-surface-border/40">
              {/* Invoice Status Distribution */}
              <div>
                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Invoice Status Distribution
                </h3>
                <div className="h-3 w-full rounded-full overflow-hidden flex bg-surface-muted mb-3 border border-surface-border/40">
                  {status_distribution.map((item, idx) => {
                    const pct = ((item.count / totalInvoices) * 100) || 0;
                    if (pct <= 0) return null;
                    return (
                      <div
                        key={idx}
                        style={{ width: `${pct}%`, backgroundColor: item.color }}
                        title={`${item.name}: ${item.count} (${pct.toFixed(0)}%)`}
                        className="h-full transition-all duration-500"
                      />
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {status_distribution.map((item, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-surface-card dark:bg-[#161616] border border-surface-border/40">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-500 dark:text-gray-400 font-medium truncate">{item.name}</span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="text-xs font-black text-gray-900 dark:text-white">{item.count}</span>
                        <span className="text-[10px] text-gray-400">TZS {Number(item.amount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Priority Overdue Sellers */}
              <div className="pt-3 border-t border-surface-border/40">
                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
                  <span>Priority Collections (Top Overdue)</span>
                  <span className="text-[10px] text-red-500 font-semibold">{top_debtors.length} high priority</span>
                </h3>
                {top_debtors.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2 text-center">No overdue invoices outstanding!</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {top_debtors.map((debtor, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-surface-card dark:bg-[#161616] border border-surface-border/40">
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <a
                              href={debtor.store_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-gray-900 dark:text-white hover:underline truncate"
                            >
                              @{debtor.seller_username}
                            </a>
                            <span className="text-[10px] text-gray-400 font-mono">({debtor.period})</span>
                          </div>
                          <p className="text-[10px] text-red-500 font-medium">{debtor.days_overdue} days overdue</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-extrabold text-red-600 dark:text-red-400 text-xs">
                            TZS {debtor.amount_due.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
