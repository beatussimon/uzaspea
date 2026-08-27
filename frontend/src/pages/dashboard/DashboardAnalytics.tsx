import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Package, ShoppingCart, AlertTriangle, DollarSign, ArrowUpRight } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Spinner } from '../../components/ui/Spinner';

interface SellerAnalytics {
  total_revenue: number;
  active_listings_count: number;
  unfulfilled_orders_count: number;
  out_of_stock_count: number;
  top_selling_products: Array<{
    name: string;
    sales: number;
    revenue: number;
  }>;
  recent_orders: Array<{
    id: number;
    date: string;
    status: string;
    total: number;
  }>;
}

const DashboardAnalytics: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<SellerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await api.get('/api/analytics/seller/');
        setData(response.data);
      } catch (error) {
        console.error('Failed to fetch analytics', error);
        toast.error(t('failed_fetch_analytics', 'Failed to load analytics data.'));
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [t]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="text-brand-500" size={24} />
            {t('seller_analytics', 'Seller Analytics')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('analytics_desc', 'Track your sales performance and store health over the last 30 days.')}
          </p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4 hover:shadow-xs transition">
          <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 mb-1.5">
            <DollarSign size={16} />
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Revenue (30d)</span>
          </div>
          <p className="text-xl font-extrabold text-gray-900 dark:text-white">TZS {(data.total_revenue ?? 0).toLocaleString()}</p>
        </div>

        <div className="card p-4 hover:shadow-xs transition">
          <div className="flex items-center gap-2 text-blue-500 mb-1.5">
            <Package size={16} />
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Active Listings</span>
          </div>
          <p className="text-xl font-extrabold text-gray-900 dark:text-white">{data.active_listings_count}</p>
        </div>

        <div className="card p-4 hover:shadow-xs transition">
          <div className="flex items-center gap-2 text-amber-500 mb-1.5">
            <ShoppingCart size={16} />
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Unfulfilled Orders</span>
          </div>
          <p className="text-xl font-extrabold text-gray-900 dark:text-white">{data.unfulfilled_orders_count}</p>
        </div>

        <div className="card p-4 hover:shadow-xs transition">
          <div className="flex items-center gap-2 text-red-500 mb-1.5">
            <AlertTriangle size={16} />
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Out of Stock</span>
          </div>
          <p className="text-xl font-extrabold text-gray-900 dark:text-white">{data.out_of_stock_count}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="card overflow-hidden">
          <div className="p-3 border-b border-surface-border dark:border-surface-dark-border bg-surface-muted/40 dark:bg-[#161616]/40 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <ArrowUpRight size={14} className="text-emerald-500" />
              Top Selling Products
            </h3>
            <span className="text-3xs text-gray-400 font-bold">Last 30 days</span>
          </div>
          {data.top_selling_products.length === 0 ? (
            <p className="p-8 text-center text-xs text-gray-400">No sales data available yet.</p>
          ) : (
            <div className="divide-y divide-surface-border dark:divide-surface-dark-border">
              {data.top_selling_products.map((product, idx) => (
                <div key={idx} className="p-3 flex justify-between items-center hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition">
                  <div className="flex items-center gap-2.5 overflow-hidden pr-2">
                    <div className="w-6 h-6 shrink-0 rounded-btn bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border flex items-center justify-center font-bold text-gray-400 text-3xs">#{idx + 1}</div>
                    <span className="font-bold text-xs text-gray-900 dark:text-white truncate">{product.name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-extrabold text-gray-900 dark:text-white">{product.sales} sold</p>
                    <p className="text-3xs text-brand-600 dark:text-brand-400 font-bold">TZS {(product.revenue ?? 0).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders Overview */}
        <div className="card overflow-hidden">
          <div className="p-3 border-b border-surface-border dark:border-surface-dark-border bg-surface-muted/40 dark:bg-[#161616]/40 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white">Recent Orders</h3>
            <span className="text-3xs text-gray-400 font-bold">{data.recent_orders.length} orders</span>
          </div>
          {data.recent_orders.length === 0 ? (
            <p className="p-8 text-center text-xs text-gray-400">No recent orders.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-muted dark:bg-[#161616] text-2xs uppercase tracking-wider text-gray-400 font-bold border-b border-surface-border dark:border-surface-dark-border">
                  <tr>
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
                  {data.recent_orders.map((order) => (
                    <tr key={order.id} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition">
                      <td className="p-3 font-mono font-bold text-gray-900 dark:text-white">#{order.id}</td>
                      <td className="p-3 text-gray-500 dark:text-gray-400">{new Date(order.date).toLocaleDateString()}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-3xs font-bold uppercase ${
                          order.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                          order.status === 'PAID' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 
                          'bg-surface-muted text-gray-600 dark:bg-[#161616] dark:text-gray-400 border border-surface-border dark:border-surface-dark-border'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-3 font-extrabold text-brand-600 dark:text-brand-400 text-right">TZS {(order.total ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardAnalytics;
