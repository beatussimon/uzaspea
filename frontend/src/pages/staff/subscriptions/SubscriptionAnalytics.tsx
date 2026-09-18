import React, { useState, useEffect } from 'react';
import {
  CreditCard, TrendingUp, AlertCircle, CheckCircle,
  Clock, Shield, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid
} from 'recharts';
import api from '../../../api';
import { KpiCard } from '../../../components/ui/KpiCard';
import { Spinner } from '../../../components/ui/Spinner';

interface AnalyticsData {
  kpis: {
    total_revenue: number;
    this_month_revenue: number;
    active_subscribers: number;
    pending_count: number;
    pending_amount: number;
    overdue_count: number;
    overdue_potential_revenue: number;
    compliance_rate: number;
  };
  monthly_trend: Array<{
    month: string;
    revenue: number;
    confirmations: number;
  }>;
  tier_breakdown: Array<{
    tier_name: string;
    tier_level: string;
    subscribers: number;
    total_revenue: number;
    price: number;
  }>;
  status_distribution: Array<{
    name: string;
    count: number;
    color: string;
  }>;
}

export const SubscriptionAnalytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/staff/payment-confirmations/analytics/');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load subscription analytics', err);
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
        <Spinner size="sm" className="mr-2" /> Loading subscription revenue insights...
      </div>
    );
  }

  if (!data) return null;

  const { kpis, monthly_trend, tier_breakdown, status_distribution } = data;
  const totalDistribution = status_distribution.reduce((acc, s) => acc + s.count, 0) || 1;

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
              Subscription Revenue & Compliance Analytics
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {kpis.compliance_rate}% on time
              </span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Overview of collected subscription fees, overdue accounts, and recurring renewals
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
          label="Total Sub Revenue"
          value={`TZS ${kpis.total_revenue.toLocaleString()}`}
          sub={`+TZS ${kpis.this_month_revenue.toLocaleString()} this month`}
          icon={CreditCard}
          color="#10b981"
        />
        <KpiCard
          label="Active Subscribers"
          value={kpis.active_subscribers}
          sub={`${kpis.compliance_rate}% compliance`}
          icon={CheckCircle}
          color="#3b82f6"
        />
        <KpiCard
          label="Awaiting Verification"
          value={kpis.pending_count}
          sub={`TZS ${kpis.pending_amount.toLocaleString()} pending`}
          icon={Clock}
          color="#f59e0b"
        />
        <KpiCard
          label="Overdue / Expired"
          value={kpis.overdue_count}
          sub={`~TZS ${kpis.overdue_potential_revenue.toLocaleString()} uncollected`}
          icon={AlertCircle}
          color="#ef4444"
          className="border-red-500/20 bg-red-500/[0.02]"
        />
      </div>

      {/* Graphs & Detailed Breakdown (Collapsible) */}
      {!collapsed && (
        <div className="pt-2 space-y-4 border-t border-surface-border/50">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Chart 1: Monthly Subscription Revenue Trend */}
            <div className="lg:col-span-8 bg-surface-muted/40 dark:bg-[#121212]/50 p-4 rounded-xl border border-surface-border/40">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Monthly Revenue Trend (Last 6 Months)
                </h3>
                <span className="text-[11px] text-gray-400">Total collected per cycle</span>
              </div>
              <div className="h-48 sm:h-56 w-full">
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
                      formatter={(val: any) => [`TZS ${Number(val || 0).toLocaleString()}`, 'Revenue']}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={44}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Distribution & Tier Breakdown */}
            <div className="lg:col-span-4 flex flex-col justify-between space-y-4 bg-surface-muted/40 dark:bg-[#121212]/50 p-4 rounded-xl border border-surface-border/40">
              {/* Payment Status Breakdown */}
              <div>
                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Subscriber Compliance Status
                </h3>
                {/* Horizontal Progress Bar */}
                <div className="h-3 w-full rounded-full overflow-hidden flex bg-surface-muted mb-3 border border-surface-border/40">
                  {status_distribution.map((item, idx) => {
                    const pct = ((item.count / totalDistribution) * 100) || 0;
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

                <div className="space-y-1.5">
                  {status_distribution.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-600 dark:text-gray-400">{item.name}</span>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tier Breakdown */}
              <div className="pt-3 border-t border-surface-border/40">
                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                  <Shield size={13} className="text-brand-500" /> Plan Distribution
                </h3>
                <div className="space-y-2">
                  {tier_breakdown.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-surface-card dark:bg-[#181818] border border-surface-border/40">
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{t.tier_name}</p>
                        <p className="text-[10px] text-gray-400">TZS {t.price.toLocaleString()} / mo</p>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-brand-600 dark:text-brand-400">{t.subscribers} active</p>
                        <p className="text-[10px] text-gray-400">TZS {t.total_revenue.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
