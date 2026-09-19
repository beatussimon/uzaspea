import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Shield, ScrollText,
  Users, CheckCircle2, Clock, AlertTriangle,
  UserPlus, Building2, Briefcase,
  CreditCard, Layers,
  ChevronLeft, ChevronRight, Search, Check, X,
  ArrowUpRight, BarChart2, DollarSign, KeyRound, ShieldAlert,
  Headphones, MapPin, ExternalLink
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import api from '../../api';
import toast from 'react-hot-toast';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { KpiCard } from '../../components/ui/KpiCard';
import {
  PageHeaderSkeleton,
  KpiGridSkeleton,
  TableSkeleton,
  CardGridSkeleton,
  CardListSkeleton
} from '../../components/Skeleton';
import SystemPaymentMethodsManager from './SystemPaymentMethodsManager';
import CatalogModerationManager from './CatalogModerationManager';
import PasswordChangeRequestsManager from './PasswordChangeRequestsManager';
import ReservedUsernamesManager from './ReservedUsernamesManager';
import PlatformContactSettingsManager from './PlatformContactSettingsManager';
import { useAuth } from '../../context/AuthContext';
import { DashboardMobileDrawer } from '../../components/layout/DashboardMobileDrawer';

// ============ Types ============
interface Staffer {
  id: number;
  profile_id: number;
  username: string;
  email: string;
  department: string;
  is_active: boolean;
  tier: string;
  is_verified: boolean;
  tasks_count: number;
}

interface AuditLogEntry {
  id: number;
  username: string;
  action: string;
  description: string;
  target_username: string | null;
  timestamp: string;
  ip_address: string;
  user_agent: string;
  extra_data: any;
}

interface AdminDashboardData {
  counts: {
    total_staff: number;
    active_staff: number;
    deactivated_staff: number;
    dept_count: number;
  };
  task_stats: {
    completed_month: number;
    pending_total: number;
    overdue_total: number;
  };
  departments: Array<{ department: string; count: number }>;
  recent_logs: AuditLogEntry[];
  staffers: Staffer[];
}

const statusConfig: Record<string, { dot: string; color: string; bg: string }> = {
  pending: { dot: 'bg-amber-500', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  in_progress: { dot: 'bg-blue-500', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  on_hold: { dot: 'bg-orange-500', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  completed: { dot: 'bg-emerald-500', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  approved: { dot: 'bg-emerald-500', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  active: { dot: 'bg-emerald-500', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  rejected: { dot: 'bg-red-500', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  cancelled: { dot: 'bg-red-500', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  deactivated: { dot: 'bg-red-500', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  banned: { dot: 'bg-red-500', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  super: { dot: 'bg-purple-500', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  staff: { dot: 'bg-blue-500', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  inspector: { dot: 'bg-emerald-500', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const Badge: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const norm = text.toLowerCase().replace(/_/g, ' ');
  const key = norm.split(' ')[0];
  const cfg = statusConfig[key] || {
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

// ============ Admin Overview ============
const AdminOverview: React.FC = () => {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const revenueData = [
    { month: 'Jan', revenue: 3200000 },
    { month: 'Feb', revenue: 4100000 },
    { month: 'Mar', revenue: 3900000 },
    { month: 'Apr', revenue: 5400000 },
    { month: 'May', revenue: 6200000 },
    { month: 'Jun', revenue: 8100000 },
  ];

  const fetchData = () => {
    setLoading(true);
    api.get('/api/staff/admin-dashboard/')
      .then((res) => setData(res.data))
      .catch(() => toast.error('Failed to load admin stats'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeaderSkeleton />
        <KpiGridSkeleton count={6} cols={6} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TableSkeleton rows={4} cols={4} />
          <TableSkeleton rows={4} cols={4} />
        </div>
      </div>
    );
  }

  const kpis = [
    { label: 'Active Staff', value: data.counts.active_staff, icon: Users },
    { label: 'Departments', value: data.counts.dept_count, icon: Building2 },
    { label: 'Pending Tasks', value: data.task_stats.pending_total, icon: Clock },
    { label: 'Overdue Tasks', value: data.task_stats.overdue_total, icon: AlertTriangle },
    { label: 'Done (Month)', value: data.task_stats.completed_month, icon: CheckCircle2 },
    { label: 'Audit Logs', value: data.recent_logs.length, icon: ScrollText },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Command Center</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            System-wide platform controls, security telemetry, staff authorizations, and operational capacity.
          </p>
        </div>
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20 capitalize">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Superuser Authority
          </span>
        </div>
      </header>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
          />
        ))}
      </div>

      {/* Charts Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Growth Chart */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <DollarSign size={14} className="text-brand-500" /> Platform Revenue Trend (TZS)
            </h3>
            <span className="text-3xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">+34.8% H1</span>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:opacity-10" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#888' }}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  formatter={(value: any) => [`TZS ${Number(value).toLocaleString()}`, 'Revenue']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #333', backgroundColor: '#111', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Staff Workload Bar Chart */}
        <div className="card p-5 space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <BarChart2 size={14} className="text-blue-500" /> Active Staff Load (Assigned Tasks)
          </h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.staffers.slice(0, 8).map(s => ({ username: s.username, tasks: s.tasks_count }))}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:opacity-10" />
                <XAxis dataKey="username" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #333', backgroundColor: '#111', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="tasks" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Activity Logs & Capacity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Log */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
              <ScrollText size={16} className="text-brand-500" /> Global Security & Admin Logs
            </h3>
            <Link to="/staff-admin/audit" className="text-xs font-bold text-brand-500 hover:underline flex items-center gap-1">
              View All <ChevronRight size={12} />
            </Link>
          </div>
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {data.recent_logs.slice(0, 6).map((log) => (
              <div key={log.id} className="p-3 hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 rounded-btn border border-surface-border/40 space-y-1 transition">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-gray-900 dark:text-white">@{log.username || 'system'}</span>
                  <span className="text-3xs text-gray-400 font-mono">{formatDate(log.timestamp)}</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300">{log.description}</p>
                <div className="pt-1">
                  <Badge text={log.action} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Teams & Capacity */}
        <div className="card p-5 space-y-4">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 size={16} className="text-purple-500" /> Department Capacity & Distribution
          </h3>
          <div className="space-y-4 pt-2">
            {data.departments.map((dept) => {
              const pct = Math.round((dept.count / (data.counts.total_staff || 1)) * 100);
              return (
                <div key={dept.department} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-800 dark:text-gray-200">{dept.department || 'General Staff'}</span>
                    <span className="text-brand-500">{dept.count} members ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-surface-muted dark:bg-[#161616] rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ Platform User Explorer ============
const PlatformUserExplorer: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Modals
  const [showInspectorModal, setShowInspectorModal] = useState(false);
  const [inspectorUser, setInspectorUser] = useState<any>(null);
  const [inspectorLevel, setInspectorLevel] = useState('junior');

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleUser, setRoleUser] = useState<any>(null);
  const [isStaffRole, setIsStaffRole] = useState(false);
  const [isSuperRole, setIsSuperRole] = useState(false);

  const fetchUsers = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    let url = `/api/staff/users/?page=${p}`;
    if (roleFilter === 'staff') url += '&is_staff=true';
    if (roleFilter === 'superuser') url += '&is_superuser=true';
    if (roleFilter === 'inspector') url += '&is_inspector=true';
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

    api.get(url)
      .then(res => {
        const data = res.data.results || res.data;
        const incoming = Array.isArray(data) ? data : [];
        if (reset) setUsers(incoming);
        else {
          setUsers((prev) => {
            const ids = new Set(prev.map((u) => u.id));
            return [...prev, ...incoming.filter((u) => !ids.has(u.id))];
          });
        }
        setHasMore(!!res.data.next);
      })
      .catch(() => {
        toast.error('Failed to load users');
        setHasMore(false);
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [roleFilter, search]);

  useEffect(() => {
    fetchUsers(1, true);
  }, [fetchUsers]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || loading) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage((prev) => {
            const nextPage = prev + 1;
            fetchUsers(nextPage);
            return nextPage;
          });
        }
      },
      { rootMargin: '400px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchUsers]);

  const handleToggleActive = async (id: number) => {
    try {
      const res = await api.post(`/api/staff/users/${id}/toggle_active/`);
      toast.success(res.data.is_active ? 'User unbanned' : 'User banned');
      fetchUsers(1, true);
    } catch {
      toast.error('Failed to toggle active status');
    }
  };

  const submitInspectorPromotion = async () => {
    if (!inspectorUser) return;
    try {
      await api.post(`/api/staff/users/${inspectorUser.id}/promote_inspector/`, { level: inspectorLevel });
      toast.success(`User promoted to ${inspectorLevel} inspector`);
      setShowInspectorModal(false);
      fetchUsers(1, true);
    } catch {
      toast.error('Failed to promote user to inspector');
    }
  };

  const submitRoleChange = async () => {
    if (!roleUser) return;
    try {
      await api.post(`/api/staff/users/${roleUser.id}/change_role/`, { is_staff: isStaffRole, is_superuser: isSuperRole });
      toast.success('User roles updated');
      setShowRoleModal(false);
      fetchUsers(1, true);
    } catch {
      toast.error('Failed to update roles');
    }
  };

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const filterTabs = [
    { key: 'all', label: 'All Users' },
    { key: 'staff', label: 'Staff Members' },
    { key: 'superuser', label: 'Superusers' },
    { key: 'inspector', label: 'Inspectors' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Users & Access</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Explore merchant & buyer accounts, toggle security bans, and manage administrative privileges.
          </p>
        </div>
      </header>

      {/* Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {filterTabs.map((tab) => {
            const isActive = roleFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setRoleFilter(tab.key)}
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
            placeholder="Search username or email..."
            className="input pl-8 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {/* Users Table / Grid */}
      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Users Found"
          description={search ? 'No users match your search query.' : 'There are currently no users in this view.'}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-muted/50 dark:bg-[#161616]/50 border-b border-surface-border dark:border-surface-dark-border text-xs font-medium text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-5 py-3">Account</th>
                  <th className="px-5 py-3">Tier</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Roles</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border text-xs">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-muted/30 dark:hover:bg-[#161616]/30 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-gray-900 dark:text-white">@{u.username}</div>
                      <div className="text-3xs text-gray-500 font-mono">{u.email}</div>
                    </td>
                    <td className="px-5 py-3.5 font-bold uppercase text-brand-500 text-3xs">
                      {u.tier || 'Standard'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge text={u.is_active ? 'active' : 'banned'} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {u.is_superuser && <Badge text="super" />}
                        {u.is_staff && <Badge text="staff" />}
                        {u.is_inspector && <Badge text={`inspector (${u.inspector_level})`} />}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleActive(u.id)}
                          className={u.is_active ? 'text-red-500 hover:text-red-600 py-1 px-2 text-3xs' : 'text-emerald-500 py-1 px-2 text-3xs'}
                        >
                          {u.is_active ? 'Ban' : 'Unban'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRoleUser(u);
                            setIsStaffRole(u.is_staff);
                            setIsSuperRole(u.is_superuser);
                            setShowRoleModal(true);
                          }}
                          className="py-1 px-2 text-3xs"
                        >
                          Roles
                        </Button>
                        {!u.is_inspector && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setInspectorUser(u);
                              setShowInspectorModal(true);
                            }}
                            className="py-1 px-2 text-3xs text-brand-500"
                          >
                            Inspector
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sentinel */}
      {loadingMore && <div className="flex justify-center py-4"><Spinner size="sm" /></div>}
      <div ref={sentinelRef} className="h-4" />

      {/* Inspector Modal */}
      {showInspectorModal && inspectorUser && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowInspectorModal(false)}>
          <div className="card max-w-sm w-full p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Promote to Inspector</h3>
            <p className="text-xs text-gray-500">Assign inspector credentials to @{inspectorUser.username}</p>
            <select className="input" value={inspectorLevel} onChange={(e) => setInspectorLevel(e.target.value)}>
              <option value="junior">Junior Inspector</option>
              <option value="intermediate">Intermediate Inspector</option>
              <option value="senior">Senior Inspector</option>
              <option value="lead">Lead Inspector</option>
            </select>
            <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
              <Button variant="outline" size="sm" onClick={() => setShowInspectorModal(false)}>Cancel</Button>
              <Button variant="default" size="sm" onClick={submitInspectorPromotion}>Promote</Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Role Modal */}
      {showRoleModal && roleUser && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowRoleModal(false)}>
          <div className="card max-w-sm w-full p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Modify Roles</h3>
            <p className="text-xs text-gray-500">Update system authorizations for @{roleUser.username}</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={isStaffRole} onChange={(e) => setIsStaffRole(e.target.checked)} className="rounded" />
                Staff Member (`is_staff`)
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={isSuperRole} onChange={(e) => setIsSuperRole(e.target.checked)} className="rounded" />
                Superuser (`is_superuser`)
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
              <Button variant="outline" size="sm" onClick={() => setShowRoleModal(false)}>Cancel</Button>
              <Button variant="default" size="sm" onClick={submitRoleChange}>Save Privileges</Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ============ Employee Manager ============
const EmployeeManager: React.FC = () => {
  const [staffers, setStaffers] = useState<Staffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDepartment, setNewDepartment] = useState('Support');

  const fetchStaffers = useCallback(() => {
    setLoading(true);
    api.get('/api/staff/admin-dashboard/')
      .then((res) => setStaffers(res.data.staffers || []))
      .catch(() => toast.error('Failed to load employees'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchStaffers(); }, [fetchStaffers]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/staff/profiles/', {
        username: newUsername,
        department: newDepartment,
        is_active: true
      });
      toast.success('New employee onboarded');
      setShowAddModal(false);
      setNewUsername('');
      fetchStaffers();
    } catch {
      toast.error('Failed to onboard employee');
    }
  };

  const handleToggleStaffActive = async (profileId: number) => {
    try {
      await api.post(`/api/staff/profiles/${profileId}/toggle_active/`);
      toast.success('Employee status updated');
      fetchStaffers();
    } catch {
      toast.error('Failed to update employee status');
    }
  };

  const filteredStaffers = useMemo(() => {
    return staffers.filter((s) => {
      if (deptFilter !== 'all' && s.department !== deptFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!s.username.toLowerCase().includes(q) && !(s.email || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [staffers, deptFilter, search]);

  const departments = ['all', 'Support', 'Inspection', 'Logistics', 'Catalog', 'Finance', 'Operations'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff Employee Directory</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Organize staff departments, onboard team members, and oversee assigned workloads.
          </p>
        </div>
        <Button variant="default" size="sm" onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5">
          <UserPlus size={16} /> Onboard Staff
        </Button>
      </header>

      {/* Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {departments.map((dept) => {
            const isActive = deptFilter === dept;
            return (
              <button
                key={dept}
                type="button"
                onClick={() => setDeptFilter(dept)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                }`}
              >
                {dept === 'all' ? 'All Departments' : dept}
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
            placeholder="Search employee..."
            className="input pl-8 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <CardGridSkeleton count={6} cols={3} />
      ) : filteredStaffers.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No Employees Found"
          description={search ? 'No staff members match your query.' : 'There are currently no staff members in this department.'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaffers.map((s) => (
            <div key={s.id} className="card p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">@{s.username}</h3>
                    <p className="text-xs text-gray-400 font-mono">{s.email || 'No email attached'}</p>
                  </div>
                  <Badge text={s.is_active ? 'active' : 'deactivated'} />
                </div>

                {/* Clean Unboxed Metadata */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400 dark:text-gray-500 font-normal">Department</span>
                    <span className="font-medium text-gray-900 dark:text-gray-200">{s.department || 'General'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 dark:text-gray-500 font-normal">Assigned Tasks</span>
                    <span className="font-medium text-brand-500">{s.tasks_count || 0} active</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-surface-border/40 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleStaffActive(s.profile_id)}
                  className={s.is_active ? 'text-red-500 hover:text-red-600' : 'text-emerald-500'}
                >
                  {s.is_active ? 'Deactivate Access' : 'Reactivate'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Onboard Modal */}
      {showAddModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="card max-w-md w-full p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Onboard Staff Member</h3>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Username</label>
                <input required type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="input" placeholder="e.g. jdoe" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Department</label>
                <select className="input" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)}>
                  {departments.filter(d => d !== 'all').map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" variant="default" size="sm">Create Profile</Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ============ Permission Matrix ============
const PermissionMatrix: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const capabilities = [
    { key: 'can_verify_requests', label: 'Verify Requests' },
    { key: 'can_moderate', label: 'Moderation' },
    { key: 'can_approve_content', label: 'Content Approval' },
    { key: 'can_review_promotions', label: 'Promotions' },
    { key: 'can_manage_inspections', label: 'Inspections' },
    { key: 'can_manage_warehouse_intake', label: 'Warehouse Hub' },
    { key: 'can_manage_logistics', label: 'Logistics Fleet' },
    { key: 'can_conduct_site_visits', label: 'Site Visits (Field)' },
  ];

  const fetchStaff = () => {
    setLoading(true);
    api.get('/api/staff/users/?is_staff=true')
      .then(res => setUsers(res.data.results || res.data || []))
      .catch(() => toast.error('Failed to load permissions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStaff(); }, []);

  const togglePermission = async (userId: number, perm: string, currentVal: boolean) => {
    try {
      await api.post(`/api/staff/users/${userId}/toggle_permission/`, {
        permission: perm,
        enable: !currentVal
      });
      toast.success('Permission updated');
      fetchStaff();
    } catch {
      toast.error('Failed to update permission');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff Permission Matrix</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Granular capability matrix assigning operational roles and feature rights to staff members.
          </p>
        </div>
      </header>

      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-muted/50 dark:bg-[#161616]/50 border-b border-surface-border text-xs font-medium text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-5 py-3">Staff Member</th>
                  {capabilities.map(c => (
                    <th key={c.key} className="px-3 py-3 text-center">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-xs">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-surface-muted/30 transition">
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-gray-900 dark:text-white">@{u.username}</span>
                      {u.is_superuser && <span className="ml-2 text-3xs text-brand-500 font-bold uppercase">(Super)</span>}
                    </td>
                    {capabilities.map(c => {
                      const hasPerm = u.is_superuser || (u.permissions && u.permissions.includes(c.key));
                      return (
                        <td key={c.key} className="px-3 py-3.5 text-center">
                          <button
                            disabled={u.is_superuser}
                            onClick={() => togglePermission(u.id, c.key, hasPerm)}
                            className={`w-6 h-6 rounded-full inline-flex items-center justify-center transition ${
                              hasPerm
                                ? 'bg-emerald-500 text-white'
                                : 'bg-surface-muted text-gray-400 hover:bg-gray-200'
                            }`}
                          >
                            {hasPerm ? <Check size={14} /> : <X size={12} />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ Audit Log Viewer ============
const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const fetchLogs = useCallback((p: number, reset = false) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    let url = `/api/staff/audit-logs/?page=${p}`;
    if (actionFilter !== 'all') url += `&action=${actionFilter}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

    api.get(url)
      .then(res => {
        const data = res.data.results || res.data;
        const incoming = Array.isArray(data) ? data : [];
        if (reset) setLogs(incoming);
        else {
          setLogs((prev) => {
            const ids = new Set(prev.map((l) => l.id));
            return [...prev, ...incoming.filter((l) => !ids.has(l.id))];
          });
        }
        setHasMore(!!res.data.next);
      })
      .catch(() => {
        toast.error('Failed to load audit logs');
        setHasMore(false);
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [actionFilter, search]);

  useEffect(() => {
    fetchLogs(1, true);
  }, [fetchLogs]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || loading) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage((prev) => {
            const nextPage = prev + 1;
            fetchLogs(nextPage);
            return nextPage;
          });
        }
      },
      { rootMargin: '400px' }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchLogs]);

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l) =>
        (l.username || '').toLowerCase().includes(q) ||
        (l.description || '').toLowerCase().includes(q) ||
        (l.action || '').toLowerCase().includes(q)
    );
  }, [logs, search]);

  const filterTabs = [
    { key: 'all', label: 'All Actions' },
    { key: 'login', label: 'Authentication' },
    { key: 'moderation', label: 'Moderation' },
    { key: 'payment', label: 'Financial' },
    { key: 'permission_change', label: 'Permissions' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Security & Audit Trails</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Immutable log of administrative actions, user changes, and financial updates.
          </p>
        </div>
      </header>

      {/* Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {filterTabs.map((tab) => {
            const isActive = actionFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActionFilter(tab.key)}
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
            placeholder="Search logs..."
            className="input pl-8 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {/* Logs Stream */}
      {loading ? (
        <CardListSkeleton count={6} />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No Logs Recorded"
          description="There are currently no audit logs matching your criteria."
        />
      ) : (
        <div className="space-y-2.5">
          {filteredLogs.map((log) => (
            <div key={log.id} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-gray-900/20 dark:hover:border-white/20 transition">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-gray-900 dark:text-white">@{log.username || 'System'}</span>
                  <Badge text={log.action} />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300">{log.description}</p>
                {log.ip_address && (
                  <p className="text-3xs text-gray-400 font-mono">IP: {log.ip_address}</p>
                )}
              </div>
              <div className="text-3xs text-gray-400 font-mono shrink-0">
                {formatDate(log.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sentinel */}
      {loadingMore && <div className="flex justify-center py-4"><Spinner size="sm" /></div>}
      <div ref={sentinelRef} className="h-4" />
    </div>
  );
};

// ============ Store Site Verification Requests Review ============
const AdminSiteVisitsReview: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending_review');
  const [search, setSearch] = useState('');
  const [gallery, setGallery] = useState<{
    images: { url: string; label: string }[];
    currentIndex: number;
  } | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const openGallery = (item: any, initialUrl: string) => {
    const images: { url: string; label: string }[] = [];
    if (item.storefront_image) images.push({ url: item.storefront_image, label: 'Storefront' });
    if (item.interior_image) images.push({ url: item.interior_image, label: 'Interior' });
    if (item.document_image) images.push({ url: item.document_image, label: 'License / Document' });
    const idx = images.findIndex((img) => img.url === initialUrl);
    setGallery({ images, currentIndex: idx >= 0 ? idx : 0 });
  };

  useEffect(() => {
    if (!gallery) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGallery(null);
      if (e.key === 'ArrowLeft') {
        setGallery((prev) => {
          if (!prev || prev.images.length <= 1) return prev;
          const nextIndex = (prev.currentIndex - 1 + prev.images.length) % prev.images.length;
          return { ...prev, currentIndex: nextIndex };
        });
      }
      if (e.key === 'ArrowRight') {
        setGallery((prev) => {
          if (!prev || prev.images.length <= 1) return prev;
          const nextIndex = (prev.currentIndex + 1) % prev.images.length;
          return { ...prev, currentIndex: nextIndex };
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gallery]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !gallery || gallery.images.length <= 1) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX.current - touchEndX;
    if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        setGallery((prev) => {
          if (!prev) return null;
          return { ...prev, currentIndex: (prev.currentIndex + 1) % prev.images.length };
        });
      } else {
        setGallery((prev) => {
          if (!prev) return null;
          return { ...prev, currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length };
        });
      }
    }
    touchStartX.current = null;
  };

  const fetchVisits = useCallback(() => {
    setLoading(true);
    const query = filter === 'all' ? '' : `status=${filter}`;
    api.get(`/api/staff/site-visits/?${query}`)
      .then((res) => {
        const data = res.data.results || res.data || [];
        setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => toast.error('Failed to load store site verification requests'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  const handleApprove = async (id: number) => {
    try {
      setActionLoading(true);
      await api.post(`/api/staff/site-visits/${id}/approve/`);
      toast.success('Site verification approved! Merchant is now verified to upgrade.');
      fetchVisits();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve site verification');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingId) return;
    if (!rejectReason.trim()) {
      toast.error('Please enter a rejection reason for the applicant');
      return;
    }
    try {
      setActionLoading(true);
      await api.post(`/api/staff/site-visits/${rejectingId}/reject/`, { reason: rejectReason });
      toast.success('Site verification request rejected.');
      setRejectingId(null);
      setRejectReason('');
      fetchVisits();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reject site verification');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) =>
      (item.business_name || '').toLowerCase().includes(q) ||
      (item.username || '').toLowerCase().includes(q) ||
      (item.contact_phone || '').toLowerCase().includes(q) ||
      (item.address || '').toLowerCase().includes(q) ||
      (item.visited_by_username || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const filterTabs = [
    { key: 'pending_review', label: 'Pending Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All Requests' },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>Store Site Verification Requests</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Review physical store inspections conducted by field staff, inspect evidence & GPS, and approve merchant verification.
          </p>
        </div>
      </header>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {filterTabs.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
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
            placeholder="Search store, applicant, inspector..."
            className="input pl-8 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {/* Content Rendering */}
      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={`No ${filter === 'all' ? '' : filter.replace('_', ' ')} site verification requests`}
          description={search ? 'No requests match your search criteria.' : 'There are currently no verification requests in this queue.'}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-muted/50 dark:bg-[#161616]/50 border-b border-surface-border text-xs font-semibold text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Store & Applicant</th>
                  <th className="px-4 py-3">Physical Location & GPS</th>
                  <th className="px-4 py-3">Inspector & Date</th>
                  <th className="px-4 py-3 text-center">Evidence Photos</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-xs">
                {filteredItems.map((item) => {
                  const locParts = [item.district, item.region].filter(Boolean);
                  const locStr = locParts.join(', ');
                  const showLocSubtext = locStr && !item.address?.toLowerCase().includes(locStr.toLowerCase());

                  return (
                    <tr key={item.id} className="hover:bg-surface-muted/30 dark:hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-bold text-gray-900 dark:text-white text-sm">
                          {item.business_name}
                        </div>
                        <div className="text-gray-500 text-[11px] mt-0.5">
                          Applicant: <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">@{item.username}</span>
                        </div>
                        {item.contact_phone && (
                          <div className="text-gray-400 text-[11px] font-mono mt-0.5">
                            Phone: {item.contact_phone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <div className="text-gray-800 dark:text-gray-200 font-medium text-xs">
                          {item.address}
                        </div>
                        {showLocSubtext && (
                          <div className="text-gray-400 text-[11px]">
                            {locStr}
                          </div>
                        )}
                        {item.latitude && item.longitude && (
                          <div className="mt-0.5">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-gray-500 hover:text-brand-500 transition-colors"
                              title="Open coordinates in Google Maps"
                            >
                              <MapPin size={10} className="shrink-0 text-brand-500" />
                              <span>{Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}</span>
                              <ExternalLink size={9} className="shrink-0 opacity-60" />
                            </a>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <div className="text-gray-700 dark:text-gray-300 font-semibold text-xs">
                          @{item.visited_by_username || 'Staff'}
                        </div>
                        <div className="text-gray-400 text-[11px] mt-0.5">
                          {new Date(item.created_at).toLocaleDateString()}
                        </div>
                        {item.staff_notes && (
                          <div className="mt-1 text-gray-500 max-w-[220px] truncate text-[11px]" title={item.staff_notes}>
                            Note: {item.staff_notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-top text-center">
                        <div className="inline-flex items-center justify-center gap-2">
                          {item.storefront_image && (
                            <button
                              type="button"
                              onClick={() => openGallery(item, item.storefront_image)}
                              className="relative w-8 h-8 rounded overflow-hidden shrink-0 cursor-pointer hover:opacity-80 transition"
                              title="Storefront photo"
                            >
                              <img src={item.storefront_image} alt="Storefront" className="w-full h-full object-cover" />
                            </button>
                          )}
                          {item.interior_image && (
                            <button
                              type="button"
                              onClick={() => openGallery(item, item.interior_image)}
                              className="relative w-8 h-8 rounded overflow-hidden shrink-0 cursor-pointer hover:opacity-80 transition"
                              title="Interior photo"
                            >
                              <img src={item.interior_image} alt="Interior" className="w-full h-full object-cover" />
                            </button>
                          )}
                          {item.document_image && (
                            <button
                              type="button"
                              onClick={() => openGallery(item, item.document_image)}
                              className="relative w-8 h-8 rounded overflow-hidden shrink-0 cursor-pointer hover:opacity-80 transition"
                              title="License photo"
                            >
                              <img src={item.document_image} alt="License" className="w-full h-full object-cover" />
                            </button>
                          )}
                          {!item.storefront_image && !item.interior_image && !item.document_image && (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400'
                              : item.status === 'rejected'
                              ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400'
                              : 'bg-amber-500/10 text-amber-500 dark:text-amber-400'
                          }`}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                        {item.rejection_reason && (
                          <p className="text-[10px] text-rose-500 mt-1 max-w-[120px] truncate" title={item.rejection_reason}>
                            {item.rejection_reason}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                        {item.status === 'pending_review' ? (
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleApprove(item.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition disabled:opacity-50 cursor-pointer active:scale-95"
                            >
                              <Check size={13} />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => { setRejectingId(item.id); setRejectReason(''); }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 shadow-xs transition disabled:opacity-50 cursor-pointer active:scale-95"
                            >
                              <X size={13} />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">
                            {item.reviewed_by_username ? `By @${item.reviewed_by_username}` : 'Processed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Evidence Gallery Lightbox Modal */}
      {gallery && gallery.images.length > 0 && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 select-none"
          onClick={() => setGallery(null)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top Bar: Title, Counter & Close */}
          <div
            className="absolute top-0 inset-x-0 flex items-center justify-between px-6 py-4 z-20 text-white/90"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold tracking-wide">
                {gallery.images[gallery.currentIndex]?.label}
              </span>
              {gallery.images.length > 1 && (
                <span className="text-xs text-white/60 font-mono">
                  ({gallery.currentIndex + 1} / {gallery.images.length})
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setGallery(null)}
              className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Close (Esc)"
            >
              <X size={22} />
            </button>
          </div>

          {/* Left Navigation Arrow */}
          {gallery.images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setGallery((prev) => {
                  if (!prev) return null;
                  return { ...prev, currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length };
                });
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition z-20 cursor-pointer"
              title="Previous photo (Left Arrow / Swipe Right)"
            >
              <ChevronLeft size={28} />
            </button>
          )}

          {/* Center Image Container - Zero box boundary, pure edge-to-edge content */}
          <div
            className="relative flex items-center justify-center w-full h-full p-4 sm:p-12"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              key={gallery.images[gallery.currentIndex]?.url}
              src={gallery.images[gallery.currentIndex]?.url}
              alt={gallery.images[gallery.currentIndex]?.label}
              className="max-w-full max-h-[82vh] object-contain select-none shadow-2xl"
              draggable={false}
            />
          </div>

          {/* Right Navigation Arrow */}
          {gallery.images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setGallery((prev) => {
                  if (!prev) return null;
                  return { ...prev, currentIndex: (prev.currentIndex + 1) % prev.images.length };
                });
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition z-20 cursor-pointer"
              title="Next photo (Right Arrow / Swipe Left)"
            >
              <ChevronRight size={28} />
            </button>
          )}

          {/* Bottom Dots Indicator */}
          {gallery.images.length > 1 && (
            <div
              className="absolute bottom-5 inset-x-0 flex items-center justify-center gap-2 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              {gallery.images.map((img, i) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => setGallery((prev) => prev ? { ...prev, currentIndex: i } : null)}
                  className={`transition-all duration-200 rounded-full cursor-pointer ${
                    i === gallery.currentIndex
                      ? 'w-6 h-1.5 bg-white'
                      : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'
                  }`}
                  title={img.label}
                />
              ))}
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Reject Reason Modal */}
      {rejectingId && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setRejectingId(null)}
        >
          <div
            className="relative max-w-md w-full bg-white dark:bg-[#0A0A0A] p-6 rounded-2xl border border-surface-border shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Reject Store Site Verification
            </h3>
            <p className="text-xs text-gray-500">
              Provide a clear reason for the rejection. This explanation will be delivered directly to the applicant so they can rectify discrepancies.
            </p>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <textarea
                required
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Storefront signage does not match registered business name, or shop was closed during inspection."
                className="input w-full text-xs py-2"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectingId(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={actionLoading}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Confirm Rejection
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ============ Main Staff Admin Layout ============
const StaffAdminLayout: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('adminSidebarCollapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('adminSidebarCollapsed', isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  const navItems = [
    { path: '/staff-admin', label: 'Admin Overview', icon: LayoutDashboard, exact: true },
    { path: '/staff-admin/users', label: 'User Explorer', icon: Users },
    { path: '/staff-admin/employees', label: 'Employees', icon: Briefcase },
    { path: '/staff-admin/permissions', label: 'Permissions', icon: Shield },
    { path: '/staff-admin/password-requests', label: 'Password Requests', icon: KeyRound },
    { path: '/staff-admin/audit', label: 'Audit Logs', icon: ScrollText },
    { path: '/staff-admin/payment-methods', label: 'Payment Channels', icon: CreditCard },
    { path: '/staff-admin/catalog-moderation', label: 'Brand & Catalog', icon: Layers },
    { path: '/staff-admin/reserved-usernames', label: 'Reserved Usernames', icon: ShieldAlert },
    { path: '/staff-admin/contact-settings', label: 'Contact & Socials', icon: Headphones },
    { path: '/staff-admin/site-visits', label: 'Site Verifications', icon: MapPin },
    { path: '/staff', label: 'Staff Operations', icon: ArrowUpRight },
  ];

  return (
    <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 pb-24 lg:pb-8 flex flex-col gap-6 print:p-0 print:m-0 print:gap-0">
      {/* Mobile Slide-Over Navigation Drawer & Floating FAB Button */}
      <DashboardMobileDrawer
        title="Admin Control"
        subtitle={user?.username ? `@${user.username}` : undefined}
        badgeText="Superuser"
        navItems={navItems}
        menuButtonAriaLabel="Staff Admin Menu"
        footerContent={
          <div className="space-y-1">
            <Link
              to="/staff"
              className="flex items-center gap-3 px-3 py-2 rounded-btn text-xs font-semibold text-brand-500 hover:bg-brand-500/5 transition"
            >
              <ArrowUpRight size={16} className="shrink-0" />
              <span>Staff Operations Hub</span>
            </Link>
            <Link
              to="/dashboard/settings"
              className="flex items-center gap-3 px-3 py-2 rounded-btn text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition"
            >
              <Shield size={16} className="shrink-0" />
              <span>Account & Security</span>
            </Link>
          </div>
        }
      />

      <div className="flex flex-col lg:flex-row gap-6 print:gap-0 print:m-0">
        {/* Desktop Sticky Sidebar - Hidden on mobile in favor of floating hamburger menu */}
        <aside className={`w-full ${isSidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-56'} transition-all duration-300 shrink-0 hidden lg:block`}>
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
                Admin Control
              </h3>
              <p className="text-xs text-brand-500 font-bold mt-0.5">Superuser</p>
            </div>

            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/staff-admin' && item.path !== '/staff' && location.pathname.startsWith(item.path));
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
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<PlatformUserExplorer />} />
            <Route path="employees" element={<EmployeeManager />} />
            <Route path="permissions" element={<PermissionMatrix />} />
            <Route path="password-requests" element={<PasswordChangeRequestsManager />} />
            <Route path="audit" element={<AuditLogViewer />} />
            <Route path="payment-methods" element={<SystemPaymentMethodsManager />} />
            <Route path="catalog-moderation" element={<CatalogModerationManager />} />
            <Route path="reserved-usernames" element={<ReservedUsernamesManager />} />
            <Route path="contact-settings" element={<PlatformContactSettingsManager />} />
            <Route path="site-visits" element={<AdminSiteVisitsReview />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default StaffAdminLayout;
