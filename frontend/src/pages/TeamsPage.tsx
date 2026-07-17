import React, { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Shield, UserPlus, CheckCircle, XCircle, ArrowRight } from 'lucide-react';

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
  permissions: Record<string, boolean>;
  role_preset: string;
  invitation_status: string;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  store_manager: 'Store Manager',
  inventory: 'Inventory Staff',
  support_staff: 'Support Staff',
  bookkeeper: 'Bookkeeper',
  cashier: 'Cashier',
  sales_representative: 'Sales Representative',
  marketing_specialist: 'Marketing Specialist',
  logistics_coordinator: 'Logistics Coordinator',
};

export const TeamsPage: React.FC = () => {
  const [memberships, setMemberships] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<number | null>(null);

  const fetchMemberships = async () => {
    try {
      const res = await api.get('/api/team-members/');
      setMemberships(res.data.results || res.data || []);
    } catch {
      toast.error('Failed to load team invitations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemberships();
  }, []);

  const handleAccept = async (id: number) => {
    setActioning(id);
    try {
      await api.post(`/api/team-members/${id}/accept/`);
      toast.success('Invitation accepted successfully!');
      // Force reload page / tokens so tier change is updated
      window.location.reload();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to accept invitation.');
    } finally {
      setActioning(null);
    }
  };

  const handleDecline = async (id: number) => {
    if (!confirm('Are you sure you want to decline this invitation?')) return;
    setActioning(id);
    try {
      await api.post(`/api/team-members/${id}/decline/`);
      toast.success('Invitation declined.');
      fetchMemberships();
    } catch {
      toast.error('Failed to decline invitation.');
    } finally {
      setActioning(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-black text-white min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  const pending = memberships.filter(m => m.invitation_status === 'pending');
  const accepted = memberships.filter(m => m.invitation_status === 'accepted');

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="border-b border-gray-800 pb-4">
        <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
          <Shield className="text-amber-500" size={26} />
          Business Teams
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Review your business team invitations and active memberships
        </p>
      </div>

      {/* Pending Invitations Section */}
      {pending.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <UserPlus size={16} className="text-amber-500" />
            Pending Invitations ({pending.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map((inv) => (
              <div key={inv.id} className="card p-6 bg-[#0a0a0a] border border-gray-800 rounded-2xl flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white text-base">@{inv.owner_username}</h4>
                      <p className="text-xs text-gray-500">Business Team Owner</p>
                    </div>
                    <span className="text-[10px] font-black uppercase bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20">
                      {ROLE_LABELS[inv.role_preset] || 'Worker'}
                    </span>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-900 space-y-2">
                    <p className="text-xs text-gray-400">Permissions to be granted:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(inv.permissions).map(([name, val]) => (
                        <span key={name} className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${val ? 'bg-green-950/40 text-green-400 border border-green-900/50' : 'bg-gray-950 text-gray-600 border border-gray-900'}`}>
                          {name.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-gray-900 pt-3 mt-2">
                  <button
                    disabled={actioning !== null}
                    onClick={() => handleAccept(inv.id)}
                    className="flex-1 btn-primary py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle size={14} />
                    {actioning === inv.id ? 'Processing...' : 'Accept'}
                  </button>
                  <button
                    disabled={actioning !== null}
                    onClick={() => handleDecline(inv.id)}
                    className="flex-1 btn-ghost py-2.5 border-red-950 text-red-500 hover:bg-red-950/20 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    <XCircle size={14} />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Memberships Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Active Team Memberships
        </h3>
        {accepted.length === 0 ? (
          <div className="card p-8 text-center text-gray-500 border border-gray-800 bg-[#0a0a0a] rounded-2xl">
            You do not belong to any active business teams as a worker.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accepted.map((mem) => (
              <div key={mem.id} className="card p-6 bg-[#0a0a0a] border border-gray-800 rounded-2xl flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white text-base">@{mem.owner_username}</h4>
                      <p className="text-xs text-gray-500">Business Team Owner</p>
                    </div>
                    <span className="text-[10px] font-black uppercase bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20">
                      {ROLE_LABELS[mem.role_preset] || 'Worker'}
                    </span>
                  </div>
                  
                  <p className="text-xs text-gray-400 leading-relaxed pt-2 border-t border-gray-900">
                    You are currently active in this team. Your permissions allow you to complete actions on behalf of the business owner.
                  </p>
                </div>

                <Link
                  to="/dashboard/my-team"
                  className="w-full btn-primary py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 mt-2"
                >
                  <span>Go to My Team Portal</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamsPage;
