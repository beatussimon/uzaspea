import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Settings, MapPin, Link as LinkIcon, Camera, Phone, Instagram } from 'lucide-react';
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
          website: res.data.website || ''
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
          setFollowStatus(prev => ({ ...prev, following: res.data.following, followers_count: res.data.followers_count }));
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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!profile) {
    return <div className="container-page py-12 text-center text-gray-500">User not found.</div>;
  }

  return (
    <div className="container-page py-8">
      {/* Profile Header Block */}
      <div className="bg-white dark:bg-gray-800 rounded-card shadow-sm border border-surface-border dark:border-surface-dark-border flex flex-col items-center sm:items-start gap-0 relative overflow-visible pb-6">
        
        {/* Banner */}
        <div className="w-full h-32 sm:h-48 relative rounded-t-card overflow-hidden bg-gradient-to-r from-brand-100 to-blue-200 dark:from-brand-900/40 dark:to-blue-900/40 shrink-0">
          {profile.banner_image && (
            <img src={profile.banner_image.startsWith('http') ? profile.banner_image : `${API_BASE_URL}${profile.banner_image}`} alt="Banner" className="w-full h-full object-cover" />
          )}
          {isOwner && (
            <label className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full cursor-pointer backdrop-blur transition">
              <Camera size={16} />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'banner_image')} />
            </label>
          )}
        </div>

        {/* Profile Info Section */}
        <div className="px-6 sm:px-8 w-full relative sm:flex gap-6 -mt-12 sm:-mt-16">
          {/* Avatar */}
          <div className="relative mx-auto sm:mx-0 w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-700 shadow-md shrink-0 overflow-hidden flex items-center justify-center z-10">
            {profile.profile_picture ? (
              <img src={profile.profile_picture.startsWith('http') ? profile.profile_picture : `${API_BASE_URL}${profile.profile_picture}`} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-bold text-gray-400 dark:text-gray-500 uppercase">{profile.username?.charAt(0)}</span>
            )}
            {isOwner && (
              <label className="absolute inset-x-0 bottom-0 bg-black/50 hover:bg-black/70 h-1/3 flex justify-center items-center cursor-pointer backdrop-blur transition">
                <Camera size={16} className="text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'profile_picture')} />
              </label>
            )}
          </div>

          <div className="text-center sm:text-left flex-1 mt-3 sm:mt-16 sm:pt-4 flex flex-col sm:flex-row sm:justify-between items-center sm:items-start z-10">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center justify-center sm:justify-start gap-2">
                {profile.username}
                <VerifiedBadge tier={profile.tier} isVerified={profile.is_verified} className="w-6 h-6" />
              </h1>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 mt-2 text-sm text-gray-500 dark:text-gray-400">
                {profile.location && <span className="flex items-center gap-1"><MapPin size={14} />{profile.location}</span>}
                {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-brand-600"><LinkIcon size={14} />{profile.website.replace('https://', '')}</a>}
              </div>

              {profile.bio && <p className="mt-4 text-sm text-gray-700 dark:text-gray-300 max-w-2xl">{profile.bio}</p>}

              <div className="flex items-center justify-center sm:justify-start gap-6 mt-6">
                  <div className="text-center">
                      <p className="font-black text-lg text-gray-900 dark:text-white">{followStatus.followers_count}</p>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-0.5">Followers</p>
                  </div>
                  <div className="text-center">
                      <p className="font-black text-lg text-gray-900 dark:text-white">{followStatus.following_count}</p>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-0.5">Following</p>
                  </div>
              </div>
            </div>

            <div className="mt-4 sm:mt-0 flex flex-col gap-2 shrink-0">
              {isOwner ? (
                <button onClick={() => setIsEditing(true)} className="btn-secondary text-sm px-4 py-2 flex items-center justify-center gap-2">
                  <Settings size={16} /> Edit Profile
                </button>
              ) : currentUser ? (
                  <button 
                    onClick={handleFollow} 
                    className={`text-sm px-6 py-2 rounded-lg font-bold transition-all shadow-sm ${followStatus.following ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'}`}
                  >
                      {followStatus.following ? 'Following' : 'Follow'}
                  </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal Base */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 animate-slide-up relative">
            <h2 className="text-xl font-bold mb-4 dark:text-white">Edit Profile</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Bio</label>
                <textarea rows={3} className="input resize-none" value={editForm.bio} onChange={(e) => setEditForm({...editForm, bio: e.target.value})} placeholder="Tell buyers about yourself..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                <input type="text" className="input" value={editForm.location} onChange={(e) => setEditForm({...editForm, location: e.target.value})} placeholder="e.g. Dar es Salaam" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Website URL</label>
                <input type="url" className="input" value={editForm.website} onChange={(e) => setEditForm({...editForm, website: e.target.value})} placeholder="https://..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone Number</label>
                <input type="tel" className="input" value={editForm.phone_number} onChange={(e) => setEditForm({...editForm, phone_number: e.target.value})} placeholder="+255..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Instagram Username</label>
                <input type="text" className="input" value={editForm.instagram_username || ''} onChange={(e) => setEditForm({...editForm, instagram_username: e.target.value})} placeholder="@username" />
              </div>
              <div className="flex gap-3 pt-4 border-t dark:border-surface-dark-border mt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1 py-2">{saving ? 'Saving...' : 'Save Changes'}</button>
                <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary flex-1 py-2">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Seller's Products */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Products by {username}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {products.length === 0 ? (
            <div className="col-span-full card p-12 text-center text-gray-500">
              No products found for this seller.
            </div>
          ) : (
            products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
hone_number: e.target.value})} placeholder="+255..." />
              </div>
              <div className="flex gap-3 pt-4 border-t dark:border-surface-dark-border mt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1 py-2">{saving ? 'Saving...' : 'Save Changes'}</button>
                <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary flex-1 py-2">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Seller's Products */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Products by {username}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {products.length === 0 ? (
            <div className="col-span-full card p-12 text-center text-gray-500">
              No products found for this seller.
            </div>
          ) : (
            products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
