import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { User, Lock, Bell, X, Upload, CheckCircle2, Smartphone, Sliders, ChevronLeft, ShieldCheck, HelpCircle, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useUserRoles } from '../../context/AuthContext';

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const roles = useUserRoles();
    const isCustomer = roles.isPureCustomer;

    const [profile, setProfile] = useState<any>({});
    const [form, setForm] = useState({ bio: '', phone_number: '', location: '', website: '', instagram_username: '', whatsapp_number: '', facebook_url: '', tiktok_username: '', twitter_username: '', youtube_url: '', linkedin_url: '', show_product_requests: true });
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

    return (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 md:py-8 space-y-6 pb-16">
            {/* Header */}
            <header className="space-y-1">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition -ml-1.5 p-1 rounded-lg inline-flex items-center"
                        title="Back"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        {isCustomer ? 'Account Settings' : 'Store & Account Settings'}
                    </h1>
                </div>
                <p className="text-xs text-gray-500 dark:text-neutral-400 ml-6">
                    {isCustomer
                        ? 'Manage your personal profile, security credentials, and preferences.'
                        : 'Manage your seller storefront, contact info, coordinates, and security.'}
                </p>
            </header>

            {/* Profile Info */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-neutral-800">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-700 dark:text-neutral-300">
                        <User size={16} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-sm text-gray-900 dark:text-white">Profile Information</h2>
                        <p className="text-xs text-gray-500 dark:text-neutral-400">
                            {isCustomer ? 'Personal details displayed on your public profile' : 'Store details displayed on your seller storefront'}
                        </p>
                    </div>
                </div>

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
                    {/* Only regular buyers/customers can edit their personal city. Sellers have fixed business locations managed below */}
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

                {/* Seller-only Links */}
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

                        {/* Social Media Links */}
                        <div className="pt-3 border-t border-gray-100 dark:border-neutral-800 space-y-3">
                            <div>
                                <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Social Media Links</h3>
                                <p className="text-2xs text-gray-400 dark:text-neutral-500">Provide direct communication links for customers</p>
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

                <div className="flex justify-end pt-2">
                    <Button
                        onClick={handleProfileSave}
                        disabled={saving}
                        loading={saving}
                        size="sm"
                        className="rounded-xl px-5 font-semibold text-xs"
                    >
                        Save Profile
                    </Button>
                </div>
            </div>

            {/* Push Notifications Card */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-neutral-800">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-700 dark:text-neutral-300">
                        <Bell size={16} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-sm text-gray-900 dark:text-white">Push Notifications</h2>
                        <p className="text-xs text-gray-500 dark:text-neutral-400">
                            {isCustomer ? 'Receive alerts about order updates and delivery progress' : 'Receive instant alerts about incoming orders and customer inquiries'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-neutral-950/60 rounded-xl border border-gray-100 dark:border-neutral-800/80">
                    <div>
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">Browser Notifications</p>
                        <p className="text-2xs text-gray-500 dark:text-neutral-400 mt-0.5 capitalize">
                            {pushPermission === 'granted' ? 'Active and enabled' : pushPermission === 'denied' ? 'Blocked in browser settings' : 'Not enabled yet'}
                        </p>
                    </div>
                    {pushPermission !== 'granted' ? (
                        <Button
                            onClick={enablePushNotifications}
                            size="sm"
                            variant="outline"
                            disabled={pushPermission === 'denied'}
                            className="text-xs rounded-xl"
                        >
                            {pushPermission === 'denied' ? 'Notifications Blocked' : 'Enable Notifications'}
                        </Button>
                    ) : (
                        <span className="text-2xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                            <CheckCircle2 size={12} /> Active
                        </span>
                    )}
                </div>
            </div>

            {/* Change Password */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-neutral-800">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-700 dark:text-neutral-300">
                        <Lock size={16} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-sm text-gray-900 dark:text-white">Password & Security</h2>
                        <p className="text-xs text-gray-500 dark:text-neutral-400">Ensure your account is protected with a verified password</p>
                    </div>
                </div>

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
                                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
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
                    <>
                        <div className="space-y-3">
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
                        </div>

                        <div className="pt-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
                                className="rounded-xl px-5 font-semibold text-xs self-end sm:self-auto"
                            >
                                Request Password Change
                            </Button>
                        </div>
                    </>
                )}
            </div>

            {/* Business Location (Sellers only) */}
            {!isCustomer && (
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="font-semibold text-sm text-gray-900 dark:text-white">Business Location</h2>
                            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">Registered via GPS. Updates can only be made by admin.</p>
                        </div>
                        <span className="text-xs font-medium text-gray-500 dark:text-neutral-400">
                            {profile.is_location_verified ? 'Verified' : 'Pending verification'}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
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
            )}

            {/* Tier Status (Sellers only) */}
            {!isCustomer && (
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-2xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Subscription Tier</p>
                        <h3 className="font-bold text-lg capitalize text-gray-900 dark:text-white mt-0.5">{profile.tier || 'Free'}</h3>
                        <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                            {profile.tier === 'free' && 'Upgrade to list more products and access priority placement'}
                            {profile.tier === 'seller_pro' && 'Active Seller Pro membership'}
                            {profile.tier === 'business' && 'Active Business enterprise membership'}
                        </p>
                    </div>
                    {profile.tier !== 'business' && (
                        <Button onClick={handleOpenUpgrade} size="sm" variant="outline" className="rounded-xl text-xs font-semibold">
                            Upgrade Plan
                        </Button>
                    )}
                </div>
            )}

            {/* Store Profile Features (Sellers only) */}
            {!isCustomer && (
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 p-6 shadow-xs space-y-4">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-neutral-800">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-700 dark:text-neutral-300">
                            <Sliders size={16} />
                        </div>
                        <div>
                            <h2 className="font-semibold text-sm text-gray-900 dark:text-white">Store Features</h2>
                            <p className="text-xs text-gray-500 dark:text-neutral-400">Control public interactive discovery tools shown to buyers</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-neutral-950/60 rounded-xl border border-gray-100 dark:border-neutral-800/80">
                        <div className="pr-4">
                            <p className="text-xs font-semibold text-gray-900 dark:text-white">Coming Soon & Customer Requests</p>
                            <p className="text-2xs text-gray-500 dark:text-neutral-400 mt-0.5">
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
                            <div className="w-10 h-5.5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-black dark:peer-checked:bg-white dark:peer-checked:after:border-neutral-800"></div>
                        </label>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            onClick={handleProfileSave}
                            disabled={saving}
                            loading={saving}
                            size="sm"
                            className="rounded-xl px-5 font-semibold text-xs"
                        >
                            Save Feature Settings
                        </Button>
                    </div>
                </div>
            )}

            {/* Subtle, uncolored seller opportunity text link at the very bottom for customers */}
            {isCustomer && (
                <div className="pt-8 pb-4 text-center">
                    <Link
                        to="/upgrade"
                        className="text-xs text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 underline underline-offset-4 transition-colors"
                    >
                        Want to sell on SokoniMax?
                    </Link>
                </div>
            )}

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
