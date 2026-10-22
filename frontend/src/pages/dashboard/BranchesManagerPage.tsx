import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { 
  MapPin, Plus, Edit2, Trash2, Phone, MessageSquare, 
  AlertCircle, Search, Loader2, Navigation
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { StoreBranchesSkeleton } from '../../components/Skeleton';
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
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended'>('all');

  const filteredLocations = useMemo(() => {
    if (filterStatus === 'active') return locations.filter(l => l.is_active);
    if (filterStatus === 'suspended') return locations.filter(l => !l.is_active);
    return locations;
  }, [locations, filterStatus]);

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

  const [locationText, setLocationText] = useState('');
  const [locationDetail, setLocationDetail] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const locationWrapperRef = useRef<HTMLDivElement>(null);
  const suppressSearchRef = useRef(false);

  // Autocomplete debounced query for Tanzania locations
  useEffect(() => {
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false;
      return;
    }
    if (!locationText || locationText.trim().length < 2) {
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingLocation(true);
      try {
        let items: any[] = [];
        try {
          const res = await api.get('/api/locations/search/', { params: { q: locationText.trim() } });
          if (Array.isArray(res.data) && res.data.length > 0) {
            items = res.data;
          }
        } catch {
          // Proceed to Nominatim fallback below
        }

        if (items.length === 0) {
          const directRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationText.trim())}&format=json&countrycodes=tz&addressdetails=1&limit=6`,
            { headers: { 'Accept-Language': 'en', 'User-Agent': 'SokoniMax/1.0' } }
          );
          const data = await directRes.json();
          items = (data || []).map((item: any) => {
            const addr = item.address || {};
            const detectedCity = addr.city || addr.town || addr.municipality || addr.state || '';
            const detectedDistrict = addr.city_district || addr.county || addr.district || addr.suburb || '';
            const road = addr.road || addr.pedestrian || addr.suburb || '';
            return {
              place_id: item.place_id,
              display_name: item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              city: detectedCity,
              district: detectedDistrict,
              road: road,
            };
          });
        }

        setLocationSuggestions(items);
        setShowLocationSuggestions(items.length > 0);
      } catch {
        setLocationSuggestions([]);
      } finally {
        setSearchingLocation(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [locationText]);

  // Click outside to close suggestion dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationWrapperRef.current && !locationWrapperRef.current.contains(e.target as Node)) {
        setShowLocationSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLocationPlace = (place: any) => {
    suppressSearchRef.current = true;
    setLat(place.lat.toFixed(6));
    setLng(place.lng.toFixed(6));
    const detectedCity = place.city || place.region || 'Dar es Salaam';
    const detectedDistrict = place.district || '';
    const placeTitle = place.road || place.display_name.split(',')[0].trim();

    setCity(detectedCity);
    setDistrict(detectedDistrict);
    setAddressLine(placeTitle);

    // Format simple: City, District, Street
    const formatted = [detectedCity, detectedDistrict, placeTitle].filter(Boolean).join(', ');
    setLocationText(formatted);
    setLocationDetail(place.display_name || formatted);
    setShowLocationSuggestions(false);
    toast.success(`Location set: ${formatted}`);
  };

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
    setCity('');
    setDistrict('');
    setPhone('');
    setWhatsapp('');
    setLat('');
    setLng('');
    setIsMain(locations.length === 0);
    setOverrideLipa('');
    setLocationText('');
    setLocationDetail('');
    setLocationSuggestions([]);
    setShowLocationSuggestions(false);
    suppressSearchRef.current = true;
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

    // Format simple: City, District, Street
    const formatted = [loc.city, loc.district, loc.address_line].filter(Boolean).join(', ');
    setLocationText(formatted);
    const detail = [loc.address_line, loc.district, loc.city, 'Tanzania'].filter(Boolean).join(', ');
    setLocationDetail(detail);
    setLocationSuggestions([]);
    setShowLocationSuggestions(false);
    suppressSearchRef.current = true;
    setModalOpen(true);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setLat(latitude.toFixed(6));
        setLng(longitude.toFixed(6));

        try {
          const res = await api.get('/api/reverse-geocode/', {
            params: { lat: latitude, lng: longitude }
          });
          const raw = res.data?.raw || {};
          const detectedCity = raw.city || raw.town || raw.municipality || raw.state || 'Dar es Salaam';
          const detectedDistrict = raw.city_district || raw.county || raw.district || raw.suburb || '';
          const detectedRoad = raw.road || raw.pedestrian || raw.suburb || '';

          setCity(detectedCity);
          setDistrict(detectedDistrict);
          setAddressLine(detectedRoad || res.data?.address || '');

          // Format simple: City, District, Street
          const formatted = [detectedCity, detectedDistrict, detectedRoad].filter(Boolean).join(', ');
          suppressSearchRef.current = true;
          const fullAddress = res.data?.address || res.data?.raw?.display_name || formatted;
          setLocationText(formatted || fullAddress || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          setLocationDetail(fullAddress);

          toast.success(`GPS Location: ${formatted || detectedCity}`);
        } catch {
          toast.success('GPS coordinates retrieved!');
        } finally {
          setGettingGps(false);
        }
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
    if (!name.trim()) {
      toast.error('Please enter branch name');
      return;
    }
    if (!locationText.trim()) {
      toast.error('Please enter branch location');
      return;
    }

    // Parse simple: City, District, Street
    const parts = locationText.split(',').map(s => s.trim()).filter(Boolean);
    let finalCity = city || 'Dar es Salaam';
    let finalDistrict = district || '';
    let finalAddress = addressLine || locationText;

    if (parts.length >= 3) {
      finalCity = parts[0];
      finalDistrict = parts[1];
      finalAddress = parts.slice(2).join(', ');
    } else if (parts.length === 2) {
      finalCity = parts[0];
      finalAddress = parts[1];
    } else if (parts.length === 1) {
      finalAddress = parts[0];
    }

    setSaving(true);
    const payload: any = {
      name: name.trim(),
      address_line: finalAddress.trim(),
      city: finalCity.trim(),
      district: finalDistrict.trim(),
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

    if (loc.is_active) {
      // Stage 1: Soft-delete / Move to Suspended
      const confirmed = window.confirm(
        `"${loc.name}" will not be permanently deleted. It will be deactivated and moved to Suspended where it can be restored anytime.\n\nProceed to move to Suspended?`
      );
      if (!confirmed) return;

      try {
        await api.patch(`/api/locations/${loc.id}/`, { is_active: false });
        toast.success(`"${loc.name}" moved to Suspended`);
        setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, is_active: false } : l));
      } catch {
        toast.error('Failed to suspend branch');
      }
    } else {
      // Stage 2: Permanent deletion from Suspended
      const confirmed = window.confirm(
        `Permanently delete "${loc.name}"?\n\nThis action cannot be undone and will permanently remove this store location.`
      );
      if (!confirmed) return;

      try {
        await api.delete(`/api/locations/${loc.id}/`);
        toast.success(`Branch "${loc.name}" permanently deleted`);
        setLocations(prev => prev.filter(l => l.id !== loc.id));
      } catch (err: any) {
        const msg = err.response?.data?.detail || 'Failed to delete branch';
        toast.error(msg);
      }
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

      {/* Gray Filter Tabs */}
      {locations.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: 'all', label: 'All', count: locations.length },
            { key: 'active', label: 'Active', count: locations.filter(l => l.is_active).length },
            { key: 'suspended', label: 'Suspended', count: locations.filter(l => !l.is_active).length },
          ].map((tab) => {
            const isActive = filterStatus === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterStatus(tab.key as any)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-gray-100 dark:bg-[#161616] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-3xs font-black ${
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
      )}

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
        <StoreBranchesSkeleton count={3} />
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
      ) : filteredLocations.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No {filterStatus} store branches found.
          </p>
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
          >
            Show All Branches
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredLocations.map((loc) => (
            <div
              key={loc.id}
              className={`rounded-2xl border-0 transition-all duration-200 bg-white dark:bg-[#161616] flex flex-col justify-between shadow-sm overflow-hidden ${
                !loc.is_active ? 'opacity-65 grayscale-20' : ''
              }`}
            >
              <div className="p-5 space-y-4">
                {/* Header Row */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <h3 className="font-bold text-base text-gray-900 dark:text-white truncate">
                        {loc.name}
                      </h3>
                      {loc.is_main ? (
                        <span className="inline-flex items-center text-3xs font-bold uppercase px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300 translate-y-0.5 shrink-0">
                          HQ
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetMain(loc)}
                          className="inline-flex items-center text-3xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-400 dark:hover:text-white transition cursor-pointer translate-y-0.5 shrink-0"
                          title="Promote to Primary HQ Branch"
                        >
                          Make HQ
                        </button>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center text-3xs font-bold shrink-0 translate-y-0.5 ${
                        loc.is_active
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-gray-500 dark:text-neutral-400'
                      }`}
                    >
                      {loc.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </div>

                  {loc.is_main && (
                    <div className="hidden sm:block">
                      <span className="inline-flex items-center text-3xs font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300">
                        HQ / Main Store
                      </span>
                    </div>
                  )}
                </div>

                {/* Address & City */}
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  <div className="flex items-start gap-2 min-w-0">
                    <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
                    <span
                      className="font-medium line-clamp-1 truncate"
                      title={`${loc.address_line}${loc.district ? `, ${loc.district}` : ''}, ${loc.city}`}
                    >
                      {loc.address_line}{loc.district ? `, ${loc.district}` : ''}, <strong className="text-gray-900 dark:text-white">{loc.city}</strong>
                    </span>
                  </div>
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
              <div className="px-5 pb-4 pt-1 bg-transparent border-0 flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(loc)}
                    className="h-7 text-xs px-2.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 transition whitespace-nowrap shrink-0 cursor-pointer font-medium"
                  >
                    <Edit2 size={12} />
                    <span>Edit</span>
                  </button>

                  {loc.phone && (
                    <a
                      href={`tel:${loc.phone}`}
                      className="h-7 w-7 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center transition shrink-0"
                      title={`Call ${loc.phone}`}
                      aria-label={`Call ${loc.phone}`}
                    >
                      <Phone size={13} />
                    </a>
                  )}

                  {(loc.whatsapp || loc.phone) && (
                    <a
                      href={
                        loc.whatsapp
                          ? `https://wa.me/${loc.whatsapp.replace(/[^0-9]/g, '')}`
                          : `sms:${loc.phone}`
                      }
                      target={loc.whatsapp ? "_blank" : undefined}
                      rel={loc.whatsapp ? "noopener noreferrer" : undefined}
                      className="h-7 w-7 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center justify-center transition shrink-0"
                      title={loc.whatsapp ? `WhatsApp ${loc.whatsapp}` : `Text ${loc.phone}`}
                      aria-label={loc.whatsapp ? `WhatsApp ${loc.whatsapp}` : `Text ${loc.phone}`}
                    >
                      <MessageSquare size={13} />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(loc)}
                    className={`h-7 text-xs font-semibold px-2.5 rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer ${
                      loc.is_active
                        ? 'text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20'
                        : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 font-bold'
                    }`}
                  >
                    {loc.is_active ? 'Suspend' : 'Activate'}
                  </button>

                  {!loc.is_main && locations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDelete(loc)}
                      className="h-7 w-7 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center transition shrink-0 cursor-pointer"
                      title={loc.is_active ? "Move to Suspended" : "Permanently Delete Branch"}
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

              {/* Location: Search or Auto GPS */}
              <div ref={locationWrapperRef} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    Location *
                  </label>
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={gettingGps}
                    className="inline-flex items-center gap-1.5 text-2xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg transition cursor-pointer"
                  >
                    {gettingGps ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        <span>Detecting GPS...</span>
                      </>
                    ) : (
                      <>
                        <Navigation size={12} />
                        <span>Auto-detect GPS</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative">
                  <div className="relative flex items-center">
                    <Search size={14} className="absolute left-3.5 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={locationText}
                      onChange={(e) => {
                        suppressSearchRef.current = false;
                        setLocationText(e.target.value);
                        if (!e.target.value.trim()) setLocationDetail('');
                      }}
                      onFocus={() => {
                        if (locationSuggestions.length > 0) setShowLocationSuggestions(true);
                      }}
                      placeholder="e.g. Dar es Salaam, Ilala, Msimbazi Street"
                      className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl bg-gray-100 dark:bg-[#1f1f1f] border-0 text-gray-900 dark:text-white outline-none focus:outline-none focus:ring-0 placeholder:text-gray-400"
                    />
                    {searchingLocation && (
                      <div className="absolute right-3 text-gray-400">
                        <Loader2 size={13} className="animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Autocomplete Suggestions Dropdown (No outlines/borders) */}
                  {showLocationSuggestions && locationSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl max-h-56 overflow-y-auto p-1 space-y-0.5 border-0">
                      {locationSuggestions.map((p, idx) => {
                        const cityVal = p.city || p.region || 'Dar es Salaam';
                        const districtVal = p.district || '';
                        const streetVal = p.road || p.display_name.split(',')[0];
                        const cleanLine = [cityVal, districtVal, streetVal].filter(Boolean).join(', ');
                        return (
                          <button
                            key={p.place_id || idx}
                            type="button"
                            onClick={() => handleSelectLocationPlace(p)}
                            className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-800 dark:text-gray-200 border-0 flex items-start gap-2.5 transition cursor-pointer"
                          >
                            <MapPin size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-gray-900 dark:text-white truncate">
                                {cleanLine}
                              </div>
                              <div className="text-3xs text-gray-500 dark:text-gray-400 truncate">
                                {p.display_name}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Selected Location Details Displayed Below */}
                {locationDetail && (
                  <div className="pt-0.5 px-0.5">
                    <p className="text-3xs sm:text-2xs text-gray-500 dark:text-gray-400 leading-relaxed font-normal">
                      {locationDetail}
                    </p>
                  </div>
                )}
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
