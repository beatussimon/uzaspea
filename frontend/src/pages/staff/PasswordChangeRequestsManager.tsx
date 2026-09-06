import React, { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardListSkeleton } from '../../components/Skeleton';

interface PasswordRequest {
  id: number;
  username: string;
  user_email: string;
  user_full_name: string;
  user_tier: string;
  user_profile_pic: string | null;
  request_type: 'settings_change' | 'forgot_password';
  status: 'pending' | 'dispatched' | 'completed' | 'expired' | 'superseded';
  token: string;
  reset_url: string;
  email_draft: {
    to: string;
    subject: string;
    body: string;
    reset_url: string;
  };
  is_used: boolean;
  used_at: string | null;
  created_at: string;
  expires_at: string;
  dispatched_by_username: string | null;
  dispatched_at: string | null;
  ip_address: string | null;
  user_agent: string;
  is_active: boolean;
}

interface StatusCounts {
  total: number;
  pending: number;
  dispatched: number;
  completed: number;
  expired: number;
}

const PasswordChangeRequestsManager: React.FC = () => {
  const [requests, setRequests] = useState<PasswordRequest[]>([]);
  const [counts, setCounts] = useState<StatusCounts>({ total: 0, pending: 0, dispatched: 0, completed: 0, expired: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'dispatched' | 'completed' | 'expired' | 'all'>('pending');
  const [typeFilter, setTypeFilter] = useState<'all' | 'settings_change' | 'forgot_password'>('all');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedDraftId, setCopiedDraftId] = useState<number | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [listRes, countRes] = await Promise.all([
        api.get('/api/staff-admin/password-requests/', {
          params: {
            status: statusFilter,
            request_type: typeFilter,
            search: search.trim() || undefined,
          }
        }),
        api.get('/api/staff-admin/password-requests/counts/')
      ]);

      setRequests(listRes.data.results || listRes.data || []);
      setCounts(countRes.data || { total: 0, pending: 0, dispatched: 0, completed: 0, expired: 0 });
    } catch {
      toast.error('Failed to load password change requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, typeFilter, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCopyLink = (req: PasswordRequest) => {
    navigator.clipboard.writeText(req.reset_url);
    setCopiedId(req.id);
    toast.success('Link copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyDraft = (req: PasswordRequest) => {
    const text = `To: ${req.email_draft.to}\nSubject: ${req.email_draft.subject}\n\n${req.email_draft.body}`;
    navigator.clipboard.writeText(text);
    setCopiedDraftId(req.id);
    toast.success('Email draft copied');
    setTimeout(() => setCopiedDraftId(null), 2000);
  };

  const handleDispatch = async (reqId: number) => {
    setActionLoadingId(reqId);
    try {
      const res = await api.post(`/api/staff-admin/password-requests/${reqId}/dispatch/`);
      toast.success('Marked as dispatched');
      setRequests(prev => prev.map(r => r.id === reqId ? res.data : r));
      setCounts(prev => ({
        ...prev,
        pending: Math.max(0, prev.pending - 1),
        dispatched: prev.dispatched + 1,
      }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to dispatch request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevoke = async (reqId: number) => {
    if (!window.confirm('Revoke this reset request?')) return;
    setActionLoadingId(reqId);
    try {
      const res = await api.post(`/api/staff-admin/password-requests/${reqId}/revoke/`);
      toast.success('Request revoked');
      setRequests(prev => prev.map(r => r.id === reqId ? res.data : r));
      setCounts(prev => ({
        ...prev,
        expired: prev.expired + 1,
      }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to revoke request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusPill = (req: PasswordRequest) => {
    if (req.is_used || req.status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Completed
        </span>
      );
    }
    if (req.status === 'dispatched') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-500 dark:text-blue-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Dispatched
        </span>
      );
    }
    if (req.status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-500 dark:text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600" />
        {req.status === 'superseded' ? 'Superseded' : 'Expired'}
      </span>
    );
  };

  const filterTabs = [
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'dispatched', label: 'Dispatched', count: counts.dispatched },
    { key: 'completed', label: 'Completed', count: counts.completed },
    { key: 'expired', label: 'Expired', count: counts.expired },
    { key: 'all', label: 'All', count: counts.total },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Password Change Requests
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Admin verification and manual reset link dispatch.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="text-xs font-semibold px-3.5 py-1.5 rounded-full border border-surface-border dark:border-surface-dark-border text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition cursor-pointer shrink-0"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {/* Filter Row: Regular Pills + Dropdown & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Regular Pills */}
        <div data-horizontal-scroll="true" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {filterTabs.map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key as any)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-surface-muted dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-3xs font-black ${
                    isActive
                      ? 'bg-white/20 dark:bg-black/20 text-inherit'
                      : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Controls: Type and Search */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="h-8 text-xs bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border rounded-full px-3 text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="settings_change">Settings Change</option>
            <option value="forgot_password">Forgot Password</option>
          </select>

          <div className="relative min-w-[190px] sm:min-w-[220px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search user or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full pl-8 pr-3 text-xs bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border rounded-full text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <CardListSkeleton count={3} />
      ) : requests.length === 0 ? (
        <EmptyState
          title="No requests found"
          description={`There are no password change requests matching "${statusFilter}".`}
        />
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const mailtoUrl = `mailto:${encodeURIComponent(req.email_draft.to)}?subject=${encodeURIComponent(req.email_draft.subject)}&body=${encodeURIComponent(req.email_draft.body)}`;

            return (
              <div
                key={req.id}
                className="card p-4 sm:p-5 transition hover:border-gray-900/20 dark:hover:border-white/20"
              >
                <div className="flex items-start gap-3.5">
                  {/* User Avatar */}
                  {req.user_profile_pic ? (
                    <img
                      src={req.user_profile_pic}
                      alt={req.user_full_name}
                      className="w-10 h-10 rounded-full object-cover shrink-0 mt-0.5"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-surface-muted dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                      {(req.user_full_name || req.username).charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Content Column: Everything aligns to the same left vertical line */}
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Header: User & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-gray-900 dark:text-white truncate">
                            {req.user_full_name || req.username}
                          </span>
                          <span className="text-xs text-gray-400 font-mono">
                            @{req.username}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400 bg-surface-muted dark:bg-[#161616] px-2 py-0.5 rounded-full border border-surface-border dark:border-surface-dark-border">
                            {req.request_type === 'settings_change' ? 'Settings Change' : 'Forgot Password'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                          {req.user_email || 'No email registered'} · Requested {formatDate(req.created_at)}
                        </p>
                      </div>

                      {/* Status Indicator */}
                      <div className="shrink-0 pt-0.5">
                        {getStatusPill(req)}
                      </div>
                    </div>

                    {/* Reset Link Strip - Cleanly aligned */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500 shrink-0">
                          Reset Link
                        </span>
                        <span className="font-mono text-xs text-gray-400 dark:text-gray-300 truncate select-all">
                          {req.reset_url}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(req)}
                        className="px-2.5 py-1 rounded-full text-xs font-semibold text-gray-300 hover:text-white border border-surface-border dark:border-surface-dark-border hover:border-gray-500 transition shrink-0 cursor-pointer"
                      >
                        {copiedId === req.id ? 'Copied' : 'Copy Link'}
                      </button>
                    </div>

                    {/* Footer: Metadata & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-surface-border dark:border-surface-dark-border">
                      {/* Subtle Audit Line */}
                      <div className="flex items-center gap-2 text-2xs text-gray-400 dark:text-neutral-500 flex-wrap">
                        <span>Expires: {formatDate(req.expires_at)}</span>
                        <span>•</span>
                        <span>IP: {req.ip_address || '—'}</span>
                        {req.dispatched_by_username && (
                          <>
                            <span>•</span>
                            <span>Dispatched by @{req.dispatched_by_username} ({formatDate(req.dispatched_at || '')})</span>
                          </>
                        )}
                        {req.is_used && req.used_at && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-500">Used {formatDate(req.used_at)}</span>
                          </>
                        )}
                      </div>

                      {/* Action Buttons: Unified height and padding */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleCopyDraft(req)}
                          className="h-8 px-3 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border transition cursor-pointer"
                        >
                          {copiedDraftId === req.id ? 'Draft Copied' : 'Copy Email Draft'}
                        </button>

                        <a
                          href={mailtoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-8 px-3 inline-flex items-center rounded-full text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-surface-border dark:border-surface-dark-border transition"
                        >
                          Open Mail Client
                        </a>

                        {req.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleDispatch(req.id)}
                            disabled={actionLoadingId === req.id}
                            className="h-8 px-4 rounded-full text-xs font-bold bg-gray-900 text-white dark:bg-white dark:text-black hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                          >
                            {actionLoadingId === req.id ? 'Marking...' : 'Mark as Dispatched'}
                          </button>
                        )}

                        {req.is_active && (
                          <button
                            type="button"
                            onClick={() => handleRevoke(req.id)}
                            disabled={actionLoadingId === req.id}
                            className="h-8 px-3 rounded-full text-xs font-semibold text-gray-400 hover:text-red-400 border border-transparent hover:border-red-500/30 transition cursor-pointer"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PasswordChangeRequestsManager;
