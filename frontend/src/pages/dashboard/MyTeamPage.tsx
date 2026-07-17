import React, { useEffect, useState } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Shield, User, ClipboardList, CheckCircle } from 'lucide-react';

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

const ROLE_DETAILS: Record<string, { label: string; description: string; tasks: string[] }> = {
  store_manager: {
    label: 'Store Manager',
    description: 'Full administrative control over store products, orders, communications, and business performance tracking.',
    tasks: [
      'Monitor and process customer orders',
      'Update product catalog and inventory',
      'Communicate with customers via messages',
      'Analyze sales and customer metrics'
    ]
  },
  inventory: {
    label: 'Inventory Staff',
    description: 'Responsible for managing catalog items, stock levels, and product descriptions.',
    tasks: [
      'Create and edit product listings',
      'Update inventory counts and pricing',
      'Manage product categories'
    ]
  },
  support_staff: {
    label: 'Support Staff',
    description: 'Handles client questions, support requests, and processes incoming orders.',
    tasks: [
      'Respond to client messages and queries',
      'Manage and fulfill customer orders',
      'Track customer shipment requests'
    ]
  },
  bookkeeper: {
    label: 'Bookkeeper',
    description: 'Monitors revenue, processes billing information, and checks overall store sales statistics.',
    tasks: [
      'Generate revenue and billing reports',
      'Verify store subscription status',
      'Review dashboard transaction logs'
    ]
  },
  cashier: {
    label: 'Cashier',
    description: 'Focuses on confirming order statuses and verifying payments.',
    tasks: [
      'Review pending order transactions',
      'Update order status to paid / processing'
    ]
  },
  sales_representative: {
    label: 'Sales Representative',
    description: 'Responsible for client engagement, catalog optimization, and sales processing.',
    tasks: [
      'Consult clients on product specifications',
      'Assist customers through checkout processes',
      'Maintain product details'
    ]
  },
  marketing_specialist: {
    label: 'Marketing Specialist',
    description: 'Develops campaigns, launches promos, and tracks engagement metrics.',
    tasks: [
      'Create discount vouchers and promo codes',
      'Manage product showcase listings',
      'Analyze marketing campaign effectiveness'
    ]
  },
  logistics_coordinator: {
    label: 'Logistics Coordinator',
    description: 'Handles warehouse allocations, inventory movement, and dispatch coordination.',
    tasks: [
      'Coordinate shipment fulfillment times',
      'Liaise with local warehousing team members',
      'Inspect product quality checks'
    ]
  },
};

export const MyTeamPage: React.FC = () => {
  const [membership, setMembership] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/team-members/')
      .then(res => {
        const list = res.data.results || res.data || [];
        const active = list.find((m: any) => m.invitation_status === 'accepted');
        setMembership(active || null);
      })
      .catch(() => {
        toast.error('Failed to load team details');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-black text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="card p-8 text-center text-gray-500 max-w-xl mx-auto border border-gray-800 bg-[#0a0a0a] rounded-2xl space-y-4">
        <Shield size={48} className="mx-auto text-gray-700" />
        <h3 className="text-lg font-bold text-white uppercase tracking-wider">No Active Team Found</h3>
        <p className="text-xs text-gray-400">
          You are currently not associated with any active business team as a worker. Ask your business owner to invite you using your username.
        </p>
      </div>
    );
  }

  const roleInfo = ROLE_DETAILS[membership.role_preset] || {
    label: 'Custom Worker',
    description: 'Scoped staff access to complete business operations assignments.',
    tasks: Object.entries(membership.permissions)
      .filter(([, v]) => v)
      .map(([k]) => `Custom Scoped: ${k.replace('_', ' ')}`)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Shield className="text-amber-500" size={22} />
            My Team Details
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Review your roles, responsibilities, and jobs in the team
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Role Details */}
        <div className="md:col-span-2 space-y-6">
          <div className="card p-6 bg-[#0a0a0a] border border-gray-800 rounded-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-lg">
                <ClipboardList size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">{roleInfo.label}</h3>
                <p className="text-xs text-gray-500 font-mono">Assigned Role Preset</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed pt-2 border-t border-gray-900">
              {roleInfo.description}
            </p>
          </div>

          <div className="card p-6 bg-[#0a0a0a] border border-gray-800 rounded-xl space-y-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle size={14} className="text-amber-500" />
              Role Responsibilities & Tasks
            </h4>
            <div className="divide-y divide-gray-900">
              {roleInfo.tasks.map((task, idx) => (
                <div key={idx} className="py-3 flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <p className="text-sm text-gray-300 font-medium">{task}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Business / Owner details */}
        <div className="space-y-6">
          <div className="card p-6 bg-[#0a0a0a] border border-gray-800 rounded-xl space-y-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Business Information
            </h4>
            <div className="pt-2 border-t border-gray-900 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gray-900 rounded-lg text-gray-400">
                  <User size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Business Owner</p>
                  <p className="text-sm text-white font-bold">@{membership.owner_username}</p>
                </div>
              </div>

              <div className="pt-3 text-[11px] text-gray-500 leading-relaxed border-t border-gray-900">
                Joined on {new Date(membership.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="card p-6 bg-[#0a0a0a] border border-gray-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              System Permissions
            </h4>
            <div className="space-y-2 pt-2 border-t border-gray-900">
              {Object.entries(membership.permissions).map(([name, val]) => (
                <div key={name} className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 capitalize font-medium">{name.replace('_', ' ')}</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${val ? 'bg-green-950/40 text-green-400 border border-green-900/50' : 'bg-gray-950 text-gray-600 border border-gray-900'}`}>
                    {val ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyTeamPage;
