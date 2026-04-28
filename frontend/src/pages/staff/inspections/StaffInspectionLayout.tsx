import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useParams, Navigate } from 'react-router-dom';
import {
  ChevronRight, Shield, Clock, Eye, ClipboardList, CheckCircle2, CreditCard,
  AlertTriangle, XCircle, LayoutDashboard, BarChart2, Search, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Breadcrumbs from '../../../components/Breadcrumbs';
import inspectionApi from '../../../api/inspectionApi';
import {
  InspectionRequest, InspectionPayment, FraudFlag,
  STATUS_LABELS, STATUS_COLORS, VERDICT_COLORS,
  fmtDate, fmtMoney,
} from '../../../types/inspection';

const Spinner = () => (
  <div className="flex justify-center py-16">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
  </div>
);

const Badge: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
    {text}
  </span>
);

// ─── Staff Dashboard Overview ───────────────
const StaffInspectionDashboard: React.FC<{ hasPerm?: boolean }> = ({ hasPerm = true }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const location = useLocation();
  const base = location.pathname.startsWith('/staff-admin')
    ? '/staff-admin/inspections'
    : '/staff/inspections';

  useEffect(() => {
    if (!hasPerm) {
      setLoading(false);
      return;
    }
    inspectionApi.requests.stats()
      .then((r: any) => setStats(r.data))
      .catch(() => toast.error('Failed to load stats'))
      .finally(() => setLoading(false));
  }, [hasPerm]);

  if (loading) return <Spinner />;

  if (!hasPerm) {
    return (
      <div className="card p-12 text-center space-y-4">
        <Shield size={48} className="mx-auto text-red-500 opacity-50" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Management Access Required</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          You do not have the <code className="text-red-500">can_manage_inspections</code> permission required to view the global inspection overview.
        </p>
        <div className="pt-4">
          <Link to="/staff" className="btn-secondary px-6">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Requests', val: stats?.total || 0, color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-900/20' },
    { label: 'Pending QA', val: stats?.pending_qa || 0, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Fraud Flags', val: stats?.fraud_flags || 0, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: 'SLA Breaches', val: stats?.sla_breaches || 0, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  ];

  const statusRows = Object.entries(stats?.by_status || {}).filter(([, v]) => (v as number) > 0);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Inspection Overview</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((c) => (
          <div key={c.label} className={`rounded-xl border border-surface-border dark:border-surface-dark-border p-4 ${c.bg}`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{c.label}</p>
            <p className={`text-3xl font-bold ${c.color}`}>{c.val}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">By Status</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {statusRows.map(([status, count]) => (
            <div key={status} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <Badge text={STATUS_LABELS[status] || status} className={STATUS_COLORS[status] || 'badge-gray'} />
              <span className="font-bold text-gray-900 dark:text-white ml-2">{count as number}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { to: `${base}/dispatch`, label: 'Dispatcher Queue', icon: ClipboardList, color: 'text-blue-500' },
          { to: `${base}/qa`, label: 'QA Review Queue', icon: CheckCircle2, color: 'text-purple-500' },
          { to: `${base}/payments`, label: 'Payment Approvals', icon: CreditCard, color: 'text-green-500' },
        ].map((item) => (
          <Link key={item.to} to={item.to}
            className="card p-4 flex items-center gap-3 hover:shadow-card-hover transition group">
            <item.icon size={20} className={item.color} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-brand-600 transition">
              {item.label}
            </span>
            <ChevronRight size={14} className="text-gray-400 ml-auto" />
          </Link>
        ))}
      </div>
    </div>
  );
};

// ─── All Requests Table ─────────────────────
const AllRequests: React.FC = () => {
  const [requests, setRequests] = useState<InspectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const location = useLocation();
  const base = location.pathname.startsWith('/staff-admin')
    ? '/staff-admin/inspections'
    : '/staff/inspections';

  useEffect(() => {
    inspectionApi.requests.list({ all: 'true' })
      .then((r: any) => setRequests(r.data.results || r.data))
      .catch(() => toast.error('Failed to load requests'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = requests.filter((r: any) => {
    const matchesStatus = !statusFilter || r.status === statusFilter;
    const matchesSearch = !search || r.item_name.toLowerCase().includes(search.toLowerCase())
      || r.inspection_id.toLowerCase().includes(search.toLowerCase())
      || r.client_username.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">All Requests</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-8 py-1.5 text-sm w-48" placeholder="Search..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input py-1.5 text-sm w-44"
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v as React.ReactNode}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-gray-400">No requests found</p>
          </div>
        ) : filtered.map((req: any) => (
          <Link key={req.id} to={`${base}/request/${req.id}`}
            className="card p-4 flex items-center justify-between gap-3 hover:shadow-card-hover transition group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Badge text={STATUS_LABELS[req.status] || req.status} className={STATUS_COLORS[req.status] || 'badge-gray'} />
                <span className="font-mono text-xs text-gray-400">{req.inspection_id}</span>
              </div>
              <p className="font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 transition line-clamp-1">
                {req.item_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {req.client_username} • {req.category_path}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">{fmtDate(req.created_at)}</p>
              {req.has_report && <p className="text-xs text-green-600 mt-1">Report ready</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

// ─── Request Detail (Staff) ─────────────────
const StaffRequestDetail: React.FC = () => {
  const { id } = useParams();
  const [request, setRequest] = useState<InspectionRequest | null>(null);
  const [inspectors, setInspectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInspector, setSelectedInspector] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [generatingBill, setGeneratingBill] = useState(false);
  const [travel, setTravel] = useState('');
  const [qaNote, setQaNote] = useState('');
  const [showAllInspectors, setShowAllInspectors] = useState(false);



  const load = () => {
    const numericId = Number(id);
    if (isNaN(numericId)) {
      setLoading(false);
      return;
    }
    inspectionApi.requests.get(numericId)
      .then((r: any) => {
        const req = r.data;
        setRequest(req);
        return inspectionApi.inspectors.available(req.category, showAllInspectors);
      })
      .then((r: any) => setInspectors(r.data.results || r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id, showAllInspectors]);

  const handleGenerateBill = async () => {
    if (!request) return;
    setGeneratingBill(true);
    try {
      await inspectionApi.requests.generateBill(request.id, { travel_surcharge: Number(travel) || 0 });
      toast.success('Bill generated and sent to client');
      load();
    } catch { toast.error('Failed to generate bill'); }
    finally { setGeneratingBill(false); }
  };

  const handleAssign = async () => {
    if (!request || !selectedInspector) return;
    setAssigning(true);
    try {
      await inspectionApi.requests.assign(request.id, {
        inspector_id: selectedInspector,
        override_reason: overrideReason,
      });
      toast.success('Inspector assigned');
      load();
    } catch { toast.error('Failed to assign inspector'); }
    finally { setAssigning(false); }
  };

  const handleQaApprove = async () => {
    if (!request?.report) return;
    try {
      await inspectionApi.reports.approve(request.report.id);
      toast.success('Report approved and published');
      load();
    } catch { toast.error('Failed to approve report'); }
  };

  const handleQaReturn = async () => {
    if (!request?.report || !qaNote) { toast.error('Add QA notes'); return; }
    try {
      await inspectionApi.reports.returnForRevision(request.report.id, qaNote);
      toast.success('Report returned for revision');
      load();
    } catch { toast.error('Failed to return report'); }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!request) return;
    try {
      await inspectionApi.requests.updateStatus(request.id, status);
      toast.success(`Status updated to ${STATUS_LABELS[status]}`);
      load();
    } catch { toast.error('Failed to update status'); }
  };

  if (loading) return <Spinner />;
  if (!request) return <p className="text-center py-12 text-gray-400">Request not found</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      <div className="card p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge text={STATUS_LABELS[request.status] || request.status} className={STATUS_COLORS[request.status] || 'badge-gray'} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{request.item_name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{request.category_path}</p>
            <p className="text-xs text-gray-400 mt-1">Client: {request.client_username} • {fmtDate(request.created_at)}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['blocked', 'cancelled', 'rescheduled'].map((s) => (
              <button key={s} onClick={() => handleUpdateStatus(s)}
                className="btn-ghost text-xs px-3 py-1.5 capitalize">
                Mark {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
          <div><span className="text-gray-500">Scope</span><p className="font-medium text-gray-900 dark:text-white capitalize">{request.scope}</p></div>
          <div><span className="text-gray-500">Turnaround</span><p className="font-medium text-gray-900 dark:text-white capitalize">{request.turnaround}</p></div>
          <div><span className="text-gray-500">Age</span><p className="font-medium text-gray-900 dark:text-white">{request.item_age_years ? `${request.item_age_years} yrs` : '—'}</p></div>
          <div><span className="text-gray-500">Complex</span><p className="font-medium text-gray-900 dark:text-white">{request.is_complex ? 'Yes' : 'No'}</p></div>
        </div>

        <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-sm">
          <p className="text-gray-500 mb-1">Location</p>
          <p className="text-gray-700 dark:text-gray-300">{request.item_address}</p>
        </div>
        <div className="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-sm">
          <p className="text-gray-500 mb-1">Description</p>
          <p className="text-gray-700 dark:text-gray-300">{request.item_description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bill & Generate */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCard size={16} className="text-brand-600" /> Bill
          </h3>
          {request.bill ? (
            <div className="space-y-2 text-sm">
              {[
                ['Base Rate', request.bill.base_rate],
                ['Turnaround', request.bill.turnaround_surcharge],
                ['Inspector Level', request.bill.inspector_level_surcharge],
                ['Complexity', request.bill.complexity_surcharge],
                ['Travel', request.bill.travel_surcharge],
                ['Re-inspection', request.bill.reinspection_coverage_fee],
              ].filter(([, v]) => Number(v) > 0).map(([l, v]) => (
                <div key={l as string} className="flex justify-between">
                  <span className="text-gray-500">{l}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{fmtMoney(v as string, request.bill!.currency)}</span>
                </div>
              ))}
              <div className="border-t border-surface-border dark:border-surface-dark-border pt-2">
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{fmtMoney(request.bill.total_amount, request.bill.currency)}</span>
                </div>
                <div className="flex justify-between text-brand-600 mt-1">
                  <span>Deposit</span>
                  <span className="font-semibold">{fmtMoney(request.bill.deposit_amount, request.bill.currency)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <input className="input text-sm" type="number" placeholder="Travel surcharge (optional)"
                value={travel} onChange={(e) => setTravel(e.target.value)} />
              <button onClick={handleGenerateBill} disabled={generatingBill} className="w-full btn-primary text-sm py-2">
                {generatingBill ? 'Generating…' : 'Generate & Send Bill'}
              </button>
            </div>
          )}
        </div>

        {/* Assignment */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users size={16} className="text-brand-600" /> Assignment
          </h3>
          {request.assignment ? (
            <div className="space-y-2 text-sm">
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="font-medium text-green-700 dark:text-green-400">{request.assignment.inspector_name}</p>
                <Badge text={request.assignment.inspector_level} className="badge-blue capitalize mt-1" />
                <p className="text-xs text-gray-500 mt-1">
                  SLA: {request.assignment.sla_deadline ? fmtDate(request.assignment.sla_deadline) : '—'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <select className="input text-sm" value={selectedInspector}
                onChange={(e) => setSelectedInspector(e.target.value)}>
                <option value="">Select inspector…</option>
                {inspectors.map((ins: any) => (
                  <option key={ins.id} value={ins.id}>
                    {ins.full_name} ({ins.level}) — Score: {ins.performance_score}
                  </option>
                ))}
              </select>

              {inspectors.length === 0 && !showAllInspectors && (
                <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                   <p className="text-xs text-orange-700 dark:text-orange-300">
                     No inspectors are certified for this specific category yet.
                   </p>
                   <button 
                     onClick={() => setShowAllInspectors(true)}
                     className="text-xs font-bold text-brand-600 hover:underline mt-1">
                     Show all available inspectors anyway
                   </button>
                </div>
              )}

              {showAllInspectors && (
                <div className="flex items-center gap-2">
                   <input type="checkbox" id="bypass" checked={showAllInspectors} onChange={(e) => setShowAllInspectors(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
                   <label htmlFor="bypass" className="text-xs text-gray-500">Showing all available inspectors (Certification bypass active)</label>
                </div>
              )}

              <input className="input text-sm" placeholder="Override reason (if manually overriding)"
                value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
              <button onClick={handleAssign} disabled={assigning || !selectedInspector}
                className="w-full btn-primary text-sm py-2">
                {assigning ? 'Assigning…' : 'Assign Inspector'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Payments */}
      {request.payments && request.payments.length > 0 && (
        <div className="card p-5 text-sm">
           <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Payments</h3>
           <div className="space-y-2">
             {request.payments.map((p: any) => (
               <div key={p.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-2 rounded">
                 <span className="capitalize">{p.stage} ({p.status})</span>
                 <span className="font-bold">{fmtMoney(p.amount)}</span>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* QA Review */}
      {request.status === 'qa_review' && request.report && !request.report.is_locked && (
        <div className="card p-5 border-2 border-purple-300 dark:border-purple-700 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 size={16} className="text-purple-600" /> QA Review
          </h3>

          <div className="flex gap-3">
            <button onClick={handleQaApprove}
              className="flex-1 btn-primary bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2 py-2.5">
              <CheckCircle2 size={15} /> Approve & Publish
            </button>
            <div className="flex-1 space-y-2">
              <input className="input text-xs" placeholder="QA notes for return..."
                value={qaNote} onChange={(e) => setQaNote(e.target.value)} />
              <button onClick={handleQaReturn}
                className="w-full btn-secondary text-orange-600 border-orange-300 hover:bg-orange-50 py-2.5 flex items-center justify-center gap-2">
                <XCircle size={15} /> Return for Revision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Dispatcher Queue ───────────────────────
const DispatcherQueue: React.FC = () => {
  const [requests, setRequests] = useState<InspectionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const location = useLocation();
  const base = location.pathname.startsWith('/staff-admin')
    ? '/staff-admin/inspections'
    : '/staff/inspections';

  useEffect(() => {
    inspectionApi.requests.list({ all: 'true' })
      .then((r: any) => {
        const all = r.data.results || r.data;
        setRequests(all.filter((req: any) =>
          ['deposit_paid', 'pre_inspection'].includes(req.status)
        ));
      })
      .catch(() => toast.error('Failed to load queue'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Dispatcher Queue</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Requests awaiting inspector assignment. Pre-inspection confirmed, balance paid.
      </p>
      {requests.length === 0 ? (
        <div className="card p-10 text-center">
          <CheckCircle2 size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-400">No requests in queue</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => (
            <Link key={req.id} to={`${base}/request/${req.id}`}
              className="card p-4 flex items-center justify-between gap-3 hover:shadow-card-hover transition group">
              <div>
                <Badge text={STATUS_LABELS[req.status]} className={STATUS_COLORS[req.status]} />
                <p className="font-semibold text-gray-900 dark:text-white mt-1 group-hover:text-brand-600 transition">{req.item_name}</p>
                <p className="text-xs text-gray-500">{req.category_path} • {req.client_username}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">{fmtDate(req.created_at)}</p>
                <p className="text-xs font-medium text-orange-500 mt-1 capitalize">{req.turnaround}</p>
                <ChevronRight size={14} className="text-gray-400 mt-1 ml-auto" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── QA Queue ──────────────────────────────
const QAQueue: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const location = useLocation();
  const base = location.pathname.startsWith('/staff-admin')
    ? '/staff-admin/inspections'
    : '/staff/inspections';

  useEffect(() => {
    inspectionApi.reports.qaQueue()
      .then((r: any) => setReports(r.data.results || r.data))
      .catch(() => toast.error('Failed to load QA queue'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">QA Review Queue</h2>
      {reports.length === 0 ? (
        <div className="card p-10 text-center">
          <CheckCircle2 size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-400">No reports pending review</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report: any) => (
            <Link key={report.id} to={`${base}/request/${report.request}`}
              className="card p-4 flex items-center justify-between gap-3 hover:shadow-card-hover transition group">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge text={report.verdict.toUpperCase()} className={VERDICT_COLORS[report.verdict]} />
                  {report.qa_notes && (
                    <Badge text="Auto-flagged" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" />
                  )}
                </div>
                <p className="font-medium text-gray-900 dark:text-white group-hover:text-brand-600 transition">
                  {report.submitted_by_username}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Finalized: {fmtDate(report.finalized_at || report.submitted_at)}</p>
              </div>
              <ChevronRight size={16} className="text-gray-400 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Payment Approvals ──────────────────────
const PaymentApprovals: React.FC = () => {
  const [payments, setPayments] = useState<InspectionPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    inspectionApi.payments.pending()
      .then((r: any) => setPayments(r.data.results || r.data))
      .catch(() => toast.error('Failed to load payments'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleApprove = async (id: number) => {
    try {
      await inspectionApi.payments.approve(id);
      toast.success('Payment approved');
      load();
    } catch { toast.error('Failed to approve'); }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try {
      await inspectionApi.payments.reject(id, reason || 'Rejected');
      toast.success('Payment rejected');
      load();
    } catch { toast.error('Failed to reject'); }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Payment Approvals</h2>
      {payments.length === 0 ? (
        <div className="card p-10 text-center">
          <CreditCard size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-400">No pending payments</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white capitalize">{p.stage} Payment</p>
                  <p className="text-sm text-gray-500 mt-0.5">Amount: <span className="font-medium text-gray-900 dark:text-white">{fmtMoney(p.amount)}</span></p>
                  {p.transaction_reference && (
                    <p className="text-xs text-gray-400 mt-0.5">Ref: {p.transaction_reference}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{fmtDate(p.created_at)}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {p.proof_image && (
                    <a href={p.proof_image} target="_blank" rel="noreferrer"
                      className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                      <Eye size={12} /> View Proof
                    </a>
                  )}
                  <button onClick={() => handleApprove(p.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button onClick={() => handleReject(p.id)}
                    className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition">
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Fraud Flags Panel ──────────────────────
const FraudFlagsPanel: React.FC = () => {
  const [flags, setFlags] = useState<FraudFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const location = useLocation();
  const base = location.pathname.startsWith('/staff-admin')
    ? '/staff-admin/inspections'
    : '/staff/inspections';

  const load = () => {
    inspectionApi.fraudFlags.list()
      .then((r: any) => setFlags(r.data.results || r.data))
      .catch(() => toast.error('Failed to load flags'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleResolve = async (id: number) => {
    try {
      await inspectionApi.fraudFlags.resolve(id);
      toast.success('Flag resolved');
      load();
    } catch { toast.error('Failed to resolve'); }
  };

  if (loading) return <Spinner />;

  const unresolved = flags.filter((f) => !f.resolved);
  const resolved = flags.filter((f) => f.resolved);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Fraud Flags</h2>
      {unresolved.length === 0 && (
        <div className="card p-8 text-center">
          <Shield size={40} className="mx-auto text-green-400 mb-3" />
          <p className="text-gray-500">No active fraud flags</p>
        </div>
      )}
      {unresolved.map((f) => (
        <div key={f.id} className="card p-4 border-l-4 border-red-400">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-red-500" />
                <Badge text={f.flag_type.replace(/_/g, ' ')} className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" />
                <Link to={`${base}/request/${f.request}`}
                  className="text-xs text-brand-600 hover:underline font-mono">{f.request_id}</Link>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">{f.details}</p>
              <p className="text-xs text-gray-400 mt-1">{fmtDate(f.created_at)}</p>
            </div>
            <button onClick={() => handleResolve(f.id)}
              className="btn-ghost text-xs px-3 py-1.5 text-green-600 shrink-0">
              Resolve
            </button>
          </div>
        </div>
      ))}
      {resolved.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Resolved ({resolved.length})</h3>
          {resolved.map((f) => (
            <div key={f.id} className="card p-3 opacity-50 mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-green-500" />
                <Badge text={f.flag_type.replace(/_/g, ' ')} className="badge-gray" />
                <span className="text-xs font-mono text-gray-400">{f.request_id}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Inspector Performance ──────────────────
const InspectorPerformance: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inspectionApi.inspectors.performance()
      .then((r: any) => setData(r.data.results || r.data))
      .catch(() => toast.error('Failed to load performance data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Inspector Performance</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((p: any) => (
          <div key={p.id} className={`card p-4 ${!p.is_available ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-gray-900 dark:text-white">{p.username}</p>
              <Badge text={p.level} className="badge-blue capitalize" />
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Score</span>
                <span className={`font-bold ${p.performance_score >= 80 ? 'text-green-600' : p.performance_score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {p.performance_score}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Completed</span>
                <span className="font-medium text-gray-900 dark:text-white">{p.total_inspections}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Flags</span>
                <span className={`font-medium ${p.total_flags > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{p.total_flags}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Available</span>
                <span className={p.is_available ? 'text-green-600' : 'text-gray-400'}>
                  {p.is_available ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
            {/* Score bar */}
            <div className="mt-3 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${p.performance_score >= 80 ? 'bg-green-500' : p.performance_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${p.performance_score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Staff Inspection Layout ────────────────

const StaffInspectionLayout: React.FC<{ user?: any }> = ({ user }) => {
  const location = useLocation();

  const isSuper = localStorage.getItem('is_superuser') === 'true';
  const hasManagePerm = isSuper || user?.permissions?.includes('can_manage_inspections');

  // Detect whether we're under /staff-admin or /staff
  const base = location.pathname.startsWith('/staff-admin')
    ? '/staff-admin/inspections'
    : '/staff/inspections';

  const navItems = [
    { path: base, label: 'Overview', icon: LayoutDashboard, exact: true, show: true },
    { path: `${base}/requests`, label: 'All Requests', icon: ClipboardList, show: hasManagePerm },
    { path: `${base}/dispatch`, label: 'Dispatcher', icon: Clock, show: hasManagePerm },
    { path: `${base}/qa`, label: 'QA Queue', icon: CheckCircle2, show: hasManagePerm },
    { path: `${base}/payments`, label: 'Payments', icon: CreditCard, show: hasManagePerm },
    { path: `${base}/fraud`, label: 'Fraud Flags', icon: AlertTriangle, show: hasManagePerm },
    { path: `${base}/performance`, label: 'Performance', icon: BarChart2, show: hasManagePerm },
  ].filter(item => item.show);

  return (
    <div className="container-page py-6">
      <Breadcrumbs />
      
      <div className="flex flex-col lg:flex-row gap-6 mt-4">
      <aside className="w-full lg:w-56 shrink-0">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-2 space-y-1">
          <div className="px-3 py-2 mb-1">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Inspections</h3>
          </div>
          {navItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path) && item.path !== '/staff/inspections';
            const exactActive = item.exact && location.pathname === item.path;
            const active = item.exact ? exactActive : isActive;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  active
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}>
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Routes>
          <Route index element={<StaffInspectionDashboard hasPerm={hasManagePerm} />} />
          <Route path="requests" element={hasManagePerm ? <AllRequests /> : <Navigate to={base} />} />
          <Route path="request/:id" element={hasManagePerm ? <StaffRequestDetail /> : <Navigate to={base} />} />
          <Route path="dispatch" element={hasManagePerm ? <DispatcherQueue /> : <Navigate to={base} />} />
          <Route path="qa" element={hasManagePerm ? <QAQueue /> : <Navigate to={base} />} />
          <Route path="payments" element={hasManagePerm ? <PaymentApprovals /> : <Navigate to={base} />} />
          <Route path="fraud" element={hasManagePerm ? <FraudFlagsPanel /> : <Navigate to={base} />} />
          <Route path="performance" element={hasManagePerm ? <InspectorPerformance /> : <Navigate to={base} />} />
        </Routes>
      </main>
    </div>
  </div>
);
};

export default StaffInspectionLayout;
