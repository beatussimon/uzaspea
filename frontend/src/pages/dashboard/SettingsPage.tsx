import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../api';
import toast from 'react-hot-toast';
import { 
    User, Lock, Bell, X, Upload, CheckCircle2, Smartphone, Sliders, 
    ChevronLeft, ShieldCheck, HelpCircle, ExternalLink, ChevronDown, 
    MapPin, Sparkles, ChevronsUpDown
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useUserRoles } from '../../context/AuthContext';

interface CollapsibleCardProps {
    id: string;
    icon: React.ReactNode;
    iconBgClass?: string;
    title: string;
    subtitle: string;
    badge?: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
    id,
    icon,
    iconBgClass = 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300',
    title,
    subtitle,
    badge,
    isOpen,
    onToggle,
    children
}) => {
    return (
        <div 
            id={id} 
            className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-xs hover:border-gray-200 dark:hover:border-neutral-700 transition-all overflow-hidden scroll-mt-24"
        >
            <button
                type="button"
                onClick={onToggle}
                className="w-full p-4 sm:p-5 flex items-center justify-between text-left group transition-colors hover:bg-gray-50/70 dark:hover:bg-neutral-800/30 cursor-pointer"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 pr-2">
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-2xs ${iconBgClass}`}>
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <h2 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white truncate">
                            {title}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                            {subtitle}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {badge}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white group-hover:bg-gray-100 dark:group-hover:bg-neutral-800 transition-all">
                        <ChevronDown size={18} className={`transition-transform duration-250 ease-out ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            </button>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] }}
                        className="overflow-hidden"
                    >
                        <div className="p-5 sm:p-6 pt-2 border-t border-gray-100 dark:border-neutral-800/80">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const roles = useUserRoles();
    const isCustomer = roles.isPureCustomer;
    const username = localStorage.getItem('username') || '';

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
    const [passwords, setPasswords] = useState({ old: '', new1: '', new2: '' });
    const [passwordChanging, setPasswordChanging] = useState(false);
    const [passwordRequestPending, setPasswordRequestPending] = useState(false);
    const [passwordMaskedEmail, setPasswordMaskedEmail] = useState('');
    const [saving, setSaving] = useState(false);

    // Collapsible Accordion State
    const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
        return {
            profile: isDesktop,
            notifications: false,
            security: false,
            location: false,
            subscription: false,
            features: false,
        };
    });

    const toggleSection = (key: string) => {
        setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const areAllOpen = Object.values(openSections).every(Boolean);

    const toggleAll = () => {
        const next = !areAllOpen;
        setOpenSections({
            profile: next,
            notifications: next,
            security: next,
            location: next,
            subscription: next,
            features: next,
        });
    };

    const scrollToSection = (sectionKey: string) => {
        setOpenSections(prev => ({ ...prev, [sectionKey]: true }));
        const el = document.getElementById(`section-${sectionKey}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

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

    // Quick navigation list definition
    const navItems = [
        { 
            key: 'profile', 
            label: isCustomer ? 'Profile Information' : 'Store Profile & Links', 
            icon: <User size={15} />,
            statusDot: form.phone_number ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Complete" />
            ) : (
                <span className="w-2 h-2 rounded-full bg-amber-400" title="Incomplete" />
            )
        },
        { 
            key: 'notifications', 
            label: 'Push Notifications', 
            icon: <Bell size={15} />,
            statusDot: pushPermission === 'granted' ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active" />
            ) : (
                <span className="w-2 h-2 rounded-full bg-neutral-400" title="Not enabled" />
            )
        },
        { 
            key: 'security', 
            label: 'Password & Security', 
            icon: <Lock size={15} />,
            statusDot: passwordRequestPending ? (
                <span className="w-2 h-2 rounded-full bg-blue-500" title="Pending" />
            ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Protected" />
            )
        },
        ...(!isCustomer ? [
            { 
                key: 'location', 
                label: 'Business Location', 
                icon: <MapPin size={15} />,
                statusDot: profile.is_location_verified ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" title="Verified" />
                ) : (
                    <span className="w-2 h-2 rounded-full bg-neutral-400" title="Pending" />
                )
            },
            { 
                key: 'subscription', 
                label: 'Subscription & Tier', 
                icon: <Sparkles size={15} />,
                statusDot: (
                    <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase">
                        {profile.tier || 'Free'}
                    </span>
                )
            },
            { 
                key: 'features', 
                label: 'Store Features', 
                icon: <Sliders size={15} />,
                statusDot: form.show_product_requests ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" title="Enabled" />
                ) : (
                    <span className="w-2 h-2 rounded-full bg-neutral-400" title="Disabled" />
                )
            },
        ] : []),
    ];

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8 pb-20 space-y-6">
            {/* Header Area */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-100 dark:border-neutral-800">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition -ml-1.5 p-1 rounded-lg inline-flex items-center cursor-pointer"
                            title="Back"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                            {isCustomer ? 'Account Settings' : 'Store & Account Settings'}
                        </h1>
                        {!isCustomer && profile.tier && (
                            <span className="hidden sm:inline-flex ml-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                                {profile.tier}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 ml-6">
                        {isCustomer
                            ? 'Manage your personal profile, notifications, and security preferences.'
                            : 'Manage your storefront, contact info, coordinates, plan, and discovery tools.'}
                    </p>
                </div>

                {/* Mobile / Compact Global Expand/Collapse Toggle */}
                <div className="flex items-center gap-2 self-start sm:self-auto ml-6 sm:ml-0">
                    <button
                        type="button"
                        onClick={toggleAll}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-neutral-800 text-xs font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition cursor-pointer shadow-2xs"
                    >
                        <ChevronsUpDown size={14} />
                        <span>{areAllOpen ? 'Collapse All' : 'Expand All'}</span>
                    </button>
                </div>
            </header>

            {/* Main Layout Grid: Desktop 2-Column Sidebar + Content Canvas */}
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 lg:gap-8 items-start">
                
                {/* ═══ DESKTOP STICKY SIDEBAR (lg+ only) ═══ */}
                <div className="hidden lg:block space-y-4 sticky top-20">
                    {/* User Profile Card Snapshot */}
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-5 shadow-xs">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-500/20 to-brand-600/10 text-brand-600 dark:text-brand-400 font-bold text-lg flex items-center justify-center border border-brand-500/20 shrink-0">
                                {(username || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                                    {profile.store_name || username || 'My Account'}
                                </h3>
                                <p className="text-xs text-gray-400 dark:text-neutral-500 font-mono truncate">
                                    @{username}
                                </p>
                            </div>
                        </div>

                        <div className="mt-3.5 pt-3.5 border-t border-gray-100 dark:border-neutral-800 flex flex-wrap gap-1.5">
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300">
                                {isCustomer ? 'Customer' : 'Seller Store'}
                            </span>
                            {!isCustomer && (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800/60 capitalize">
                                    {profile.tier || 'Free'} Tier
                                </span>
                            )}
                            {profile.is_location_verified && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                                    <CheckCircle2 size={10} /> Verified
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Quick Navigation Menu */}
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-2 shadow-xs space-y-0.5">
                        <div className="px-3 py-2 text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">
                            Settings Sections
                        </div>
                        {navItems.map(item => {
                            const isOpen = openSections[item.key];
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => scrollToSection(item.key)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                        isOpen 
                                            ? 'bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white font-bold' 
                                            : 'text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800/50 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className={isOpen ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-neutral-500'}>
                                            {item.icon}
                                        </span>
                                        <span className="truncate">{item.label}</span>
                                    </div>
                                    {item.statusDot}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ═══ COLLAPSIBLE ACCORDION CARDS (Mobile & Desktop Main Canvas) ═══ */}
                <div className="space-y-4">
                    
                    {/* 1. Profile Information Card */}
                    <CollapsibleCard
                        id="section-profile"
                        icon={<User size={18} />}
                        iconBgClass="bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300"
                        title={isCustomer ? 'Profile Information' : 'Store Profile & Details'}
                        subtitle={isCustomer ? 'Personal details and contact info' : 'Store bio, contact info, and website'}
                        badge={
                            form.phone_number ? (
                                <span className="text-[11px] font-medium text-gray-600 dark:text-neutral-300 bg-gray-100 dark:bg-neutral-800 px-2.5 py-0.5 rounded-full font-mono">
                                    {form.phone_number}
                                </span>
                            ) : (
                                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full">
                                    Incomplete
                                </span>
                            )
                        }
                        isOpen={!!openSections.profile}
                        onToggle={() => toggleSection('profile')}
                    >
                        <div className="space-y-4 pt-1">
                            {/* Bio */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                                    {isCustomer ? 'Bio' : 'Store Bio'}
                                </label>
                                <textarea
                                    value={form.bio}
                                    onChange={e => setForm({ ...form, bio: e.target.value })}
                                    rows={3}
                                    placeholder={isCustomer ? "Tell us a bit about yourself..." : "Describe your store, products, and services..."}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 focus:border-gray-400 dark:focus:border-neutral-600 transition resize-none"
                                />
                            </div>

                            {/* Phone & Location */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                                        Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={form.phone_number}
                                        onChange={e => setForm({ ...form, phone_number: e.target.value })}
                                        placeholder="+255..."
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 focus:border-gray-400 dark:focus:border-neutral-600 transition"
                                    />
                                </div>
                                {isCustomer && (
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                                            Location / City
                                        </label>
                                        <input
                                            type="text"
                                            value={form.location}
                                            onChange={e => setForm({ ...form, location: e.target.value })}
                                            placeholder="e.g. Dar es Salaam"
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 focus:border-gray-400 dark:focus:border-neutral-600 transition"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Seller Links */}
                            {!isCustomer && (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                                                Website URL
                                            </label>
                                            <input
                                                type="url"
                                                value={form.website}
                                                onChange={e => setForm({ ...form, website: e.target.value })}
                                                placeholder="https://..."
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 focus:border-gray-400 dark:focus:border-neutral-600 transition"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                                                Instagram Handle
                                            </label>
                                            <input
                                                type="text"
                                                value={form.instagram_username}
                                                onChange={e => setForm({ ...form, instagram_username: e.target.value })}
                                                placeholder="@username"
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 focus:border-gray-400 dark:focus:border-neutral-600 transition"
                                            />
                                        </div>
                                    </div>

                                    {/* Social Media Links Responsive Grid */}
                                    <div className="pt-3 border-t border-gray-100 dark:border-neutral-800 space-y-3">
                                        <div>
                                            <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Social Media Channels</h3>
                                            <p className="text-2xs text-gray-400 dark:text-neutral-500">Provide direct communication links for your buyers</p>
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
                                                    <label className="block text-2xs font-semibold text-gray-600 dark:text-neutral-400">{field.label}</label>
                                                    <input
                                                        type={field.type}
                                                        value={(form as any)[field.key]}
                                                        onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                                                        placeholder={field.placeholder}
                                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 focus:border-gray-400 dark:focus:border-neutral-600 transition"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="flex justify-end pt-3">
                                <Button
                                    onClick={handleProfileSave}
                                    disabled={saving}
                                    loading={saving}
                                    size="sm"
                                    className="rounded-xl px-6 font-semibold text-xs cursor-pointer shadow-xs"
                                >
                                    Save Profile
                                </Button>
                            </div>
                        </div>
                    </CollapsibleCard>

                    {/* 2. Push Notifications Card */}
                    <CollapsibleCard
                        id="section-notifications"
                        icon={<Bell size={18} />}
                        iconBgClass="bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                        title="Push Notifications"
                        subtitle={isCustomer ? 'Order tracking & delivery alerts' : 'Instant order & buyer inquiry alerts'}
                        badge={
                            pushPermission === 'granted' ? (
                                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                    <CheckCircle2 size={11} /> Active
                                </span>
                            ) : pushPermission === 'denied' ? (
                                <span className="text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full">
                                    Blocked
                                </span>
                            ) : (
                                <span className="text-[11px] font-medium text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                                    Not enabled
                                </span>
                            )
                        }
                        isOpen={!!openSections.notifications}
                        onToggle={() => toggleSection('notifications')}
                    >
                        <div className="pt-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-neutral-950/60 rounded-xl border border-gray-100 dark:border-neutral-800/80">
                                <div>
                                    <p className="text-xs font-semibold text-gray-900 dark:text-white">Browser Notifications</p>
                                    <p className="text-2xs text-gray-500 dark:text-neutral-400 mt-0.5">
                                        {pushPermission === 'granted' 
                                            ? 'You will receive instant alerts directly in your browser.' 
                                            : pushPermission === 'denied' 
                                                ? 'Notifications are blocked in your browser settings. Please enable permissions to receive alerts.' 
                                                : 'Enable notifications to get timely order updates even when the app is in the background.'}
                                    </p>
                                </div>
                                {pushPermission !== 'granted' ? (
                                    <Button
                                        onClick={enablePushNotifications}
                                        size="sm"
                                        variant="outline"
                                        disabled={pushPermission === 'denied'}
                                        className="text-xs rounded-xl shrink-0 cursor-pointer"
                                    >
                                        {pushPermission === 'denied' ? 'Notifications Blocked' : 'Enable Notifications'}
                                    </Button>
                                ) : (
                                    <span className="text-2xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0">
                                        <CheckCircle2 size={12} /> Active
                                    </span>
                                )}
                            </div>
                        </div>
                    </CollapsibleCard>

                    {/* 3. Password & Security Card */}
                    <CollapsibleCard
                        id="section-security"
                        icon={<Lock size={18} />}
                        iconBgClass="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                        title="Password & Security"
                        subtitle="Account credentials and protection"
                        badge={
                            passwordRequestPending ? (
                                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                    Pending ⏳
                                </span>
                            ) : (
                                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                    <ShieldCheck size={11} /> Protected
                                </span>
                            )
                        }
                        isOpen={!!openSections.security}
                        onToggle={() => toggleSection('security')}
                    >
                        <div className="pt-2">
                            {passwordRequestPending ? (
                                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-2.5">
                                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-semibold text-xs">
                                        <ShieldCheck size={18} />
                                        <span>Password Change Request Pending Verification</span>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-neutral-300 leading-relaxed">
                                        For enhanced security, an administrator will manually verify your request and email a single-use confirmation link to your registered email {passwordMaskedEmail ? (<span className="font-semibold text-gray-900 dark:text-white">({passwordMaskedEmail})</span>) : 'on file'}.
                                    </p>
                                    <p className="text-[11px] text-gray-500 dark:text-neutral-400">
                                        Your current password remains in effect until you click the link. The one-time link is strictly valid for 24 hours.
                                    </p>
                                    <div className="flex items-center justify-between pt-2 border-t border-blue-500/15">
                                        <button
                                            type="button"
                                            onClick={() => setPasswordRequestPending(false)}
                                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                        >
                                            Submit another request
                                        </button>
                                        <Link
                                            to="/help"
                                            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white"
                                        >
                                            Need help? Contact Support
                                            <ExternalLink size={12} />
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300">Current Password</label>
                                        <input
                                            type="password"
                                            placeholder="Enter current password"
                                            value={passwords.old}
                                            onChange={e => setPasswords({ ...passwords, old: e.target.value })}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 focus:border-gray-400 dark:focus:border-neutral-600 transition"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300">New Password</label>
                                            <input
                                                type="password"
                                                placeholder="Min. 8 characters"
                                                value={passwords.new1}
                                                onChange={e => setPasswords({ ...passwords, new1: e.target.value })}
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 focus:border-gray-400 dark:focus:border-neutral-600 transition"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-semibold text-gray-700 dark:text-neutral-300">Confirm New Password</label>
                                            <input
                                                type="password"
                                                placeholder="Re-type new password"
                                                value={passwords.new2}
                                                onChange={e => setPasswords({ ...passwords, new2: e.target.value })}
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 focus:border-gray-400 dark:focus:border-neutral-600 transition"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-gray-100 dark:border-neutral-800">
                                        <Link
                                            to="/help"
                                            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white"
                                        >
                                            <HelpCircle size={13} />
                                            <span>Suspect unauthorized activity? Contact Support</span>
                                        </Link>
                                        <Button
                                            onClick={handlePasswordChange}
                                            loading={passwordChanging}
                                            size="sm"
                                            className="rounded-xl px-5 font-semibold text-xs self-end sm:self-auto cursor-pointer shadow-xs"
                                        >
                                            Request Password Change
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CollapsibleCard>

                    {/* 4. Business Location Card (Sellers only) */}
                    {!isCustomer && (
                        <CollapsibleCard
                            id="section-location"
                            icon={<MapPin size={18} />}
                            iconBgClass="bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
                            title="Business Location"
                            subtitle="Physical store address & GPS coordinates"
                            badge={
                                profile.is_location_verified ? (
                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                        <CheckCircle2 size={11} /> Verified
                                    </span>
                                ) : (
                                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full">
                                        Pending Review
                                    </span>
                                )
                            }
                            isOpen={!!openSections.location}
                            onToggle={() => toggleSection('location')}
                        >
                            <div className="space-y-4 pt-2">
                                <p className="text-xs text-gray-500 dark:text-neutral-400">
                                    Your store location is pinned via GPS during official staff verification visits to protect buyers from fraud. Updates can only be requested via administration.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-neutral-950/60 rounded-xl border border-gray-100 dark:border-neutral-800/80">
                                    <div>
                                        <span className="text-[11px] text-gray-400 dark:text-neutral-500 uppercase tracking-wider font-semibold block">
                                            Location Address
                                        </span>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white mt-1 block">
                                            {profile.location || 'Not set'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] text-gray-400 dark:text-neutral-500 uppercase tracking-wider font-semibold block">
                                            GPS Coordinates
                                        </span>
                                        <span className="text-sm font-semibold font-mono text-gray-900 dark:text-white mt-1 block">
                                            {profile.latitude && profile.longitude
                                                ? `${Number(profile.latitude).toFixed(6)}, ${Number(profile.longitude).toFixed(6)}`
                                                : 'Registered via GPS'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </CollapsibleCard>
                    )}

                    {/* 5. Subscription & Tier Card (Sellers only) */}
                    {!isCustomer && (
                        <CollapsibleCard
                            id="section-subscription"
                            icon={<Sparkles size={18} />}
                            iconBgClass="bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300"
                            title="Subscription & Plan"
                            subtitle="Current tier membership & listing limits"
                            badge={
                                <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 px-2.5 py-0.5 rounded-full capitalize">
                                    {profile.tier || 'Free'}
                                </span>
                            }
                            isOpen={!!openSections.subscription}
                            onToggle={() => toggleSection('subscription')}
                        >
                            <div className="pt-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-neutral-950/60 rounded-xl border border-gray-100 dark:border-neutral-800/80">
                                    <div>
                                        <p className="text-2xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Active Plan</p>
                                        <h3 className="font-bold text-base capitalize text-gray-900 dark:text-white mt-0.5">{profile.tier || 'Free'}</h3>
                                        <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1 max-w-md">
                                            {profile.tier === 'free' && 'Upgrade to list more products and access priority discovery placement.'}
                                            {profile.tier === 'seller_pro' && 'Active Seller Pro membership with expanded catalogue limits.'}
                                            {profile.tier === 'business' && 'Active Business enterprise membership with verified status and maximum reach.'}
                                        </p>
                                    </div>
                                    {profile.tier !== 'business' && (
                                        <Button 
                                            onClick={handleOpenUpgrade} 
                                            size="sm" 
                                            className="rounded-xl text-xs font-semibold shrink-0 cursor-pointer shadow-xs"
                                        >
                                            Upgrade Plan
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CollapsibleCard>
                    )}

                    {/* 6. Store Features Card (Sellers only) */}
                    {!isCustomer && (
                        <CollapsibleCard
                            id="section-features"
                            icon={<Sliders size={18} />}
                            iconBgClass="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                            title="Store Features"
                            subtitle="Public discovery & interactive buyer request tools"
                            badge={
                                form.show_product_requests ? (
                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full">
                                        Requests On
                                    </span>
                                ) : (
                                    <span className="text-[11px] font-medium text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                                        Off
                                    </span>
                                )
                            }
                            isOpen={!!openSections.features}
                            onToggle={() => toggleSection('features')}
                        >
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-neutral-950/60 rounded-xl border border-gray-100 dark:border-neutral-800/80">
                                    <div className="pr-4">
                                        <p className="text-xs font-semibold text-gray-900 dark:text-white">Coming Soon & Customer Requests</p>
                                        <p className="text-2xs text-gray-500 dark:text-neutral-400 mt-0.5">
                                            Show the "Coming Soon / Requested" tab on your public store profile so buyers can vote on upcoming items and submit custom requests.
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={form.show_product_requests}
                                            onChange={e => setForm(prev => ({ ...prev, show_product_requests: e.target.checked }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-10 h-5.5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-white dark:peer-checked:after:border-neutral-800"></div>
                                    </label>
                                </div>

                                <div className="flex justify-end pt-1">
                                    <Button
                                        onClick={handleProfileSave}
                                        disabled={saving}
                                        loading={saving}
                                        size="sm"
                                        className="rounded-xl px-5 font-semibold text-xs cursor-pointer shadow-xs"
                                    >
                                        Save Feature Settings
                                    </Button>
                                </div>
                            </div>
                        </CollapsibleCard>
                    )}

                    {/* Customer Seller Opportunity Link */}
                    {isCustomer && (
                        <div className="pt-6 pb-2 text-center">
                            {siteVisitStatus?.can_upgrade || profile?.is_location_verified ? (
                                <div className="inline-flex flex-col items-center gap-1.5 p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20 max-w-md mx-auto">
                                    <Link
                                        to="/upgrade"
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors"
                                    >
                                        <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                            Site Verified ✓
                                        </span>
                                        <span>Want to sell on SokoniMax? Proceed to Upgrade &rarr;</span>
                                    </Link>
                                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                        Your physical premises have been verified. Select your tier to complete store setup.
                                    </p>
                                </div>
                            ) : siteVisitStatus?.status === 'pending_review' ? (
                                <div className="inline-flex flex-col items-center gap-1.5 p-4 rounded-2xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/20 max-w-md mx-auto">
                                    <Link
                                        to="/help?tab=site-verification"
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
                                    >
                                        <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                            Visit Under Admin Review ⏳
                                        </span>
                                        <span>Want to sell on SokoniMax? View Verification Status &rarr;</span>
                                    </Link>
                                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                        Staff has submitted your physical store visit. Awaiting admin review.
                                    </p>
                                </div>
                            ) : (
                                <div className="inline-flex flex-col items-center gap-1.5 p-4 rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 max-w-md mx-auto shadow-2xs">
                                    <Link
                                        to="/help?tab=site-verification"
                                        className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-bold transition-colors inline-flex items-center gap-1"
                                    >
                                        <span>Want to sell on SokoniMax? (Site Verification Required)</span>
                                        <span>&rarr;</span>
                                    </Link>
                                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 max-w-sm mx-auto">
                                        To protect buyers and prevent scams, all stores must complete an in-person physical verification visit by our staff before upgrading.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Upgrade Plan Modal */}
            {showUpgradeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-[#121212] rounded-2xl max-w-lg w-full p-5 shadow-2xl relative border border-gray-100 dark:border-neutral-800 animate-scale-in my-8">
                        <button 
                            type="button"
                            onClick={() => { setShowUpgradeModal(false); setSelectedTier(null); }} 
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition p-1 rounded-lg cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                        
                        <div className="border-b border-gray-100 dark:border-neutral-800 pb-3 mb-4">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">Upgrade Subscription Plan</h3>
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
                                                <div 
                                                    key={t.id} 
                                                    onClick={() => setSelectedTier(t)} 
                                                    className="p-3.5 rounded-xl border border-gray-200 dark:border-neutral-800 hover:border-brand-500 dark:hover:border-brand-500 cursor-pointer transition flex justify-between items-center bg-gray-50/50 dark:bg-neutral-950/40"
                                                >
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
                                        <div className="flex items-center justify-between p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl">
                                            <div>
                                                <p className="text-3xs text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider">Selected Plan</p>
                                                <h4 className="font-extrabold text-gray-900 dark:text-white capitalize text-xs">{selectedTier.name} ({selectedTier.duration} Days)</h4>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-3xs text-gray-400 uppercase">Total Price</p>
                                                <p className="font-extrabold text-brand-600 dark:text-brand-400 text-xs">TSh {Number(selectedTier.price).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        <button 
                                            type="button" 
                                            onClick={() => setSelectedTier(null)} 
                                            className="text-2xs text-brand-600 dark:text-brand-400 hover:underline font-bold cursor-pointer"
                                        >
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
                                                        <div key={lipa.id} className="flex items-center gap-3 bg-gray-50 dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800 rounded-xl p-2.5">
                                                            <div className={`rounded-lg bg-white dark:bg-neutral-900 flex items-center justify-center overflow-hidden shrink-0 border border-gray-100 dark:border-neutral-800 ${lipa.network_logo ? 'w-16 h-8' : 'w-8 h-8'}`}>
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
                                                            <button 
                                                                type="button" 
                                                                onClick={() => { navigator.clipboard.writeText(lipa.number); toast.success('Copied!'); }}
                                                                className="ml-auto text-3xs py-0.5 px-2 border border-gray-200 dark:border-neutral-700 rounded hover:bg-white dark:hover:bg-neutral-800 transition cursor-pointer"
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
                                                <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Transaction ID / Reference</label>
                                                <input 
                                                    type="text" 
                                                    required
                                                    value={refId} 
                                                    onChange={(e) => setRefId(e.target.value)}
                                                    placeholder="e.g. PP260618.1746"
                                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-2xs font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Receipt Screenshot</label>
                                                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-200 dark:border-neutral-800 rounded-xl cursor-pointer hover:bg-gray-50/50 dark:hover:bg-neutral-950/50 transition">
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
                                                className="w-full py-2.5 font-bold flex items-center justify-center gap-1.5 rounded-xl cursor-pointer"
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
