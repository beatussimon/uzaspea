import React, { useState, useEffect, useCallback } from 'react';
import {
  Phone, MessageSquare, ExternalLink, Copy, Check,
  AlertTriangle, Search, FileText
} from 'lucide-react';
import api from '../../../api';
import toast from 'react-hot-toast';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TableSkeleton } from '../../../components/Skeleton';

export interface OverdueCommissionInvoice {
  id: number;
  seller_id: number;
  seller_username: string;
  seller_full_name: string;
  store_url: string;
  phone_number: string;
  whatsapp_number: string;
  email: string;
  location: string;
  invoice_year: number;
  invoice_month: number;
  invoice_period: string;
  total_order_amount: number;
  order_count: number;
  total_commission: number;
  subscription_fee: number;
  total_amount_due: number;
  due_date: string | null;
  days_overdue: number;
  status: string;
  active_products_count: number;
}

export const OverdueCommissionsList: React.FC = () => {
  const [items, setItems] = useState<OverdueCommissionInvoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchOverdue = useCallback((q = '') => {
    setLoading(true);
    api.get(`/api/staff/commission-payments/overdue/?q=${encodeURIComponent(q)}`)
      .then((res) => {
        const data = res.data.results || res.data;
        setItems(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Failed to load overdue commission invoices', err);
        toast.error('Failed to load overdue commission invoices');
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

  const getWhatsAppLink = (item: OverdueCommissionInvoice) => {
    const raw = item.whatsapp_number || item.phone_number;
    if (!raw) return '#';
    let clean = getCleanPhone(raw);
    if (clean.startsWith('0')) clean = '255' + clean.slice(1);
    const dueDateStr = item.due_date ? new Date(item.due_date).toLocaleDateString() : 'hivi karibuni';
    const msg = `Habari @${item.seller_username}, kutoka SokoniMax Staff. Hii ni kumbukumbu ya ankara yako ya kamisheni ya mauzo ya mwezi ${item.invoice_period} yenye kiasi cha TZS ${Number(item.total_amount_due || 0).toLocaleString()} (iliyotokana na mauzo ya TZS ${Number(item.total_order_amount || 0).toLocaleString()} katika oda ${item.order_count}). Tarehe ya mwisho ilikuwa ${dueDateStr}. Tafadhali weka risiti ya malipo katika dashibodi yako ili kuepuka usumbufu kwenye duka lako.`;
    return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-card dark:bg-[#0A0A0A] p-4 rounded-card border border-surface-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Overdue & Unpaid Commission Invoices
            </h2>
            <p className="text-xs text-gray-500">
              Sellers with unsettled monthly platform commission invoices requiring follow-up
            </p>
          </div>
        </div>

        <div className="relative min-w-[260px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search seller, period, phone..."
            className="input pl-8 py-1.5 text-xs w-full bg-surface-muted/50 dark:bg-black"
          />
        </div>
      </div>

      {/* Table Layout */}
      {loading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No overdue commission invoices"
          description={search ? 'No invoices match your search query.' : 'All seller commission invoices are settled or currently under review.'}
        />
      ) : (
        <div className="card overflow-hidden border border-surface-border p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted/50 dark:bg-black text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Seller / Store</th>
                  <th className="px-4 py-3">Invoice Period</th>
                  <th className="px-4 py-3">Overdue Status</th>
                  <th className="px-4 py-3">Sales in Cycle</th>
                  <th className="px-4 py-3">Amount Due</th>
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
                      key={item.id}
                      className="hover:bg-surface-muted/40 dark:hover:bg-white/[0.02] transition"
                    >
                      {/* Seller / Store */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-900 dark:text-white">
                            @{item.seller_username}
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
                          {item.seller_full_name && item.seller_full_name !== item.seller_username ? `${item.seller_full_name} • ` : ''}
                          {item.location || 'Tanzania'}
                        </div>
                      </td>

                      {/* Invoice Period */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-mono font-medium text-gray-800 dark:text-gray-200">
                          {item.invoice_period}
                        </span>
                        {item.due_date && (
                          <div className="text-gray-400 text-[10px] mt-0.5">
                            Due {new Date(item.due_date).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Overdue Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          {item.days_overdue > 0 ? `${item.days_overdue} days` : 'Due Today'}
                        </span>
                      </td>

                      {/* Sales in Cycle */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-gray-800 dark:text-gray-200">
                          TZS {Number(item.total_order_amount || 0).toLocaleString()}
                        </div>
                        <div className="text-gray-400 text-[11px] mt-0.5">
                          {item.order_count} completed orders
                        </div>
                      </td>

                      {/* Amount Due */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-black text-rose-600 dark:text-rose-400 font-mono text-sm">
                          TZS {Number(item.total_amount_due || 0).toLocaleString()}
                        </span>
                        <div className="text-gray-400 text-[10px] mt-0.5">
                          Comm: TZS {Number(item.total_commission || 0).toLocaleString()}
                          {item.subscription_fee > 0 && ` + Sub: TZS ${Number(item.subscription_fee).toLocaleString()}`}
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {hasPhone ? (
                          <div className="flex items-center gap-1.5 font-mono text-xs text-gray-700 dark:text-gray-300">
                            <span>{callNumber}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(callNumber, item.id)}
                              className="text-gray-400 hover:text-gray-200 transition p-1 rounded hover:bg-surface-muted"
                              title="Copy number"
                            >
                              {copiedId === item.id ? (
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
