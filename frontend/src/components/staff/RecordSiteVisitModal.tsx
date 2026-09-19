import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, MapPin, Search, Camera, Check,
  ExternalLink, Upload, Trash2
} from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

interface RecordSiteVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RecordSiteVisitModal: React.FC<RecordSiteVisitModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [userCandidates, setUserCandidates] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  const [form, setForm] = useState({
    business_name: '',
    contact_person: '',
    contact_phone: '',
    address: '',
    latitude: '',
    longitude: '',
    staff_notes: '',
  });

  const [storefrontFile, setStorefrontFile] = useState<File | null>(null);
  const [storefrontPreview, setStorefrontPreview] = useState<string | null>(null);

  const [interiorFile, setInteriorFile] = useState<File | null>(null);
  const [interiorPreview, setInteriorPreview] = useState<string | null>(null);

  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);

  const [locating, setLocating] = useState(false);

  // Search candidate users as user types (min 2 chars, debounced to avoid N+1 and unnecessary fetches)
  useEffect(() => {
    if (!isOpen || selectedUser) return;
    const trimmed = userQuery.trim();
    if (trimmed.length < 2) {
      setUserCandidates([]);
      setSearchingUsers(false);
      return;
    }

    const timer = setTimeout(() => {
      setSearchingUsers(true);
      api.get(`/api/staff/site-visits/candidate-users/?q=${encodeURIComponent(trimmed)}`)
        .then((res) => {
          const data = res.data || [];
          setUserCandidates(Array.isArray(data) ? data : []);
        })
        .catch(() => setUserCandidates([]))
        .finally(() => setSearchingUsers(false));
    }, 280);

    return () => clearTimeout(timer);
  }, [userQuery, isOpen, selectedUser]);

  // Handle image selections with preview
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (file: File | null) => void,
    setPreview: (url: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size exceeds 10MB limit');
        return;
      }
      setFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
    }
  };

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setLocating(false);
        toast.success('Live GPS coordinates captured');
      },
      (err) => {
        setLocating(false);
        toast.error(`GPS Error: ${err.message || 'Unable to retrieve location'}`);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      return toast.error('Please search and select a merchant account');
    }
    if (!form.business_name.trim()) {
      return toast.error('Please enter the store / business name');
    }
    if (!form.address.trim()) {
      return toast.error('Please enter the physical store address');
    }

    setSubmitting(true);
    const fd = new FormData();
    // Send both 'user' and 'user_id' so all DRF serializer variants bind correctly
    fd.append('user', String(selectedUser.id));
    fd.append('user_id', String(selectedUser.id));
    fd.append('business_name', form.business_name.trim());
    if (form.contact_person.trim()) fd.append('contact_person', form.contact_person.trim());
    if (form.contact_phone.trim()) fd.append('contact_phone', form.contact_phone.trim());
    fd.append('address', form.address.trim());

    if (form.latitude.trim() && !isNaN(Number(form.latitude))) {
      fd.append('latitude', form.latitude.trim());
    }
    if (form.longitude.trim() && !isNaN(Number(form.longitude))) {
      fd.append('longitude', form.longitude.trim());
    }
    if (form.staff_notes.trim()) {
      fd.append('staff_notes', form.staff_notes.trim());
    }

    if (storefrontFile) fd.append('storefront_image', storefrontFile);
    if (interiorFile) fd.append('interior_image', interiorFile);
    if (documentFile) fd.append('document_image', documentFile);

    try {
      await api.post('/api/staff/site-visits/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Site verification submitted for Admin Review');
      onSuccess();
      handleClose();
    } catch (err: any) {
      const data = err.response?.data;
      const errorMsg =
        (typeof data === 'object' && data !== null
          ? data.user?.[0] || data.business_name?.[0] || data.address?.[0] || data.detail
          : null) || 'Failed to record site visit';
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedUser(null);
    setUserQuery('');
    setUserCandidates([]);
    setForm({
      business_name: '',
      contact_person: '',
      contact_phone: '',
      address: '',
      latitude: '',
      longitude: '',
      staff_notes: '',
    });
    setStorefrontFile(null);
    setStorefrontPreview(null);
    setInteriorFile(null);
    setInteriorPreview(null);
    setDocumentFile(null);
    setDocumentPreview(null);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="relative w-full sm:max-w-xl bg-white dark:bg-[#0A0A0A] rounded-2xl border border-surface-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Clean, without redundant icons */}
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
              Record Store Site Visit
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              On-site verification details and photographic evidence
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-surface-muted transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 text-xs">
          {/* Merchant Account Lookup */}
          <div className="space-y-1.5">
            <label className="font-semibold text-gray-900 dark:text-gray-200">
              Merchant Account <span className="text-rose-500">*</span>
            </label>

            {selectedUser ? (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-muted/60 dark:bg-white/[0.04] border border-surface-border">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-brand-500 text-black font-bold flex items-center justify-center text-xs shrink-0">
                    {selectedUser.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-gray-900 dark:text-white block truncate">
                      @{selectedUser.username}
                    </span>
                    <span className="text-gray-400 text-[11px] block truncate">
                      {selectedUser.phone || selectedUser.email || 'No phone recorded'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-2 py-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer shrink-0"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Search by username, phone, or email..."
                    className="input pl-8 py-2 text-xs w-full"
                    autoFocus
                  />
                  {searchingUsers && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Spinner size="sm" />
                    </div>
                  )}
                </div>

                {userQuery.trim().length < 2 ? (
                  <p className="text-gray-400 text-[11px] px-1">
                    Type at least 2 characters to search merchant accounts...
                  </p>
                ) : userCandidates.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-surface-border divide-y divide-surface-border">
                    {userCandidates.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => {
                          setSelectedUser(u);
                          setUserCandidates([]);
                          if (!form.contact_phone && u.phone) {
                            setForm((prev) => ({ ...prev, contact_phone: u.phone }));
                          }
                        }}
                        className="p-2.5 hover:bg-surface-muted/60 dark:hover:bg-white/[0.04] cursor-pointer flex items-center justify-between transition"
                      >
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white">@{u.username}</span>
                          <span className="text-gray-400 text-[11px] block">{u.phone || u.email}</span>
                        </div>
                        <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400">Select</span>
                      </div>
                    ))}
                  </div>
                ) : !searchingUsers ? (
                  <p className="text-gray-400 text-[11px] px-1 italic">
                    No matching merchant accounts found for "{userQuery}"
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* Store & Contact Details */}
          <div className="space-y-3">
            <div>
              <label className="text-gray-700 dark:text-gray-300 font-medium block mb-1">
                Store / Business Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                placeholder="e.g., Kariakoo Hardware & Tools"
                className="input w-full py-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-gray-700 dark:text-gray-300 font-medium block mb-1">
                  Contact Person / Manager
                </label>
                <input
                  type="text"
                  value={form.contact_person}
                  onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                  placeholder="e.g., Juma Ally"
                  className="input w-full py-2 text-xs"
                />
              </div>
              <div>
                <label className="text-gray-700 dark:text-gray-300 font-medium block mb-1">
                  Contact Phone Number
                </label>
                <input
                  type="text"
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                  placeholder="e.g., +255 712 345 678"
                  className="input w-full py-2 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Physical Address & Location */}
          <div className="space-y-2">
            <label className="text-gray-700 dark:text-gray-300 font-medium block">
              Physical Address / Building / Landmark <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g., Msimbazi St, Opp. Posta, Block C Shop #14"
              className="input w-full py-2 text-xs"
            />

            {/* GPS Live Coordinates (Flat inline controls, no nested bordered cards) */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Latitude"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                className="input flex-1 py-1.5 text-xs font-mono"
              />
              <input
                type="text"
                placeholder="Longitude"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                className="input flex-1 py-1.5 text-xs font-mono"
              />
              <button
                type="button"
                onClick={handleCaptureLocation}
                disabled={locating}
                className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-black font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <MapPin size={13} />
                <span>{locating ? 'Capturing...' : 'Capture GPS'}</span>
              </button>
            </div>

            {form.latitude && form.longitude && (
              <div className="flex items-center justify-between text-[11px] text-gray-400 pt-0.5">
                <span className="text-emerald-500 font-medium flex items-center gap-1">
                  <Check size={12} /> GPS locked ({form.latitude}, {form.longitude})
                </span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${form.latitude},${form.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-500 hover:underline inline-flex items-center gap-1"
                >
                  <span>View map</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            )}
          </div>

          {/* Photographic Evidence (Compact 3-column row) */}
          <div className="space-y-2">
            <span className="font-semibold text-gray-900 dark:text-gray-200 block">
              Photographic Evidence
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              {/* Storefront */}
              <div>
                <span className="text-[10px] text-gray-400 block mb-1">Storefront</span>
                {storefrontPreview ? (
                  <div className="relative h-20 rounded-lg overflow-hidden border border-surface-border group bg-neutral-900">
                    <img src={storefrontPreview} alt="Storefront" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setStorefrontFile(null); setStorefrontPreview(null); }}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-black transition cursor-pointer"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-20 rounded-lg border border-dashed border-surface-border hover:border-brand-500 bg-surface-muted/30 cursor-pointer transition p-1 text-center">
                    <Camera size={16} className="text-gray-400 mb-0.5" />
                    <span className="text-[10px] font-medium text-gray-400">Exterior</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleFileChange(e, setStorefrontFile, setStorefrontPreview)}
                    />
                  </label>
                )}
              </div>

              {/* Interior */}
              <div>
                <span className="text-[10px] text-gray-400 block mb-1">Interior / Stock</span>
                {interiorPreview ? (
                  <div className="relative h-20 rounded-lg overflow-hidden border border-surface-border group bg-neutral-900">
                    <img src={interiorPreview} alt="Interior" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setInteriorFile(null); setInteriorPreview(null); }}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-black transition cursor-pointer"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-20 rounded-lg border border-dashed border-surface-border hover:border-brand-500 bg-surface-muted/30 cursor-pointer transition p-1 text-center">
                    <Camera size={16} className="text-gray-400 mb-0.5" />
                    <span className="text-[10px] font-medium text-gray-400">Interior</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleFileChange(e, setInteriorFile, setInteriorPreview)}
                    />
                  </label>
                )}
              </div>

              {/* License / ID */}
              <div>
                <span className="text-[10px] text-gray-400 block mb-1">License / ID</span>
                {documentPreview ? (
                  <div className="relative h-20 rounded-lg overflow-hidden border border-surface-border group bg-neutral-900">
                    <img src={documentPreview} alt="Document" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setDocumentFile(null); setDocumentPreview(null); }}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-black transition cursor-pointer"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-20 rounded-lg border border-dashed border-surface-border hover:border-brand-500 bg-surface-muted/30 cursor-pointer transition p-1 text-center">
                    <Upload size={16} className="text-gray-400 mb-0.5" />
                    <span className="text-[10px] font-medium text-gray-400">License / ID</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleFileChange(e, setDocumentFile, setDocumentPreview)}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Observations */}
          <div className="space-y-1.5">
            <label className="font-semibold text-gray-900 dark:text-gray-200 block">
              Staff Observations
            </label>
            <textarea
              rows={2}
              value={form.staff_notes}
              onChange={(e) => setForm({ ...form, staff_notes: e.target.value })}
              placeholder="e.g., Shop is fully active, goods verified on shelves, owner present."
              className="input w-full py-2 text-xs"
            />
          </div>

          {/* Bottom Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={submitting}
              className="bg-brand-500 hover:bg-brand-400 text-black font-bold px-5 text-xs inline-flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Spinner size="sm" /> Submitting...
                </>
              ) : (
                <>
                  <Check size={14} /> Submit for Admin Review
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
