/**
 * SokoniMax Offline Digital Vault
 * Encrypted IndexedDB vault backed by Web Cryptography API (AES-GCM-256).
 * Enables buyers to securely read PDFs and listen to audiobooks offline with a 30-day lease heartbeat.
 */

const DB_NAME = 'SokoniMaxDigitalVault';
const DB_VERSION = 1;
const STORE_ASSETS = 'encrypted_assets';
const STORE_LEASES = 'offline_leases';
const STORE_PLAYBACK = 'playback_state';

// Initialize IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: 'licenseKey' });
      }
      if (!db.objectStoreNames.contains(STORE_LEASES)) {
        db.createObjectStore(STORE_LEASES, { keyPath: 'licenseKey' });
      }
      if (!db.objectStoreNames.contains(STORE_PLAYBACK)) {
        db.createObjectStore(STORE_PLAYBACK, { keyPath: 'assetId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Derive or retrieve persistent device AES-GCM key
async function getDeviceKey(): Promise<CryptoKey> {
  const KEY_STORAGE_KEY = 'sokonimax_vault_dev_key';
  let rawKeyHex = localStorage.getItem(KEY_STORAGE_KEY);

  if (!rawKeyHex) {
    const randomKey = crypto.getRandomValues(new Uint8Array(32));
    rawKeyHex = Array.from(randomKey).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(KEY_STORAGE_KEY, rawKeyHex);
  }

  const rawBytes = new Uint8Array(
    rawKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );

  return crypto.subtle.importKey(
    'raw',
    rawBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface OfflineLease {
  licenseKey: string;
  expiresAt: string; // ISO string
  leasePayload: any;
  leaseSignature: string;
  savedAt: string;
}

export interface StoredOfflineAsset {
  licenseKey: string;
  assetId: number;
  title: string;
  fileType: string;
  contentType: string;
  iv: number[]; // initialization vector for AES-GCM
  encryptedBlob: ArrayBuffer;
  savedAt: string;
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
  leaseInfo: any
): Promise<void> {
  const db = await openDB();
  const key = await getDeviceKey();

  // Encrypt file bytes with AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileArrayBuffer = await fileBlob.arrayBuffer();

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    fileArrayBuffer
  );

  const assetRecord: StoredOfflineAsset = {
    licenseKey,
    assetId,
    title,
    fileType,
    contentType,
    iv: Array.from(iv),
    encryptedBlob: encryptedBuffer,
    savedAt: new Date().toISOString()
  };

  const leaseRecord: OfflineLease = {
    licenseKey,
    expiresAt: leaseInfo.expires_at,
    leasePayload: leaseInfo.lease_payload,
    leaseSignature: leaseInfo.lease_signature,
    savedAt: new Date().toISOString()
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
 * Checks whether an asset is already saved offline.
 */
export async function isAssetSavedOffline(licenseKey: string): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_ASSETS, 'readonly');
      const req = tx.objectStore(STORE_ASSETS).get(licenseKey);
      req.onsuccess = () => resolve(Boolean(req.result));
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Retrieves and decrypts the offline file blob if the 30-day lease is still valid.
 */
export async function getDecryptedOfflineAsset(licenseKey: string): Promise<{ blob: Blob; fileType: string; isLeaseValid: boolean } | null> {
  const db = await openDB();

  // Retrieve lease
  const lease: OfflineLease | null = await new Promise((resolve) => {
    const tx = db.transaction(STORE_LEASES, 'readonly');
    const req = tx.objectStore(STORE_LEASES).get(licenseKey);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });

  if (!lease) {
    return null;
  }

  // Check lease expiration
  const expiryDate = new Date(lease.expiresAt);
  if (Date.now() > expiryDate.getTime()) {
    return null; // Lease expired, requires online heartbeat refresh
  }

  // Retrieve encrypted asset
  const assetRecord: StoredOfflineAsset | null = await new Promise((resolve) => {
    const tx = db.transaction(STORE_ASSETS, 'readonly');
    const req = tx.objectStore(STORE_ASSETS).get(licenseKey);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });

  if (!assetRecord) {
    return null;
  }

  // Decrypt using WebCrypto AES-GCM
  const key = await getDeviceKey();
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
      isLeaseValid: true
    };
  } catch (err) {
    console.error('Failed to decrypt vault asset:', err);
    return null;
  }
}

/**
 * Removes an asset from the offline vault.
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
 * Saves audiobook playback position (seconds).
 */
export async function savePlaybackPosition(assetId: number, seconds: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PLAYBACK, 'readwrite');
    tx.objectStore(STORE_PLAYBACK).put({ assetId, seconds, updated_at: Date.now() });
  } catch {
    localStorage.setItem(`playback_pos_${assetId}`, String(seconds));
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
          const fallback = localStorage.getItem(`playback_pos_${assetId}`);
          resolve(fallback ? parseFloat(fallback) : 0);
        }
      };
      req.onerror = () => resolve(0);
    });
  } catch {
    const fallback = localStorage.getItem(`playback_pos_${assetId}`);
    return fallback ? parseFloat(fallback) : 0;
  }
}
