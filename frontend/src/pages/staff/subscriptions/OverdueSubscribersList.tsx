import React, { useState, useEffect, useCallback } from 'react';
import {
  Phone, MessageSquare, ExternalLink, Copy, Check,
  AlertTriangle, Search, CreditCard
} from 'lucide-react';
import api from '../../../api';
import toast from 'react-hot-toast';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TableSkeleton } from '../../../components/Skeleton';

export interface OverdueSubscriber {
  user_id: number;
  username: string;
  full_name: string;
  store_url: string;
  phone_number: string;
  whatsapp_number: string;
  email: string;
  location: string;
  tier_name: string;
  amount_due: number;
  end_date: string | null;
  days_overdue: number;
  status: 'OVERDUE' | 'EXPIRED' | 'DUE_SOON';
  active_products_count: number;
  orders_count: number;
}

export const OverdueSubscribersList: React.FC = () => {
  const [items, setItems] = useState<OverdueSubscriber[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchOverdue = useCallback((q = '') => {
    setLoading(true);
    api.get(`/api/staff/payment-confirmations/overdue/?q=${encodeURIComponent(q)}`)
      .then((res) => {
        const data = res.data.results || res.data;
        setItems(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Failed to load overdue subscribers', err);
        toast.error('Failed to load overdue subscriptions');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOverdue(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchOverdue]);

  const copyToClipboard = (text: string, id: number) => {
    if (!text) {
      toast.error('No phone number recorded');
      return;
    }
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Phone number copied');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getCleanPhone = (phone: string) => {
    return phone.replace(/[^\d+]/g, '').replace('+', '');
  };

  const getWhatsAppLink = (item: OverdueSubscriber) => {
    const raw = item.whatsapp_number || item.phone_number;
    if (!raw) return '#';
    let clean = getCleanPhone(raw);
    if (clean.startsWith('0')) clean = '255' + clean.slice(1);
    const msg = `Habari @${item.username}, kutoka SokoniMax Staff. Kifurushi chako cha ${item.tier_name} kimemalizika (TZS ${Number(item.amount_due || 0).toLocaleString()}). Tafadhali fanya malipo na uweke risiti katika dashboard yako (https://sokonimax.com/upgrade) ili kuendelea kufurahia huduma za kuuza bila usumbufu.`;
    return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-card dark:bg-[#0A0A0A] p-4 rounded-card border border-surface-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Overdue & Expired Subscriptions
            </h2>
            <p className="text-xs text-gray-500">
              Sellers whose subscription plans have expired or require renewal follow-up
            </p>
          </div>
        </div>

        <div className="relative min-w-[260px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search seller, phone, tier..."
            className="input pl-8 py-1.5 text-xs w-full bg-surface-muted/50 dark:bg-black"
          />
        </div>
      </div>

      {/* Table Layout */}
      {loading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No overdue subscriptions found"
          description={search ? 'No sellers match your search query.' : 'All subscribed sellers are currently active and up to date.'}
        />
      ) : (
        <div className="card overflow-hidden border border-surface-border p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted/50 dark:bg-black text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Seller / Store</th>
                  <th className="px-4 py-3">Tier Plan</th>
                  <th className="px-4 py-3">Overdue</th>
                  <th className="px-4 py-3">Amount Due</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-5 py-3 text-right">Outreach</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {items.map((item) => {
                  const hasPhone = !!(item.phone_number || item.whatsapp_number);
                  const callNumber = item.phone_number || item.whatsapp_number;
                  const waUrl = getWhatsAppLink(item);

                  return (
                    <tr
                      key={item.user_id}
                      className="hover:bg-surface-muted/40 dark:hover:bg-white/[0.02] transition"
                    >
                      {/* Seller / Store */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-900 dark:text-white">
                            @{item.username}
                          </span>
                          <a
                            href={item.store_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-500 hover:text-brand-400 p-0.5"
                            title="Visit store"
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                        <div className="text-gray-400 text-[11px] mt-0.5">
                          {item.full_name && item.full_name !== item.username ? `${item.full_name} • ` : ''}
                          {item.location || 'Tanzania'}
                        </div>
                      </td>

                      {/* Tier Plan */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                          {item.tier_name}
                        </span>
                        {item.end_date && (
                          <div className="text-gray-400 text-[10px] mt-1">
                            Expired {new Date(item.end_date).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Overdue */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          {item.days_overdue} days
                        </span>
                      </td>

                      {/* Amount Due */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-black text-gray-900 dark:text-white font-mono text-sm">
                          TZS {Number(item.amount_due || 0).toLocaleString()}
                        </span>
                      </td>

                      {/* Activity */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="text-gray-800 dark:text-gray-200 font-medium">
                          {item.active_products_count} active items
                        </div>
                        <div className="text-gray-400 text-[11px] mt-0.5">
                          {item.orders_count} orders completed
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {hasPhone ? (
                          <div className="flex items-center gap-1.5 font-mono text-xs text-gray-700 dark:text-gray-300">
                            <span>{callNumber}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(callNumber, item.user_id)}
                              className="text-gray-400 hover:text-gray-200 transition p-1 rounded hover:bg-surface-muted"
                              title="Copy number"
                            >
                              {copiedId === item.user_id ? (
                                <Check size={12} className="text-emerald-500" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">No phone</span>
                        )}
                      </td>

                      {/* Outreach */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {hasPhone ? (
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs"
                            >
                              <MessageSquare size={13} />
                              <span>WhatsApp</span>
                            </a>
                            <a
                              href={`tel:${callNumber}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-surface-muted hover:bg-surface-border text-gray-700 dark:text-gray-300 border border-surface-border transition"
                            >
                              <Phone size={13} />
                              <span>Call</span>
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
