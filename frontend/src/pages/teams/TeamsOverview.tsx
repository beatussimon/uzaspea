import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  CreditCard, ShoppingCart, FileText, Package, MessageSquare, 
  Wallet, TrendingUp, Lightbulb, Phone, ArrowRight, CheckCircle2 
} from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';

interface TeamInfo {
  is_team_member: boolean;
  owner_username?: string;
  business_name?: string;
  role_preset?: string;
  role_label?: string;
  role_description?: string;
  role_tasks?: string[];
  permissions?: Record<string, boolean>;
}

export const TeamsOverview: React.FC = () => {
  const { user } = useAuth();
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/team-members/my-team-info/')
      .then(res => setTeamInfo(res.data))
      .catch(() => {
        setTeamInfo({
          is_team_member: user?.is_team_member || false,
          owner_username: user?.team_owner_username || undefined,
          business_name: user?.business_name || undefined,
          role_preset: user?.team_role_preset || undefined,
          role_label: user?.team_role_label || undefined,
          permissions: user?.team_permissions || {},
        });
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  const perms = teamInfo?.permissions || user?.team_permissions || {};

  const modules = [
    {
      title: 'Incoming Orders',
      desc: 'View customer orders and update fulfillment status',
      path: '/teams-dashboard/orders',
      icon: ShoppingCart,
      show: perms.manage_orders
    },
    {
      title: 'Invoices & Quotes',
      desc: 'Create, issue, and manage customer invoices',
      path: '/teams-dashboard/invoices',
      icon: FileText,
      show: perms.manage_invoices
    },
    {
      title: 'Point of Sale (POS)',
      desc: 'In-store barcode register and instant checkout',
      path: '/teams-dashboard/pos',
      icon: ShoppingCart,
      show: perms.access_pos
    },
    {
      title: 'Payment Approvals',
      desc: 'Verify buyer mobile payments and receipts',
      path: '/teams-dashboard/payments',
      icon: CreditCard,
      show: perms.manage_payments
    },
    {
      title: 'Products & Stock',
      desc: 'Update inventory, prices, and product listings',
      path: '/teams-dashboard/products',
      icon: Package,
      show: perms.manage_products
    },
    {
      title: 'Product Requests',
      desc: 'Review customer item requests',
      path: '/teams-dashboard/product-requests',
      icon: Lightbulb,
      show: perms.manage_requests || perms.manage_products
    },
    {
      title: 'Customer Messages',
      desc: 'Reply to customer chats and support inquiries',
      path: '/teams-dashboard/messages',
      icon: MessageSquare,
      show: perms.manage_messages
    },
    {
      title: 'Payment Numbers',
      desc: 'View store Lipa numbers',
      path: '/teams-dashboard/payment-numbers',
      icon: Phone,
      show: perms.manage_payment_numbers
    },
    {
      title: 'Billing & Ledger',
      desc: 'View platform commission statements and fees',
      path: '/teams-dashboard/billing',
      icon: Wallet,
      show: perms.manage_billing
    },
    {
      title: 'Sales Reports',
      desc: 'View store sales volume and analytics',
      path: '/teams-dashboard/analytics',
      icon: TrendingUp,
      show: perms.view_analytics
    }
  ].filter(m => m.show);

  return (
    <div className="space-y-6">
      
      {/* Welcome Card */}
      <div className="bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border rounded-xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-950 dark:text-white">
                Welcome back, {user?.first_name || user?.username}
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400">
                {teamInfo?.role_label || user?.team_role_label || 'Team Member'}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Store: <strong className="text-gray-900 dark:text-white">{teamInfo?.business_name || user?.business_name || `@${teamInfo?.owner_username || user?.team_owner_username}`}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Available Operations */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Your Assigned Modules
        </h2>

        {modules.length === 0 ? (
          <div className="bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border rounded-xl p-8 text-center text-sm text-gray-500">
            No active modules assigned to your account. Contact your store manager to update your permissions.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((m, idx) => (
              <Link
                key={idx}
                to={m.path}
                className="bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border hover:border-brand-500/50 rounded-xl p-4 flex flex-col justify-between group transition-all"
              >
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center">
                    <m.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-brand-500 transition-colors">
                      {m.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {m.desc}
                    </p>
                  </div>
                </div>

                <div className="flex items-center text-xs font-medium text-brand-500 mt-4 pt-2 border-t border-surface-border dark:border-surface-dark-border gap-1">
                  <span>Open</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Responsibilities list if available */}
      {teamInfo?.role_tasks && teamInfo.role_tasks.length > 0 && (
        <div className="bg-white dark:bg-[#0A0A0A] border border-surface-border dark:border-surface-dark-border rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Role Duties & Responsibilities
          </h2>
          <div className="space-y-2">
            {teamInfo.role_tasks.map((task, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-500 mt-0.5 shrink-0" />
                <span>{task}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default TeamsOverview;
