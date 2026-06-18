import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Megaphone, Activity,
  CheckCircle2, XCircle, Clock, AlertTriangle, Shield, Star,
  CreditCard, FileText, Layers, MessageSquare, Send, Eye, Trash2, Search
} from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import StaffInspectionLayout from './inspections/StaffInspectionLayout';

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
}

// ============ Helpers ============
const priorityColors: Record<string, string> = {
  low: 'text-gray-500', medium: 'text-brand-500', high: 'text-orange-500', urgent: 'text-red-500',
};
const statusBg: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  in_progress: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400',
  on_hold: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
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

const StaffHome: React.FC<StaffHomeProps> = ({ data, loading }) => {
  const [claiming, setClaiming] = useState<number | null>(null);

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>;
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

  const tc = data.task_counts;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Staff Dashboard</h2>
        <div className="text-xs text-brand-600 font-bold bg-brand-50 dark:bg-brand-900/20 px-3 py-1 rounded-full uppercase tracking-widest">
           {data.user.username}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Unassigned', val: tc.unassigned, icon: AlertTriangle, color: 'orange' },
          { label: 'Pending', val: tc.pending, icon: Clock, color: 'yellow' },
          { label: 'Progress', val: tc.in_progress, icon: ClipboardList, color: 'blue' },
          { label: 'On Hold', val: tc.on_hold, icon: Clock, color: 'gray' },
          { label: 'Completed', val: tc.completed, icon: CheckCircle2, color: 'green' },
        ].map((c) => (
          <div key={c.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <div className={`text-xs font-bold text-${c.color}-500 flex items-center gap-1 mb-1`}>
               <c.icon size={12} /> {c.label}
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{c.val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Task Pools */}
        <div className="space-y-6">
           {/* Unassigned Pool */}
           <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
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
                         className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition"
                       >
                         {claiming === t.id ? '...' : 'Claim'}
                       </button>
                    </div>
                  ))}
                </div>
              )}
           </div>

           {/* My Current Tasks */}
           <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ClipboardList size={16} className="text-brand-500" /> Assigned to Me
              </h3>
              <Link to="/staff/tasks" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">View all →</Link>
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
                        <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-brand-600">{t.title}</p>
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
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Megaphone size={16} className="text-purple-500" /> Promotion Approvals
                  </h3>
                  <Link to="/staff/promotions" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">View all →</Link>
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
              <Link to="/staff/inspections" className="block p-5 bg-indigo-600 rounded-xl text-white hover:bg-indigo-700 transition">
                 <h3 className="font-bold flex items-center gap-2 mb-1">
                   <Shield size={18} /> Manage Inspections
                 </h3>
                 <p className="text-xs text-indigo-100 opacity-80">Access Dispatch Queue, QA Reviews, and Inspector controls.</p>
              </Link>
           )}

           {data.user.is_inspector && (
              <Link to="/inspector/jobs" className="block p-5 bg-emerald-600 rounded-xl text-white hover:bg-emerald-700 transition">
                 <h3 className="font-bold flex items-center gap-2 mb-1">
                   <ClipboardList size={18} /> My Inspection Jobs
                 </h3>
                 <p className="text-xs text-emerald-100 opacity-80">View and execute your assigned inspection requests.</p>
              </Link>
           )}

           {/* Activity Log */}
           <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <Activity size={16} className="text-green-500" /> My Activity
            </h3>
            <div className="space-y-3">
              {data.recent_actions.map((a) => (
                <div key={a.id} className="flex items-start gap-3 text-xs">
                  <span className="text-gray-400 shrink-0 w-16">{fmtDate(a.performed_at).split(',')[0]}</span>
                  <div>
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-bold uppercase tracking-tighter text-[10px] text-brand-600 mr-2">{a.action_type}</span>
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
const StaffTasks: React.FC = () => {
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const fetch = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    api.get(`/api/staff/tasks/?page=${p}`)
      .then((res) => {
        const data = res.data.results || res.data;
        const incoming = Array.isArray(data) ? data : [];
        if (reset) {
          setTasks(incoming);
        } else {
          setTasks((prev) => {
            const ids = new Set(prev.map((t) => t.id));
            return [...prev, ...incoming.filter((t) => !ids.has(t.id))];
          });
        }
        setHasMore(!!res.data.next);
      })
      .catch(() => {
        toast.error('Failed to load tasks');
        setHasMore(false);
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, []);

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

  const handleAction = async (id: number, action: string) => {
    let payload = {};
    if (['hold', 'cancel'].includes(action)) {
       const msg = prompt(`Enter reason for ${action}:`);
       if (msg === null) return;
       payload = { reason: msg };
    }
    try {
      await api.post(`/api/staff/tasks/${id}/${action}/`, payload);
      toast.success(`Task ${action} successfully`);
      fetch(1, true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Failed to ${action}`);
    }
  };

  const cols = [
    { key: 'pending', label: 'Pending', icon: Clock, color: 'border-yellow-400' },
    { key: 'in_progress', label: 'In Progress', icon: ClipboardList, color: 'border-brand-400' },
    { key: 'on_hold', label: 'On Hold', icon: AlertTriangle, color: 'border-orange-400' },
    { key: 'completed', label: 'Completed', icon: CheckCircle2, color: 'border-green-400' },
  ];

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Active Assignments</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 overflow-x-auto pb-4">
        {cols.map((col) => {
          const ct = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className={`bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border-t-4 ${col.color} min-w-[280px]`}>
              <div className="flex items-center gap-2 mb-4 px-1">
                <col.icon size={15} className="text-gray-500" />
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">{col.label}</h3>
                <span className="ml-auto text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-400">{ct.length}</span>
              </div>
              <div className="space-y-3 min-h-[400px]">
                {ct.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8 italic">No tasks here</p>
                ) : ct.map((task) => (
                  <div key={task.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-brand-400 transition group">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-brand-600">{task.title}</h4>
                      {task.is_overdue && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
                    </div>
                    
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`text-[10px] font-bold uppercase ${priorityColors[task.priority]}`}>{task.priority}</span>
                      <span className="text-[10px] text-gray-400">•</span>
                      <span className="text-[10px] text-gray-500">{task.category}</span>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex flex-wrap gap-1 mt-auto pt-2 border-t dark:border-gray-700">
                       {task.status === 'pending' && (
                         <button onClick={() => handleAction(task.id, 'start')} className="px-2 py-1 bg-brand-600 text-white text-[10px] font-bold rounded hover:bg-brand-700 transition">Start</button>
                       )}
                       {task.status === 'in_progress' && (
                         <>
                           <button onClick={() => handleAction(task.id, 'complete')} className="px-2 py-1 bg-green-600 text-white text-[10px] font-bold rounded hover:bg-green-700 transition">Complete</button>
                           <button onClick={() => handleAction(task.id, 'hold')} className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold rounded hover:bg-orange-200 transition">Hold</button>
                         </>
                       )}
                       {task.status === 'on_hold' && (
                         <button onClick={() => handleAction(task.id, 'start')} className="px-2 py-1 bg-brand-600 text-white text-[10px] font-bold rounded hover:bg-brand-700 transition">Resume</button>
                       )}
                       {['pending', 'in_progress', 'on_hold'].includes(task.status) && (
                         <button onClick={() => handleAction(task.id, 'cancel')} className="px-2 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 text-[10px] font-bold rounded transition ml-auto">Cancel</button>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      
      {loadingMore && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      )}

      {!hasMore && tasks.length > 0 && (
        <p className="text-center py-4 text-xs text-gray-400">All tasks loaded</p>
      )}

      <div ref={sentinelRef} className="h-4" />
    </div>
  );
};

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
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition capitalize ${filter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
          <Clock size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No {filter} subscription requests</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-sm transition flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">@{item.username}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Reference: {item.reference}</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400">
                    {item.tier_name}
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">Amount: TZS {parseFloat(item.amount).toLocaleString()}</p>
                <p className="text-xs text-gray-400 mb-3">Submitted: {fmtDate(item.created_at)}</p>

                {item.proof && (
                  <div className="relative group cursor-pointer overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 mb-4 h-32" onClick={() => setPreviewImage(item.proof)}>
                    <img src={item.proof} alt="Payment proof" className="w-full h-full object-cover group-hover:scale-105 transition" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <span className="text-white text-xs font-semibold">Click to View Receipt</span>
                    </div>
                  </div>
                )}
              </div>

              {filter === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => handleVerify(item.id)} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition">Confirm Upgrade</button>
                  <button onClick={() => handleReject(item.id)} className="flex-1 py-2 border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg text-xs font-bold transition">Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal for image preview */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-3xl max-h-[85vh] overflow-auto bg-white dark:bg-gray-900 p-2 rounded-xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition">✕</button>
            <img src={previewImage} alt="Payment Proof Full" className="max-w-full max-h-[80vh] object-contain rounded" />
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
      await api.post(`/api/staff/commission-payments/${id}/verify/`);
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
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition capitalize ${filter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>
              {s.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
          <Clock size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No {filter.toLowerCase()} commission payments</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-sm transition flex flex-col justify-between">
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
                  <div className="relative group cursor-pointer overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 mb-4 h-32" onClick={() => setPreviewImage(item.receipt_screenshot)}>
                    <img src={item.receipt_screenshot} alt="Receipt Screenshot" className="w-full h-full object-cover group-hover:scale-105 transition" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <span className="text-white text-xs font-semibold">Click to View Receipt</span>
                    </div>
                  </div>
                )}
              </div>

              {filter === 'PENDING' && (
                <div className="flex gap-2">
                  <button onClick={() => handleVerify(item.id)} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition">Confirm Payment</button>
                  <button onClick={() => handleReject(item.id)} className="flex-1 py-2 border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg text-xs font-bold transition">Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal for image preview */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-3xl max-h-[85vh] overflow-auto bg-white dark:bg-gray-900 p-2 rounded-xl" onClick={e => e.stopPropagation()}>
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
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="all">All Listings</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
          <AlertTriangle size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No products found matching criteria</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((p) => (
            <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 hover:shadow-sm transition flex gap-4">
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
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${p.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {p.is_available ? 'Active' : 'Suspended'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-brand-600 dark:text-brand-400">TZS {parseFloat(p.price).toLocaleString()}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{p.description}</p>
                </div>
                <div className="flex justify-between items-center mt-2 text-[10px] text-gray-400">
                  <span>Seller ID: {p.seller} · Category ID: {p.category}</span>
                  <div className="flex gap-2">
                    {p.is_available ? (
                      <button onClick={() => handleSuspend(p.id)} className="px-2.5 py-1 bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/20 dark:text-orange-400 rounded font-semibold transition">Suspend</button>
                    ) : (
                      <button onClick={() => handleApprove(p.id)} className="px-2.5 py-1 bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 rounded font-semibold transition">Approve</button>
                    )}
                    <button onClick={() => handleDelete(p.id)} className="px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 rounded font-semibold transition">Delete</button>
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
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${filter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      ) : promos.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
          <Megaphone size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No {filter} promotions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map((p: any) => (
            <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{p.title || `${p.product_name || 'Product'} Promotion`}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Product: <span className="font-medium">{p.product_name}</span>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{p.description || 'No description provided.'}</p>
                  <p className="text-xs text-gray-400 mt-2">{fmtDate(p.created_at)}</p>
                  {p.admin_notes && <p className="text-xs text-red-500 mt-1">Note: {p.admin_notes}</p>}
                </div>
                {filter === 'pending' ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleApprove(p.id)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
                      <CheckCircle2 size={14} /> Approve
                    </button>
                    <button onClick={() => handleReject(p.id)}
                      className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition">
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
            </div>
          )}

          {!hasMore && promos.length > 0 && (
            <p className="text-center py-4 text-xs text-gray-400">All promotions loaded</p>
          )}

          <div ref={sentinelRef} className="h-4" />
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
                    <div key={review.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-sm transition flex gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-gray-900 dark:text-white">{review.rating}/5 Stars</span>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${review.approved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{review.approved ? 'Approved' : 'Pending'}</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">"{review.comment}"</p>
                            <p className="text-xs text-gray-500 mt-2">By User {review.user} on Product {review.product}</p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                            {!review.approved ? (
                                <button onClick={() => updateReview(review.id, true)} className="bg-green-600 text-white text-xs py-1.5 px-3 rounded font-medium hover:bg-green-700">Approve</button>
                            ) : (
                                <button onClick={() => updateReview(review.id, false)} className="bg-yellow-600 text-white text-xs py-1.5 px-3 rounded font-medium hover:bg-yellow-700">Hide</button>
                            )}
                            <button onClick={() => deleteReview(review.id)} className="bg-red-50 text-red-600 text-xs py-1.5 px-3 rounded font-medium hover:bg-red-100 border border-red-200">Delete</button>
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
                    className={`mr-2 text-xs px-3 py-1 rounded-full font-bold ${filter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    {s.replace(/_/g, ' ')}
                </button>
            ))}
            <div className="mt-4 space-y-3">
                {disputes.map(d => (
                    <div key={d.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-sm transition">
                        <p className="font-bold text-gray-900 dark:text-white">Order #{d.order} — {d.opened_by_username}</p>
                        <p className="text-sm text-gray-600 mt-1">{d.reason}</p>
                        {d.status === 'open' && (
                            <div className="flex gap-2 mt-3">
                                <button onClick={() => handleResolve(d.id, 'resolved_buyer')}
                                    className="px-3 py-1.5 border border-brand-300 text-brand-600 hover:bg-brand-50 rounded-lg text-xs font-medium transition">Favour Buyer</button>
                                <button onClick={() => handleResolve(d.id, 'resolved_seller')}
                                    className="px-3 py-1.5 border border-green-300 text-green-600 hover:bg-green-50 rounded-lg text-xs font-medium transition">Favour Seller</button>
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
  const [chatReplies, setChatReplies] = useState<Record<number, Array<{ sender: string; message: string; timestamp: Date }>>>({});
  const [replyText, setReplyText] = useState('');
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

  const handleTakeTicket = async (id: number) => {
    try {
      await api.patch(`/api/staff/support-tickets/${id}/`, { status: 'in_progress' });
      toast.success('Ticket moved to In Progress');
      fetchTickets();
      setSelectedTicket(prev => prev ? { ...prev, status: 'in_progress' } : null);
    } catch {
      toast.error('Failed to take ticket');
    }
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedTicket) return;
    const ticketId = selectedTicket.id;
    const newReply = {
      sender: 'Staff Member',
      message: replyText,
      timestamp: new Date()
    };
    setChatReplies(prev => ({
      ...prev,
      [ticketId]: [...(prev[ticketId] || []), newReply]
    }));
    setReplyText('');
    toast.success('Reply sent (mocked)');
  };

  const handleResolve = async (id: number) => {
    const notes = prompt('Enter resolution notes:');
    if (notes === null) return;
    try {
      await api.post(`/api/staff/support-tickets/${id}/resolve/`, { notes });
      toast.success('Ticket resolved successfully');
      fetchTickets();
      setSelectedTicket(null);
    } catch {
      toast.error('Failed to resolve ticket');
    }
  };

  const filteredTickets = tickets.filter(t => 
    t.subject.toLowerCase().includes(search.toLowerCase()) || 
    t.message.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[75vh] flex rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
      {/* Left Pane - Tickets list */}
      <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3 bg-gray-50/50 dark:bg-gray-900/10">
          <h3 className="font-bold text-gray-900 dark:text-white">Support Inbox</h3>
          <input type="text" placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none" />
          <div className="flex gap-1 overflow-x-auto pb-1">
            {['open', 'in_progress', 'resolved', 'closed'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setSelectedTicket(null); }}
                className={`text-[10px] px-2.5 py-1 rounded-full font-semibold transition capitalize shrink-0 ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
          {filteredTickets.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8 italic">No {statusFilter} tickets</p>
          ) : filteredTickets.map(t => (
            <div key={t.id} onClick={() => handleSelectTicket(t)}
              className={`p-4 cursor-pointer transition flex flex-col justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 ${selectedTicket?.id === t.id ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-l-4 border-indigo-600' : ''}`}>
              <div>
                <div className="flex justify-between items-start gap-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{t.subject}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${t.status === 'open' ? 'bg-red-100 text-red-700' : t.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {t.status}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Category: {t.category}</p>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{t.message}</p>
              </div>
              <p className="text-[9px] text-gray-400 mt-2 self-end">{fmtDate(t.created_at)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right Pane - Chat Window */}
      <div className="flex-1 flex flex-col bg-gray-50/30 dark:bg-gray-900/5">
        {selectedTicket ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-sm">{selectedTicket.subject}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">By: {selectedTicket.name} ({selectedTicket.email})</p>
              </div>
              <div className="flex gap-2">
                {selectedTicket.status === 'open' && (
                  <button onClick={() => handleTakeTicket(selectedTicket.id)} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition">Accept Ticket</button>
                )}
                {['open', 'in_progress'].includes(selectedTicket.status) && (
                  <button onClick={() => handleResolve(selectedTicket.id)} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition">Resolve Ticket</button>
                )}
              </div>
            </div>

            {/* Message Thread */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50 dark:bg-gray-900/20">
              {/* User Original Message */}
              <div className="flex items-start gap-2 max-w-[80%]">
                <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs">U</div>
                <div className="p-3 rounded-2xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300">
                  <p className="font-semibold mb-1 text-[10px] text-gray-400">User Message · {fmtDate(selectedTicket.created_at)}</p>
                  <p>{selectedTicket.message}</p>
                </div>
              </div>

              {/* Replies (if any) */}
              {(chatReplies[selectedTicket.id] || []).map((reply, idx) => (
                <div key={idx} className="flex items-start gap-2 max-w-[80%] ml-auto flex-row-reverse">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">S</div>
                  <div className="p-3 rounded-2xl bg-indigo-600 text-white text-xs">
                    <p className="font-semibold mb-1 text-[10px] text-indigo-200">Staff · {reply.timestamp.toLocaleTimeString()}</p>
                    <p>{reply.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Box */}
            {['open', 'in_progress'].includes(selectedTicket.status) ? (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex gap-2">
                <input type="text" placeholder="Type your response..." value={replyText} onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendReply()}
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <button onClick={handleSendReply} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1">
                  <Send size={12} /> Reply
                </button>
              </div>
            ) : (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center text-xs text-gray-400 italic">
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/staff/dashboard-summary/')
      .then((res) => setData(res.data))
      .catch(() => toast.error('Failed to load staff dashboard summary'))
      .finally(() => setLoading(false));
  }, []);

  const isSuper = !!data?.user?.is_superuser;
  const perms = data?.user?.permissions || [];
  
  const canVerify = perms.includes('can_verify_requests') || isSuper;
  const canModerate = perms.includes('can_moderate') || isSuper;
  const canApprove = perms.includes('can_approve_content') || isSuper;
  const canReviewPromo = perms.includes('can_review_promotions') || isSuper;
  const canManageInspections = perms.includes('can_manage_inspections') || isSuper;

  const navItems = [
    { path: '/staff', label: 'Overview', icon: LayoutDashboard },
    { path: '/staff/tasks', label: 'My Tasks', icon: ClipboardList },
    { path: '/staff/subscriptions', label: 'Subscriptions', icon: CreditCard, show: canVerify },
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
  ].filter(item => item.show === undefined || item.show);

  return (
    <div className="max-w-7xl mx-auto p-4 flex flex-col lg:flex-row gap-6">
      <aside className="w-full lg:w-56 shrink-0">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-2 space-y-1">
          <div className="px-3 py-2 mb-1 border-b dark:border-gray-700">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              {data?.user?.is_inspector && !canManageInspections ? 'Inspector Panel' : 'Staff Panel'}
            </h3>
            {data?.user.username && <p className="text-[10px] text-brand-600 font-bold mt-1">@{data.user.username}</p>}
          </div>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}>
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Routes>
          <Route index element={<StaffHome data={data} loading={loading} />} />
          <Route path="tasks" element={<StaffTasks />} />
          <Route path="subscriptions" element={canVerify ? <SubscriptionConfirmation /> : <Navigate to="/staff" />} />
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
