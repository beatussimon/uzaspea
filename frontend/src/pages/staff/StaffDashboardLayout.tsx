import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Megaphone, Activity,
  CheckCircle2, AlertTriangle, Shield, Star,
  CreditCard, FileText, Layers, MessageSquare, Send, Package, Truck,
  BarChart2, ChevronLeft, ChevronRight, Search, Eye, X, ArrowUpRight,
  UserCircle, Clock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../api';
import toast from 'react-hot-toast';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { KpiCard } from '../../components/ui/KpiCard';
import {
  PageHeaderSkeleton,
  KpiGridSkeleton,
  CardGridSkeleton,
  CardListSkeleton
} from '../../components/Skeleton';
import StaffInspectionLayout from './inspections/StaffInspectionLayout';
import WarehouseStaffLayout from './warehouse/WarehouseStaffLayout';
import LogisticsManager from './logistics/LogisticsManager';
import StaffTasks from './StaffTasks';

// ============ Types ============
interface StaffTask {
  id: number; title: string; status: string; priority: string;
  category: string; due_date: string | null; is_overdue: boolean;
}
interface PendingPromo {
  id: number; title: string; description: string; product_name: string;
  product_slug: string; seller: string; status: string; created_at: string;
}
interface RecentAction {
  id: number; task_title: string; action_type: string;
  status: string; performed_at: string;
}
interface DashboardData {
  user: {
    username: string;
    is_inspector: boolean;
    is_superuser: boolean;
    permissions: string[];
  };
  tasks: StaffTask[];
  unassigned_tasks: StaffTask[];
  task_counts: Record<string, number>;
  pending_promotions: PendingPromo[];
  recent_actions: RecentAction[];
  admin_overview?: {
    subscriptions_pending: number;
    seller_upgrades_pending: number;
    commissions_pending: number;
    products_pending: number;
    reviews_pending: number;
    warehouse_intake_pending: number;
    logistics_in_transit: number;
    inspections_pending: number;
  };
  admin_task_metrics?: {
    global_counts: Record<string, number>;
    worker_performance: {
      worker: string;
      completed: number;
      pending: number;
      in_progress: number;
      on_hold: number;
    }[];
  };
}

// ============ Helpers ============
const priorityColors: Record<string, string> = {
  low: 'text-gray-500', medium: 'text-brand-500', high: 'text-orange-500', urgent: 'text-red-500',
};

const statusConfig: Record<string, { dot: string; color: string; bg: string }> = {
  pending: { dot: 'bg-amber-500', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  in_progress: { dot: 'bg-blue-500', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  on_hold: { dot: 'bg-orange-500', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  completed: { dot: 'bg-emerald-500', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  cancelled: { dot: 'bg-red-500', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  approved: { dot: 'bg-emerald-500', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  rejected: { dot: 'bg-red-500', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  active: { dot: 'bg-emerald-500', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  suspended: { dot: 'bg-red-500', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
};

const Badge: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const norm = text.toLowerCase().replace(/_/g, ' ');
  const cfg = statusConfig[text.toLowerCase()] || {
    dot: 'bg-gray-400',
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-500/10 border-gray-500/20'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border capitalize ${cfg.bg} ${cfg.color} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {norm}
    </span>
  );
};

const fmtDate = (d: string) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ============ Staff Overview ============
interface StaffHomeProps {
  data: DashboardData | null;
  loading: boolean;
}

const AdminOverviewPanel: React.FC<{ data: DashboardData['admin_overview'] }> = ({ data }) => {
  if (!data) return null;
  const metrics = [
    { label: 'Subscriptions', val: data.subscriptions_pending, icon: CreditCard, path: '/staff/subscriptions' },
    { label: 'Seller Upgrades', val: data.seller_upgrades_pending, icon: Shield, path: '/staff/seller-applications' },
    { label: 'Warehouse Intake', val: data.warehouse_intake_pending, icon: Package, path: '/staff/warehouse' },
    { label: 'Logistics Transit', val: data.logistics_in_transit, icon: Truck, path: '/staff/logistics' },
    { label: 'Commissions', val: data.commissions_pending, icon: FileText, path: '/staff/invoices' },
    { label: 'Product Moderation', val: data.products_pending, icon: Layers, path: '/staff/products' },
    { label: 'Pending Reviews', val: data.reviews_pending, icon: Star, path: '/staff/reviews' },
    { label: 'Inspections', val: data.inspections_pending, icon: LayoutDashboard, path: '/staff/inspections' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Global Operational Queues</h3>
        <span className="text-[11px] font-medium text-brand-600 dark:text-brand-400 bg-brand-500/10 px-2.5 py-0.5 rounded-full">Live Pipeline</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 2xl:grid-cols-8 gap-3">
        {metrics.map((m) => (
          <Link
            key={m.label}
            to={m.path}
            className="card p-3 flex flex-col justify-between hover:border-gray-900/30 dark:hover:border-white/30 transition-all hover:shadow-xs group select-none min-h-[78px]"
          >
            <div className="flex items-center justify-between gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-brand-500/10 dark:bg-brand-500/15 flex items-center justify-center shrink-0">
                <m.icon size={13} className="text-brand-500 shrink-0" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-lg font-black text-gray-900 dark:text-white leading-none tracking-tight">
                  {m.val}
                </span>
                <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-gray-400" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 leading-tight block line-clamp-2" title={m.label}>
                {m.label}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

const StaffHome: React.FC<StaffHomeProps> = ({ data, loading }) => {
  const [claiming, setClaiming] = useState<number | null>(null);
  const [taskTab, setTaskTab] = useState<'assigned' | 'unassigned'>('assigned');

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeaderSkeleton />
        <KpiGridSkeleton count={4} cols={4} />
        <CardListSkeleton count={4} />
      </div>
    );
  }
  if (!data) return <EmptyState icon={AlertTriangle} title="No Data Available" description="Could not load staff dashboard metrics." />;

  const handleClaim = async (id: number) => {
    setClaiming(id);
    try {
      await api.post(`/api/staff/tasks/${id}/claim/`);
      toast.success('Task claimed successfully');
      window.location.reload();
    } catch {
      toast.error('Failed to claim task');
    } finally {
      setClaiming(null);
    }
  };

  const tc = data.admin_task_metrics ? data.admin_task_metrics.global_counts : data.task_counts;
  const isGlobal = !!data.admin_task_metrics;
  const totalTasks = (tc?.pending || 0) + (tc?.in_progress || 0) + (tc?.on_hold || 0) + (tc?.completed || 0);
  const completionRate = totalTasks > 0 ? Math.round(((tc?.completed || 0) / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff Control Center</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Real-time oversight of operations, assigned tasks, verification pipelines, and customer disputes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium bg-surface-muted dark:bg-[#161616] text-gray-700 dark:text-gray-300 border border-surface-border dark:border-surface-dark-border px-3 py-1.5 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            @{data.user.username}
          </span>
        </div>
      </header>

      {/* Superuser Global Overview */}
      {data.user.is_superuser && data.admin_overview && (
        <AdminOverviewPanel data={data.admin_overview} />
      )}

      {/* High-Level Operational Status KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <KpiCard
          label={isGlobal ? "Total Workload" : "My Assignments"}
          value={isGlobal ? totalTasks : data.tasks.length}
          sub={`${tc?.pending || 0} pending`}
          icon={ClipboardList}
          color="#3b82f6"
        />
        <KpiCard
          label="Open Pool"
          value={tc?.unassigned || data.unassigned_tasks.length || 0}
          sub="unclaimed tickets"
          icon={UserCircle}
          color="#f97316"
        />
        <KpiCard
          label="In Progress"
          value={tc?.in_progress || 0}
          sub="active operations"
          icon={Clock}
          color="#a855f7"
        />
        <KpiCard
          label="Resolution Rate"
          value={`${completionRate}%`}
          sub={`${tc?.completed || 0} completed`}
          icon={CheckCircle2}
          color="#10b981"
        />
      </div>

      {/* Analytics Chart for Admins */}
      {isGlobal && data.admin_task_metrics && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart2 className="text-brand-500" size={16} />
            Worker Performance Metrics
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.admin_task_metrics.worker_performance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:opacity-10" />
                <XAxis dataKey="worker" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #333', backgroundColor: '#111', color: '#fff', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                <Bar dataKey="in_progress" name="In Progress" stackId="a" fill="#3b82f6" />
                <Bar dataKey="pending" name="Pending" stackId="a" fill="#eab308" />
                <Bar dataKey="on_hold" name="On Hold" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 2-Column Dashboard Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Task Operations Queue */}
        <div className="lg:col-span-2 card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTaskTab('assigned')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  taskTab === 'assigned'
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black'
                    : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Assigned to Me ({data.tasks.length})
              </button>
              <button
                type="button"
                onClick={() => setTaskTab('unassigned')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  taskTab === 'unassigned'
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black'
                    : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Open Pool ({data.unassigned_tasks.length})
              </button>
            </div>
            <Link to="/staff/tasks" className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
              Open Task Board <ChevronRight size={13} />
            </Link>
          </div>

          {taskTab === 'assigned' ? (
            data.tasks.length === 0 ? (
              <div className="text-center py-10 text-xs text-gray-400">No active tasks currently assigned to you.</div>
            ) : (
              <div className="space-y-2">
                {data.tasks.slice(0, 6).map((t) => (
                  <Link
                    to="/staff/tasks"
                    key={t.id}
                    className="flex items-center justify-between p-3 rounded-btn hover:bg-surface-muted/50 dark:hover:bg-[#161616]/50 transition border border-transparent hover:border-surface-border dark:hover:border-surface-dark-border group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {t.is_overdue && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 dark:text-white group-hover:text-brand-500 truncate transition-colors">
                          {t.title}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {t.category} • <span className={priorityColors[t.priority]}>{t.priority}</span>
                        </p>
                      </div>
                    </div>
                    <Badge text={t.status} />
                  </Link>
                ))}
              </div>
            )
          ) : (
            data.unassigned_tasks.length === 0 ? (
              <div className="text-center py-10 text-xs text-gray-400">No unassigned tasks awaiting pickup.</div>
            ) : (
              <div className="space-y-2">
                {data.unassigned_tasks.slice(0, 6).map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-btn hover:bg-surface-muted/50 dark:hover:bg-[#161616]/50 transition border border-transparent hover:border-surface-border dark:hover:border-surface-dark-border">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{t.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {t.category} • <span className={priorityColors[t.priority] || 'text-gray-500'}>{t.priority}</span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleClaim(t.id)}
                      disabled={claiming === t.id}
                      className="py-1 px-3 text-xs font-medium"
                    >
                      {claiming === t.id ? 'Claiming...' : 'Claim'}
                    </Button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Right 1 Col: Quick Queues & Recent Activity */}
        <div className="space-y-6">
          {/* Promo Queue Preview */}
          {(data.user.permissions.includes('can_review_promotions') || data.user.permissions.includes('can_approve_content')) && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <Megaphone size={15} className="text-purple-500" /> Promotion Review
                </h3>
                <Link to="/staff/promotions" className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
                  Queue ({data.pending_promotions.length}) <ChevronRight size={13} />
                </Link>
              </div>
              {data.pending_promotions.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No pending sponsored promotions awaiting review.</p>
              ) : (
                <div className="space-y-2">
                  {data.pending_promotions.slice(0, 3).map((p) => (
                    <div key={p.id} className="p-2.5 rounded-btn bg-surface-muted/30 dark:bg-[#161616]/30 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{p.title || p.product_name}</p>
                        <p className="text-[11px] text-gray-400">{p.product_name} • @{p.seller}</p>
                      </div>
                      <Badge text="pending" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity Log */}
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-2">
              <Activity size={15} className="text-emerald-500" /> Recent Actions
            </h3>
            {data.recent_actions.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No recorded recent staff actions.</p>
            ) : (
              <div className="space-y-2.5">
                {data.recent_actions.slice(0, 5).map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <span className="font-medium text-[11px] text-brand-600 dark:text-brand-400 mr-1.5 capitalize">{a.action_type}</span>
                      <span className="text-gray-700 dark:text-gray-300 font-normal">{a.task_title}</span>
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0 font-mono">{fmtDate(a.performed_at).split(',')[0]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ Subscription Upgrades ============
export const SubscriptionConfirmation: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchItems = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    api.get(`/api/staff/payment-confirmations/?status=${filter}&page=${p}`)
      .then((res) => {
        const data = res.data.results || res.data;
        const incoming = Array.isArray(data) ? data : [];
        if (reset) setItems(incoming);
        else {
          setItems((prev) => {
            const ids = new Set(prev.map((i) => i.id));
            return [...prev, ...incoming.filter((i) => !ids.has(i.id))];
          });
        }
        setHasMore(!!res.data.next);
      })
      .catch(() => {
        toast.error('Failed to load subscription confirmations');
        setHasMore(false);
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [filter]);

  useEffect(() => {
    fetchItems(1, true);
  }, [fetchItems]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || loading) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage((prev) => {
            const nextPage = prev + 1;
            fetchItems(nextPage);
            return nextPage;
          });
        }
      },
      { rootMargin: '400px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchItems]);

  const handleVerify = async (id: number) => {
    try {
      await api.post(`/api/staff/payment-confirmations/${id}/verify/`);
      toast.success('Subscription upgrade approved!');
      fetchItems(1, true);
    } catch {
      toast.error('Failed to approve subscription');
    }
  };

  const handleReject = async (id: number) => {
    try {
      await api.post(`/api/staff/payment-confirmations/${id}/reject/`);
      toast.success('Subscription upgrade rejected');
      fetchItems(1, true);
    } catch {
      toast.error('Failed to reject subscription');
    }
  };

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (item) =>
        (item.username || '').toLowerCase().includes(q) ||
        (item.reference || '').toLowerCase().includes(q) ||
        (item.tier_name || '').toLowerCase().includes(q) ||
        String(item.amount).includes(q)
    );
  }, [items, search]);

  const filterTabs = [
    { key: 'pending', label: 'Pending Verification' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscription Confirmations</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Review and verify tier upgrade payments submitted by sellers.
          </p>
        </div>
      </header>

      {/* Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {filterTabs.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username, reference..."
            className="input pl-8 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <CardGridSkeleton count={6} cols={3} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={`No ${filter} subscription upgrades`}
          description={search ? 'No requests match your search criteria.' : `There are currently no ${filter} upgrade requests.`}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div key={item.id} className="card p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">@{item.username}</h3>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">Ref: {item.reference}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-brand-500/10 text-brand-500 border border-brand-500/20 uppercase">
                    {item.tier_name}
                  </span>
                </div>

                {/* Clean Unboxed Metadata */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400 dark:text-gray-500 font-normal">Amount</span>
                    <span className="font-bold text-gray-900 dark:text-white">TZS {parseFloat(item.amount || '0').toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 dark:text-gray-500 font-normal">Submitted</span>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{fmtDate(item.created_at)}</span>
                  </div>
                </div>

                {item.proof && (
                  <div
                    onClick={() => setPreviewImage(item.proof)}
                    className="relative group cursor-pointer overflow-hidden rounded-btn border border-surface-border/40 h-28 bg-surface-muted"
                  >
                    <img src={item.proof} alt="Receipt proof" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <span className="text-white text-xs font-bold flex items-center gap-1.5">
                        <Eye size={14} /> View Receipt
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {filter === 'pending' && (
                <div className="flex gap-2 pt-2 border-t border-surface-border/40">
                  <Button variant="default" size="sm" onClick={() => handleVerify(item.id)} className="flex-1">
                    Confirm Upgrade
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleReject(item.id)} className="flex-1 text-red-500 hover:text-red-600">
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Infinite Scroll Sentinel */}
      {loadingMore && <div className="flex justify-center py-4"><Spinner size="sm" /></div>}
      <div ref={sentinelRef} className="h-4" />

      {/* Modal for image preview */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-3xl max-h-[85vh] bg-surface-card dark:bg-[#0A0A0A] p-2 rounded-card border border-surface-border" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition">
              <X size={16} />
            </button>
            <img src={previewImage} alt="Payment Proof" className="max-w-full max-h-[80vh] object-contain rounded-btn" />
          </div>
        </div>
      )}
    </div>
  );
};

// ============ Seller Upgrade Applications ============
export const SellerApplicationsManager: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);

  const fetchItems = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    api.get(`/api/staff/seller-applications/?status=${filter}&page=${p}`)
      .then((res) => {
        const data = res.data.results || res.data;
        const incoming = Array.isArray(data) ? data : [];
        if (reset) setItems(incoming);
        else {
          setItems((prev) => {
            const ids = new Set(prev.map((i) => i.id));
            return [...prev, ...incoming.filter((i) => !ids.has(i.id))];
          });
        }
        setHasMore(!!res.data.next);
      })
      .catch(() => {
        toast.error('Failed to load seller upgrade applications');
        setHasMore(false);
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [filter]);

  useEffect(() => {
    fetchItems(1, true);
  }, [fetchItems]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || loading) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage((prev) => {
            const nextPage = prev + 1;
            fetchItems(nextPage);
            return nextPage;
          });
        }
      },
      { rootMargin: '400px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchItems]);

  const handleApprove = async (id: number) => {
    try {
      await api.post(`/api/staff/seller-applications/${id}/approve/`);
      toast.success('Seller application approved!');
      fetchItems(1, true);
    } catch {
      toast.error('Failed to approve application');
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Reason for rejection (shown to applicant):');
    if (reason === null) return;
    try {
      await api.post(`/api/staff/seller-applications/${id}/reject/`, { reason });
      toast.success('Seller application rejected');
      fetchItems(1, true);
    } catch {
      toast.error('Failed to reject application');
    }
  };

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (item) =>
        (item.business_name || '').toLowerCase().includes(q) ||
        (item.username || '').toLowerCase().includes(q) ||
        (item.tin_number || '').toLowerCase().includes(q) ||
        (item.business_registration_number || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const filterTabs = [
    { key: 'pending', label: 'Pending Applications' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Seller Upgrade Applications</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Verify official business identities, TIN registrations, and merchant credentials.
          </p>
        </div>
      </header>

      {/* Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {filterTabs.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business, TIN, username..."
            className="input pl-8 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <CardGridSkeleton count={6} cols={3} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={`No ${filter} applications`}
          description={search ? 'No applications match your search query.' : `There are currently no ${filter} seller upgrade applications.`}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div key={item.id} className="card p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">{item.business_name}</h3>
                    <p className="text-xs text-gray-500">Applicant: @{item.username}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20 uppercase">
                    {item.requested_tier_name || 'Seller Pro'}
                  </span>
                </div>

                {/* Structured Metadata - Unboxed */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400 dark:text-gray-500 font-normal block">Reg Number</span>
                    <span className="font-medium text-gray-900 dark:text-gray-200">{item.business_registration_number || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 dark:text-gray-500 font-normal block">TIN Number</span>
                    <span className="font-medium text-gray-900 dark:text-gray-200">{item.tin_number || 'N/A'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 dark:text-gray-500 font-normal block">Location</span>
                    <span className="font-medium text-gray-900 dark:text-gray-200">{item.business_address || 'N/A'}, {item.business_region || ''}</span>
                  </div>
                  {item.rejection_reason && (
                    <div className="col-span-2 pt-1 border-t border-surface-border/40 text-red-500">
                      <span className="font-medium block">Rejection Note</span>
                      <span>{item.rejection_reason}</span>
                    </div>
                  )}
                </div>

                {/* Document Previews */}
                <div className="flex gap-2 pt-1">
                  {item.id_document && (
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(item.id_document)}
                      className="flex-1 py-1.5 px-3 bg-surface-muted dark:bg-[#161616] hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-btn text-xs font-medium text-gray-700 dark:text-gray-300 border border-surface-border/40 transition flex items-center justify-center gap-1.5"
                    >
                      <Eye size={13} /> View ID Doc
                    </button>
                  )}
                  {item.business_document && (
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(item.business_document)}
                      className="flex-1 py-1.5 px-3 bg-surface-muted dark:bg-[#161616] hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-btn text-xs font-medium text-gray-700 dark:text-gray-300 border border-surface-border/40 transition flex items-center justify-center gap-1.5"
                    >
                      <FileText size={13} /> View Biz Doc
                    </button>
                  )}
                </div>
              </div>

              {item.status === 'pending' && (
                <div className="flex gap-2 pt-2 border-t border-surface-border/40">
                  <Button variant="default" size="sm" onClick={() => handleApprove(item.id)} className="flex-1">
                    Approve
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleReject(item.id)} className="flex-1 text-red-500 hover:text-red-600">
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Infinite Scroll Sentinel */}
      {loadingMore && <div className="flex justify-center py-4"><Spinner size="sm" /></div>}
      <div ref={sentinelRef} className="h-4" />

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" onClick={() => setPreviewDoc(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full bg-surface-card dark:bg-[#0A0A0A] p-4 rounded-card border border-surface-border overflow-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewDoc(null)} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition z-10">
              <X size={16} />
            </button>
            {previewDoc.match(/\.(jpeg|jpg|gif|png)$/i) ? (
              <img src={previewDoc} alt="Document Preview" className="max-w-full max-h-[80vh] object-contain mx-auto rounded-btn" />
            ) : (
              <iframe src={previewDoc} title="Document Preview" className="w-full h-[75vh] rounded-btn border border-surface-border" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============ Commission Payments ============
export const CommissionPaymentsManager: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [filter, setFilter] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchItems = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    api.get(`/api/staff/commission-payments/?status=${filter}&page=${p}`)
      .then((res) => {
        const data = res.data.results || res.data;
        const incoming = Array.isArray(data) ? data : [];
        if (reset) setItems(incoming);
        else {
          setItems((prev) => {
            const ids = new Set(prev.map((i) => i.id));
            return [...prev, ...incoming.filter((i) => !ids.has(i.id))];
          });
        }
        setHasMore(!!res.data.next);
      })
      .catch(() => {
        toast.error('Failed to load commission payments');
        setHasMore(false);
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [filter]);

  useEffect(() => {
    fetchItems(1, true);
  }, [fetchItems]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || loading) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage((prev) => {
            const nextPage = prev + 1;
            fetchItems(nextPage);
            return nextPage;
          });
        }
      },
      { rootMargin: '400px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchItems]);

  const handleVerify = async (id: number) => {
    try {
      await api.post(`/api/staff/commission-payments/${id}/approve/`);
      toast.success('Commission payment approved!');
      fetchItems(1, true);
    } catch {
      toast.error('Failed to approve payment');
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Reason for rejection (shown to seller):');
    if (reason === null) return;
    try {
      await api.post(`/api/staff/commission-payments/${id}/reject/`, { reason });
      toast.success('Commission payment rejected');
      fetchItems(1, true);
    } catch {
      toast.error('Failed to reject payment');
    }
  };

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (item) =>
        (item.seller_username || '').toLowerCase().includes(q) ||
        (item.transaction_id || '').toLowerCase().includes(q) ||
        String(item.amount).includes(q)
    );
  }, [items, search]);

  const filterTabs = [
    { key: 'PENDING', label: 'Pending Verification' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'REJECTED', label: 'Rejected' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Commission Payments</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Verify monthly seller platform commission invoice settlements and payment receipts.
          </p>
        </div>
      </header>

      {/* Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {filterTabs.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search seller, Tx ID..."
            className="input pl-8 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <CardGridSkeleton count={6} cols={3} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={`No ${filter.toLowerCase()} payments`}
          description={search ? 'No payments match your search criteria.' : `There are no ${filter.toLowerCase()} commission payments.`}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div key={item.id} className="card p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">@{item.seller_username}</h3>
                    <p className="text-xs text-gray-400 font-mono">Invoice: {item.invoice_year}/{item.invoice_month}</p>
                    <p className="text-xs text-gray-400 font-mono">Tx ID: {item.transaction_id || '—'}</p>
                  </div>
                  <Badge text={item.status.toLowerCase()} />
                </div>

                {/* Clean Unboxed Metadata */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400 dark:text-gray-500 font-normal">Commission Amount</span>
                    <span className="font-black text-gray-900 dark:text-white text-sm">TZS {parseFloat(item.amount || '0').toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 dark:text-gray-500 font-normal">Submitted At</span>
                    <span className="text-gray-700 dark:text-gray-300">{fmtDate(item.submitted_at)}</span>
                  </div>
                  {item.rejection_reason && (
                    <div className="pt-1 border-t border-surface-border/40 text-red-500">
                      <span className="font-medium">Reason:</span> {item.rejection_reason}
                    </div>
                  )}
                </div>

                {item.receipt_screenshot && (
                  <div
                    onClick={() => setPreviewImage(item.receipt_screenshot)}
                    className="relative group cursor-pointer overflow-hidden rounded-btn border border-surface-border/40 h-28 bg-surface-muted"
                  >
                    <img src={item.receipt_screenshot} alt="Receipt screenshot" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <span className="text-white text-xs font-bold flex items-center gap-1.5">
                        <Eye size={14} /> View Receipt
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {filter === 'PENDING' && (
                <div className="flex gap-2 pt-2 border-t border-surface-border/40">
                  <Button variant="default" size="sm" onClick={() => handleVerify(item.id)} className="flex-1">
                    Confirm Payment
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleReject(item.id)} className="flex-1 text-red-500 hover:text-red-600">
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Infinite Scroll Sentinel */}
      {loadingMore && <div className="flex justify-center py-4"><Spinner size="sm" /></div>}
      <div ref={sentinelRef} className="h-4" />

      {/* Modal for image preview */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-3xl max-h-[85vh] bg-surface-card dark:bg-[#0A0A0A] p-2 rounded-card border border-surface-border" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition">
              <X size={16} />
            </button>
            <img src={previewImage} alt="Payment Proof" className="max-w-full max-h-[80vh] object-contain rounded-btn" />
          </div>
        </div>
      )}
    </div>
  );
};

// ============ Product Moderation ============
export const ProductModeration: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchProducts = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    let url = `/api/staff/products/?page=${p}`;
    if (filter === 'active') url += '&is_available=true';
    if (filter === 'suspended') url += '&is_available=false';

    api.get(url)
      .then((res) => {
        const data = res.data.results || res.data;
        const incoming = Array.isArray(data) ? data : [];
        if (reset) setProducts(incoming);
        else {
          setProducts((prev) => {
            const ids = new Set(prev.map((i) => i.id));
            return [...prev, ...incoming.filter((i) => !ids.has(i.id))];
          });
        }
        setHasMore(!!res.data.next);
      })
      .catch(() => {
        toast.error('Failed to load products');
        setHasMore(false);
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [filter]);

  useEffect(() => {
    fetchProducts(1, true);
  }, [fetchProducts]);

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
      { rootMargin: '400px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchProducts]);

  const handleSuspend = async (id: number) => {
    try {
      await api.post(`/api/staff/products/${id}/suspend/`);
      toast.success('Listing suspended');
      fetchProducts(1, true);
    } catch {
      toast.error('Failed to suspend listing');
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await api.post(`/api/staff/products/${id}/approve/`);
      toast.success('Listing approved & activated');
      fetchProducts(1, true);
    } catch {
      toast.error('Failed to approve listing');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to permanently delete this product?')) return;
    try {
      await api.delete(`/api/staff/products/${id}/`);
      toast.success('Listing deleted permanently');
      fetchProducts(1, true);
    } catch {
      toast.error('Failed to delete listing');
    }
  };

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.seller_username || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const filterTabs = [
    { key: 'all', label: 'All Listings' },
    { key: 'active', label: 'Active Only' },
    { key: 'suspended', label: 'Suspended Only' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Product Catalog Moderation</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Review listed items, enforce safety standards, and moderate suspicious or policy-violating products.
          </p>
        </div>
      </header>

      {/* Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {filterTabs.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by title, seller..."
            className="input pl-8 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {/* Product List */}
      {loading ? (
        <CardListSkeleton count={5} />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No Products Found"
          description={search ? 'No products matching your search query.' : 'There are currently no products in this view.'}
        />
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((p) => (
            <div key={p.id} className="card p-4 flex flex-col sm:flex-row gap-4 hover:border-gray-900/20 dark:hover:border-white/20 transition">
              <div className="w-full sm:w-28 h-28 rounded-btn bg-surface-muted overflow-hidden shrink-0 border border-surface-border/40 flex items-center justify-center">
                {p.images && p.images.length > 0 ? (
                  <img src={p.images[0].image} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Package size={28} className="text-gray-400" />
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">{p.name}</h3>
                    <Badge text={p.is_available ? 'active' : 'suspended'} />
                  </div>
                  <p className="text-sm font-black text-brand-500 mt-0.5">
                    TZS {parseFloat(p.price || '0').toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{p.description}</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-surface-border/40 text-3xs text-gray-400">
                  <span>Seller: {p.seller_username ? `@${p.seller_username}` : `ID: ${p.seller}`} • Category: {p.category_name || p.category}</span>
                  <div className="flex items-center gap-2">
                    {p.is_available ? (
                      <Button variant="outline" size="sm" onClick={() => handleSuspend(p.id)} className="text-orange-500 hover:text-orange-600 py-1 px-2.5 text-3xs">
                        Suspend
                      </Button>
                    ) : (
                      <Button variant="default" size="sm" onClick={() => handleApprove(p.id)} className="py-1 px-2.5 text-3xs">
                        Approve
                      </Button>
                    )}
                    <Button variant="danger" size="sm" onClick={() => handleDelete(p.id)} className="py-1 px-2.5 text-3xs">
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Infinite Scroll Sentinel */}
      {loadingMore && <div className="flex justify-center py-4"><Spinner size="sm" /></div>}
      <div ref={sentinelRef} className="h-4" />
    </div>
  );
};

// ============ Promotion Queue ============
export const PromotionQueue: React.FC = () => {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchPromos = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    api.get(`/api/staff/sponsored-review/?status=${filter}&page=${p}`)
      .then((res) => {
        const data = res.data.results || res.data;
        const incoming = Array.isArray(data) ? data : [];
        if (reset) setPromos(incoming);
        else {
          setPromos((prev) => {
            const ids = new Set(prev.map((i) => i.id));
            return [...prev, ...incoming.filter((i) => !ids.has(i.id))];
          });
        }
        setHasMore(!!res.data.next);
      })
      .catch(() => {
        toast.error('Failed to load promotions');
        setHasMore(false);
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [filter]);

  useEffect(() => {
    fetchPromos(1, true);
  }, [fetchPromos]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || loading) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage((prev) => {
            const nextPage = prev + 1;
            fetchPromos(nextPage);
            return nextPage;
          });
        }
      },
      { rootMargin: '400px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchPromos]);

  const handleApprove = async (id: number) => {
    try {
      await api.post(`/api/staff/sponsored-review/${id}/approve/`, { notes: 'Approved by staff' });
      toast.success('Promotion campaign approved');
      fetchPromos(1, true);
    } catch {
      toast.error('Failed to approve promotion');
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try {
      await api.post(`/api/staff/sponsored-review/${id}/reject/`, { notes: reason || 'Rejected by staff' });
      toast.success('Promotion rejected');
      fetchPromos(1, true);
    } catch {
      toast.error('Failed to reject');
    }
  };

  const filteredPromos = useMemo(() => {
    if (!search.trim()) return promos;
    const q = search.toLowerCase();
    return promos.filter(
      (p) =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.product_name || '').toLowerCase().includes(q) ||
        (p.seller || '').toLowerCase().includes(q) ||
        (p.transaction_reference || '').toLowerCase().includes(q)
    );
  }, [promos, search]);

  const filterTabs = [
    { key: 'pending', label: 'Pending Approvals' },
    { key: 'approved', label: 'Active Promotions' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Promotion Approvals</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Review sponsored product campaigns, verify payment slips, and activate promoted placements.
          </p>
        </div>
      </header>

      {/* Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {filterTabs.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search promo, product, seller..."
            className="input pl-8 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <CardGridSkeleton count={6} cols={3} />
      ) : filteredPromos.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={`No ${filter} promotions`}
          description={search ? 'No promotions match your search criteria.' : `There are currently no ${filter} promotion campaigns.`}
        />
      ) : (
        <div className="space-y-3">
          {filteredPromos.map((p) => (
            <div key={p.id} className="card p-5 space-y-4 hover:border-gray-900/20 dark:hover:border-white/20 transition">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">
                      {p.title || `${p.product_name || 'Product'} Promotion`}
                    </h3>
                    <Badge text={p.status} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Product: <span className="font-medium text-gray-900 dark:text-gray-200">{p.product_name}</span> • Seller: @{p.seller}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">{p.description || 'No campaign notes.'}</p>
                  
                  {p.transaction_reference && (
                    <div className="flex items-center gap-2 text-xs font-mono pt-1">
                      <span className="text-gray-400 font-sans">Tx Reference:</span>
                      <span className="font-semibold text-brand-500">{p.transaction_reference}</span>
                    </div>
                  )}

                  {p.payment_proof && (
                    <div className="pt-2">
                      <p className="text-3xs text-gray-400 uppercase font-bold tracking-wider mb-1">Payment Proof:</p>
                      <div
                        onClick={() => setPreviewImage(p.payment_proof)}
                        className="relative group cursor-pointer overflow-hidden rounded-btn border border-surface-border/40 max-w-[200px] h-24 bg-surface-muted"
                      >
                        <img src={p.payment_proof} alt="Proof" className="w-full h-full object-cover group-hover:scale-105 transition" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <span className="text-white text-xs font-bold flex items-center gap-1"><Eye size={12} /> View Slip</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-3xs text-gray-400 pt-1">Created: {fmtDate(p.created_at)}</p>
                </div>

                {filter === 'pending' && (
                  <div className="flex sm:flex-col gap-2 shrink-0 w-full sm:w-auto">
                    <Button variant="default" size="sm" onClick={() => handleApprove(p.id)} className="flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Approve Campaign
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleReject(p.id)} className="text-red-500 hover:text-red-600 flex items-center gap-1.5">
                      <X size={14} /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Infinite Scroll Sentinel */}
      {loadingMore && <div className="flex justify-center py-4"><Spinner size="sm" /></div>}
      <div ref={sentinelRef} className="h-4" />

      {/* Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-3xl max-h-[90vh] bg-surface-card dark:bg-[#0A0A0A] p-2 rounded-card border border-surface-border" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition">
              <X size={16} />
            </button>
            <img src={previewImage} alt="Receipt Full" className="max-w-full max-h-[80vh] object-contain rounded-btn" />
          </div>
        </div>
      )}
    </div>
  );
};

// ============ Reviews Manager ============
export const ReviewsManager: React.FC = () => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchReviews = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    let url = `/api/reviews/?page=${p}`;
    if (filter === 'pending') url += '&approved=false';
    if (filter === 'approved') url += '&approved=true';

    api.get(url)
      .then((r) => {
        const data = r.data.results || r.data;
        const incoming = Array.isArray(data) ? data : [];
        if (reset) setReviews(incoming);
        else {
          setReviews((prev) => {
            const ids = new Set(prev.map((i) => i.id));
            return [...prev, ...incoming.filter((i) => !ids.has(i.id))];
          });
        }
        setHasMore(!!r.data.next);
      })
      .catch(() => {
        toast.error('Failed to load reviews');
        setHasMore(false);
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [filter]);

  useEffect(() => {
    fetchReviews(1, true);
  }, [fetchReviews]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || loading) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage((prev) => {
            const nextPage = prev + 1;
            fetchReviews(nextPage);
            return nextPage;
          });
        }
      },
      { rootMargin: '400px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchReviews]);

  const updateReview = async (id: number, approved: boolean) => {
    try {
      await api.patch(`/api/reviews/${id}/`, { approved });
      setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, approved } : r)));
      toast.success(approved ? 'Review approved and published' : 'Review hidden from public');
    } catch {
      toast.error('Failed to update review');
    }
  };

  const deleteReview = async (id: number) => {
    if (!confirm('Are you sure you want to permanently delete this review?')) return;
    try {
      await api.delete(`/api/reviews/${id}/`);
      setReviews((prev) => prev.filter((r) => r.id !== id));
      toast.success('Review deleted permanently');
    } catch {
      toast.error('Failed to delete review');
    }
  };

  const filteredReviews = useMemo(() => {
    if (!search.trim()) return reviews;
    const q = search.toLowerCase();
    return reviews.filter(
      (r) =>
        (r.comment || '').toLowerCase().includes(q) ||
        String(r.user || '').toLowerCase().includes(q) ||
        String(r.product || '').toLowerCase().includes(q)
    );
  }, [reviews, search]);

  const filterTabs = [
    { key: 'all', label: 'All Reviews' },
    { key: 'pending', label: 'Pending Approval' },
    { key: 'approved', label: 'Approved' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Review & Feedback Moderation</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Maintain community integrity by reviewing customer product feedback and ratings.
          </p>
        </div>
      </header>

      {/* Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {filterTabs.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search review comments..."
            className="input pl-8 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <CardListSkeleton count={5} />
      ) : filteredReviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No Reviews Found"
          description={search ? 'No reviews match your search query.' : 'There are currently no reviews in this view.'}
        />
      ) : (
        <div className="space-y-3">
          {filteredReviews.map((review) => (
            <div key={review.id} className="card p-5 flex flex-col sm:flex-row justify-between gap-4 hover:border-gray-900/20 dark:hover:border-white/20 transition">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        fill={i < review.rating ? 'currentColor' : 'none'}
                        className={i < review.rating ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600'}
                      />
                    ))}
                  </div>
                  <span className="font-bold text-xs text-gray-900 dark:text-white">{review.rating}/5 Stars</span>
                  <Badge text={review.approved ? 'approved' : 'pending'} />
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                  "{review.comment}"
                </p>
                <p className="text-3xs text-gray-400">
                  User ID: {review.user} • Product ID: {review.product} • {fmtDate(review.created_at)}
                </p>
              </div>

              <div className="flex sm:flex-col gap-2 shrink-0 justify-center">
                {!review.approved ? (
                  <Button variant="default" size="sm" onClick={() => updateReview(review.id, true)}>
                    Approve
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => updateReview(review.id, false)}>
                    Hide
                  </Button>
                )}
                <Button variant="danger" size="sm" onClick={() => deleteReview(review.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Infinite Scroll Sentinel */}
      {loadingMore && <div className="flex justify-center py-4"><Spinner size="sm" /></div>}
      <div ref={sentinelRef} className="h-4" />
    </div>
  );
};

// ============ Disputes Manager ============
export const DisputesManager: React.FC = () => {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');

  const fetchDisputes = useCallback(() => {
    setLoading(true);
    api.get(`/api/disputes/?status=${filter}`)
      .then((r) => setDisputes(r.data.results || r.data || []))
      .catch(() => toast.error('Failed to load disputes'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const handleResolve = async (id: number, resolution: string) => {
    const notes = prompt('Resolution notes (recorded for audit):') || '';
    try {
      await api.post(`/api/disputes/${id}/resolve/`, { resolution, notes });
      toast.success('Dispute resolved successfully');
      fetchDisputes();
    } catch {
      toast.error('Failed to resolve dispute');
    }
  };

  const filteredDisputes = useMemo(() => {
    if (!search.trim()) return disputes;
    const q = search.toLowerCase();
    return disputes.filter(
      (d) =>
        String(d.order || '').includes(q) ||
        (d.opened_by_username || '').toLowerCase().includes(q) ||
        (d.reason || '').toLowerCase().includes(q)
    );
  }, [disputes, search]);

  const filterTabs = [
    { key: 'open', label: 'Open Disputes' },
    { key: 'under_review', label: 'Under Review' },
    { key: 'resolved_buyer', label: 'Resolved (Buyer)' },
    { key: 'resolved_seller', label: 'Resolved (Seller)' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Disputes Arbitration</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Arbitrate disputes between buyers and sellers, review statements, and disburse refunds or payouts.
          </p>
        </div>
      </header>

      {/* Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {filterTabs.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Order #, customer..."
            className="input pl-8 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <CardListSkeleton count={5} />
      ) : filteredDisputes.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title={`No ${filter.replace(/_/g, ' ')} disputes`}
          description={search ? 'No disputes match your search query.' : 'There are currently no disputes in this category.'}
        />
      ) : (
        <div className="space-y-3">
          {filteredDisputes.map((d) => (
            <div key={d.id} className="card p-5 space-y-4 hover:border-gray-900/20 dark:hover:border-white/20 transition">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">
                      Order #{d.order} — @{d.opened_by_username}
                    </h3>
                    <Badge text={d.status} />
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-medium">"{d.reason}"</p>
                  <p className="text-3xs text-gray-400 font-mono">Opened: {fmtDate(d.created_at)}</p>
                </div>

                {d.status === 'open' && (
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button variant="default" size="sm" onClick={() => handleResolve(d.id, 'resolved_buyer')}>
                      Favour Buyer
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleResolve(d.id, 'resolved_seller')} className="text-emerald-600 dark:text-emerald-400">
                      Favour Seller
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleResolve(d.id, 'closed')}>
                      Close
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============ Support Tickets (Split Pane & Chat) ============
export const SupportTicketsManager: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('open');
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(() => {
    setLoading(true);
    api.get(`/api/staff/support-tickets/?status=${statusFilter}`)
      .then((r) => setTickets(r.data.results || r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await api.patch(`/api/staff/support-tickets/${id}/update_status/`, { status });
      toast.success(`Ticket marked as ${status}`);
      fetchTickets();
      setSelectedTicket((prev: any) => (prev ? { ...prev, status } : null));
    } catch {
      toast.error('Failed to update ticket status');
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    try {
      await api.post(`/api/staff/support-tickets/${selectedTicket.id}/reply/`, {
        reply: replyText,
        is_internal: isInternal,
      });
      toast.success(isInternal ? 'Internal note added' : 'Reply sent');
      setReplyText('');

      const r = await api.get(`/api/staff/support-tickets/?status=${statusFilter}`);
      const newTickets = r.data.results || r.data;
      setTickets(newTickets);
      setSelectedTicket(newTickets.find((t: any) => t.id === selectedTicket.id) || null);
    } catch {
      toast.error('Failed to send reply');
    }
  };

  const filteredTickets = useMemo(() => {
    if (!search.trim()) return tickets;
    const q = search.toLowerCase();
    return tickets.filter(
      (t) =>
        (t.subject || '').toLowerCase().includes(q) ||
        (t.messages && t.messages.some((m: any) => (m.body || '').toLowerCase().includes(q)))
    );
  }, [tickets, search]);

  const filterTabs = [
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'closed', label: 'Closed' },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Support Desk</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Respond to user inquiries, add internal collaboration notes, and resolve tickets.
        </p>
      </header>

      <div className="h-[75vh] flex rounded-card border border-surface-border dark:border-surface-dark-border bg-white dark:bg-[#0A0A0A] overflow-hidden shadow-card">
        {/* Left Pane - Tickets list */}
        <div className="w-full md:w-1/3 border-r border-surface-border dark:border-surface-dark-border flex flex-col">
          <div className="p-3 border-b border-surface-border dark:border-surface-dark-border space-y-2 bg-surface-muted/30 dark:bg-[#161616]/30">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-8 py-1.5 text-xs w-full"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1" data-horizontal-scroll="true">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.key);
                    setSelectedTicket(null);
                  }}
                  className={`text-3xs px-2.5 py-1 rounded-full font-bold transition whitespace-nowrap ${
                    statusFilter === tab.key
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-black'
                      : 'bg-surface-muted dark:bg-[#161616] text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-surface-border dark:divide-surface-dark-border">
            {loading ? (
              <div className="p-3">
                <CardListSkeleton count={4} />
              </div>
            ) : filteredTickets.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-12 italic">No {statusFilter} tickets found.</p>
            ) : (
              filteredTickets.map((t) => {
                const latestMsg = t.messages && t.messages.length > 0 ? t.messages[t.messages.length - 1].body : '';
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={`p-3.5 cursor-pointer transition flex flex-col justify-between hover:bg-surface-muted/50 dark:hover:bg-[#161616]/50 ${
                      selectedTicket?.id === t.id ? 'bg-surface-muted/80 dark:bg-[#161616]/80 border-l-4 border-brand-500' : ''
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{t.subject}</p>
                        <Badge text={t.status} />
                      </div>
                      <div className="flex justify-between items-center mt-1 text-3xs text-gray-400">
                        <span>{t.category}</span>
                        <span className={`font-bold ${priorityColors[t.priority]}`}>{t.priority}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{latestMsg}</p>
                    </div>
                    <p className="text-3xs text-gray-400 mt-2 self-end font-mono">{fmtDate(t.created_at)}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane - Chat Window */}
        <div className="flex-1 flex flex-col bg-surface-muted/20 dark:bg-neutral-950/20">
          {selectedTicket ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-surface-border dark:border-surface-dark-border bg-white dark:bg-[#0A0A0A] flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm">{selectedTicket.subject}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    By: {selectedTicket.name} ({selectedTicket.email})
                  </p>
                </div>
                <div className="flex gap-2">
                  {selectedTicket.status === 'open' && (
                    <Button size="sm" variant="default" onClick={() => handleUpdateStatus(selectedTicket.id, 'in_progress')}>
                      Accept Ticket
                    </Button>
                  )}
                  {['open', 'in_progress'].includes(selectedTicket.status) && (
                    <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(selectedTicket.id, 'resolved')} className="text-emerald-600 dark:text-emerald-400">
                      Mark Resolved
                    </Button>
                  )}
                </div>
              </div>

              {/* Thread */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-surface-muted/30 dark:bg-[#161616]/30">
                {selectedTicket.messages?.map((msg: any) => {
                  const isUser = !msg.is_internal && msg.sender_name === selectedTicket.name;
                  const isInternal = msg.is_internal;

                  return (
                    <div key={msg.id} className={`flex items-start gap-2 max-w-[80%] ${isUser ? '' : 'ml-auto flex-row-reverse'}`}>
                      <div
                        className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-bold text-xs ${
                          isUser ? 'bg-surface-muted text-gray-700 dark:text-gray-300' : isInternal ? 'bg-amber-500/20 text-amber-500' : 'bg-brand-500 text-white'
                        }`}
                      >
                        {isUser ? 'U' : isInternal ? 'N' : 'S'}
                      </div>
                      <div
                        className={`p-3 rounded-card text-xs border ${
                          isUser
                            ? 'bg-white dark:bg-[#0A0A0A] border-surface-border dark:border-surface-dark-border text-gray-800 dark:text-gray-200'
                            : isInternal
                            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200'
                            : 'bg-brand-500 text-white border-brand-500'
                        }`}
                      >
                        <p className={`font-bold mb-1 text-3xs ${isUser ? 'text-gray-400' : isInternal ? 'text-amber-600 dark:text-amber-400' : 'text-white/80'}`}>
                          {msg.sender_name} {isInternal && '(Internal Note)'} • {fmtDate(msg.created_at)}
                        </p>
                        <p className="leading-relaxed">{msg.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Composer */}
              {['open', 'in_progress'].includes(selectedTicket.status) ? (
                <div className="p-3 border-t border-surface-border dark:border-surface-dark-border bg-white dark:bg-[#0A0A0A]">
                  <div className="flex gap-3 mb-2 border-b border-surface-border dark:border-surface-dark-border pb-1">
                    <button
                      type="button"
                      onClick={() => setIsInternal(false)}
                      className={`text-xs font-bold pb-1 border-b-2 transition ${
                        !isInternal ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-400'
                      }`}
                    >
                      Public Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsInternal(true)}
                      className={`text-xs font-bold pb-1 border-b-2 transition ${
                        isInternal ? 'border-amber-500 text-amber-500' : 'border-transparent text-gray-400'
                      }`}
                    >
                      Internal Note
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={isInternal ? 'Type internal staff note...' : 'Type response to user...'}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                      className={`input py-2 text-xs flex-1 ${isInternal ? 'border-amber-400 focus:border-amber-500' : ''}`}
                    />
                    <Button
                      variant={isInternal ? 'outline' : 'default'}
                      size="sm"
                      onClick={handleSendReply}
                      className="px-4"
                    >
                      <Send size={13} /> {isInternal ? 'Save Note' : 'Send'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 border-t border-surface-border bg-surface-muted text-center text-xs text-gray-400 italic">
                  This ticket has been resolved or closed.
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <MessageSquare size={40} className="mb-2 opacity-40" />
              <p className="text-xs font-medium">Select a ticket from the inbox to view the conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ Staff Dashboard Layout ============
const StaffDashboardLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('staffSidebarCollapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('staffSidebarCollapsed', isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  useEffect(() => {
    api.get('/api/staff/dashboard-summary/')
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err.response?.status === 403) {
          const isInspector = localStorage.getItem('is_inspector') === 'true';
          if (isInspector) {
            navigate('/inspector/jobs', { replace: true });
            return;
          }
        }
        toast.error('Failed to load staff dashboard summary');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const isSuper = !!data?.user?.is_superuser;
  const perms = data?.user?.permissions || [];
  const isInspectorOnly = !!data?.user?.is_inspector && !isSuper && perms.length === 0;

  const canVerify = perms.includes('can_verify_requests') || isSuper;
  const canModerate = perms.includes('can_moderate') || isSuper;
  const canApprove = perms.includes('can_approve_content') || isSuper;
  const canReviewPromo = perms.includes('can_review_promotions') || isSuper;
  const canManageInspections = perms.includes('can_manage_inspections') || isSuper;
  const canManageWarehouse = perms.includes('can_manage_warehouse_intake') || isSuper;
  const canManageLogistics = perms.includes('can_manage_logistics') || isSuper;

  if (!loading && isInspectorOnly) {
    return <Navigate to="/inspector/jobs" replace />;
  }

  const navItems = [
    { path: '/staff', label: 'Overview', icon: LayoutDashboard },
    { path: '/staff/tasks', label: 'My Tasks', icon: ClipboardList },
    { path: '/staff/subscriptions', label: 'Subscriptions', icon: CreditCard, show: canVerify },
    { path: '/staff/seller-applications', label: 'Seller Upgrades', icon: Shield, show: canVerify },
    { path: '/staff/warehouse', label: 'Warehouse Intake', icon: Package, show: canManageWarehouse },
    { path: '/staff/logistics', label: 'Logistics Manager', icon: Truck, show: canManageLogistics },
    { path: '/staff/invoices', label: 'Commission Payments', icon: FileText, show: canVerify },
    { path: '/staff/products', label: 'Product Moderation', icon: Layers, show: canModerate },
    { path: '/staff/promotions', label: 'Promotions', icon: Megaphone, show: canReviewPromo || canApprove },
    { path: '/staff/reviews', label: 'Reviews', icon: Star, show: canApprove },
    { path: '/staff/inspections', label: 'Inspections', icon: LayoutDashboard, show: canManageInspections },
    { path: '/staff/tickets', label: 'Support Tickets', icon: AlertTriangle, show: canModerate || canApprove },
    { path: '/staff-admin', label: 'Admin Panel', icon: Shield, show: isSuper },
  ].filter((item) => item.show === undefined || item.show);

  return (
    <div className="max-w-6xl mx-auto p-4 flex flex-col gap-6 print:p-0 print:m-0 print:gap-0">
      <div className="flex flex-col lg:flex-row gap-6 print:gap-0 print:m-0">
        {/* Sidebar */}
        <aside className={`w-full ${isSidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-56'} transition-all duration-300 shrink-0 ${location.pathname !== '/staff' ? 'hidden lg:block' : ''}`}>
          <nav className="bg-white dark:bg-[#0A0A0A] rounded-card shadow-sm border border-surface-border dark:border-surface-dark-border p-2 space-y-1 relative h-full">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex absolute -right-3 top-4 bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border rounded-full p-1 shadow-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors z-10"
              title={isSidebarCollapsed ? 'Expand' : 'Collapse'}
            >
              {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            <div className={`px-3 py-2 mb-1 border-b border-surface-border dark:border-surface-dark-border transition-opacity duration-300 ${isSidebarCollapsed ? 'opacity-0 h-0 overflow-hidden py-0 border-none' : 'opacity-100'}`}>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                Staff Panel
              </h3>
              {data?.user?.username && <p className="text-xs text-brand-500 font-bold mt-0.5 truncate">@{data.user.username}</p>}
            </div>

            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/staff' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-btn text-sm transition ${
                    isActive
                      ? 'text-brand-500 font-medium bg-brand-500/5'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-surface-muted/50 dark:hover:bg-neutral-900/50'
                  }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <item.icon size={18} className="shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 animate-fade-in">
          <Routes>
            <Route index element={<StaffHome data={data} loading={loading} />} />
            <Route path="tasks" element={<StaffTasks />} />
            <Route path="subscriptions" element={canVerify ? <SubscriptionConfirmation /> : <Navigate to="/staff" />} />
            <Route path="seller-applications" element={canVerify ? <SellerApplicationsManager /> : <Navigate to="/staff" />} />
            <Route path="warehouse" element={canManageWarehouse ? <WarehouseStaffLayout /> : <Navigate to="/staff" />} />
            <Route path="logistics" element={canManageLogistics ? <LogisticsManager /> : <Navigate to="/staff" />} />
            <Route path="invoices" element={canVerify ? <CommissionPaymentsManager /> : <Navigate to="/staff" />} />
            <Route path="products" element={canModerate ? <ProductModeration /> : <Navigate to="/staff" />} />
            <Route path="promotions" element={canReviewPromo || canApprove ? <PromotionQueue /> : <Navigate to="/staff" />} />
            <Route path="reviews" element={canApprove ? <ReviewsManager /> : <Navigate to="/staff" />} />
            <Route path="disputes" element={canModerate ? <DisputesManager /> : <Navigate to="/staff" />} />
            <Route path="tickets" element={canModerate || canApprove ? <SupportTicketsManager /> : <Navigate to="/staff" />} />
            <Route path="inspections/*" element={<StaffInspectionLayout user={data?.user} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default StaffDashboardLayout;
