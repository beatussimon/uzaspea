import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Settings, MapPin, Camera, 
  Star, ShoppingBag, Globe, Info,
  CheckCircle, Plus
} from 'lucide-react';
import api, { API_BASE_URL } from '../api';
import toast from 'react-hot-toast';
import ProductCard from '../components/ProductCard';
import VerifiedBadge from '../components/VerifiedBadge';

const ProfilePage: React.FC = () => {
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
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container-page py-16 text-center">
        <Info size={40} className="mx-auto text-gray-400 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Profile Not Found</h2>
        <p className="text-sm text-gray-500 mt-2">The user @{username} does not exist or has been disabled.</p>
      </div>
    );
  }

  const ratingAvg = profile.seller_rating?.avg ? Number(profile.seller_rating.avg) : 0;
  const ratingCount = profile.seller_rating?.count ? Number(profile.seller_rating.count) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-12">
      
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
              <VerifiedBadge tier={profile.tier} isVerified={profile.is_verified} className="w-5.5 h-5.5" />
            </h1>
            
            <div className="flex items-center gap-2">
              {isOwner ? (
                <button 
                  onClick={() => setIsEditing(true)} 
                  className="px-5 py-1.5 rounded-lg border border-gray-350 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800/50 text-xs font-semibold text-gray-700 dark:text-neutral-300 transition duration-150 active:scale-95"
                >
                  <span className="flex items-center gap-1.5"><Settings size={13} className="text-gray-400 dark:text-gray-500" /> Edit Profile</span>
                </button>
              ) : currentUser ? (
                <button 
                  onClick={handleFollow} 
                  className={`px-6 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 ${
                    followStatus.following 
                      ? 'border border-gray-350 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800/50 text-gray-700 dark:text-neutral-300' 
                      : 'bg-brand-500 hover:bg-brand-600 text-white shadow-sm'
                  }`}
                >
                  {followStatus.following ? 'Following' : 'Follow'}
                </button>
              ) : null}
            </div>
          </div>

          {/* Row 2: Statistics */}
          <div className="flex items-center gap-8 text-sm">
            <div>
              <span className="font-bold text-gray-900 dark:text-neutral-100">{products.length}</span>
              <span className="text-gray-500 dark:text-neutral-400 ml-1">listings</span>
            </div>
            <div>
              <span className="font-bold text-gray-900 dark:text-neutral-100">{followStatus.followers_count}</span>
              <span className="text-gray-500 dark:text-neutral-400 ml-1">followers</span>
            </div>
            <div>
              <span className="font-bold text-gray-900 dark:text-neutral-100">{followStatus.following_count}</span>
              <span className="text-gray-500 dark:text-neutral-400 ml-1">following</span>
            </div>
          </div>

          {/* Row 3: Bio & Meta Details */}
          <div className="space-y-2 text-sm text-gray-800 dark:text-neutral-200">
            {/* Display name or verified status */}
            <div className="font-semibold text-gray-950 dark:text-white flex items-center gap-2">
              <span>SokoniMax Partner</span>
              <span className="text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 scale-90">
                {profile.tier?.replace('_', ' ')}
              </span>
            </div>

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
            <span>Listings</span>
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
            <span>About Shop</span>
          </button>
        </div>

        {/* Tab content renders */}
        {activeTab === 'listings' ? (
          <div className="pt-2">
            {products.length === 0 ? (
              <div className="p-16 text-center text-gray-400 dark:text-neutral-500 bg-gray-50/50 dark:bg-neutral-900/30 border border-dashed border-gray-200 dark:border-neutral-800 rounded-2xl max-w-md mx-auto">
                <ShoppingBag size={32} className="mx-auto mb-3 opacity-40 text-brand-500" />
                <p className="text-sm font-semibold">No active products found in this storefront.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-xl mx-auto bg-white dark:bg-neutral-900 rounded-2xl p-6 md:p-8 border border-gray-100 dark:border-neutral-800 shadow-sm space-y-6">
            
            <div className="space-y-3">
              <h3 className="text-xs font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest">Biography</h3>
              <p className="text-sm text-gray-700 dark:text-neutral-300 leading-relaxed">
                {profile.bio || "No biography details provided by this partner."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-gray-100 dark:border-neutral-800">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Store Category</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white capitalize">{profile.tier || 'customer'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Verification Status</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  {profile.is_verified ? (
                    <>
                      <CheckCircle size={14} className="text-green-500" />
                      <span>Verified Shop</span>
                    </>
                  ) : (
                    <span>Standard Account</span>
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Currency Setup</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{profile.preferred_currency || 'TZS'}</p>
              </div>
              {profile.phone_number && (
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Phone</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{profile.phone_number}</p>
                </div>
              )}
            </div>

            {/* Store Showcase (Max 9 images) */}
            {(profile.tier === 'seller_pro' || profile.tier === 'business' || (profile.store_images && profile.store_images.length > 0)) && (
              <div className="pt-6 border-t border-gray-100 dark:border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-gray-400 dark:text-neutral-500 uppercase tracking-widest">
                    Store Showcase ({(profile.store_images || []).length}/9)
                  </h3>
                  {isOwner && (profile.store_images || []).length < 9 && (
                    <label className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer flex items-center gap-1">
                      <Plus size={14} /> Add Picture
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

      </div>

      {/* Edit Profile Modal Dialog */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 w-full max-w-lg p-6 sm:p-8 animate-scale-in relative shadow-2xl">
            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-6">Edit Profile details</h2>
            
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Bio</label>
                <textarea 
                  rows={3} 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:focus:ring-brand-500 outline-none resize-none transition" 
                  value={editForm.bio} 
                  onChange={(e) => setEditForm({...editForm, bio: e.target.value})} 
                  placeholder="Tell buyers about yourself..." 
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Location</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition" 
                    value={editForm.location} 
                    onChange={(e) => setEditForm({...editForm, location: e.target.value})} 
                    placeholder="e.g. Dar es Salaam" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Phone Number</label>
                  <input 
                    type="tel" 
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition" 
                    value={editForm.phone_number} 
                    onChange={(e) => setEditForm({...editForm, phone_number: e.target.value})} 
                    placeholder="+255..." 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Website URL</label>
                  <input 
                    type="url" 
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition" 
                    value={editForm.website} 
                    onChange={(e) => setEditForm({...editForm, website: e.target.value})} 
                    placeholder="https://..." 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Instagram Username</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition" 
                    value={editForm.instagram_username} 
                    onChange={(e) => setEditForm({...editForm, instagram_username: e.target.value})} 
                    placeholder="@username" 
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-gray-100 dark:border-gray-800 mt-6">
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-brand-500/20 active:scale-95 disabled:opacity-50 transition"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsEditing(false)} 
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-bold text-gray-600 dark:text-gray-400 transition active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
