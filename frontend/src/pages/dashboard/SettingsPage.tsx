import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { 
    User, Lock, Bell, X, Upload, CheckCircle2, Smartphone, Sliders, 
    ChevronLeft, ShieldCheck, ExternalLink, MapPin, Sparkles, HelpCircle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useUserRoles } from '../../context/AuthContext';
import { SUPPORTED_COUNTRIES, getDefaultCountry, setDefaultCountry } from '../../services/addressService';

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const roles = useUserRoles();
    const isCustomer = roles.isPureCustomer;
    const username = localStorage.getItem('username') || '';

    const initialTab = searchParams.get('tab') || 'profile';
    const [activeTab, setActiveTab] = useState<string>(initialTab);

    const handleTabChange = (tabKey: string) => {
        setActiveTab(tabKey);
        setSearchParams({ tab: tabKey }, { replace: true });
    };

    const [profile, setProfile] = useState<any>({});
    const [siteVisitStatus, setSiteVisitStatus] = useState<any>(null);
    const [form, setForm] = useState({ 
        bio: '', 
        phone_number: '', 
        location: '', 
        website: '', 
        instagram_username: '', 
        whatsapp_number: '', 
        facebook_url: '', 
        tiktok_username: '', 
        twitter_username: '', 
        youtube_url: '', 
        linkedin_url: '', 
        show_product_requests: true 
    });
    const [defaultCountryCode, setDefaultCountryCode] = useState<string>(() => getDefaultCountry(username).code);
    const [passwords, setPasswords] = useState({ old: '', new1: '', new2: '' });
    const [passwordChanging, setPasswordChanging] = useState(false);
    const [passwordRequestPending, setPasswordRequestPending] = useState(false);
    const [passwordMaskedEmail, setPasswordMaskedEmail] = useState('');
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
        } catch {
            toast.error('Failed to request permission.');
        }
    };

    const handleOpenUpgrade = async () => {
        setShowUpgradeModal(true);
        setLoadingUpgradeData(true);
        try {
            const [tiersRes, lipaRes] = await Promise.all([
                api.get('/api/subscription-tiers/'),
                api.get('/api/lipa-numbers/?is_system=true')
            ]);
            setTiers(tiersRes.data.results || tiersRes.data || []);
            let numbers = lipaRes.data.results || lipaRes.data || [];
            if (numbers.length === 0) {
                const fb = await api.get('/api/lipa-numbers/?seller=admin');
                numbers = fb.data.results || fb.data || [];
            }
            setAdminLipa(numbers);
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
                    show_product_requests: r.data.show_product_requests !== false,
                });
            });

            api.get('/api/seller-site-visits/my-status/')
                .then(r => setSiteVisitStatus(r.data))
                .catch(() => {});
        }
    }, [username]);

    const handleProfileSave = async () => {
        setSaving(true);
        try {
            await api.patch(`/api/profiles/${username}/`, form);
            toast.success('Profile updated');
        } catch { 
            toast.error('Failed to save'); 
        } finally { 
            setSaving(false); 
        }
    };

    const handlePasswordChange = async () => {
        if (!passwords.old) { toast.error('Please enter your current password'); return; }
        if (!passwords.new1) { toast.error('Please enter your new password'); return; }
        if (passwords.new1 !== passwords.new2) { toast.error('Passwords do not match'); return; }
        if (passwords.new1.length < 8) { toast.error('Password must be at least 8 characters'); return; }

        setPasswordChanging(true);
        try {
            const res = await api.post('/api/auth/request-password-change/', {
                old_password: passwords.old,
                new_password: passwords.new1,
            });
            toast.success('Password change request submitted');
            setPasswordRequestPending(true);
            setPasswordMaskedEmail(res.data?.masked_email || '');
            setPasswords({ old: '', new1: '', new2: '' });
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to request password change');
        } finally {
            setPasswordChanging(false);
        }
    };

    const navItems = [
        { 
            key: 'profile', 
            label: isCustomer ? 'Profile Information' : 'Store Profile', 
            icon: User 
        },
        { 
            key: 'notifications', 
            label: 'Notifications', 
            icon: Bell 
        },
        { 
            key: 'security', 
            label: 'Password & Security', 
            icon: Lock 
        },
        ...(!isCustomer ? [
            { 
                key: 'location', 
                label: 'Store Location', 
                icon: MapPin 
            },
            { 
                key: 'subscription', 
                label: 'Plan & Subscription', 
                icon: Sparkles 
            },
            { 
                key: 'features', 
                label: 'Store Features', 
                icon: Sliders 
            },
        ] : []),
    ];

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 space-y-6">
            {/* Header Area */}
            <header className="flex items-center justify-between pb-4 border-b border-neutral-800">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="text-neutral-400 hover:text-white transition -ml-1 p-1 rounded-lg inline-flex items-center cursor-pointer"
                            title="Back"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                            {isCustomer ? 'Account Settings' : 'Store & Account Settings'}
                        </h1>
                        {!isCustomer && profile.tier && (
                            <span className="hidden sm:inline-flex ml-2 px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-neutral-800 text-brand-400 border border-neutral-700">
                                {profile.tier}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-neutral-400 ml-7">
                        {isCustomer
                            ? 'Manage your personal profile, notifications, and security preferences.'
                            : 'Manage your store profile, verified location, subscription plan, and features.'}
                    </p>
                </div>
            </header>

            {/* Mobile Horizontal Navigation Tabs */}
            <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-neutral-800">
                {navItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.key;
                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => handleTabChange(item.key)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                                isActive
                                    ? 'bg-neutral-800 text-white font-semibold'
                                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                            }`}
                        >
                            <Icon size={14} className={isActive ? 'text-white' : 'text-neutral-500'} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Main Layout Grid: Desktop Sidebar + Content Pane */}
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8 items-start">
                
                {/* Desktop Sticky Sidebar */}
                <div className="hidden lg:block space-y-6 sticky top-20">
                    {/* User Identity Snapshot */}
                    <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-neutral-800 text-neutral-200 font-bold text-sm flex items-center justify-center border border-neutral-700 shrink-0">
                                {(username || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-sm text-white truncate">
                                    {profile.store_name || username || 'My Account'}
                                </h3>
                                <p className="text-xs text-neutral-500 font-mono truncate">
                                    @{username}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-800/80">
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                                {isCustomer ? 'Customer' : 'Seller Store'}
                            </span>
                            {!isCustomer && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-neutral-800 text-brand-400 capitalize">
                                    {profile.tier || 'Free'} Tier
                                </span>
                            )}
                            {profile.is_location_verified && (
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-neutral-800 text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 size={11} /> Verified
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Navigation Menu */}
                    <nav className="space-y-1">
                        {navItems.map(item => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.key;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => handleTabChange(item.key)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                                        isActive
                                            ? 'bg-neutral-800 text-white font-semibold'
                                            : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                                    }`}
                                >
                                    <Icon size={15} className={isActive ? 'text-white' : 'text-neutral-500'} />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* Subtle "Sell on SokoniMax" Verification Card for Customers */}
                    {isCustomer && (
                        <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/30 space-y-2">
                            <div className="text-xs font-semibold text-white">
                                Sell on SokoniMax
                            </div>
                            {siteVisitStatus?.can_upgrade || profile?.is_location_verified ? (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-neutral-400 leading-relaxed">
                                        Your physical store has been verified by staff.
                                    </p>
                                    <Link
                                        to="/upgrade"
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                                    >
                                        Set up your store &rarr;
                                    </Link>
                                </div>
                            ) : siteVisitStatus?.status === 'pending_review' ? (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-neutral-400 leading-relaxed">
                                        Store visit submitted. Awaiting admin review.
                                    </p>
                                    <Link
                                        to="/help?tab=site-verification"
                                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:underline"
                                    >
                                        View verification status &rarr;
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-neutral-400 leading-relaxed">
                                        Physical store verification is required before opening a seller account.
                                    </p>
                                    <Link
                                        to="/help?tab=site-verification"
                                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:underline"
                                    >
                                        Learn about verification &rarr;
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Main Content Pane */}
                <div className="bg-neutral-900/40 rounded-2xl border border-neutral-800 p-6 sm:p-8">
                    
                    {/* 1. Profile Tab */}
                    {activeTab === 'profile' && (
                        <div className="space-y-6">
                            <div className="border-b border-neutral-800 pb-4">
                                <h2 className="text-base font-semibold text-white">
                                    {isCustomer ? 'Profile Information' : 'Store Profile & Details'}
                                </h2>
                                <p className="text-xs text-neutral-400 mt-1">
                                    {isCustomer
                                        ? 'Update your personal details, bio, and contact information.'
                                        : 'Update your public storefront description, contact details, and social links.'}
                                </p>
                            </div>

                            <div className="space-y-5">
                                {/* Bio */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-neutral-300">
                                        {isCustomer ? 'Bio' : 'Store Bio'}
                                    </label>
                                    <textarea
                                        value={form.bio}
                                        onChange={e => setForm({ ...form, bio: e.target.value })}
                                        rows={3}
                                        placeholder={isCustomer ? "Tell us a bit about yourself..." : "Describe your store, products, and specialties..."}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-950 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-500 transition resize-none"
                                    />
                                </div>

                                {/* Phone & Location */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-neutral-300">
                                            Phone Number
                                        </label>
                                        <input
                                            type="tel"
                                            value={form.phone_number}
                                            onChange={e => setForm({ ...form, phone_number: e.target.value })}
                                            placeholder="+255..."
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-950 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-500 transition"
                                        />
                                    </div>
                                    {isCustomer && (
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-semibold text-neutral-300">
                                                Location / City
                                            </label>
                                            <input
                                                type="text"
                                                value={form.location}
                                                onChange={e => setForm({ ...form, location: e.target.value })}
                                                placeholder="e.g. Dar es Salaam"
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-950 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-500 transition"
                                            />
                                        </div>
                                    )}
                                    <div className="space-y-1.5 sm:col-span-2">
                                        <label className="block text-xs font-semibold text-neutral-300">
                                            Default Order & Delivery Country
                                        </label>
                                        <select
                                            value={defaultCountryCode}
                                            onChange={(e) => {
                                                const newCode = e.target.value;
                                                setDefaultCountryCode(newCode);
                                                setDefaultCountry(newCode, username);
                                                toast.success('Default delivery country updated');
                                            }}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-950 text-xs text-white focus:outline-none focus:border-brand-500 transition"
                                        >
                                            {SUPPORTED_COUNTRIES.map((c) => (
                                                <option key={c.code} value={c.code}>
                                                    {c.flag} {c.name} ({c.dialCode})
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-[11px] text-neutral-500">
                                            Sets your default phone dial code and destination country for checkout orders.
                                        </p>
                                    </div>
                                </div>

                                {/* Seller Links */}
                                {!isCustomer && (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-semibold text-neutral-300">
                                                    Website URL
                                                </label>
                                                <input
                                                    type="url"
                                                    value={form.website}
                                                    onChange={e => setForm({ ...form, website: e.target.value })}
                                                    placeholder="https://..."
                                                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-950 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-500 transition"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-semibold text-neutral-300">
                                                    Instagram Handle
                                                </label>
                                                <input
                                                    type="text"
                                                    value={form.instagram_username}
                                                    onChange={e => setForm({ ...form, instagram_username: e.target.value })}
                                                    placeholder="@username"
                                                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-950 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-500 transition"
                                                />
                                            </div>
                                        </div>

                                        {/* Social Channels */}
                                        <div className="pt-4 border-t border-neutral-800/80 space-y-3">
                                            <div>
                                                <h3 className="text-xs font-semibold text-white">Social Channels</h3>
                                                <p className="text-xs text-neutral-500 mt-0.5">Links displayed on your store profile for customer inquiries</p>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {[
                                                    { key: 'whatsapp_number', label: 'WhatsApp', type: 'tel', placeholder: '+255712345678' },
                                                    { key: 'facebook_url', label: 'Facebook URL', type: 'url', placeholder: 'https://facebook.com/...' },
                                                    { key: 'tiktok_username', label: 'TikTok', type: 'text', placeholder: '@username' },
                                                    { key: 'twitter_username', label: 'X (Twitter)', type: 'text', placeholder: '@username' },
                                                    { key: 'youtube_url', label: 'YouTube URL', type: 'url', placeholder: 'https://youtube.com/...' },
                                                    { key: 'linkedin_url', label: 'LinkedIn URL', type: 'url', placeholder: 'https://linkedin.com/in/...' },
                                                ].map(field => (
                                                    <div key={field.key} className="space-y-1">
                                                        <label className="block text-xs font-medium text-neutral-400">{field.label}</label>
                                                        <input
                                                            type={field.type}
                                                            value={(form as any)[field.key]}
                                                            onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                                                            placeholder={field.placeholder}
                                                            className="w-full px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-950 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-500 transition"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="flex justify-end pt-3 border-t border-neutral-800/80">
                                    <Button
                                        onClick={handleProfileSave}
                                        disabled={saving}
                                        loading={saving}
                                        size="sm"
                                        className="rounded-lg px-5 font-semibold text-xs cursor-pointer"
                                    >
                                        Save Profile
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. Notifications Tab */}
                    {activeTab === 'notifications' && (
                        <div className="space-y-6">
                            <div className="border-b border-neutral-800 pb-4">
                                <h2 className="text-base font-semibold text-white">Notifications</h2>
                                <p className="text-xs text-neutral-400 mt-1">Configure how and when you receive order updates and messages.</p>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-neutral-800 bg-neutral-950/60">
                                <div className="space-y-1">
                                    <div className="text-xs font-semibold text-white">Browser Push Notifications</div>
                                    <p className="text-xs text-neutral-400 max-w-md">
                                        {pushPermission === 'granted'
                                            ? 'Instant alerts are active directly in your browser.'
                                            : pushPermission === 'denied'
                                                ? 'Notifications are currently blocked in your browser settings.'
                                                : 'Receive timely alerts for orders, deliveries, and messages when the app is in the background.'}
                                    </p>
                                </div>
                                <div>
                                    {pushPermission === 'granted' ? (
                                        <span className="text-xs font-medium text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                                            <CheckCircle2 size={13} /> Enabled
                                        </span>
                                    ) : (
                                        <Button
                                            onClick={enablePushNotifications}
                                            size="sm"
                                            variant="outline"
                                            disabled={pushPermission === 'denied'}
                                            className="text-xs rounded-lg cursor-pointer"
                                        >
                                            {pushPermission === 'denied' ? 'Blocked in Browser' : 'Enable Notifications'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. Security Tab */}
                    {activeTab === 'security' && (
                        <div className="space-y-6">
                            <div className="border-b border-neutral-800 pb-4">
                                <h2 className="text-base font-semibold text-white">Password & Security</h2>
                                <p className="text-xs text-neutral-400 mt-1">Manage your password credentials and account protection.</p>
                            </div>

                            {passwordRequestPending ? (
                                <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-5 space-y-3">
                                    <div className="flex items-center gap-2 text-white font-semibold text-xs">
                                        <ShieldCheck size={16} className="text-brand-400" />
                                        <span>Password Change Request Pending</span>
                                    </div>
                                    <p className="text-xs text-neutral-300 leading-relaxed">
                                        An administrator is verifying your request. A confirmation link will be sent to your email on file {passwordMaskedEmail ? (<span className="text-white font-mono">({passwordMaskedEmail})</span>) : ''}.
                                    </p>
                                    <p className="text-xs text-neutral-400">
                                        Your current password remains active until confirmed. Confirmation links are strictly valid for 24 hours.
                                    </p>
                                    <div className="flex items-center justify-between pt-3 border-t border-neutral-800 text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setPasswordRequestPending(false)}
                                            className="font-semibold text-brand-400 hover:underline cursor-pointer"
                                        >
                                            Submit another request
                                        </button>
                                        <Link to="/help" className="text-neutral-400 hover:text-white flex items-center gap-1">
                                            <HelpCircle size={13} />
                                            <span>Contact Support</span>
                                            <ExternalLink size={12} />
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 max-w-md">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-neutral-300">Current Password</label>
                                        <input
                                            type="password"
                                            value={passwords.old}
                                            onChange={e => setPasswords({ ...passwords, old: e.target.value })}
                                            placeholder="Enter current password"
                                            className="w-full px-3.5 py-2 rounded-xl border border-neutral-800 bg-neutral-950 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-500 transition"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-neutral-300">New Password</label>
                                        <input
                                            type="password"
                                            value={passwords.new1}
                                            onChange={e => setPasswords({ ...passwords, new1: e.target.value })}
                                            placeholder="Min. 8 characters"
                                            className="w-full px-3.5 py-2 rounded-xl border border-neutral-800 bg-neutral-950 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-500 transition"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-neutral-300">Confirm New Password</label>
                                        <input
                                            type="password"
                                            value={passwords.new2}
                                            onChange={e => setPasswords({ ...passwords, new2: e.target.value })}
                                            placeholder="Re-type new password"
                                            className="w-full px-3.5 py-2 rounded-xl border border-neutral-800 bg-neutral-950 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-500 transition"
                                        />
                                    </div>
                                    <div className="pt-2">
                                        <Button
                                            onClick={handlePasswordChange}
                                            loading={passwordChanging}
                                            size="sm"
                                            className="rounded-lg px-5 font-semibold text-xs cursor-pointer"
                                        >
                                            Request Password Change
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 4. Store Location Tab (Seller only) */}
                    {!isCustomer && activeTab === 'location' && (
                        <div className="space-y-6">
                            <div className="border-b border-neutral-800 pb-4">
                                <h2 className="text-base font-semibold text-white">Store Location & Coordinates</h2>
                                <p className="text-xs text-neutral-400 mt-1">Verified physical store coordinates collected during staff inspection.</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-xl border border-neutral-800 bg-neutral-950/60">
                                <div className="space-y-1">
                                    <span className="text-xs text-neutral-400 font-medium block">Physical Address</span>
                                    <span className="text-sm font-semibold text-white block">{profile.location || 'Not set'}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-neutral-400 font-medium block">GPS Coordinates</span>
                                    <span className="text-sm font-semibold font-mono text-white block">
                                        {profile.latitude && profile.longitude ? (
                                            <a
                                                href={`https://www.google.com/maps?q=${profile.latitude},${profile.longitude}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-brand-400 hover:underline"
                                            >
                                                {Number(profile.latitude).toFixed(6)}, {Number(profile.longitude).toFixed(6)}
                                            </a>
                                        ) : (
                                            'Registered via GPS during site visit'
                                        )}
                                    </span>
                                </div>
                            </div>

                            <p className="text-xs text-neutral-500">
                                To update your verified store location or coordinates, submit a request via administration.
                            </p>
                        </div>
                    )}

                    {/* 5. Subscription Tab (Seller only) */}
                    {!isCustomer && activeTab === 'subscription' && (
                        <div className="space-y-6">
                            <div className="border-b border-neutral-800 pb-4">
                                <h2 className="text-base font-semibold text-white">Plan & Subscription</h2>
                                <p className="text-xs text-neutral-400 mt-1">Manage your active seller tier membership and listing limits.</p>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-neutral-800 bg-neutral-950/60">
                                <div className="space-y-1">
                                    <div className="text-xs text-neutral-400 font-medium">Active Plan</div>
                                    <div className="text-base font-bold text-white capitalize">{profile.tier || 'Free'} Tier</div>
                                    <p className="text-xs text-neutral-400 max-w-md">
                                        {profile.tier === 'free' && 'Upgrade to list more products and receive priority search placement.'}
                                        {profile.tier === 'seller_pro' && 'Seller Pro membership with expanded catalogue limits.'}
                                        {profile.tier === 'business' && 'Business enterprise tier with verified seller badge and priority reach.'}
                                    </p>
                                </div>
                                {profile.tier !== 'business' && (
                                    <Button
                                        onClick={handleOpenUpgrade}
                                        size="sm"
                                        className="rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                                    >
                                        Upgrade Plan
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 6. Features Tab (Seller only) */}
                    {!isCustomer && activeTab === 'features' && (
                        <div className="space-y-6">
                            <div className="border-b border-neutral-800 pb-4">
                                <h2 className="text-base font-semibold text-white">Store Features</h2>
                                <p className="text-xs text-neutral-400 mt-1">Configure interactive features and public customer request tools.</p>
                            </div>

                            <div className="flex items-center justify-between p-5 rounded-xl border border-neutral-800 bg-neutral-950/60">
                                <div className="pr-4 space-y-1">
                                    <div className="text-xs font-semibold text-white">Coming Soon & Customer Requests</div>
                                    <p className="text-xs text-neutral-400 max-w-lg">
                                        Show the "Coming Soon / Requested" tab on your public storefront so buyers can vote on upcoming inventory and submit custom product requests.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={form.show_product_requests}
                                        onChange={e => setForm(prev => ({ ...prev, show_product_requests: e.target.checked }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-10 h-5.5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:bg-white peer-checked:after:translate-x-full peer-checked:after:border-neutral-800 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white peer-checked:after:bg-black after:border-neutral-600 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all"></div>
                                </label>
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button
                                    onClick={handleProfileSave}
                                    disabled={saving}
                                    loading={saving}
                                    size="sm"
                                    className="rounded-lg px-5 font-semibold text-xs cursor-pointer"
                                >
                                    Save Feature Settings
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Upgrade Plan Modal */}
            {showUpgradeModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-neutral-950 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative border border-neutral-800 animate-scale-in my-8">
                        <button 
                            type="button"
                            onClick={() => { setShowUpgradeModal(false); setSelectedTier(null); }} 
                            className="absolute top-5 right-5 text-neutral-400 hover:text-white transition p-1 rounded-lg cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                        
                        <div className="border-b border-neutral-800 pb-3 mb-4">
                            <h3 className="text-base font-bold text-white">Upgrade Subscription Plan</h3>
                            <p className="text-xs text-neutral-400">Choose a premium tier to expand product limits and unlock features</p>
                        </div>

                        {loadingUpgradeData ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
                            </div>
                        ) : (
                            <div className="space-y-4 text-xs">
                                {!selectedTier ? (
                                    <div className="space-y-3">
                                        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Choose a Plan:</p>
                                        <div className="grid grid-cols-1 gap-2.5">
                                            {tiers.map((t: any) => (
                                                <div 
                                                    key={t.id} 
                                                    onClick={() => setSelectedTier(t)} 
                                                    className="p-3.5 rounded-xl border border-neutral-800 hover:border-brand-500 cursor-pointer transition flex justify-between items-center bg-neutral-900/60"
                                                >
                                                    <div>
                                                        <h4 className="font-bold text-white capitalize text-xs">{t.name} Plan</h4>
                                                        <p className="text-xs text-neutral-400 mt-0.5">{t.benefits || 'Premium store features'}</p>
                                                        <p className="text-xs text-neutral-500 font-medium mt-1">Duration: {t.duration} Days</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="font-bold text-brand-400 text-xs">TSh {Number(t.price).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            {tiers.length === 0 && (
                                                <p className="text-xs text-neutral-400 text-center py-4">No subscription tiers available.</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleUpgradeSubmit} className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
                                            <div>
                                                <p className="text-xs text-brand-400 font-semibold uppercase tracking-wider">Selected Plan</p>
                                                <h4 className="font-bold text-white capitalize text-xs">{selectedTier.name} ({selectedTier.duration} Days)</h4>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-neutral-400 uppercase">Total</p>
                                                <p className="font-bold text-brand-400 text-xs">TSh {Number(selectedTier.price).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        <button 
                                            type="button" 
                                            onClick={() => setSelectedTier(null)} 
                                            className="text-xs text-brand-400 hover:underline font-medium cursor-pointer"
                                        >
                                            ← Choose a different plan
                                        </button>

                                        <div>
                                            <p className="text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wider">
                                                Pay to official numbers:
                                            </p>
                                            {adminLipa.length === 0 ? (
                                                <p className="text-xs text-amber-500">No official payment numbers configured. Please contact support.</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {adminLipa.map((lipa: any) => (
                                                        <div key={lipa.id} className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-xl p-2.5">
                                                            <div className={`rounded-lg bg-neutral-800 flex items-center justify-center overflow-hidden shrink-0 border border-neutral-700 ${lipa.network_logo ? 'w-16 h-8' : 'w-8 h-8'}`}>
                                                                {lipa.network_logo ? (
                                                                    <img src={lipa.network_logo} alt={lipa.network_name} className="w-full h-full object-contain" />
                                                                ) : (
                                                                    <Smartphone size={16} className="text-emerald-400" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-neutral-400 uppercase leading-none">{lipa.network_name}</p>
                                                                <p className="font-mono font-bold text-white text-xs mt-0.5">{lipa.number}</p>
                                                                <p className="text-xs text-neutral-500 leading-none">{lipa.name}</p>
                                                            </div>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => { navigator.clipboard.writeText(lipa.number); toast.success('Copied!'); }}
                                                                className="ml-auto text-xs py-0.5 px-2 border border-neutral-700 rounded hover:bg-neutral-800 text-neutral-300 transition cursor-pointer"
                                                            >
                                                                Copy
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2.5">
                                            <div>
                                                <label className="block text-xs font-semibold text-neutral-400 mb-1">Transaction ID / Reference</label>
                                                <input 
                                                    type="text" 
                                                    required
                                                    value={refId} 
                                                    onChange={(e) => setRefId(e.target.value)}
                                                    placeholder="e.g. PP260618.1746"
                                                    className="w-full px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-900 text-xs font-mono text-white focus:outline-none focus:border-brand-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-neutral-400 mb-1">Receipt Screenshot</label>
                                                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-neutral-800 rounded-xl cursor-pointer hover:bg-neutral-900 transition">
                                                    <div className="flex flex-col items-center justify-center pt-2 pb-3">
                                                        <Upload size={18} className="text-neutral-400 mb-1" />
                                                        <p className="text-xs text-neutral-400 text-center px-4">
                                                            {proofFile ? proofFile.name : 'Click to upload screenshot proof'}
                                                        </p>
                                                    </div>
                                                    <input type="file" required className="hidden" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                                                </label>
                                            </div>
                                            <Button 
                                                type="submit"
                                                disabled={submittingUpgrade}
                                                className="w-full py-2.5 font-bold flex items-center justify-center gap-1.5 rounded-xl cursor-pointer"
                                            >
                                                <CheckCircle2 size={14} />
                                                {submittingUpgrade ? 'Submitting...' : 'Submit Payment Details'}
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
