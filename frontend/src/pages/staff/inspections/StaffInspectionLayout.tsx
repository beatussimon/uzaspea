import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Link, useLocation, useParams, Navigate } from 'react-router-dom';
import {
  ChevronRight, Shield, Clock, Eye, ClipboardList, CheckCircle2, CreditCard,
  AlertTriangle, XCircle, LayoutDashboard, BarChart2, Search, Users, ChevronLeft,
  Phone, Mail, User, AlertOctagon, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Breadcrumbs from '../../../components/Breadcrumbs';
import inspectionApi from '../../../api/inspectionApi';
import {
  InspectionRequest, InspectionPayment, FraudFlag,
  STATUS_LABELS, STATUS_COLORS, VERDICT_COLORS,
  fmtDate, fmtMoney,
} from '../../../types/inspection';
import { KpiCard } from '../../../components/ui/KpiCard';
import {
  PageHeaderSkeleton,
  KpiGridSkeleton,
  TableSkeleton,
  CardListSkeleton,
  CardGridSkeleton
} from '../../../components/Skeleton';

const Spinner = () => (
  <div className="flex justify-center py-16">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
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

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeaderSkeleton />
        <KpiGridSkeleton count={4} cols={4} />
        <CardGridSkeleton count={6} cols={3} />
      </div>
    );
  }

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
    { label: 'Total Requests', val: stats?.total || 0, icon: LayoutDashboard },
    { label: 'Pending QA', val: stats?.pending_qa || 0, icon: CheckCircle2, color: '#a855f7' },
    { label: 'Fraud Flags', val: stats?.fraud_flags || 0, icon: AlertTriangle, color: '#ef4444' },
    { label: 'SLA Breaches', val: stats?.sla_breaches || 0, icon: Clock, color: '#f97316' },
  ];

  const statusRows = Object.entries(stats?.by_status || {}).filter(([, v]) => (v as number) > 0);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Inspection Overview</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {statCards.map((c) => (
          <KpiCard
            key={c.label}
            label={c.label}
            value={c.val}
            icon={c.icon}
            color={c.color}
          />
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
          { to: `${base}/dispatch`, label: 'Dispatcher Queue', icon: ClipboardList, color: 'text-brand-500' },
          { to: `${base}/qa`, label: 'QA Review Queue', icon: CheckCircle2, color: 'text-purple-500' },
          { to: `${base}/payments`, label: 'Payment Approvals', icon: CreditCard, color: 'text-green-500' },
        ].map((item) => (
          <Link key={item.to} to={item.to}
            className="card p-4 flex items-center gap-3 hover:shadow-card-hover transition group">
            <item.icon size={20} className={item.color} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-brand-500 transition">
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

  if (loading) return <TableSkeleton rows={6} cols={6} />;

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
              <p className="font-semibold text-gray-900 dark:text-white group-hover:text-brand-500 transition line-clamp-1">
                {req.item_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {req.client_username} • {req.category_path}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">{fmtDate(req.created_at)}</p>
              {req.has_report && <p className="text-xs text-green-500 mt-1">Report ready</p>}
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
  const [baseRate, setBaseRate] = useState(50000);
  const [timePercent, setTimePercent] = useState(0);
  const [complexityPercent, setComplexityPercent] = useState(0);
  const [travelKm, setTravelKm] = useState(0);
  const [includeWarranty, setIncludeWarranty] = useState(false);
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

        if (!req.bill) {
          const catBase = 50000;
          setBaseRate(catBase);
          setTimePercent(req.turnaround === 'instant' ? 60 : req.turnaround === 'express' ? 30 : 0);
          setComplexityPercent(req.is_complex ? 30 : (req.item_age_years && req.item_age_years > 5) ? 15 : 0);
          setTravelKm(0);
          setIncludeWarranty(Boolean(req.reinspection_coverage));
        }

        return inspectionApi.inspectors.available(req.category, showAllInspectors);
      })
      .then((r: any) => setInspectors(r.data.results || r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id, showAllInspectors]);

  // Real-time bill calculations
  const numBase = Math.max(0, Number(baseRate) || 0);
  const turnaroundSurcharge = Math.round(numBase * (timePercent / 100));
  const complexitySurcharge = Math.round(numBase * (complexityPercent / 100));
  const travelSurcharge = travelKm * 1000;
  const warrantyFee = includeWarranty ? Math.round(numBase * 0.1) : 0;

  const totalBillAmount = numBase + turnaroundSurcharge + complexitySurcharge + travelSurcharge + warrantyFee;
  const depositBillAmount = Math.round(totalBillAmount * 0.3);
  const remainingBillAmount = totalBillAmount - depositBillAmount;

  const handleGenerateBill = async () => {
    if (!request) return;
    if (totalBillAmount <= 0) {
      toast.error('Please enter a valid base rate');
      return;
    }
    setGeneratingBill(true);
    try {
      await inspectionApi.requests.generateBill(request.id, {
        base_rate: numBase,
        turnaround_surcharge: turnaroundSurcharge,
        inspector_level_surcharge: 0,
        complexity_surcharge: complexitySurcharge,
        travel_surcharge: travelSurcharge,
        reinspection_coverage_fee: warrantyFee,
      });
      toast.success('Bill generated and sent to client');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to generate bill');
    } finally {
      setGeneratingBill(false);
    }
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
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-5 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link to="/staff/inspections" className="text-xs text-brand-500 hover:underline">
                ← Back
              </Link>
              <Badge text={STATUS_LABELS[request.status] || request.status}
                className={STATUS_COLORS[request.status] || 'badge-gray'} />
              <span className="font-mono text-xs text-gray-400">{request.inspection_id}</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
              {request.item_name}
            </h1>
            <p className="text-sm text-gray-500">
              Client: {request.client_username} • Category: {request.category_path}
            </p>
          </div>

          {/* Quick status actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {request.status === 'deposit_paid' && (
              <button onClick={() => handleUpdateStatus('assigned')} className="btn-secondary text-xs py-1.5 px-3">
                Mark Assigned
              </button>
            )}
            {request.status === 'assigned' && (
              <button onClick={() => handleUpdateStatus('in_progress')} className="btn-secondary text-xs py-1.5 px-3">
                Start Inspection
              </button>
            )}
            {request.status === 'submitted' && (
              <button onClick={() => handleUpdateStatus('qa_review')} className="btn-secondary text-xs py-1.5 px-3">
                Move to QA Review
              </button>
            )}
          </div>
        </div>

        {/* Item metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-surface-border dark:border-surface-dark-border text-xs">
          <div>
            <span className="text-gray-400 block">Scope</span>
            <span className="font-medium text-gray-900 dark:text-white capitalize">{request.scope}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Turnaround</span>
            <span className="font-medium text-gray-900 dark:text-white capitalize">{request.turnaround}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Location</span>
            <span className="font-medium text-gray-900 dark:text-white truncate block">{request.item_address}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Re-inspection</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {request.reinspection_coverage ? 'Yes (+10%)' : 'No'}
            </span>
          </div>
        </div>

        {request.item_description && (
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-xs">
            <span className="text-gray-400 font-bold uppercase tracking-wider block mb-1">Item Description / Client Notes</span>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{request.item_description}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bill */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-brand-500" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Inspection Bill</h3>
            </div>
            {request.bill ? (
              <span className="text-2xs font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Bill Sent
              </span>
            ) : (
              <span className="text-2xs font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                Pending Staff Entry
              </span>
            )}
          </div>

          {/* Minimal requested specs */}
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap pb-1 border-b border-gray-100 dark:border-gray-800">
            <span>Scope: <strong className="text-gray-700 dark:text-gray-200 capitalize">{request.scope}</strong></span>
            <span>•</span>
            <span>Speed: <strong className="text-gray-700 dark:text-gray-200 capitalize">{request.turnaround}</strong></span>
            <span>•</span>
            <span>Category: <strong className="text-gray-700 dark:text-gray-200">{request.category_name}</strong></span>
          </div>

          {request.bill ? (
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Base Rate</span>
                <span className="font-medium text-gray-900 dark:text-white">{fmtMoney(request.bill.base_rate)}</span>
              </div>
              {Number(request.bill.turnaround_surcharge) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Turnaround Urgency</span>
                  <span className="font-medium text-gray-900 dark:text-white">+{fmtMoney(request.bill.turnaround_surcharge)}</span>
                </div>
              )}
              {Number(request.bill.complexity_surcharge) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Complexity Factor</span>
                  <span className="font-medium text-gray-900 dark:text-white">+{fmtMoney(request.bill.complexity_surcharge)}</span>
                </div>
              )}
              {Number(request.bill.travel_surcharge) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Travel Surcharge</span>
                  <span className="font-medium text-gray-900 dark:text-white">+{fmtMoney(request.bill.travel_surcharge)}</span>
                </div>
              )}
              {Number(request.bill.reinspection_coverage_fee) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Re-inspection Warranty</span>
                  <span className="font-medium text-gray-900 dark:text-white">+{fmtMoney(request.bill.reinspection_coverage_fee)}</span>
                </div>
              )}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-2 flex justify-between font-bold text-xs text-gray-900 dark:text-white">
                <span>Total: {fmtMoney(request.bill.total_amount)}</span>
                <span className="text-2xs text-brand-500 font-normal">
                  Deposit: {fmtMoney(request.bill.deposit_amount)} • Balance: {fmtMoney(request.bill.remaining_balance)}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-0.5">
              {/* Base Rate */}
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Base Rate (TZS)</label>
                <input
                  type="number"
                  min="0"
                  step="5000"
                  className="input py-1 px-2.5 text-xs w-36 text-right font-semibold"
                  value={baseRate}
                  onChange={(e) => setBaseRate(Number(e.target.value))}
                />
              </div>

              {/* Time / Speed Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Time / Urgency ({timePercent === 0 ? 'Standard' : timePercent === 30 ? 'Express' : 'Urgent'})</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {turnaroundSurcharge > 0 ? `+TZS ${turnaroundSurcharge.toLocaleString()}` : 'TZS 0'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="15"
                  className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                  value={timePercent}
                  onChange={(e) => setTimePercent(Number(e.target.value))}
                />
              </div>

              {/* Complexity Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Complexity ({complexityPercent === 0 ? 'Standard' : complexityPercent <= 15 ? 'Moderate' : complexityPercent <= 30 ? 'High' : 'Specialized'})</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {complexitySurcharge > 0 ? `+TZS ${complexitySurcharge.toLocaleString()}` : 'TZS 0'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="45"
                  step="15"
                  className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                  value={complexityPercent}
                  onChange={(e) => setComplexityPercent(Number(e.target.value))}
                />
              </div>

              {/* Travel Distance Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Travel Distance ({travelKm} km)</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {travelSurcharge > 0 ? `+TZS ${travelSurcharge.toLocaleString()}` : 'TZS 0'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                  value={travelKm}
                  onChange={(e) => setTravelKm(Number(e.target.value))}
                />
              </div>

              {/* Re-inspection Warranty Checkbox */}
              <label className="flex items-center gap-2 pt-1 cursor-pointer text-xs text-gray-700 dark:text-gray-300 select-none">
                <input
                  type="checkbox"
                  checked={includeWarranty}
                  onChange={(e) => setIncludeWarranty(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-brand-500 focus:ring-0"
                />
                <span>Include re-inspection warranty (+10%: TZS {warrantyFee.toLocaleString()})</span>
              </label>

              {/* Compact Summary & Send Action */}
              <div className="pt-2.5 border-t border-gray-100 dark:border-gray-700 space-y-2">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="font-bold text-gray-900 dark:text-white">Total: TZS {totalBillAmount.toLocaleString()}</span>
                  <span className="text-2xs text-gray-500">
                    Deposit (30%): TZS {depositBillAmount.toLocaleString()} • Balance (70%): TZS {remainingBillAmount.toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={handleGenerateBill}
                  disabled={generatingBill || totalBillAmount <= 0}
                  className="w-full btn-primary py-2 text-xs font-semibold rounded-lg shadow-none"
                >
                  {generatingBill ? 'Generating Bill...' : 'Generate & Send Bill'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Assignment */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users size={16} className="text-brand-500" /> Assignment
          </h3>
          {request.assignment ? (
            <div className="space-y-2 text-sm">
              <div className="p-3 rounded-lg   border border-green-500 dark:border-green-500">
                <p className="font-medium text-green-500 dark:text-green-500">{request.assignment.inspector_name}</p>
                <Badge text={request.assignment.inspector_level} className="badge-blue capitalize mt-1" />
                <div className="flex items-center gap-3 mt-1 text-xs font-medium text-green-500 dark:text-green-500">
                  {request.assignment.inspector_phone && <span>📞 {request.assignment.inspector_phone}</span>}
                  {request.assignment.inspector_email && <span>✉️ {request.assignment.inspector_email}</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  SLA: {request.assignment.sla_deadline ? fmtDate(request.assignment.sla_deadline) : '—'}
                </p>
              </div>
              {request.assignment.job_contact && (
                <div className="p-3 rounded-lg   border border-brand-500 dark:border-brand-500/30">
                  <p className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">Job Contact</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {request.assignment.job_contact.name} <span className="text-xs font-normal text-gray-500">({request.assignment.job_contact.label})</span>
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs font-medium text-brand-500 dark:text-brand-500">
                    {request.assignment.job_contact.phone && (
                      <a href={`tel:${request.assignment.job_contact.phone}`} className="hover:underline">📞 {request.assignment.job_contact.phone}</a>
                    )}
                    {request.assignment.job_contact.email && (
                      <a href={`mailto:${request.assignment.job_contact.email}`} className="hover:underline">✉️ {request.assignment.job_contact.email}</a>
                    )}
                  </div>
                </div>
              )}
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
                <div className="p-3 rounded-lg   border border-orange-500 dark:border-orange-500">
                   <p className="text-xs text-orange-500 dark:text-orange-500">
                     No inspectors are certified for this specific category yet.
                   </p>
                   <button 
                     onClick={() => setShowAllInspectors(true)}
                     className="text-xs font-bold text-brand-500 hover:underline mt-1">
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
        <div className="card p-5 text-sm space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Payments</h3>
          <div className="space-y-2">
            {request.payments.map((p: any) => (
              <div key={p.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-surface-border dark:border-surface-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white capitalize">{p.stage} Payment</span>
                    <Badge text={p.status} className={p.status === 'approved' ? 'text-green-500 bg-green-50 dark:bg-green-950/40' : p.status === 'rejected' ? 'text-red-500 bg-red-50 dark:bg-red-950/40' : 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'} />
                  </div>
                  {p.transaction_reference && (
                    <p className="text-xs text-gray-400 font-mono">Ref: {p.transaction_reference}</p>
                  )}
                  {(p.client_name || p.client_phone || p.client_email) && (
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap pt-0.5">
                      {p.client_name && (
                        <span className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                          <User size={12} className="text-gray-400" /> {p.client_name}
                        </span>
                      )}
                      {p.client_phone && (
                        <a href={`tel:${p.client_phone}`} className="flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline">
                          <Phone size={12} /> {p.client_phone}
                        </a>
                      )}
                      {p.client_email && (
                        <a href={`mailto:${p.client_email}`} className="flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline">
                          <Mail size={12} /> {p.client_email}
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <div className="sm:text-right">
                  <span className="text-base font-black text-gray-900 dark:text-white">{fmtMoney(p.amount)}</span>
                  <p className="text-[11px] text-gray-400">{fmtDate(p.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QA Review */}
      {request.status === 'qa_review' && request.report && !request.report.is_locked && (
        <div className="card p-5 border-2 border-purple-500 dark:border-purple-500 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 size={16} className="text-purple-500" /> QA Review
          </h3>

          {/* Auto-Flag Warning & Reasons */}
          {((request.fraud_flags && request.fraud_flags.length > 0) || (request.report.qa_notes && request.report.qa_notes.includes('AUTO-FLAGGED'))) && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border-2 border-red-500/50 space-y-2">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-sm">
                <AlertOctagon size={18} className="shrink-0" />
                <span>Auto-Flagged Anomalies Detected</span>
              </div>
              {request.fraud_flags && request.fraud_flags.length > 0 ? (
                <div className="space-y-1.5 mt-2">
                  {request.fraud_flags.map((flag: any) => (
                    <div key={flag.id} className="text-xs flex items-start gap-2 bg-white/70 dark:bg-black/40 p-2.5 rounded-lg border border-red-200 dark:border-red-900/50">
                      <span className="font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 shrink-0">
                        {flag.flag_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-gray-800 dark:text-gray-200 flex-1">{flag.details}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">{fmtDate(flag.created_at)}</span>
                    </div>
                  ))}
                </div>
              ) : request.report.qa_notes && (
                <p className="text-xs text-red-700 dark:text-red-300 bg-white/70 dark:bg-black/40 p-2.5 rounded-lg border border-red-200 dark:border-red-900/50">
                  {request.report.qa_notes}
                </p>
              )}
            </div>
          )}

          {/* Report summary */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-surface-border dark:border-surface-dark-border space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-lg font-black uppercase ${
                request.report.verdict === 'pass' ? 'text-green-500 dark:text-green-500'
                : request.report.verdict === 'conditional' ? 'text-amber-500'
                : 'text-red-500'
              }`}>{request.report.verdict}</span>
              {request.report.quality_score && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Score: <span className="font-bold text-gray-900 dark:text-white">{parseFloat(request.report.quality_score).toFixed(1)}%</span>
                  {request.report.grade && <span className="ml-1 font-bold">({request.report.grade})</span>}
                </span>
              )}
            </div>
            {request.report.summary && (
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{request.report.summary}</p>
            )}
          </div>

          {/* Report responses grouped by section */}
          {request.report.responses && request.report.responses.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Checklist Responses ({request.report.responses.length})</p>
              {Object.entries(
                request.report.responses.reduce((acc: Record<string, any[]>, r: any) => {
                  const sec = r.section || 'General';
                  if (!acc[sec]) acc[sec] = [];
                  acc[sec].push(r);
                  return acc;
                }, {})
              ).map(([section, items]: [string, any[]]) => (
                <div key={section} className="border border-surface-border dark:border-surface-dark-border rounded-xl overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">{section}</span>
                    {items.filter(i => i.flagged).length > 0 && (
                      <span className="text-xs text-red-500 dark:text-red-500 font-semibold">
                        {items.filter(i => i.flagged).length} issues
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {items.map((r: any) => (
                      <div key={r.id} className={`px-4 py-2.5 flex items-center justify-between gap-3 text-sm ${
                        r.flagged ? ' ' : ''
                      }`}>
                        <div className="flex-1 min-w-0">
                          <span className={`font-medium ${r.flagged ? 'text-red-500 dark:text-red-500' : 'text-gray-900 dark:text-white'}`}>
                            {r.item_label}
                          </span>
                          <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            r.severity === 'critical' ? ' text-red-500  dark:text-red-500'
                            : r.severity === 'major' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                            : ' text-blue-500  dark:text-blue-500'
                          }`}>{r.severity}</span>
                          {r.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{r.notes}</p>}
                        </div>
                        <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${
                          r.flagged ? ' text-red-500  dark:text-red-500'
                          : ' text-green-500  dark:text-green-500'
                        }`}>{r.response_value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {request.report.qa_notes && !request.report.qa_notes.includes('AUTO-FLAGGED') && (
            <div className="p-3 rounded-lg   border border-orange-500 dark:border-orange-500">
              <p className="text-xs font-bold text-orange-500 dark:text-orange-500 uppercase tracking-wide mb-1">Previous QA Notes</p>
              <p className="text-sm text-orange-500 dark:text-orange-500">{request.report.qa_notes}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleQaApprove}
              className="flex-1 btn-primary bg-green-500 hover:bg-green-500 flex items-center justify-center gap-2 py-2.5">
              <CheckCircle2 size={15} /> Approve & Publish
            </button>
            <div className="flex-1 space-y-2">
              <input className="input text-xs" placeholder="QA notes for return..."
                value={qaNote} onChange={(e) => setQaNote(e.target.value)} />
              <button onClick={handleQaReturn}
                className="w-full btn-secondary text-orange-500 border-orange-500  py-2.5 flex items-center justify-center gap-2">
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

  if (loading) return <CardListSkeleton count={4} />;

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
                <p className="font-semibold text-gray-900 dark:text-white mt-1 group-hover:text-brand-500 transition">{req.item_name}</p>
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

  if (loading) return <CardListSkeleton count={4} />;

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
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge text={report.verdict.toUpperCase()} className={VERDICT_COLORS[report.verdict]} />
                  {report.qa_notes && report.qa_notes.includes('AUTO-FLAGGED') && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400">
                      <AlertTriangle size={11} /> Auto-Flagged
                    </span>
                  )}
                  {report.qa_notes && !report.qa_notes.includes('AUTO-FLAGGED') && (
                    <Badge text="Has QA Notes" className="bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400" />
                  )}
                </div>
                <p className="font-medium text-gray-900 dark:text-white group-hover:text-brand-500 transition">
                  {report.submitted_by_username}
                </p>
                {report.qa_notes && report.qa_notes.includes('AUTO-FLAGGED') && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1 line-clamp-1">
                    {report.qa_notes.replace('AUTO-FLAGGED:', '').trim()}
                  </p>
                )}
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchPayments = useCallback(async (pageNum: number, isAppend: boolean = false) => {
    if (isAppend) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const r: any = await inspectionApi.payments.pending(pageNum);
      const data = r.data;
      const results: InspectionPayment[] = Array.isArray(data) ? data : (data.results || []);
      const nextUrl = data.next;

      setPayments(prev => isAppend ? [...prev, ...results] : results);
      setHasMore(Boolean(nextUrl));
      setPage(pageNum);
    } catch {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments(1, false);
  }, [fetchPayments]);

  // Infinite scroll intersection observer
  useEffect(() => {
    if (loading || loadingMore || !hasMore) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        fetchPayments(page + 1, true);
      }
    }, { threshold: 0.1 });

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMore, loadingMore, loading, page, fetchPayments]);

  const handleApprove = async (id: number) => {
    try {
      await inspectionApi.payments.approve(id);
      toast.success('Payment approved');
      setPayments(prev => prev.filter(p => p.id !== id));
    } catch { toast.error('Failed to approve'); }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try {
      await inspectionApi.payments.reject(id, reason || 'Rejected');
      toast.success('Payment rejected');
      setPayments(prev => prev.filter(p => p.id !== id));
    } catch { toast.error('Failed to reject'); }
  };

  if (loading && payments.length === 0) return <CardGridSkeleton count={6} cols={3} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Payment Approvals</h2>
        {payments.length > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {payments.length} pending record{payments.length !== 1 ? 's' : ''} loaded
          </span>
        )}
      </div>

      {payments.length === 0 ? (
        <div className="card p-10 text-center">
          <CreditCard size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-400">No pending payments</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex items-start gap-4 flex-wrap">
                {/* Inline payment proof image */}
                {p.proof_image && (
                  <a href={p.proof_image} target="_blank" rel="noreferrer" className="shrink-0 group">
                    <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 relative">
                      <img src={p.proof_image} alt="Payment proof" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Eye size={16} className="text-white" />
                      </div>
                    </div>
                    <p className="text-[9px] text-center text-gray-400 mt-1">View full</p>
                  </a>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 dark:text-white capitalize">{p.stage} Payment</p>
                    <span className="text-base font-black text-brand-600 dark:text-brand-400 ml-auto sm:ml-0">
                      {fmtMoney(p.amount)}
                    </span>
                  </div>

                  {/* Client Contact Info for Accountant */}
                  {(p.client_name || p.client_phone || p.client_email) && (
                    <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-surface-border dark:border-surface-dark-border text-xs space-y-1 my-1.5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Client Contact Info</p>
                      <div className="flex items-center gap-3 flex-wrap text-gray-600 dark:text-gray-300">
                        {p.client_name && (
                          <span className="flex items-center gap-1 font-medium text-gray-900 dark:text-white">
                            <User size={13} className="text-gray-400" /> {p.client_name}
                          </span>
                        )}
                        {p.client_phone && (
                          <a href={`tel:${p.client_phone}`} className="flex items-center gap-1 text-brand-600 dark:text-brand-400 font-semibold hover:underline">
                            <Phone size={13} /> {p.client_phone}
                          </a>
                        )}
                        {p.client_email && (
                          <a href={`mailto:${p.client_email}`} className="flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline">
                            <Mail size={13} /> {p.client_email}
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                    {p.transaction_reference && (
                      <span className="font-mono">Ref: {p.transaction_reference}</span>
                    )}
                    <span>•</span>
                    <span>Submitted: {fmtDate(p.created_at)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap shrink-0 mt-2 sm:mt-0">
                  <button onClick={() => handleApprove(p.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition shadow-sm">
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button onClick={() => handleReject(p.id)}
                    className="flex items-center gap-1.5 px-4 py-2 border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-sm font-medium transition">
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Infinite scroll trigger / loader */}
          <div ref={sentinelRef} className="py-4 text-center">
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <Loader2 size={16} className="animate-spin text-brand-500" />
                <span>Loading more payment records...</span>
              </div>
            )}
            {!hasMore && payments.length > 0 && (
              <p className="text-xs text-gray-400 italic">All pending payments loaded</p>
            )}
          </div>
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

  if (loading) return <CardListSkeleton count={4} />;

  const unresolved = flags.filter((f) => !f.resolved);
  const resolved = flags.filter((f) => f.resolved);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Fraud Flags</h2>
      {unresolved.length === 0 && (
        <div className="card p-8 text-center">
          <Shield size={40} className="mx-auto text-green-500 mb-3" />
          <p className="text-gray-500">No active fraud flags</p>
        </div>
      )}
      {unresolved.map((f) => (
        <div key={f.id} className="card p-4 border-l-4 border-red-500">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-red-500" />
                <Badge text={f.flag_type.replace(/_/g, ' ')} className=" text-red-500  dark:text-red-500" />
                <Link to={`${base}/request/${f.request}`}
                  className="text-xs text-brand-500 hover:underline font-mono">{f.request_id}</Link>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">{f.details}</p>
              <p className="text-xs text-gray-400 mt-1">{fmtDate(f.created_at)}</p>
            </div>
            <button onClick={() => handleResolve(f.id)}
              className="btn-ghost text-xs px-3 py-1.5 text-green-500 shrink-0">
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

  if (loading) return <CardGridSkeleton count={6} cols={3} />;

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
                <span className={`font-bold ${p.performance_score >= 80 ? 'text-green-500' : p.performance_score >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
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
                <span className={p.is_available ? 'text-green-500' : 'text-gray-400'}>
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

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('inspection_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    const newVal = !isSidebarCollapsed;
    setIsSidebarCollapsed(newVal);
    localStorage.setItem('inspection_sidebar_collapsed', String(newVal));
  };

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
      <aside className={`w-full ${isSidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-56'} transition-all duration-300 shrink-0`}>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-2 space-y-1">
          <div className="px-3 py-2 mb-1 flex items-center justify-between">
            {!isSidebarCollapsed && (
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Inspections</h3>
            )}
            <button
              onClick={toggleSidebar}
              className={`p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition ${isSidebarCollapsed ? 'mx-auto' : ''}`}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
          {navItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path) && item.path !== '/staff/inspections';
            const exactActive = item.exact && location.pathname === item.path;
            const active = item.exact ? exactActive : isActive;
            return (
              <Link key={item.path} to={item.path}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm transition ${
                  active
                    ? '  text-brand-500 dark:text-brand-500 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}>
                <item.icon size={16} className="shrink-0" />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </aside>

      <main className="flex-1 min-w-0 transition-all duration-300">
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
