import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  CreditCard, ShoppingCart, FileText, Package, MessageSquare, 
  Wallet, Lightbulb, Phone, MapPin 
} from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { CardGridSkeleton } from '../../components/Skeleton';

interface TeamInfo {
  is_team_member: boolean;
  owner_username?: string;
  business_name?: string;
  store_name?: string;
  location_name?: string;
  assigned_locations?: { id: number; name: string; city?: string }[];
  all_locations_access?: boolean;
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

  const rawPerms = (teamInfo?.permissions || user?.team_permissions || {}) as Record<string, boolean>;
  const perms: Record<string, boolean> = {
    ...rawPerms,
    access_pos: !!(rawPerms.access_pos || rawPerms.pos_access),
    pos_access: !!(rawPerms.access_pos || rawPerms.pos_access),
  };

  const modules = [
    {
      title: 'Incoming Orders',
      desc: 'View customer orders and update fulfillment status',
      path: '/teams-dashboard/orders',
      icon: ShoppingCart,
      show: !!perms.manage_orders
    },
    {
      title: 'Invoices & Quotes',
      desc: 'Create, issue, and manage customer invoices',
      path: '/teams-dashboard/invoices',
      icon: FileText,
      show: !!perms.manage_invoices
    },
    {
      title: 'Point of Sale (POS)',
      desc: 'In-store barcode register and instant checkout',
      path: '/teams-dashboard/pos',
      icon: ShoppingCart,
      show: !!(perms.access_pos || perms.pos_access)
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
    }
  ].filter(m => m.show);

  const storeName = teamInfo?.store_name || teamInfo?.business_name || user?.business_name;
  const locationName = teamInfo?.location_name || (teamInfo?.assigned_locations && teamInfo.assigned_locations.length > 0 ? teamInfo.assigned_locations[0].name : undefined);

  return (
    <div className="space-y-6">
      
      {/* Welcome Card */}
      <div className="bg-surface-card dark:bg-[#0F0F0F] rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-950 dark:text-white">
                Welcome back, {user?.first_name || user?.username}
              </h1>
              <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-surface-muted dark:bg-[#161616] text-gray-700 dark:text-neutral-300">
                {teamInfo?.role_label || user?.team_role_label || 'Team Member'}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
              Logged in as @{user?.username} • Store Owner: @{teamInfo?.owner_username || user?.team_owner_username || 'store'}
            </p>
          </div>

          {/* Far Right: Store Name & Location (Desktop) */}
          {(storeName || locationName) && (
            <div className="hidden sm:flex flex-col sm:items-end text-right shrink-0">
              {storeName && (
                <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-white tracking-tight">
                  {storeName}
                </div>
              )}
              {locationName && (
                <div className="text-xs text-gray-500 dark:text-neutral-400 flex items-center gap-1 sm:justify-end mt-0.5 font-medium">
                  <MapPin size={12} className="shrink-0 text-gray-400 dark:text-neutral-500" />
                  <span>{locationName}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Available Operations */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
          Assigned Modules
        </h2>

        {loading ? (
          <CardGridSkeleton count={3} cols={3} />
        ) : modules.length === 0 ? (
          <div className="bg-surface-card dark:bg-[#0F0F0F] rounded-2xl p-8 text-center text-xs text-gray-500 dark:text-neutral-400">
            No active modules assigned to your account. Contact your store manager to update your permissions.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {modules.map((m, idx) => (
              <Link
                key={idx}
                to={m.path}
                className="bg-surface-card dark:bg-[#0F0F0F] hover:bg-surface-muted/60 dark:hover:bg-[#161616] rounded-2xl p-5 flex flex-col justify-between gap-3 group transition-colors"
              >
                <div className="space-y-2.5">
                  <m.icon className="w-5 h-5 text-gray-400 dark:text-neutral-500 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
                  <div>
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white transition-colors">
                      {m.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                      {m.desc}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default TeamsOverview;
