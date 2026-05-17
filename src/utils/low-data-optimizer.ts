// Network optimization

interface ConnectionInfo {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

class LowDataOptimizer {
  private static instance: LowDataOptimizer;
  private connectionInfo: ConnectionInfo | null = null;
  private isLowData = false;
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  // TTL configuration
  private readonly TTL = {
    FAST: 5 * 60 * 1000,      // 5 minutes for fast connections
    SLOW: 30 * 60 * 1000,     // 30 minutes for slow connections
    VERY_SLOW: 2 * 60 * 60 * 1000, // 2 hours for very slow connections
    OFFLINE: 24 * 60 * 60 * 1000   // 24 hours when offline
  };

  static getInstance(): LowDataOptimizer {
    if (!LowDataOptimizer.instance) {
      LowDataOptimizer.instance = new LowDataOptimizer();
    }
    return LowDataOptimizer.instance;
  }

  init() {
    this.detectConnection();
    this.setupEventListeners();
  }

  private detectConnection() {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this.connectionInfo = {
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
        saveData: connection.saveData || false
      };

      // Status determination
      this.isLowData =
        this.connectionInfo.effectiveType === 'slow-2g' ||
        this.connectionInfo.effectiveType === '2g' ||
        this.connectionInfo.downlink < 1 ||
        this.connectionInfo.saveData;


      if (this.isLowData) {
      }
    }
  }

  private setupEventListeners() {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      connection.addEventListener('change', () => {
        this.detectConnection();
      });
    }

    // Connectivity listeners
    window.addEventListener('online', () => {
      this.detectConnection();
    });

    window.addEventListener('offline', () => {
      this.isLowData = true;
    });
  }

  // TTL calculation
  getCacheTTL(): number {
    if (!navigator.onLine) return this.TTL.OFFLINE;
    if (!this.connectionInfo) return this.TTL.FAST;

    switch (this.connectionInfo.effectiveType) {
      case 'slow-2g':
      case '2g':
        return this.TTL.VERY_SLOW;
      case '3g':
        return this.TTL.SLOW;
      default:
        return this.TTL.FAST;
    }
  }

  // Caching
  set(key: string, data: any): void {
    const ttl = this.getCacheTTL();
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    // Persistence
    try {
      localStorage.setItem(`lowdata_${key}`, JSON.stringify({
        data,
        timestamp: Date.now(),
        ttl
      }));
    } catch (error) {
 console.warn('Failed to store in localStorage:', error);
    }

  }

  get(key: string): any | null {
    // Check memory cache first
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    // Check localStorage
    try {
      const stored = localStorage.getItem(`lowdata_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < parsed.ttl) {
          // Restore to memory cache
          this.cache.set(key, parsed);
          return parsed.data;
        } else {
          // Expired, remove it
          localStorage.removeItem(`lowdata_${key}`);
        }
      }
    } catch (error) {
 console.warn('Failed to read from localStorage:', error);
    }

    return null;
  }

  // Eviction
  remove(key: string): void {
    // Remove from memory
    this.cache.delete(key);

    // Remove from storage
    try {
      localStorage.removeItem(`lowdata_${key}`);
    } catch (e) {
 console.warn('Failed to remove from localStorage:', e);
    }
  }

  shouldFetch(key: string): boolean {
    const cached = this.get(key);
    if (cached) {
      return false;
    }

    return true;
  }

  // Metadata
  getConnectionInfo(): ConnectionInfo | null {
    return this.connectionInfo;
  }

  isLowDataMode(): boolean {
    return this.isLowData;
  }

  clearCache(): void {
    this.cache.clear();
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('lowdata_')) {
        localStorage.removeItem(key);
      }
    });
  }

  // Statistics
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export const lowDataOptimizer = LowDataOptimizer.getInstance();


