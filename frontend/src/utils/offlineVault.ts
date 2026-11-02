/**
 * SokoniMax Offline Digital Vault (Hardened v2)
 * Encrypted IndexedDB vault backed by Web Cryptography API (AES-GCM-256)
 * using a non-extractable CryptoKey stored directly inside IndexedDB.
 */

const DB_NAME = 'SokoniMaxDigitalVault';
const DB_VERSION = 2;
const STORE_ASSETS = 'encrypted_assets';
const STORE_LEASES = 'offline_leases';
const STORE_PLAYBACK = 'playback_state';
const STORE_KEYS = 'vault_keys';
const DEVICE_KEY_ID = 'device_aes_gcm_v2';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBDatabase | IDBOpenDBRequest) instanceof IDBDatabase
        ? (event.target as unknown as IDBDatabase)
        : (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: 'licenseKey' });
      } else if (event.oldVersion > 0 && event.oldVersion < 2) {
        // v1 assets were encrypted with a deprecated localStorage key; clear cleanly on upgrade
        request.transaction?.objectStore(STORE_ASSETS).clear();
      }

      if (!db.objectStoreNames.contains(STORE_LEASES)) {
        db.createObjectStore(STORE_LEASES, { keyPath: 'licenseKey' });
      } else if (event.oldVersion > 0 && event.oldVersion < 2) {
        request.transaction?.objectStore(STORE_LEASES).clear();
      }

      if (!db.objectStoreNames.contains(STORE_PLAYBACK)) {
        db.createObjectStore(STORE_PLAYBACK, { keyPath: 'assetId' });
      }

      if (!db.objectStoreNames.contains(STORE_KEYS)) {
        db.createObjectStore(STORE_KEYS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getDeviceKey(db?: IDBDatabase): Promise<CryptoKey> {
  const database = db || (await openDB());

  const existing: CryptoKey | null = await new Promise((resolve) => {
    try {
      const tx = database.transaction(STORE_KEYS, 'readonly');
      const req = tx.objectStore(STORE_KEYS).get(DEVICE_KEY_ID);
      req.onsuccess = () => resolve(req.result?.key || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  if (existing) {
    return existing;
  }

  // Generate a non-extractable 256-bit AES-GCM CryptoKey
  const generatedKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE_KEYS, 'readwrite');
    tx.objectStore(STORE_KEYS).put({
      id: DEVICE_KEY_ID,
      key: generatedKey,
      createdAt: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return generatedKey;
}

export interface OfflineLease {
  licenseKey: string;
  expiresAt: string;
  leasePayload: any;
  leaseSignature: string;
  savedAt: string;
}

export interface OfflineAssetExtraMeta {
  productId?: number;
  productName?: string;
  productSlug?: string;
  coverImage?: string;
  sellerStoreName?: string;
  pageCount?: number;
  durationSeconds?: number;
  deliveryMode?: string;
}

export interface StoredOfflineAsset {
  licenseKey: string;
  assetId: number;
  title: string;
  fileType: string;
  contentType: string;
  iv: number[];
  encryptedBlob: ArrayBuffer;
  savedAt: string;
  meta?: OfflineAssetExtraMeta;
}

export interface OfflineAssetSummary {
  licenseKey: string;
  assetId: number;
  title: string;
  fileType: string;
  contentType: string;
  expiresAt: string;
  savedAt: string;
  meta?: OfflineAssetExtraMeta;
}

/**
 * Save an asset and its cryptographic lease into the offline vault.
 */
export async function saveAssetForOffline(
  licenseKey: string,
  assetId: number,
  title: string,
  fileType: string,
  contentType: string,
  fileBlob: Blob,
  leaseInfo: any,
  meta?: OfflineAssetExtraMeta
): Promise<void> {
  const db = await openDB();
  const key = await getDeviceKey(db);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileArrayBuffer = await fileBlob.arrayBuffer();

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    fileArrayBuffer
  );

  const nowIso = new Date().toISOString();

  const assetRecord: StoredOfflineAsset = {
    licenseKey,
    assetId,
    title,
    fileType,
    contentType,
    iv: Array.from(iv),
    encryptedBlob: encryptedBuffer,
    savedAt: nowIso,
    meta,
  };

  const leaseRecord: OfflineLease = {
    licenseKey,
    expiresAt: leaseInfo.expires_at,
    leasePayload: leaseInfo.lease_payload,
    leaseSignature: leaseInfo.lease_signature,
    savedAt: nowIso,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ASSETS, STORE_LEASES], 'readwrite');
    tx.objectStore(STORE_ASSETS).put(assetRecord);
    tx.objectStore(STORE_LEASES).put(leaseRecord);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Checks whether an asset is saved offline and its lease has not expired.
 */
export async function isAssetSavedOffline(licenseKey: string): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_ASSETS, STORE_LEASES], 'readonly');
      const assetReq = tx.objectStore(STORE_ASSETS).get(licenseKey);
      const leaseReq = tx.objectStore(STORE_LEASES).get(licenseKey);
      tx.oncomplete = () => {
        if (!assetReq.result || !leaseReq.result) {
          resolve(false);
          return;
        }
        const exp = new Date(leaseReq.result.expiresAt).getTime();
        resolve(Number.isFinite(exp) && Date.now() <= exp);
      };
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Lists metadata for all non-expired assets saved in the offline vault so
 * DigitalLibraryPage can display and open books/audiobooks while offline.
 */
export async function listOfflineAssets(): Promise<OfflineAssetSummary[]> {
  try {
    const db = await openDB();
    const { assets, leases } = await new Promise<{
      assets: StoredOfflineAsset[];
      leases: OfflineLease[];
    }>((resolve) => {
      const tx = db.transaction([STORE_ASSETS, STORE_LEASES], 'readonly');
      const assetsReq = tx.objectStore(STORE_ASSETS).getAll();
      const leasesReq = tx.objectStore(STORE_LEASES).getAll();
      tx.oncomplete = () =>
        resolve({
          assets: (assetsReq.result as StoredOfflineAsset[]) || [],
          leases: (leasesReq.result as OfflineLease[]) || [],
        });
      tx.onerror = () => resolve({ assets: [], leases: [] });
    });

    const leaseMap = new Map<string, OfflineLease>();
    const now = Date.now();
    for (const lease of leases) {
      const exp = new Date(lease.expiresAt).getTime();
      if (Number.isFinite(exp) && now <= exp) {
        leaseMap.set(lease.licenseKey, lease);
      }
    }

    const summaries: OfflineAssetSummary[] = [];
    for (const asset of assets) {
      const validLease = leaseMap.get(asset.licenseKey);
      if (!validLease) continue;
      summaries.push({
        licenseKey: asset.licenseKey,
        assetId: asset.assetId,
        title: asset.title,
        fileType: asset.fileType,
        contentType: asset.contentType,
        expiresAt: validLease.expiresAt,
        savedAt: asset.savedAt,
        meta: asset.meta,
      });
    }
    return summaries;
  } catch {
    return [];
  }
}

/**
 * Retrieves and decrypts the offline file blob if the 30-day lease is still valid.
 */
export async function getDecryptedOfflineAsset(
  licenseKey: string
): Promise<{ blob: Blob; fileType: string; isLeaseValid: boolean } | null> {
  const db = await openDB();

  const lease: OfflineLease | null = await new Promise((resolve) => {
    const tx = db.transaction(STORE_LEASES, 'readonly');
    const req = tx.objectStore(STORE_LEASES).get(licenseKey);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });

  if (!lease) {
    return null;
  }

  const expiryDate = new Date(lease.expiresAt);
  if (Date.now() > expiryDate.getTime()) {
    return null;
  }

  const assetRecord: StoredOfflineAsset | null = await new Promise((resolve) => {
    const tx = db.transaction(STORE_ASSETS, 'readonly');
    const req = tx.objectStore(STORE_ASSETS).get(licenseKey);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });

  if (!assetRecord) {
    return null;
  }

  const key = await getDeviceKey(db);
  const iv = new Uint8Array(assetRecord.iv);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      assetRecord.encryptedBlob
    );

    const decryptedBlob = new Blob([decryptedBuffer], { type: assetRecord.contentType });
    return {
      blob: decryptedBlob,
      fileType: assetRecord.fileType,
      isLeaseValid: true,
    };
  } catch (err) {
    console.error('Failed to decrypt vault asset:', err);
    return null;
  }
}

/**
 * Removes a single asset from the offline vault.
 */
export async function removeOfflineAsset(licenseKey: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ASSETS, STORE_LEASES], 'readwrite');
    tx.objectStore(STORE_ASSETS).delete(licenseKey);
    tx.objectStore(STORE_LEASES).delete(licenseKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Wipes all encrypted assets, leases, playback states, and device keys on logout.
 */
export async function clearOfflineVault(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction([STORE_ASSETS, STORE_LEASES, STORE_PLAYBACK, STORE_KEYS], 'readwrite');
      tx.objectStore(STORE_ASSETS).clear();
      tx.objectStore(STORE_LEASES).clear();
      tx.objectStore(STORE_PLAYBACK).clear();
      tx.objectStore(STORE_KEYS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore IndexedDB unavailability (e.g. private browsing restrictions)
  }
}

/**
 * Saves audiobook playback position (seconds) in IndexedDB.
 */
export async function savePlaybackPosition(assetId: number, seconds: number): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_PLAYBACK, 'readwrite');
      tx.objectStore(STORE_PLAYBACK).put({ assetId, seconds, updated_at: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

/**
 * Retrieves last saved audiobook playback position (seconds).
 */
export async function getPlaybackPosition(assetId: number): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PLAYBACK, 'readonly');
      const req = tx.objectStore(STORE_PLAYBACK).get(assetId);
      req.onsuccess = () => {
        if (req.result && typeof req.result.seconds === 'number') {
          resolve(req.result.seconds);
        } else {
          resolve(0);
        }
      };
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}
