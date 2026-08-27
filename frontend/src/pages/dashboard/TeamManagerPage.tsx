import React, { useEffect, useState, useMemo } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Users, Plus, Search, X, Eye, EyeOff } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';

interface UserDetails {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
}

interface TeamMember {
  id: number;
  owner: number;
  owner_username: string;
  user: number;
  user_details: UserDetails;
  permissions: Record<string, boolean>;
  role_preset: string;
  invitation_status: string;
  is_active: boolean;
  created_by_owner: boolean;
  contact_phone?: string;
  notes?: string;
  created_at: string;
}

interface AuditEntry {
  id: number;
  owner: number;
  target_user: number;
  target_username: string;
  performed_by: number | null;
  performed_by_username: string;
  action: string;
  detail: Record<string, any>;
  created_at: string;
}

const ROLE_PRESETS: Record<string, { label: string; description: string; permissions: Record<string, boolean> }> = {
  store_manager: {
    label: 'Store Manager',
    description: 'Full access to manage products, orders, messages, POS, invoices, and analytics.',
    permissions: { 
      manage_orders: true, manage_products: true, manage_messages: true, 
      manage_invoices: true, manage_payments: true, manage_logistics: true, 
      access_pos: true, view_analytics: true, manage_requests: true, 
      manage_payment_numbers: true, manage_billing: true 
    }
  },
  accountant: {
    label: 'Accountant / Finance',
    description: 'Verify customer payments, issue invoices, manage Lipa numbers, and review billing.',
    permissions: { 
      manage_orders: false, manage_products: false, manage_messages: false, 
      manage_invoices: true, manage_payments: true, manage_logistics: false, 
      access_pos: false, view_analytics: true, manage_requests: false, 
      manage_payment_numbers: true, manage_billing: true 
    }
  },
  orders_coordinator: {
    label: 'Orders Coordinator',
    description: 'Review and update incoming customer orders and packaging stages.',
    permissions: { 
      manage_orders: true, manage_products: false, manage_messages: false, 
      manage_invoices: true, manage_payments: false, manage_logistics: false, 
      access_pos: false, view_analytics: false, manage_requests: false, 
      manage_payment_numbers: false, manage_billing: false 
    }
  },
  logistics_coordinator: {
    label: 'Delivery & Logistics',
    description: 'Coordinate shipments, delivery zones, shipping rates, and parcel handovers.',
    permissions: { 
      manage_orders: true, manage_products: false, manage_messages: false, 
      manage_invoices: false, manage_payments: false, manage_logistics: true, 
      access_pos: false, view_analytics: false, manage_requests: false, 
      manage_payment_numbers: false, manage_billing: false 
    }
  },
  cashier_pos: {
    label: 'Cashier (POS)',
    description: 'Operate in-store Point of Sale register, barcode checkout, and receipt printing.',
    permissions: { 
      manage_orders: true, manage_products: false, manage_messages: false, 
      manage_invoices: false, manage_payments: false, manage_logistics: false, 
      access_pos: true, view_analytics: false, manage_requests: false, 
      manage_payment_numbers: false, manage_billing: false 
    }
  },
  support_staff: {
    label: 'Customer Support',
    description: 'Respond to buyer messages and handle customer product requests.',
    permissions: { 
      manage_orders: false, manage_products: false, manage_messages: true, 
      manage_invoices: false, manage_payments: false, manage_logistics: false, 
      access_pos: false, view_analytics: false, manage_requests: true, 
      manage_payment_numbers: false, manage_billing: false 
    }
  },
  inventory: {
    label: 'Inventory & Stock',
    description: 'Add new items, update stock levels, edit prices, and manage variants.',
    permissions: { 
      manage_orders: false, manage_products: true, manage_messages: false, 
      manage_invoices: false, manage_payments: false, manage_logistics: false, 
      access_pos: false, view_analytics: false, manage_requests: true, 
      manage_payment_numbers: false, manage_billing: false 
    }
  },
  custom: {
    label: 'Custom Access',
    description: 'Select specific permissions tailored to this team member.',
    permissions: {}
  }
};

const PERMISSION_OPTIONS = [
  { key: 'manage_orders', label: 'Incoming Orders', desc: 'View and update customer order status' },
  { key: 'manage_invoices', label: 'Invoices & Quotes', desc: 'Create, issue, and manage invoices' },
  { key: 'access_pos', label: 'Point of Sale (POS)', desc: 'Use in-store barcode checkout register' },
  { key: 'manage_payments', label: 'Payment Approvals', desc: 'Verify and approve customer payment proofs' },
  { key: 'manage_products', label: 'Products & Stock', desc: 'Add and edit products and inventory' },
  { key: 'manage_messages', label: 'Customer Messages', desc: 'Chat and reply to store buyers' },
  { key: 'manage_requests', label: 'Product Requests', desc: 'Review requested item submissions' },
  { key: 'manage_logistics', label: 'Delivery & Shipping', desc: 'Manage delivery zones and dispatches' },
  { key: 'manage_payment_numbers', label: 'Payment Numbers', desc: 'Set up store Lipa numbers' },
  { key: 'manage_billing', label: 'Billing & Ledger', desc: 'View store fees and platform billing' },
  { key: 'view_analytics', label: 'Sales Reports', desc: 'View store analytics and performance' },
];

export const TeamManagerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'members' | 'audit'>('members');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'direct' | 'invite'>('direct');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirmPassword, setFormConfirmPassword] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formRolePreset, setFormRolePreset] = useState('orders_coordinator');
  const [formPerms, setFormPerms] = useState<Record<string, boolean>>(ROLE_PRESETS.orders_coordinator.permissions);

  // Password Reset Modal
  const [resetModalMember, setResetModalMember] = useState<TeamMember | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  // Edit Permissions Modal
  const [editModalMember, setEditModalMember] = useState<TeamMember | null>(null);
  const [editRolePreset, setEditRolePreset] = useState('custom');
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Transfer Role Modal
  const [transferModalMember, setTransferModalMember] = useState<TeamMember | null>(null);
  const [targetUsername, setTargetUsername] = useState('');
  const [transferringRole, setTransferringRole] = useState(false);

  const fetchMembers = async () => {
    try {
      const res = await api.get('/api/team-members/');
      setMembers(res.data.results || res.data || []);
    } catch {
      toast.error('Could not load team members.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/api/team-members/audit-log/');
      setAuditLogs(res.data.results || res.data || []);
    } catch {
      // Non-critical
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchAuditLogs();
  }, []);

  const handleRolePresetChange = (preset: string) => {
    setFormRolePreset(preset);
    if (ROLE_PRESETS[preset]) {
      setFormPerms({ ...ROLE_PRESETS[preset].permissions });
    }
  };

  const handleToggleFormPerm = (key: string) => {
    setFormPerms(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    setFormRolePreset('custom');
  };

  const resetForm = () => {
    setFormUsername('');
    setFormPassword('');
    setFormConfirmPassword('');
    setFormFirstName('');
    setFormLastName('');
    setFormEmail('');
    setFormPhone('');
    setFormNotes('');
    setFormRolePreset('orders_coordinator');
    setFormPerms(ROLE_PRESETS.orders_coordinator.permissions);
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim()) {
      toast.error('Please enter a username.');
      return;
    }

    if (createMode === 'direct') {
      if (!formPassword) {
        toast.error('Please enter a password.');
        return;
      }
      if (formPassword !== formConfirmPassword) {
        toast.error('Passwords do not match.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await api.post('/api/team-members/', {
        username: formUsername.trim(),
        password: createMode === 'direct' ? formPassword : '',
        email: formEmail.trim(),
        first_name: formFirstName.trim(),
        last_name: formLastName.trim(),
        phone_number: formPhone.trim(),
        contact_phone: formPhone.trim(),
        notes: formNotes.trim(),
        role_preset: formRolePreset,
        permissions: formPerms,
        create_user: createMode === 'direct'
      });

      toast.success(createMode === 'direct' ? 'Team member added.' : 'Invitation sent.');
      setIsAddModalOpen(false);
      resetForm();
      fetchMembers();
      fetchAuditLogs();
    } catch (err: any) {
      const msg = err.response?.data?.username?.[0] || 
                  err.response?.data?.password?.[0] || 
                  err.response?.data?.email?.[0] || 
                  err.response?.data?.detail || 
                  err.response?.data?.non_field_errors?.[0] ||
                  'Could not add team member.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSuspend = async (member: TeamMember) => {
    try {
      const res = await api.post(`/api/team-members/${member.id}/toggle-suspend/`);
      toast.success(res.data.message || 'Status updated.');
      fetchMembers();
      fetchAuditLogs();
    } catch {
      toast.error('Could not update member status.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalMember) return;
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setResettingPassword(true);
    try {
      await api.post(`/api/team-members/${resetModalMember.id}/reset-password/`, {
        new_password: newPassword,
        confirm_password: confirmNewPassword
      });
      toast.success(`Password for @${resetModalMember.user_details.username} has been updated.`);
      setResetModalMember(null);
      setNewPassword('');
      setConfirmNewPassword('');
      fetchAuditLogs();
    } catch (err: any) {
      toast.error(err.response?.data?.new_password?.[0] || 'Could not reset password.');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editModalMember) return;
    setSavingEdit(true);
    try {
      await api.patch(`/api/team-members/${editModalMember.id}/`, {
        role_preset: editRolePreset,
        permissions: editPerms
      });
      toast.success('Permissions updated.');
      setEditModalMember(null);
      fetchMembers();
      fetchAuditLogs();
    } catch {
      toast.error('Could not update permissions.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleTransferRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModalMember || !targetUsername.trim()) return;
    setTransferringRole(true);
    try {
      const res = await api.post(`/api/team-members/${transferModalMember.id}/transfer-role/`, {
        target_username: targetUsername.trim()
      });
      toast.success(res.data.message || 'Role transferred.');
      setTransferModalMember(null);
      setTargetUsername('');
      fetchMembers();
      fetchAuditLogs();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.target_username?.[0] || 'Could not transfer role.');
    } finally {
      setTransferringRole(false);
    }
  };

  const handleRemoveMember = async (id: number, username: string) => {
    if (!confirm(`Are you sure you want to remove @${username} from your team?`)) return;
    try {
      await api.delete(`/api/team-members/${id}/`);
      toast.success(`Removed @${username}.`);
      fetchMembers();
      fetchAuditLogs();
    } catch {
      toast.error('Could not remove team member.');
    }
  };

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(m => 
      m.user_details.username.toLowerCase().includes(q) ||
      m.user_details.email?.toLowerCase().includes(q) ||
      m.user_details.first_name?.toLowerCase().includes(q) ||
      m.user_details.last_name?.toLowerCase().includes(q) ||
      m.role_preset?.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-950 dark:text-white">
            Team Members
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Add staff and assign what parts of your store they can manage.
          </p>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setIsAddModalOpen(true);
          }}
          size="sm"
          className="self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Member
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-surface-border dark:border-surface-dark-border text-sm">
        <button
          onClick={() => setActiveTab('members')}
          className={`pb-3 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'members'
              ? 'border-brand-500 text-brand-500 dark:text-brand-400 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
          }`}
        >
          Members ({members.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'audit'
              ? 'border-brand-500 text-brand-500 dark:text-brand-400 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
          }`}
        >
          Activity Log ({auditLogs.length})
        </button>
      </div>

      {/* Tab: Members List */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          
          {members.length > 0 && (
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search members..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-brand-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {filteredMembers.length === 0 ? (
            <EmptyState
              icon={Users}
              title={members.length === 0 ? "No team members yet" : "No matching members"}
              description={members.length === 0 ? "Invite employees or create staff accounts to help manage orders, deliveries, or payments." : "Try adjusting your search query."}
              action={members.length === 0 ? {
                label: "Add Member",
                onClick: () => {
                  resetForm();
                  setIsAddModalOpen(true);
                }
              } : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMembers.map((member) => {
                const role = ROLE_PRESETS[member.role_preset] || {
                  label: member.role_preset.replace('_', ' '),
                  description: ''
                };
                const displayName = [member.user_details.first_name, member.user_details.last_name].filter(Boolean).join(' ') || member.user_details.username;
                const grantedPerms = Object.entries(member.permissions)
                  .filter(([, v]) => v)
                  .map(([k]) => {
                    const opt = PERMISSION_OPTIONS.find(p => p.key === k);
                    return opt ? opt.label : k;
                  });

                return (
                  <div
                    key={member.id}
                    className={`bg-white dark:bg-[#0A0A0A] border rounded-xl p-4 flex flex-col justify-between gap-4 transition-colors ${
                      member.is_active
                        ? 'border-surface-border dark:border-surface-dark-border'
                        : 'border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10'
                    }`}
                  >
                    <div className="space-y-3">
                      
                      {/* Top Info */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand-500/10 text-brand-500 font-semibold flex items-center justify-center text-sm shrink-0">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                                {displayName}
                              </h3>
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400">
                                {role.label}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              @{member.user_details.username}
                              {member.user_details.email && ` • ${member.user_details.email}`}
                            </p>
                          </div>
                        </div>

                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          member.is_active
                            ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                            : 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30'
                        }`}>
                          {member.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </div>

                      {/* Capabilities */}
                      {grantedPerms.length > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-1.5 pt-1">
                          {grantedPerms.map((perm, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-900 text-gray-700 dark:text-gray-300 text-[11px]"
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                      )}

                      {member.notes && (
                        <p className="text-xs text-gray-500 italic bg-gray-50 dark:bg-neutral-900/50 p-2 rounded">
                          "{member.notes}"
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-surface-border dark:border-surface-dark-border text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleSuspend(member)}
                          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium"
                        >
                          {member.is_active ? 'Suspend' : 'Reactivate'}
                        </button>
                        <span className="text-gray-300 dark:text-gray-700">•</span>
                        <button
                          onClick={() => {
                            setResetModalMember(member);
                            setNewPassword('');
                            setConfirmNewPassword('');
                          }}
                          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium"
                        >
                          Reset password
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setEditModalMember(member);
                            setEditRolePreset(member.role_preset || 'custom');
                            setEditPerms({ ...member.permissions });
                          }}
                          className="text-gray-600 dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setTransferModalMember(member);
                            setTargetUsername('');
                          }}
                          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium"
                          title="Transfer role to another user"
                        >
                          Transfer
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.id, member.user_details.username)}
                          className="text-red-500 hover:text-red-600 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Activity Log */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border rounded-xl overflow-hidden">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No team activity recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-border dark:border-surface-dark-border text-gray-500 bg-gray-50 dark:bg-neutral-900/50">
                    <th className="p-3 font-medium">Date & Time</th>
                    <th className="p-3 font-medium">Action</th>
                    <th className="p-3 font-medium">Team Member</th>
                    <th className="p-3 font-medium">Performed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border dark:divide-surface-dark-border">
                  {auditLogs.map((entry) => (
                    <tr key={entry.id} className="text-gray-700 dark:text-gray-300">
                      <td className="p-3 text-gray-500 whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 dark:bg-neutral-900">
                          {entry.action.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        @{entry.target_username}
                      </td>
                      <td className="p-3 text-gray-500 whitespace-nowrap">
                        @{entry.performed_by_username || 'System'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Add Team Member */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border rounded-2xl w-full max-w-lg p-6 space-y-5 my-8 shadow-xl">
            
            <div className="flex items-center justify-between border-b border-surface-border dark:border-surface-dark-border pb-3">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Add Team Member
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Create a new staff login or invite an existing account.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode switch */}
            <div className="flex rounded-lg bg-gray-100 dark:bg-neutral-900 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setCreateMode('direct')}
                className={`flex-1 py-1.5 rounded-md transition-colors ${
                  createMode === 'direct'
                    ? 'bg-white dark:bg-[#111] text-gray-900 dark:text-white shadow-sm font-semibold'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Create new account
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('invite')}
                className={`flex-1 py-1.5 rounded-md transition-colors ${
                  createMode === 'invite'
                    ? 'bg-white dark:bg-[#111] text-gray-900 dark:text-white shadow-sm font-semibold'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Invite existing user
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="space-y-4 text-xs">
              
              {/* Username & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. juma_orders"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#111] border border-surface-border dark:border-surface-dark-border rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-brand-500"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    placeholder="juma@example.com"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#111] border border-surface-border dark:border-surface-dark-border rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-brand-500"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password for direct mode */}
              {createMode === 'direct' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        className="w-full px-3 py-2 pr-8 text-xs bg-white dark:bg-[#111] border border-surface-border dark:border-surface-dark-border rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-brand-500"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                      Confirm password *
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#111] border border-surface-border dark:border-surface-dark-border rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-brand-500"
                      value={formConfirmPassword}
                      onChange={(e) => setFormConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                    First name
                  </label>
                  <input
                    type="text"
                    placeholder="Juma"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#111] border border-surface-border dark:border-surface-dark-border rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-brand-500"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                    Last name
                  </label>
                  <input
                    type="text"
                    placeholder="Mussa"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#111] border border-surface-border dark:border-surface-dark-border rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-brand-500"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                  />
                </div>
              </div>

              {/* Role Preset */}
              <div className="space-y-1">
                <label className="block text-gray-700 dark:text-gray-300 font-medium">
                  Role
                </label>
                <select
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#111] border border-surface-border dark:border-surface-dark-border rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-brand-500"
                  value={formRolePreset}
                  onChange={(e) => handleRolePresetChange(e.target.value)}
                >
                  {Object.entries(ROLE_PRESETS).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.label}
                    </option>
                  ))}
                </select>
                {ROLE_PRESETS[formRolePreset]?.description && (
                  <p className="text-[11px] text-gray-500 pt-0.5">
                    {ROLE_PRESETS[formRolePreset].description}
                  </p>
                )}
              </div>

              {/* Permissions Checklist */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-gray-700 dark:text-gray-300 font-medium">
                  Access & Permissions
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto p-2 bg-gray-50 dark:bg-neutral-900/50 rounded-lg border border-surface-border dark:border-surface-dark-border">
                  {PERMISSION_OPTIONS.map((p) => (
                    <label key={p.key} className="flex items-start gap-2.5 cursor-pointer py-1 select-none">
                      <input
                        type="checkbox"
                        checked={!!formPerms[p.key]}
                        onChange={() => handleToggleFormPerm(p.key)}
                        className="mt-0.5 rounded text-brand-500 focus:ring-brand-500"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-xs">{p.label}</div>
                        <div className="text-[11px] text-gray-500">{p.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border dark:border-surface-dark-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : (createMode === 'direct' ? 'Create Member' : 'Send Invite')}
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {resetModalMember && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-surface-border dark:border-surface-dark-border pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Reset Password (@{resetModalMember.user_details.username})
              </h3>
              <button onClick={() => setResetModalMember(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                  New password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#111] border border-surface-border dark:border-surface-dark-border rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-brand-500"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                  Confirm new password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#111] border border-surface-border dark:border-surface-dark-border rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-brand-500"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setResetModalMember(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default" size="sm" disabled={resettingPassword}>
                  {resettingPassword ? 'Saving...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Permissions */}
      {editModalMember && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-surface-border dark:border-surface-dark-border pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Edit Access (@{editModalMember.user_details.username})
              </h3>
              <button onClick={() => setEditModalMember(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                  Role
                </label>
                <select
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#111] border border-surface-border dark:border-surface-dark-border rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-brand-500"
                  value={editRolePreset}
                  onChange={(e) => {
                    const preset = e.target.value;
                    setEditRolePreset(preset);
                    if (ROLE_PRESETS[preset]) {
                      setEditPerms({ ...ROLE_PRESETS[preset].permissions });
                    }
                  }}
                >
                  {Object.entries(ROLE_PRESETS).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-gray-700 dark:text-gray-300 font-medium">
                  Permissions
                </label>
                <div className="space-y-1.5 max-h-56 overflow-y-auto p-2 bg-gray-50 dark:bg-neutral-900/50 rounded-lg border border-surface-border dark:border-surface-dark-border">
                  {PERMISSION_OPTIONS.map((p) => (
                    <label key={p.key} className="flex items-start gap-2.5 cursor-pointer py-1 select-none">
                      <input
                        type="checkbox"
                        checked={!!editPerms[p.key]}
                        onChange={() => {
                          setEditPerms(prev => ({
                            ...prev,
                            [p.key]: !prev[p.key]
                          }));
                          setEditRolePreset('custom');
                        }}
                        className="mt-0.5 rounded text-brand-500 focus:ring-brand-500"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-xs">{p.label}</div>
                        <div className="text-[11px] text-gray-500">{p.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border dark:border-surface-dark-border">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditModalMember(null)}>
                  Cancel
                </Button>
                <Button type="button" variant="default" size="sm" disabled={savingEdit} onClick={handleSaveEdit}>
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Transfer Role */}
      {transferModalMember && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-surface-border dark:border-surface-dark-border pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Transfer Role (@{transferModalMember.user_details.username})
              </h3>
              <button onClick={() => setTransferModalMember(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTransferRole} className="space-y-3 text-xs">
              <p className="text-gray-600 dark:text-gray-400">
                Transfer this role and its permissions to another registered user.
              </p>

              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                  Recipient username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. new_employee"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#111] border border-surface-border dark:border-surface-dark-border rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-brand-500"
                  value={targetUsername}
                  onChange={(e) => setTargetUsername(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setTransferModalMember(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default" size="sm" disabled={transferringRole}>
                  {transferringRole ? 'Transferring...' : 'Transfer Role'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeamManagerPage;
