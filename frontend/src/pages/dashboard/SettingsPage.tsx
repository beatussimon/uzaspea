import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { User, Lock, Bell, X, Upload, CheckCircle2, Smartphone, MapPin, Clock, ArrowRight, Store, Sparkles, ChevronLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';

const CITIES_COORDS: Record<string, { lat: number; lng: number }> = {
  'Dar es Salaam': { lat: -6.776012, lng: 39.178326 },
  'Mwanza': { lat: -2.5167, lng: 32.9000 },
  'Arusha': { lat: -3.3731, lng: 36.6858 },
  'Dodoma': { lat: -6.1630, lng: 35.7516 },
  'Zanzibar': { lat: -6.1659, lng: 39.1990 },
};

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isSeller = user?.tier === 'seller_pro' || user?.tier === 'business' || user?.is_staff || user?.is_superuser;
    const isCustomer = !isSeller && !user?.is_team_member && user?.tier !== 'worker';

    const [profile, setProfile] = useState<any>({});
    const [form, setForm] = useState({ bio: '', phone_number: '', location: '', website: '', instagram_username: '', whatsapp_number: '', facebook_url: '', tiktok_username: '', twitter_username: '', youtube_url: '', linkedin_url: '', latitude: '', longitude: '', show_product_requests: true });
    const [passwords, setPasswords] = useState({ old: '', new1: '', new2: '' });
    const [saving, setSaving] = useState(false);

    // Subscription Upgrade State
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [tiers, setTiers] = useState<any[]>([]);
    const [selectedTier, setSelectedTier] = useState<any>(null);
    const [adminLipa, setAdminLipa] = useState<any[]>([]);
    const [submittingUpgrade, setSubmittingUpgrade] = useState(false);
    const [refId, setRefId] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [loadingUpgradeData, setLoadingUpgradeData] = useState(false);

    const [pushPermission, setPushPermission] = useState<NotificationPermission>(
        typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
    );

    const enablePushNotifications = async () => {
        if (!('Notification' in window)) {
            toast.error('This browser does not support push notifications.');
            return;
        }
        try {
            const permission = await Notification.requestPermission();
            setPushPermission(permission);
            if (permission === 'granted') {
                toast.success('Push notifications enabled!');
            } else if (permission === 'denied') {
                toast.error('Notification permission denied. Enable it in browser settings.');
            }
        } catch (err) {
            toast.error('Failed to request permission.');
        }
    };

    const handleOpenUpgrade = async () => {
        setShowUpgradeModal(true);
        setLoadingUpgradeData(true);
        try {
            const [tiersRes, lipaRes] = await Promise.all([
                api.get('/api/subscription-tiers/'),
                api.get('/api/lipa-numbers/?seller=admin')
            ]);
            setTiers(tiersRes.data.results || tiersRes.data || []);
            setAdminLipa(lipaRes.data.results || lipaRes.data || []);
        } catch {
            toast.error('Failed to load payment options.');
        } finally {
            setLoadingUpgradeData(false);
        }
    };

    const handleUpgradeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTier) return toast.error('Please select a tier');
        if (!refId) return toast.error('Please enter the transaction reference');
        if (!proofFile) return toast.error('Please upload proof of payment screenshot');

        setSubmittingUpgrade(true);
        const fd = new FormData();
        fd.append('tier', selectedTier.id);
        fd.append('amount', selectedTier.price);
        fd.append('reference', refId);
        fd.append('proof', proofFile);

        try {
            await api.post('/api/subscription-payments/', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Upgrade request submitted successfully! Staff will verify it shortly.');
            setShowUpgradeModal(false);
            setRefId('');
            setProofFile(null);
            setSelectedTier(null);
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Failed to submit upgrade request');
        } finally {
            setSubmittingUpgrade(false);
        }
    };

    useEffect(() => {
        const username = localStorage.getItem('username');
        if (username) {
            api.get(`/api/profiles/${username}/`).then(r => {
                setProfile(r.data);
                setForm({
                    bio: r.data.bio || '',
                    phone_number: r.data.phone_number || '',
                    location: r.data.location || '',
                    website: r.data.website || '',
                    instagram_username: r.data.instagram_username || '',
                    whatsapp_number: r.data.whatsapp_number || '',
                    facebook_url: r.data.facebook_url || '',
                    tiktok_username: r.data.tiktok_username || '',
                    twitter_username: r.data.twitter_username || '',
                    youtube_url: r.data.youtube_url || '',
                    linkedin_url: r.data.linkedin_url || '',
                    latitude: r.data.latitude || '',
                    longitude: r.data.longitude || '',
                    show_product_requests: r.data.show_product_requests !== false,
                });
            });
        }
    }, []);

    const handleProfileSave = async () => {
        setSaving(true);
        try {
            const username = localStorage.getItem('username');
            await api.patch(`/api/profiles/${username}/`, form);
            toast.success('Profile updated');
        } catch { toast.error('Failed to save'); }
        finally { setSaving(false); }
    };

    const handlePasswordChange = async () => {
        if (passwords.new1 !== passwords.new2) { toast.error('Passwords do not match'); return; }
        if (passwords.new1.length < 8) { toast.error('Password must be at least 8 characters'); return; }
        try {
            await api.post('/api/auth/change-password/', { old_password: passwords.old, new_password: passwords.new1 });
            toast.success('Password changed');
            setPasswords({ old: '', new1: '', new2: '' });
        } catch { toast.error('Incorrect current password'); }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <header>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition -ml-1.5 p-0.5 rounded-lg inline-flex items-center"
                        title="Back"
                    >
                        <ChevronLeft size={22} />
                    </button>
                    <span>{isCustomer ? 'Account Settings' : 'Account & Store Settings'}</span>
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                    {isCustomer
                        ? 'Manage your personal profile, security credentials, and notifications.'
                        : 'Manage your seller profile, contact info, business coordinates, and security.'}
                </p>
            </header>

            {/* Become a Seller Banner for Customers */}
            {isCustomer && (
                <div className="card p-6 bg-gradient-to-br from-brand-500/10 via-brand-500/5 to-transparent border border-brand-500/30 shadow-sm relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1.5 max-w-xl">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-600 dark:text-brand-400 text-[11px] font-bold tracking-wide">
                                <Sparkles size={12} />
                                <span>Seller Opportunity</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                Want to Sell on SokoniMax?
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                Upgrade your account to list products, leverage our managed warehousing and logistics, and reach thousands of buyers across the country.
                            </p>
                        </div>
                        <Link
                            to="/upgrade"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-btn text-xs font-bold whitespace-nowrap shadow-md shadow-brand-500/20 transition active:scale-95 shrink-0"
                        >
                            <Store size={15} />
                            <span>Become a Seller</span>
                            <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            )}

            {/* Profile Info */}
            <div className="card p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-surface-border dark:border-surface-dark-border pb-3">
                    <User size={18} className="text-brand-500" />
                    <div>
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white">Profile Information</h3>
                        <p className="text-2xs text-gray-400">
                            {isCustomer ? 'Personal details displayed on your public profile' : 'Public profile details displayed on your seller storefront'}
                        </p>
                    </div>
                </div>
                {[
                    { key: 'bio', label: isCustomer ? 'Bio / About You' : 'Bio / About Store', type: 'textarea' },
                    { key: 'phone_number', label: 'Phone Number', type: 'text' },
                    { key: 'location', label: isCustomer ? 'Location / City' : 'Store Location Address', type: 'text' },
                    { key: 'website', label: 'Website URL', type: 'url' },
                    { key: 'instagram_username', label: 'Instagram Handle', type: 'text' },
                ].map(field => (
                    <div key={field.key}>
                        <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">{field.label}</label>
                        {field.type === 'textarea' ? (
                            <textarea value={(form as any)[field.key]} onChange={e => setForm({...form, [field.key]: e.target.value})}
                                className="input resize-none py-2 text-xs w-full" rows={3} />
                        ) : (
                            <input type={field.type} value={(form as any)[field.key]} onChange={e => setForm({...form, [field.key]: e.target.value})}
                                className="input py-2 text-xs w-full" />
                        )}
                    </div>
                ))}

                {/* Social Media Links */}
                <div className="pt-4 border-t border-surface-border dark:border-surface-dark-border space-y-3">
                    <div>
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white">Social Media Links</h4>
                        <p className="text-2xs text-gray-400">Add links for contacts on social platforms</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                            { key: 'whatsapp_number', label: 'WhatsApp Number', type: 'tel', placeholder: '+255712345678' },
                            { key: 'facebook_url', label: 'Facebook URL', type: 'url', placeholder: 'https://facebook.com/...' },
                            { key: 'tiktok_username', label: 'TikTok Username', type: 'text', placeholder: '@username' },
                            { key: 'twitter_username', label: 'X (Twitter) Username', type: 'text', placeholder: '@username' },
                            { key: 'youtube_url', label: 'YouTube Channel URL', type: 'url', placeholder: 'https://youtube.com/...' },
                            { key: 'linkedin_url', label: 'LinkedIn URL', type: 'url', placeholder: 'https://linkedin.com/in/...' },
                        ].map(field => (
                            <div key={field.key}>
                                <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">{field.label}</label>
                                <input type={field.type} value={(form as any)[field.key]} onChange={e => setForm({...form, [field.key]: e.target.value})}
                                    className="input py-2 text-xs w-full" placeholder={field.placeholder} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <Button onClick={handleProfileSave} disabled={saving} size="sm" className="font-bold">
                        {saving ? 'Saving...' : 'Save Profile'}
                    </Button>
                </div>
            </div>

            {/* Business Location Coords (Sellers only) */}
            {!isCustomer && (
                <div className="card p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-surface-border dark:border-surface-dark-border pb-3">
                        <MapPin size={18} className="text-brand-500" />
                        <div>
                            <h3 className="font-bold text-sm text-gray-900 dark:text-white">Business Location Coordinates</h3>
                            <p className="text-2xs text-gray-400">Used for accurate delivery route and dispatch rate calculations</p>
                        </div>
                    </div>
                    {profile.is_location_verified === false && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-btn text-xs text-amber-600 dark:text-amber-400">
                            Your business location is pending verification by staff. Update your coordinates below and save — our team will verify your location.
                        </div>
                    )}
                    <div>
                        <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">City Preset</label>
                        <select
                            onChange={(e) => {
                                const city = e.target.value;
                                if (city && CITIES_COORDS[city]) {
                                    setForm(prev => ({
                                        ...prev,
                                        latitude: CITIES_COORDS[city].lat.toString(),
                                        longitude: CITIES_COORDS[city].lng.toString()
                                    }));
                                }
                            }}
                            className="input py-2 text-xs w-full font-bold"
                            defaultValue=""
                        >
                            <option value="" disabled>-- Select a City Preset --</option>
                            {Object.keys(CITIES_COORDS).map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">Latitude</label>
                            <input
                                type="number"
                                step="any"
                                value={form.latitude}
                                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                                className="input py-2 text-xs w-full font-mono"
                                placeholder="-6.8161"
                            />
                        </div>
                        <div>
                            <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">Longitude</label>
                            <input
                                type="number"
                                step="any"
                                value={form.longitude}
                                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                                className="input py-2 text-xs w-full font-mono"
                                placeholder="39.2803"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <Button onClick={handleProfileSave} disabled={saving} size="sm" className="font-bold">
                            {saving ? 'Saving...' : 'Save Location'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Tier Status (Sellers) */}
            {!isCustomer && (
                <div className="card p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Bell size={16} className="text-brand-500" />
                                <h3 className="font-bold text-xs text-gray-900 dark:text-white uppercase tracking-wider">Subscription Tier</h3>
                            </div>
                            <p className="font-black text-xl capitalize text-brand-600 dark:text-brand-400">{profile.tier || 'Free'}</p>
                            {profile.tier === 'free' && <p className="text-2xs text-gray-400 mt-0.5">Upgrade to list more products and get promoted placement</p>}
                            {profile.tier === 'standard' && <p className="text-2xs text-gray-400 mt-0.5">You have access to standard seller features</p>}
                            {profile.tier === 'premium' && <p className="text-2xs text-emerald-500 mt-0.5">✓ Full access to all premium features</p>}
                        </div>
                        {profile.tier !== 'premium' && (
                            <Button onClick={handleOpenUpgrade} size="sm" className="font-bold">Upgrade Plan</Button>
                        )}
                    </div>
                </div>
            )}

            {/* Push Notifications Card */}
            <div className="card p-5 space-y-3">
                <div className="flex items-center gap-2 border-b border-surface-border dark:border-surface-dark-border pb-3">
                    <Bell size={18} className="text-brand-500" />
                    <div>
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white">Push Notifications</h3>
                        <p className="text-2xs text-gray-400">Receive real-time alerts about incoming orders and updates</p>
                    </div>
                </div>
                <div className="flex items-center justify-between bg-surface-muted dark:bg-[#161616] p-3 rounded-btn border border-surface-border dark:border-surface-dark-border">
                    <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">Notification Status</p>
                        <p className="text-2xs text-gray-400 capitalize mt-0.5">
                            {pushPermission === 'granted' ? 'Enabled (Granted)' : pushPermission === 'denied' ? 'Disabled (Denied)' : 'Not Enabled Yet'}
                        </p>
                    </div>
                    {pushPermission !== 'granted' ? (
                        <Button onClick={enablePushNotifications} size="sm" disabled={pushPermission === 'denied'}>
                            {pushPermission === 'denied' ? 'Notifications Blocked' : 'Enable Push Notifications'}
                        </Button>
                    ) : (
                        <span className="text-3xs font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={12} /> Active
                        </span>
                    )}
                </div>
            </div>

            {/* Store Profile Features (Sellers only) */}
            {!isCustomer && (
                <div className="card p-5 space-y-3">
                    <div className="flex items-center gap-2 border-b border-surface-border dark:border-surface-dark-border pb-3">
                        <Clock size={18} className="text-brand-500" />
                        <div>
                            <h3 className="font-bold text-sm text-gray-900 dark:text-white">Store Profile Features</h3>
                            <p className="text-2xs text-gray-400">Control public interaction tools shown to buyers</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-surface-muted dark:bg-[#161616] rounded-btn border border-surface-border dark:border-surface-dark-border">
                        <div className="pr-4">
                            <p className="text-xs font-bold text-gray-900 dark:text-white">Coming Soon & Customer Requests</p>
                            <p className="text-2xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Show the "Coming Soon / Requested" tab on your profile so buyers can vote on upcoming items and submit new product requests.
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                                type="checkbox"
                                checked={form.show_product_requests}
                                onChange={e => setForm(prev => ({ ...prev, show_product_requests: e.target.checked }))}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                        </label>
                    </div>
                    <div className="flex justify-end pt-2">
                        <Button onClick={handleProfileSave} disabled={saving} size="sm" className="font-bold">
                            {saving ? 'Saving...' : 'Save Feature Settings'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Change Password */}
            <div className="card p-5 space-y-3">
                <div className="flex items-center gap-2 border-b border-surface-border dark:border-surface-dark-border pb-3">
                    <Lock size={18} className="text-brand-500" />
                    <div>
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white">Change Password</h3>
                        <p className="text-2xs text-gray-400">Update your account authentication credentials</p>
                    </div>
                </div>
                <input type="password" placeholder="Current Password" value={passwords.old}
                    onChange={e => setPasswords({...passwords, old: e.target.value})} className="input py-2 text-xs w-full" />
                <input type="password" placeholder="New Password (min 8 chars)" value={passwords.new1}
                    onChange={e => setPasswords({...passwords, new1: e.target.value})} className="input py-2 text-xs w-full" />
                <input type="password" placeholder="Confirm New Password" value={passwords.new2}
                    onChange={e => setPasswords({...passwords, new2: e.target.value})} className="input py-2 text-xs w-full" />
                <div className="flex justify-end pt-2">
                    <Button onClick={handlePasswordChange} size="sm" className="font-bold">Update Password</Button>
                </div>
            </div>

            {/* Upgrade Plan Modal */}
            {showUpgradeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-[#121212] rounded-card max-w-lg w-full p-5 shadow-2xl relative border border-surface-border dark:border-surface-dark-border animate-scale-in my-8">
                        <button onClick={() => { setShowUpgradeModal(false); setSelectedTier(null); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
                            <X size={18} />
                        </button>
                        
                        <div className="border-b border-surface-border dark:border-surface-dark-border pb-3 mb-4">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Upgrade Subscription Plan</h3>
                            <p className="text-2xs text-gray-400">Choose a premium tier to expand your product limits and gain priority placement</p>
                        </div>

                        {loadingUpgradeData ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
                            </div>
                        ) : (
                            <div className="space-y-4 text-xs">
                                {!selectedTier ? (
                                    <div className="space-y-3">
                                        <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">Choose a Plan:</p>
                                        <div className="grid grid-cols-1 gap-2.5">
                                            {tiers.map((t: any) => (
                                                <div key={t.id} onClick={() => setSelectedTier(t)} className="card p-3.5 hover:border-brand-500 cursor-pointer transition flex justify-between items-center">
                                                    <div>
                                                        <h4 className="font-bold text-gray-900 dark:text-white capitalize text-xs">{t.name} Plan</h4>
                                                        <p className="text-3xs text-gray-400 mt-0.5">{t.benefits || 'Premium store features'}</p>
                                                        <p className="text-3xs text-gray-500 font-bold mt-1">Duration: {t.duration} Days</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="font-extrabold text-brand-600 dark:text-brand-400 text-xs">TSh {Number(t.price).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            {tiers.length === 0 && (
                                                <p className="text-xs text-gray-400 text-center py-4">No subscription tiers available.</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleUpgradeSubmit} className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-brand-500/10 border border-brand-500/20 rounded-btn">
                                            <div>
                                                <p className="text-3xs text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider">Selected Plan</p>
                                                <h4 className="font-extrabold text-gray-900 dark:text-white capitalize text-xs">{selectedTier.name} ({selectedTier.duration} Days)</h4>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-3xs text-gray-400 uppercase">Total Price</p>
                                                <p className="font-extrabold text-brand-600 dark:text-brand-400 text-xs">TSh {Number(selectedTier.price).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        <button type="button" onClick={() => setSelectedTier(null)} className="text-2xs text-brand-600 dark:text-brand-400 hover:underline font-bold">
                                            ← Choose a different plan
                                        </button>

                                        <div>
                                            <p className="text-2xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                                                Pay to these numbers:
                                            </p>
                                            {adminLipa.length === 0 ? (
                                                <p className="text-xs text-amber-500">No official payment numbers configured. Please contact support.</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {adminLipa.map((lipa: any) => (
                                                        <div key={lipa.id} className="flex items-center gap-3 bg-surface-muted dark:bg-[#161616] border border-surface-border dark:border-surface-dark-border rounded-btn p-2.5">
                                                            <div className={`rounded-lg bg-white dark:bg-[#121212] flex items-center justify-center overflow-hidden shrink-0 border border-surface-border dark:border-surface-dark-border ${lipa.network_logo ? 'w-16 h-8' : 'w-8 h-8'}`}>
                                                                {lipa.network_logo ? (
                                                                    <img src={lipa.network_logo} alt={lipa.network_name} className="w-full h-full object-contain" />
                                                                ) : (
                                                                    <Smartphone size={16} className="text-emerald-500" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-3xs font-bold text-gray-400 uppercase leading-none">{lipa.network_name}</p>
                                                                <p className="font-mono font-extrabold text-gray-900 dark:text-white text-xs mt-0.5">{lipa.number}</p>
                                                                <p className="text-3xs text-gray-500 leading-none">{lipa.name}</p>
                                                            </div>
                                                            <button type="button" onClick={() => { navigator.clipboard.writeText(lipa.number); toast.success('Copied!'); }}
                                                                className="ml-auto btn-ghost text-3xs py-0.5 px-2 border border-surface-border dark:border-surface-dark-border rounded">Copy</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2.5">
                                            <div>
                                                <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Transaction ID / Reference</label>
                                                <input 
                                                    type="text" 
                                                    required
                                                    value={refId} 
                                                    onChange={(e) => setRefId(e.target.value)}
                                                    placeholder="e.g. PP260618.1746"
                                                    className="input py-2 text-xs w-full font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Receipt Screenshot</label>
                                                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-surface-border dark:border-surface-dark-border rounded-btn cursor-pointer hover:bg-surface-muted/40 dark:hover:bg-[#161616]/40 transition">
                                                    <div className="flex flex-col items-center justify-center pt-2 pb-3">
                                                        <Upload size={18} className="text-gray-400 mb-1" />
                                                        <p className="text-2xs text-gray-500 dark:text-gray-400 text-center px-4">
                                                            {proofFile ? proofFile.name : 'Click to upload screenshot proof'}
                                                        </p>
                                                    </div>
                                                    <input type="file" required className="hidden" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                                                </label>
                                            </div>
                                            <Button 
                                                type="submit"
                                                disabled={submittingUpgrade}
                                                className="w-full py-2.5 font-bold flex items-center justify-center gap-1.5"
                                            >
                                                <CheckCircle2 size={14} />
                                                {submittingUpgrade ? 'Submitting Details...' : 'Submit Payment Details'}
                                            </Button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;
