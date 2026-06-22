import React, { useEffect, useState } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { UserPlus, Trash2, Edit, Save, CheckSquare, Square, Users } from 'lucide-react';

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
    [key: string]: boolean | undefined;
  };
  created_at: string;
}

export const TeamManagerPage: React.FC = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  
  // Invite permissions state
  const [invitePerms, setInvitePerms] = useState({
    manage_orders: true,
    manage_products: true
  });

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPerms, setEditPerms] = useState({
    manage_orders: false,
    manage_products: false
  });

  const fetchMembers = async () => {
    try {
      const res = await api.get('/api/team-members/');
      setMembers(res.data.results || res.data); // handles pagination vs direct list
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
        permissions: invitePerms
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
    } catch (err: any) {
      toast.error("Failed to remove team member.");
    }
  };

  const startEdit = (member: TeamMember) => {
    setEditingId(member.id);
    setEditPerms({
      manage_orders: !!member.permissions.manage_orders,
      manage_products: !!member.permissions.manage_products
    });
  };

  const handleSaveEdit = async (id: number) => {
    try {
      await api.patch(`/api/team-members/${id}/`, {
        permissions: editPerms
      });
      toast.success("Permissions updated successfully!");
      setEditingId(null);
      fetchMembers();
    } catch (err: any) {
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
        
        <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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

          {/* Permissions selectors */}
          <div className="flex items-center space-x-6 h-11">
            <button
              type="button"
              onClick={() => setInvitePerms(p => ({ ...p, manage_orders: !p.manage_orders }))}
              className="flex items-center gap-2 text-xs font-bold text-gray-300 hover:text-white"
            >
              {invitePerms.manage_orders ? <CheckSquare size={16} className="text-amber-500" /> : <Square size={16} />}
              Manage Orders
            </button>
            <button
              type="button"
              onClick={() => setInvitePerms(p => ({ ...p, manage_products: !p.manage_products }))}
              className="flex items-center gap-2 text-xs font-bold text-gray-300 hover:text-white"
            >
              {invitePerms.manage_products ? <CheckSquare size={16} className="text-amber-500" /> : <Square size={16} />}
              Manage Products
            </button>
          </div>

          <button
            type="submit"
            disabled={inviting}
            className="btn-primary py-2.5 w-full font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2"
          >
            {inviting ? 'Adding...' : 'Add Member'}
          </button>
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
                  <p className="font-bold text-gray-200 text-sm">
                    {member.user_details.first_name || member.user_details.last_name 
                      ? `${member.user_details.first_name} ${member.user_details.last_name}`.trim()
                      : member.user_details.username}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">
                    @{member.user_details.username} &bull; {member.user_details.email}
                  </p>
                </div>

                {/* Permissions display & editor */}
                <div className="flex items-center gap-6">
                  {editingId === member.id ? (
                    <div className="flex items-center gap-4 bg-black border border-gray-850 p-2 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setEditPerms(p => ({ ...p, manage_orders: !p.manage_orders }))}
                        className="flex items-center gap-2 text-xs font-bold text-gray-300 hover:text-white"
                      >
                        {editPerms.manage_orders ? <CheckSquare size={14} className="text-amber-500" /> : <Square size={14} />}
                        Orders
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditPerms(p => ({ ...p, manage_products: !p.manage_products }))}
                        className="flex items-center gap-2 text-xs font-bold text-gray-300 hover:text-white"
                      >
                        {editPerms.manage_products ? <CheckSquare size={14} className="text-amber-500" /> : <Square size={14} />}
                        Products
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        member.permissions.manage_orders ? 'bg-green-950/30 text-green-400 border border-green-900/50' : 'bg-gray-950 text-gray-600'
                      }`}>
                        Orders
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        member.permissions.manage_products ? 'bg-green-950/30 text-green-400 border border-green-900/50' : 'bg-gray-950 text-gray-600'
                      }`}>
                        Products
                      </span>
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
