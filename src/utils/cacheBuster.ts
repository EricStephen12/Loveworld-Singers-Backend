// Cache busting utilities for immediate updates

// Generate a unique cache buster based on current time
export const getCacheBuster = (): string => {
  return Date.now().toString();
};

// Generate a version-based cache buster
export const getVersionCacheBuster = (): string => {
  const version = '2.2.0';
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  return `${version}-${timestamp}`;
};

// Force refresh all cached data
export const forceRefreshCache = (): void => {
    const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('cache') || key.includes('supabase') || key.includes('data'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));

    sessionStorage.clear();

  // Force reload the page
  window.location.reload();
};

export const shouldForceRefresh = (): boolean => {
  const lastRefresh = localStorage.getItem('lastForceRefresh');
  const now = Date.now();
  const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
  
  if (!lastRefresh || (now - parseInt(lastRefresh)) > oneHour) {
    localStorage.setItem('lastForceRefresh', now.toString());
    return true;
  }
  return false;
};

// Add cache busting to URLs
export const addCacheBuster = (url: string): string => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${getCacheBuster()}`;
};

// Service Worker cache busting
export const clearServiceWorkerCache = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    } catch (error) {
 console.error('Error clearing service worker cache:', error);
    }
  }
};

// PWA cache busting
export const clearPWACache = async (): Promise<void> => {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    } catch (error) {
 console.error('Error clearing PWA cache:', error);
    }
  }
};

// Complete cache clearing
export const clearAllCaches = async (): Promise<void> => {
  await clearServiceWorkerCache();
  await clearPWACache();
  forceRefreshCache();
};

