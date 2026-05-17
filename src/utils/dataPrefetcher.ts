// Data Prefetcher for Ultra-Fast Loading
// This utility prefetches data in the background for instant access

import { getAllPages } from '@/lib/database';
import { offlineManager } from './offlineManager';

class DataPrefetcher {
  private static instance: DataPrefetcher;
  private prefetchPromise: Promise<any> | null = null;
  private lastPrefetchTime = 0;
  private readonly PREFETCH_INTERVAL = 30000; // 30 seconds

  static getInstance(): DataPrefetcher {
    if (!DataPrefetcher.instance) {
      DataPrefetcher.instance = new DataPrefetcher();
    }
    return DataPrefetcher.instance;
  }

  // Prefetch data in background - DISABLED (no caching)
  async prefetchData(): Promise<void> {
    // No prefetching - always fetch fresh data
    return;
  }

  private async performPrefetch(): Promise<void> {
    try {
      // Prefetch pages data
      const pages = await getAllPages();
      
      // Cache the data for instant access
      await offlineManager.cacheData('pages', pages);
      
    } catch (error) {
 console.error('Error during prefetch:', error);
      throw error;
    }
  }

  // Get cached data instantly
  async getCachedData(): Promise<any> {
    return await offlineManager.getCachedData('pages');
  }

  // Force refresh data
  async forceRefresh(): Promise<any> {
    this.lastPrefetchTime = 0; // Reset timer
    return await this.prefetchData();
  }

    async clearCache(): Promise<void> {
    await offlineManager.clearCache();
    this.lastPrefetchTime = 0; // Reset timer
  }
}

// Export singleton instance
export const dataPrefetcher = DataPrefetcher.getInstance();

// Auto-prefetch when module loads (for instant access)
if (typeof window !== 'undefined') {
  // Prefetch after a short delay to not block initial page load
  setTimeout(() => {
    dataPrefetcher.prefetchData();
  }, 1000);
}

