// Low Data Firebase Service

import { FirebaseDatabaseService } from './firebase-database';
import { lowDataOptimizer } from '@/utils/low-data-optimizer';

class FirebaseLowDataService {
  private static instance: FirebaseLowDataService;
  
  static getInstance(): FirebaseLowDataService {
    if (!FirebaseLowDataService.instance) {
      FirebaseLowDataService.instance = new FirebaseLowDataService();
    }
    return FirebaseLowDataService.instance;
  }

  // Caching getters
  async getCollection(collection: string, useCache = true): Promise<any[]> {
    const cacheKey = `collection_${collection}`;
    
    // Check cache first
    if (useCache) {
      const cached = lowDataOptimizer.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Only fetch if not cached or cache expired
    if (lowDataOptimizer.shouldFetch(cacheKey)) {
      const data = await FirebaseDatabaseService.getCollection(collection);
      
      // Cache the data
      if (useCache) {
        lowDataOptimizer.set(cacheKey, data);
      }
      
      return data;
    }

    // Fallback to cached data
    return lowDataOptimizer.get(cacheKey) || [];
  }

  async getDocument(collection: string, docId: string, useCache = true): Promise<any> {
    const cacheKey = `document_${collection}_${docId}`;
    
    // Check cache first
    if (useCache) {
      const cached = lowDataOptimizer.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Only fetch if not cached or cache expired
    if (lowDataOptimizer.shouldFetch(cacheKey)) {
      const data = await FirebaseDatabaseService.getDocument(collection, docId);
      
      // Cache the data
      if (useCache) {
        lowDataOptimizer.set(cacheKey, data);
      }
      
      return data;
    }

    // Fallback to cached data
    return lowDataOptimizer.get(cacheKey) || null;
  }

  async getSongsByPageId(pageId: number, useCache = true): Promise<any[]> {
    const cacheKey = `songs_page_${pageId}`;
    
    // Check cache first
    if (useCache) {
      const cached = lowDataOptimizer.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Only fetch if not cached or cache expired
    if (lowDataOptimizer.shouldFetch(cacheKey)) {
      const data = await (FirebaseDatabaseService as any).getSongsByPageId(pageId);
      
      // Cache the data
      if (useCache) {
        lowDataOptimizer.set(cacheKey, data);
      }
      
      return data;
    }

    // Fallback to cached data
    return lowDataOptimizer.get(cacheKey) || [];
  }

  async getSongsByCategory(category: string, useCache = true): Promise<any[]> {
    const cacheKey = `songs_category_${category}`;
    
    // Check cache first
    if (useCache) {
      const cached = lowDataOptimizer.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Only fetch if not cached or cache expired
    if (lowDataOptimizer.shouldFetch(cacheKey)) {
      const data = await (FirebaseDatabaseService as any).getSongsByCategory(category);
      
      // Cache the data
      if (useCache) {
        lowDataOptimizer.set(cacheKey, data);
      }
      
      return data;
    }

    // Fallback to cached data
    return lowDataOptimizer.get(cacheKey) || [];
  }

  // Comments getter
  async getComments(songId: number, useCache = true): Promise<any[]> {
    const cacheKey = `comments_${songId}`;
    
    // Check cache first
    if (useCache) {
      const cached = lowDataOptimizer.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Only fetch if not cached or cache expired
    if (lowDataOptimizer.shouldFetch(cacheKey)) {
      const data = await FirebaseDatabaseService.getCollectionWhere('comments', 'songId', songId, '==');
      
      // Cache update
      if (useCache) {
        lowDataOptimizer.set(cacheKey, data);
      }
      
      return data;
    }

    // Fallback to cached data
    return lowDataOptimizer.get(cacheKey) || [];
  }

    clearCache(pattern?: string): void {
    if (pattern) {
            const stats = lowDataOptimizer.getCacheStats();
      stats.keys.forEach((key: string) => {
        if (key.includes(pattern)) {
          lowDataOptimizer.clearCache();
        }
      });
    } else {
            lowDataOptimizer.clearCache();
    }
  }

  // Metadata
  getCacheStats(): { size: number; keys: string[]; connectionInfo: any } {
    return {
      ...lowDataOptimizer.getCacheStats(),
      connectionInfo: lowDataOptimizer.getConnectionInfo()
    };
  }
}

export const firebaseLowDataService = FirebaseLowDataService.getInstance();
