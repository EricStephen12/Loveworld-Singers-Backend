// Offline data management
export class OfflineManager {
  private static instance: OfflineManager;
  private isOnline: boolean = typeof window !== 'undefined' ? navigator.onLine : true;
  private dataCache: Map<string, any> = new Map();
  private pendingUpdates: Array<{key: string, data: any, timestamp: number}> = [];

  private constructor() {
    // Only run in browser environment
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      this.setupEventListeners();
      this.loadCachedData();
    }
  }

  public static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingUpdates();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Listen for service worker messages
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'DATA_SYNCED') {
          this.handleDataSync();
        }
      });
    }
  }

  private async loadCachedData(): Promise<void> {
    if (typeof window === 'undefined') return;
    
    try {
      // Load data from localStorage as fallback
      const cachedData = localStorage.getItem('lwsrh-cached-data');
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        this.dataCache = new Map(Object.entries(parsed));
      }
    } catch (error) {
 console.error('Failed to load cached data:', error);
    }
  }

  private async saveCachedData(): Promise<void> {
    if (typeof window === 'undefined') return;
    
    try {
      const dataObject = Object.fromEntries(this.dataCache);
      localStorage.setItem('lwsrh-cached-data', JSON.stringify(dataObject));
    } catch (error) {
 console.error('Failed to save cached data:', error);
    }
  }

  // Caching
  public async cacheData(key: string, data: any): Promise<void> {
    // No caching - always fetch fresh data
    return;
  }

  // Cache retrieval
  public getCachedData(key: string): any | null {
    return null;
  }

    public isDataCached(key: string): boolean {
    return this.dataCache.has(key);
  }

  // Get data with offline fallback
  public async getData<T>(key: string, fetchFn?: () => Promise<T>): Promise<T | null> {
    // If online and fetch function provided, try to fetch fresh data
    if (this.isOnline && fetchFn) {
      try {
        const freshData = await fetchFn();
        // Cache the fresh data
        await this.cacheData(key, freshData);
        return freshData;
      } catch (error) {
      }
    }

    // Return cached data if available
    const cachedData = this.getCachedData(key);
    if (cachedData) {
      return cachedData;
    }

    // If no cached data and offline, return null
    if (!this.isOnline) {
      return null;
    }

    return null;
  }

    public async updateData(key: string, data: any, updateFn?: (data: any) => Promise<void>): Promise<boolean> {
    try {
      if (this.isOnline && updateFn) {
        // Try to update on server
        await updateFn(data);
        // Cache the updated data
        await this.cacheData(key, data);
        return true;
      } else {
        // Store update for later sync
        this.pendingUpdates.push({
          key,
          data,
          timestamp: Date.now()
        });
        // Cache locally
        await this.cacheData(key, data);
        return false; // Indicates update is pending
      }
    } catch (error) {
 console.error(`Failed to update data for ${key}:`, error);
      // Still cache locally for offline use
      await this.cacheData(key, data);
      return false;
    }
  }

  // Sync logic
  private async syncPendingUpdates(): Promise<void> {
    if (this.pendingUpdates.length === 0) return;

    
    for (const update of this.pendingUpdates) {
      try {
        // Here you would implement your actual sync logic
        // For now, we'll just log the update
        
        // Remove from pending after successful sync
        const index = this.pendingUpdates.indexOf(update);
        if (index > -1) {
          this.pendingUpdates.splice(index, 1);
        }
      } catch (error) {
 console.error(`Failed to sync update for ${update.key}:`, error);
      }
    }
  }

  // Event handlers
  private handleDataSync(): void {
    // Refresh data from cache or trigger re-fetch
    // You can emit events or call callbacks here to update UI
  }

  // Metadata
  public getConnectionStatus(): boolean {
    return this.isOnline;
  }

  public getPendingUpdatesCount(): number {
    return this.pendingUpdates.length;
  }

    public async clearCache(): Promise<void> {
    this.dataCache.clear();
    this.pendingUpdates = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lwsrh-cached-data');
    }
  }

  public getCacheStats(): {cachedItems: number, pendingUpdates: number, isOnline: boolean} {
    return {
      cachedItems: this.dataCache.size,
      pendingUpdates: this.pendingUpdates.length,
      isOnline: this.isOnline
    };
  }
}

// Singleton
export const offlineManager = OfflineManager.getInstance();
