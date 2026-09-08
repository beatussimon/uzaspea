/**
 * Cross-platform map navigation utilities.
 * Handles:
 * - Android: launches native Google Maps app with turn-by-turn navigation / location view.
 * - Apple devices (iOS / iPadOS): supports default Apple Maps and Google Maps app.
 * - Desktop: standard Google Maps in a new tab.
 */

export const isAppleDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isIOS || isIPadOS;
};

export const isAndroidDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
};

export const isMobileDevice = (): boolean => {
  return isAppleDevice() || isAndroidDevice();
};

export const getStoredMapPreference = (): 'apple' | 'google' | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('preferred_map_app') as 'apple' | 'google' | null;
};

export const setStoredMapPreference = (app: 'apple' | 'google') => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('preferred_map_app', app);
};

export const clearStoredMapPreference = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('preferred_map_app');
};

export const getMapLaunchUrls = (lat: number | string, lng: number | string) => {
  const numericLat = Number(lat);
  const numericLng = Number(lng);

  return {
    // Apple Maps Universal Links (natively opens Apple Maps app on iOS/macOS)
    appleNavigate: `https://maps.apple.com/?daddr=${numericLat},${numericLng}&dirflg=d`,
    appleOpen: `https://maps.apple.com/?q=${numericLat},${numericLng}&ll=${numericLat},${numericLng}`,

    // Google Maps Universal URLs
    googleNavigate: `https://www.google.com/maps/dir/?api=1&destination=${numericLat},${numericLng}&travelmode=driving`,
    googleOpen: `https://www.google.com/maps/search/?api=1&query=${numericLat},${numericLng}`,

    // Android Deep Links & Intents
    androidNavigateIntent: `intent://maps.google.com/maps/dir/?api=1&destination=${numericLat},${numericLng}&travelmode=driving#Intent;scheme=https;package=com.google.android.apps.maps;end`,
    androidOpenIntent: `intent://maps.google.com/maps/search/?api=1&query=${numericLat},${numericLng}#Intent;scheme=https;package=com.google.android.apps.maps;end`,
    androidNavUri: `google.navigation:q=${numericLat},${numericLng}&mode=d`,
    androidGeoUri: `geo:${numericLat},${numericLng}?q=${numericLat},${numericLng}`,
  };
};

export const launchNavigation = (
  lat: number | string,
  lng: number | string,
  onNeedAppleChoice?: () => void
) => {
  const urls = getMapLaunchUrls(lat, lng);

  if (isAppleDevice()) {
    const pref = getStoredMapPreference();
    if (pref === 'apple') {
      window.location.href = urls.appleNavigate;
      return;
    }
    if (pref === 'google') {
      window.location.href = urls.googleNavigate;
      return;
    }
    if (onNeedAppleChoice) {
      onNeedAppleChoice();
      return;
    }
    window.location.href = urls.appleNavigate;
    return;
  }

  if (isAndroidDevice()) {
    const isChrome = /Chrome/i.test(navigator.userAgent) && !/Firefox|FxiOS|Edge/i.test(navigator.userAgent);
    if (isChrome) {
      window.location.href = urls.androidNavigateIntent;
    } else {
      window.location.href = urls.androidNavUri;
      setTimeout(() => {
        if (document.hasFocus()) {
          window.open(urls.googleNavigate, '_blank');
        }
      }, 1200);
    }
    return;
  }

  // Desktop default
  window.open(urls.googleNavigate, '_blank');
};

export const launchOpenMap = (
  lat: number | string,
  lng: number | string,
  onNeedAppleChoice?: () => void
) => {
  const urls = getMapLaunchUrls(lat, lng);

  if (isAppleDevice()) {
    const pref = getStoredMapPreference();
    if (pref === 'apple') {
      window.location.href = urls.appleOpen;
      return;
    }
    if (pref === 'google') {
      window.location.href = urls.googleOpen;
      return;
    }
    if (onNeedAppleChoice) {
      onNeedAppleChoice();
      return;
    }
    window.location.href = urls.appleOpen;
    return;
  }

  if (isAndroidDevice()) {
    const isChrome = /Chrome/i.test(navigator.userAgent) && !/Firefox|FxiOS|Edge/i.test(navigator.userAgent);
    if (isChrome) {
      window.location.href = urls.androidOpenIntent;
    } else {
      window.location.href = urls.androidGeoUri;
      setTimeout(() => {
        if (document.hasFocus()) {
          window.open(urls.googleOpen, '_blank');
        }
      }, 1200);
    }
    return;
  }

  // Desktop default
  window.open(urls.googleOpen, '_blank');
};
