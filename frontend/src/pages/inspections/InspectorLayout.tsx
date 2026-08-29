import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import {
  ClipboardList, Camera, MapPin, CheckCircle,
  AlertTriangle, ChevronRight, Send, LogIn, LogOut, PlusCircle,
  SwitchCamera, RefreshCw, FileText, Check, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api';
import inspectionApi from '../../api/inspectionApi';
import {
  InspectionRequest, ChecklistTemplate, ChecklistItem,
  STATUS_LABELS, STATUS_COLORS, fmtDate,
} from '../../types/inspection';

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

// ─── Geolocation helper ─────────────────────
function getLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    
    // Try high accuracy first
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        // Fallback to low accuracy (cell tower/WiFi) if high accuracy fails or times out
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (fallbackErr) => reject(fallbackErr),
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
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
                ? ' text-green-500  dark:text-green-500 '
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
                      <h3 className="font-semibold text-gray-900 dark:text-white mt-1 group-hover:text-brand-500 transition line-clamp-1">
                        {job.item_name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{job.category_path}</p>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <MapPin size={10} /> {job.item_address}
                      </p>
                      {job.job_contact && (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400" onClick={e => e.stopPropagation()}>
                          <p className="font-medium text-gray-700 dark:text-gray-300">
                            {job.job_contact.label}: {job.job_contact.name}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            {job.job_contact.phone && (
                              <a href={`tel:${job.job_contact.phone}`} className="text-brand-500 hover:underline">
                                {job.job_contact.phone}
                              </a>
                            )}
                            {job.job_contact.email && (
                              <a href={`mailto:${job.job_contact.email}`} className="text-brand-500 hover:underline">
                                {job.job_contact.email}
                              </a>
                            )}
                          </div>
                        </div>
                      )}
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

// ─── Capture Photo with Live Full-Frame & Review ──────
const PhotoCapture: React.FC<{
  label: string;
  onCapture: (file: File, lat: number | null, lng: number | null) => void;
  captured?: boolean;
}> = ({ label, onCapture, captured }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'ready' | 'unavailable'>('idle');
  const [showCamera, setShowCamera] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedPreview, setCapturedPreview] = useState<{
    file: File;
    url: string;
    lat: number | null;
    lng: number | null;
  } | null>(null);
  const [takingShot, setTakingShot] = useState(false);

  const startCamera = async (mode = facingMode) => {
    setShowCamera(true);
    setCapturedPreview(null);
    setGpsStatus('idle');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
      setTimeout(() => {
        if (videoRef.current) {
          if (!videoRef.current.srcObject) videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      console.error("Camera access failed:", err);
      toast.error("Could not access camera. Please allow camera permissions in your browser.");
      setShowCamera(false);
    }
  };

  const toggleCameraFacing = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    setCapturedPreview(null);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || takingShot) return;
    const video = videoRef.current;
    setTakingShot(true);
    setGpsStatus('acquiring');

    let lat: number | null = null;
    let lng: number | null = null;

    try {
      const pos = await getLocation();
      lat = pos.lat;
      lng = pos.lng;
      setGpsStatus('ready');
    } catch {
      setGpsStatus('unavailable');
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File(
            [blob],
            `${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.jpg`,
            { type: 'image/jpeg' }
          );
          const previewUrl = URL.createObjectURL(blob);
          setCapturedPreview({ file, url: previewUrl, lat, lng });
        }
        setTakingShot(false);
      }, 'image/jpeg', 0.90);
    } else {
      setTakingShot(false);
    }
  };

  const confirmPhoto = () => {
    if (!capturedPreview) return;
    onCapture(capturedPreview.file, capturedPreview.lat, capturedPreview.lng);
    toast.success(
      capturedPreview.lat !== null
        ? `${label} captured with GPS coordinates`
        : `${label} captured`
    );
    stopCamera();
  };

  const retakePhoto = () => {
    if (capturedPreview?.url) {
      URL.revokeObjectURL(capturedPreview.url);
    }
    setCapturedPreview(null);
    if (!streamRef.current) {
      startCamera(facingMode);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <button 
        type="button"
        onClick={() => startCamera(facingMode)}
        className={`flex flex-col items-center gap-2 p-5 border-2 border-dashed rounded-xl cursor-pointer transition w-full ${
          captured
            ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20'
            : 'border-surface-border dark:border-surface-dark-border hover:border-brand-500 bg-white dark:bg-gray-800'
        }`}
      >
        {captured ? (
          <CheckCircle size={28} className="text-emerald-500" />
        ) : (
          <Camera size={28} className="text-gray-400" />
        )}
        <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
          {captured ? `${label} Recorded ✓` : `Take Live ${label}`}
        </span>
        <span className="text-2xs text-gray-400">Full-frame live camera &amp; GPS</span>
      </button>

      {showCamera && (
        <div className="fixed inset-0 bg-black/95 z-[9999] flex flex-col items-center justify-between p-4 sm:p-6 select-none">
          {/* Header */}
          <div className="w-full flex items-center justify-between max-w-lg text-white">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <h3 className="font-bold text-base sm:text-lg">{label}</h3>
            </div>
            <div className="flex items-center gap-2">
              {!capturedPreview && (
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full transition flex items-center gap-1 text-xs"
                  title="Switch Camera"
                >
                  <SwitchCamera size={16} />
                </button>
              )}
              <button 
                type="button" 
                onClick={stopCamera} 
                className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full transition"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Viewfinder / Review Container */}
          <div className="relative w-full max-w-md aspect-4/3 sm:aspect-16/9 my-auto flex items-center justify-center overflow-hidden rounded-2xl bg-black border border-neutral-800 shadow-2xl">
            {capturedPreview ? (
              /* Review Screen */
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                <img
                  src={capturedPreview.url}
                  alt="Captured photo preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 left-3 right-3 bg-black/75 backdrop-blur-xs p-2.5 rounded-xl border border-white/10 text-white flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-mono">
                    <MapPin size={14} className="text-emerald-400 shrink-0" />
                    {capturedPreview.lat !== null ? (
                      <span className="truncate">GPS: {capturedPreview.lat.toFixed(4)}, {capturedPreview.lng?.toFixed(4)}</span>
                    ) : (
                      <span className="text-amber-400">GPS unavailable</span>
                    )}
                  </div>
                  <span className="text-2xs uppercase tracking-wider text-emerald-400 font-bold shrink-0 ml-2">Ready</span>
                </div>
              </div>
            ) : (
              /* Live Camera Feed */
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  className="w-full h-full object-cover" 
                />
                {/* Viewfinder Target Guidelines */}
                <div className="absolute inset-4 sm:inset-6 border border-white/20 rounded-xl pointer-events-none flex flex-col justify-between p-3">
                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-t-2 border-l-2 border-emerald-400" />
                    <div className="w-5 h-5 border-t-2 border-r-2 border-emerald-400" />
                  </div>
                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-b-2 border-l-2 border-emerald-400" />
                    <div className="w-5 h-5 border-b-2 border-r-2 border-emerald-400" />
                  </div>
                </div>

                {gpsStatus === 'acquiring' && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 text-white">
                    <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
                    <span className="text-xs font-semibold">Acquiring GPS coordinates...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Controls */}
          <div className="w-full max-w-lg flex flex-col items-center gap-3">
            {capturedPreview ? (
              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={retakePhoto}
                  className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition"
                >
                  <RefreshCw size={16} /> Retake
                </button>
                <button
                  type="button"
                  onClick={confirmPhoto}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg"
                >
                  <Check size={18} /> Use Photo ✓
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <button 
                  type="button" 
                  onClick={capturePhoto} 
                  disabled={takingShot}
                  className="w-20 h-20 bg-white border-[6px] border-neutral-300 rounded-full flex items-center justify-center shadow-lg active:scale-95 hover:border-white transition cursor-pointer"
                >
                  <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center">
                    <Camera size={22} className="text-white" />
                  </div>
                </button>
                <p className="text-2xs text-neutral-400 text-center">
                  Align the full subject in frame and tap the shutter button.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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
  const [activeSection, setActiveSection] = useState<string>('');

  const [localTemplate, setLocalTemplate] = useState<ChecklistTemplate>(template);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('pass_fail');
  const [newSeverity, setNewSeverity] = useState('major');
  const [addingItem, setAddingItem] = useState(false);

  useEffect(() => {
    setLocalTemplate(template);
  }, [template]);

  const handleAddCustomItem = async () => {
    if (!newLabel.trim()) return toast.error('Please enter what to check');
    setAddingItem(true);
    const targetSection = activeSection || 'General';
    try {
      const res = await api.post(`/api/inspections/templates/${localTemplate.id}/add-item/`, {
        label: newLabel.trim(),
        item_type: newType,
        is_mandatory: true,
        section: targetSection,
        severity: newSeverity,
      });
      if (res.data && res.data.items) {
        setLocalTemplate(res.data);
      }
      setActiveSection(targetSection);
      setNewLabel('');
      toast.success('Custom item added to checklist!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to add custom item');
    } finally {
      setAddingItem(false);
    }
  };

  // Group items by section
  const sections = Array.from(new Set(localTemplate.items.map(item => item.section || 'General')));

  // Initialize first section as active
  useEffect(() => {
    if (sections.length > 0 && !activeSection) {
      setActiveSection(sections[0]);
    }
  }, [sections, activeSection]);

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

  const isSectionComplete = (sec: string) => {
    const secItems = localTemplate.items.filter((item) => (item.section || 'General') === sec);
    return secItems.every((item) => {
      if (!item.is_mandatory) return true;
      if (item.item_type === 'media') return !!evidence[item.id];
      return !!responses[item.id]?.value;
    });
  };

  const getLiveEstimator = () => {
    let totalPossible = 0;
    let totalObtained = 0;
    let hasCriticalFailure = false;

    localTemplate.items.forEach((item) => {
      const resp = responses[item.id];
      const severity = item.severity || 'major';
      let weight = 1;
      if (severity === 'major') weight = 3;
      else if (severity === 'critical') weight = 5;

      const val = resp?.value?.trim().toLowerCase();

      if (item.item_type === 'pass_fail') {
        if (val) {
          totalPossible += 100 * weight;
          if (val === 'pass') {
            totalObtained += 100 * weight;
          } else {
            totalObtained += 0;
            if (severity === 'critical') hasCriticalFailure = true;
          }
        }
      } else if (item.item_type === 'scale') {
        if (val) {
          totalPossible += 100 * weight;
          try {
            const scaleVal = parseInt(val.replace(/\D/g, ''));
            const scorePct = (scaleVal / 5.0) * 100;
            totalObtained += scorePct * weight;
            if (scaleVal <= 2 && severity === 'critical') hasCriticalFailure = true;
          } catch (e) {
            totalObtained += 50 * weight;
          }
        }
      } else if (item.item_type === 'measurement') {
        if (val) {
          totalPossible += 100 * weight;
          totalObtained += 100 * weight;
        }
      } else if (item.item_type === 'media') {
        if (evidence[item.id]) {
          totalPossible += 100 * weight;
          totalObtained += 100 * weight;
        }
      }
    });

    if (totalPossible === 0) return { score: 100, grade: 'A+', verdict: 'pass' };

    const score = Math.round((totalObtained / totalPossible) * 100);
    let grade = 'F';
    if (score >= 95) grade = 'A+';
    else if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';

    if (hasCriticalFailure) {
      if (['A+', 'A', 'B', 'C'].includes(grade)) grade = 'D';
    }

    let verdict = 'pass';
    if (hasCriticalFailure || score < 60) verdict = 'fail';
    else if (score < 80) verdict = 'conditional';

    return { score, grade, verdict };
  };

  const handleSubmit = async () => {
    // Validate mandatory items
    const missing = localTemplate.items
      .filter((item) => item.is_mandatory && !responses[item.id]?.value)
      .map((item) => item.label);
    if (missing.length > 0) {
      toast.error(`Complete mandatory items: ${missing.slice(0, 2).join(', ')}${missing.length > 2 ? '…' : ''}`);
      return;
    }

    const missingMedia = localTemplate.items
      .filter((item) => item.item_type === 'media' && item.is_mandatory && !evidence[item.id])
      .map((item) => item.label);
    if (missingMedia.length > 0) {
      toast.error(`Upload required photos: ${missingMedia[0]}`);
      return;
    }

    setSubmitting(true);
    try {
      // Submit checklist responses
      const responsePayloads = localTemplate.items
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
        try {
          const fd = new FormData();
          fd.append('request', String(requestId));
          if (itemIdStr && !isNaN(Number(itemIdStr))) {
            fd.append('checklist_item', itemIdStr);
          }
          fd.append('image', ev.file);
          if (ev.lat !== null) fd.append('latitude', String(ev.lat.toFixed(6)));
          if (ev.lng !== null) fd.append('longitude', String(ev.lng.toFixed(6)));
          await inspectionApi.evidence.submit(fd);
        } catch (evErr) {
          console.warn('Evidence upload skipped or warning:', evErr);
        }
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
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {item.label}
              {item.is_mandatory && <span className="text-red-500 ml-1">*</span>}
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
              item.severity === 'critical'
                ? ' text-red-500  dark:text-red-500'
                : item.severity === 'major'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                : ' text-blue-500  dark:text-blue-500'
            }`}>
              {item.severity || 'major'}
            </span>
          </div>
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
                    ? ' text-green-500 border-green-500  dark:text-green-500 dark:border-green-500'
                    : ' text-red-500 border-red-500  dark:text-red-500 dark:border-red-500'
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
                  ? 'bg-brand-500 text-white border-brand-500 shadow-glow-strong'
                  : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 border-surface-border dark:border-surface-dark-border hover:border-brand-500'
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

  const estimator = getLiveEstimator();

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="p-3 rounded-lg   border border-brand-500 dark:border-brand-500 text-xs text-brand-500 dark:text-brand-500 flex items-center gap-2">
        <AlertTriangle size={14} className="shrink-0" />
        <span>Items marked * are mandatory. All photos are GPS-tagged automatically.</span>
      </div>

      {/* Real-time Quality Grade Estimator */}
      <div className="p-4 rounded-xl border border-surface-border dark:border-surface-dark-border bg-gray-50/50 dark:bg-neutral-900/50 flex flex-wrap gap-4 items-center justify-between">
        <div>
          <p className="text-2xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Live Report Estimate</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl font-black ${
              estimator.verdict === 'pass' ? 'text-green-500 dark:text-green-500'
                : estimator.verdict === 'conditional' ? 'text-amber-500' : 'text-red-500'
            }`}>
              Grade {estimator.grade}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">({estimator.score}% Score)</span>
          </div>
        </div>
        <div className="text-right">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
            estimator.verdict === 'pass' ? ' text-green-500  dark:text-green-500'
              : estimator.verdict === 'conditional' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
              : ' text-red-500  dark:text-red-500'
          }`}>
            {estimator.verdict === 'pass' ? 'Suggested Pass'
              : estimator.verdict === 'conditional' ? 'Suggested Conditional' : 'Suggested Fail'}
          </span>
        </div>
      </div>

      {/* Completion Progress */}
      {(() => {
        const allItems = localTemplate.items;
        const answeredCount = allItems.filter(item =>
          item.item_type === 'media' ? !!evidence[item.id] : !!responses[item.id]?.value
        ).length;
        const pct = allItems.length > 0 ? Math.round((answeredCount / allItems.length) * 100) : 0;
        return (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-gray-500 dark:text-gray-400">Completion</span>
              <span className={pct === 100 ? 'text-green-500 dark:text-green-500 font-bold' : 'text-gray-700 dark:text-gray-300'}>
                {answeredCount} / {allItems.length} items answered
              </span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  pct === 100 ? 'bg-green-500' : pct >= 60 ? 'bg-brand-500' : 'bg-amber-400'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })()}

      {/* Section Accordions */}
      <div className="space-y-3">
        {sections.map((sec) => {
          const secName = sec || 'General';
          const secItems = localTemplate.items.filter((item) => (item.section || 'General') === secName);
          const complete = isSectionComplete(secName);
          const isOpen = activeSection === secName;

          return (
            <div key={secName} className="border border-surface-border dark:border-surface-dark-border rounded-card overflow-hidden bg-white dark:bg-neutral-950 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveSection(isOpen ? '' : secName)}
                className="w-full px-5 py-4 flex items-center justify-between text-left font-bold text-gray-900 dark:text-white bg-gray-50/50 dark:bg-neutral-900/50 hover:bg-gray-100/50 dark:hover:bg-neutral-900 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  {complete ? (
                    <CheckCircle size={18} className="text-green-500 dark:text-green-500 shrink-0" />
                  ) : (
                    <div className="w-4.5 h-4.5 rounded-full border-2 border-gray-300 dark:border-gray-600 shrink-0" />
                  )}
                  <span>{secName}</span>
                  <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                    {secItems.length} items
                  </span>
                </div>
                <ChevronRight size={16} className={`text-gray-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
              </button>

              {isOpen && (
                <div className="p-4 space-y-4 border-t border-surface-border dark:border-surface-dark-border bg-white dark:bg-black/20 animate-fade-in">
                  {secItems.map(renderItem)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dynamic Checklist Item Creator */}
      <div className="card p-5 border border-dashed border-brand-500/30   space-y-4 rounded-card">
        <div className="flex items-center gap-2">
          <PlusCircle size={18} className="text-brand-500 animate-pulse" />
          <h4 className="font-bold text-sm text-gray-900 dark:text-white">Add Custom Checklist Item</h4>
        </div>
        <p className="text-2xs text-gray-400 leading-tight">
          As a fallback or extra verification step, dynamically add something new to check. It will appear immediately in the active section.
        </p>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            className="input text-xs flex-1 h-9"
            placeholder="e.g. Check for water spots in boot"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <select
              className="select text-xs h-9 py-1 px-2 border dark:border-neutral-700 bg-white dark:bg-neutral-850 text-gray-900 dark:text-white rounded-lg"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
            >
              <option value="pass_fail">Pass / Fail</option>
              <option value="scale">Scale 1–5</option>
              <option value="measurement">Measurement</option>
              <option value="text">Text Note</option>
              <option value="media">Photo / Attachment</option>
            </select>
            <select
              className="select text-xs h-9 py-1 px-2 border dark:border-neutral-700 bg-white dark:bg-neutral-850 text-gray-900 dark:text-white rounded-lg"
              value={newSeverity}
              onChange={(e) => setNewSeverity(e.target.value)}
            >
              <option value="advisory">Advisory Severity</option>
              <option value="major">Major Severity</option>
              <option value="critical">Critical Severity</option>
            </select>
            <button
              type="button"
              onClick={handleAddCustomItem}
              disabled={addingItem}
              className="btn-primary text-xs py-2 px-4 whitespace-nowrap h-9"
            >
              {addingItem ? 'Adding...' : 'Add to Checklist'}
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full btn-primary py-3 font-semibold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform"
      >
        <Send size={16} />
        {submitting ? 'Submitting Checklist…' : 'Save & Submit Checklist'}
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
      if (checkinData.lat !== null) fd.append('checkin_lat', String(checkinData.lat.toFixed(6)));
      if (checkinData.lng !== null) fd.append('checkin_lng', String(checkinData.lng.toFixed(6)));
      await inspectionApi.checkin.submit(fd);
      
      toast.success('Checked in! Start the inspection.');
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
      if (checkoutData.lat !== null) fd.append('checkout_lat', String(checkoutData.lat.toFixed(6)));
      if (checkoutData.lng !== null) fd.append('checkout_lng', String(checkoutData.lng.toFixed(6)));
      await inspectionApi.checkin.checkout(job.id, fd);

      // Upload extra supporting documents
      for (const file of extraDocs) {
        try {
          const fd = new FormData();
          fd.append('request', String(job.id));
          fd.append('image', file);
          await inspectionApi.evidence.submit(fd);
        } catch (docErr) {
          console.warn('Extra doc upload warning:', docErr);
        }
      }

      // Finalize the existing report with verdict and summary
      if (!reportId) throw new Error('No report ID found');
      await inspectionApi.reports.finalize(reportId, { verdict, summary });

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
        {job.assignment?.job_contact && (
          <div className="mt-3 p-3 rounded-lg   border border-brand-500 dark:border-brand-500/30 text-sm">
            <p className="font-medium text-gray-900 dark:text-white mb-1">
              Contact: {job.assignment.job_contact.name} <span className="text-xs font-normal text-gray-500">({job.assignment.job_contact.label})</span>
            </p>
            <div className="flex items-center gap-4 text-brand-500 dark:text-brand-500 text-xs font-medium">
              {job.assignment.job_contact.phone && (
                <a href={`tel:${job.assignment.job_contact.phone}`} className="hover:underline flex items-center gap-1">
                  📞 {job.assignment.job_contact.phone}
                </a>
              )}
              {job.assignment.job_contact.email && (
                <a href={`mailto:${job.assignment.job_contact.email}`} className="hover:underline flex items-center gap-1">
                  ✉️ {job.assignment.job_contact.email}
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {['checkin', 'checklist', 'verdict'].map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-1.5 text-xs font-medium ${
              step === s ? 'text-brand-500 dark:text-brand-500'
                : ['checkin', 'checklist', 'verdict'].indexOf(step) > i
                ? 'text-green-500 dark:text-green-500' : 'text-gray-400'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s ? 'bg-brand-500 text-white'
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
            <LogIn size={18} className="text-brand-500" />
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
            <ClipboardList size={18} className="text-brand-500" />
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
            <LogOut size={18} className="text-brand-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Step 3: Verdict & Check Out</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Overall Verdict <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'pass', label: 'Pass', color: 'border-green-500  text-green-500  dark:text-green-500' },
                { value: 'conditional', label: 'Conditional', color: 'border-yellow-500  text-yellow-500  dark:text-yellow-500' },
                { value: 'fail', label: 'Fail', color: 'border-red-500  text-red-500  dark:text-red-500' },
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
              Supporting Documents / Photos / Diagnostic Scans
            </label>
            <div className="space-y-3">
              <input
                type="file" 
                multiple 
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                className="hidden" 
                id="extra-docs"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    const newFiles = Array.from(e.target.files);
                    setExtraDocs(prev => [...prev, ...newFiles]);
                    e.target.value = '';
                  }
                }}
              />
              <label 
                htmlFor="extra-docs" 
                className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:border-brand-500 bg-gray-50/50 dark:bg-gray-800/50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400">
                    <FileText size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white block">
                      Add Diagnostic Documents &amp; Photos
                    </span>
                    <span className="text-2xs text-gray-400">
                      Images (JPG, PNG), PDF reports, Diagnostic scans, Service records
                    </span>
                  </div>
                </div>
                <span className="btn-secondary text-2xs py-1.5 px-3 rounded-lg font-bold">
                  Browse Files
                </span>
              </label>

              {extraDocs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-2xs font-bold text-gray-500 uppercase tracking-wider">
                    <span>Selected Documents ({extraDocs.length})</span>
                    <button
                      type="button"
                      onClick={() => setExtraDocs([])}
                      className="text-red-500 hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {extraDocs.map((f, i) => (
                      <div 
                        key={i} 
                        className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                          {f.type.startsWith('image/') ? (
                            <Camera size={14} className="text-emerald-500 shrink-0" />
                          ) : (
                            <FileText size={14} className="text-blue-500 shrink-0" />
                          )}
                          <span className="font-medium text-gray-800 dark:text-gray-200 truncate" title={f.name}>
                            {f.name}
                          </span>
                          <span className="text-3xs text-gray-400 shrink-0 font-mono">
                            ({(f.size / 1024).toFixed(0)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExtraDocs(prev => prev.filter((_, idx) => idx !== i))}
                          className="p-1 text-gray-400 hover:text-red-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                          title="Remove file"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
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
          <div className="p-4   rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4">
            <CheckCircle size={32} className="text-green-500 dark:text-green-500" />
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
    <div className="container-page max-w-4xl py-6">
      <Routes>
        <Route index element={<InspectorJobs />} />
        <Route path="jobs" element={<InspectorJobs />} />
        <Route path="jobs/:id" element={<JobExecution />} />
      </Routes>
    </div>
  );
};

export default InspectorLayout;
