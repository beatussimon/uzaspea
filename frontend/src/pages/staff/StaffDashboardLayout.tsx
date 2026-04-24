import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Megaphone, Activity,
  CheckCircle2, XCircle, Clock, AlertTriangle, ChevronRight
} from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';

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
  tasks: StaffTask[]; task_counts: Record<string, number>;
  pending_promotions: PendingPromo[]; recent_actions: RecentAction[];
}

// ============ Helpers ============
const priorityColors: Record<string, string> = {
  low: 'text-gray-500', medium: 'text-blue-500', high: 'text-orange-500', urgent: 'text-red-500',
};
const statusBg: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
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
const StaffHome: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/staff/dashboard-summary/')
      .then((res) => setData(res.data))
      .catch(() => toast.error('Failed to load staff dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>;
  if (!data) return <p className="text-center text-gray-400 py-12">No data available</p>;

  const tc = data.task_counts;
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Staff Panel</h2>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending Tasks', val: tc.pending, icon: Clock, color: 'yellow' },
          { label: 'In Progress', val: tc.in_progress, icon: ClipboardList, color: 'blue' },
          { label: 'Completed', val: tc.completed, icon: CheckCircle2, color: 'green' },
          { label: 'Promo Queue', val: data.pending_promotions.length, icon: Megaphone, color: 'purple' },
        ].map((c) => (
          <div key={c.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{c.label}</span>
              <c.icon size={18} className={`text-${c.color}-500`} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{c.val}</p>
          </div>
        ))}
      </div>

      {/* Pending Promotions Preview */}
      {data.pending_promotions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Megaphone size={16} className="text-purple-500" /> Promotion Approvals
            </h3>
            <Link to="/staff/promotions" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {data.pending_promotions.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{p.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">by {p.seller} • {p.product_name}</p>
                </div>
                <Badge text="pending" className={statusBg.pending} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Tasks */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList size={16} className="text-blue-500" /> My Tasks
          </h3>
          <Link to="/staff/tasks" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">View all →</Link>
        </div>
        {data.tasks.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No tasks assigned</p>
        ) : (
          <div className="space-y-2">
            {data.tasks.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {t.is_overdue && <AlertTriangle size={14} className="text-red-500" />}
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{t.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t.category} • <span className={priorityColors[t.priority]}>{t.priority}</span></p>
                  </div>
                </div>
                <Badge text={t.status} className={statusBg[t.status] || ''} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {data.recent_actions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Activity size={16} className="text-green-500" /> My Recent Activity
          </h3>
          <div className="space-y-2">
            {data.recent_actions.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-2 text-sm border-b border-gray-50 dark:border-gray-700 last:border-0">
                <span className="text-xs text-gray-400 w-28 shrink-0">{fmtDate(a.performed_at)}</span>
                <span className="text-gray-700 dark:text-gray-300">{a.action_type.replace(/_/g, ' ')} on <span className="font-medium">{a.task_title}</span></span>
                <Badge text={a.status} className={statusBg[a.status] || ''} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============ Staff Tasks (Kanban) ============
const StaffTasks: React.FC = () => {
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/staff/tasks/')
      .then((res) => setTasks(res.data.results || res.data))
      .catch(() => toast.error('Failed to load tasks'))
      .finally(() => setLoading(false));
  }, []);

  const cols = [
    { key: 'pending', label: 'Pending', icon: Clock, color: 'border-yellow-400' },
    { key: 'in_progress', label: 'In Progress', icon: ClipboardList, color: 'border-blue-400' },
    { key: 'completed', label: 'Completed', icon: CheckCircle2, color: 'border-green-400' },
    { key: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'border-gray-400' },
  ];

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">My Tasks</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cols.map((col) => {
          const ct = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className={`bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border-t-4 ${col.color}`}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <col.icon size={15} className="text-gray-500" />
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">{col.label}</h3>
                <span className="ml-auto text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-400">{ct.length}</span>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {ct.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">No tasks</p>
                ) : ct.map((task) => (
                  <div key={task.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight line-clamp-2">{task.title}</h4>
                      {task.is_overdue && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs font-medium ${priorityColors[task.priority]}`}>{task.priority}</span>
                      {task.category && <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{task.category}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============ Promotion Queue ============
const PromotionQueue: React.FC = () => {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  const fetch = () => {
    setLoading(true);
    api.get(`/api/staff/sponsored-review/?status=${filter}`)
      .then((res) => setPromos(res.data.results || res.data))
      .catch(() => toast.error('Failed to load promotions'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetch(); }, [filter]);

  const handleApprove = async (id: number) => {
    try {
      await api.post(`/api/staff/sponsored-review/${id}/approve/`, { notes: 'Approved by staff' });
      toast.success('Promotion approved');
      fetch();
    } catch { toast.error('Failed to approve'); }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try {
      await api.post(`/api/staff/sponsored-review/${id}/reject/`, { notes: reason || 'Rejected by staff' });
      toast.success('Promotion rejected');
      fetch();
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
        </div>
      )}
    </div>
  );
};

// ============ Staff Dashboard Layout ============
const StaffDashboardLayout: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { path: '/staff', label: 'Overview', icon: LayoutDashboard },
    { path: '/staff/tasks', label: 'My Tasks', icon: ClipboardList },
    { path: '/staff/promotions', label: 'Promotions', icon: Megaphone },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 flex flex-col lg:flex-row gap-6">
      <aside className="w-full lg:w-56 shrink-0">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-2 space-y-1">
          <div className="px-3 py-2 mb-1">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Staff Panel</h3>
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
          <Route index element={<StaffHome />} />
          <Route path="tasks" element={<StaffTasks />} />
          <Route path="promotions" element={<PromotionQueue />} />
        </Routes>
      </main>
    </div>
  );
};

export default StaffDashboardLayout;
