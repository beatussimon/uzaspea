import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Shield, ScrollText,
  Users, CheckCircle2, XCircle, Clock, AlertTriangle,
  UserPlus, UserMinus, Building2, Briefcase, Plus,
  CreditCard, FileText, Layers, Megaphone, Star, MessageSquare
} from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import VerifiedBadge from '../../components/VerifiedBadge';
import StaffInspectionLayout from './inspections/StaffInspectionLayout';
import {
  SubscriptionConfirmation,
  CommissionPaymentsManager,
  ProductModeration,
  PromotionQueue,
  ReviewsManager,
  DisputesManager,
  SupportTicketsManager
} from './StaffDashboardLayout';
import SystemPaymentMethodsManager from './SystemPaymentMethodsManager';

// ============ Types ============
interface Task {
  id: number;
  title: string;
  description: string;
  category_name: string;
  assigned_to: number | null;
  assigned_to_username: string;
  created_by_username: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  is_overdue: boolean;
}

interface Staffer {
  id: number; // User ID
  profile_id: number; // StaffProfile ID
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

interface StaffPermission {
  id: number;
  username: string;
  permission: string;
  granted_by_username: string | null;
  granted_at: string;
  is_active: boolean;
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

// ============ Helpers ============
const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  in_progress: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  staff_promoted: 'bg-green-100 text-green-800',
  staff_demoted: 'bg-red-100 text-red-800',
};

const priorityColors: Record<string, string> = {
  low: 'text-gray-500', medium: 'text-brand-500', high: 'text-orange-500', urgent: 'text-red-500',
};

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const Badge: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => (
  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${className}`}>
    {text.replace(/_/g, ' ')}
  </span>
);

// ============ SVG Line Chart ============
const RevenueChart: React.FC = () => {
  const dataPoints = [3200000, 4100000, 3900000, 5400000, 6200000, 8100000];
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  
  const width = 500;
  const height = 200;
  const padding = 30;
  
  const maxVal = Math.max(...dataPoints) * 1.1;
  const minVal = 0;
  
  const points = dataPoints.map((val, i) => {
    const x = padding + (i * (width - padding * 2) / (dataPoints.length - 1));
    const y = height - padding - ((val - minVal) * (height - padding * 2) / (maxVal - minVal));
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 shadow-sm dark:border-gray-700 p-5">
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Platform Revenue Trend (TZS)</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 overflow-visible">
        {/* Grids */}
        {[0, 0.25, 0.5, 0.75, 1].map((r, idx) => {
          const y = padding + r * (height - padding * 2);
          const val = maxVal - r * (maxVal - minVal);
          return (
            <g key={idx}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f3f4f6" strokeWidth={1} className="dark:stroke-gray-700" />
              <text x={padding - 5} y={y + 4} textAnchor="end" className="text-[8px] fill-gray-400 font-mono">
                {(val / 1000000).toFixed(1)}M
              </text>
            </g>
          );
        })}
        {/* Chart Path */}
        <polyline fill="none" stroke="#4f46e5" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" points={points} />
        {/* X labels */}
        {labels.map((lbl, idx) => {
          const x = padding + (idx * (width - padding * 2) / (labels.length - 1));
          return (
            <text key={idx} x={x} y={height - 10} textAnchor="middle" className="text-[10px] fill-gray-400 font-bold uppercase">
              {lbl}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

// ============ SVG Bar Chart ============
const WorkloadChart: React.FC<{ staffers: Staffer[] }> = ({ staffers }) => {
  const width = 500;
  const height = 200;
  const padding = 30;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const activeStaffers = staffers.filter(s => s.is_active).slice(0, 5);
  const maxTasks = Math.max(...activeStaffers.map(s => s.tasks_count || 1), 5);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 shadow-sm dark:border-gray-700 p-5">
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Staff Task Distribution</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 overflow-visible">
        {/* Axis and Grids */}
        {[0, 0.25, 0.5, 0.75, 1].map((r, idx) => {
          const y = padding + r * chartHeight;
          const val = Math.round(maxTasks - r * maxTasks);
          return (
            <g key={idx}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f3f4f6" strokeWidth={1} className="dark:stroke-gray-700" strokeDasharray="3 3" />
              <text x={padding - 5} y={y + 4} textAnchor="end" className="text-[8px] fill-gray-400 font-mono">{val}</text>
            </g>
          );
        })}
        {/* Bars */}
        {activeStaffers.map((s, idx) => {
          const barWidth = 40;
          const spacing = chartWidth / activeStaffers.length;
          const x = padding + idx * spacing + (spacing - barWidth) / 2;
          const barHeight = ((s.tasks_count || 0) / maxTasks) * chartHeight;
          const y = height - padding - barHeight;

          return (
            <g key={s.id} className="group">
              <rect x={x} y={y} width={barWidth} height={barHeight} fill="#06b6d4" rx={4} className="hover:fill-brand-600 transition" />
              <text x={x + barWidth / 2} y={height - 10} textAnchor="middle" className="text-[8px] fill-gray-400 font-bold uppercase truncate max-w-[40px]">
                {s.username.substring(0, 6)}
              </text>
              <title>{s.username}: {s.tasks_count} tasks</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ============ Admin Overview ============
const AdminOverview: React.FC = () => {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    api.get('/api/staff/admin-dashboard/')
      .then((res) => setData(res.data))
      .catch(() => toast.error('Failed to load admin stats'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (loading || !data) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div></div>;
  }

  const kpis = [
    { label: 'Active Staff', value: data.counts.active_staff, icon: Users, color: 'blue' },
    { label: 'Depts', value: data.counts.dept_count, icon: Building2, color: 'indigo' },
    { label: 'Pending Tasks', value: data.task_stats.pending_total, icon: Clock, color: 'yellow' },
    { label: 'Overdue', value: data.task_stats.overdue_total, icon: AlertTriangle, color: 'red' },
    { label: 'Done (Month)', value: data.task_stats.completed_month, icon: CheckCircle2, color: 'green' },
    { label: 'Total Logs', value: data.recent_logs.length, icon: ScrollText, color: 'gray' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <h2 className="text-xl font-bold text-gray-900 dark:text-white">Admin Staff Control</h2>
         <span className="text-[10px] font-black text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-2 py-1 rounded">Superuser Access</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 shadow-sm dark:border-gray-700 p-4 transition-transform hover:scale-105 shadow-sm">
            <div className="flex items-center justify-between mb-2">
               <kpi.icon size={16} className={`text-${kpi.color}-500`} />
            </div>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{kpi.value}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* SVG Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart />
        <WorkloadChart staffers={data.staffers} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 shadow-sm dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-200 shadow-sm dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest">Global Activity Log</h3>
              <ScrollText size={16} className="text-brand-500" />
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
                {data.recent_logs.map((log) => (
                  <div key={log.id} className="px-5 py-3 hover:bg-gray-50/50 transition">
                      <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-black text-gray-900 dark:text-white">{log.username || 'System'}</span>
                          <span className="text-[10px] text-gray-400 font-bold">{formatDate(log.timestamp)}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{log.description}</p>
                      <Badge text={log.action} className={`mt-2 ${statusColors[log.action] || 'bg-gray-100 text-gray-600'}`} />
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 shadow-sm dark:border-gray-700 p-5 shadow-sm">
              <h3 className="text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-6 border-b pb-4 dark:border-gray-700">Teams & Capacity</h3>
              <div className="space-y-6">
                  {data.departments.map((dept, i) => (
                    <div key={i}>
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-sm font-bold text-gray-700 dark:text-white">{dept.department || 'Unassigned'}</span>
                            <span className="text-xs font-black text-brand-600">{dept.count} members</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-500 transition-all duration-1000" style={{ width: `${(dept.count / (data.counts.total_staff || 1)) * 100}%` }} />
                        </div>
                    </div>
                  ))}
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
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Modal States
  const [showInspectorModal, setShowInspectorModal] = useState(false);
  const [inspectorUser, setInspectorUser] = useState<any>(null);
  const [inspectorLevel, setInspectorLevel] = useState('junior');

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleUser, setRoleUser] = useState<any>(null);
  const [isStaffRole, setIsStaffRole] = useState(false);
  const [isSuperRole, setIsSuperRole] = useState(false);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    api.get('/api/staff/users/')
      .then(res => {
        setUsers(res.data.results || res.data);
      })
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleActive = async (id: number) => {
    try {
      const res = await api.post(`/api/staff/users/${id}/toggle_active/`);
      toast.success(res.data.is_active ? 'User unbanned' : 'User banned');
      fetchUsers();
    } catch {
      toast.error('Failed to toggle active status');
    }
  };

  const handleToggleVerified = async (id: number) => {
    try {
      const res = await api.post(`/api/staff/users/${id}/toggle_verified/`);
      toast.success(res.data.is_verified ? 'User verified' : 'User unverified');
      fetchUsers();
    } catch {
      toast.error('Failed to toggle verification status');
    }
  };

  const submitInspectorPromotion = async () => {
    if (!inspectorUser) return;
    try {
      await api.post(`/api/staff/users/${inspectorUser.id}/promote_inspector/`, { level: inspectorLevel });
      toast.success(`User promoted to ${inspectorLevel} inspector`);
      setShowInspectorModal(false);
      fetchUsers();
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
      fetchUsers();
    } catch {
      toast.error('Failed to update roles (Superusers only)');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(search.toLowerCase()) || 
                          u.email.toLowerCase().includes(search.toLowerCase());
    if (roleFilter === 'staff') return matchesSearch && u.is_staff;
    if (roleFilter === 'superuser') return matchesSearch && u.is_superuser;
    if (roleFilter === 'inspector') return matchesSearch && u.is_inspector;
    return matchesSearch;
  });

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Platform Users Explorer</h2>
        <div className="flex gap-2">
          <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none" />
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none">
            <option value="all">All Users</option>
            <option value="staff">Staff Members</option>
            <option value="superuser">Superusers</option>
            <option value="inspector">Inspectors</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 shadow-sm dark:border-gray-700 overflow-x-auto shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
            <tr>
              <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500">Username</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500">Email</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500">Tier</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500">Status</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500">Verification</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500">Roles</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredUsers.map(u => (
              <tr key={u.id} className="hover:bg-gray-50/30 transition">
                <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">@{u.username}</td>
                <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">{u.email}</td>
                <td className="px-6 py-4 text-xs text-brand-600 font-bold uppercase">{u.tier}</td>
                <td className="px-6 py-4">
                  <Badge text={u.is_active ? 'Active' : 'Banned'} className={u.is_active ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700'} />
                </td>
                <td className="px-6 py-4">
                  <Badge text={u.is_verified ? 'Verified' : 'Unverified'} className={u.is_verified ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-50 text-gray-500'} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {u.is_superuser && <Badge text="Super" className="bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400" />}
                    {u.is_staff && <Badge text="Staff" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />}
                    {u.is_inspector && <Badge text={`Inspector (${u.inspector_level})`} className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" />}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => handleToggleActive(u.id)} className={`px-2.5 py-1 text-[10px] font-bold rounded ${u.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/10' : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/10'}`} title="Toggle Ban">
                      {u.is_active ? 'Ban' : 'Unban'}
                    </button>
                    <button onClick={() => handleToggleVerified(u.id)} className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-650 text-[10px] font-bold rounded" title="Toggle Verification">
                      Verify
                    </button>
                    <button onClick={() => { setInspectorUser(u); setShowInspectorModal(true); }} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold rounded dark:bg-emerald-950/20 dark:text-emerald-400" title="Promote Inspector">
                      +Inspect
                    </button>
                    <button onClick={() => { setRoleUser(u); setIsStaffRole(u.is_staff); setIsSuperRole(u.is_superuser); setShowRoleModal(true); }} className="px-2.5 py-1 bg-brand-50 text-brand-700 hover:bg-brand-100 text-[10px] font-bold rounded dark:bg-brand-950/20 dark:text-brand-400" title="Change Roles">
                      Role
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inspector Promotion Modal */}
      {showInspectorModal && inspectorUser && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative border dark:border-gray-700">
            <button onClick={() => setShowInspectorModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <XCircle size={20} />
            </button>
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">Promote Inspector</h3>
            <p className="text-xs text-gray-500 mb-4">Assigning inspector privileges to <span className="font-bold">@{inspectorUser.username}</span></p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Inspector Level</label>
                <select value={inspectorLevel} onChange={e => setInspectorLevel(e.target.value)} className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                  <option value="junior">Junior Inspector</option>
                  <option value="senior">Senior Inspector</option>
                  <option value="specialist">Specialist</option>
                </select>
              </div>
              <button onClick={submitInspectorPromotion} className="btn-primary w-full py-2 rounded-lg text-sm font-bold">
                Confirm Promotion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {showRoleModal && roleUser && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative border dark:border-gray-700">
            <button onClick={() => setShowRoleModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <XCircle size={20} />
            </button>
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">Manage User Roles</h3>
            <p className="text-xs text-gray-500 mb-4">Modifying permissions for <span className="font-bold">@{roleUser.username}</span></p>
            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white text-sm">Staff Privileges</div>
                  <div className="text-xs text-gray-500">Access to C&C Terminal dashboard</div>
                </div>
                <input type="checkbox" checked={isStaffRole} onChange={e => setIsStaffRole(e.target.checked)} className="rounded text-brand-600 focus:ring-gray-900 dark:focus:ring-white h-5 w-5" />
              </label>
              <label className="flex items-center justify-between p-3 border border-red-200 dark:border-red-900/30 rounded-xl cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/10">
                <div>
                  <div className="font-bold text-red-700 dark:text-red-400 text-sm">Superuser Privileges</div>
                  <div className="text-[10px] text-red-500">Full system access (Danger)</div>
                </div>
                <input type="checkbox" checked={isSuperRole} onChange={e => setIsSuperRole(e.target.checked)} className="rounded text-red-600 focus:ring-red-500 h-5 w-5" />
              </label>
              <button onClick={submitRoleChange} className="bg-gray-900 hover:bg-black dark:bg-gray-700 dark:hover:bg-gray-600 text-white w-full py-2 rounded-lg text-sm font-bold transition">
                Save Roles
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ Employee Manager ============
const EmployeeManager: React.FC = () => {
    const [staff, setStaff] = useState<Staffer[]>([]);
    const [loading, setLoading] = useState(true);
    const [departments, setDepartments] = useState<any[]>([]);
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [deptStaffer, setDeptStaffer] = useState<any>(null);
    const [selectedDept, setSelectedDept] = useState('');

    const fetchStaff = () => {
        setLoading(true);
        Promise.all([
            api.get('/api/staff/admin-dashboard/'),
            api.get('/api/staff/departments/')
        ]).then(([staffRes, deptRes]) => {
            setStaff(staffRes.data.staffers);
            setDepartments(deptRes.data.results || deptRes.data || []);
        }).catch(() => toast.error('Failed to load employee data'))
        .finally(() => setLoading(false));
    };

    useEffect(() => { fetchStaff(); }, []);

    const handleAction = async (profileId: number, action: 'promote' | 'demote') => {
        try {
            await api.post(`/api/staff/profiles/${profileId}/${action}/`);
            toast.success(`Staff member ${action}d successfully`);
            fetchStaff();
        } catch (err: any) {
            toast.error(err.response?.data?.error || `Failed to ${action}`);
        }
    };

    const submitChangeDept = async () => {
        if (!deptStaffer) return;
        try {
            await api.patch(`/api/staff/profiles/${deptStaffer.profile_id}/`, { department: selectedDept || null });
            toast.success('Department updated successfully');
            setShowDeptModal(false);
            fetchStaff();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to change department');
        }
    };

    if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Workforce Management</h2>
                <span className="text-[10px] font-black bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded uppercase tracking-widest">{staff.length} Total Staff</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {staff.map(member => (
                    <div key={member.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 shadow-sm dark:border-gray-700 p-5 group hover:border-brand-500/30 transition shadow-sm">
                        <div className="flex items-start justify-between">
                            <div className="flex gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-black text-gray-400 uppercase">
                                    {member.username.substring(0, 2)}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-base font-black text-gray-900 dark:text-white truncate">{member.username}</h4>
                                        <VerifiedBadge tier={member.tier} isVerified={member.is_verified} className="w-4 h-4" />
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">{member.email}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge text={member.department || 'GENERAL'} className="bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400" />
                                        <Badge text={member.is_active ? 'Active' : 'Inactive'} className={member.is_active ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700'} />
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-black text-gray-900 dark:text-white">{member.tasks_count}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tasks</p>
                            </div>
                        </div>
                        
                        <div className="mt-6 pt-5 border-t border-gray-50 dark:border-gray-700 flex items-center justify-between">
                             <div className="flex gap-2">
                                 <button onClick={() => handleAction(member.profile_id, member.is_active ? 'demote' : 'promote')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-tighter transition ${member.is_active ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`}>
                                    {member.is_active ? <><UserMinus size={14} /> Demote</> : <><UserPlus size={14} /> Reactivate</>}
                                 </button>
                                 <button onClick={() => { setDeptStaffer(member); setSelectedDept(member.department || ''); setShowDeptModal(true); }}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-tighter transition text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                                    <Building2 size={14} /> Dept
                                 </button>
                                 <Link to={`/staff-admin/tasks?assigned_to=${member.id}`} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
                                     <Briefcase size={16} />
                                 </Link>
                             </div>
                             <Link to="/staff-admin/permissions" className="text-[10px] font-black text-brand-600 hover:underline hover:text-brand-700 uppercase tracking-widest">
                                 Permissions Matrix
                             </Link>
                        </div>
                    </div>
                ))}
            </div>

            {/* Department Change Modal */}
            {showDeptModal && deptStaffer && (
              <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative border dark:border-gray-700">
                  <button onClick={() => setShowDeptModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <XCircle size={20} />
                  </button>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">Change Department</h3>
                  <p className="text-xs text-gray-500 mb-4">Assigning <span className="font-bold">@{deptStaffer.username}</span> to a new department.</p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Select Department</label>
                      <select 
                        value={selectedDept} 
                        onChange={e => setSelectedDept(e.target.value)}
                        className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">No Department (General)</option>
                        {departments.map((dept: any) => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <button onClick={submitChangeDept} className="btn-primary w-full py-2 rounded-lg text-sm font-bold shadow-md">
                      Update Department
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
    );
};

// ============ Task Board (with Full Lifecycle) ============
const TaskBoard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<Staffer[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', category: '', assigned_to: '' });

  const fetchBoard = () => {
    setLoading(true);
    Promise.all([
      api.get('/api/staff/tasks/'),
      api.get('/api/staff/admin-dashboard/'),
      api.get('/api/staff/task-categories/')
    ]).then(([tasksRes, adminRes, catRes]) => {
      setTasks(tasksRes.data.results || tasksRes.data);
      setStaff(adminRes.data.staffers || adminRes.data.results || adminRes.data);
      setCategories(catRes.data.results || catRes.data);
    }).catch(() => toast.error('Failed to load board'))
    .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBoard(); }, []);

  const handleAssign = async (taskId: number, staffId: number) => {
      try {
          await api.patch(`/api/staff/tasks/${taskId}/`, { assigned_to: staffId });
          toast.success('Task delegated successfully');
          fetchBoard();
      } catch { toast.error('Failed to delegate task'); }
  };

  const handleUpdateStatus = async (taskId: number, newStatus: string) => {
      try {
          await api.patch(`/api/staff/tasks/${taskId}/`, { status: newStatus });
          toast.success(`Task marked as ${newStatus.replace('_', ' ')}`);
          fetchBoard();
      } catch { toast.error('Failed to update task status'); }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await api.post('/api/staff/tasks/', newTask);
          toast.success('Task created and assigned!');
          setShowCreate(false);
          setNewTask({ title: '', description: '', priority: 'medium', category: '', assigned_to: '' });
          fetchBoard();
      } catch { toast.error('Failed to create task'); }
  };

  const columns = [
    { key: 'pending', label: 'Pending', icon: Clock, color: 'border-yellow-400' },
    { key: 'in_progress', label: 'In Progress', icon: ClipboardList, color: 'border-brand-400' },
    { key: 'completed', label: 'Completed', icon: CheckCircle2, color: 'border-green-400' },
  ];

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div></div>;

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Agency Workflows</h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Delegation & Oversight</p>
            </div>
            <button onClick={() => setShowCreate(!showCreate)} className="btn-primary py-2 px-4 text-xs flex items-center gap-2 shadow-lg shadow-brand-600/20 active:scale-95 transition">
                <Plus size={14} /> {showCreate ? 'Close Form' : 'New Task'}
            </button>
        </div>

        {showCreate && (
            <form onSubmit={handleCreateTask} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-150 dark:border-gray-700 p-6 border-brand-200 dark:border-brand-900/30 animate-slide-up space-y-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} placeholder="Task Title" className="input text-sm" required />
                    <select value={newTask.category} onChange={e => setNewTask({...newTask, category: e.target.value})} className="input text-sm" required>
                        <option value="">Select Category</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <textarea value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} placeholder="Full description and instructions..." className="input text-sm h-20" required />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})} className="input text-sm">
                        <option value="low">Low Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="high">High Priority</option>
                        <option value="urgent">Urgent</option>
                    </select>
                    <select value={newTask.assigned_to} onChange={e => setNewTask({...newTask, assigned_to: e.target.value})} className="input text-sm">
                        <option value="">Unassigned</option>
                        {staff.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.username} ({s.department})</option>)}
                    </select>
                </div>
                <button type="submit" className="btn-primary w-full py-3 text-xs uppercase font-black tracking-widest shadow-xl shadow-brand-500/20">Create & Ship Task</button>
            </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {columns.map(col => {
                const colTasks = tasks.filter(t => t.status === col.key);
                return (
                    <div key={col.key} className="flex flex-col h-[70vh] bg-gray-50 dark:bg-gray-800/20 rounded-2xl p-2 border border-gray-200 shadow-sm dark:border-gray-700/30">
                        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700/50 mb-3">
                             <div className="flex items-center gap-2">
                                <col.icon size={16} className="text-gray-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{col.label}</span>
                             </div>
                             <span className="text-[10px] font-black bg-white dark:bg-gray-700 px-2 py-0.5 rounded shadow-sm">{colTasks.length}</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto px-1 space-y-3 pb-4 scroll-slim">
                            {colTasks.map(t => (
                                <div key={t.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 hover:shadow-lg transition-all duration-300 group relative shadow-sm border border-gray-200 shadow-sm dark:border-gray-700">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge text={t.priority} className={priorityColors[t.priority]} />
                                        {t.is_overdue && <AlertTriangle size={14} className="text-red-500 animate-pulse" />}
                                    </div>
                                    <h4 className="text-sm font-black text-gray-900 dark:text-white tracking-tighter uppercase">{t.title}</h4>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 leading-relaxed">"{t.description}"</p>
                                    
                                    <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-700 flex flex-col gap-2 relative">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-lg bg-brand-600 flex items-center justify-center text-[10px] text-white font-black">
                                                    {t.assigned_to_username?.substring(0, 1) || '?'}
                                                </div>
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter truncate max-w-[80px]">{t.assigned_to_username || 'UNASSIGNED'}</span>
                                            </div>
                                            
                                            {/* Action Buttons */}
                                            <div className="flex gap-1.5 items-center">
                                                {t.assigned_to_username === localStorage.getItem('username') && (
                                                    <>
                                                        {t.status === 'pending' && (
                                                            <button 
                                                                onClick={() => handleUpdateStatus(t.id, 'in_progress')}
                                                                className="px-2 py-1 bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 rounded text-[9px] font-black uppercase tracking-tighter hover:bg-brand-100 transition"
                                                            >
                                                                Acknowledge
                                                            </button>
                                                        )}
                                                        {t.status === 'in_progress' && (
                                                            <button 
                                                                onClick={() => handleUpdateStatus(t.id, 'completed')}
                                                                className="px-2 py-1 bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded text-[9px] font-black uppercase tracking-tighter hover:bg-green-100 transition"
                                                            >
                                                                Complete
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                                
                                                {localStorage.getItem('is_superuser') === 'true' && t.status !== 'completed' && t.status !== 'cancelled' && (
                                                    <button 
                                                        onClick={() => handleUpdateStatus(t.id, 'cancelled')}
                                                        className="p-1 text-red-300 hover:text-red-500 transition"
                                                        title="Cancel Task"
                                                    >
                                                        <XCircle size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {localStorage.getItem('is_superuser') === 'true' && (
                                            <div className="relative group/reassign">
                                                <select 
                                                    className="opacity-0 absolute inset-0 cursor-pointer w-full z-10"
                                                    value={t.assigned_to || ""}
                                                    onChange={(e) => handleAssign(t.id, parseInt(e.target.value))}
                                                >
                                                    <option value="">Delegate to...</option>
                                                    {staff.filter(s => s.is_active).map(s => (
                                                        <option key={s.id} value={s.id}>{s.username}</option>
                                                    ))}
                                                </select>
                                                <div className="p-1 px-2 text-[10px] font-black text-brand-600 bg-brand-50 dark:bg-brand-900/20 rounded uppercase group-hover/reassign:bg-brand-100 transition-colors text-center">
                                                   Re-Assign
                                                </div>
                                            </div>
                                        )}
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

// ============ Permission Matrix ============
const PermissionMatrix: React.FC = () => {
  const [perms, setPerms] = useState<StaffPermission[]>([]);
  const [staff, setStaff] = useState<Staffer[]>([]);
  const [loading, setLoading] = useState(true);

  const availablePermissions = [
    { key: 'can_approve_content', label: 'Content' },
    { key: 'can_review_promotions', label: 'Ads' },
    { key: 'can_moderate', label: 'Moderate' },
    { key: 'can_manage_tasks', label: 'Tasks' },
    { key: 'can_manage_inspections', label: 'Inspections' },
    { key: 'can_view_reports', label: 'Reports' },
    { key: 'can_verify_requests', label: 'Upgrades' },
    { key: 'can_confirm_upgrades', label: 'Confirm Upgrades' },
    { key: 'can_manage_users', label: 'Users' },
    { key: 'can_approve_actions', label: 'Actions' },
    { key: 'can_manage_warehouse_intake', label: 'Warehouse Intake' },
    { key: 'can_manage_warehouse_transfers', label: 'Warehouse Transfers' },
    { key: 'can_manage_logistics', label: 'Logistics' },
  ];

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/staff/permissions/'),
      api.get('/api/staff/admin-dashboard/')
    ]).then(([pRes, aRes]) => {
      setPerms(pRes.data.results || pRes.data);
      setStaff(aRes.data.staffers || aRes.data.results || aRes.data);
    }).catch(() => toast.error('Failed to load permission matrix'))
    .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggle = async (userId: number, permKey: string) => {
    const existing = perms.find(p => p.username === staff.find(s => s.id === userId)?.username && p.permission === permKey && p.is_active);
    
    try {
      if (existing) {
        // Revoke
        await api.delete(`/api/staff/permissions/${existing.id}/`);
        toast.success('Permission revoked');
      } else {
        // Grant
        await api.post('/api/staff/permissions/', { user: userId, permission: permKey });
        toast.success('Permission granted');
      }
      fetchData();
    } catch {
      toast.error('Failed to toggle permission');
    }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Permissions Matrix Grid</h2>
        <span className="text-xs text-gray-400">Directly toggle capabilities of each active staff member</span>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 shadow-sm dark:border-gray-700 overflow-x-auto shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
              <th className="px-6 py-4 text-xs font-bold uppercase text-gray-500 tracking-wider">Staff Member</th>
              {availablePermissions.map(p => (
                <th key={p.key} className="px-4 py-4 text-xs font-bold uppercase text-gray-500 tracking-wider text-center" title={p.key}>
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {staff.filter(s => s.is_active).map(member => (
              <tr key={member.id} className="hover:bg-gray-50/30 transition">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{member.username}</span>
                      <span className="text-[10px] text-gray-400 block">{member.department || 'General'}</span>
                    </div>
                  </div>
                </td>
                {availablePermissions.map(p => {
                  const hasPerm = perms.some(pm => pm.username === member.username && pm.permission === p.key && pm.is_active);
                  return (
                    <td key={p.key} className="px-4 py-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={hasPerm} 
                        onChange={() => handleToggle(member.id, p.key)}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-gray-900 dark:focus:ring-white border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============ Audit Log Stream ============
const AuditLogViewer: React.FC = () => {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

    useEffect(() => {
        setLoading(true);
        api.get('/api/staff/audit-logs/')
            .then(res => setLogs(res.data.results || res.data))
            .catch(() => toast.error('Failed to load audit trail'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div></div>;

    return (
        <div className="space-y-6 relative flex flex-col xl:flex-row gap-6">
            <div className="flex-1 space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Security Audit Trail</h2>
                    <div className="flex items-center gap-2 p-2 bg-brand-50 dark:bg-brand-900/10 rounded-lg text-brand-700 dark:text-brand-300">
                         <Shield size={16} />
                         <span className="text-[10px] font-black uppercase tracking-widest">Read Only Immutable Log</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 shadow-sm dark:border-gray-700 overflow-hidden shadow-sm">
                    <div className="divide-y divide-gray-50 dark:divide-gray-700">
                        {logs.map(log => (
                            <div key={log.id} onClick={() => setSelectedLog(log)} className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition cursor-pointer ${selectedLog?.id === log.id ? 'bg-brand-50/30 dark:bg-brand-950/10 border-l-4 border-brand-600' : ''}`}>
                                <div className="flex items-start gap-4">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${statusColors[log.action] || 'bg-gray-100 text-gray-500'}`}>
                                        <Clock size={14} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">{log.username || 'System'} → {log.action}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{log.description}</p>
                                        {log.target_username && <p className="text-[10px] font-bold text-brand-600 mt-1 uppercase font-mono">Target: @{log.target_username}</p>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{formatDate(log.timestamp)}</p>
                                    <p className="text-[10px] font-mono text-gray-400 mt-1">{log.ip_address}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Slide-over Side Drawer for JSON Metadata Inspector */}
            {selectedLog && (
                <div className="w-full xl:w-80 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-lg flex flex-col justify-between shrink-0 h-[70vh] sticky top-24">
                    <div>
                        <div className="flex justify-between items-center mb-4 border-b pb-2 dark:border-gray-700">
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Metadata Inspector</h3>
                            <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <div className="space-y-3 text-xs">
                            <p className="text-gray-500"><strong className="text-gray-700 dark:text-gray-300">Action:</strong> {selectedLog.action}</p>
                            <p className="text-gray-500"><strong className="text-gray-700 dark:text-gray-300">User:</strong> @{selectedLog.username || 'System'}</p>
                            <p className="text-gray-500"><strong className="text-gray-700 dark:text-gray-300">IP:</strong> {selectedLog.ip_address}</p>
                            <p className="text-gray-500"><strong className="text-gray-700 dark:text-gray-300">User-Agent:</strong> {selectedLog.user_agent || 'Unknown'}</p>
                            
                            <div className="mt-4">
                                <strong className="text-gray-700 dark:text-gray-300 block mb-1">Extra Data JSON:</strong>
                                <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border dark:border-gray-700 text-[10px] font-mono overflow-auto max-h-48 text-gray-700 dark:text-gray-300 scrollbar-thin">
                                    {JSON.stringify(selectedLog.extra_data || {}, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setSelectedLog(null)} className="w-full py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs font-bold rounded-lg transition text-gray-700 dark:text-gray-300">Close Inspector</button>
                </div>
            )}
        </div>
    );
};

// ============ Staff Admin Layout ============
const StaffAdminLayout: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { path: '/staff-admin', label: 'Overview', icon: LayoutDashboard },
    { path: '/staff-admin/users', label: 'Platform Users', icon: Users },
    { path: '/staff-admin/employees', label: 'Workforce', icon: Briefcase },
    { path: '/staff-admin/tasks', label: 'Work Board', icon: ClipboardList },
    { path: '/staff-admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
    { path: '/staff-admin/invoices', label: 'Commission Payments', icon: FileText },
    { path: '/staff-admin/payment-methods', label: 'Payment Methods', icon: CreditCard },
    { path: '/staff-admin/products', label: 'Product Moderation', icon: Layers },
    { path: '/staff-admin/promotions', label: 'Promotions', icon: Megaphone },
    { path: '/staff-admin/reviews', label: 'Reviews', icon: Star },
    { path: '/staff-admin/disputes', label: 'Disputes', icon: AlertTriangle },
    { path: '/staff-admin/tickets', label: 'Support Tickets', icon: MessageSquare },
    { path: '/staff-admin/audit-log', label: 'Audit Logs', icon: ScrollText },
    { path: '/staff-admin/permissions', label: 'Permissions Matrix', icon: Shield },
    { path: '/staff-admin/inspections', label: 'Inspect Ops', icon: ClipboardList },
    { path: '/staff', label: 'Staff Dashboard', icon: LayoutDashboard },
  ];

  return (
    <div className="max-w-[1400px] mx-auto p-4 flex flex-col lg:flex-row gap-8 min-h-screen">
      <aside className="w-full lg:w-64 shrink-0">
        <div className="sticky top-24 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-brand-600/5 border border-brand-100/50 dark:border-brand-900/20 p-3 space-y-1 max-h-[70vh] overflow-y-auto no-scrollbar">
                <div className="px-4 py-3 mb-2 flex items-center gap-2 border-b border-gray-50 dark:border-gray-700">
                    <div className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">C&C Terminal</h3>
                </div>
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path || (
                        item.path !== '/staff-admin' && 
                        (item.path !== '/staff' || !location.pathname.startsWith('/staff-admin')) && 
                        location.pathname.startsWith(item.path)
                    );
                    return (
                    <Link key={item.path} to={item.path}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition ${
                        isActive
                            ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30 -translate-y-0.5'
                            : 'text-gray-500 hover:bg-brand-50 dark:hover:bg-brand-900/10 hover:text-brand-600'
                        }`}
                    >
                        <item.icon size={16} />
                        {item.label}
                    </Link>
                    );
                })}
            </div>
            
            <div className="bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-2xl p-5 border-0 shadow-lg shadow-brand-600/20">
                <Shield size={24} className="mb-4 opacity-50" />
                <h4 className="text-sm font-black uppercase tracking-widest mb-1">Admin Mode</h4>
                <p className="text-[10px] text-white/70 leading-relaxed font-medium">You have unrestricted access to all operations, metrics, user accounts, and staff records.</p>
            </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 animate-fade-in pb-12">
        <Routes>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<PlatformUserExplorer />} />
          <Route path="employees" element={<EmployeeManager />} />
          <Route path="tasks" element={<TaskBoard />} />
          <Route path="subscriptions" element={<SubscriptionConfirmation />} />
          <Route path="invoices" element={<CommissionPaymentsManager />} />
          <Route path="payment-methods" element={<SystemPaymentMethodsManager />} />
          <Route path="products" element={<ProductModeration />} />
          <Route path="promotions" element={<PromotionQueue />} />
          <Route path="reviews" element={<ReviewsManager />} />
          <Route path="disputes" element={<DisputesManager />} />
          <Route path="tickets" element={<SupportTicketsManager />} />
          <Route path="audit-log" element={<AuditLogViewer />} />
          <Route path="permissions" element={<PermissionMatrix />} />
          <Route path="inspections/*" element={<StaffInspectionLayout />} />
        </Routes>
      </main>
    </div>
  );
};

export default StaffAdminLayout;
