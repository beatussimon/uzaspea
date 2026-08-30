import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Megaphone, Activity,
  CheckCircle2, XCircle, Clock, AlertTriangle, Shield, Star,
  CreditCard, FileText, Layers, MessageSquare, Send, Package, Truck,
  BarChart2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../api';
import toast from 'react-hot-toast';
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
const statusBg: Record<string, string> = {
  pending: ' text-yellow-500  dark:text-yellow-500',
  in_progress: ' text-brand-500  dark:text-brand-500',
  on_hold: ' text-orange-500  dark:text-orange-500',
  completed: ' text-green-500  dark:text-green-500',
  cancelled: ' text-red-500  dark:text-red-500',
  approved: ' text-green-500  dark:text-green-500',
  rejected: ' text-red-500  dark:text-red-500',
};
const Badge: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => (
  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
    {text.replace(/_/g, ' ')}
  </span>
);
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// ============ Staff Overview ============
interface StaffHomeProps {
  data: DashboardData | null;
  loading: boolean;
}

const AdminOverviewPanel: React.FC<{ data: DashboardData['admin_overview'] }> = ({ data }) => {
  if (!data) return null;
  const metrics = [
    { label: 'Subscriptions', val: data.subscriptions_pending, icon: CreditCard, colorClass: 'text-brand-500', path: '/staff/subscriptions' },
    { label: 'Seller Upgrades', val: data.seller_upgrades_pending, icon: Shield, colorClass: 'text-blue-500', path: '/staff/seller-applications' },
    { label: 'Warehouse Intake', val: data.warehouse_intake_pending, icon: Package, colorClass: 'text-orange-500', path: '/staff/warehouse' },
    { label: 'Logistics', val: data.logistics_in_transit, icon: Truck, colorClass: 'text-green-500', path: '/staff/logistics' },
    { label: 'Commissions', val: data.commissions_pending, icon: FileText, colorClass: 'text-purple-500', path: '/staff/invoices' },
    { label: 'Products Mod.', val: data.products_pending, icon: Layers, colorClass: 'text-yellow-500', path: '/staff/products' },
    { label: 'Reviews', val: data.reviews_pending, icon: Star, colorClass: 'text-pink-500', path: '/staff/reviews' },
    { label: 'Inspections', val: data.inspections_pending, icon: LayoutDashboard, colorClass: 'text-indigo-500', path: '/staff/inspections' },
  ];

  return (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Global Admin Metrics (Pending Actions)</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Link key={m.label} to={m.path} className="bg-white dark:bg-[#0A0A0A] rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm p-4 hover:shadow-md transition group">
            <div className={`text-xs font-bold ${m.colorClass} flex items-center gap-1 mb-2`}>
               <m.icon size={14} /> {m.label}
            </div>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{m.val}</p>
              <div className="opacity-0 group-hover:opacity-100 transition">
                <span className="text-[10px] font-bold text-brand-500  px-2 py-1 rounded uppercase tracking-widest">Manage</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

const StaffHome: React.FC<StaffHomeProps> = ({ data, loading }) => {
  const [claiming, setClaiming] = useState<number | null>(null);

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" /></div>;
  if (!data) return <p className="text-center text-gray-400 py-12">No data available</p>;

  const handleClaim = async (id: number) => {
    setClaiming(id);
    try {
      await api.post(`/api/staff/tasks/${id}/claim/`);
      toast.success('Task claimed!');
      window.location.reload(); // Refresh to update counts
    } catch { toast.error('Failed to claim task'); }
    setClaiming(null);
  };

  const tc = data.admin_task_metrics ? data.admin_task_metrics.global_counts : data.task_counts;
  const isGlobal = !!data.admin_task_metrics;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Staff Dashboard</h2>
        <div className="text-xs text-brand-500 font-bold   px-3 py-1 rounded-full uppercase tracking-widest">
           {data.user.username}
        </div>
      </div>

      {data.user.is_superuser && data.admin_overview && (
        <AdminOverviewPanel data={data.admin_overview} />
      )}

      {/* Task Progress Overview */}
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-8 mb-4">
        {isGlobal ? "System-Wide Task Overview" : "My Task Progress"}
      </h3>
      <div className="bg-white dark:bg-[#0A0A0A] rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm p-6 mb-6">
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-sm text-gray-500 font-medium">Overall Completion</p>
            <h4 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
              {tc.completed} <span className="text-lg text-gray-400 font-normal">/ {tc.pending + tc.in_progress + tc.on_hold + tc.completed} tasks</span>
            </h4>
          </div>
          <div className="text-right">
            <span className="text-brand-500 font-bold text-2xl">
              {tc.pending + tc.in_progress + tc.on_hold + tc.completed > 0 ? Math.round((tc.completed / (tc.pending + tc.in_progress + tc.on_hold + tc.completed)) * 100) : 0}%
            </span>
          </div>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 mb-6 overflow-hidden flex">
          <div className="bg-brand-500 h-3 transition-all duration-1000 ease-out" style={{ width: `${tc.pending + tc.in_progress + tc.on_hold + tc.completed > 0 ? Math.round((tc.completed / (tc.pending + tc.in_progress + tc.on_hold + tc.completed)) * 100) : 0}%` }}></div>
        </div>
        
        <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-200 shadow-sm dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><AlertTriangle size={12}/> Unassigned</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{tc.unassigned}</p>
          </div>
          <div>
            <p className="text-xs text-yellow-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={12}/> Pending</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{tc.pending}</p>
          </div>
          <div>
            <p className="text-xs text-blue-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><ClipboardList size={12}/> In Progress</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{tc.in_progress}</p>
          </div>
          <div>
            <p className="text-xs text-orange-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={12}/> On Hold</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{tc.on_hold}</p>
          </div>
        </div>
      </div>

      {isGlobal && data.admin_task_metrics && (
        <div className="bg-white dark:bg-[#0A0A0A] rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm p-6 mb-6">
          <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <BarChart2 className="text-brand-500" size={20} />
            Worker Performance Analytics
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={data.admin_task_metrics.worker_performance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:opacity-10" />
                <XAxis dataKey="worker" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#1f2937', color: '#fff' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                <Bar dataKey="in_progress" name="In Progress" stackId="a" fill="#3b82f6" />
                <Bar dataKey="pending" name="Pending" stackId="a" fill="#eab308" />
                <Bar dataKey="on_hold" name="On Hold" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Task Pools */}
        <div className="space-y-6">
           {/* Unassigned Pool */}
           <div className="bg-white dark:bg-[#0A0A0A] rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm p-5">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <AlertTriangle size={16} className="text-orange-500" /> Open Task Pool
              </h3>
              {data.unassigned_tasks.length === 0 ? (
                <p className="text-gray-400 text-xs text-center py-4">No open tasks available</p>
              ) : (
                <div className="space-y-2">
                  {data.unassigned_tasks.map(t => (
                    <div key={t.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex items-center justify-between gap-3">
                       <div>
                         <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.title}</p>
                         <p className="text-xs text-gray-500 dark:text-gray-400">{t.category} • <span className={priorityColors[t.priority]}>{t.priority}</span></p>
                       </div>
                       <button 
                         onClick={() => handleClaim(t.id)}
                         disabled={claiming === t.id}
                         className="px-3 py-1 bg-brand-500 hover:bg-brand-500 text-white text-xs font-bold rounded-lg transition"
                       >
                         {claiming === t.id ? '...' : 'Claim'}
                       </button>
                    </div>
                  ))}
                </div>
              )}
           </div>

           {/* My Current Tasks */}
           <div className="bg-white dark:bg-[#0A0A0A] rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ClipboardList size={16} className="text-brand-500" /> Assigned to Me
              </h3>
              <Link to="/staff/tasks" className="text-xs text-brand-500 dark:text-brand-500 hover:underline">View all →</Link>
            </div>
            {data.tasks.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Nothing on your plate right now.</p>
            ) : (
              <div className="space-y-2">
                {data.tasks.slice(0, 5).map((t) => (
                  <Link to="/staff/tasks" key={t.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition group">
                    <div className="flex items-center gap-3">
                      {t.is_overdue && <AlertTriangle size={14} className="text-red-500" />}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-brand-500">{t.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t.category} • <span className={priorityColors[t.priority]}>{t.priority}</span></p>
                      </div>
                    </div>
                    <Badge text={t.status} className={statusBg[t.status] || ''} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Feed & Queues */}
        <div className="space-y-6">
           {/* Promo Queue */}
           { (data.user.permissions.includes('can_review_promotions') || data.user.permissions.includes('can_approve_content')) && (
              <div className="bg-white dark:bg-[#0A0A0A] rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Megaphone size={16} className="text-purple-500" /> Promotion Approvals
                  </h3>
                  <Link to="/staff/promotions" className="text-xs text-brand-500 dark:text-brand-500 hover:underline">View all →</Link>
                </div>
                {data.pending_promotions.length === 0 ? (
                   <p className="text-xs text-gray-400 italic">No promotions awaiting review.</p>
                ) : (
                  <div className="space-y-2">
                    {data.pending_promotions.slice(0, 3).map((p) => (
                      <div key={p.id} className="p-3 border border-gray-50 dark:border-gray-700 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{p.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{p.product_name} • {p.seller}</p>
                        </div>
                        <Badge text="pending" className={statusBg.pending} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
           )}

           {/* Inspection Shortcut */}
           {((data.user.permissions.includes('can_manage_inspections') || data.user.is_superuser)) && (
              <Link to="/staff/inspections" className="block p-5 bg-brand-500 rounded-card text-white hover:bg-brand-500 transition">
                 <h3 className="font-bold flex items-center gap-2 mb-1">
                   <Shield size={18} /> Manage Inspections
                 </h3>
                 <p className="text-xs text-brand-500 opacity-80">Access Dispatch Queue, QA Reviews, and Inspector controls.</p>
              </Link>
           )}

           {data.user.is_inspector && (
              <Link to="/inspector/jobs" className="block p-5 bg-emerald-600 rounded-card text-white hover:bg-emerald-700 transition">
                 <h3 className="font-bold flex items-center gap-2 mb-1">
                   <ClipboardList size={18} /> My Inspection Jobs
                 </h3>
                 <p className="text-xs text-emerald-100 opacity-80">View and execute your assigned inspection requests.</p>
              </Link>
           )}

           {/* Activity Log */}
           <div className="bg-white dark:bg-[#0A0A0A] rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm p-5">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <Activity size={16} className="text-green-500" /> My Activity
            </h3>
            <div className="space-y-3">
              {data.recent_actions.map((a) => (
                <div key={a.id} className="flex items-start gap-3 text-xs">
                  <span className="text-gray-400 shrink-0 w-16">{fmtDate(a.performed_at).split(',')[0]}</span>
                  <div>
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-bold uppercase tracking-tighter text-[10px] text-brand-500 mr-2">{a.action_type}</span>
                      {a.task_title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
           </div>
        </div>
      </div>
    </div>
  );
};

// ============ Staff Tasks (Expanded Kanban) ============


// ============ Subscription Upgrades ============
export const SubscriptionConfirmation: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchItems = useCallback(() => {
    setLoading(true);
    api.get(`/api/staff/payment-confirmations/?status=${filter}`)
      .then(res => {
        setItems(res.data.results || res.data);
      })
      .catch(() => toast.error('Failed to load subscription confirmations'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleVerify = async (id: number) => {
    try {
      await api.post(`/api/staff/payment-confirmations/${id}/verify/`);
      toast.success('Subscription upgrade approved!');
      fetchItems();
    } catch {
      toast.error('Failed to approve subscription');
    }
  };

  const handleReject = async (id: number) => {
    try {
      await api.post(`/api/staff/payment-confirmations/${id}/reject/`);
      toast.success('Subscription upgrade rejected');
      fetchItems();
    } catch {
      toast.error('Failed to reject subscription');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Subscription Upgrades</h2>
        <div className="flex gap-1">
          {['pending', 'approved', 'rejected'].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition capitalize ${filter === s ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-[#0A0A0A] rounded-card border dark:border-gray-700">
          <Clock size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No {filter} subscription requests</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white dark:bg-[#0A0A0A] rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm p-5 hover:shadow-sm transition flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">@{item.username}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Reference: {item.reference}</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold  text-brand-500  dark:text-brand-500">
                    {item.tier_name}
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">Amount: TZS {parseFloat(item.amount).toLocaleString()}</p>
                <p className="text-xs text-gray-400 mb-3">Submitted: {fmtDate(item.created_at)}</p>

                {item.proof && (
                  <div className="relative group cursor-pointer overflow-hidden rounded-lg border border-surface-border dark:border-surface-dark-border mb-4 h-32" onClick={() => setPreviewImage(item.proof)}>
                    <img src={item.proof} alt="Payment proof" className="w-full h-full object-cover group-hover:scale-105 transition" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <span className="text-white text-xs font-semibold">Click to View Receipt</span>
                    </div>
                  </div>
                )}
              </div>

              {filter === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => handleVerify(item.id)} className="flex-1 py-2 bg-green-500 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition">Confirm Upgrade</button>
                  <button onClick={() => handleReject(item.id)} className="flex-1 py-2 border border-red-500 text-red-500   rounded-lg text-xs font-bold transition">Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal for image preview */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-3xl max-h-[85vh] overflow-auto bg-white dark:bg-[#0A0A0A] p-2 rounded-card" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition">✕</button>
            <img src={previewImage} alt="Payment Proof Full" className="max-w-full max-h-[80vh] object-contain rounded" />
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
  const [filter, setFilter] = useState('pending');

  const fetchItems = useCallback(() => {
    setLoading(true);
    api.get(`/api/staff/seller-applications/?status=${filter}`)
      .then(res => {
        setItems(res.data.results || res.data);
      })
      .catch(() => toast.error('Failed to load seller upgrade applications'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleApprove = async (id: number) => {
    try {
      await api.post(`/api/staff/seller-applications/${id}/approve/`);
      toast.success('Seller application approved!');
      fetchItems();
    } catch {
      toast.error('Failed to approve application');
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try {
      await api.post(`/api/staff/seller-applications/${id}/reject/`, { reason });
      toast.success('Seller application rejected');
      fetchItems();
    } catch {
      toast.error('Failed to reject application');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Seller Upgrades</h2>
        <div className="flex gap-1">
          {['pending', 'approved', 'rejected'].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition capitalize ${filter === s ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-[#0A0A0A] rounded-card border dark:border-gray-700">
          <Clock size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No {filter} seller applications</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white dark:bg-[#0A0A0A] border dark:border-gray-700 p-4 rounded-card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{item.business_name}</h3>
                  <p className="text-xs text-gray-500">Submitted by: @{item.username}</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold   text-brand-500 dark:text-brand-500">
                  {item.requested_tier_name}
                </span>
              </div>

              <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                <div><strong>Submitted:</strong> {new Date(item.created_at).toLocaleString()}</div>
                {item.rejection_reason && (
                  <div className="text-red-500"><strong>Reason:</strong> {item.rejection_reason}</div>
                )}
              </div>

              <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1 border-t border-b dark:border-gray-700 py-2 my-2">
                <div><strong>Registration No:</strong> {item.business_registration_number || 'N/A'}</div>
                <div><strong>TIN:</strong> {item.tin_number || 'N/A'}</div>
                <div><strong>Address:</strong> {item.business_address || 'N/A'}</div>
                <div><strong>Region:</strong> {item.business_region || 'N/A'}</div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <a href={item.id_document} target="_blank" rel="noreferrer"
                    className="block text-center py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold transition">
                    View ID Document
                  </a>
                  {item.id_document && item.id_document.match(/\.(jpeg|jpg|gif|png)$/i) && (
                    <img src={item.id_document} alt="ID Document Preview" className="w-full h-32 object-cover rounded-lg border border-surface-border dark:border-surface-dark-border" />
                  )}
                  {item.id_document && item.id_document.match(/\.(pdf)$/i) && (
                    <iframe src={item.id_document} className="w-full h-32 rounded-lg border border-surface-border dark:border-surface-dark-border" title="ID Preview" />
                  )}
                </div>
                
                {item.business_document && (
                  <div className="flex-1 space-y-2">
                    <a href={item.business_document} target="_blank" rel="noreferrer"
                      className="block text-center py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold transition">
                      View Business Doc
                    </a>
                    {item.business_document.match(/\.(jpeg|jpg|gif|png)$/i) && (
                      <img src={item.business_document} alt="Business Document Preview" className="w-full h-32 object-cover rounded-lg border border-surface-border dark:border-surface-dark-border" />
                    )}
                    {item.business_document.match(/\.(pdf)$/i) && (
                      <iframe src={item.business_document} className="w-full h-32 rounded-lg border border-surface-border dark:border-surface-dark-border" title="Business Doc Preview" />
                    )}
                  </div>
                )}
              </div>

              {item.status === 'pending' && (
                <div className="flex gap-2 pt-2 border-t dark:border-gray-700">
                  <button onClick={() => handleApprove(item.id)}
                    className="flex-1 py-2 bg-green-500 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition">
                    Approve
                  </button>
                  <button onClick={() => handleReject(item.id)}
                    className="flex-1 py-2 bg-red-500 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition">
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============ Commission Payments ============
export const CommissionPaymentsManager: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchItems = useCallback(() => {
    setLoading(true);
    api.get(`/api/staff/commission-payments/?status=${filter}`)
      .then(res => {
        setItems(res.data.results || res.data);
      })
      .catch(() => toast.error('Failed to load commission payments'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleVerify = async (id: number) => {
    try {
      await api.post(`/api/staff/commission-payments/${id}/approve/`);
      toast.success('Commission payment approved!');
      fetchItems();
    } catch {
      toast.error('Failed to approve payment');
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try {
      await api.post(`/api/staff/commission-payments/${id}/reject/`, { reason });
      toast.success('Commission payment rejected');
      fetchItems();
    } catch {
      toast.error('Failed to reject payment');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Commission Payments</h2>
        <div className="flex gap-1">
          {['PENDING', 'APPROVED', 'REJECTED'].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition capitalize ${filter === s ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>
              {s.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-[#0A0A0A] rounded-card border dark:border-gray-700">
          <Clock size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No {filter.toLowerCase()} commission payments</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white dark:bg-[#0A0A0A] rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm p-5 hover:shadow-sm transition flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Seller: @{item.seller_username}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Invoice: {item.invoice_year}/{item.invoice_month}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tx ID: {item.transaction_id}</p>
                  </div>
                  <Badge text={item.status.toLowerCase()} className={statusBg[item.status.toLowerCase()] || ''} />
                </div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">Amount: TZS {parseFloat(item.amount).toLocaleString()}</p>
                <p className="text-xs text-gray-400 mb-3">Submitted: {fmtDate(item.submitted_at)}</p>
                {item.rejection_reason && <p className="text-xs text-red-500 mb-2">Rejection Reason: {item.rejection_reason}</p>}

                {item.receipt_screenshot && (
                  <div className="relative group cursor-pointer overflow-hidden rounded-lg border border-surface-border dark:border-surface-dark-border mb-4 h-32" onClick={() => setPreviewImage(item.receipt_screenshot)}>
                    <img src={item.receipt_screenshot} alt="Receipt Screenshot" className="w-full h-full object-cover group-hover:scale-105 transition" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <span className="text-white text-xs font-semibold">Click to View Receipt</span>
                    </div>
                  </div>
                )}
              </div>

              {filter === 'PENDING' && (
                <div className="flex gap-2">
                  <button onClick={() => handleVerify(item.id)} className="flex-1 py-2 bg-green-500 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition">Confirm Payment</button>
                  <button onClick={() => handleReject(item.id)} className="flex-1 py-2 border border-red-500 text-red-500   rounded-lg text-xs font-bold transition">Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal for image preview */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-3xl max-h-[85vh] overflow-auto bg-white dark:bg-[#0A0A0A] p-2 rounded-card" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition">✕</button>
            <img src={previewImage} alt="Receipt Screenshot Full" className="max-w-full max-h-[80vh] object-contain rounded" />
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
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, suspended

  const fetchProducts = useCallback(() => {
    setLoading(true);
    api.get('/api/staff/products/')
      .then(res => {
        setProducts(res.data.results || res.data);
      })
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSuspend = async (id: number) => {
    try {
      await api.post(`/api/staff/products/${id}/suspend/`);
      toast.success('Listing suspended');
      fetchProducts();
    } catch {
      toast.error('Failed to suspend listing');
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await api.post(`/api/staff/products/${id}/approve/`);
      toast.success('Listing approved & activated');
      fetchProducts();
    } catch {
      toast.error('Failed to approve listing');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to permanently delete this product?')) return;
    try {
      await api.delete(`/api/staff/products/${id}/`);
      toast.success('Listing deleted permanently');
      fetchProducts();
    } catch {
      toast.error('Failed to delete listing');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.description.toLowerCase().includes(search.toLowerCase());
    if (filter === 'active') return matchesSearch && p.is_available;
    if (filter === 'suspended') return matchesSearch && !p.is_available;
    return matchesSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Product Moderation</h2>
        <div className="flex gap-2">
          <input type="text" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-900 dark:focus:border-white" />
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-900 dark:focus:border-white">
            <option value="all">All Listings</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-[#0A0A0A] rounded-card border dark:border-gray-700">
          <AlertTriangle size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No products found matching criteria</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((p) => (
            <div key={p.id} className="bg-white dark:bg-[#0A0A0A] rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm p-4 hover:shadow-sm transition flex gap-4">
              <div className="w-24 h-24 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden shrink-0 border dark:border-gray-600">
                {p.images && p.images.length > 0 ? (
                  <img src={p.images[0].image} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No Image</div>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{p.name}</h3>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${p.is_available ? ' text-green-500' : ' text-red-500'}`}>
                      {p.is_available ? 'Active' : 'Suspended'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-brand-500 dark:text-brand-500">TZS {parseFloat(p.price).toLocaleString()}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{p.description}</p>
                </div>
                <div className="flex justify-between items-center mt-2 text-[10px] text-gray-400">
                  <span>Seller ID: {p.seller} · Category ID: {p.category}</span>
                  <div className="flex gap-2">
                    {p.is_available ? (
                      <button onClick={() => handleSuspend(p.id)} className="px-2.5 py-1  text-orange-500   dark:text-orange-500 rounded font-semibold transition">Suspend</button>
                    ) : (
                      <button onClick={() => handleApprove(p.id)} className="px-2.5 py-1  text-green-500   dark:text-green-500 rounded font-semibold transition">Approve</button>
                    )}
                    <button onClick={() => handleDelete(p.id)} className="px-2.5 py-1  text-red-500   dark:text-red-500 rounded font-semibold transition">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const [filter, setFilter] = useState('pending');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetch = useCallback((p: number, reset = false) => {
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
        if (reset) {
          setPromos(incoming);
        } else {
          setPromos((prev) => {
            const ids = new Set(prev.map((p) => p.id));
            return [...prev, ...incoming.filter((p) => !ids.has(p.id))];
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
    fetch(1, true);
  }, [fetch]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || loading) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage((prev) => {
            const nextPage = prev + 1;
            fetch(nextPage);
            return nextPage;
          });
        }
      },
      { rootMargin: '400px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetch]);

  const handleApprove = async (id: number) => {
    try {
      await api.post(`/api/staff/sponsored-review/${id}/approve/`, { notes: 'Approved by staff' });
      toast.success('Promotion approved');
      fetch(1, true);
    } catch { toast.error('Failed to approve'); }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try {
      await api.post(`/api/staff/sponsored-review/${id}/reject/`, { notes: reason || 'Rejected by staff' });
      toast.success('Promotion rejected');
      fetch(1, true);
    } catch { toast.error('Failed to reject'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Promotion Queue</h2>
        <div className="flex gap-1">
          {['pending', 'approved', 'rejected'].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${filter === s ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>
      ) : promos.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-[#0A0A0A] rounded-card border dark:border-gray-700">
          <Megaphone size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No {filter} promotions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map((p: any) => (
            <div key={p.id} className="bg-white dark:bg-[#0A0A0A] rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm p-5 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{p.title || `${p.product_name || 'Product'} Promotion`}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Product: <span className="font-medium">{p.product_name}</span>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{p.description || 'No description provided.'}</p>
                  
                  {p.transaction_reference && (
                    <p className="text-xs text-brand-500 dark:text-brand-500 mt-2 font-mono font-bold">
                      Tx Reference: {p.transaction_reference}
                    </p>
                  )}
                  {p.payment_proof && (
                    <div className="mt-2.5">
                      <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider mb-1">Payment Proof:</p>
                      <div className="relative group cursor-pointer overflow-hidden rounded-lg border border-surface-border dark:border-surface-dark-border max-w-[200px] h-24 bg-gray-50" onClick={() => setPreviewImage(p.payment_proof)}>
                        <img src={p.payment_proof} alt="Promotion payment proof" className="w-full h-full object-cover group-hover:scale-105 transition" />
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-400 mt-2">{fmtDate(p.created_at)}</p>
                  {p.admin_notes && <p className="text-xs text-red-500 mt-1">Note: {p.admin_notes}</p>}
                </div>
                {filter === 'pending' ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleApprove(p.id)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition">
                      <CheckCircle2 size={14} /> Approve
                    </button>
                    <button onClick={() => handleReject(p.id)}
                      className="flex items-center gap-1.5 px-4 py-2 border border-red-500 text-red-500   rounded-lg text-sm font-medium transition">
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                ) : (
                  <Badge text={p.status} className={statusBg[p.status] || ''} />
                )}
              </div>
            </div>
          ))}
          
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
            </div>
          )}

          {!hasMore && promos.length > 0 && (
            <p className="text-center py-4 text-xs text-gray-400">All promotions loaded</p>
          )}

          <div ref={sentinelRef} className="h-4" />
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-3xl max-h-[90vh]">
            <button onClick={() => setPreviewImage(null)} className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition">✕</button>
            <img src={previewImage} alt="Payment Proof Full" className="max-w-full max-h-[80vh] object-contain rounded" />
          </div>
        </div>
      )}
    </div>
  );
};

// ============ Reviews Manager ============
export const ReviewsManager: React.FC = () => {
    const [reviews, setReviews] = useState<any[]>([]);

    useEffect(() => {
        api.get('/api/reviews/')
            .then(r => setReviews(r.data.results || r.data))
            .catch(() => {});
    }, []);

    const updateReview = async (id: number, approved: boolean) => {
        try {
            await api.patch(`/api/reviews/${id}/`, { approved });
            setReviews(prev => prev.map(r => r.id === id ? {...r, approved} : r));
            toast.success('Review updated');
        } catch { toast.error('Failed to update review'); }
    };

    const deleteReview = async (id: number) => {
        if (!confirm('Are you sure you want to delete this review?')) return;
        try {
            await api.delete(`/api/reviews/${id}/`);
            setReviews(prev => prev.filter(r => r.id !== id));
            toast.success('Review deleted');
        } catch { toast.error('Failed to delete review'); }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Review Moderation</h3>
            <div className="space-y-3">
                {reviews.map(review => (
                    <div key={review.id} className="bg-white dark:bg-[#0A0A0A] rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm p-5 hover:shadow-sm transition flex gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-gray-900 dark:text-white">{review.rating}/5 Stars</span>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${review.approved ? ' text-green-500' : ' text-red-500'}`}>{review.approved ? 'Approved' : 'Pending'}</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">"{review.comment}"</p>
                            <p className="text-xs text-gray-500 mt-2">By User {review.user} on Product {review.product}</p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                            {!review.approved ? (
                                <button onClick={() => updateReview(review.id, true)} className="bg-green-500 text-white text-xs py-1.5 px-3 rounded font-medium hover:bg-green-500">Approve</button>
                            ) : (
                                <button onClick={() => updateReview(review.id, false)} className="bg-yellow-500 text-white text-xs py-1.5 px-3 rounded font-medium hover:bg-yellow-500">Hide</button>
                            )}
                            <button onClick={() => deleteReview(review.id)} className=" text-red-500 text-xs py-1.5 px-3 rounded font-medium  border border-red-500">Delete</button>
                        </div>
                    </div>
                ))}
                {reviews.length === 0 && <p className="text-gray-500 py-4">No reviews found.</p>}
            </div>
        </div>
    );
};

// ============ Disputes ============
export const DisputesManager: React.FC = () => {
    const [disputes, setDisputes] = useState<any[]>([]);
    const [filter, setFilter] = useState('open');

    useEffect(() => {
        api.get(`/api/disputes/?status=${filter}`)
            .then(r => setDisputes(r.data.results || r.data)).catch(() => {});
    }, [filter]);

    const handleResolve = async (id: number, resolution: string) => {
        const notes = prompt('Resolution notes (optional):') || '';
        await api.post(`/api/disputes/${id}/resolve/`, { resolution, notes });
        setDisputes(prev => prev.filter(d => d.id !== id));
        toast.success('Dispute resolved');
    };

    return (
        <div>
            <h3 className="text-xl font-bold mb-4">Disputes</h3>
            {['open', 'under_review', 'resolved_buyer', 'resolved_seller'].map(s => (
                <button key={s} onClick={() => setFilter(s)}
                    className={`mr-2 text-xs px-3 py-1 rounded-full font-bold ${filter === s ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    {s.replace(/_/g, ' ')}
                </button>
            ))}
            <div className="mt-4 space-y-3">
                {disputes.map(d => (
                    <div key={d.id} className="bg-white dark:bg-[#0A0A0A] rounded-card border border-surface-border dark:border-surface-dark-border shadow-sm p-5 hover:shadow-sm transition">
                        <p className="font-bold text-gray-900 dark:text-white">Order #{d.order} — {d.opened_by_username}</p>
                        <p className="text-sm text-gray-600 mt-1">{d.reason}</p>
                        {d.status === 'open' && (
                            <div className="flex gap-2 mt-3">
                                <button onClick={() => handleResolve(d.id, 'resolved_buyer')}
                                    className="px-3 py-1.5 border border-brand-500 text-brand-500  rounded-lg text-xs font-medium transition">Favour Buyer</button>
                                <button onClick={() => handleResolve(d.id, 'resolved_seller')}
                                    className="px-3 py-1.5 border border-green-500 text-green-500  rounded-lg text-xs font-medium transition">Favour Seller</button>
                                <button onClick={() => handleResolve(d.id, 'closed')}
                                    className="px-3 py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-medium transition">Close</button>
                            </div>
                        )}
                    </div>
                ))}
                {disputes.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No {filter} disputes</p>}
            </div>
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

  const fetchTickets = useCallback(() => {
    api.get(`/api/staff/support-tickets/?status=${statusFilter}`)
      .then(r => setTickets(r.data.results || r.data))
      .catch(() => {});
  }, [statusFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleSelectTicket = (t: any) => {
    setSelectedTicket(t);
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await api.patch(`/api/staff/support-tickets/${id}/update_status/`, { status });
      toast.success(`Ticket marked as ${status}`);
      fetchTickets();
      setSelectedTicket((prev: any) => prev ? { ...prev, status } : null);
    } catch {
      toast.error('Failed to update ticket status');
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    try {
      await api.post(`/api/staff/support-tickets/${selectedTicket.id}/reply/`, {
        reply: replyText,
        is_internal: isInternal
      });
      toast.success(isInternal ? 'Internal note added' : 'Reply sent');
      setReplyText('');
      
      // Reload tickets to get new messages
      const r = await api.get(`/api/staff/support-tickets/?status=${statusFilter}`);
      const newTickets = r.data.results || r.data;
      setTickets(newTickets);
      setSelectedTicket(newTickets.find((t: any) => t.id === selectedTicket.id) || null);
    } catch {
      toast.error('Failed to send reply');
    }
  };

  const filteredTickets = tickets.filter(t => 
    t.subject.toLowerCase().includes(search.toLowerCase()) || 
    (t.messages && t.messages.some((m: any) => m.body.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <div className="h-[75vh] flex rounded-card border border-surface-border dark:border-surface-dark-border bg-white dark:bg-[#0A0A0A] overflow-hidden shadow-sm">
      {/* Left Pane - Tickets list */}
      <div className="w-1/3 border-r border-surface-border dark:border-surface-dark-border flex flex-col">
        <div className="p-4 border-b border-surface-border dark:border-surface-dark-border space-y-3 bg-gray-50/50 dark:bg-gray-900/10">
          <h3 className="font-bold text-gray-900 dark:text-white">Support Inbox</h3>
          <input type="text" placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:outline-none" />
          <div className="flex gap-1 overflow-x-auto pb-1">
            {['open', 'in_progress', 'resolved', 'closed'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setSelectedTicket(null); }}
                className={`text-[10px] px-2.5 py-1 rounded-full font-semibold transition capitalize shrink-0 ${statusFilter === s ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
          {filteredTickets.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8 italic">No {statusFilter.replace('_', ' ')} tickets</p>
          ) : filteredTickets.map(t => {
            const latestMsg = t.messages && t.messages.length > 0 ? t.messages[t.messages.length - 1].body : '';
            return (
              <div key={t.id} onClick={() => handleSelectTicket(t)}
                className={`p-4 cursor-pointer transition flex flex-col justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 ${selectedTicket?.id === t.id ? '  border-l-4 border-brand-500' : ''}`}>
                <div>
                  <div className="flex justify-between items-start gap-1">
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{t.subject}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${t.status === 'open' ? ' text-red-500' : t.status === 'resolved' ? ' text-green-500' : ' text-yellow-500'}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Category: {t.category}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      t.priority === 'urgent' ? 'bg-red-500 text-white' : 
                      t.priority === 'high' ? ' text-orange-500' : 
                      'bg-gray-100 text-gray-600'
                    }`}>{t.priority}</span>
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{latestMsg}</p>
                </div>
                <p className="text-[9px] text-gray-400 mt-2 self-end">{fmtDate(t.created_at)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Pane - Chat Window */}
      <div className="flex-1 flex flex-col bg-gray-50/30 dark:bg-gray-900/5">
        {selectedTicket ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-surface-border dark:border-surface-dark-border bg-white dark:bg-[#0A0A0A] flex justify-between items-center">
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-sm">{selectedTicket.subject}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">By: {selectedTicket.name} ({selectedTicket.email})</p>
              </div>
              <div className="flex gap-2">
                {selectedTicket.status === 'open' && (
                  <button onClick={() => handleUpdateStatus(selectedTicket.id, 'in_progress')} className="px-3 py-1.5 bg-brand-500 hover:bg-brand-500 text-white rounded-lg text-xs font-bold transition">Accept</button>
                )}
                {['open', 'in_progress'].includes(selectedTicket.status) && (
                  <button onClick={() => handleUpdateStatus(selectedTicket.id, 'resolved')} className="px-3 py-1.5 bg-green-500 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition">Resolve</button>
                )}
              </div>
            </div>

            {/* Message Thread */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50 dark:bg-gray-900/20">
              {selectedTicket.messages?.map((msg: any) => {
                const isUser = !msg.is_internal && msg.sender_name === selectedTicket.name;
                const isInternal = msg.is_internal;
                
                return (
                  <div key={msg.id} className={`flex items-start gap-2 max-w-[80%] ${isUser ? '' : 'ml-auto flex-row-reverse'}`}>
                    <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-xs ${
                      isUser ? ' text-brand-500' : isInternal ? ' text-yellow-500' : ' text-green-500'
                    }`}>
                      {isUser ? 'U' : 'S'}
                    </div>
                    <div className={`p-3 rounded-2xl text-xs ${
                      isUser ? 'bg-white dark:bg-[#0A0A0A] border dark:border-gray-700 text-gray-700 dark:text-gray-300' :
                      isInternal ? '  border border-yellow-500 dark:border-yellow-500 text-yellow-500 dark:text-yellow-500' :
                      'bg-brand-500 text-white'
                    }`}>
                      <p className={`font-semibold mb-1 text-[10px] ${isUser ? 'text-gray-400' : isInternal ? 'text-yellow-500' : 'text-brand-500'}`}>
                        {msg.sender_name} {isInternal && '(Internal Note)'} · {fmtDate(msg.created_at)}
                      </p>
                      <p>{msg.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input Box */}
            {['open', 'in_progress'].includes(selectedTicket.status) ? (
              <div className="p-4 border-t border-surface-border dark:border-surface-dark-border bg-white dark:bg-[#0A0A0A]">
                <div className="flex gap-4 mb-2 border-b border-gray-100 dark:border-gray-800">
                  <button onClick={() => setIsInternal(false)} className={`text-xs font-bold pb-2 border-b-2 ${!isInternal ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-400'}`}>Public Reply</button>
                  <button onClick={() => setIsInternal(true)} className={`text-xs font-bold pb-2 border-b-2 ${isInternal ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-gray-400'}`}>Internal Note</button>
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder={isInternal ? "Type an internal note..." : "Type your response to the user..."} value={replyText} onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendReply()}
                    className={`flex-1 px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-2 bg-white dark:bg-[#0A0A0A] ${
                      isInternal ? 'border-yellow-500 focus:ring-yellow-500 focus:border-yellow-500 text-yellow-500 dark:text-yellow-500' : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-900 dark:focus:border-white'
                    }`} />
                  <button onClick={handleSendReply} className={`px-4 py-2 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 ${
                    isInternal ? 'bg-yellow-500 hover:bg-yellow-500' : 'bg-brand-500 hover:bg-brand-500'
                  }`}>
                    <Send size={12} /> {isInternal ? 'Add Note' : 'Reply'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 border-t border-surface-border dark:border-surface-dark-border bg-white dark:bg-[#0A0A0A] text-center text-xs text-gray-400 italic">
                This ticket is resolved/closed. You cannot send replies.
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageSquare size={48} className="mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">Select a ticket from the inbox to view details</p>
          </div>
        )}
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
    { 
      path: '/staff/promotions', 
      label: 'Promotions', 
      icon: Megaphone,
      show: canReviewPromo || canApprove
    },
    { 
      path: '/staff/reviews', 
      label: 'Reviews', 
      icon: Star,
      show: canApprove
    },
    { 
      path: '/staff/inspections', 
      label: 'Inspections', 
      icon: LayoutDashboard,
      show: canManageInspections
    },
    { 
      path: '/staff/tickets', 
      label: 'Support Tickets', 
      icon: AlertTriangle,
      show: canModerate || canApprove
    },
    { 
      path: '/inspector/jobs', 
      label: 'Inspector Jobs', 
      icon: ClipboardList,
      show: data?.user?.is_inspector && !canManageInspections
    },
    {
      path: '/staff-admin',
      label: 'Admin Panel',
      icon: Shield,
      show: isSuper
    },
  ].filter(item => item.show === undefined || item.show);

  return (
    <div className="max-w-7xl mx-auto p-4 flex flex-col lg:flex-row gap-6">
      <aside className={`w-full ${isSidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-56'} transition-all duration-300 shrink-0`}>
        <div className="bg-white dark:bg-[#0A0A0A] rounded-card shadow-sm border border-surface-border dark:border-surface-dark-border shadow-sm p-2 space-y-1 relative">
          
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden lg:flex absolute -right-3 top-4 bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border rounded-full p-1 shadow-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors z-10"
            title={isSidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          <div className={`px-3 py-2 mb-1 border-b dark:border-gray-700 transition-opacity duration-300 ${isSidebarCollapsed ? 'opacity-0 h-0 overflow-hidden py-0 border-none' : 'opacity-100'}`}>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
              {data?.user?.is_inspector && !canManageInspections ? 'Inspector Panel' : 'Staff Panel'}
            </h3>
            {data?.user.username && <p className="text-[10px] text-brand-500 font-bold mt-1 truncate">@{data.user.username}</p>}
          </div>

          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-lg text-sm transition group ${
                    isActive
                      ? '  text-brand-500 dark:text-brand-500 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}>
                  <item.icon size={16} className={isSidebarCollapsed ? 'shrink-0' : ''} />
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Routes>
          <Route index element={<StaffHome data={data} loading={loading} />} />
          <Route path="tasks" element={<StaffTasks />} />
          <Route path="subscriptions" element={canVerify ? <SubscriptionConfirmation /> : <Navigate to="/staff" />} />
          <Route path="seller-applications" element={canVerify ? <SellerApplicationsManager /> : <Navigate to="/staff" />} />
          <Route path="warehouse" element={canManageWarehouse ? <WarehouseStaffLayout /> : <Navigate to="/staff" />} />
          <Route path="logistics" element={canManageLogistics ? <LogisticsManager /> : <Navigate to="/staff" />} />
          <Route path="invoices" element={canVerify ? <CommissionPaymentsManager /> : <Navigate to="/staff" />} />
          <Route path="products" element={canModerate ? <ProductModeration /> : <Navigate to="/staff" />} />
          <Route path="promotions" element={(canReviewPromo || canApprove) ? <PromotionQueue /> : <Navigate to="/staff" />} />
          <Route path="reviews" element={canApprove ? <ReviewsManager /> : <Navigate to="/staff" />} />
          <Route path="disputes" element={canModerate ? <DisputesManager /> : <Navigate to="/staff" />} />
          <Route path="tickets" element={(canModerate || canApprove) ? <SupportTicketsManager /> : <Navigate to="/staff" />} />
          <Route path="inspections/*" element={<StaffInspectionLayout user={data?.user} />} />
        </Routes>
      </main>
    </div>
  );
};

export default StaffDashboardLayout;
