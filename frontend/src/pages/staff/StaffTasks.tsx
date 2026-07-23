import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus,  CheckCircle2, Clock, 
   Play, XCircle,  UserCircle 
} from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';

interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: number | null;
  assigned_to_username?: string;
  category: number;
  category_name?: string;
}

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
}

interface Category {
  id: number;
  name: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

const StaffTasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const [taskRes, userRes, catRes] = await Promise.all([
        api.get('/api/staff/tasks/?limit=100'),
        api.get('/api/staff/tasks/assignable_users/').catch(() => ({ data: [] })),
        api.get('/api/staff/task-categories/').catch(() => ({ data: { results: [] } }))
      ]);
      
      const tasksData = taskRes.data.results || taskRes.data;
      setTasks(tasksData);
      setUsers(userRes.data || []);
      setCategories(catRes.data.results || catRes.data || []);
    } catch (error) {
      toast.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const updateTaskStatus = async (taskId: number, actionUrl: string) => {
    try {
      await api.post(`/api/staff/tasks/${taskId}/${actionUrl}/`);
      toast.success(`Task status updated`);
      fetchTasks();
      setSelectedTask(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update task');
    }
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    // Convert empty strings to null for optional fields
    if (!data.assigned_to) delete data.assigned_to;
    if (!data.due_date) delete data.due_date;

    try {
      await api.post('/api/staff/tasks/', data);
      toast.success('Task created successfully');
      setCreateModalOpen(false);
      fetchTasks();
    } catch (err: any) {
      toast.error('Failed to create task');
    }
  };

  const columns = [
    { id: 'unassigned', title: 'Open Pool', statuses: ['pending'], unassigned: true },
    { id: 'pending', title: 'Pending', statuses: ['pending'], unassigned: false },
    { id: 'in_progress', title: 'In Progress', statuses: ['in_progress'], unassigned: false },
    { id: 'on_hold', title: 'On Hold', statuses: ['on_hold'], unassigned: false },
    { id: 'completed', title: 'Completed', statuses: ['completed'], unassigned: false },
  ];

  const getTasksForColumn = (col: any) => {
    return tasks.filter(t => {
      if (!col.statuses.includes(t.status)) return false;
      if (col.unassigned) return t.assigned_to === null;
      return t.assigned_to !== null;
    });
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div></div>;
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Task Board</h2>
          <p className="text-sm text-gray-500">Manage and track staff assignments</p>
        </div>
        <button 
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg transition shadow-sm"
        >
          <Plus size={18} /> New Task
        </button>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max h-full">
          {columns.map(col => {
            const colTasks = getTasksForColumn(col);
            return (
              <div key={col.id} className="w-80 flex flex-col bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 shadow-sm dark:border-gray-800">
                <div className="p-3 border-b border-gray-200 shadow-sm dark:border-gray-800 flex items-center justify-between">
                  <h3 className="font-bold text-gray-700 dark:text-gray-300">{col.title}</h3>
                  <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs py-0.5 px-2 rounded-full font-bold">
                    {colTasks.length}
                  </span>
                </div>
                
                <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                  {colTasks.map(task => (
                    <div 
                      key={task.id} 
                      onClick={() => setSelectedTask(task)}
                      className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 shadow-sm dark:border-gray-700 cursor-pointer hover:border-brand-300 dark:hover:border-brand-700 transition group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${PRIORITY_COLORS[task.priority]}`}>
                          {task.priority}
                        </span>
                        {task.category_name && (
                          <span className="text-xs text-gray-400 font-medium truncate max-w-[100px]">{task.category_name}</span>
                        )}
                      </div>
                      
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2 group-hover:text-brand-600 transition">
                        {task.title}
                      </h4>
                      
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          {task.assigned_to ? (
                            <><UserCircle size={14} /> {task.assigned_to_username || `User #${task.assigned_to}`}</>
                          ) : (
                            <span className="italic text-gray-400">Unassigned</span>
                          )}
                        </div>
                        {task.due_date && (
                          <div className={`flex items-center gap-1 text-xs ${new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                            <Clock size={12} /> {new Date(task.due_date).toLocaleDateString()}
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

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200 shadow-sm dark:border-gray-700">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedTask.title}</h3>
                <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-600">
                  <XCircle size={24} />
                </button>
              </div>
              
              <div className="flex gap-2 mb-6">
                <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider ${PRIORITY_COLORS[selectedTask.priority]}`}>
                  {selectedTask.priority}
                </span>
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                  {selectedTask.status.replace('_', ' ')}
                </span>
              </div>

              <div className="prose dark:prose-invert text-sm max-w-none mb-6 whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                {selectedTask.description}
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Assignee:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{selectedTask.assigned_to_username || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Due Date:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : 'None'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 shadow-sm dark:border-gray-700">
                {selectedTask.status === 'pending' && !selectedTask.assigned_to && (
                  <button onClick={() => updateTaskStatus(selectedTask.id, 'claim')} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700">
                    <UserCircle size={16} /> Claim Task
                  </button>
                )}
                {selectedTask.status === 'pending' && selectedTask.assigned_to && (
                  <button onClick={() => updateTaskStatus(selectedTask.id, 'start')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">
                    <Play size={16} /> Start Working
                  </button>
                )}
                {selectedTask.status === 'in_progress' && (
                  <>
                    <button onClick={() => updateTaskStatus(selectedTask.id, 'complete')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700">
                      <CheckCircle2 size={16} /> Mark Complete
                    </button>
                    <button onClick={() => updateTaskStatus(selectedTask.id, 'hold')} className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-bold hover:bg-orange-200">
                      <Clock size={16} /> Put on Hold
                    </button>
                  </>
                )}
                {selectedTask.status !== 'completed' && selectedTask.status !== 'cancelled' && (
                  <button onClick={() => updateTaskStatus(selectedTask.id, 'cancel')} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 ml-auto">
                    <XCircle size={16} /> Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-200 shadow-sm dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 shadow-sm dark:border-gray-700 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Create New Task</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle size={20}/></button>
            </div>
            <form onSubmit={handleCreateTask} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Title <span className="text-brand-500">*</span></label>
                <input required name="title" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none" placeholder="Task title..." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description <span className="text-brand-500">*</span></label>
                <textarea required name="description" rows={3} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none" placeholder="Provide detailed instructions..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Category</label>
                  <select name="category" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none">
                    <option value="">Select Category...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Priority</label>
                  <select name="priority" defaultValue="medium" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Assign To</label>
                <select name="assigned_to" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none">
                  <option value="">Leave unassigned (Open Pool)</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.first_name} {u.last_name})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Due Date</label>
                <input type="datetime-local" name="due_date" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none" />
              </div>
              <div className="pt-6 flex justify-end gap-3 mt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="px-5 py-2.5 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-md shadow-brand-500/20 transition-all">Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffTasks;
