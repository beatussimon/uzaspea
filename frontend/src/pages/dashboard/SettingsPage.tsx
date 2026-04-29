import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { User, Lock, Bell } from 'lucide-react';

const SettingsPage: React.FC = () => {
    const [profile, setProfile] = useState<any>({});
    const [form, setForm] = useState({ bio: '', phone_number: '', location: '', website: '', instagram_username: '' });
    const [passwords, setPasswords] = useState({ old: '', new1: '', new2: '' });
    const [saving, setSaving] = useState(false);

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
                        <button className="btn-primary text-sm">Upgrade Plan</button>
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
        </div>
    );
};

export default SettingsPage;
