import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Headphones, Key, Download, HardDriveDownload, 
  Search, ShieldCheck, Check, WifiOff, Loader2 
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { PDFReaderModal } from '../components/PDFReaderModal';
import { AudiobookPlayer, AudiobookTrack } from '../components/AudiobookPlayer';
import { 
  saveAssetForOffline, 
  getDecryptedOfflineAsset, 
  isAssetSavedOffline, 
  removeOfflineAsset 
} from '../utils/offlineVault';
import { toast } from 'react-hot-toast';

interface DigitalLicense {
  id: number;
  license_key: string;
  status: string;
  download_count: number;
  max_downloads: number;
  can_download: boolean;
  last_accessed_at?: string;
  offline_lease_expires_at?: string;
  created_at: string;
  order_id: number;
  product_id: number;
  product_name: string;
  product_slug: string;
  cover_image?: string;
  seller_store_name?: string;
  variant_id?: number;
  variant_name?: string;
  format_type: string;
  asset_title: string;
  file_type: string;
  delivery_mode: string;
  page_count?: number;
  duration_seconds?: number;
  sample_preview_url?: string;
}

export const DigitalLibraryPage: React.FC = () => {
  const { user } = useAuth();

  const [licenses, setLicenses] = useState<DigitalLicense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PDF' | 'AUDIO' | 'KEY'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [offlineStatusMap, setOfflineStatusMap] = useState<Record<string, boolean>>({});
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Active Reader / Player modals
  const [readerData, setReaderData] = useState<{
    title: string;
    pdfUrl?: string;
    pdfBlob?: Blob;
    licenseKey: string;
  } | null>(null);

  const [activeAudioTrack, setActiveAudioTrack] = useState<AudiobookTrack | null>(null);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch licenses
  const fetchLibrary = async () => {
    try {
      setLoading(true);
      const res = await api.get('/digital/library/');
      const data: DigitalLicense[] = res.data?.results || res.data || [];
      setLicenses(data);

      // Check offline vault status for all retrieved licenses
      const statusMap: Record<string, boolean> = {};
      for (const lic of data) {
        statusMap[lic.license_key] = await isAssetSavedOffline(lic.license_key);
      }
      setOfflineStatusMap(statusMap);
    } catch (err: any) {
      console.warn('Could not load library from server:', err);
      // If offline or network error, toast user
      if (!navigator.onLine) {
        toast('Operating in offline mode. Viewing cached vault assets.', { icon: '📡' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, []);

  // Filtered & Searched licenses
  const filteredLicenses = useMemo(() => {
    return licenses.filter((item) => {
      // Type filter
      if (activeFilter === 'PDF' && item.file_type !== 'PDF') return false;
      if (activeFilter === 'AUDIO' && item.file_type !== 'AUDIO') return false;
      if (activeFilter === 'KEY' && item.file_type !== 'KEY') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.product_name.toLowerCase().includes(q);
        const matchesTitle = item.asset_title.toLowerCase().includes(q);
        const matchesAuthor = item.seller_store_name?.toLowerCase().includes(q);
        const matchesKey = item.license_key.toLowerCase().includes(q);
        return matchesName || matchesTitle || matchesAuthor || matchesKey;
      }
      return true;
    });
  }, [licenses, activeFilter, searchQuery]);

  // Handle "Read Online / Offline"
  const handleOpenReader = async (lic: DigitalLicense) => {
    const key = `read-${lic.id}`;
    setActionLoadingKey(key);

    try {
      // 1. Check if saved offline in IndexedDB vault first
      const offlineAsset = await getDecryptedOfflineAsset(lic.license_key);
      if (offlineAsset && offlineAsset.blob) {
        setReaderData({
          title: lic.asset_title || lic.product_name,
          pdfBlob: offlineAsset.blob,
          licenseKey: lic.license_key,
        });
        return;
      }

      // 2. Otherwise request short-lived 15-minute streaming token from server
      const tokenRes = await api.post(`/digital/library/${lic.id}/token/`, {
        token_type: 'READ',
      });

      setReaderData({
        title: lic.asset_title || lic.product_name,
        pdfUrl: tokenRes.data.stream_url,
        licenseKey: lic.license_key,
      });
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Unable to open reader. Check your internet connection.';
      toast.error(msg);
    } finally {
      setActionLoadingKey(null);
    }
  };

  // Handle "Listen Audiobook"
  const handleOpenAudiobook = async (lic: DigitalLicense) => {
    const key = `listen-${lic.id}`;
    setActionLoadingKey(key);

    try {
      // 1. Check if saved offline in IndexedDB vault first
      const offlineAsset = await getDecryptedOfflineAsset(lic.license_key);
      if (offlineAsset && offlineAsset.blob) {
        setActiveAudioTrack({
          assetId: lic.id,
          title: lic.asset_title || lic.product_name,
          authorName: lic.seller_store_name,
          coverImage: lic.cover_image,
          licenseKey: lic.license_key,
          audioBlob: offlineAsset.blob,
          durationSeconds: lic.duration_seconds,
        });
        return;
      }

      // 2. Otherwise request short-lived 15-minute streaming token from server
      const tokenRes = await api.post(`/digital/library/${lic.id}/token/`, {
        token_type: 'STREAM',
      });

      setActiveAudioTrack({
        assetId: lic.id,
        title: lic.asset_title || lic.product_name,
        authorName: lic.seller_store_name,
        coverImage: lic.cover_image,
        licenseKey: lic.license_key,
        audioUrl: tokenRes.data.stream_url,
        durationSeconds: lic.duration_seconds,
      });
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Unable to start audio stream.';
      toast.error(msg);
    } finally {
      setActionLoadingKey(null);
    }
  };

  // Handle "Download"
  const handleDownload = async (lic: DigitalLicense) => {
    const key = `download-${lic.id}`;
    setActionLoadingKey(key);

    try {
      const tokenRes = await api.post(`/digital/library/${lic.id}/token/`, {
        token_type: 'DOWNLOAD',
      });

      const downloadUrl = tokenRes.data.download_url;
      // Trigger browser download
      window.open(downloadUrl, '_blank');

      // Update remaining download count
      setLicenses((prev) =>
        prev.map((item) =>
          item.id === lic.id ? { ...item, download_count: item.download_count + 1 } : item
        )
      );
      toast.success('Download initiated. Your forensic watermarked file is ready.');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Download quota exceeded or session expired.';
      toast.error(msg);
    } finally {
      setActionLoadingKey(null);
    }
  };

  // Handle "Save for Offline"
  const handleToggleOffline = async (lic: DigitalLicense) => {
    const isCurrentlySaved = offlineStatusMap[lic.license_key];
    const key = `offline-${lic.id}`;
    setActionLoadingKey(key);

    if (isCurrentlySaved) {
      try {
        await removeOfflineAsset(lic.license_key);
        setOfflineStatusMap((prev) => ({ ...prev, [lic.license_key]: false }));
        toast.success('Removed from offline storage.');
      } catch {
        toast.error('Failed to remove asset.');
      } finally {
        setActionLoadingKey(null);
      }
      return;
    }

    try {
      toast('Encrypting and saving for offline access...', { icon: '🔒' });

      // 1. Request 30-day offline lease
      const leaseRes = await api.post(`/digital/library/${lic.id}/offline-lease/`, {
        device_fingerprint: navigator.userAgent,
      });

      // 2. Request download token to fetch file bytes
      const tokenRes = await api.post(`/digital/library/${lic.id}/token/`, {
        token_type: 'READ',
      });

      const streamUrl = tokenRes.data.stream_url;
      const fileRes = await fetch(streamUrl);
      if (!fileRes.ok) {
        throw new Error('Failed to download asset bytes for encryption');
      }

      const fileBlob = await fileRes.blob();
      const contentType = lic.file_type === 'PDF' ? 'application/pdf' : 'audio/mpeg';

      // 3. Encrypt and persist into IndexedDB
      await saveAssetForOffline(
        lic.license_key,
        lic.id,
        lic.asset_title || lic.product_name,
        lic.file_type,
        contentType,
        fileBlob,
        leaseRes.data
      );

      setOfflineStatusMap((prev) => ({ ...prev, [lic.license_key]: true }));
      toast.success('Saved to encrypted offline vault! Valid offline for 30 days.');
    } catch (err: any) {
      console.error('Offline save error:', err);
      toast.error('Could not save for offline access.');
    } finally {
      setActionLoadingKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface-muted/40 dark:bg-[#0A0A0A] text-gray-900 dark:text-white pb-32">
      {/* Top Header */}
      <div className="bg-surface dark:bg-[#141414] border-0 pt-6 pb-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Digital Library & Books
              </h1>
              <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-gray-700 dark:text-gray-300">
                {licenses.length} Items
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Your purchased eBooks, watermarked PDFs, audiobooks, and licenses. Available online and offline.
            </p>
          </div>

          {/* Offline Status Badge */}
          <div className="flex items-center gap-2 text-xs">
            {!isOnline ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-200 dark:bg-neutral-800 text-amber-600 dark:text-amber-400">
                <WifiOff size={13} />
                <span>Offline Mode</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800/60 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={13} />
                <span>Vault Connected</span>
              </span>
            )}
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="max-w-6xl mx-auto mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {(['ALL', 'PDF', 'AUDIO', 'KEY'] as const).map((filter) => {
              const labels = {
                ALL: 'All Items',
                PDF: 'Books & PDFs',
                AUDIO: 'Audiobooks',
                KEY: 'Software & Keys',
              };
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer shrink-0 ${
                    activeFilter === filter
                      ? 'bg-black text-white dark:bg-white dark:text-black'
                      : 'bg-surface-muted dark:bg-[#1a1a1e] text-gray-700 dark:text-gray-300 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                  }`}
                >
                  {labels[filter]}
                </button>
              );
            })}
          </div>

          {/* Search bar */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-muted dark:bg-[#1a1a1e] border-0 outline-none rounded-full pl-8 pr-4 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 size={32} className="animate-spin mb-3 text-gray-500" />
            <p className="text-xs">Accessing your secure digital vault...</p>
          </div>
        ) : filteredLicenses.length === 0 ? (
          <div className="text-center py-16 bg-surface dark:bg-[#141414] rounded-xl p-8 border-0 max-w-lg mx-auto">
            <BookOpen size={40} className="mx-auto text-gray-400 mb-3" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">No items found</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {searchQuery
                ? 'No digital items matching your search.'
                : 'You have not purchased any digital books or audiobooks yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredLicenses.map((lic) => {
              const isOfflineSaved = offlineStatusMap[lic.license_key];
              const isPDF = lic.file_type === 'PDF';
              const isAudio = lic.file_type === 'AUDIO';
              const isKey = lic.file_type === 'KEY';

              return (
                <div
                  key={lic.id}
                  /* STRICT USER AESTHETIC: Books category sharp corners (!rounded-none), 2 levels of gray, border-0 */
                  className="bg-surface dark:bg-[#141414] !rounded-none border-0 shadow-sm overflow-hidden flex flex-col justify-between transition hover:shadow-md"
                >
                  <div>
                    {/* Cover Art Container */}
                    <div className="relative aspect-[3/4] w-full bg-neutral-200 dark:bg-[#1a1a1e] overflow-hidden !rounded-none">
                      {lic.cover_image ? (
                        <img
                          src={lic.cover_image}
                          alt={lic.product_name}
                          className="w-full h-full object-cover !rounded-none"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                          {isPDF && <BookOpen size={36} className="text-gray-400 mb-2" />}
                          {isAudio && <Headphones size={36} className="text-gray-400 mb-2" />}
                          {isKey && <Key size={36} className="text-gray-400 mb-2" />}
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                            {lic.asset_title || lic.product_name}
                          </span>
                        </div>
                      )}

                      {/* Format Badge */}
                      <div className="absolute top-2 left-2">
                        <span className="text-3xs font-extrabold uppercase tracking-wide px-2 py-0.5 !rounded-none bg-black text-white dark:bg-white dark:text-black">
                          {isPDF ? 'PDF Book' : isAudio ? 'Audiobook' : lic.file_type}
                        </span>
                      </div>

                      {/* Offline Saved Indicator */}
                      {isOfflineSaved && (
                        <div className="absolute top-2 right-2">
                          <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-xs text-white flex items-center gap-1">
                            <Check size={10} />
                            <span>Offline</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Metadata Section */}
                    <div className="p-4 space-y-2">
                      <h3
                        className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1"
                        title={lic.asset_title || lic.product_name}
                      >
                        {lic.asset_title || lic.product_name}
                      </h3>

                      <p className="text-3xs text-gray-500 dark:text-gray-400 line-clamp-1">
                        By {lic.seller_store_name || 'Verified Author'}
                      </p>

                      {lic.variant_name && (
                        <p className="text-3xs font-medium text-gray-400 dark:text-gray-500">
                          Edition: {lic.variant_name}
                        </p>
                      )}

                      <div className="pt-2 flex items-center justify-between text-3xs font-mono text-gray-400">
                        <span>Lic: {lic.license_key.slice(0, 14)}...</span>
                        {lic.page_count ? (
                          <span>{lic.page_count} pages</span>
                        ) : lic.duration_seconds ? (
                          <span>{Math.round(lic.duration_seconds / 60)} mins</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="p-4 pt-0 space-y-2">
                    <div className="flex items-center gap-2">
                      {isPDF && (
                        <button
                          type="button"
                          onClick={() => handleOpenReader(lic)}
                          disabled={actionLoadingKey === `read-${lic.id}`}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 !rounded-none text-xs font-bold bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                        >
                          {actionLoadingKey === `read-${lic.id}` ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <BookOpen size={13} />
                          )}
                          <span>Read Online</span>
                        </button>
                      )}

                      {isAudio && (
                        <button
                          type="button"
                          onClick={() => handleOpenAudiobook(lic)}
                          disabled={actionLoadingKey === `listen-${lic.id}`}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 !rounded-none text-xs font-bold bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                        >
                          {actionLoadingKey === `listen-${lic.id}` ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Headphones size={13} />
                          )}
                          <span>Listen</span>
                        </button>
                      )}

                      {/* Download Button (if allowed) */}
                      {lic.can_download && (
                        <button
                          type="button"
                          onClick={() => handleDownload(lic)}
                          disabled={actionLoadingKey === `download-${lic.id}`}
                          className="p-2 !rounded-none bg-surface-muted dark:bg-[#1e1e24] text-gray-700 dark:text-gray-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition cursor-pointer"
                          title={`Download master file (${lic.download_count}/${lic.max_downloads} used)`}
                        >
                          {actionLoadingKey === `download-${lic.id}` ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                        </button>
                      )}

                      {/* Offline Vault Cache Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleOffline(lic)}
                        disabled={actionLoadingKey === `offline-${lic.id}`}
                        className={`p-2 !rounded-none transition cursor-pointer ${
                          isOfflineSaved
                            ? 'bg-neutral-200 dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400'
                            : 'bg-surface-muted dark:bg-[#1e1e24] text-gray-700 dark:text-gray-200 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                        }`}
                        title={isOfflineSaved ? 'Remove from offline cache' : 'Save encrypted for offline access'}
                      >
                        {actionLoadingKey === `offline-${lic.id}` ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : isOfflineSaved ? (
                          <Check size={14} />
                        ) : (
                          <HardDriveDownload size={14} />
                        )}
                      </button>
                    </div>

                    {lic.max_downloads > 0 && (
                      <p className="text-center text-3xs text-gray-400">
                        {lic.max_downloads - lic.download_count} of {lic.max_downloads} downloads left
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* In-App Canvas PDF Reader Modal */}
      {readerData && (
        <PDFReaderModal
          title={readerData.title}
          pdfUrl={readerData.pdfUrl}
          pdfBlob={readerData.pdfBlob}
          buyerEmail={(user as any)?.email || user?.username}
          licenseKey={readerData.licenseKey}
          onClose={() => setReaderData(null)}
        />
      )}

      {/* Docked Audiobook Player Bar */}
      {activeAudioTrack && (
        <AudiobookPlayer
          track={activeAudioTrack}
          onClose={() => setActiveAudioTrack(null)}
        />
      )}
    </div>
  );
};
