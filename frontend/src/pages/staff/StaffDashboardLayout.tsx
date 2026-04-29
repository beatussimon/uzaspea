import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Megaphone, Activity,
  CheckCircle2, XCircle, Clock, AlertTriangle, Shield, Star
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
  low: 'text-gray-500', medium: 'text-blue-500', high: 'text-orange-500', urgent: 'text-red-500',
};
const statusBg: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
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
                <ClipboardList size={16} className="text-blue-500" /> Assigned to Me
              </h3>
              <Link to="/staff/tasks" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">View all →</Link>
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
                  <Link to="/staff/promotions" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">View all →</Link>
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
    { key: 'in_progress', label: 'In Progress', icon: ClipboardList, color: 'border-blue-400' },
    { key: 'on_hold', label: 'On Hold', icon: AlertTriangle, color: 'border-orange-400' },
    { key: 'completed', label: 'Completed', icon: CheckCircle2, color: 'border-green-400' },
  ];

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

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
                         <button onClick={() => handleAction(task.id, 'start')} className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700 transition">Start</button>
                       )}
                       {task.status === 'in_progress' && (
                         <>
                           <button onClick={() => handleAction(task.id, 'complete')} className="px-2 py-1 bg-green-600 text-white text-[10px] font-bold rounded hover:bg-green-700 transition">Complete</button>
                           <button onClick={() => handleAction(task.id, 'hold')} className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold rounded hover:bg-orange-200 transition">Hold</button>
                         </>
                       )}
                       {task.status === 'on_hold' && (
                         <button onClick={() => handleAction(task.id, 'start')} className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700 transition">Resume</button>
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {!hasMore && tasks.length > 0 && (
        <p className="text-center py-4 text-xs text-gray-400">All tasks loaded</p>
      )}

      <div ref={sentinelRef} className="h-4" />
    </div>
  );
};

// ============ Promotion Queue ============
const PromotionQueue: React.FC = () => {
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
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
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
                  <h3 className="font-semibold text-gray-900 dark:text-white">{p.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Product: <span className="font-medium">{p.product_name}</span>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{p.description}</p>
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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
const ReviewsManager: React.FC = () => {
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

// ============ Support Tickets ============
const SupportTicketsManager: React.FC = () => {
    const [tickets, setTickets] = useState<any[]>([]);
    const [statusFilter, setStatusFilter] = useState('open');

    useEffect(() => {
        api.get(`/api/staff/support-tickets/?status=${statusFilter}`)
            .then(r => setTickets(r.data.results || r.data))
            .catch(() => {});
    }, [statusFilter]);

    const updateStatus = async (id: number, status: string) => {
        await api.patch(`/api/staff/support-tickets/${id}/`, { status });
        setTickets(prev => prev.map(t => t.id === id ? {...t, status} : t));
        toast.success('Ticket updated');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Support Tickets</h3>
                <div className="flex gap-2 flex-wrap">
                    {['open', 'in_progress', 'resolved', 'closed'].map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition capitalize ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>
                            {s.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>
            <div className="space-y-3">
                {tickets.map(ticket => (
                    <div key={ticket.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-sm transition">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <p className="font-semibold text-gray-900 dark:text-white">{ticket.subject}</p>
                                <p className="text-xs text-gray-500 mt-1">{ticket.category} · {ticket.name} ({ticket.email})</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">{ticket.message}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${ticket.status === 'open' ? 'bg-red-100 text-red-700' : ticket.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {ticket.status.replace('_', ' ')}
                                </span>
                                {ticket.status === 'open' && (
                                    <button onClick={() => updateStatus(ticket.id, 'in_progress')}
                                        className="bg-blue-600 text-white rounded text-xs py-1.5 px-3 font-medium hover:bg-blue-700 transition">Take Ticket</button>
                                )}
                                {ticket.status === 'in_progress' && (
                                    <button onClick={() => updateStatus(ticket.id, 'resolved')}
                                        className="text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded text-xs py-1.5 px-3 font-medium transition">Mark Resolved</button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {tickets.length === 0 && (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
                        <AlertTriangle size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                        <p className="text-gray-500">No {statusFilter.replace('_', ' ')} tickets</p>
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
      .catch(() => toast.error('Failed to load staff permissions'))
      .finally(() => setLoading(false));
  }, []);

  const navItems = [
    { path: '/staff', label: 'Overview', icon: LayoutDashboard },
    { path: '/staff/tasks', label: 'My Tasks', icon: ClipboardList },
    { 
      path: '/staff/promotions', 
      label: 'Promotions', 
      icon: Megaphone,
      show: data?.user?.permissions?.includes('can_review_promotions') || data?.user?.permissions?.includes('can_approve_content')
    },
    { 
      path: '/staff/reviews', 
      label: 'Reviews', 
      icon: Star,
      show: data?.user?.permissions?.includes('can_approve_content') || data?.user?.is_superuser
    },
    { 
      path: '/staff/inspections', 
      label: 'Inspections', 
      icon: LayoutDashboard,
      show: data?.user?.permissions?.includes('can_manage_inspections') || data?.user?.is_superuser
    },
    { 
      path: '/staff/tickets', 
      label: 'Support Tickets', 
      icon: AlertTriangle,
      show: true
    },
    { 
      path: '/inspector/jobs', 
      label: 'Inspector Jobs', 
      icon: ClipboardList,
      show: data?.user?.is_inspector && !data?.user?.permissions?.includes('can_manage_inspections')
    },
  ].filter(item => item.show === undefined || item.show);

  return (
    <div className="max-w-7xl mx-auto p-4 flex flex-col lg:flex-row gap-6">
      <aside className="w-full lg:w-56 shrink-0">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-2 space-y-1">
          <div className="px-3 py-2 mb-1 border-b dark:border-gray-700">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              {data?.user?.is_inspector && !data?.user?.permissions?.includes('can_manage_inspections') ? 'Inspector Panel' : 'Staff Panel'}
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
          <Route path="promotions" element={(data?.user?.permissions?.includes('can_review_promotions') || data?.user?.permissions?.includes('can_approve_content')) ? <PromotionQueue /> : <Navigate to="/staff" />} />
          <Route path="reviews" element={(data?.user?.permissions?.includes('can_approve_content') || data?.user?.is_superuser) ? <ReviewsManager /> : <Navigate to="/staff" />} />
          <Route path="tickets" element={<SupportTicketsManager />} />
          <Route path="inspections/*" element={<StaffInspectionLayout user={data?.user} />} />
        </Routes>
      </main>
    </div>
  );
};

export default StaffDashboardLayout;
