import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import {
  ClipboardList, Camera, MapPin, CheckCircle,
  AlertTriangle, ChevronRight, Send, LogIn, LogOut,
} from 'lucide-react';
import toast from 'react-hot-toast';
import inspectionApi from '../../api/inspectionApi';
import {
  InspectionRequest, ChecklistTemplate, ChecklistItem,
  STATUS_LABELS, STATUS_COLORS, fmtDate,
} from '../../types/inspection';

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

// ─── Geolocation helper ─────────────────────
function getLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// ─── Inspector Job Queue ────────────────────
const InspectorJobs: React.FC = () => {
  const [jobs, setJobs] = useState<InspectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      inspectionApi.requests.myJobs(),
      inspectionApi.inspectors.me(),
    ])
      .then(([jobsRes, profileRes]: any[]) => {
        setJobs(jobsRes.data.results || jobsRes.data);
        setProfile(profileRes.data);
      })
      .catch(() => toast.error('Failed to load jobs'))
      .finally(() => setLoading(false));
  }, []);

  const toggleAvailability = async () => {
    if (!profile) return;
    try {
      await inspectionApi.inspectors.update(profile.id, {
        is_available: !profile.is_available,
      });
      setProfile({ ...profile, is_available: !profile.is_available });
      toast.success(`You are now ${!profile.is_available ? 'available' : 'unavailable'}`);
    } catch { toast.error('Failed to update availability'); }
  };

  if (loading) return <Spinner />;

  const active = jobs.filter((j) => !['published', 'cancelled'].includes(j.status));
  const completed = jobs.filter((j) => j.status === 'published');

  return (
    <div className="space-y-5">
      {/* Profile bar */}
      {profile && (
        <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{profile.full_name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge text={profile.level} className="badge-blue capitalize" />
              <span className="text-xs text-gray-500">Score: {profile.performance_score}</span>
              <span className="text-xs text-gray-500">•</span>
              <span className="text-xs text-gray-500">{profile.total_inspections} completed</span>
            </div>
          </div>
          <button
            onClick={toggleAvailability}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              profile.is_available
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'
            }`}
          >
            {profile.is_available ? '● Available' : '○ Unavailable'}
          </button>
        </div>
      )}

      <h2 className="text-xl font-bold text-gray-900 dark:text-white">My Jobs</h2>

      {/* Active jobs */}
      {active.length === 0 && completed.length === 0 ? (
        <div className="card p-12 text-center">
          <ClipboardList size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No jobs assigned yet</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Active</h3>
              {active.map((job) => (
                <button
                  key={job.id}
                  onClick={() => navigate(`/inspector/jobs/${job.id}`)}
                  className="card p-4 w-full text-left hover:shadow-card-hover transition group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <Badge
                        text={STATUS_LABELS[job.status] || job.status}
                        className={STATUS_COLORS[job.status] || 'badge-gray'}
                      />
                      <h3 className="font-semibold text-gray-900 dark:text-white mt-1 group-hover:text-brand-600 transition line-clamp-1">
                        {job.item_name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{job.category_path}</p>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <MapPin size={10} /> {job.item_address}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">{fmtDate(job.created_at)}</p>
                      <ChevronRight size={16} className="text-gray-400 mt-2 ml-auto" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                Completed ({completed.length})
              </h3>
              {completed.map((job) => (
                <button
                  key={job.id}
                  onClick={() => navigate(`/inspector/jobs/${job.id}`)}
                  className="card p-4 w-full text-left opacity-75 hover:opacity-100 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{job.item_name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{job.inspection_id}</p>
                    </div>
                    <Badge text="Published" className="badge-green" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Capture Photo with GPS ─────────────────
const PhotoCapture: React.FC<{
  label: string;
  onCapture: (file: File, lat: number | null, lng: number | null) => void;
  captured?: boolean;
}> = ({ label, onCapture, captured }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await getLocation();
      lat = pos.lat;
      lng = pos.lng;
    } catch {
      toast('Location unavailable — photo saved without GPS', { icon: '⚠️' });
    }
    onCapture(file, lat, lng);
    toast.success(`${label} captured`);
  };

  return (
    <label className={`flex flex-col items-center gap-2 p-5 border-2 border-dashed rounded-xl cursor-pointer transition ${
      captured
        ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
        : 'border-surface-border dark:border-surface-dark-border hover:border-brand-400 bg-white dark:bg-gray-800'
    }`}>
      {captured ? (
        <CheckCircle size={28} className="text-green-500" />
      ) : (
        <Camera size={28} className="text-gray-400" />
      )}
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {captured ? `${label} ✓` : label}
      </span>
      <span className="text-xs text-gray-400">GPS auto-tagged</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />
    </label>
  );
};

// ─── Checklist Form ─────────────────────────
const ChecklistForm: React.FC<{
  template: ChecklistTemplate;
  requestId: number;
  reportId: number;
  onComplete: () => void;
}> = ({ template, requestId, reportId, onComplete }) => {
  const [responses, setResponses] = useState<Record<number, { value: string; notes: string }>>({});
  const [evidence, setEvidence] = useState<Record<number, { file: File; lat: number | null; lng: number | null }>>({});
  const [submitting, setSubmitting] = useState(false);

  // Load draft
  useEffect(() => {
    const saved = localStorage.getItem(`draft_${requestId}`);
    if (saved) {
      try {
        setResponses(JSON.parse(saved));
      } catch (e) { console.error('Failed to parse draft', e); }
    }
  }, [requestId]);

  // Save draft
  useEffect(() => {
    if (Object.keys(responses).length > 0) {
      localStorage.setItem(`draft_${requestId}`, JSON.stringify(responses));
    }
  }, [responses, requestId]);

  const handleResponse = (itemId: number, value: string) => {
    setResponses((prev) => ({ ...prev, [itemId]: { ...prev[itemId], value, notes: prev[itemId]?.notes || '' } }));
  };

  const handleNotes = (itemId: number, notes: string) => {
    setResponses((prev) => ({ ...prev, [itemId]: { ...prev[itemId], notes, value: prev[itemId]?.value || '' } }));
  };

  const handleEvidence = (itemId: number, file: File, lat: number | null, lng: number | null) => {
    setEvidence((prev) => ({ ...prev, [itemId]: { file, lat, lng } }));
  };

  const handleSubmit = async () => {
    // Validate mandatory items
    const missing = template.items
      .filter((item) => item.is_mandatory && !responses[item.id]?.value)
      .map((item) => item.label);
    if (missing.length > 0) {
      toast.error(`Complete mandatory items: ${missing.slice(0, 2).join(', ')}${missing.length > 2 ? '…' : ''}`);
      return;
    }

    const missingMedia = template.items
      .filter((item) => item.item_type === 'media' && item.is_mandatory && !evidence[item.id])
      .map((item) => item.label);
    if (missingMedia.length > 0) {
      toast.error(`Upload required photos: ${missingMedia[0]}`);
      return;
    }

    setSubmitting(true);
    try {
      // Submit checklist responses
      const responsePayloads = template.items
        .filter((item) => responses[item.id]?.value)
        .map((item) => ({
          report: reportId,
          checklist_item: item.id,
          response_value: responses[item.id].value,
          notes: responses[item.id].notes || '',
        }));
      if (!reportId) {
        toast.error('Report session expired. Please refresh and try again.');
        setSubmitting(false);
        return;
      }
      await inspectionApi.responses.bulkSubmit(responsePayloads);

      // Upload evidence photos
      for (const [itemIdStr, ev] of Object.entries(evidence)) {
        const fd = new FormData();
        fd.append('request', String(requestId));
        fd.append('checklist_item', itemIdStr);
        fd.append('image', ev.file);
        if (ev.lat !== null) fd.append('latitude', String(ev.lat));
        if (ev.lng !== null) fd.append('longitude', String(ev.lng));
        await inspectionApi.evidence.submit(fd);
      }

      toast.success('Checklist submitted!');
      localStorage.removeItem(`draft_${requestId}`);
      onComplete();
    } catch (err: any) {
      const msg = err?.response?.data?.detail
        || err?.response?.data?.checkin_photo?.[0]
        || err?.response?.data?.request?.[0]
        || 'Failed to submit checklist';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = (item: ChecklistItem) => (
    <div key={item.id} className={`p-4 rounded-xl border ${
      item.is_mandatory
        ? 'border-surface-border dark:border-surface-dark-border'
        : 'border-dashed border-gray-200 dark:border-gray-700'
    } bg-white dark:bg-gray-800`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {item.label}
            {item.is_mandatory && <span className="text-red-500 ml-1">*</span>}
          </p>
          {item.help_text && (
            <p className="text-xs text-gray-400 mt-0.5">{item.help_text}</p>
          )}
        </div>
        {!item.is_mandatory && (
          <span className="text-xs text-gray-400 shrink-0">Optional</span>
        )}
      </div>

      {item.item_type === 'pass_fail' && (
        <div className="flex gap-2">
          {['Pass', 'Fail'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => handleResponse(item.id, v)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition border ${
                responses[item.id]?.value === v
                  ? v === 'Pass'
                    ? 'bg-green-100 text-green-700 border-green-400 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700'
                    : 'bg-red-100 text-red-700 border-red-400 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'
                  : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 border-surface-border dark:border-surface-dark-border hover:border-gray-400'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {item.item_type === 'scale' && (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleResponse(item.id, String(n))}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition border ${
                responses[item.id]?.value === String(n)
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 border-surface-border dark:border-surface-dark-border hover:border-brand-400'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {item.item_type === 'measurement' && (
        <div className="flex gap-2 items-center">
          <input
            className="input flex-1"
            type="number"
            placeholder="Enter value"
            value={responses[item.id]?.value || ''}
            onChange={(e) => handleResponse(item.id, e.target.value)}
          />
          {item.unit && (
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 shrink-0">{item.unit}</span>
          )}
        </div>
      )}

      {item.item_type === 'text' && (
        <textarea
          className="input"
          rows={2}
          placeholder="Enter notes..."
          value={responses[item.id]?.value || ''}
          onChange={(e) => handleResponse(item.id, e.target.value)}
        />
      )}

      {item.item_type === 'media' && (
        <PhotoCapture
          label={`Photo: ${item.label}`}
          onCapture={(file, lat, lng) => {
            handleResponse(item.id, 'Photo captured');
            handleEvidence(item.id, file, lat, lng);
          }}
          captured={!!evidence[item.id]}
        />
      )}

      {/* Notes for non-text items */}
      {item.item_type !== 'text' && (
        <input
          className="input mt-2 text-xs"
          placeholder="Add note (optional)"
          value={responses[item.id]?.notes || ''}
          onChange={(e) => handleNotes(item.id, e.target.value)}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 text-xs text-brand-700 dark:text-brand-300 flex items-center gap-2">
        <AlertTriangle size={14} />
        Items marked * are mandatory. All photos are GPS-tagged automatically.
      </div>

      {template.items.map(renderItem)}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full btn-primary py-3 font-semibold flex items-center justify-center gap-2"
      >
        <Send size={16} />
        {submitting ? 'Submitting Checklist…' : 'Save Checklist'}
      </button>
    </div>
  );
};

// ─── Job Execution Page ─────────────────────
const JobExecution: React.FC = () => {
  const { id } = useParams();
  const [job, setJob] = useState<InspectionRequest | null>(null);
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'checkin' | 'checklist' | 'verdict' | 'done'>('checkin');
  const [checkinData, setCheckinData] = useState<{ file: File; lat: number | null; lng: number | null } | null>(null);
  const [checkoutData, setCheckoutData] = useState<{ file: File; lat: number | null; lng: number | null } | null>(null);
  const [reportId, setReportId] = useState<number | null>(null);
  const [extraDocs, setExtraDocs] = useState<File[]>([]);
  const [verdict, setVerdict] = useState('');
  const [summary, setSummary] = useState('');
  const [submittingCheckin, setSubmittingCheckin] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);

  const load = () => {
    inspectionApi.requests.get(Number(id))
      .then((r: any) => {
        const job = r.data;
        setJob(job);
        if (job.report) {
          setReportId(job.report.id);
          if (job.report.is_locked) {
            setStep('done');
          } else {
            // If it's in QA review but not locked, it's pending staff action,
            // but the inspector sees it as "done" or "locked" from their side.
            // However, our backend status matches.
            setStep(job.status === 'qa_review' ? 'done' : 'checklist');
          }
        } else if (job.status === 'in_progress') {
          setStep('checklist');
        }
        return inspectionApi.templates.forCategory(job.category);
      })
      .then((r: any) => setTemplate(r.data))
      .catch(() => {
        toast('No checklist template found for this category', { icon: '⚠️' });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleCheckin = async () => {
    if (!checkinData || !job) return;
    setSubmittingCheckin(true);
    try {
      const fd = new FormData();
      fd.append('request', String(job.id));
      fd.append('checkin_photo', checkinData.file);
      if (checkinData.lat !== null) fd.append('checkin_lat', String(checkinData.lat));
      if (checkinData.lng !== null) fd.append('checkin_lng', String(checkinData.lng));
      await inspectionApi.checkin.submit(fd);

      // Create report shell and update status
      const reportRes = await inspectionApi.reports.submit({
        request: job.id,
        verdict: 'pass',
        summary: '',
        checklist_template_version: template?.version || 1,
      });
      setReportId(reportRes.data.id);
      await inspectionApi.requests.updateStatus(job.id, 'in_progress');
      toast.success('Checked in! Start the inspection.');
      setStep('checklist');
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.detail
        || err?.response?.data?.checkin_photo?.[0]
        || err?.response?.data?.request?.[0]
        || 'Failed to check in';
      toast.error(msg);
    } finally { setSubmittingCheckin(false); }
  };

  const handleFinalSubmit = async () => {
    if (!job || !reportId || !verdict || !summary || !checkoutData) {
      toast.error('Complete all fields and capture checkout photo');
      return;
    }
    setSubmittingReport(true);
    try {
      // Checkout
      const fd = new FormData();
      fd.append('checkout_photo', checkoutData.file);
      if (checkoutData.lat !== null) fd.append('checkout_lat', String(checkoutData.lat));
      if (checkoutData.lng !== null) fd.append('checkout_lng', String(checkoutData.lng));
      await inspectionApi.checkin.checkout(job.id, fd);

      // Finalize the existing report with verdict and summary
      if (!reportId) throw new Error('No report ID found');
      await inspectionApi.reports.finalize(reportId, { verdict, summary });

      // Upload extra supporting documents
      for (const file of extraDocs) {
        const fd = new FormData();
        fd.append('request', String(job.id));
        fd.append('image', file);
        await inspectionApi.evidence.submit(fd);
      }

      toast.success('Inspection submitted for QA review!');
      setStep('done');
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.detail
        || err?.response?.data?.checkin_photo?.[0]
        || err?.response?.data?.request?.[0]
        || 'Failed to submit inspection';
      toast.error(msg);
    } finally { setSubmittingReport(false); }
  };

  if (loading) return <Spinner />;
  if (!job) return <p className="text-center py-12 text-gray-400">Job not found</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Job header */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">{job.item_name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{job.category_path}</p>
            <p className="text-xs font-mono text-gray-400 mt-1">{job.inspection_id}</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-gray-500 capitalize">{job.scope}</p>
            <p className="text-xs text-gray-400 mt-1">{job.turnaround}</p>
          </div>
        </div>
        <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-sm flex items-start gap-2">
          <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
          <span className="text-gray-600 dark:text-gray-400">{job.item_address}</span>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {['checkin', 'checklist', 'verdict'].map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-1.5 text-xs font-medium ${
              step === s ? 'text-brand-600 dark:text-brand-400'
                : ['checkin', 'checklist', 'verdict'].indexOf(step) > i
                ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s ? 'bg-brand-600 text-white'
                  : ['checkin', 'checklist', 'verdict'].indexOf(step) > i
                  ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              }`}>
                {['checkin', 'checklist', 'verdict'].indexOf(step) > i ? '✓' : i + 1}
              </div>
              <span className="hidden sm:inline capitalize">{s === 'checkin' ? 'Check-In' : s === 'checklist' ? 'Checklist' : 'Verdict'}</span>
            </div>
            {i < 2 && <div className="flex-1 h-0.5 bg-gray-200 dark:bg-gray-700" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step: Check-In */}
      {step === 'checkin' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <LogIn size={18} className="text-brand-600" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Step 1: Check In</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Capture a photo at the item's location. Your GPS coordinates will be recorded automatically.
          </p>
          <PhotoCapture
            label="Arrival Photo"
            onCapture={(file, lat, lng) => setCheckinData({ file, lat, lng })}
            captured={!!checkinData}
          />
          {checkinData && (
            <button
              onClick={handleCheckin}
              disabled={submittingCheckin}
              className="w-full btn-primary py-3 font-semibold"
            >
              {submittingCheckin ? 'Checking in…' : 'Confirm Check-In & Start Inspection'}
            </button>
          )}
        </div>
      )}

      {/* Step: Checklist */}
      {step === 'checklist' && template && reportId && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList size={18} className="text-brand-600" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Step 2: Checklist</h2>
          </div>
          <ChecklistForm
            template={template}
            requestId={job.id}
            reportId={reportId}
            onComplete={() => setStep('verdict')}
          />
        </div>
      )}

      {step === 'checklist' && !template && (
        <div className="card p-6 text-center">
          <AlertTriangle size={32} className="mx-auto text-yellow-500 mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No checklist template found for this category. Contact admin.
          </p>
          <button onClick={() => setStep('verdict')} className="btn-secondary mt-4 text-sm px-4 py-2">
            Skip to Verdict
          </button>
        </div>
      )}

      {/* Step: Verdict & Checkout */}
      {step === 'verdict' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <LogOut size={18} className="text-brand-600" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Step 3: Verdict & Check Out</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Overall Verdict <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'pass', label: 'Pass', color: 'border-green-400 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
                { value: 'conditional', label: 'Conditional', color: 'border-yellow-400 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' },
                { value: 'fail', label: 'Fail', color: 'border-red-400 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
              ].map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setVerdict(v.value)}
                  className={`py-3 rounded-lg border-2 text-sm font-bold transition ${
                    verdict === v.value ? v.color : 'border-surface-border dark:border-surface-dark-border text-gray-500 bg-white dark:bg-gray-800 hover:border-gray-400'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Summary <span className="text-red-500">*</span>
            </label>
            <textarea
              className="input"
              rows={4}
              placeholder="Describe your findings, key issues found, overall condition of the item..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Checkout Photo <span className="text-red-500">*</span>
            </label>
            <PhotoCapture
              label="Departure Photo"
              onCapture={(file, lat, lng) => setCheckoutData({ file, lat, lng })}
              captured={!!checkoutData}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Supporting Documents / Photos
            </label>
            <div className="space-y-2">
              <input
                type="file" multiple accept="image/*,application/pdf"
                className="hidden" id="extra-docs"
                onChange={(e) => {
                  if (e.target.files) setExtraDocs(Array.from(e.target.files));
                }}
              />
              <label htmlFor="extra-docs" className="flex items-center gap-2 p-3 border border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                <Camera size={16} className="text-gray-400" />
                <span className="text-sm text-gray-600">Select Files...</span>
                {extraDocs.length > 0 && <span className="ml-auto text-xs font-bold text-brand-600">{extraDocs.length} selected</span>}
              </label>
              {extraDocs.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {extraDocs.map((f, i) => (
                    <div key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-[10px] text-gray-600 dark:text-gray-400">
                      {f.name.slice(0, 15)}...
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleFinalSubmit}
            disabled={submittingReport || !verdict || !summary || !checkoutData}
            className="w-full btn-primary py-3 font-semibold flex items-center justify-center gap-2"
          >
            <Send size={16} />
            {submittingReport ? 'Submitting…' : 'Submit Inspection for QA Review'}
          </button>
        </div>
      )}

      {/* Done */}
      {step === 'done' && (
        <div className="card p-8 text-center">
          <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4">
            <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Inspection Submitted</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            Your report is in QA review. You'll be notified once it's processed.
          </p>
          <Link to="/inspector/jobs" className="btn-secondary px-5 py-2 text-sm">
            Back to My Jobs
          </Link>
        </div>
      )}
    </div>
  );
};

// ─── Inspector Layout ───────────────────────
const InspectorLayout: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Routes>
        <Route index element={<InspectorJobs />} />
        <Route path="jobs" element={<InspectorJobs />} />
        <Route path="jobs/:id" element={<JobExecution />} />
      </Routes>
    </div>
  );
};

export default InspectorLayout;
