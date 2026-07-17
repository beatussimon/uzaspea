import React, { useEffect, useState } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { UserPlus, Trash2, Edit, Save, Shield, Users } from 'lucide-react';

interface UserDetails {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface TeamMember {
  id: number;
  owner: number;
  owner_username: string;
  user: number;
  user_details: UserDetails;
  permissions: {
    manage_orders?: boolean;
    manage_products?: boolean;
    manage_messages?: boolean;
    view_analytics?: boolean;
    [key: string]: boolean | undefined;
  };
  role_preset: string;
  created_at: string;
}

const ROLE_PRESETS: Record<string, { label: string; description: string; permissions: Record<string, boolean>; tasks: string[] }> = {
  store_manager: {
    label: 'Store Manager',
    description: 'Full administrative control over store products, orders, communications, and business performance tracking.',
    permissions: { manage_orders: true, manage_products: true, manage_messages: true, view_analytics: true },
    tasks: ['Monitor and process customer orders', 'Update product catalog and inventory', 'Communicate with customers via messages', 'Analyze sales and customer metrics']
  },
  inventory: {
    label: 'Inventory Staff',
    description: 'Responsible for managing catalog items, stock levels, and product descriptions.',
    permissions: { manage_orders: false, manage_products: true, manage_messages: false, view_analytics: false },
    tasks: ['Create and edit product listings', 'Update inventory counts and pricing', 'Manage product categories']
  },
  support_staff: {
    label: 'Support Staff',
    description: 'Handles client questions, support requests, and processes incoming orders.',
    permissions: { manage_orders: true, manage_products: false, manage_messages: true, view_analytics: false },
    tasks: ['Respond to client messages and queries', 'Manage and fulfill customer orders', 'Track customer shipment requests']
  },
  bookkeeper: {
    label: 'Bookkeeper',
    description: 'Monitors revenue, processes billing information, and checks overall store sales statistics.',
    permissions: { manage_orders: false, manage_products: false, manage_messages: false, view_analytics: true },
    tasks: ['Generate revenue and billing reports', 'Verify store subscription status', 'Review dashboard transaction logs']
  },
  cashier: {
    label: 'Cashier',
    description: 'Focuses on confirming order statuses and verifying payments.',
    permissions: { manage_orders: true, manage_products: false, manage_messages: false, view_analytics: false },
    tasks: ['Review pending order transactions', 'Update order status to paid / processing']
  },
  sales_representative: {
    label: 'Sales Representative',
    description: 'Responsible for client engagement, catalog optimization, and sales processing.',
    permissions: { manage_orders: true, manage_products: true, manage_messages: true, view_analytics: false },
    tasks: ['Consult clients on product specifications', 'Assist customers through checkout processes', 'Maintain product details']
  },
  marketing_specialist: {
    label: 'Marketing Specialist',
    description: 'Develops campaigns, launches promos, and tracks engagement metrics.',
    permissions: { manage_orders: false, manage_products: true, manage_messages: true, view_analytics: true },
    tasks: ['Create discount vouchers and promo codes', 'Manage product showcase listings', 'Analyze marketing campaign effectiveness']
  },
  logistics_coordinator: {
    label: 'Logistics Coordinator',
    description: 'Handles warehouse allocations, inventory movement, and dispatch coordination.',
    permissions: { manage_orders: true, manage_products: true, manage_messages: false, view_analytics: true },
    tasks: ['Coordinate shipment fulfillment times', 'Liaise with local warehousing team members', 'Inspect product quality checks']
  },
};

export const TeamManagerPage: React.FC = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  
  // Invite role state
  const [inviteRolePreset, setInviteRolePreset] = useState('store_manager');
  const [invitePerms, setInvitePerms] = useState(ROLE_PRESETS.store_manager.permissions);

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRolePreset, setEditRolePreset] = useState('store_manager');
  const [editPerms, setEditPerms] = useState(ROLE_PRESETS.store_manager.permissions);

  const fetchMembers = async () => {
    try {
      const res = await api.get('/api/team-members/');
      setMembers(res.data.results || res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to load team members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;

    setInviting(true);
    try {
      await api.post('/api/team-members/', {
        username: inviteUsername.trim(),
        permissions: invitePerms,
        role_preset: inviteRolePreset
      });
      toast.success("Team member added successfully!");
      setInviteUsername('');
      fetchMembers();
    } catch (err: any) {
      const msg = err.response?.data?.non_field_errors?.[0] || 
                  err.response?.data?.username?.[0] || 
                  err.response?.data?.detail || 
                  "Failed to add team member.";
      toast.error(msg);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Are you sure you want to remove this team member?")) return;

    try {
      await api.delete(`/api/team-members/${id}/`);
      toast.success("Team member removed.");
      fetchMembers();
    } catch {
      toast.error("Failed to remove team member.");
    }
  };

  const startEdit = (member: TeamMember) => {
    setEditingId(member.id);
    const preset = member.role_preset || 'store_manager';
    setEditRolePreset(preset);
    setEditPerms(ROLE_PRESETS[preset]?.permissions || member.permissions);
  };

  const handleSaveEdit = async (id: number) => {
    try {
      await api.patch(`/api/team-members/${id}/`, {
        permissions: editPerms,
        role_preset: editRolePreset
      });
      toast.success("Permissions updated successfully!");
      setEditingId(null);
      fetchMembers();
    } catch {
      toast.error("Failed to update permissions.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-black text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Users className="text-amber-500" size={22} />
            Business Team Management
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Invite and manage scoped access permissions for your business associates
          </p>
        </div>
      </div>

      {/* Invite Section */}
      <div className="card p-6 bg-[#0a0a0a] border border-gray-800 rounded-xl space-y-4">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <UserPlus size={16} className="text-amber-500" />
          Add New Team Member
        </h3>
        
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  User Username
                </label>
                <input
                  type="text"
                  required
                  className="input bg-black border-gray-800 text-white placeholder-gray-600 focus:border-amber-500"
                  placeholder="e.g. janesmith"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Select Team Role
                </label>
                <select
                  required
                  className="input bg-black border-gray-800 text-white focus:border-amber-500"
                  value={inviteRolePreset}
                  onChange={(e) => {
                    const preset = e.target.value;
                    setInviteRolePreset(preset);
                    setInvitePerms(ROLE_PRESETS[preset].permissions);
                  }}
                >
                  {Object.entries(ROLE_PRESETS).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Preset Details */}
            <div className="md:col-span-2 bg-[#121212] border border-gray-900 rounded-xl p-4 text-xs space-y-3 mt-1">
              <div>
                <p className="font-bold text-amber-500 uppercase tracking-widest text-[10px] flex items-center gap-1.5">
                  <Shield size={12} />
                  Role Details & Scoped Tasks
                </p>
                <p className="text-gray-300 font-medium mt-1">
                  {ROLE_PRESETS[inviteRolePreset].description}
                </p>
              </div>
              <div className="pt-2.5 border-t border-gray-950 flex flex-wrap gap-2">
                {ROLE_PRESETS[inviteRolePreset].tasks.map((task, idx) => (
                  <span key={idx} className="bg-gray-950 text-gray-400 px-2.5 py-1 rounded-md font-medium border border-gray-900">
                    &bull; {task}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-gray-900 pt-3">
            <button
              type="submit"
              disabled={inviting}
              className="btn-primary py-2.5 px-8 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2"
            >
              {inviting ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>

      {/* Members List */}
      <div className="card bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 bg-black border-b border-gray-900">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Active Members
          </h3>
        </div>

        {members.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No team members added yet. Invite someone using their username above.
          </div>
        ) : (
          <div className="divide-y divide-gray-900">
            {members.map((member) => (
              <div key={member.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-gray-950/20 transition">
                <div className="space-y-1">
                  <p className="font-bold text-gray-200 text-sm flex items-center gap-2">
                    {member.user_details.first_name || member.user_details.last_name 
                      ? `${member.user_details.first_name} ${member.user_details.last_name}`.trim()
                      : member.user_details.username}
                    <span className="text-[9px] font-black uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded tracking-widest">
                      {ROLE_PRESETS[member.role_preset]?.label || 'Custom'}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 font-mono">
                    @{member.user_details.username} &bull; {member.user_details.email}
                  </p>
                </div>

                {/* Permissions display & editor */}
                <div className="flex items-center gap-6">
                  {editingId === member.id ? (
                    <div className="flex items-center gap-3">
                      <select
                        className="input bg-black border-gray-850 text-white py-1 text-xs focus:border-amber-500"
                        value={editRolePreset}
                        onChange={(e) => {
                          const preset = e.target.value;
                          setEditRolePreset(preset);
                          setEditPerms(ROLE_PRESETS[preset].permissions);
                        }}
                      >
                        {Object.entries(ROLE_PRESETS).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {Object.entries(member.permissions).map(([name, val]) => (
                        <span key={name} className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          val ? 'bg-green-950/30 text-green-400 border border-green-900/50' : 'bg-gray-950 text-gray-600'
                        }`}>
                          {name.replace('manage_', '').replace('view_', '')}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {editingId === member.id ? (
                      <button
                        onClick={() => handleSaveEdit(member.id)}
                        className="p-2 text-green-500 hover:bg-green-950/30 rounded-lg transition"
                        title="Save Permissions"
                      >
                        <Save size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => startEdit(member)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-900 rounded-lg transition"
                        title="Edit Permissions"
                      >
                        <Edit size={16} />
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleRemove(member.id)}
                      className="p-2 text-red-500 hover:bg-red-950/30 rounded-lg transition"
                      title="Remove Member"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default TeamManagerPage;
