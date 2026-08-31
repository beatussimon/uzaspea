import React, { useEffect, useState } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Shield, User, ClipboardList, CheckCircle } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardGridSkeleton } from '../../components/Skeleton';

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="text-brand-500" size={24} />
            My Team Details
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Review your roles, responsibilities, and jobs in the team
          </p>
        </div>
      </header>

      {loading ? (
        <CardGridSkeleton count={2} cols={2} />
      ) : !membership ? (
        <EmptyState
          icon={Shield}
          title="No Active Team Found"
          description="You are currently not associated with any active business team as a worker. Ask your business owner to invite you using your username."
        />
      ) : (() => {
          const roleInfo = ROLE_DETAILS[membership.role_preset] || {
            label: 'Custom Worker',
            description: 'Scoped staff access to complete business operations assignments.',
            tasks: Object.entries(membership.permissions)
              .filter(([, v]) => v)
              .map(([k]) => `Custom Scoped: ${k.replace('_', ' ')}`)
          };

          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Role Details */}
              <div className="md:col-span-2 space-y-6">
                <div className="card p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-btn border border-brand-500/20">
                      <ClipboardList size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">{roleInfo.label}</h3>
                      <p className="text-2xs text-gray-400 font-mono">Assigned Role Preset</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed pt-2 border-t border-surface-border dark:border-surface-dark-border">
                    {roleInfo.description}
                  </p>
                </div>

                <div className="card p-5 space-y-3">
                  <h4 className="text-2xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-brand-500" />
                    Role Responsibilities & Tasks
                  </h4>
                  <div className="divide-y divide-surface-border dark:divide-surface-dark-border">
                    {roleInfo.tasks.map((task, idx) => (
                      <div key={idx} className="py-2.5 flex items-start gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                        <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">{task}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Business / Owner details */}
              <div className="space-y-6">
                <div className="card p-5 space-y-3">
                  <h4 className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                    Business Information
                  </h4>
                  <div className="pt-2 border-t border-surface-border dark:border-surface-dark-border space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-surface-muted dark:bg-[#161616] rounded-btn text-gray-500 border border-surface-border dark:border-surface-dark-border">
                        <User size={16} />
                      </div>
                      <div>
                        <p className="text-3xs text-gray-400 uppercase tracking-wider font-bold">Business Owner</p>
                        <p className="text-xs text-gray-900 dark:text-white font-bold">@{membership.owner_username}</p>
                      </div>
                    </div>

                    <div className="pt-2 text-3xs text-gray-400 leading-relaxed border-t border-surface-border dark:border-surface-dark-border">
                      Joined on {new Date(membership.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="card p-5 space-y-3">
                  <h4 className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
                    System Permissions
                  </h4>
                  <div className="space-y-2 pt-2 border-t border-surface-border dark:border-surface-dark-border">
                    {Object.entries(membership.permissions).map(([name, val]) => (
                      <div key={name} className="flex justify-between items-center text-xs">
                        <span className="text-gray-600 dark:text-gray-300 capitalize text-2xs font-medium">{name.replace('_', ' ')}</span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border capitalize ${
                          val
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${val ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          {val ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
};

export default MyTeamPage;
