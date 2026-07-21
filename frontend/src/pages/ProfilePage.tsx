import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Settings, MapPin, Camera, 
  Star, ShoppingBag, Globe, Info,
  CheckCircle, Plus
} from 'lucide-react';
import api, { API_BASE_URL } from '../api';
import toast from 'react-hot-toast';
import ProductCard from '../components/ProductCard';
import VerifiedBadge from '../components/VerifiedBadge';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [followStatus, setFollowStatus] = useState({ following: false, followers_count: 0, following_count: 0 });
  const [activeTab, setActiveTab] = useState<'listings' | 'about'>('listings');
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [selectedLightboxImage, setSelectedLightboxImage] = useState<string | null>(null);
  const [isSubscriptionExpired, setIsSubscriptionExpired] = useState(false);


  // Authenticated context
  const currentUser = localStorage.getItem('username');
  const isOwner = currentUser === username;

  const fetchProfile = () => {
    setLoading(true);
    api.get(`/api/profiles/${username}/`)
      .then(res => {
        setProfile(res.data);
        setEditForm({
          bio: res.data.bio || '',
          location: res.data.location || '',
          phone_number: res.data.phone_number || '',
          website: res.data.website || '',
          instagram_username: res.data.instagram_username || ''
        });
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));

    if (isOwner) {
      api.get('/api/subscriptions/me/')
        .then(res => {
          if (res.data && res.data.status !== 'none' && !res.data.is_active) {
            setIsSubscriptionExpired(true);
          } else {
            setIsSubscriptionExpired(false);
          }
        })
        .catch(() => setIsSubscriptionExpired(false));
    }

    api.get(`/api/products/?seller=${username}`)

      .then(res => setProducts(res.data.results || res.data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchProfile();
    if (username) {
        api.get(`/api/profiles/${username}/follow_status/`)
            .then(r => setFollowStatus(r.data)).catch(() => {});
    }
  }, [username]);

  const handleFollow = async () => {
      const action = followStatus.following ? 'unfollow' : 'follow';
      try {
          const res = await api.post(`/api/profiles/${username}/${action}/`);
          setFollowStatus(prev => ({ 
            ...prev, 
            following: res.data.following, 
            followers_count: res.data.followers_count 
          }));
          toast.success(res.data.following ? `Followed @${username}` : `Unfollowed @${username}`);
      } catch {
          toast.error('Failed to perform action');
      }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/api/profiles/${username}/`, editForm);
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      fetchProfile();
    } catch (err: any) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append(field, file);
    
    toast.loading('Uploading...', { id: 'upload' });
    try {
      await api.patch(`/api/profiles/${username}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Image uploaded!', { id: 'upload' });
      fetchProfile();
    } catch {
      toast.error('Failed to upload image', { id: 'upload' });
    }
  };

  const handleStoreImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('image', file);
    
    toast.loading('Uploading showcase picture...', { id: 'store_upload' });
    try {
      await api.post(`/api/profiles/${username}/upload-store-image/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Picture added to showcase!', { id: 'store_upload' });
      fetchProfile();
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Failed to upload picture';
      toast.error(errMsg, { id: 'store_upload' });
    }
  };

  const handleStoreImageDelete = async (imageId: number) => {
    toast.loading('Deleting picture...', { id: 'store_delete' });
    try {
      await api.post(`/api/profiles/${username}/delete-store-image/`, { image_id: imageId });
      toast.success('Picture removed from showcase!', { id: 'store_delete' });
      fetchProfile();
    } catch {
      toast.error('Failed to remove picture', { id: 'store_delete' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner size="md" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={Info}
          title={t('profile_not_found_title', 'Profile Not Found')}
          description={t('profile_not_found_desc', 'The user @{{username}} does not exist or has been disabled.', { username })}
        />
      </div>
    );
  }

  const ratingAvg = profile.seller_rating?.average ? Number(profile.seller_rating.average) : 0;
  const ratingCount = profile.seller_rating?.count ? Number(profile.seller_rating.count) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-12">
      {/* Expired Subscription Banner */}
      {isOwner && isSubscriptionExpired && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Info className="text-red-500 shrink-0 mt-0.5" size={18} />
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-red-800 dark:text-red-400">Subscription Expired</h4>
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                Your seller privileges have expired. All of your listed products are hidden from the marketplace.
              </p>
            </div>
          </div>
          <Link 
            to="/upgrade" 
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition text-center shrink-0 shadow-lg shadow-red-600/20"
          >
            Renew Now
          </Link>
        </div>
      )}
      
      {/* Header Info Block — Clean Instagram Style */}
      <header className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-16 pb-10 border-b border-gray-150 dark:border-neutral-800">

        
        {/* Left: Avatar Column */}
        <div className="relative w-36 h-36 md:w-40 md:h-40 rounded-full border border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 shrink-0 overflow-hidden flex items-center justify-center shadow-sm">
          {profile.profile_picture ? (
            <img 
              src={profile.profile_picture.startsWith('http') ? profile.profile_picture : `${API_BASE_URL}${profile.profile_picture}`} 
              alt="Avatar" 
              className="w-full h-full object-cover" 
            />
          ) : (
            <span className="text-5xl font-light text-gray-300 dark:text-neutral-700 uppercase select-none">{profile.username?.charAt(0)}</span>
          )}
          {isOwner && (
            <label className="absolute inset-0 bg-black/40 hover:bg-black/60 flex flex-col justify-center items-center cursor-pointer transition opacity-0 hover:opacity-100">
              <Camera size={20} className="text-white mb-1" />
              <span className="text-[10px] text-white font-bold uppercase tracking-wider">Change</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'profile_picture')} />
            </label>
          )}
        </div>

        {/* Right: Username, Stats & Bio */}
        <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left space-y-5">
          
          {/* Row 1: Username & CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <h1 className="text-2xl font-light text-gray-800 dark:text-neutral-100 flex items-center gap-1.5 leading-none">
              {profile.username}
              <VerifiedBadge tier={profile.tier} isVerified={profile.is_verified} className="w-6 h-6" />
            </h1>
            
            <div className="flex items-center gap-2">
              {isOwner ? (
                <button 
                  onClick={() => setIsEditing(true)} 
                  className="px-5 py-1.5 rounded-lg border border-gray-350 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800/50 text-xs font-semibold text-gray-700 dark:text-neutral-300 transition duration-150 active:scale-95"
                >
                  <span className="flex items-center gap-1.5"><Settings size={13} className="text-gray-400 dark:text-gray-500" /> {t('edit_profile')}</span>
                </button>
              ) : currentUser ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button 
                    onClick={handleFollow} 
                    className={`px-6 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 ${
                      followStatus.following 
                        ? 'border border-gray-350 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800/50 text-gray-700 dark:text-neutral-300' 
                        : 'bg-brand-500 hover:bg-brand-600 text-white shadow-sm'
                    }`}
                  >
                    {followStatus.following ? t('following') : t('follow')}
                  </button>
                  {profile?.phone_number && (
                    <a 
                      href={`tel:${profile.phone_number}`}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-brand-200 dark:border-brand-900 text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/10 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition active:scale-95 flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      {t('call')}
                    </a>
                  )}
                  <a 
                    href={`/messages?user=${username}`}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition active:scale-95 flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    {t('message')}
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          {/* Row 2: Statistics */}
          <div className="flex items-center gap-8 text-sm">
            <div>
              <span className="font-bold text-gray-900 dark:text-neutral-100">{products.length}</span>
              <span className="text-gray-500 dark:text-neutral-400 ml-1">{t('listings')}</span>
            </div>
            <div>
              <span className="font-bold text-gray-900 dark:text-neutral-100">{followStatus.followers_count}</span>
              <span className="text-gray-500 dark:text-neutral-400 ml-1">{t('followers')}</span>
            </div>
            <div>
              <span className="font-bold text-gray-900 dark:text-neutral-100">{followStatus.following_count}</span>
              <span className="text-gray-500 dark:text-neutral-400 ml-1">{t('following_count')}</span>
            </div>
          </div>

          {/* Row 3: Bio & Meta Details */}
          <div className="space-y-2 text-sm text-gray-800 dark:text-neutral-200">


            {/* Biography */}
            {profile.bio ? (
              <p className="leading-relaxed whitespace-pre-wrap max-w-lg">{profile.bio}</p>
            ) : (
              <p className="italic text-gray-400 dark:text-neutral-600">No biography details provided.</p>
            )}

            {/* Ratings & Contact Info */}
            <div className="pt-1 flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-neutral-400 font-medium">
              {ratingCount > 0 && (
                <div className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                  <Star size={13} fill="currentColor" />
                  <span>{ratingAvg.toFixed(1)} ({ratingCount} reviews)</span>
                </div>
              )}
              {profile.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin size={13} />
                  <span>{profile.location}</span>
                </div>
              )}
              {profile.website && (
                <a 
                  href={profile.website} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400 hover:underline"
                >
                  <Globe size={13} />
                  <span className="truncate">{profile.website.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
              {profile.instagram_username && (
                <a 
                  href={`https://instagram.com/${profile.instagram_username.replace('@', '')}`}
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-1.5 hover:text-brand-600 transition"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                  <span>@{profile.instagram_username.replace('@', '')}</span>
                </a>
              )}
            </div>
          </div>

        </div>

      </header>

      {/* Navigation Tabs */}
      <div className="space-y-6">
        
        {/* Centered navigation menu items */}
        <div className="flex justify-center gap-12 border-t border-transparent">
          <button
            onClick={() => setActiveTab('listings')}
            className={`flex items-center gap-2 pt-4 pb-1 text-xs font-bold uppercase tracking-wider transition-colors duration-200 border-t -mt-px ${
              activeTab === 'listings' 
                ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white font-black' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <ShoppingBag size={14} />
            <span>{t('listings_tab')}</span>
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-2 pt-4 pb-1 text-xs font-bold uppercase tracking-wider transition-colors duration-200 border-t -mt-px ${
              activeTab === 'about' 
                ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white font-black' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Info size={14} />
            <span>{t('about_shop')}</span>
          </button>
        </div>

        {/* Tab content renders */}
        {activeTab === 'listings' ? (
          <div className="pt-2">
            {products.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title={t('no_active_products')}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5 items-stretch p-4 sm:p-0 bg-gray-50 dark:bg-neutral-900/35 rounded-3xl border border-gray-100 dark:border-neutral-900/50 sm:bg-transparent sm:border-0 sm:rounded-none">
                {products.map((p) => (
                  <div key={p.id} className="flex flex-col">
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-xl mx-auto bg-white dark:bg-neutral-900 rounded-2xl p-6 md:p-8 border border-gray-100 dark:border-neutral-800 shadow-sm space-y-6">
            
            <div className="space-y-3">
              <h3 className="text-xs font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest">Biography</h3>
              <p className="text-sm text-gray-700 dark:text-neutral-300 leading-relaxed">
                {profile.bio || "No biography details provided by this seller."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-gray-100 dark:border-neutral-800">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-wider">{t('account_type')}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <VerifiedBadge tier={profile.tier} isVerified={profile.is_verified} className="w-4 h-4" />
                  <span>{profile.is_verified ? t('verified_shop') : profile.tier === 'customer' || !profile.tier ? t('buyer_account') : t('seller_account')}</span>
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-wider">{t('verification_status')}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  {profile.is_verified ? (
                    <>
                      <CheckCircle size={14} className="text-green-500" />
                      <span>{t('verified_shop')}</span>
                    </>
                  ) : (
                    <span>{t('standard_account')}</span>
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-wider">{t('currency_setup')}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{profile.preferred_currency || 'TZS'}</p>
              </div>
              {profile.phone_number && (
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-wider">{t('phone')}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{profile.phone_number}</p>
                </div>
              )}
            </div>

            {/* Store Showcase (Max 9 images) */}
            {(profile.tier === 'seller_pro' || profile.tier === 'business' || (profile.store_images && profile.store_images.length > 0)) && (
              <div className="pt-6 border-t border-gray-100 dark:border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest">
                    {t('store_showcase')} ({(profile.store_images || []).length}/9)
                  </h3>
                  {isOwner && (profile.store_images || []).length < 9 && (
                    <label className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer flex items-center gap-1">
                      <Plus size={14} /> {t('add_picture')}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleStoreImageUpload} 
                      />
                    </label>
                  )}
                </div>

                {(profile.store_images || []).length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-neutral-600 italic">No showcase pictures uploaded yet.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {(profile.store_images || []).map((img: any) => (
                      <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-50 dark:bg-neutral-850 group border dark:border-neutral-850">
                        <img 
                          src={img.image.startsWith('http') ? img.image : `${API_BASE_URL}${img.image}`} 
                          alt="Store Showcase" 
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                          onClick={() => setSelectedLightboxImage(img.image)}
                        />
                        {isOwner && (
                          <button 
                            type="button"
                            onClick={() => handleStoreImageDelete(img.id)}
                            className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-red-600 text-white rounded-full transition opacity-0 group-hover:opacity-100 shadow-md flex items-center justify-center"
                            title="Delete Picture"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>      {/* Edit Profile Modal Dialog */}
      <Modal
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        title={t('edit_profile')}
        size="md"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-0.5">Bio</label>
            <textarea 
              rows={3} 
              className="w-full px-3 py-2 rounded-btn border border-surface-border dark:border-surface-dark-border bg-white dark:bg-[#111] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition resize-none shadow-sm" 
              value={editForm.bio} 
              onChange={(e) => setEditForm({...editForm, bio: e.target.value})} 
              placeholder={t('bio_placeholder', 'Tell buyers about yourself...')} 
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label={t('location', 'Location')}
              value={editForm.location}
              onChange={(e) => setEditForm({...editForm, location: e.target.value})}
              placeholder="e.g. Dar es Salaam"
            />
            <FormField
              label={t('phone_number', 'Phone Number')}
              type="tel"
              value={editForm.phone_number}
              onChange={(e) => setEditForm({...editForm, phone_number: e.target.value})}
              placeholder="+255..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label={t('website_url', 'Website URL')}
              type="url"
              value={editForm.website}
              onChange={(e) => setEditForm({...editForm, website: e.target.value})}
              placeholder="https://..."
            />
            <FormField
              label={t('instagram_username', 'Instagram Username')}
              value={editForm.instagram_username}
              onChange={(e) => setEditForm({...editForm, instagram_username: e.target.value})}
              placeholder="@username"
            />
          </div>

          <div className="flex gap-4 pt-6 border-t border-surface-border dark:border-surface-dark-border mt-6">
            <Button
              type="submit"
              loading={saving}
              className="flex-1"
            >
              {t('save_changes', 'Save Changes')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(false)}
              className="flex-1"
            >
              {t('cancel', 'Cancel')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Lightbox Modal */}
      {selectedLightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedLightboxImage(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] w-full h-full flex items-center justify-center animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <img 
              src={selectedLightboxImage.startsWith('http') ? selectedLightboxImage : `${API_BASE_URL}${selectedLightboxImage}`} 
              alt="Store Showcase Preview" 
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" 
            />
            <button 
              type="button"
              className="absolute -top-10 right-0 sm:top-4 sm:right-4 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors animate-fade-in"
              onClick={() => setSelectedLightboxImage(null)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProfilePage;
