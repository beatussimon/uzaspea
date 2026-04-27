import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Shield, ScrollText,
  Users, CheckCircle2, XCircle, Clock, AlertTriangle,
  UserPlus, UserMinus, Building2, Briefcase, Plus
} from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import VerifiedBadge from '../../components/VerifiedBadge';
import StaffInspectionLayout from './inspections/StaffInspectionLayout';

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
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  staff_promoted: 'bg-green-100 text-green-800',
  staff_demoted: 'bg-red-100 text-red-800',
};

const priorityColors: Record<string, string> = {
  low: 'text-gray-500', medium: 'text-blue-500', high: 'text-orange-500', urgent: 'text-red-500',
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
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;
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
          <div key={i} className="card p-4 transition-transform hover:scale-105">
            <div className="flex items-center justify-between mb-2">
               <kpi.icon size={16} className={`text-${kpi.color}-500`} />
            </div>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{kpi.value}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest">Global Activity Log</h3>
              <ScrollText size={16} className="text-blue-500" />
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
                {data.recent_logs.map((log) => (
                  <div key={log.id} className="px-5 py-3 hover:bg-gray-50/50 transition">
                      <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-black text-gray-900 dark:text-white">{log.username}</span>
                          <span className="text-[10px] text-gray-400 font-bold">{formatDate(log.timestamp)}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{log.description}</p>
                      <Badge text={log.action} className={`mt-2 ${statusColors[log.action] || 'bg-gray-100 text-gray-600'}`} />
                  </div>
                ))}
            </div>
          </div>

          <div className="card p-5">
              <h3 className="text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-6 border-b pb-4">Teams & Capacity</h3>
              <div className="space-y-6">
                  {data.departments.map((dept, i) => (
                    <div key={i}>
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-sm font-bold text-gray-700 dark:text-white">{dept.department || 'Unassigned'}</span>
                            <span className="text-xs font-black text-blue-600">{dept.count} members</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${(dept.count / (data.counts.total_staff || 1)) * 100}%` }} />
                        </div>
                    </div>
                  ))}
              </div>
          </div>
      </div>
    </div>
  );
};

// ============ Employee Manager ============
const EmployeeManager: React.FC = () => {
    const [staff, setStaff] = useState<Staffer[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchStaff = () => {
        setLoading(true);
        api.get('/api/staff/admin-dashboard/')
            .then(res => setStaff(res.data.staffers))
            .catch(() => toast.error('Failed to load employee list'))
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

    if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Workforce Management</h2>
                <span className="text-[10px] font-black bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded uppercase tracking-widest">{staff.length} Total Staff</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {staff.map(member => (
                    <div key={member.id} className="card p-5 group hover:border-brand-500/30 transition-colors">
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
                                        <Badge text={member.department || 'GENERAL'} className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
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
                                 <Link to={`/staff-admin/tasks?assigned_to=${member.id}`} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
                                     <Briefcase size={16} />
                                 </Link>
                             </div>
                             <Link to="/staff-admin/permissions" className="text-[10px] font-black text-brand-600 hover:underline hover:text-brand-700 uppercase tracking-widest">
                                 Permissions
                             </Link>
                        </div>
                    </div>
                ))}
            </div>
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
    { key: 'in_progress', label: 'In Progress', icon: ClipboardList, color: 'border-blue-400' },
    { key: 'completed', label: 'Completed', icon: CheckCircle2, color: 'border-green-400' },
  ];

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;

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
            <form onSubmit={handleCreateTask} className="card p-6 bg-white dark:bg-gray-800 border-brand-200 dark:border-brand-900/30 animate-slide-up space-y-4">
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
                    <div key={col.key} className="flex flex-col h-[70vh] bg-gray-50 dark:bg-gray-800/20 rounded-2xl p-2 border border-gray-100 dark:border-gray-700/30">
                        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700/50 mb-3">
                             <div className="flex items-center gap-2">
                                <col.icon size={16} className="text-gray-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{col.label}</span>
                             </div>
                             <span className="text-[10px] font-black bg-white dark:bg-gray-700 px-2 py-0.5 rounded shadow-sm">{colTasks.length}</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto px-1 space-y-3 pb-4 scroll-slim">
                            {colTasks.map(t => (
                                <div key={t.id} className="card p-4 hover:shadow-lg transition-all duration-300 group relative bg-white dark:bg-gray-800">
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
                                                                className="px-2 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded text-[9px] font-black uppercase tracking-tighter hover:bg-blue-100 transition"
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

// ============ Permission Guard ============
const PermissionManager: React.FC = () => {
    const [perms, setPerms] = useState<StaffPermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [staff, setStaff] = useState<Staffer[]>([]);
    const [granting, setGranting] = useState({ user: '', permission: '' });

    const fetchData = () => {
        setLoading(true);
        Promise.all([
            api.get('/api/staff/permissions/'),
            api.get('/api/staff/admin-dashboard/')
        ]).then(([pRes, aRes]) => {
            setPerms(pRes.data.results || pRes.data);
            setStaff(aRes.data.staffers || aRes.data.results || aRes.data);
        }).catch(() => toast.error('Failed to load permissions'))
        .finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []);

    const handleGrant = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/api/staff/permissions/', granting);
            toast.success('Permission granted');
            setGranting({ user: '', permission: '' });
            fetchData();
        } catch { toast.error('Failed to grant permission'); }
    };

    const handleAction = async (id: number, action: 'revoke' | 'remove') => {
        try {
            if (action === 'revoke') await api.patch(`/api/staff/permissions/${id}/`, { is_active: false });
            else await api.delete(`/api/staff/permissions/${id}/`);
            toast.success('Permission updated');
            fetchData();
        } catch { toast.error('Action failed'); }
    };

    if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">System Guard (Staff Roles)</h2>
            
            <form onSubmit={handleGrant} className="card p-5 bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Target User</label>
                    <select value={granting.user} onChange={e => setGranting({...granting, user: e.target.value})} className="input text-sm" required>
                        <option value="">Select Staff...</option>
                        {staff.map(s => <option key={s.id} value={s.id}>{s.username}</option>)}
                    </select>
                </div>
                <div className="flex-2 min-w-[250px]">
                    <label className="text-[10px] font-black uppercase text-gray-500 mb-1 block">Permission Level</label>
                    <select value={granting.permission} onChange={e => setGranting({...granting, permission: e.target.value})} className="input text-sm" required>
                        <option value="">Select Ability...</option>
                        <option value="can_approve_content">Approve Marketplace Content</option>
                        <option value="can_review_promotions">Review Promotions (Ads)</option>
                        <option value="can_moderate">Moderate Comments/Reviews</option>
                        <option value="can_manage_tasks">Manage Other Staff Tasks</option>
                        <option value="can_manage_inspections">Manage All Inspections</option>
                        <option value="can_view_reports">View All Reports & Fraud</option>
                        <option value="can_verify_requests">Verify Seller Upgrades</option>
                    </select>
                </div>
                <button type="submit" className="btn-primary py-2.5 px-6 text-xs uppercase font-black">Grant Access</button>
            </form>

            <div className="card overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-500">Staff Member</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-500">Privilege</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-500">Status</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-500 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                        {perms.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4 text-sm font-black text-gray-900 dark:text-white uppercase tracking-tighter">{p.username}</td>
                                <td className="px-6 py-4 text-xs text-gray-500 font-bold uppercase">{p.permission.replace(/_/g, ' ')}</td>
                                <td className="px-6 py-4"><Badge text={p.is_active ? 'Active' : 'Revoked'} className={p.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'} /></td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => handleAction(p.id, 'remove')} className="text-red-500 hover:text-red-700 p-1"><XCircle size={18} /></button>
                                </td>
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

    useEffect(() => {
        setLoading(true);
        api.get('/api/staff/audit-logs/')
            .then(res => setLogs(res.data.results || res.data))
            .catch(() => toast.error('Failed to load audit trail'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Security Audit Trail</h2>
                <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-blue-700 dark:text-blue-300">
                     <Shield size={16} />
                     <span className="text-[10px] font-black uppercase tracking-widest">Read Only Immutable Log</span>
                </div>
            </div>

            <div className="card overflow-hidden">
                <div className="divide-y divide-gray-50 dark:divide-gray-700">
                    {logs.map(log => (
                        <div key={log.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
                            <div className="flex items-start gap-4">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${statusColors[log.action] || 'bg-gray-100 text-gray-500'}`}>
                                    <Clock size={14} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">{log.username} → {log.action}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{log.description}</p>
                                    {log.target_username && <p className="text-[10px] font-bold text-brand-600 mt-1 uppercase">Target: @{log.target_username}</p>}
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
    );
};

// ============ Staff Admin Layout ============
const StaffAdminLayout: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { path: '/staff-admin', label: 'Overview', icon: LayoutDashboard },
    { path: '/staff-admin/employees', label: 'Workforce', icon: Users },
    { path: '/staff-admin/tasks', label: 'Work Board', icon: ClipboardList },
    { path: '/staff-admin/audit-log', label: 'Audit Logs', icon: ScrollText },
    { path: '/staff-admin/permissions', label: 'System Guard', icon: Shield },
    { path: '/staff-admin/inspections', label: 'Inspect Ops', icon: ClipboardList },
  ];

  return (
    <div className="max-w-[1400px] mx-auto p-4 flex flex-col lg:flex-row gap-8 min-h-screen">
      <aside className="w-full lg:w-64 shrink-0">
        <div className="sticky top-24 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-brand-600/5 border border-brand-100/50 dark:border-brand-900/20 p-3 space-y-1">
                <div className="px-4 py-3 mb-2 flex items-center gap-2 border-b border-gray-50 dark:border-gray-700">
                    <div className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">C&C Terminal</h3>
                </div>
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path || (item.path !== '/staff-admin' && location.pathname.startsWith(item.path));
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
            
            <div className="card p-5 bg-gradient-to-br from-indigo-600 to-brand-700 text-white border-0 shadow-lg shadow-indigo-600/20">
                <Shield size={24} className="mb-4 opacity-50" />
                <h4 className="text-sm font-black uppercase tracking-widest mb-1">Admin Mode</h4>
                <p className="text-[10px] text-white/70 leading-relaxed font-medium">You have unrestricted access to all agency operations, metrics, and staff records.</p>
            </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 animate-fade-in pb-12">
        <Routes>
          <Route index element={<AdminOverview />} />
          <Route path="employees" element={<EmployeeManager />} />
          <Route path="tasks" element={<TaskBoard />} />
          <Route path="audit-log" element={<AuditLogViewer />} />
          <Route path="permissions" element={<PermissionManager />} />
          <Route path="inspections/*" element={<StaffInspectionLayout />} />
        </Routes>
      </main>
    </div>
  );
};

export default StaffAdminLayout;
