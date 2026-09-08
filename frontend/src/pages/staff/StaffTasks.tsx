import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, CheckCircle2, Clock, Play, XCircle, UserCircle, Search,
  Layers, Kanban, List, ChevronRight, X, User,
  Calendar
} from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { KanbanSkeleton, CardListSkeleton } from '../../components/Skeleton';

interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: number | null;
  assigned_to_username: string | null;
  category: number | null;
  category_name: string | null;
  created_at: string;
  updated_at: string;
}

interface StaffUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
}

interface Category {
  id: number;
  name: string;
}

const PRIORITY_BADGES: Record<string, { label: string; class: string; dot: string }> = {
  urgent: { label: 'Urgent', class: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', dot: 'bg-red-500' },
  high: { label: 'High', class: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20', dot: 'bg-orange-500' },
  medium: { label: 'Medium', class: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20', dot: 'bg-brand-500' },
  low: { label: 'Low', class: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20', dot: 'bg-gray-400' },
};

const STATUS_BADGES: Record<string, { label: string; class: string; dot: string }> = {
  pending: { label: 'Pending', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', dot: 'bg-amber-500' },
  in_progress: { label: 'In Progress', class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', dot: 'bg-blue-500' },
  on_hold: { label: 'On Hold', class: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20', dot: 'bg-orange-500' },
  completed: { label: 'Completed', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', class: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', dot: 'bg-red-500' },
};

const StaffTasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await api.get('/api/staff/tasks/');
      setTasks(res.data.results || res.data);
    } catch {
      toast.error('Failed to load staff tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMetadata = useCallback(async () => {
    try {
      const [uRes, cRes] = await Promise.all([
        api.get('/api/staff/members/').catch(() => ({ data: [] })),
        api.get('/api/staff/task-categories/').catch(() => ({ data: [] })),
      ]);
      setUsers(uRes.data.results || uRes.data || []);
      setCategories(cRes.data.results || cRes.data || []);
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchMetadata();
  }, [fetchTasks, fetchMetadata]);

  const updateTaskStatus = async (taskId: number, action: 'claim' | 'start' | 'complete' | 'hold' | 'cancel') => {
    setUpdatingTaskId(taskId);
    try {
      await api.post(`/api/staff/tasks/${taskId}/${action}/`);
      toast.success(`Task ${action}ed successfully`);
      fetchTasks();
      if (selectedTask?.id === taskId) {
        const res = await api.get(`/api/staff/tasks/${taskId}/`);
        setSelectedTask(res.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Failed to ${action} task`);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      title: formData.get('title'),
      description: formData.get('description'),
      category: formData.get('category') || null,
      priority: formData.get('priority') || 'medium',
      assigned_to: formData.get('assigned_to') || null,
      due_date: formData.get('due_date') || null,
    };

    try {
      await api.post('/api/staff/tasks/', payload);
      toast.success('Task created successfully');
      setCreateModalOpen(false);
      fetchTasks();
    } catch {
      toast.error('Failed to create task');
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Filter status logic
      let matchesStatus = true;
      if (filterStatus === 'unassigned') {
        matchesStatus = task.status === 'pending' && task.assigned_to === null;
      } else if (filterStatus !== 'all') {
        matchesStatus = task.status === filterStatus;
      }

      // Filter search query
      let matchesSearch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        matchesSearch = Boolean(
          (task.title && task.title.toLowerCase().includes(q)) ||
          (task.description && task.description.toLowerCase().includes(q)) ||
          (task.assigned_to_username && task.assigned_to_username.toLowerCase().includes(q)) ||
          (task.category_name && task.category_name.toLowerCase().includes(q))
        );
      }

      return matchesStatus && matchesSearch;
    });
  }, [tasks, filterStatus, searchQuery]);

  const taskCounts = useMemo(() => {
    return {
      all: tasks.length,
      unassigned: tasks.filter(t => t.status === 'pending' && t.assigned_to === null).length,
      pending: tasks.filter(t => t.status === 'pending' && t.assigned_to !== null).length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      on_hold: tasks.filter(t => t.status === 'on_hold').length,
      completed: tasks.filter(t => t.status === 'completed').length,
    };
  }, [tasks]);

  const filterTabs = [
    { key: 'all', label: 'All Tasks', count: taskCounts.all },
    { key: 'unassigned', label: 'Open Pool', count: taskCounts.unassigned },
    { key: 'pending', label: 'Pending', count: taskCounts.pending },
    { key: 'in_progress', label: 'In Progress', count: taskCounts.in_progress },
    { key: 'on_hold', label: 'On Hold', count: taskCounts.on_hold },
    { key: 'completed', label: 'Completed', count: taskCounts.completed },
  ];

  const columns = [
    { id: 'unassigned', title: 'Open Pool', statuses: ['pending'], unassignedOnly: true, dot: 'bg-orange-500' },
    { id: 'pending', title: 'Pending', statuses: ['pending'], assignedOnly: true, dot: 'bg-amber-500' },
    { id: 'in_progress', title: 'In Progress', statuses: ['in_progress'], dot: 'bg-blue-500' },
    { id: 'on_hold', title: 'On Hold', statuses: ['on_hold'], dot: 'bg-orange-500' },
    { id: 'completed', title: 'Completed', statuses: ['completed'], dot: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff Task Management</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Claim open pool assignments, track workloads, and manage team workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-surface-muted dark:bg-[#161616] p-1 rounded-full border border-surface-border dark:border-surface-dark-border select-none">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-full transition ${viewMode === 'board' ? 'bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white shadow-xs' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
              title="Kanban Board View"
            >
              <Kanban size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-full transition ${viewMode === 'list' ? 'bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white shadow-xs' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
              title="Table List View"
            >
              <List size={15} />
            </button>
          </div>

          <Button variant="default" size="sm" onClick={() => setCreateModalOpen(true)} className="flex items-center gap-1.5 text-xs font-bold shadow-xs">
            <Plus size={15} /> New Task
          </Button>
        </div>
      </header>

      {/* Unified Toolbar: Filter Pills & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div data-horizontal-scroll="true" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0 select-none">
          {filterTabs.map((tab) => {
            const isActive = filterStatus === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterStatus(tab.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs font-bold'
                    : 'bg-surface-muted/60 dark:bg-[#141414] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-3xs font-black ${
                  isActive
                    ? 'bg-white/20 dark:bg-black/20 text-inherit'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks or assignees..."
            className="input pl-8 pr-7 py-1.5 text-xs w-full"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        viewMode === 'board' ? <KanbanSkeleton columns={4} /> : <CardListSkeleton count={5} />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No Tasks Found"
          description={searchQuery || filterStatus !== 'all' ? 'No tasks match your selected filters.' : 'There are currently no tasks in the board.'}
          action={searchQuery || filterStatus !== 'all' ? {
            label: 'Clear Filters',
            onClick: () => { setFilterStatus('all'); setSearchQuery(''); }
          } : undefined}
        />
      ) : viewMode === 'board' ? (
        /* Board / Kanban View */
        <div className="overflow-x-auto pb-4" data-horizontal-scroll="true">
          <div className="flex gap-4 min-w-max items-start">
            {columns.map(col => {
              const colTasks = filteredTasks.filter(t => {
                if (col.unassignedOnly) return t.status === 'pending' && t.assigned_to === null;
                if (col.assignedOnly) return t.status === 'pending' && t.assigned_to !== null;
                return col.statuses.includes(t.status);
              });

              return (
                <div key={col.id} className="w-72 flex flex-col bg-surface-muted/30 dark:bg-[#121212]/50 rounded-card border border-surface-border dark:border-surface-dark-border">
                  <div className="p-3 border-b border-surface-border dark:border-surface-dark-border flex items-center justify-between">
                    <h3 className="font-semibold text-xs text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                      {col.title}
                    </h3>
                    <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-surface-muted dark:bg-[#161616] text-gray-500 border border-surface-border dark:border-surface-dark-border">
                      {colTasks.length}
                    </span>
                  </div>
                  
                  <div className="p-2.5 space-y-2.5 max-h-[68vh] overflow-y-auto">
                    {colTasks.length === 0 ? (
                      <p className="text-3xs text-gray-400 italic text-center py-6">No tasks in lane</p>
                    ) : (
                      colTasks.map(task => {
                        const pBadge = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.medium;
                        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

                        return (
                          <div 
                            key={task.id} 
                            onClick={() => setSelectedTask(task)}
                            className="card p-3 cursor-pointer hover:border-gray-900/20 dark:hover:border-white/20 transition group space-y-2 select-none shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-medium border capitalize ${pBadge.class}`}>
                                <span className={`w-1 h-1 rounded-full ${pBadge.dot}`} />
                                {pBadge.label}
                              </span>
                              {task.category_name && (
                                <span className="text-3xs text-gray-400 font-medium truncate max-w-[110px]">{task.category_name}</span>
                              )}
                            </div>
                            
                            <h4 className="font-bold text-gray-900 dark:text-white text-xs leading-snug group-hover:text-brand-500 transition-colors line-clamp-2">
                              {task.title}
                            </h4>
                            
                            <div className="flex items-center justify-between text-3xs text-gray-400 pt-1.5 border-t border-surface-border/40">
                              <div className="flex items-center gap-1 truncate">
                                <User size={11} />
                                <span className="truncate">{task.assigned_to_username ? `@${task.assigned_to_username}` : 'Open Pool'}</span>
                              </div>
                              {task.due_date && (
                                <div className={`flex items-center gap-1 font-mono ${isOverdue ? 'text-red-500 font-bold' : ''}`}>
                                  <Clock size={10} /> {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </div>
                              )}
                            </div>

                            {/* Quick Action Button for open pool */}
                            {!task.assigned_to && task.status === 'pending' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateTaskStatus(task.id, 'claim');
                                }}
                                disabled={updatingTaskId === task.id}
                                className="w-full mt-1 btn-primary py-1 px-2 text-3xs font-bold flex items-center justify-center gap-1 rounded-btn"
                              >
                                <UserCircle size={12} />
                                <span>{updatingTaskId === task.id ? 'Claiming...' : 'Claim Task'}</span>
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List View */
        <div className="space-y-2">
          {filteredTasks.map(task => {
            const pBadge = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.medium;
            const sBadge = STATUS_BADGES[task.status] || STATUS_BADGES.pending;
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className="card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:border-gray-900/20 dark:hover:border-white/20 transition group select-none shadow-2xs"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-medium border capitalize ${pBadge.class}`}>
                      <span className={`w-1 h-1 rounded-full ${pBadge.dot}`} />
                      {pBadge.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-medium border capitalize ${sBadge.class}`}>
                      <span className={`w-1 h-1 rounded-full ${sBadge.dot}`} />
                      {sBadge.label}
                    </span>
                    {task.category_name && (
                      <span className="text-3xs text-gray-400 font-medium truncate">({task.category_name})</span>
                    )}
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm group-hover:text-brand-500 transition-colors">
                    {task.title}
                  </h4>
                  <p className="text-2xs text-gray-500 dark:text-gray-400 line-clamp-1">{task.description}</p>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 shrink-0">
                  <span className="flex items-center gap-1 text-2xs">
                    <User size={12} /> {task.assigned_to_username ? `@${task.assigned_to_username}` : 'Open Pool'}
                  </span>
                  {task.due_date && (
                    <span className={`flex items-center gap-1 font-mono text-3xs ${isOverdue ? 'text-red-500 font-bold' : ''}`}>
                      <Calendar size={12} /> {new Date(task.due_date).toLocaleDateString()}
                    </span>
                  )}
                  <ChevronRight size={14} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setSelectedTask(null)}>
          <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex gap-2 mb-1.5">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border capitalize ${PRIORITY_BADGES[selectedTask.priority]?.class}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_BADGES[selectedTask.priority]?.dot}`} />
                    {PRIORITY_BADGES[selectedTask.priority]?.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border capitalize ${STATUS_BADGES[selectedTask.status]?.class}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_BADGES[selectedTask.status]?.dot}`} />
                    {STATUS_BADGES[selectedTask.status]?.label}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">{selectedTask.title}</h3>
              </div>
              <button onClick={() => setSelectedTask(null)} className="p-1 rounded-full text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            {/* Clean Metadata */}
            <div className="space-y-1.5 text-xs bg-surface-muted/30 dark:bg-[#141414] p-3 rounded-btn">
              <div className="flex justify-between">
                <span className="text-gray-500 font-normal">Category</span>
                <span className="font-medium text-gray-900 dark:text-gray-200">{selectedTask.category_name || 'General'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-normal">Assignee</span>
                <span className="font-medium text-gray-900 dark:text-gray-200">{selectedTask.assigned_to_username ? `@${selectedTask.assigned_to_username}` : 'Open Unassigned'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-normal">Due Date</span>
                <span className="font-medium text-gray-900 dark:text-gray-200 font-mono">
                  {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleString() : 'None specified'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="text-2xs font-bold uppercase tracking-wider text-gray-400">Description / Instructions</h4>
              <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {selectedTask.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-3 border-t border-surface-border/40">
              {selectedTask.status === 'pending' && !selectedTask.assigned_to && (
                <Button variant="default" size="sm" onClick={() => updateTaskStatus(selectedTask.id, 'claim')}>
                  <UserCircle size={14} /> Claim This Task
                </Button>
              )}
              {selectedTask.status === 'pending' && selectedTask.assigned_to && (
                <Button variant="default" size="sm" onClick={() => updateTaskStatus(selectedTask.id, 'start')}>
                  <Play size={14} /> Start Working
                </Button>
              )}
              {selectedTask.status === 'in_progress' && (
                <>
                  <Button variant="default" size="sm" onClick={() => updateTaskStatus(selectedTask.id, 'complete')}>
                    <CheckCircle2 size={14} /> Mark Complete
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => updateTaskStatus(selectedTask.id, 'hold')} className="text-orange-500">
                    <Clock size={14} /> Put on Hold
                  </Button>
                </>
              )}
              {selectedTask.status === 'on_hold' && (
                <Button variant="default" size="sm" onClick={() => updateTaskStatus(selectedTask.id, 'start')}>
                  <Play size={14} /> Resume Work
                </Button>
              )}
              {selectedTask.status !== 'completed' && selectedTask.status !== 'cancelled' && (
                <Button variant="danger" size="sm" onClick={() => updateTaskStatus(selectedTask.id, 'cancel')} className="ml-auto">
                  <XCircle size={14} /> Cancel Task
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setCreateModalOpen(false)}>
          <div className="card max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-surface-border dark:border-surface-dark-border">
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Create New Task</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5">
              <div>
                <label className="block text-2xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Task Title <span className="text-brand-500">*</span>
                </label>
                <input required name="title" className="input text-xs" placeholder="e.g. Verify seller business license" />
              </div>

              <div>
                <label className="block text-2xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Instructions & Details <span className="text-brand-500">*</span>
                </label>
                <textarea required name="description" rows={3} className="input text-xs h-24" placeholder="Detailed steps to complete this assignment..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Category</label>
                  <select name="category" className="input text-xs">
                    <option value="">Select Category...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Priority</label>
                  <select name="priority" defaultValue="medium" className="input text-xs">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Assignee</label>
                <select name="assigned_to" className="input text-xs">
                  <option value="">Leave Unassigned (Open Pool)</option>
                  {users.map(u => <option key={u.id} value={u.id}>@{u.username} ({u.first_name} {u.last_name})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-2xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Due Date</label>
                <input type="datetime-local" name="due_date" className="input text-xs" />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-surface-border dark:border-surface-dark-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setCreateModalOpen(false)} className="text-xs">
                  Cancel
                </Button>
                <Button type="submit" variant="default" size="sm" className="text-xs">
                  Create Task
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffTasks;
