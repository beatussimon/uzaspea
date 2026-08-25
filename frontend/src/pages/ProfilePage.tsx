import { motion } from 'framer-motion';
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Settings, MapPin, Camera, 
  Star, ShoppingBag, Info,
  CheckCircle, Plus, Package, Search, Clock
} from 'lucide-react';
import api, { API_BASE_URL } from '../api';
import toast from 'react-hot-toast';
import ProductCard from '../components/ProductCard';
import VerifiedBadge from '../components/VerifiedBadge';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import SocialLinks from '../components/SocialLinks';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import ProductRequestModal from '../components/ProductRequestModal';
import { useSearch } from '../context/SearchContext';
import { useMessages } from '../context/MessageContext';

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { username } = useParams<{ username: string }>();
  const { conversations, openDesktopChat } = useMessages();
  const { openSearchForSeller } = useSearch();
  const [profile, setProfile] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [productRequests, setProductRequests] = useState<any[]>([]);
  const [upvoting, setUpvoting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [followStatus, setFollowStatus] = useState({ following: false, followers_count: 0, following_count: 0 });
  const [activeTab, setActiveTab] = useState<'listings' | 'demands' | 'about'>('listings');
  const [demandFilter, setDemandFilter] = useState<'all' | 'mine' | 'voted' | 'fulfilled'>('all');
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [selectedLightboxImage, setSelectedLightboxImage] = useState<string | null>(null);
  const [isSubscriptionExpired, setIsSubscriptionExpired] = useState(false);

  // Modal states for followers/following
  const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
  const [followModalType, setFollowModalType] = useState<'followers' | 'following'>('followers');
  const [followList, setFollowList] = useState<any[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Authenticated context
  const currentUser = localStorage.getItem('username');
  const isOwner = currentUser === username;

  // Extract unique categories from seller's products for quick-filter pills
  const sellerCategories = useMemo(() => {
    const catMap = new Map<string, { name: string; slug: string; count: number }>();
    products.forEach((p: any) => {
      const slug = p.category_slug || p.category?.slug || '';
      const name = p.category_name || p.category?.name || '';
      if (slug && name) {
        const existing = catMap.get(slug);
        catMap.set(slug, { name, slug, count: (existing?.count || 0) + 1 });
      }
    });
    return Array.from(catMap.values()).sort((a, b) => b.count - a.count);
  }, [products]);

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    if (categoryFilter === 'all') return products;
    return products.filter((p: any) => {
      const slug = p.category_slug || p.category?.slug || '';
      return slug === categoryFilter;
    });
  }, [products, categoryFilter]);

  const handleOpenStoreSearch = () => {
    openSearchForSeller({
      username: username || '',
      displayName: profile?.display_name || profile?.username || username || '',
      avatar: profile?.profile_picture || '',
    });
  };

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
          instagram_username: res.data.instagram_username || '',
          whatsapp_number: res.data.whatsapp_number || '',
          facebook_url: res.data.facebook_url || '',
          tiktok_username: res.data.tiktok_username || '',
          twitter_username: res.data.twitter_username || '',
          youtube_url: res.data.youtube_url || '',
          linkedin_url: res.data.linkedin_url || '',
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
      
    api.get(`/api/product-requests/?seller_username=${username}`)
      .then(res => setProductRequests(res.data.results || res.data))
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
          toast.error("Failed to follow/unfollow");
      }
  };

  const handleVoteToggle = async (reqId: number) => {
    if (!currentUser) {
      toast.error(t('login_to_vote', 'Please log in to vote for product requests.'));
      return;
    }
    try {
      setUpvoting(String(reqId));
      const res = await api.post(`/api/product-requests/${reqId}/vote/`);
      setProductRequests(prev => prev.map(pr => pr.id === reqId ? {
        ...pr,
        has_voted: res.data.has_voted,
        request_count: res.data.request_count,
        votes_count: res.data.votes_count
      } : pr));
      toast.success(res.data.message || (res.data.has_voted ? 'Interest recorded!' : 'Vote removed.'));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || t('error_voting', 'Failed to update vote'));
    } finally {
      setUpvoting(null);
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

  const openFollowModal = async (type: 'followers' | 'following') => {
    setFollowModalType(type);
    setIsFollowModalOpen(true);
    setFollowListLoading(true);
    try {
      const res = await api.get(`/api/profiles/${username}/${type}/`);
      setFollowList(res.data.results || res.data);
    } catch (err) {
      toast.error('Failed to load list');
      setIsFollowModalOpen(false);
    } finally {
      setFollowListLoading(false);
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
        <div className="p-4   border border-red-500 dark:border-red-500/30 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Info className="text-red-500 shrink-0 mt-0.5" size={18} />
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-red-500 dark:text-red-500">Subscription Expired</h4>
              <p className="text-xs text-red-500 dark:text-red-500 font-medium">
                Your seller privileges have expired. All of your listed products are hidden from the marketplace.
              </p>
            </div>
          </div>
          <Link 
            to="/upgrade" 
            className="px-4 py-2 bg-red-500 hover:bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition text-center shrink-0 shadow-lg shadow-red-600/20"
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
                  <button 
                    onClick={handleFollow} 
                    className={`px-6 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 ${
                      followStatus.following 
                        ? 'border border-gray-350 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800/50 text-gray-700 dark:text-neutral-300' 
                        : 'bg-brand-500 hover:bg-brand-500 text-white shadow-sm'
                    }`}
                  >
                    {followStatus.following ? t('following') : t('follow')}
                  </button>
              ) : null}
            </div>
          </div>

          {/* Row 2: Statistics */}
          <div className="flex items-center gap-8 text-sm">
            <div>
              <span className="font-bold text-gray-900 dark:text-neutral-100">{products.length}</span>
              <span className="text-gray-500 dark:text-neutral-400 ml-1">{t('listings')}</span>
            </div>
            <div 
              className="cursor-pointer hover:opacity-80 transition"
              onClick={() => openFollowModal('followers')}
            >
              <span className="font-bold text-gray-900 dark:text-neutral-100">{followStatus.followers_count}</span>
              <span className="text-gray-500 dark:text-neutral-400 ml-1">{t('followers')}</span>
            </div>
            <div 
              className="cursor-pointer hover:opacity-80 transition"
              onClick={() => openFollowModal('following')}
            >
              <span className="font-bold text-gray-900 dark:text-neutral-100">{followStatus.following_count}</span>
              <span className="text-gray-500 dark:text-neutral-400 ml-1">{t('following_count')}</span>
            </div>
          </div>

          {/* Row 1.5: Secondary Action Buttons */}
          {!isOwner && currentUser && (
            <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
                  {followStatus.following && profile?.phone_number && (
                    <a 
                      href={`tel:${profile.phone_number}`}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-brand-500 dark:border-brand-500 text-brand-500 dark:text-brand-500     transition active:scale-95 flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      {t('call')}
                    </a>
                  )}
                  {followStatus.following && (
                  <button 
                    onClick={() => {
                      if (window.innerWidth >= 768) {
                        const existing = conversations.find(c => 
                          c.buyer_username.toLowerCase() === (username || '').toLowerCase() || 
                          c.seller_username.toLowerCase() === (username || '').toLowerCase()
                        );
                        openDesktopChat(existing ? existing.id : null);
                      } else {
                        window.location.href = `/messages?user=${username}`;
                      }
                    }}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    {t('message')}
                  </button>
                  )}
                  <button
                    onClick={() => setIsRequestModalOpen(true)}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-brand-500 dark:border-brand-500 text-brand-500 dark:text-brand-500     transition active:scale-95 flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    {t('request_product', 'Request Product')}
                  </button>
            </div>
          )}

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
              <SocialLinks profile={profile} iconSize={16} />
            </div>
          </div>

        </div>

      </header>

      {/* Navigation Tabs */}
      <div className="space-y-6">
        
        {/* Centered navigation menu items with bottom underline indicator */}
        <div className="flex justify-center gap-8 md:gap-12 border-b border-gray-200/60 dark:border-neutral-800 pb-0">
          <button
            onClick={() => setActiveTab('listings')}
            className={`relative flex items-center gap-2 pb-3 text-sm font-semibold transition-colors ${
              activeTab === 'listings' 
                ? 'text-gray-900 dark:text-white font-bold' 
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <ShoppingBag size={15} />
            <span>{t('listings_tab', 'Listings')}</span>
            {activeTab === 'listings' && (
              <motion.div
                layoutId="profile-nav-indicator"
                className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-gray-900 dark:bg-white"
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('demands')}
            className={`relative flex items-center gap-2 pb-3 text-sm font-semibold transition-colors ${
              activeTab === 'demands' 
                ? 'text-gray-900 dark:text-white font-bold' 
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <Clock size={15} />
            <span>{t('coming_soon_requested', 'Coming Soon / Requested')}</span>
            {activeTab === 'demands' && (
              <motion.div
                layoutId="profile-nav-indicator"
                className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-gray-900 dark:bg-white"
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`relative flex items-center gap-2 pb-3 text-sm font-semibold transition-colors ${
              activeTab === 'about' 
                ? 'text-gray-900 dark:text-white font-bold' 
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <Info size={15} />
            <span>{t('about_shop', 'About')}</span>
            {activeTab === 'about' && (
              <motion.div
                layoutId="profile-nav-indicator"
                className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-gray-900 dark:bg-white"
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
          </button>

          <button
            onClick={handleOpenStoreSearch}
            className="relative flex items-center gap-2 pb-3 text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            title="Search this store"
          >
            <Search size={15} />
            <span>Search</span>
          </button>
        </div>

        {/* Tab content renders */}
        {activeTab === 'demands' ? (
          <div className="pt-2">
            {/* Sub-Filters with bottom underline indicator */}
            {productRequests.length > 0 && (
              <div className="flex items-center justify-between border-b border-gray-200/60 dark:border-neutral-800 pb-0 gap-4 mb-6">
                <div className="flex items-center gap-6 md:gap-8 overflow-x-auto hide-scrollbar">
                  <button
                    onClick={() => setDemandFilter('all')}
                    className={`relative flex items-center gap-1.5 pb-2.5 text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                      demandFilter === 'all'
                        ? 'text-gray-900 dark:text-white font-bold'
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                  >
                    <Clock size={12} />
                    <span>All Upcoming</span>
                    <span className="text-[10px] opacity-60">({productRequests.filter(r => !r.is_fulfilled).length})</span>
                    {demandFilter === 'all' && (
                      <motion.div
                        layoutId="demand-subfilter-indicator"
                        className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-gray-900 dark:bg-white"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                  </button>

                  {currentUser && (
                    <>
                      <button
                        onClick={() => setDemandFilter('mine')}
                        className={`relative flex items-center gap-1.5 pb-2.5 text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                          demandFilter === 'mine'
                            ? 'text-gray-900 dark:text-white font-bold'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                      >
                        <span>My Requests</span>
                        <span className="text-[10px] opacity-60">({productRequests.filter(r => r.user_username === currentUser).length})</span>
                        {demandFilter === 'mine' && (
                          <motion.div
                            layoutId="demand-subfilter-indicator"
                            className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-gray-900 dark:bg-white"
                            transition={{ type: "spring", stiffness: 350, damping: 30 }}
                          />
                        )}
                      </button>

                      <button
                        onClick={() => setDemandFilter('voted')}
                        className={`relative flex items-center gap-1.5 pb-2.5 text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                          demandFilter === 'voted'
                            ? 'text-gray-900 dark:text-white font-bold'
                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                      >
                        <span>Tracked & Voted</span>
                        <span className="text-[10px] opacity-60">({productRequests.filter(r => r.has_voted).length})</span>
                        {demandFilter === 'voted' && (
                          <motion.div
                            layoutId="demand-subfilter-indicator"
                            className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-gray-900 dark:bg-white"
                            transition={{ type: "spring", stiffness: 350, damping: 30 }}
                          />
                        )}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setDemandFilter('fulfilled')}
                    className={`relative flex items-center gap-1.5 pb-2.5 text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                      demandFilter === 'fulfilled'
                        ? 'text-gray-900 dark:text-white font-bold'
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                  >
                    <span>Fulfilled</span>
                    <span className="text-[10px] opacity-60">({productRequests.filter(r => r.is_fulfilled).length})</span>
                    {demandFilter === 'fulfilled' && (
                      <motion.div
                        layoutId="demand-subfilter-indicator"
                        className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-gray-900 dark:bg-white"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                  </button>
                </div>

                {!isOwner && (
                  <button
                    onClick={() => setIsRequestModalOpen(true)}
                    className="shrink-0 pb-2.5 text-xs font-bold text-brand-500 hover:text-brand-600 flex items-center gap-1 transition"
                  >
                    <Plus size={14} /> <span>Request a Product</span>
                  </button>
                )}
              </div>
            )}

            {/* Demands Content */}
            {(() => {
              const filteredDemands = productRequests.filter(req => {
                if (demandFilter === 'mine') return req.user_username === currentUser;
                if (demandFilter === 'voted') return req.has_voted;
                if (demandFilter === 'fulfilled') return req.is_fulfilled;
                return !req.is_fulfilled;
              });

              if (productRequests.length === 0 || filteredDemands.length === 0) {
                return (
                  <EmptyState
                    icon={Clock}
                    title={
                      demandFilter === 'mine' 
                        ? "You haven't requested any items yet"
                        : demandFilter === 'voted'
                        ? "You haven't upvoted any upcoming items yet"
                        : demandFilter === 'fulfilled'
                        ? "No fulfilled requests yet"
                        : t('no_upcoming_requests', 'No upcoming product requests')
                    }
                    description={
                      !isOwner && demandFilter === 'all'
                        ? `Looking for an item not listed in @${username}'s store? Let them know what you need.`
                        : undefined
                    }
                    action={!isOwner && demandFilter === 'all' ? {
                      label: t('request_product', 'Request a Product'),
                      onClick: () => setIsRequestModalOpen(true)
                    } : undefined}
                  />
                );
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5 items-stretch p-4 sm:p-0 bg-gray-50 dark:bg-neutral-900/35 rounded-3xl border border-gray-100 dark:border-neutral-900/50 sm:bg-transparent sm:border-0 sm:rounded-none">
                  {filteredDemands.map(req => {
                    const isFulfilled = req.is_fulfilled;
                    const hasVoted = req.has_voted;
                    const isUpvotingThis = upvoting === String(req.id);

                    return (
                      <div 
                        key={req.id} 
                        className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-2xl shadow-sm flex flex-col justify-between group transition-all duration-300 hover:shadow-md hover:border-brand-500 dark:hover:border-brand-500 overflow-hidden"
                      >
                        {/* Image Thumbnail */}
                        <div className="relative aspect-square sm:aspect-[4/3] bg-gray-100 dark:bg-neutral-800 flex items-center justify-center overflow-hidden">
                          {req.image || req.image_url ? (
                            <img 
                              src={req.image_url || req.image} 
                              alt={req.name} 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                            />
                          ) : (
                            <Package size={44} className="text-gray-300 dark:text-neutral-700" />
                          )}
                          
                          <div className="absolute top-2.5 left-2.5 px-2 py-1 bg-white/90 dark:bg-black/80 backdrop-blur text-[10px] font-bold rounded-lg uppercase tracking-wider text-brand-500 flex items-center gap-1">
                            {isFulfilled ? (
                              <>
                                <CheckCircle size={11} className="text-emerald-500" />
                                <span className="text-emerald-500">In Stock</span>
                              </>
                            ) : (
                              <>
                                <Clock size={11} />
                                <span>Coming Soon</span>
                              </>
                            )}
                          </div>

                          {req.condition && req.condition !== 'New' && (
                            <div className="absolute top-2.5 right-2.5 px-2 py-1 bg-black/70 backdrop-blur text-[10px] font-bold rounded-lg text-white">
                              {req.condition}
                            </div>
                          )}
                        </div>

                        {/* Card Body */}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-1">
                              <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1 group-hover:text-brand-500 transition-colors" title={req.name}>
                                {req.name}
                              </h3>
                            </div>
                            
                            {req.price && (
                              <p className="text-sm font-black text-gray-900 dark:text-white mb-1">
                                Est. TZS {Number(req.price).toLocaleString()}
                              </p>
                            )}

                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 mb-2">
                              {req.description || 'No description provided.'}
                            </p>
                          </div>

                          {/* Card Footer */}
                          <div className="mt-auto flex items-center justify-between border-t border-gray-100 dark:border-neutral-800 pt-3">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Demand</span>
                              <span className="font-black text-gray-800 dark:text-gray-200">
                                {req.request_count || 1} {req.request_count === 1 ? 'vote' : 'votes'}
                              </span>
                            </div>

                            {isFulfilled && req.fulfilled_product_slug ? (
                              <Link to={`/products/${req.fulfilled_product_slug}`}>
                                <Button size="sm" variant="outline" className="h-8 text-[11px] px-3 shadow-sm">
                                  View Item
                                </Button>
                              </Link>
                            ) : (
                              <Button 
                                size="sm" 
                                variant={hasVoted ? 'default' : 'outline'}
                                loading={isUpvotingThis}
                                onClick={() => handleVoteToggle(req.id)}
                                className="h-8 text-[11px] px-3 active:scale-95 shadow-sm"
                              >
                                {hasVoted ? 'Voted' : 'I want this!'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        ) : activeTab === 'listings' ? (
          <div className="pt-2">

            {/* Store Search Bar & Category Quick Filters */}
            {products.length >= 5 && (
              <div className="mb-6 px-4 sm:px-0 space-y-3">
                {/* Inline search trigger */}
                <button
                  onClick={handleOpenStoreSearch}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-100 dark:bg-neutral-800/60 border border-gray-200/50 dark:border-neutral-700/30 text-gray-400 dark:text-neutral-500 hover:border-brand-500/30 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all group cursor-pointer"
                >
                  <Search size={18} className="text-gray-400 dark:text-neutral-500 group-hover:text-brand-500 transition-colors" />
                  <span className="text-sm font-medium">Search @{username}'s products...</span>
                </button>

                {/* Category quick-filter pills */}
                {sellerCategories.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
                    <button
                      onClick={() => setCategoryFilter('all')}
                      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                        categoryFilter === 'all'
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-black shadow-sm'
                          : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      All <span className="opacity-60 ml-1">{products.length}</span>
                    </button>
                    {sellerCategories.map((cat) => (
                      <button
                        key={cat.slug}
                        onClick={() => setCategoryFilter(cat.slug)}
                        className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                          categoryFilter === cat.slug
                            ? 'bg-gray-900 dark:bg-white text-white dark:text-black shadow-sm'
                            : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {cat.name} <span className="opacity-60 ml-1">{cat.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            


            {products.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title={t('no_active_products')}
              />
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search size={40} className="text-gray-300 dark:text-neutral-700 mb-3" />
                <p className="font-bold text-gray-900 dark:text-white">No products in this category</p>
                <button onClick={() => setCategoryFilter('all')} className="mt-2 text-sm text-brand-500 font-semibold hover:underline">Show all products</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5 items-stretch p-4 sm:p-0 bg-gray-50 dark:bg-neutral-900/35 rounded-3xl border border-gray-100 dark:border-neutral-900/50 sm:bg-transparent sm:border-0 sm:rounded-none">
                {filteredProducts.map((p) => (
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
                    <label className="text-xs font-bold text-brand-500 dark:text-brand-500 hover:underline cursor-pointer flex items-center gap-1">
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
                            className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-red-500 text-white rounded-full transition opacity-0 group-hover:opacity-100 shadow-md flex items-center justify-center"
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

          {/* Social Media Links */}
          <div className="pt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{t('social_media_links', 'Social Media Links')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label={t('whatsapp_number', 'WhatsApp Number')}
                type="tel"
                value={editForm.whatsapp_number}
                onChange={(e) => setEditForm({...editForm, whatsapp_number: e.target.value})}
                placeholder="+255712345678"
              />
              <FormField
                label={t('facebook_url', 'Facebook URL')}
                type="url"
                value={editForm.facebook_url}
                onChange={(e) => setEditForm({...editForm, facebook_url: e.target.value})}
                placeholder="https://facebook.com/..."
              />
              <FormField
                label={t('tiktok_username', 'TikTok Username')}
                value={editForm.tiktok_username}
                onChange={(e) => setEditForm({...editForm, tiktok_username: e.target.value})}
                placeholder="@username"
              />
              <FormField
                label={t('twitter_username', 'X (Twitter) Username')}
                value={editForm.twitter_username}
                onChange={(e) => setEditForm({...editForm, twitter_username: e.target.value})}
                placeholder="@username"
              />
              <FormField
                label={t('youtube_url', 'YouTube Channel URL')}
                type="url"
                value={editForm.youtube_url}
                onChange={(e) => setEditForm({...editForm, youtube_url: e.target.value})}
                placeholder="https://youtube.com/..."
              />
              <FormField
                label={t('linkedin_url', 'LinkedIn URL')}
                type="url"
                value={editForm.linkedin_url}
                onChange={(e) => setEditForm({...editForm, linkedin_url: e.target.value})}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
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

      {/* Follow List Modal */}
      <Modal
        isOpen={isFollowModalOpen}
        onClose={() => setIsFollowModalOpen(false)}
        title={followModalType === 'followers' ? t('followers') : t('following_count')}
        size="sm"
      >
        {followListLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : followList.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            No {followModalType === 'followers' ? 'followers' : 'following'} yet.
          </div>
        ) : (
          <div className="space-y-4">
            {followList.map((user) => (
              <div key={user.id} className="flex items-center justify-between">
                <Link to={`/user/${user.username}`} onClick={() => setIsFollowModalOpen(false)} className="flex items-center gap-3 hover:opacity-80 transition">
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden flex items-center justify-center shrink-0">
                    {user.profile_picture ? (
                      <img src={user.profile_picture.startsWith('http') ? user.profile_picture : `${API_BASE_URL}${user.profile_picture}`} alt={user.username} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-light text-gray-400 uppercase">{user.username.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1">
                      {user.username}
                      <VerifiedBadge tier={user.tier} isVerified={user.is_verified} className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  <Link 
                    to={`/messages?user=${user.username}`}
                    className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-neutral-800 transition"
                    title="Message"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  </Link>
                  {currentUser !== user.username && currentUser && (
                    <button
                      onClick={async () => {
                        const action = user.is_following ? 'unfollow' : 'follow';
                        try {
                          const res = await api.post(`/api/profiles/${user.username}/${action}/`);
                          setFollowList(prev => prev.map(u => u.id === user.id ? { ...u, is_following: res.data.following } : u));
                          toast.success(res.data.following ? `Followed @${user.username}` : `Unfollowed @${user.username}`);
                          if (user.username === username) {
                            setFollowStatus(prev => ({ ...prev, following: res.data.following, followers_count: res.data.followers_count }));
                          }
                        } catch (err) {
                          toast.error('Action failed');
                        }
                      }}
                      className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border transition ${
                        user.is_following
                          ? 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                          : 'bg-brand-500 border-brand-500 text-white hover:bg-brand-500 hover:border-brand-500'
                      }`}
                    >
                      {user.is_following ? 'Unfollow' : 'Follow'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {profile && (
        <ProductRequestModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          sellerId={profile.user_id}
          sellerUsername={profile.username}
        />
      )}
    </div>
  );
};

export default ProfilePage;
