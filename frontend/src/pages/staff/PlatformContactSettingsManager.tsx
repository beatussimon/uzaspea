import React, { useState, useEffect } from 'react';
import {
  Phone, Mail, MessageCircle, Clock, MapPin,
  Save, RotateCcw, CheckCircle2
} from 'lucide-react';
import {
  SiFacebook, SiInstagram, SiX, SiTiktok, SiYoutube
} from 'react-icons/si';
import { FaLinkedin } from 'react-icons/fa';
import api from '../../api';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { PageHeaderSkeleton } from '../../components/Skeleton';

interface ContactFormState {
  support_phone: string;
  whatsapp_number: string;
  support_email: string;
  working_hours: string;
  address: string;
  instagram_handle: string;
  facebook_handle: string;
  twitter_handle: string;
  tiktok_handle: string;
  linkedin_handle: string;
  youtube_handle: string;
}

const extractHandle = (urlOrHandle?: string): string => {
  if (!urlOrHandle) return '';
  const trimmed = urlOrHandle.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes('/')) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
      if (parts[0] === 'company' || parts[0] === 'in') {
        return parts[1] || parts[0];
      }
      const last = parts[parts.length - 1];
      return last.replace(/^@/, '');
    } catch {
      return trimmed.replace(/^https?:\/\/[^/]+\//i, '').replace(/^@/, '');
    }
  }
  return trimmed.replace(/^@/, '');
};

const PlatformContactSettingsManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [originalData, setOriginalData] = useState<ContactFormState>({
    support_phone: '',
    whatsapp_number: '',
    support_email: '',
    working_hours: '',
    address: '',
    instagram_handle: '',
    facebook_handle: '',
    twitter_handle: '',
    tiktok_handle: '',
    linkedin_handle: '',
    youtube_handle: '',
  });

  const [form, setForm] = useState<ContactFormState>({
    support_phone: '',
    whatsapp_number: '',
    support_email: '',
    working_hours: '',
    address: '',
    instagram_handle: '',
    facebook_handle: '',
    twitter_handle: '',
    tiktok_handle: '',
    linkedin_handle: '',
    youtube_handle: '',
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/site-settings/');
      const data = res.data || {};
      const state: ContactFormState = {
        support_phone: data.support_phone || '',
        whatsapp_number: data.whatsapp_number || '',
        support_email: data.support_email || '',
        working_hours: data.working_hours || '',
        address: data.address || '',
        instagram_handle: extractHandle(data.instagram_url),
        facebook_handle: extractHandle(data.facebook_url),
        twitter_handle: extractHandle(data.twitter_url),
        tiktok_handle: extractHandle(data.tiktok_url),
        linkedin_handle: extractHandle(data.linkedin_url),
        youtube_handle: extractHandle(data.youtube_url),
      };
      setForm(state);
      setOriginalData(state);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load contact settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (field: keyof ContactFormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSavedSuccess(false);
  };

  const handleSocialChange = (field: keyof ContactFormState, rawValue: string) => {
    const handle = extractHandle(rawValue);
    setForm(prev => ({ ...prev, [field]: handle }));
    setSavedSuccess(false);
  };

  const handleReset = () => {
    setForm(originalData);
    toast.success('Reverted to last saved settings');
  };

  const hasChanges = JSON.stringify(form) !== JSON.stringify(originalData);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        support_phone: form.support_phone.trim(),
        whatsapp_number: form.whatsapp_number.trim(),
        support_email: form.support_email.trim(),
        working_hours: form.working_hours.trim(),
        address: form.address.trim(),
        instagram_url: form.instagram_handle.trim() ? `https://instagram.com/${form.instagram_handle.trim()}` : '',
        facebook_url: form.facebook_handle.trim() ? `https://facebook.com/${form.facebook_handle.trim()}` : '',
        twitter_url: form.twitter_handle.trim() ? `https://x.com/${form.twitter_handle.trim()}` : '',
        tiktok_url: form.tiktok_handle.trim() ? `https://tiktok.com/@${form.tiktok_handle.trim()}` : '',
        linkedin_url: form.linkedin_handle.trim() ? `https://linkedin.com/company/${form.linkedin_handle.trim()}` : '',
        youtube_url: form.youtube_handle.trim() ? `https://youtube.com/@${form.youtube_handle.trim()}` : '',
      };

      const res = await api.patch('/api/site-settings/', payload);
      const data = res.data || {};
      const updated: ContactFormState = {
        support_phone: data.support_phone || '',
        whatsapp_number: data.whatsapp_number || '',
        support_email: data.support_email || '',
        working_hours: data.working_hours || '',
        address: data.address || '',
        instagram_handle: extractHandle(data.instagram_url),
        facebook_handle: extractHandle(data.facebook_url),
        twitter_handle: extractHandle(data.twitter_url),
        tiktok_handle: extractHandle(data.tiktok_url),
        linkedin_handle: extractHandle(data.linkedin_url),
        youtube_handle: extractHandle(data.youtube_url),
      };
      setForm(updated);
      setOriginalData(updated);
      setSavedSuccess(true);
      toast.success('Contact & Social settings saved');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeaderSkeleton />
        <div className="h-64 bg-surface-muted dark:bg-neutral-900 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-surface-border dark:border-surface-dark-border">
        <div>
          <h1 className="text-base font-bold text-gray-900 dark:text-white">
            Contact & Social Settings
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={saving}
              className="text-xs gap-1"
            >
              <RotateCcw size={12} />
              <span>Discard</span>
            </Button>
          )}

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleSubmit}
            disabled={saving || !hasChanges}
            className="text-xs gap-1"
          >
            {saving ? (
              <span>Saving...</span>
            ) : savedSuccess && !hasChanges ? (
              <>
                <CheckCircle2 size={12} />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Save size={12} />
                <span>Save</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Direct Contacts Section */}
        <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-xl border border-surface-border dark:border-surface-dark-border space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Helpline & Office
          </h2>

          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                Support Phone
              </label>
              <div className="relative">
                <Phone size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={form.support_phone}
                  onChange={(e) => handleChange('support_phone', e.target.value)}
                  placeholder="+255 712 345 678"
                  className="w-full pl-8 pr-3 py-1.5 bg-surface-muted/50 dark:bg-neutral-900/50 border border-surface-border dark:border-surface-dark-border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:border-brand-500 outline-none transition text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                WhatsApp Number
              </label>
              <div className="relative">
                <MessageCircle size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                <input
                  type="text"
                  value={form.whatsapp_number}
                  onChange={(e) => handleChange('whatsapp_number', e.target.value)}
                  placeholder="+255 712 345 678"
                  className="w-full pl-8 pr-3 py-1.5 bg-surface-muted/50 dark:bg-neutral-900/50 border border-surface-border dark:border-surface-dark-border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:border-brand-500 outline-none transition text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                Support Email
              </label>
              <div className="relative">
                <Mail size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={form.support_email}
                  onChange={(e) => handleChange('support_email', e.target.value)}
                  placeholder="support@sokonimax.co.tz"
                  className="w-full pl-8 pr-3 py-1.5 bg-surface-muted/50 dark:bg-neutral-900/50 border border-surface-border dark:border-surface-dark-border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:border-brand-500 outline-none transition text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                Working Hours
              </label>
              <div className="relative">
                <Clock size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={form.working_hours}
                  onChange={(e) => handleChange('working_hours', e.target.value)}
                  placeholder="Mon–Fri 8am–6pm EAT"
                  className="w-full pl-8 pr-3 py-1.5 bg-surface-muted/50 dark:bg-neutral-900/50 border border-surface-border dark:border-surface-dark-border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:border-brand-500 outline-none transition text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                Office Address
              </label>
              <div className="relative">
                <MapPin size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Dar es Salaam, Tanzania"
                  className="w-full pl-8 pr-3 py-1.5 bg-surface-muted/50 dark:bg-neutral-900/50 border border-surface-border dark:border-surface-dark-border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:border-brand-500 outline-none transition text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Social Accounts Section */}
        <div className="bg-white dark:bg-[#0A0A0A] p-4 rounded-xl border border-surface-border dark:border-surface-dark-border space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Social Media Usernames
          </h2>

          <div className="space-y-2.5 text-xs">
            {/* Instagram */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                Instagram
              </label>
              <div className="flex rounded-lg border border-surface-border dark:border-surface-dark-border overflow-hidden bg-surface-muted/50 dark:bg-neutral-900/50 focus-within:border-brand-500 transition">
                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-gray-500 dark:text-gray-400 bg-surface-muted dark:bg-[#141414] border-r border-surface-border dark:border-surface-dark-border shrink-0 select-none">
                  <SiInstagram size={12} className="text-[#E4405F]" />
                  <span>instagram.com/</span>
                </span>
                <input
                  type="text"
                  value={form.instagram_handle}
                  onChange={(e) => handleSocialChange('instagram_handle', e.target.value)}
                  placeholder="username"
                  className="flex-1 px-2.5 py-1.5 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none text-xs"
                />
              </div>
            </div>

            {/* Facebook */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                Facebook
              </label>
              <div className="flex rounded-lg border border-surface-border dark:border-surface-dark-border overflow-hidden bg-surface-muted/50 dark:bg-neutral-900/50 focus-within:border-brand-500 transition">
                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-gray-500 dark:text-gray-400 bg-surface-muted dark:bg-[#141414] border-r border-surface-border dark:border-surface-dark-border shrink-0 select-none">
                  <SiFacebook size={12} className="text-[#1877F2]" />
                  <span>facebook.com/</span>
                </span>
                <input
                  type="text"
                  value={form.facebook_handle}
                  onChange={(e) => handleSocialChange('facebook_handle', e.target.value)}
                  placeholder="username"
                  className="flex-1 px-2.5 py-1.5 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none text-xs"
                />
              </div>
            </div>

            {/* Twitter / X */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                X (Twitter)
              </label>
              <div className="flex rounded-lg border border-surface-border dark:border-surface-dark-border overflow-hidden bg-surface-muted/50 dark:bg-neutral-900/50 focus-within:border-brand-500 transition">
                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-gray-500 dark:text-gray-400 bg-surface-muted dark:bg-[#141414] border-r border-surface-border dark:border-surface-dark-border shrink-0 select-none">
                  <SiX size={11} className="text-gray-800 dark:text-gray-200" />
                  <span>x.com/</span>
                </span>
                <input
                  type="text"
                  value={form.twitter_handle}
                  onChange={(e) => handleSocialChange('twitter_handle', e.target.value)}
                  placeholder="username"
                  className="flex-1 px-2.5 py-1.5 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none text-xs"
                />
              </div>
            </div>

            {/* TikTok */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                TikTok
              </label>
              <div className="flex rounded-lg border border-surface-border dark:border-surface-dark-border overflow-hidden bg-surface-muted/50 dark:bg-neutral-900/50 focus-within:border-brand-500 transition">
                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-gray-500 dark:text-gray-400 bg-surface-muted dark:bg-[#141414] border-r border-surface-border dark:border-surface-dark-border shrink-0 select-none">
                  <SiTiktok size={11} />
                  <span>tiktok.com/@</span>
                </span>
                <input
                  type="text"
                  value={form.tiktok_handle}
                  onChange={(e) => handleSocialChange('tiktok_handle', e.target.value)}
                  placeholder="username"
                  className="flex-1 px-2.5 py-1.5 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none text-xs"
                />
              </div>
            </div>

            {/* LinkedIn */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                LinkedIn
              </label>
              <div className="flex rounded-lg border border-surface-border dark:border-surface-dark-border overflow-hidden bg-surface-muted/50 dark:bg-neutral-900/50 focus-within:border-brand-500 transition">
                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-gray-500 dark:text-gray-400 bg-surface-muted dark:bg-[#141414] border-r border-surface-border dark:border-surface-dark-border shrink-0 select-none">
                  <FaLinkedin size={12} className="text-[#0A66C2]" />
                  <span>linkedin.com/company/</span>
                </span>
                <input
                  type="text"
                  value={form.linkedin_handle}
                  onChange={(e) => handleSocialChange('linkedin_handle', e.target.value)}
                  placeholder="company-name"
                  className="flex-1 px-2.5 py-1.5 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none text-xs"
                />
              </div>
            </div>

            {/* YouTube */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
                YouTube
              </label>
              <div className="flex rounded-lg border border-surface-border dark:border-surface-dark-border overflow-hidden bg-surface-muted/50 dark:bg-neutral-900/50 focus-within:border-brand-500 transition">
                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-gray-500 dark:text-gray-400 bg-surface-muted dark:bg-[#141414] border-r border-surface-border dark:border-surface-dark-border shrink-0 select-none">
                  <SiYoutube size={12} className="text-[#FF0000]" />
                  <span>youtube.com/@</span>
                </span>
                <input
                  type="text"
                  value={form.youtube_handle}
                  onChange={(e) => handleSocialChange('youtube_handle', e.target.value)}
                  placeholder="channel"
                  className="flex-1 px-2.5 py-1.5 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PlatformContactSettingsManager;
