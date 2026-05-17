// Feature rollout management

interface FeatureUpdate {
  featureId: string;
  version: string;
  rolloutPercentage: number;
  enabled: boolean;
  cacheKeys: string[];
  description: string;
}

interface AppVersion {
  version: string;
  buildTime: string;
  features: string[];
  forceUpdate: boolean;
}

class FeatureUpdateManager {
  private static instance: FeatureUpdateManager;
  private readonly FEATURE_KEY = 'app-features';
  private readonly VERSION_KEY = 'app-version-info';
  private readonly LAST_CHECK_KEY = 'last-feature-check';

  // App version
  private readonly CURRENT_VERSION: AppVersion = {
    version: '3.1.0', // Increment this when adding new features
    buildTime: new Date().toISOString(),
    features: [
      'video-calls',
      'enhanced-chat',
      'improved-navigation',
      'viewport-fixes'
    ],
    forceUpdate: false
  };

  // Feature configuration
  private readonly FEATURES: FeatureUpdate[] = [
    {
      featureId: 'video-calls',
      version: '3.1.0',
      rolloutPercentage: 100,
      enabled: true,
      cacheKeys: ['chat-cache', 'media-cache', 'user-cache'],
      description: 'Video call functionality in chat'
    },
    {
      featureId: 'enhanced-chat',
      version: '3.1.0',
      rolloutPercentage: 100,
      enabled: true,
      cacheKeys: ['chat-cache', 'messages-cache'],
      description: 'Enhanced chat interface with better UX'
    },
    {
      featureId: 'improved-navigation',
      version: '3.1.0',
      rolloutPercentage: 100,
      enabled: true,
      cacheKeys: ['navigation-cache', 'user-cache'],
      description: 'Improved back navigation and routing'
    },
    {
      featureId: 'viewport-fixes',
      version: '3.1.0',
      rolloutPercentage: 100,
      enabled: true,
      cacheKeys: ['layout-cache', 'ui-cache'],
      description: 'Fixed viewport height issues on app resume'
    }
  ];

  public static getInstance(): FeatureUpdateManager {
    if (!FeatureUpdateManager.instance) {
      FeatureUpdateManager.instance = new FeatureUpdateManager();
    }
    return FeatureUpdateManager.instance;
  }

  // Check for updates
  public async checkForFeatureUpdates(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      const storedVersion = localStorage.getItem(this.VERSION_KEY);
      const lastCheck = localStorage.getItem(this.LAST_CHECK_KEY);
      const now = Date.now();

      // Check every 2 minutes (more frequent than version check)
      const shouldCheck = !lastCheck || (now - parseInt(lastCheck)) > 2 * 60 * 1000;

      if (!shouldCheck) {
        return false;
      }

      localStorage.setItem(this.LAST_CHECK_KEY, now.toString());

      const needsUpdate = !storedVersion ||
        storedVersion !== this.CURRENT_VERSION.version ||
        this.CURRENT_VERSION.forceUpdate;

      if (needsUpdate) {

        await this.handleFeatureUpdate();
        return true;
      }

      return false;
    } catch (error) {
 console.error('Feature update check failed:', error);
      return false;
    }
  }

  // Update handler
  private async handleFeatureUpdate(): Promise<void> {
    try {
      const cacheKeysToClear = new Set<string>();

      this.FEATURES.forEach(feature => {
        if (feature.enabled) {
          feature.cacheKeys.forEach(key => cacheKeysToClear.add(key));
        }
      });

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          cacheKeysToClear.forEach(cacheKey => {
            if (key.includes(cacheKey)) {
              keysToRemove.push(key);
            }
          });

          if (key.includes('cache') || key.includes('Cache')) {
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      if ('serviceWorker' in navigator && 'caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => {
            return caches.delete(cacheName);
          })
        );
      }

      localStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION.version);
      localStorage.setItem(this.FEATURE_KEY, JSON.stringify(this.CURRENT_VERSION.features));

      // Show update notification
      this.showUpdateNotification();

    } catch (error) {
 console.error('Feature update failed:', error);
    }
  }

  public isFeatureEnabled(featureId: string): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const feature = this.FEATURES.find(f => f.featureId === featureId);
      if (!feature) return false;

      if (!feature.enabled) return false;

      // Check rollout percentage
      const userId = this.getUserId();
      const userHash = this.hashUserId(userId);
      const rolloutThreshold = feature.rolloutPercentage / 100;

      return userHash < rolloutThreshold;
    } catch (error) {
 console.error('Feature check failed:', error);
      return false;
    }
  }

  // Get user identifier
  private getUserId(): string {
    // Auth fallback
    const authUser = localStorage.getItem('userAuthenticated');
    if (authUser) {
      return authUser;
    }

    // Browser fingerprint fallback
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('feature-rollout', 10, 10);
    const fingerprint = canvas.toDataURL();

    return btoa(fingerprint).slice(0, 16);
  }

  // Consistency hash
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) / 2147483647; // Normalize to 0-1
  }

  // UI notification
  // DISABLED: Push notifications for feature updates are disabled
  private async showUpdateNotification(): Promise<void> {
    // Disabled - no longer broadcasting push notifications for feature updates
    return;
  }

  // Emergency refresh
  public forceRefresh(): void {
    if (typeof window === 'undefined') return;


    localStorage.clear();
    sessionStorage.clear();

    if ('serviceWorker' in navigator && 'caches' in window) {
      caches.keys().then(cacheNames => {
        return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
      });
    }

    // Reload page
    window.location.reload();
  }

  // Metadata getters
  public getVersionInfo(): AppVersion {
    return { ...this.CURRENT_VERSION };
  }

  // Get enabled features for current user
  public getEnabledFeatures(): string[] {
    return this.FEATURES
      .filter(feature => this.isFeatureEnabled(feature.featureId))
      .map(feature => feature.featureId);
  }
}

export const featureUpdateManager = FeatureUpdateManager.getInstance();
export default featureUpdateManager;
