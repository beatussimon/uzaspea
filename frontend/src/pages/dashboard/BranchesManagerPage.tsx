import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { 
  MapPin, Plus, Edit2, Trash2, Phone, MessageSquare, 
  AlertCircle, Compass
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardGridSkeleton } from '../../components/Skeleton';
import { useUserRoles } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

interface StoreLocation {
  id: number;
  name: string;
  slug: string;
  is_main: boolean;
  is_active: boolean;
  phone: string;
  whatsapp: string;
  address_line: string;
  city: string;
  district: string;
  latitude: string | number | null;
  longitude: string | number | null;
  operating_hours: Record<string, { open: string; close: string; closed: boolean }>;
  override_lipa_number: number | null;
  inventory_count?: number;
  assigned_staff_count?: number;
  created_at?: string;
}

const TANZANIA_CITIES = [
  'Dar es Salaam', 'Arusha', 'Mwanza', 'Dodoma', 'Zanzibar', 
  'Mbeya', 'Morogoro', 'Tanga', 'Tabora', 'Kigoma', 
  'Iringa', 'Moshi', 'Musoma', 'Songea', 'Bukoba'
];

const DEFAULT_HOURS = {
  mon: { open: '08:00', close: '18:00', closed: false },
  tue: { open: '08:00', close: '18:00', closed: false },
  wed: { open: '08:00', close: '18:00', closed: false },
  thu: { open: '08:00', close: '18:00', closed: false },
  fri: { open: '08:00', close: '18:00', closed: false },
  sat: { open: '09:00', close: '17:00', closed: false },
  sun: { open: '10:00', close: '14:00', closed: true },
};

export const BranchesManagerPage: React.FC = () => {
  const { isBusiness } = useUserRoles();
  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [lipaNumbers, setLipaNumbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<StoreLocation | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('Dar es Salaam');
  const [district, setDistrict] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isMain, setIsMain] = useState(false);
  const [overrideLipa, setOverrideLipa] = useState<number | ''>('');
  const [gettingGps, setGettingGps] = useState(false);

  const fetchLocations = () => {
    setLoading(true);
    Promise.all([
      api.get('/api/locations/').then(res => {
        const data = res.data.results || res.data || [];
        setLocations(Array.isArray(data) ? data : []);
      }),
      api.get('/api/lipa-numbers/').then(res => {
        const data = res.data.results || res.data || [];
        setLipaNumbers(Array.isArray(data) ? data : []);
      }).catch(() => {})
    ]).catch(() => {
      toast.error('Failed to load store branches');
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const openAddModal = () => {
    setEditingLoc(null);
    setName('');
    setAddressLine('');
    setCity('Dar es Salaam');
    setDistrict('');
    setPhone('');
    setWhatsapp('');
    setLat('');
    setLng('');
    setIsMain(locations.length === 0);
    setOverrideLipa('');
    setModalOpen(true);
  };

  const openEditModal = (loc: StoreLocation) => {
    setEditingLoc(loc);
    setName(loc.name);
    setAddressLine(loc.address_line);
    setCity(loc.city || 'Dar es Salaam');
    setDistrict(loc.district || '');
    setPhone(loc.phone || '');
    setWhatsapp(loc.whatsapp || '');
    setLat(loc.latitude ? String(loc.latitude) : '');
    setLng(loc.longitude ? String(loc.longitude) : '');
    setIsMain(loc.is_main);
    setOverrideLipa(loc.override_lipa_number || '');
    setModalOpen(true);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setGettingGps(false);
        toast.success('GPS coordinates retrieved!');
      },
      (err) => {
        setGettingGps(false);
        toast.error(`Could not get GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !addressLine.trim()) {
      toast.error('Please enter branch name and address');
      return;
    }

    setSaving(true);
    const payload: any = {
      name: name.trim(),
      address_line: addressLine.trim(),
      city: city.trim(),
      district: district.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp.trim(),
      latitude: lat ? parseFloat(lat) : null,
      longitude: lng ? parseFloat(lng) : null,
      is_main: isMain,
      override_lipa_number: overrideLipa ? Number(overrideLipa) : null,
      operating_hours: DEFAULT_HOURS,
    };

    try {
      if (editingLoc) {
        await api.patch(`/api/locations/${editingLoc.id}/`, payload);
        toast.success(`Branch "${payload.name}" updated successfully`);
      } else {
        await api.post('/api/locations/', payload);
        toast.success(`Branch "${payload.name}" created successfully`);
      }
      setModalOpen(false);
      fetchLocations();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || Object.values(err.response?.data || {})[0] || 'Failed to save branch';
      toast.error(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (loc: StoreLocation) => {
    try {
      await api.patch(`/api/locations/${loc.id}/`, { is_active: !loc.is_active });
      toast.success(`${loc.name} ${loc.is_active ? 'deactivated' : 'activated'}`);
      setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, is_active: !l.is_active } : l));
    } catch {
      toast.error('Failed to change branch status');
    }
  };

  const handleSetMain = async (loc: StoreLocation) => {
    try {
      await api.patch(`/api/locations/${loc.id}/`, { is_main: true });
      toast.success(`${loc.name} is now your primary HQ branch`);
      setLocations(prev => prev.map(l => ({ ...l, is_main: l.id === loc.id })));
    } catch {
      toast.error('Failed to update primary branch');
    }
  };

  const handleDelete = async (loc: StoreLocation) => {
    if (locations.length <= 1) {
      toast.error('You cannot delete your only store location.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${loc.name}"? Historical orders will retain this branch identifier.`)) {
      return;
    }

    try {
      await api.delete(`/api/locations/${loc.id}/`);
      toast.success(`Branch "${loc.name}" deleted`);
      fetchLocations();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to delete branch';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2 flex-nowrap min-w-0 min-h-[36px]">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white whitespace-nowrap shrink-0">
            <span className="sm:hidden">Store Branches</span>
            <span className="hidden sm:inline">Store Branches & Locations</span>
          </h1>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={openAddModal}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-btn shadow-xs shrink-0 cursor-pointer"
          >
            <Plus size={15} />
            <span className="sm:hidden">Add</span>
            <span className="hidden sm:inline">Add Branch</span>
          </Button>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
          Manage physical stores, sub-branches, assigned personnel, and localized POS terminals.
        </p>
      </header>

      {/* Subscription Banner for non-business users */}
      {!isBusiness && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <AlertCircle size={20} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-bold">Multi-Branch Management is a Business Tier Feature</p>
            <p className="text-amber-800 dark:text-amber-300">
              Single-store sellers can operate their primary store. Upgrade to <strong className="font-black">Uzaspea Business</strong> to add unlimited physical retail branches, localized stock, and worker terminals.
            </p>
            <div className="pt-1">
              <Link to="/pricing" className="font-bold underline hover:text-amber-700">
                Explore Business Plan &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Branch Cards Grid */}
      {loading ? (
        <CardGridSkeleton count={3} />
      ) : locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No store branches configured"
          description="Add your first physical retail branch or warehouse location."
          action={{
            label: "Create Store Location",
            onClick: openAddModal,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className={`rounded-2xl border-0 transition-all duration-200 bg-white dark:bg-[#161616] flex flex-col justify-between shadow-sm overflow-hidden ${
                !loc.is_active ? 'opacity-65 grayscale-20' : ''
              }`}
            >
              <div className="p-5 space-y-4">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-base text-gray-900 dark:text-white">
                        {loc.name}
                      </h3>
                      {loc.is_main && (
                        <span className="inline-flex items-center text-3xs font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300">
                          HQ / Main Store
                        </span>
                      )}
                    </div>
                    <p className="text-3xs text-gray-400 font-mono">
                      slug: {loc.slug}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center text-3xs font-bold px-2 py-0.5 rounded-full ${
                      loc.is_active
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400'
                    }`}
                  >
                    {loc.is_active ? 'Active' : 'Suspended'}
                  </span>
                </div>

                {/* Address & City */}
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
                    <span className="font-medium">
                      {loc.address_line}{loc.district ? `, ${loc.district}` : ''}, <strong className="text-gray-900 dark:text-white">{loc.city}</strong>
                    </span>
                  </div>

                  {/* Phone / Whatsapp */}
                  {(loc.phone || loc.whatsapp) && (
                    <div className="flex items-center gap-3 pt-1 text-3xs text-gray-500">
                      {loc.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={11} className="text-gray-400" />
                          {loc.phone}
                        </span>
                      )}
                      {loc.whatsapp && (
                        <span className="flex items-center gap-1">
                          <MessageSquare size={11} className="text-emerald-500" />
                          {loc.whatsapp}
                        </span>
                      )}
                    </div>
                  )}

                  {/* GPS Coordinates */}
                  {loc.latitude && loc.longitude && (
                    <div className="text-3xs text-gray-400 flex items-center gap-1 font-mono pt-0.5">
                      <Compass size={11} />
                      <span>{loc.latitude}, {loc.longitude}</span>
                    </div>
                  )}
                </div>

                {/* Metrics Pill Grid */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-white/5">
                    <div className="text-3xs text-gray-400 uppercase font-bold">Stock SKUs</div>
                    <div className="text-xs font-bold text-gray-900 dark:text-white mt-0.5">
                      {loc.inventory_count ?? 0} Listed
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-white/5">
                    <div className="text-3xs text-gray-400 uppercase font-bold">Assigned Staff</div>
                    <div className="text-xs font-bold text-gray-900 dark:text-white mt-0.5">
                      {loc.assigned_staff_count ?? 0} Workers
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-3 bg-gray-50/70 dark:bg-white/5 border-0 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(loc)}
                    className="h-7 text-xs px-2.5 flex items-center gap-1"
                  >
                    <Edit2 size={12} />
                    <span>Edit</span>
                  </Button>

                  {!loc.is_main && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetMain(loc)}
                      className="h-7 text-xs px-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10"
                      title="Promote to Primary HQ Branch"
                    >
                      Make HQ
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(loc)}
                    className={`text-2xs font-semibold px-2 py-1 rounded-lg transition cursor-pointer ${
                      loc.is_active
                        ? 'text-gray-500 hover:text-red-600'
                        : 'text-emerald-600 hover:text-emerald-700 font-bold'
                    }`}
                  >
                    {loc.is_active ? 'Suspend' : 'Activate'}
                  </button>

                  {!loc.is_main && locations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDelete(loc)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                      title="Delete branch"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Branch Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#141414] rounded-3xl max-w-lg w-full p-6 space-y-5 border-0 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-1 border-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingLoc ? 'Edit Branch' : 'Create Store Branch'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Branch Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Branch Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sinza Mori Branch, Kariakoo Flagship"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-gray-100 dark:bg-[#1f1f1f] border-0 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-500/50"
                />
              </div>

              {/* Address Line */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Street Address & Landmark *
                </label>
                <input
                  type="text"
                  required
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="e.g. Shekilango Road, Opposite Mori Plaza"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-gray-100 dark:bg-[#1f1f1f] border-0 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-500/50"
                />
              </div>

              {/* City & District */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    City / Region
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-gray-100 dark:bg-[#1f1f1f] border-0 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-500/50"
                  >
                    {TANZANIA_CITIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    District
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Kinondoni, Ilala, Ubungo"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-gray-100 dark:bg-[#1f1f1f] border-0 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-500/50"
                  />
                </div>
              </div>

              {/* Phone & Whatsapp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Direct Phone Line
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +255 712 345 678"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-gray-100 dark:bg-[#1f1f1f] border-0 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Branch WhatsApp
                  </label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="e.g. +255 789 123 456"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-gray-100 dark:bg-[#1f1f1f] border-0 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-500/50"
                  />
                </div>
              </div>

              {/* GPS Coordinates */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-gray-100 dark:bg-[#1a1a1a] border-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    GPS Coordinates (Smart Online Delivery Routing)
                  </span>
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={gettingGps}
                    className="text-3xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer"
                  >
                    {gettingGps ? 'Fetching GPS...' : 'Auto-detect GPS'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <input
                    type="text"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="Latitude (-6.7725)"
                    className="px-2.5 py-2 text-xs rounded-lg bg-white dark:bg-[#222222] border-0 text-gray-900 dark:text-white font-mono outline-none focus:ring-1 focus:ring-brand-500/50"
                  />
                  <input
                    type="text"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder="Longitude (39.2412)"
                    className="px-2.5 py-2 text-xs rounded-lg bg-white dark:bg-[#222222] border-0 text-gray-900 dark:text-white font-mono outline-none focus:ring-1 focus:ring-brand-500/50"
                  />
                </div>
              </div>

              {/* Override Lipa Number */}
              {lipaNumbers.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Branch Till / Paybill (Optional Override)
                  </label>
                  <select
                    value={overrideLipa}
                    onChange={(e) => setOverrideLipa(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-gray-100 dark:bg-[#1f1f1f] border-0 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-500/50"
                  >
                    <option value="">Use Company Global Lipa Number</option>
                    {lipaNumbers.map((lp: any) => (
                      <option key={lp.id} value={lp.id}>
                        {lp.network_name || 'Till'}: {lp.number} ({lp.name})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Is Main HQ */}
              <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={isMain}
                  onChange={(e) => setIsMain(e.target.checked)}
                  className="rounded text-brand-500 focus:ring-brand-500"
                />
                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                  Designate as Primary Business HQ Store
                </span>
              </label>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  loading={saving}
                >
                  {editingLoc ? 'Save Changes' : 'Create Branch'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchesManagerPage;
