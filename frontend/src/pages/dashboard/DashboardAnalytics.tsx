import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Package, ShoppingCart, AlertTriangle, DollarSign, ArrowUpRight } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';

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
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="text-brand-500" />
            {t('seller_analytics', 'Seller Analytics')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('analytics_desc', 'Track your sales performance and store health over the last 30 days.')}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 text-brand-500 mb-2">
            <DollarSign size={20} />
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Revenue (30d)</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">TZS {(data.total_revenue ?? 0).toLocaleString()}</p>
        </div>

        <div className="bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 text-blue-500 mb-2">
            <Package size={20} />
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Active Listings</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.active_listings_count}</p>
        </div>

        <div className="bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 text-orange-500 mb-2">
            <ShoppingCart size={20} />
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Unfulfilled Orders</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.unfulfilled_orders_count}</p>
        </div>

        <div className="bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 text-red-500 mb-2">
            <AlertTriangle size={20} />
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Out of Stock</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.out_of_stock_count}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border p-6 rounded-2xl shadow-sm">
          <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowUpRight size={18} className="text-green-500" />
            Top Selling Products
          </h3>
          {data.top_selling_products.length === 0 ? (
            <p className="text-gray-500 text-sm">No sales data available yet.</p>
          ) : (
            <ul className="space-y-4">
              {data.top_selling_products.map((product, idx) => (
                <li key={idx} className="flex justify-between items-center p-3 hover:bg-gray-50 dark:hover:bg-neutral-900 rounded-lg transition border border-transparent hover:border-gray-100 dark:hover:border-neutral-800">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{product.name}</span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{product.sales} sold</p>
                    <p className="text-xs text-gray-500">TZS {(product.revenue ?? 0).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Orders Overview */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border p-6 rounded-2xl shadow-sm">
          <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">Recent Orders</h3>
          {data.recent_orders.length === 0 ? (
            <p className="text-gray-500 text-sm">No recent orders.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                <thead className="text-xs uppercase bg-gray-50 dark:bg-neutral-900 text-gray-700 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-2 rounded-l-lg">Order ID</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 rounded-r-lg">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_orders.map((order) => (
                    <tr key={order.id} className="border-b dark:border-neutral-800 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-900/50">
                      <td className="px-4 py-3 font-medium">#{order.id}</td>
                      <td className="px-4 py-3">{new Date(order.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          order.status === 'COMPLETED' ? ' text-green-500' : 
                          order.status === 'PAID' ? ' text-blue-500' : 
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">TZS {(order.total ?? 0).toLocaleString()}</td>
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
