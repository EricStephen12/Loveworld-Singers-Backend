// Cache management

interface CacheConfig {
  key: string;
  duration: number; // Cache duration in milliseconds
  version?: string; // Version for cache busting
  priority: 'high' | 'medium' | 'low'; // Cache priority
}

interface SmartCacheEntry {
  data: any;
  timestamp: number;
  version: string;
  expiresAt: number;
  priority: 'high' | 'medium' | 'low';
}

class SmartCacheManager {
  private static instance: SmartCacheManager;
  private cache = new Map<string, SmartCacheEntry>();
  private readonly APP_VERSION = Date.now().toString(); // This should be your build version
  private readonly MAX_CACHE_SIZE = 50; // Maximum number of cache entries

  constructor() {
    this.initializeCache();
  }

  public static getInstance(): SmartCacheManager {
    if (!SmartCacheManager.instance) {
      SmartCacheManager.instance = new SmartCacheManager();
    }
    return SmartCacheManager.instance;
  }

  private initializeCache(): void {
    // Only run in browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    
        const storedVersion = localStorage.getItem('app-cache-version');
    if (!storedVersion || storedVersion !== this.APP_VERSION) {
      this.clearAllCache();
      localStorage.setItem('app-cache-version', this.APP_VERSION);
    }
  }

  // Caching disabled
  public setCache(config: CacheConfig, data: any): void {
    return;
  }

  // Caching disabled
  public getCache(key: string): any | null {
    return null;
  }

    private isValidEntry(entry: SmartCacheEntry): boolean {
    const now = Date.now();
    
        if (now > entry.expiresAt) {
      return false;
    }

        if (entry.version !== this.APP_VERSION) {
      return false;
    }

    return true;
  }

  // Remove oldest cache entries when cache is full
  private evictOldestEntries(): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by priority and timestamp
    entries.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a[1].priority];
      const bPriority = priorityOrder[b[1].priority];
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      return a[1].timestamp - b[1].timestamp;
    });

    // Eviction logic
    const toRemove = entries.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.2));
    toRemove.forEach(([key]) => {
      this.cache.delete(key);
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(`cache-${key}`);
      }
    });
  }

    public clearAllCache(): void {
    this.cache.clear();
    
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache-')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
    
  }

    public clearCache(key: string): void {
    this.cache.delete(key);
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(`cache-${key}`);
    }
  }

  // Metadata
  public getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }

  // Force refresh
  public async refreshCache(key: string, fetchFn: () => Promise<any>, config: CacheConfig): Promise<any> {
    this.clearCache(key);
    
    try {
      const data = await fetchFn();
      this.setCache(config, data);
      return data;
    } catch (error) {
 console.error(`Failed to refresh cache ${key}:`, error);
      throw error;
    }
  }
}

export const smartCache = SmartCacheManager.getInstance();

// Cache helpers
export const createCacheConfig = (
  key: string, 
  duration: number, 
  priority: 'high' | 'medium' | 'low' = 'medium'
): CacheConfig => ({
  key,
  duration,
  priority
});

// Cache durations
export const CACHE_DURATIONS = {
  NO_CACHE: 0, // No cache for real-time features
  REAL_TIME: 1 * 1000, // 1 second for dynamic content
  SHORT: 30 * 1000, // 30 seconds for semi-static content
  MEDIUM: 5 * 60 * 1000, // 5 minutes for static content
  LONG: 30 * 60 * 1000, // 30 minutes for very static content
  VERY_LONG: 2 * 60 * 60 * 1000 // 2 hours for extremely static content
} as const;

// Priority keys
export const HIGH_PRIORITY_KEYS = [
  'user-profile',
  'app-settings',
  'auth-token'
];

export const MEDIUM_PRIORITY_KEYS = [
  'pages-data',
  'songs-data',
  'categories-data'
];

export const LOW_PRIORITY_KEYS = [
  'search-results',
  'temp-data',
  'ui-state'
];
