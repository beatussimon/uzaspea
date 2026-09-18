import React, { useState, useEffect, useCallback } from 'react';
import {
  Phone, MessageSquare, ExternalLink, Copy, Check,
  AlertTriangle, MapPin, ShoppingBag, Search,
  Calendar, FileText
} from 'lucide-react';
import api from '../../../api';
import toast from 'react-hot-toast';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Button } from '../../../components/ui/Button';

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
    toast.success('Phone number copied to clipboard');
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
            <AlertTriangle size={16} />
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

        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search seller, period, phone..."
            className="input pl-8 py-1.5 text-xs w-full"
          />
        </div>
      </div>

      {/* Debtors List Grid */}
      {loading ? (
        <div className="py-12 flex justify-center items-center text-gray-500 text-sm">
          <Spinner size="md" className="mr-2" /> Loading overdue invoices...
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No overdue commission invoices"
          description={search ? 'No invoices match your search query.' : 'All seller commission invoices are settled or currently under review!'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => {
            const hasPhone = !!(item.phone_number || item.whatsapp_number);
            const callNumber = item.phone_number || item.whatsapp_number;
            const waUrl = getWhatsAppLink(item);

            return (
              <div
                key={item.id}
                className="card p-5 flex flex-col justify-between space-y-4 border border-red-500/20 hover:border-red-500/40 transition shadow-xs"
              >
                <div className="space-y-3">
                  {/* Header: Seller & Period */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">
                          @{item.seller_username}
                        </h3>
                        {item.seller_full_name && item.seller_full_name !== item.seller_username && (
                          <span className="text-xs text-gray-500 truncate">
                            ({item.seller_full_name})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <a
                          href={item.store_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                        >
                          <span>Visit Store</span>
                          <ExternalLink size={12} />
                        </a>
                        {item.location && (
                          <span className="text-gray-400 text-xs flex items-center gap-0.5">
                            <MapPin size={11} /> {item.location}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                        {item.days_overdue > 0 ? `${item.days_overdue} days overdue` : 'Due Today'}
                      </span>
                      <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1">
                        Cycle: {item.invoice_period}
                      </p>
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="bg-surface-muted/50 dark:bg-[#151515] p-3 rounded-xl space-y-2 text-xs border border-surface-border/40">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400">Total Amount Due:</span>
                      <span className="font-black text-red-600 dark:text-red-400 text-base">
                        TZS {Number(item.total_amount_due || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-surface-border/30">
                      <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <ShoppingBag size={12} /> Sales in Period:
                      </span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        TZS {Number(item.total_order_amount || 0).toLocaleString()} ({item.order_count} orders)
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400">Commission Portion:</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        TZS {Number(item.total_commission || 0).toLocaleString()}
                      </span>
                    </div>

                    {item.subscription_fee > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-400">Subscription Fee:</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          TZS {Number(item.subscription_fee || 0).toLocaleString()}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-1 border-t border-surface-border/30 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1"><Calendar size={11} /> Invoice Due Date:</span>
                      <span>{item.due_date ? new Date(item.due_date).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>

                  {/* Direct Contact Phone & WhatsApp Info */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between bg-surface-card dark:bg-[#121212] p-2 rounded-lg border border-surface-border/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <Phone size={13} className="text-brand-500 shrink-0" />
                        <span className="font-mono font-medium text-gray-900 dark:text-gray-100 truncate">
                          {callNumber || 'No phone provided'}
                        </span>
                      </div>
                      {hasPhone && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(callNumber, item.id)}
                          className="p-1 rounded hover:bg-surface-muted text-gray-400 hover:text-gray-700 dark:hover:text-white transition flex items-center gap-1 text-[11px] font-medium"
                          title="Copy phone number"
                        >
                          {copiedId === item.id ? (
                            <><Check size={12} className="text-emerald-500" /> Copied</>
                          ) : (
                            <><Copy size={12} /> Copy</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Outreach Action Toolbar */}
                <div className="flex gap-2 pt-2 border-t border-surface-border/40">
                  {hasPhone ? (
                    <>
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
                      >
                        <MessageSquare size={14} />
                        <span>WhatsApp Invoice</span>
                      </a>
                      <a
                        href={`tel:${callNumber}`}
                        className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg bg-surface-muted hover:bg-surface-border/40 text-gray-800 dark:text-gray-200 border border-surface-border/60 transition"
                      >
                        <Phone size={14} />
                        <span>Call</span>
                      </a>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="w-full text-xs text-gray-400"
                    >
                      No contact phone available
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
