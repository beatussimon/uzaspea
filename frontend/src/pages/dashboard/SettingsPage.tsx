import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import api, { API_BASE_URL } from '../../api';
import toast from 'react-hot-toast';
import { 
    User, Lock, Bell, X, Upload, CheckCircle2, Smartphone, Sliders, 
    ChevronLeft, ShieldCheck, ExternalLink, MapPin, Sparkles, HelpCircle, Pencil
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import VerifiedBadge from '../../components/VerifiedBadge';
import SocialLinks from '../../components/SocialLinks';
import { useUserRoles } from '../../context/AuthContext';
import { SUPPORTED_COUNTRIES, getDefaultCountry, setDefaultCountry } from '../../services/addressService';

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const roles = useUserRoles();
    const isCustomer = roles.isPureCustomer;
    const isDashboard = location.pathname.startsWith('/dashboard');
    const username = localStorage.getItem('username') || '';

    const initialTab = searchParams.get('tab') || 'profile';
    const [activeTab, setActiveTab] = useState<string>(initialTab);

    const handleTabChange = (tabKey: string) => {
        setActiveTab(tabKey);
        setSearchParams({ tab: tabKey }, { replace: true });
    };

    const [profile, setProfile] = useState<any>({});
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [initialForm, setInitialForm] = useState<any>(null);
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
        show_product_requests: false 
    });
    const [defaultCountryCode, setDefaultCountryCode] = useState<string>(() => getDefaultCountry(username).code);
    const [initialCountryCode, setInitialCountryCode] = useState<string>(() => getDefaultCountry(username).code);
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
                const loaded = {
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
                    show_product_requests: Boolean(r.data.show_product_requests),
                };
                setForm(loaded);
                setInitialForm(loaded);
            });

            api.get('/api/seller-site-visits/my-status/')
                .then(r => setSiteVisitStatus(r.data))
                .catch(() => {});
        }
    }, [username]);

    const isProfileDirty = Boolean(
        initialForm && (
            form.bio !== initialForm.bio ||
            form.phone_number !== initialForm.phone_number ||
            form.location !== initialForm.location ||
            form.website !== initialForm.website ||
            form.instagram_username !== initialForm.instagram_username ||
            form.whatsapp_number !== initialForm.whatsapp_number ||
            form.facebook_url !== initialForm.facebook_url ||
            form.tiktok_username !== initialForm.tiktok_username ||
            form.twitter_username !== initialForm.twitter_username ||
            form.youtube_url !== initialForm.youtube_url ||
            form.linkedin_url !== initialForm.linkedin_url ||
            defaultCountryCode !== initialCountryCode
        )
    );

    const isPasswordReady = Boolean(
        passwords.old.trim() && passwords.new1.trim() && passwords.new2.trim()
    );

    const isFeaturesDirty = Boolean(
        initialForm && form.show_product_requests !== initialForm.show_product_requests
    );

    const handleProfileSave = async () => {
        setSaving(true);
        try {
            await api.patch(`/api/profiles/${username}/`, form);
            toast.success('Profile updated');
            setInitialForm({ ...form });
            setProfile((prev: any) => ({ ...prev, ...form }));
            if (defaultCountryCode !== initialCountryCode) {
                setDefaultCountry(username, defaultCountryCode);
                setInitialCountryCode(defaultCountryCode);
            }
            setIsEditingProfile(false);
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
        <div className={`space-y-6 w-full max-w-6xl ${!isDashboard ? 'container-page py-6 sm:py-8' : ''}`}>
            {/* Header Area */}
            <header className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition -ml-1 p-1 rounded-lg inline-flex items-center cursor-pointer"
                        title="Back"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                        {isCustomer ? 'Account Settings' : 'Store & Account Settings'}
                    </h1>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 ml-7">
                    {isCustomer
                        ? 'Manage your personal profile, notifications, and security preferences.'
                        : 'Manage your store profile, verified location, subscription plan, and features.'}
                </p>
            </header>

            {/* Mobile Horizontal Navigation Tabs */}
            <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-gray-200/80 dark:border-neutral-800/80">
                {navItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.key;
                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => handleTabChange(item.key)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                                isActive
                                    ? 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white font-semibold'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-neutral-900 font-medium'
                            }`}
                        >
                            <Icon size={14} className={isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-neutral-500'} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Main Layout Grid: Desktop Sidebar + Content Pane */}
            <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 items-start">
                
                {/* Desktop Sticky Sidebar */}
                <div className="hidden lg:block space-y-4 sticky top-20">
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
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all text-left cursor-pointer ${
                                        isActive
                                            ? 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white font-semibold'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-neutral-900/60 font-medium'
                                    }`}
                                >
                                    <Icon size={15} className={isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-neutral-500'} />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* Subtle "Sell on SokoniMax" Verification Card for Customers */}
                    {isCustomer && (
                        <div className="p-3.5 rounded-xl bg-gray-50/70 dark:bg-neutral-900/40 space-y-2">
                            <div className="text-xs font-semibold text-gray-900 dark:text-white">
                                Sell on SokoniMax
                            </div>
                            {siteVisitStatus?.can_upgrade || profile?.is_location_verified ? (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                        Your physical store has been verified by staff.
                                    </p>
                                    <Link
                                        to="/upgrade"
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline transition-colors"
                                    >
                                        Set up your store &rarr;
                                    </Link>
                                </div>
                            ) : siteVisitStatus?.status === 'pending_review' ? (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                        Store visit submitted. Awaiting admin review.
                                    </p>
                                    <Link
                                        to="/help?tab=site-verification"
                                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                                    >
                                        View verification status &rarr;
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                        Physical store verification is required before opening a seller account.
                                    </p>
                                    <Link
                                        to="/help?tab=site-verification"
                                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                                    >
                                        Learn about verification &rarr;
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Main Content Pane */}
                <div className="bg-white dark:bg-[#141414] rounded-card p-6 sm:p-8 shadow-xs">
                    
                    {/* 1. Profile Tab */}
                    {activeTab === 'profile' && (
                        !isEditingProfile ? (
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
                                {/* Left: Avatar Column */}
                                <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full border border-gray-150 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 shrink-0 overflow-hidden flex items-center justify-center shadow-xs">
                                    {profile.profile_picture ? (
                                        <img 
                                            src={profile.profile_picture.startsWith('http') ? profile.profile_picture : `${API_BASE_URL}${profile.profile_picture}`} 
                                            alt={profile.store_name || username} 
                                            className="w-full h-full object-cover" 
                                        />
                                    ) : (
                                        <span className="text-4xl font-light text-gray-300 dark:text-neutral-700 uppercase select-none">
                                            {(username || 'U').charAt(0)}
                                        </span>
                                    )}
                                </div>

                                {/* Right: Username, Badges, CTAs & Bio */}
                                <div className="flex-1 min-w-0 space-y-3.5 w-full text-center sm:text-left">
                                    {/* Row 1: Name, Badges & Actions */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap">
                                            <h2 className="text-xl sm:text-2xl font-light text-gray-900 dark:text-white flex items-center gap-1.5 leading-none">
                                                {profile.store_name || username}
                                                <VerifiedBadge tier={profile.tier} isVerified={profile.is_verified || profile.is_location_verified} className="w-5 h-5 sm:w-6 sm:h-6" />
                                            </h2>

                                            {!isCustomer && profile.tier && (
                                                <span className="text-2xs font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-black dark:bg-white text-white dark:text-black">
                                                    {profile.tier}
                                                </span>
                                            )}

                                            {profile.is_location_verified && (
                                                <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1">
                                                    <CheckCircle2 size={11} /> Verified Location
                                                </span>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center justify-center sm:justify-end gap-2 shrink-0">
                                            <button 
                                                type="button"
                                                onClick={() => setIsEditingProfile(true)} 
                                                className="px-4 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800/50 text-xs font-semibold text-gray-700 dark:text-neutral-300 transition duration-150 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <Pencil size={12} className="text-gray-400 dark:text-gray-500" />
                                                <span>{isCustomer ? 'Edit Profile' : 'Edit Store Profile'}</span>
                                            </button>

                                            {!isCustomer && username && (
                                                <Link 
                                                    to={`/${username}`}
                                                    target="_blank"
                                                    className="px-3.5 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800/50 text-xs font-semibold text-gray-700 dark:text-neutral-300 transition duration-150 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <span>View Storefront</span>
                                                    <ExternalLink size={12} className="text-gray-400 dark:text-gray-500" />
                                                </Link>
                                            )}
                                        </div>
                                    </div>

                                    {/* Row 2: Handle */}
                                    <p className="text-xs text-gray-500 dark:text-neutral-400 font-mono">
                                        @{username}
                                    </p>

                                    {/* Row 3: Bio */}
                                    <div className="space-y-3 text-sm text-gray-800 dark:text-neutral-200 w-full max-w-xl">
                                        {form.bio ? (
                                            <p className="leading-relaxed whitespace-pre-wrap break-words">{form.bio}</p>
                                        ) : (
                                            <p className="italic text-gray-400 dark:text-neutral-600">No biography details provided.</p>
                                        )}

                                        {/* Bottom Meta Details & Social Links */}
                                        <div className="pt-1 space-y-2 flex flex-col items-center sm:items-start w-full">
                                            {/* Contact Details & Location */}
                                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-neutral-400 font-medium">
                                                {form.phone_number && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Smartphone size={13} />
                                                        <span className="font-mono">{form.phone_number}</span>
                                                    </div>
                                                )}

                                                {(() => {
                                                    const country = SUPPORTED_COUNTRIES.find(c => c.code === defaultCountryCode) || SUPPORTED_COUNTRIES[0];
                                                    return (
                                                        <div className="flex items-center gap-1.5">
                                                            <span>{country.flag}</span>
                                                            <span>{country.name} ({country.dialCode})</span>
                                                        </div>
                                                    );
                                                })()}

                                                {form.location && (
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin size={13} />
                                                        <span>{form.location}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Social Media Icons */}
                                            {!isCustomer && (
                                                <div className="flex items-center justify-center sm:justify-start w-full pt-1">
                                                    <SocialLinks profile={form} iconSize={16} className="justify-center sm:justify-start" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-neutral-800 pb-4">
                                    <div>
                                        <h2 className="text-base font-bold text-gray-900 dark:text-white">
                                            {isCustomer ? 'Edit Profile Information' : 'Edit Store Profile & Details'}
                                        </h2>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            {isCustomer
                                                ? 'Update your personal details, bio, and contact information.'
                                                : 'Update your public storefront description, contact details, and social links.'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (initialForm) setForm({ ...initialForm });
                                            setDefaultCountryCode(initialCountryCode);
                                            setIsEditingProfile(false);
                                        }}
                                        className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-900 transition cursor-pointer self-start sm:self-auto shrink-0"
                                    >
                                        Cancel
                                    </button>
                                </div>

                                <div className="space-y-5">
                                    {/* Bio */}
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                                            {isCustomer ? 'Bio' : 'Store Bio'}
                                        </label>
                                        <textarea
                                            value={form.bio}
                                            onChange={e => setForm({ ...form, bio: e.target.value })}
                                            rows={3}
                                            placeholder={isCustomer ? "Tell us a bit about yourself..." : "Describe your store, products, and specialties..."}
                                            className="w-full px-3.5 py-2.5 rounded-btn border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#111] text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-900 dark:focus:border-white transition-all resize-none"
                                        />
                                    </div>

                                    {/* Phone & Location */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                Phone Number
                                            </label>
                                            <input
                                                type="tel"
                                                value={form.phone_number}
                                                onChange={e => setForm({ ...form, phone_number: e.target.value })}
                                                placeholder="+255..."
                                                className="w-full px-3.5 py-2.5 rounded-btn border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#111] text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-900 dark:focus:border-white transition-all"
                                            />
                                        </div>
                                        {isCustomer && (
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                    Location / City
                                                </label>
                                                <input
                                                    type="text"
                                                    value={form.location}
                                                    onChange={e => setForm({ ...form, location: e.target.value })}
                                                    placeholder="e.g. Dar es Salaam"
                                                    className="w-full px-3.5 py-2.5 rounded-btn border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#111] text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-900 dark:focus:border-white transition-all"
                                                />
                                            </div>
                                        )}
                                        <div className="space-y-1.5 sm:col-span-2">
                                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
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
                                                className="w-full px-3.5 py-2.5 rounded-btn border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#111] text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-900 dark:focus:border-white transition-all cursor-pointer"
                                            >
                                                {SUPPORTED_COUNTRIES.map((c) => (
                                                    <option key={c.code} value={c.code}>
                                                        {c.flag} {c.name} ({c.dialCode})
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                                Sets your default phone dial code and destination country for checkout orders.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Seller Links */}
                                    {!isCustomer && (
                                        <>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                        Website URL
                                                    </label>
                                                    <input
                                                        type="url"
                                                        value={form.website}
                                                        onChange={e => setForm({ ...form, website: e.target.value })}
                                                        placeholder="https://..."
                                                        className="w-full px-3.5 py-2.5 rounded-btn border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#111] text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-900 dark:focus:border-white transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                        Instagram Handle
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={form.instagram_username}
                                                        onChange={e => setForm({ ...form, instagram_username: e.target.value })}
                                                        placeholder="@username"
                                                        className="w-full px-3.5 py-2.5 rounded-btn border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#111] text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-900 dark:focus:border-white transition-all"
                                                    />
                                                </div>
                                            </div>

                                            {/* Social Channels */}
                                            <div className="pt-4 border-t border-gray-100 dark:border-neutral-800 space-y-3">
                                                <div>
                                                    <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Social Channels</h3>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Links displayed on your store profile for customer inquiries</p>
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
                                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{field.label}</label>
                                                            <input
                                                                type={field.type}
                                                                value={(form as any)[field.key]}
                                                                onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                                                                placeholder={field.placeholder}
                                                                className="w-full px-3 py-2 rounded-btn border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#111] text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-900 dark:focus:border-white transition-all"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-neutral-800">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (initialForm) setForm({ ...initialForm });
                                                setDefaultCountryCode(initialCountryCode);
                                                setIsEditingProfile(false);
                                            }}
                                            className="px-4 py-2 rounded-btn text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <Button
                                            onClick={handleProfileSave}
                                            disabled={!isProfileDirty || saving}
                                            loading={saving}
                                            size="sm"
                                            className={`rounded-btn px-5 text-xs transition-all ${
                                                !isProfileDirty
                                                    ? '!bg-gray-100 dark:!bg-neutral-800/80 !text-gray-400 dark:!text-neutral-500 border border-gray-200/80 dark:border-neutral-700/60 font-medium shadow-none cursor-not-allowed'
                                                    : '!bg-black !text-white hover:!bg-neutral-800 dark:!bg-white dark:!text-black dark:hover:!bg-neutral-200 font-semibold shadow-sm cursor-pointer'
                                            }`}
                                        >
                                            Save Profile
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )
                    )}

                    {/* 2. Notifications Tab */}
                    {activeTab === 'notifications' && (
                        <div className="space-y-6">
                            <div className="border-b border-gray-100 dark:border-neutral-800 pb-4">
                                <h2 className="text-base font-bold text-gray-900 dark:text-white">Notifications</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Configure how and when you receive order updates and messages.</p>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
                                <div className="space-y-1">
                                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Browser Push Notifications</div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
                                        {pushPermission === 'granted'
                                            ? 'Instant alerts are active directly in your browser.'
                                            : pushPermission === 'denied'
                                                ? 'Notifications are currently blocked in your browser settings.'
                                                : 'Receive timely alerts for orders, deliveries, and messages when the app is in the background.'}
                                    </p>
                                </div>
                                <div className="shrink-0">
                                    {pushPermission === 'granted' ? (
                                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 px-3 py-1.5 rounded-btn inline-flex items-center gap-1.5">
                                            <CheckCircle2 size={13} /> Enabled
                                        </span>
                                    ) : (
                                        <Button
                                            onClick={enablePushNotifications}
                                            size="sm"
                                            disabled={pushPermission === 'denied'}
                                            className="!bg-black !text-white hover:!bg-neutral-800 dark:!bg-white dark:!text-black dark:hover:!bg-neutral-200 text-xs rounded-btn font-semibold cursor-pointer shadow-sm disabled:opacity-50"
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
                            <div className="border-b border-gray-100 dark:border-neutral-800 pb-4">
                                <h2 className="text-base font-bold text-gray-900 dark:text-white">Password & Security</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Manage your password credentials and account protection.</p>
                            </div>

                            {passwordRequestPending ? (
                                <div className="p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 space-y-3">
                                    <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-semibold text-xs">
                                        <ShieldCheck size={16} className="text-amber-600 dark:text-amber-400" />
                                        <span>Password Change Request Pending</span>
                                    </div>
                                    <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                                        An administrator is verifying your request. A confirmation link will be sent to your email on file {passwordMaskedEmail ? (<span className="font-mono font-semibold">({passwordMaskedEmail})</span>) : ''}.
                                    </p>
                                    <p className="text-xs text-amber-700/80 dark:text-amber-400/70">
                                        Your current password remains active until confirmed. Confirmation links are strictly valid for 24 hours.
                                    </p>
                                    <div className="flex items-center justify-between pt-3 border-t border-amber-200/60 dark:border-amber-900/40 text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setPasswordRequestPending(false)}
                                            className="font-semibold text-gray-900 dark:text-white hover:underline cursor-pointer"
                                        >
                                            Submit another request
                                        </button>
                                        <Link to="/help" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 transition-colors">
                                            <HelpCircle size={13} />
                                            <span>Contact Support</span>
                                            <ExternalLink size={12} />
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 max-w-md">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Current Password</label>
                                        <input
                                            type="password"
                                            value={passwords.old}
                                            onChange={e => setPasswords({ ...passwords, old: e.target.value })}
                                            placeholder="Enter current password"
                                            className="w-full px-3.5 py-2.5 rounded-btn border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#111] text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-900 dark:focus:border-white transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">New Password</label>
                                        <input
                                            type="password"
                                            value={passwords.new1}
                                            onChange={e => setPasswords({ ...passwords, new1: e.target.value })}
                                            placeholder="Min. 8 characters"
                                            className="w-full px-3.5 py-2.5 rounded-btn border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#111] text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-900 dark:focus:border-white transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Confirm New Password</label>
                                        <input
                                            type="password"
                                            value={passwords.new2}
                                            onChange={e => setPasswords({ ...passwords, new2: e.target.value })}
                                            placeholder="Re-type new password"
                                            className="w-full px-3.5 py-2.5 rounded-btn border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#111] text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-900 dark:focus:border-white transition-all"
                                        />
                                    </div>
                                    <div className="pt-2">
                                        <Button
                                            onClick={handlePasswordChange}
                                            loading={passwordChanging}
                                            disabled={!isPasswordReady || passwordChanging}
                                            size="sm"
                                            className={`rounded-btn px-5 text-xs transition-all ${
                                                !isPasswordReady
                                                    ? '!bg-gray-100 dark:!bg-neutral-800/80 !text-gray-400 dark:!text-neutral-500 border border-gray-200/80 dark:border-neutral-700/60 font-medium shadow-none cursor-not-allowed'
                                                    : '!bg-black !text-white hover:!bg-neutral-800 dark:!bg-white dark:!text-black dark:hover:!bg-neutral-200 font-semibold shadow-sm cursor-pointer'
                                            }`}
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
                            <div className="border-b border-gray-100 dark:border-neutral-800 pb-4">
                                <h2 className="text-base font-bold text-gray-900 dark:text-white">Store Location & Coordinates</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Verified physical store coordinates collected during staff inspection.</p>
                            </div>

                            <div className="divide-y divide-gray-100 dark:divide-neutral-800/80">
                                <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium block">Physical Address</span>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white block mt-0.5">
                                            {profile.location || 'Not set'}
                                        </span>
                                    </div>
                                    {profile.is_location_verified && (
                                        <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 inline-flex items-center gap-1 w-fit">
                                            <CheckCircle2 size={11} /> Verified by Staff
                                        </span>
                                    )}
                                </div>
                                <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium block">GPS Coordinates</span>
                                        <span className="text-sm font-semibold font-mono text-gray-900 dark:text-white block mt-0.5">
                                            {profile.latitude && profile.longitude ? (
                                                <a
                                                    href={`https://www.google.com/maps?q=${profile.latitude},${profile.longitude}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-gray-900 dark:text-white hover:underline"
                                                >
                                                    {Number(profile.latitude).toFixed(6)}, {Number(profile.longitude).toFixed(6)}
                                                    <ExternalLink size={12} className="text-gray-400" />
                                                </a>
                                            ) : (
                                                'Registered via GPS during site visit'
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs text-gray-500 dark:text-gray-400 pt-2">
                                To update your verified store location or coordinates, submit a request via administration.
                            </p>
                        </div>
                    )}

                    {/* 5. Subscription Tab (Seller only) */}
                    {!isCustomer && activeTab === 'subscription' && (
                        <div className="space-y-6">
                            <div className="border-b border-gray-100 dark:border-neutral-800 pb-4">
                                <h2 className="text-base font-bold text-gray-900 dark:text-white">Plan & Subscription</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Manage your active seller tier membership and listing limits.</p>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Active Plan:</span>
                                        <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-200/80 dark:border-neutral-700">
                                            {profile.tier || 'Free'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md pt-1">
                                        {profile.tier === 'free' && 'Upgrade to list more products, unlock verified badges, and get priority search placement.'}
                                        {profile.tier === 'seller_pro' && 'Seller Pro membership with expanded catalogue limits and analytics.'}
                                        {profile.tier === 'business' && 'Business enterprise tier with verified seller badge and priority reach.'}
                                    </p>
                                </div>
                                {profile.tier !== 'business' && (
                                    <Button
                                        onClick={handleOpenUpgrade}
                                        size="sm"
                                        className="!bg-black !text-white hover:!bg-neutral-800 dark:!bg-white dark:!text-black dark:hover:!bg-neutral-200 rounded-btn text-xs font-semibold shrink-0 cursor-pointer shadow-sm"
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
                            <div className="border-b border-gray-100 dark:border-neutral-800 pb-4">
                                <h2 className="text-base font-bold text-gray-900 dark:text-white">Store Features</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Configure interactive features and public customer request tools.</p>
                            </div>

                            <div className="flex items-center justify-between gap-4 py-2">
                                <div className="pr-4 space-y-1">
                                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Coming Soon & Customer Requests</div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-lg">
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
                                    <div className="w-11 h-6 bg-gray-200 dark:bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:bg-gray-900 dark:peer-checked:bg-white peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:peer-checked:after:bg-black after:border-gray-300 dark:after:border-neutral-700 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                                </label>
                            </div>

                            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-neutral-800">
                                <Button
                                    onClick={handleProfileSave}
                                    disabled={!isFeaturesDirty || saving}
                                    loading={saving}
                                    size="sm"
                                    className={`rounded-btn px-5 text-xs transition-all ${
                                        !isFeaturesDirty
                                            ? '!bg-gray-100 dark:!bg-neutral-800/80 !text-gray-400 dark:!text-neutral-500 border border-gray-200/80 dark:border-neutral-700/60 font-medium shadow-none cursor-not-allowed'
                                            : '!bg-black !text-white hover:!bg-neutral-800 dark:!bg-white dark:!text-black dark:hover:!bg-neutral-200 font-semibold shadow-sm cursor-pointer'
                                    }`}
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-[#111] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative border border-gray-200/80 dark:border-neutral-800 animate-scale-in my-8 text-gray-900 dark:text-white">
                        <button 
                            type="button"
                            onClick={() => { setShowUpgradeModal(false); setSelectedTier(null); }} 
                            className="absolute top-5 right-5 text-gray-400 hover:text-gray-900 dark:hover:text-white transition p-1 rounded-lg cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                        
                        <div className="border-b border-gray-100 dark:border-neutral-800 pb-3 mb-4">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">Upgrade Subscription Plan</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Choose a premium tier to expand product limits and unlock features</p>
                        </div>

                        {loadingUpgradeData ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
                            </div>
                        ) : (
                            <div className="space-y-4 text-xs">
                                {!selectedTier ? (
                                    <div className="space-y-3">
                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Choose a Plan:</p>
                                        <div className="grid grid-cols-1 gap-2.5">
                                            {tiers.map((t: any) => (
                                                <div 
                                                    key={t.id} 
                                                    onClick={() => setSelectedTier(t)} 
                                                    className="p-3.5 rounded-xl border border-gray-200 dark:border-neutral-800 hover:border-gray-900 dark:hover:border-white cursor-pointer transition flex justify-between items-center bg-gray-50/70 dark:bg-neutral-900/40"
                                                >
                                                    <div>
                                                        <h4 className="font-bold text-gray-900 dark:text-white capitalize text-xs">{t.name} Plan</h4>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.benefits || 'Premium store features'}</p>
                                                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mt-1">Duration: {t.duration} Days</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="font-bold text-gray-900 dark:text-white text-xs">TSh {Number(t.price).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            {tiers.length === 0 && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">No subscription tiers available.</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleUpgradeSubmit} className="space-y-3">
                                        <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-neutral-900/60 border border-gray-200 dark:border-neutral-800 rounded-xl">
                                            <div>
                                                <p className="text-2xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Selected Plan</p>
                                                <h4 className="font-bold text-gray-900 dark:text-white capitalize text-xs">{selectedTier.name} ({selectedTier.duration} Days)</h4>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xs text-gray-500 dark:text-gray-400 uppercase">Total</p>
                                                <p className="font-bold text-gray-900 dark:text-white text-xs">TSh {Number(selectedTier.price).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        <button 
                                            type="button" 
                                            onClick={() => setSelectedTier(null)} 
                                            className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:underline font-medium cursor-pointer"
                                        >
                                            ← Choose a different plan
                                        </button>

                                        <div>
                                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
                                                Pay to official numbers:
                                            </p>
                                            {adminLipa.length === 0 ? (
                                                <p className="text-xs text-amber-600 dark:text-amber-400">No official payment numbers configured. Please contact support.</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {adminLipa.map((lipa: any) => (
                                                        <div key={lipa.id} className="flex items-center gap-3 bg-gray-50 dark:bg-neutral-900/60 border border-gray-200 dark:border-neutral-800 rounded-xl p-2.5">
                                                            <div className={`rounded-lg bg-white dark:bg-neutral-800 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200 dark:border-neutral-700 ${lipa.network_logo ? 'w-16 h-8' : 'w-8 h-8'}`}>
                                                                {lipa.network_logo ? (
                                                                    <img src={lipa.network_logo} alt={lipa.network_name} className="w-full h-full object-contain" />
                                                                ) : (
                                                                    <Smartphone size={16} className="text-emerald-500" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase leading-none">{lipa.network_name}</p>
                                                                <p className="font-mono font-bold text-gray-900 dark:text-white text-xs mt-0.5">{lipa.number}</p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-none">{lipa.name}</p>
                                                            </div>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => { navigator.clipboard.writeText(lipa.number); toast.success('Copied!'); }}
                                                                className="ml-auto text-xs py-0.5 px-2 border border-gray-200 dark:border-neutral-700 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-300 transition cursor-pointer"
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
                                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Transaction ID / Reference</label>
                                                <input 
                                                    type="text" 
                                                    required
                                                    value={refId} 
                                                    onChange={(e) => setRefId(e.target.value)}
                                                    placeholder="e.g. PP260618.1746"
                                                    className="w-full px-3.5 py-2.5 rounded-btn border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#111] text-xs font-mono text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-900 dark:focus:border-white transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Receipt Screenshot</label>
                                                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-200 dark:border-neutral-800 rounded-btn cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition">
                                                    <div className="flex flex-col items-center justify-center pt-2 pb-3">
                                                        <Upload size={18} className="text-gray-400 mb-1" />
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center px-4">
                                                            {proofFile ? proofFile.name : 'Click to upload screenshot proof'}
                                                        </p>
                                                    </div>
                                                    <input type="file" required className="hidden" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                                                </label>
                                            </div>
                                            <Button 
                                                type="submit"
                                                disabled={submittingUpgrade}
                                                loading={submittingUpgrade}
                                                className="w-full py-2.5 !bg-black !text-white hover:!bg-neutral-800 dark:!bg-white dark:!text-black dark:hover:!bg-neutral-200 font-bold flex items-center justify-center gap-1.5 rounded-btn cursor-pointer shadow-sm text-xs"
                                            >
                                                <CheckCircle2 size={14} />
                                                Submit Payment Details
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
