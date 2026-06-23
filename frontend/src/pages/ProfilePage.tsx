import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Settings, MapPin, Camera, 
  Star, ShoppingBag, Globe, Phone, Info,
  CheckCircle
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
    <div className="container-page py-6 max-w-7xl mx-auto space-y-6">
      
      {/* Outer wrapper card */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700/80 overflow-hidden">
        
        {/* Banner with visual mesh glow effect */}
        <div className="w-full h-40 sm:h-56 relative overflow-hidden bg-slate-900 shrink-0">
          {profile.banner_image ? (
            <img 
              src={profile.banner_image.startsWith('http') ? profile.banner_image : `${API_BASE_URL}${profile.banner_image}`} 
              alt="Profile banner" 
              className="w-full h-full object-cover" 
            />
          ) : (
            <div className="absolute inset-0 overflow-hidden bg-gradient-to-tr from-brand-900/30 via-slate-900 to-amber-900/10">
              <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-brand-500/10 blur-3xl animate-pulse duration-[6000ms]" />
              <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-amber-600/10 blur-3xl animate-pulse duration-[8000ms]" />
            </div>
          )}
          {isOwner && (
            <label className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full cursor-pointer backdrop-blur transition shadow-lg active:scale-95 z-20">
              <Camera size={16} />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'banner_image')} />
            </label>
          )}
        </div>

        {/* Profile Split Grid */}
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT COLUMN: Profile info sidebar */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Profile card details */}
              <div className="flex flex-col items-center text-center -mt-20 md:-mt-24 relative z-10 space-y-4">
                
                {/* Floating Avatar */}
                <div className="relative w-32 h-32 rounded-full border-4 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-700 shadow-xl overflow-hidden flex items-center justify-center shrink-0">
                  {profile.profile_picture ? (
                    <img 
                      src={profile.profile_picture.startsWith('http') ? profile.profile_picture : `${API_BASE_URL}${profile.profile_picture}`} 
                      alt="Avatar" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <span className="text-5xl font-black text-gray-400 dark:text-gray-500 uppercase">{profile.username?.charAt(0)}</span>
                  )}
                  {isOwner && (
                    <label className="absolute inset-x-0 bottom-0 bg-black/60 hover:bg-black/80 h-1/3 flex justify-center items-center cursor-pointer backdrop-blur transition-colors">
                      <Camera size={14} className="text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'profile_picture')} />
                    </label>
                  )}
                </div>

                {/* Name & verification badges */}
                <div className="space-y-1">
                  <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center justify-center gap-1.5 leading-tight">
                    {profile.username}
                    <VerifiedBadge tier={profile.tier} isVerified={profile.is_verified} className="w-5.5 h-5.5" />
                  </h1>
                  <span className="inline-block text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400">
                    {profile.tier?.replace('_', ' ')}
                  </span>
                </div>

                {/* Rating display */}
                {ratingCount > 0 && (
                  <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 px-3 py-1 rounded-full text-xs font-bold text-amber-600 dark:text-amber-400">
                    <Star size={14} fill="currentColor" className="text-amber-500" />
                    <span>{ratingAvg.toFixed(1)}</span>
                    <span className="text-gray-400 dark:text-gray-500 font-medium">({ratingCount} {ratingCount === 1 ? 'review' : 'reviews'})</span>
                  </div>
                )}

                {/* Follow stats cards */}
                <div className="grid grid-cols-2 gap-4 w-full pt-2">
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-3 border border-gray-50 dark:border-gray-800">
                    <p className="text-lg font-black text-gray-900 dark:text-white">{followStatus.followers_count}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Followers</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-3 border border-gray-50 dark:border-gray-800">
                    <p className="text-lg font-black text-gray-900 dark:text-white">{followStatus.following_count}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Following</p>
                  </div>
                </div>

                {/* CTA Action buttons */}
                <div className="w-full pt-2">
                  {isOwner ? (
                    <button 
                      onClick={() => setIsEditing(true)} 
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-bold text-gray-700 dark:text-gray-300 transition duration-200 active:scale-98"
                    >
                      <Settings size={16} /> Edit Profile
                    </button>
                  ) : currentUser ? (
                    <button 
                      onClick={handleFollow} 
                      className={`w-full py-2.5 rounded-xl text-sm font-bold transition shadow-sm active:scale-98 ${
                        followStatus.following 
                          ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300' 
                          : 'bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-600/20'
                      }`}
                    >
                      {followStatus.following ? 'Following' : 'Follow'}
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Sidebar Quick details card */}
              <div className="bg-gray-50 dark:bg-gray-700/10 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 space-y-4">
                <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">Contact & Info</h3>
                
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                  {profile.location && (
                    <div className="flex items-center gap-3">
                      <MapPin size={16} className="text-gray-400 shrink-0" />
                      <span className="truncate">{profile.location}</span>
                    </div>
                  )}
                  {profile.website && (
                    <div className="flex items-center gap-3">
                      <Globe size={16} className="text-gray-400 shrink-0" />
                      <a 
                        href={profile.website} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-brand-600 dark:text-brand-400 hover:underline truncate"
                      >
                        {profile.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {profile.instagram_username && (
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                      </svg>
                      <a 
                        href={`https://instagram.com/${profile.instagram_username.replace('@', '')}`}
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-gray-700 dark:text-gray-300 hover:text-brand-600 transition truncate"
                      >
                        @{profile.instagram_username.replace('@', '')}
                      </a>
                    </div>
                  )}
                  {profile.phone_number && (
                    <div className="flex items-center gap-3">
                      <Phone size={16} className="text-gray-400 shrink-0" />
                      <span className="truncate">{profile.phone_number}</span>
                    </div>
                  )}
                  {!profile.location && !profile.website && !profile.instagram_username && !profile.phone_number && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">No public contact info provided.</p>
                  )}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Interactive Tabbed Detail Area */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Tab Navigation header */}
              <div className="flex border-b border-gray-100 dark:border-gray-700/80 gap-6">
                <button
                  onClick={() => setActiveTab('listings')}
                  className={`pb-3 text-sm font-bold transition relative ${
                    activeTab === 'listings' 
                      ? 'text-brand-600 dark:text-brand-400' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Active Listings ({products.length})
                  {activeTab === 'listings' && (
                    <div className="absolute bottom-0 inset-x-0 h-0.5 bg-brand-600 dark:bg-brand-400 rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('about')}
                  className={`pb-3 text-sm font-bold transition relative ${
                    activeTab === 'about' 
                      ? 'text-brand-600 dark:text-brand-400' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  About Seller
                  {activeTab === 'about' && (
                    <div className="absolute bottom-0 inset-x-0 h-0.5 bg-brand-600 dark:bg-brand-400 rounded-full" />
                  )}
                </button>
              </div>

              {/* Tab Contents */}
              {activeTab === 'listings' ? (
                /* Listings tab */
                <div className="space-y-4">
                  {products.length === 0 ? (
                    <div className="card p-12 text-center text-gray-400 dark:text-gray-500 bg-gray-50/50 dark:bg-gray-800/20 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                      <ShoppingBag size={32} className="mx-auto mb-3 opacity-40" />
                      <p className="text-sm font-medium">No products found for this seller.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {products.map((p) => (
                        <ProductCard key={p.id} product={p} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* About tab */
                <div className="bg-gray-50/50 dark:bg-gray-800/10 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 space-y-6">
                  
                  {/* Bio block */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">Bio</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {profile.bio || "No description provided."}
                    </p>
                  </div>

                  {/* Metadata fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">Membership Category</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white capitalize">{profile.tier || 'customer'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">Account Status</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        {profile.is_verified ? (
                          <>
                            <CheckCircle size={14} className="text-green-500" />
                            <span>Verified Partner</span>
                          </>
                        ) : (
                          <span>Standard User</span>
                        )}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">Preferred Currency</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{profile.preferred_currency || 'TZS'}</p>
                    </div>
                  </div>
                  
                </div>
              )}

            </div>

          </div>
        </div>

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

    </div>
  );
};

export default ProfilePage;
