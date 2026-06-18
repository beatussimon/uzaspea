import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { User, Lock, Bell, X, Upload, CheckCircle2, Smartphone } from 'lucide-react';

const SettingsPage: React.FC = () => {
    const [profile, setProfile] = useState<any>({});
    const [form, setForm] = useState({ bio: '', phone_number: '', location: '', website: '', instagram_username: '' });
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
        <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Account Settings</h2>

            {/* Profile Info */}
            <div className="card p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <User size={18} className="text-brand-600" />
                    <h3 className="font-bold text-gray-900 dark:text-white">Profile Information</h3>
                </div>
                {[
                    { key: 'bio', label: 'Bio', type: 'textarea' },
                    { key: 'phone_number', label: 'Phone Number', type: 'text' },
                    { key: 'location', label: 'Location', type: 'text' },
                    { key: 'website', label: 'Website URL', type: 'url' },
                    { key: 'instagram_username', label: 'Instagram Handle', type: 'text' },
                ].map(field => (
                    <div key={field.key}>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{field.label}</label>
                        {field.type === 'textarea' ? (
                            <textarea value={(form as any)[field.key]} onChange={e => setForm({...form, [field.key]: e.target.value})}
                                className="input resize-none" rows={3} />
                        ) : (
                            <input type={field.type} value={(form as any)[field.key]} onChange={e => setForm({...form, [field.key]: e.target.value})}
                                className="input" />
                        )}
                    </div>
                ))}
                <button onClick={handleProfileSave} disabled={saving} className="btn-primary">
                    {saving ? 'Saving...' : 'Save Profile'}
                </button>
            </div>

            {/* Tier Status */}
            <div className="card p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Bell size={18} className="text-brand-600" /> Subscription Tier
                </h3>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500">Current Plan</p>
                        <p className="font-black text-xl capitalize text-brand-600">{profile.tier || 'Free'}</p>
                        {profile.tier === 'free' && <p className="text-xs text-gray-400 mt-1">Upgrade to list more products and get promoted placement</p>}
                        {profile.tier === 'standard' && <p className="text-xs text-gray-400 mt-1">You have access to standard seller features</p>}
                        {profile.tier === 'premium' && <p className="text-xs text-green-600 mt-1">✓ Full access to all premium features</p>}
                    </div>
                    {profile.tier !== 'premium' && (
                        <button onClick={handleOpenUpgrade} className="btn-primary text-sm">Upgrade Plan</button>
                    )}
                </div>
            </div>

            {/* Change Password */}
            <div className="card p-6 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                    <Lock size={18} className="text-brand-600" />
                    <h3 className="font-bold text-gray-900 dark:text-white">Change Password</h3>
                </div>
                <input type="password" placeholder="Current Password" value={passwords.old}
                    onChange={e => setPasswords({...passwords, old: e.target.value})} className="input" />
                <input type="password" placeholder="New Password (min 8 chars)" value={passwords.new1}
                    onChange={e => setPasswords({...passwords, new1: e.target.value})} className="input" />
                <input type="password" placeholder="Confirm New Password" value={passwords.new2}
                    onChange={e => setPasswords({...passwords, new2: e.target.value})} className="input" />
                <button onClick={handlePasswordChange} className="btn-primary">Update Password</button>
            </div>

            {/* Upgrade Plan Modal */}
            {showUpgradeModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative border dark:border-gray-700 animate-scale-in my-8">
                        <button onClick={() => { setShowUpgradeModal(false); setSelectedTier(null); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
                            <X size={20} />
                        </button>
                        
                        <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">Upgrade Subscription Plan</h3>

                        {loadingUpgradeData ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {!selectedTier ? (
                                    <div className="space-y-3">
                                        <p className="text-xs text-gray-500">Choose one of the premium tiers below to upgrade your store limits:</p>
                                        <div className="grid grid-cols-1 gap-3">
                                            {tiers.map((t: any) => (
                                                <div key={t.id} onClick={() => setSelectedTier(t)} className="p-4 border dark:border-gray-700 rounded-xl hover:border-brand-500 dark:hover:border-brand-500 cursor-pointer transition bg-gray-50 dark:bg-gray-700/30 hover:bg-brand-50/10 flex justify-between items-center">
                                                    <div>
                                                        <h4 className="font-bold text-gray-900 dark:text-white capitalize text-sm">{t.name} Plan</h4>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.benefits || 'Premium store features'}</p>
                                                        <p className="text-[10px] text-gray-400 mt-1">Duration: {t.duration} Days</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="font-black text-brand-600 text-sm">TSh {Number(t.price).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            {tiers.length === 0 && (
                                                <p className="text-sm text-gray-500 text-center py-4">No subscription tiers available.</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleUpgradeSubmit} className="space-y-4">
                                        <div className="flex items-center justify-between p-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/30 rounded-xl">
                                            <div>
                                                <p className="text-xs text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider">Selected Plan</p>
                                                <h4 className="font-black text-gray-900 dark:text-white capitalize text-sm">{selectedTier.name} ({selectedTier.duration} Days)</h4>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-500">Total Price</p>
                                                <p className="font-black text-brand-600 text-sm">TSh {Number(selectedTier.price).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        <button type="button" onClick={() => setSelectedTier(null)} className="text-xs text-brand-600 hover:underline">
                                            ← Choose a different plan
                                        </button>

                                        <div>
                                            <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">
                                                Pay to these numbers:
                                            </p>
                                            {adminLipa.length === 0 ? (
                                                <p className="text-xs text-yellow-600">No official payment numbers configured. Please contact support.</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {adminLipa.map((lipa: any) => (
                                                        <div key={lipa.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5">
                                                            <div className={`rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 ${lipa.network_logo ? 'w-16 h-8' : 'w-8 h-8'}`}>
                                                                {lipa.network_logo ? (
                                                                    <img src={lipa.network_logo} alt={lipa.network_name} className="w-full h-full object-contain" />
                                                                ) : (
                                                                    <Smartphone size={16} className="text-green-600" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">{lipa.network_name}</p>
                                                                <p className="font-mono font-black text-gray-900 dark:text-white text-xs mt-0.5">{lipa.number}</p>
                                                                <p className="text-[10px] text-gray-500 leading-none">{lipa.name}</p>
                                                            </div>
                                                            <button type="button" onClick={() => { navigator.clipboard.writeText(lipa.number); toast.success('Copied!'); }}
                                                                className="ml-auto btn-ghost text-[10px] py-0.5 px-1.5 border border-gray-300 dark:border-gray-600 rounded">Copy</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Transaction ID / Reference</label>
                                                <input 
                                                    type="text" 
                                                    required
                                                    value={refId} 
                                                    onChange={(e) => setRefId(e.target.value)}
                                                    placeholder="e.g. PP260618.1746"
                                                    className="input text-sm h-10"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Receipt Screenshot</label>
                                                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                                                    <div className="flex flex-col items-center justify-center pt-3 pb-4">
                                                        <Upload size={20} className="text-gray-400 mb-1" />
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center px-4">
                                                            {proofFile ? proofFile.name : 'Click to upload screenshot proof'}
                                                        </p>
                                                    </div>
                                                    <input type="file" required className="hidden" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                                                </label>
                                            </div>
                                            <button 
                                                type="submit"
                                                disabled={submittingUpgrade}
                                                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                                            >
                                                {submittingUpgrade ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <CheckCircle2 size={18} />}
                                                Submit Payment Details
                                            </button>
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
