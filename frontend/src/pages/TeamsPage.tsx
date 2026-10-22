import React, { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';


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
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Business Teams
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-neutral-400">
          Review your business team invitations and active memberships
        </p>
      </div>

      {/* Pending Invitations Section */}
      {pending.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
            Pending Invitations ({pending.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map((inv) => (
              <div key={inv.id} className="bg-surface-card dark:bg-[#0F0F0F] rounded-2xl p-5 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-base">@{inv.owner_username}</h4>
                      <p className="text-xs text-gray-500 dark:text-neutral-400">Business Team Owner</p>
                    </div>
                    <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-surface-muted dark:bg-[#161616] text-gray-700 dark:text-neutral-300">
                      {ROLE_LABELS[inv.role_preset] || 'Worker'}
                    </span>
                  </div>
                  
                  <div className="space-y-1.5">
                    <p className="text-2xs text-gray-400 dark:text-neutral-500">Permissions to be granted:</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-gray-600 dark:text-neutral-300">
                      {Object.entries(inv.permissions).filter(([, val]) => val).map(([name], idx) => (
                        <span key={name} className="inline-flex items-center">
                          {idx > 0 && <span className="mr-2 text-gray-300 dark:text-neutral-700 select-none">•</span>}
                          {name.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    disabled={actioning !== null}
                    onClick={() => handleAccept(inv.id)}
                    className="flex-1 px-3 py-2 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-black text-xs font-semibold hover:opacity-90 transition flex items-center justify-center cursor-pointer"
                  >
                    {actioning === inv.id ? 'Processing...' : 'Accept'}
                  </button>
                  <button
                    disabled={actioning !== null}
                    onClick={() => handleDecline(inv.id)}
                    className="flex-1 px-3 py-2 rounded-xl bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 text-xs font-semibold transition flex items-center justify-center cursor-pointer"
                  >
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
        <h3 className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
          Active Team Memberships
        </h3>
        {accepted.length === 0 ? (
          <div className="bg-surface-card dark:bg-[#0F0F0F] rounded-2xl p-8 text-center text-xs text-gray-500 dark:text-neutral-400">
            You do not belong to any active business teams as a worker.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accepted.map((mem) => (
              <div key={mem.id} className="bg-surface-card dark:bg-[#0F0F0F] rounded-2xl p-5 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-base">@{mem.owner_username}</h4>
                      <p className="text-xs text-gray-500 dark:text-neutral-400">Business Team Owner</p>
                    </div>
                    <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-surface-muted dark:bg-[#161616] text-gray-700 dark:text-neutral-300">
                      {ROLE_LABELS[mem.role_preset] || 'Worker'}
                    </span>
                  </div>
                  
                  <p className="text-xs text-gray-600 dark:text-neutral-400 leading-relaxed">
                    You are currently active in this team. Your permissions allow you to complete actions on behalf of the business owner.
                  </p>
                </div>

                <Link
                  to="/dashboard/my-team"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-black text-xs font-semibold hover:opacity-90 transition text-center mt-1"
                >
                  Go to Team Portal
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
