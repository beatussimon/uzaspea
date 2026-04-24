import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingBag, Plus, BarChart3, Megaphone, ShoppingCart, ChevronDown, ChevronUp, Clock, CheckCircle2, Truck, MapPin, XCircle, Eye, CreditCard, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import SafeImage from '../../components/SafeImage';
import { useOrderTracking, TrackingUpdate } from '../../hooks/useOrderTracking';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Area, AreaChart
} from 'recharts';

const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];
const STATUS_LABELS: Record<string,string> = {
  CART:'Cart',CHECKOUT:'Checkout',AWAITING_PAYMENT:'Awaiting Pay',PENDING_VERIFICATION:'Verifying',
  PAID:'Paid',PROCESSING:'Processing',SHIPPED:'Shipped',DELIVERED:'Delivered',COMPLETED:'Completed',CANCELLED:'Cancelled'
};

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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
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
            <BarChart3 size={16} className="text-blue-500" />
          </h3>
          <ResponsiveContainer width="100%" height="100%" minHeight={0}>
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

        {/* Status Pie Chart */}
        <div className="card p-5 flex flex-col h-[350px]">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">Order Status</h3>
          <ResponsiveContainer width="100%" height="100%" minHeight={0}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Top Performing Products</h3>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">Best Sellers</span>
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

// ============ Dashboard Products ============
const DashboardProducts: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '', category: '', condition: 'New' });
  const [categories, setCategories] = useState<any[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Infinite Scroll state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const currentUser = localStorage.getItem('username');

  const fetchProducts = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }
    
    api.get(`/api/products/?seller=${currentUser}&page=${p}`)
      .then((res) => {
        const data = res.data.results || res.data;
        const arr = Array.isArray(data) ? data : [];
        if (reset) setProducts(arr);
        else setProducts((prev) => [...prev, ...arr]);
        setHasMore(!!res.data.next);
      })
      .catch(() => setHasMore(false))
      .finally(() => { setLoading(false); setLoadingMore(false); });
  }, [currentUser]);

  useEffect(() => {
    fetchProducts(1, true);
    api.get('/api/categories/')
      .then((res) => setCategories(res.data.results || res.data))
      .catch(() => {});
  }, [currentUser]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || loading) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage((prev) => {
            const nextPage = prev + 1;
            fetchProducts(nextPage);
            return nextPage;
          });
        }
      },
      { rootMargin: '800px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchProducts]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImageFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('description', form.description);
      formData.append('price', form.price);
      formData.append('stock', form.stock);
      formData.append('category', form.category);
      formData.append('condition', form.condition);

      imageFiles.forEach((file) => {
        formData.append('uploaded_images', file);
      });

      if (editingId) {
        await api.put(`/api/products/${editingId}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Product updated!');
      } else {
        await api.post('/api/products/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Product created!');
      }

      setShowForm(false);
      setEditingId(null);
      setForm({ name: '', description: '', price: '', stock: '', category: '', condition: 'New' });
      setImageFiles([]);
      fetchProducts(1, true);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (product: any) => {
    setForm({
      name: product.name,
      description: product.description,
      price: product.price,
      stock: String(product.stock),
      category: String(product.category),
      condition: product.condition,
    });
    setEditingId(product.slug);
    setShowForm(true);
  };

  const handleDelete = async (slug: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/api/products/${slug}/`);
      toast.success('Product deleted');
      fetchProducts(1, true);
    } catch {
      toast.error('Failed to delete product');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">My Products</h2>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setForm({ name: '', description: '', price: '', stock: '', category: '', condition: 'New' });
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
        >
          <Plus size={16} />
          {showForm ? 'Cancel' : 'New Product'}
        </button>
      </div>

      {/* Product Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-6 mb-6 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-white">
            {editingId ? 'Edit Product' : 'Create Product'}
          </h3>
          <input name="name" value={form.name} onChange={handleChange} placeholder="Product Name" required
            className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" />
          <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" required rows={3}
            className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white resize-none" />
          <div className="grid grid-cols-2 gap-4">
            <input name="price" value={form.price} onChange={handleChange} placeholder="Price" type="number" required
              className="p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" />
            <input name="stock" value={form.stock} onChange={handleChange} placeholder="Stock" type="number" required
              className="p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <select name="category" value={form.category} onChange={handleChange} required
              className="p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white">
              <option value="">Select Category</option>
              {categories.map((cat: any) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <select name="condition" value={form.condition} onChange={handleChange}
              className="p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white">
              <option value="New">New</option>
              <option value="Used">Used</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Product Images (multiple)
            </label>
            <input type="file" multiple accept="image/*" onChange={handleImageChange}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            {imageFiles.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">{imageFiles.length} file(s) selected</p>
            )}
          </div>
          <button type="submit" disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition">
            {submitting ? 'Saving...' : editingId ? 'Update Product' : 'Create Product'}
          </button>
        </form>
      )}

      {/* Products Table */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
          <Package size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No products yet. Create your first listing!</p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map((product: any) => (
            <div key={product.id}
              className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4 hover:shadow-sm transition">
              <SafeImage src={product.images?.[0]?.image || ''} alt={product.name}
                className="w-16 h-16 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 dark:text-white truncate">{product.name}</h4>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-bold">
                  TSh {parseInt(product.price).toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">Stock: {product.stock}</p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button onClick={() => handleEdit(product)}
                  className="px-3 py-1.5 text-xs text-center border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300">
                  Edit
                </button>
                <button onClick={() => handleDelete(product.slug)}
                  className="px-3 py-1.5 text-xs text-center border border-red-300 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        {hasMore && <div ref={sentinelRef} className="h-4" />}
        {loadingMore && <div className="text-center py-4 text-gray-500 text-sm">Loading more...</div>}
        </>
      )}
    </div>
  );
};

// ============ Dashboard Promotions ============
const DashboardPromotions: React.FC = () => {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ product: '', title: '', description: '' });
  const [products, setProducts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchPromotions = () => {
    setLoading(true);
    api.get('/api/sponsored/')
      .then(res => setPromotions(res.data.results || res.data))
      .catch(() => toast.error('Failed to load promotions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPromotions();
    api.get('/api/products/').then(res => setProducts(res.data.results || res.data)).catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/api/sponsored/', form);
      toast.success('Promotion requested successfully!');
      setShowForm(false);
      setForm({ product: '', title: '', description: '' });
      fetchPromotions();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to submit promotion request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Promotions</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
        >
          <Plus size={16} />
          {showForm ? 'Cancel' : 'New Promotion'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-6 mb-6 shadow-sm space-y-4 animate-fade-in">
          <select name="product" value={form.product} onChange={handleChange} required className="input">
            <option value="">Select Product to Promote</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input name="title" value={form.title} onChange={handleChange} placeholder="Promo Title (e.g. 50% Off Summer Sale)" required className="input" />
          <textarea name="description" value={form.description} onChange={handleChange} placeholder="Details about this promotion..." required rows={3} className="input resize-none" />
          <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : promotions.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
          <Megaphone size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No active promotions. Request one now!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promotions.map((p: any) => (
            <div key={p.id} className="card p-4 border-l-4 border-l-brand-600 animate-fade-in">
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${p.approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {p.approved ? 'Live' : 'Pending'}
                </span>
                <span className="text-[10px] text-gray-400">{new Date(p.created_at).toLocaleDateString()}</span>
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-1">{p.title}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{p.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============ Incoming Orders (Seller) ============
const ORDER_STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  CART: { label: 'Cart', color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-700' },
  CHECKOUT: { label: 'Checkout', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  AWAITING_PAYMENT: { label: 'Awaiting Payment', color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  PENDING_VERIFICATION: { label: 'Verifying', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  PAID: { label: 'Paid', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
  PROCESSING: { label: 'Processing', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  SHIPPED: { label: 'Shipped', color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  DELIVERED: { label: 'Delivered', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
  COMPLETED: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100 dark:bg-green-900/30' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
};
const SELLER_ADVANCE_MAP: Record<string, string> = {
  PAID: 'PROCESSING', PROCESSING: 'SHIPPED', SHIPPED: 'DELIVERED', DELIVERED: 'COMPLETED'
};
const fmtOrderDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const DashboardOrders: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [advancing, setAdvancing] = useState<number | null>(null);

  const fetchOrders = () => {
    setLoading(true);
    const params = filterStatus ? `?status=${filterStatus}` : '';
    api.get(`/api/orders/incoming/${params}`)
      .then(res => setOrders(Array.isArray(res.data) ? res.data : []))
      .catch(() => toast.error('Failed to load incoming orders'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchOrders(); }, [filterStatus]);

  useOrderTracking('seller', (update: TrackingUpdate) => {
    setOrders(prev => prev.map(o => {
      if (o.id === update.order_id) {
        const newTimelineEvent = {
          status: update.status,
          notes: update.notes,
          created_at: update.timestamp
        };
        const currentTimeline = o.timeline || [];
        return { ...o, status: update.status, timeline: [newTimelineEvent, ...currentTimeline] };
      }
      return o;
    }));
  });

  const handleAdvance = async (orderId: number, nextStatus: string, notes: string = "") => {
    setAdvancing(orderId);
    try {
      await api.post(`/api/orders/${orderId}/advance/`, { status: nextStatus, notes });
      toast.success(`Order #${orderId} state updated!`);
      fetchOrders();
    } catch { toast.error('Failed to update order'); }
    finally { setAdvancing(null); }
  };

  const filterTabs = ['', 'AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Incoming Orders</h2>
        <span className="text-[10px] font-bold bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded shadow-sm uppercase tracking-widest text-gray-500">Live View</span>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 flex-wrap mb-4 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
        {filterTabs.map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 text-[10px] sm:text-xs rounded-lg font-bold transition uppercase tracking-wider ${filterStatus === s ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            {s ? (ORDER_STATUS_CFG[s]?.label || s) : 'All Orders'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <ShoppingCart size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 font-medium">No incoming orders found</p>
          {filterStatus && <button onClick={() => setFilterStatus('')} className="text-brand-600 text-sm font-bold mt-2 hover:underline">Clear Filter</button>}
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => {
            const cfg = ORDER_STATUS_CFG[order.status] || ORDER_STATUS_CFG.CART;
            const isExpanded = expandedId === order.id;
            const nextStatus = SELLER_ADVANCE_MAP[order.status];
            const hasPendingPayment = order.status === 'PENDING_VERIFICATION';

            return (
              <div key={order.id} className={`bg-white dark:bg-gray-800 rounded-2xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'shadow-xl ring-1 ring-blue-500/20' : 'shadow-sm hover:shadow-md border-gray-100 dark:border-gray-700'}`}>
                {/* Header */}
                <button onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-gray-50/20 transition">
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-inner ${cfg.bg}`}>
                       <ShoppingCart size={20} className={cfg.color} />
                    </div>
                    <div>
                        <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Order #{order.id}</p>
                        <p className="text-[10px] font-bold text-gray-400 mt-0.5">{fmtOrderDate(order.order_date)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:block text-right">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Customer</p>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{order.buyer}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest ${cfg.bg} ${cfg.color} shadow-sm mb-1.5`}>
                          {cfg.label}
                      </span>
                      <p className="font-black text-gray-900 dark:text-white text-base">TSh {order.seller_subtotal.toLocaleString()}</p>
                    </div>
                    {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                  </div>
                </button>

                {/* Expanded */}
                {isExpanded && (
                  <div className="border-t border-gray-50 dark:border-gray-700 bg-gray-50/20 dark:bg-gray-900/5 pulse-in">
                    
                    {/* Payment Verification Block */}
                    {hasPendingPayment && order.payments?.length > 0 && (
                      <div className="px-6 py-6 bg-blue-50/50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/20">
                          <div className="flex items-center gap-2 mb-4">
                              <ShieldCheck className="text-blue-600" size={20} />
                              <h4 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-wider">Payment Verification Needed</h4>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-4">
                                  {order.payments.filter((p:any) => p.status === 'PENDING_VERIFICATION').map((p:any) => (
                                      <div key={p.id} className="card p-4 space-y-3 bg-white/70 dark:bg-gray-800/70 border-blue-200">
                                          <div className="flex justify-between text-xs">
                                              <span className="text-gray-500 font-bold uppercase">Transaction ID</span>
                                              <span className="font-black text-blue-700 dark:text-blue-400 select-all">{p.transaction_id || 'N/A'}</span>
                                          </div>
                                          <div className="flex justify-between text-xs">
                                              <span className="text-gray-500 font-bold uppercase">Amount</span>
                                              <span className="font-bold text-gray-900 dark:text-white">TSh {p.amount.toLocaleString()}</span>
                                          </div>
                                          
                                          {p.proof_image && (
                                              <div className="group relative rounded-xl overflow-hidden cursor-zoom-in">
                                                  <img src={p.proof_image} alt="Proof" className="w-full h-40 object-cover transition duration-300 group-hover:scale-110" />
                                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                                      <Link to={p.proof_image} target="_blank" className="btn-primary py-1 px-3 text-xs flex items-center gap-1">
                                                          <Eye size={14} /> Full View
                                                      </Link>
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  ))}
                              </div>
                              
                              <div className="bg-white/50 dark:bg-gray-800/50 p-5 rounded-2xl border border-blue-100/50 dark:border-blue-900/20 flex flex-col justify-center gap-3">
                                  <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                                     "Review the transaction ID and receipt above. Once confirmed, mark as PAID to allow the order to proceed to processing."
                                  </p>
                                  <div className="flex gap-2 mt-2">
                                      <button 
                                          onClick={() => handleAdvance(order.id, 'PAID', 'Payment verified by seller.')}
                                          className="flex-1 btn-primary py-2.5 bg-green-600 hover:bg-green-700 border-green-600 text-[11px] font-black uppercase tracking-widest shadow-lg shadow-green-600/20"
                                      >
                                          Confirm Payment
                                      </button>
                                      <button 
                                          onClick={() => handleAdvance(order.id, 'AWAITING_PAYMENT', 'Payment rejected. Incorrect transaction ID or proof.')}
                                          className="flex-1 btn-ghost py-2.5 border-red-100 text-red-500 hover:bg-red-50 text-[11px] font-bold uppercase tracking-widest"
                                      >
                                          Reject
                                      </button>
                                  </div>
                              </div>
                          </div>
                      </div>
                    )}

                    {/* Order Content */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-gray-700">
                        {/* Left: Items (Cols 3) */}
                        <div className="lg:col-span-3 p-6">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-5">Package Contents</p>
                            <div className="space-y-3">
                                {order.items.map((item: any) => (
                                <div key={item.id} className="flex items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-50 dark:border-gray-700 shadow-sm transition hover:shadow-md">
                                    {item.product_image && (
                                    <img src={item.product_image} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-100 dark:border-gray-600 shadow-inner" onError={(e: any) => e.target.style.display = 'none'} />
                                    )}
                                    <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-gray-900 dark:text-white truncate">{item.product_name}</p>
                                    <p className="text-xs text-gray-500 font-bold mt-0.5">Qty: {item.quantity} × TSh {item.price.toLocaleString()}</p>
                                    </div>
                                    <p className="text-sm font-black text-gray-900 dark:text-white">TSh {item.subtotal.toLocaleString()}</p>
                                </div>
                                ))}
                            </div>
                        </div>

                        {/* Right: Timeline & Actions (Cols 2) */}
                        <div className="lg:col-span-2 p-6 bg-gray-50/50 dark:bg-gray-800/10 flex flex-col justify-between">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-5">Order History</p>
                                <div className="space-y-4 relative pl-4 border-l-2 border-blue-100 dark:border-blue-900/30 py-1">
                                    {order.timeline?.slice(0, 3).map((ev: any, i: number) => (
                                        <div key={i} className="relative">
                                            <div className="absolute -left-[21.5px] w-2.5 h-2.5 rounded-full bg-blue-400 border-2 border-white dark:border-gray-800 shadow-sm" />
                                            <div className="ml-3">
                                                <p className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase tracking-tighter">{ORDER_STATUS_CFG[ev.status]?.label || ev.status}</p>
                                                <p className="text-[10px] text-gray-400 mt-0.5 font-bold uppercase">{fmtOrderDate(ev.created_at)}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {order.timeline?.length > 3 && <p className="text-[10px] text-blue-500 font-bold px-2">+ {order.timeline.length - 3} more events</p>}
                                </div>
                            </div>

                            {/* Action Button */}
                            {nextStatus && (
                                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                                    <button
                                        onClick={() => handleAdvance(order.id, nextStatus, `Updated to ${nextStatus} by seller.`)}
                                        disabled={advancing === order.id}
                                        className="w-full btn-primary py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 group"
                                    >
                                        {advancing === order.id ? (
                                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                        ) : (
                                            <>
                                              Move to {ORDER_STATUS_CFG[nextStatus]?.label || nextStatus}
                                              <ShieldCheck size={16} className="transition-transform group-hover:scale-125" />
                                            </>
                                        )}
                                    </button>
                                    <p className="text-[10px] text-center text-gray-400 mt-3 font-bold uppercase tracking-widest italic">
                                        Last updated: {fmtOrderDate(order.order_date)}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============ Dashboard Layout ============
const DashboardLayout: React.FC = () => {
  const location = useLocation();

  const isSuperuser = localStorage.getItem('is_superuser') === 'true';

  const navItems = [
    { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { path: '/dashboard/products', label: 'Products', icon: Package },
    { path: '/dashboard/orders', label: 'Incoming Orders', icon: ShoppingCart },
    { path: '/dashboard/promotions', label: 'Promotions', icon: Megaphone },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 flex flex-col lg:flex-row gap-6">
      {/* Sidebar */}
      <aside className="w-full lg:w-56 shrink-0">
        <nav className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}

          {isSuperuser && (
            <>
              <hr className="my-2 border-gray-100 dark:border-gray-700" />
              <Link
                to="/staff-admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-brand-600 dark:text-brand-400 font-bold hover:bg-brand-50 dark:hover:bg-brand-900/10 transition"
              >
                <Shield size={18} />
                Staff Admin
              </Link>
            </>
          )}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 animate-fade-in">
        <Routes>
          <Route index element={<DashboardOverview />} />
          <Route path="products" element={<DashboardProducts />} />
          <Route path="orders" element={<DashboardOrders />} />
          <Route path="promotions" element={<DashboardPromotions />} />
        </Routes>
      </main>
    </div>
  );
};

export default DashboardLayout;
