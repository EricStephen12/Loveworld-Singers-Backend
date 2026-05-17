/**
 * Enterprise-level Smart Cache System
 * Like what Google, Facebook, and Netflix use
 */

interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
  accessCount: number
  lastAccessed: number
}

interface CacheConfig {
  maxSize: number
  defaultTTL: number
  cleanupInterval: number
}

class SmartCache<T = any> {
  private cache = new Map<string, CacheItem<T>>()
  private config: CacheConfig
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 1000,
      defaultTTL: 3 * 1000, // 3 seconds
      cleanupInterval: 10 * 1000, // 10 seconds
      ...config
    }
    
    this.startCleanup()
  }

  // Set cache with smart TTL based on data type
  set(key: string, data: T, ttl?: number): void {
    const now = Date.now()
    const itemTTL = ttl || this.getSmartTTL(data)
    
    // If cache is full, remove least recently used items
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU()
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: itemTTL,
      accessCount: 0,
      lastAccessed: now
    })
  }

  // Get with automatic refresh for stale data
  get(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null

    const now = Date.now()
    const isExpired = (now - item.timestamp) > item.ttl

    if (isExpired) {
      this.cache.delete(key)
      return null
    }

        item.accessCount++
    item.lastAccessed = now

    return item.data
  }

  // Smart TTL based on data type and size
  private getSmartTTL(data: any): number {
    if (typeof data === 'string' && data.length > 10000) {
      return 5 * 1000 // 5 seconds for large strings
    }
    
    if (Array.isArray(data) && data.length > 100) {
      return 8 * 1000 // 8 seconds for large arrays
    }
    
    if (typeof data === 'object' && data.id) {
      return 10 * 1000 // 10 seconds for entities with ID
    }
    
    return this.config.defaultTTL
  }

  // Remove least recently used items
  private evictLRU(): void {
    const entries = Array.from(this.cache.entries())
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
    
    // Remove 20% of least used items
    const toRemove = Math.ceil(entries.length * 0.2)
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0])
    }
  }

  // Cleanup expired items
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [key, item] of this.cache.entries()) {
        if ((now - item.timestamp) > item.ttl) {
          this.cache.delete(key)
        }
      }
    }, this.config.cleanupInterval)
  }

    clear(): void {
    this.cache.clear()
  }

  // Get cache stats
  getStats() {
    const entries = Array.from(this.cache.values())
    return {
      size: this.cache.size,
      totalAccess: entries.reduce((sum, item) => sum + item.accessCount, 0),
      avgAccess: entries.length > 0 ? entries.reduce((sum, item) => sum + item.accessCount, 0) / entries.length : 0
    }
  }

  // Cleanup on destroy
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.cache.clear()
  }
}

// Global cache instances for different data types
export const userCache = new SmartCache({ maxSize: 100, defaultTTL: 10 * 60 * 1000 })
export const profileCache = new SmartCache({ maxSize: 50, defaultTTL: 15 * 60 * 1000 })
export const groupsCache = new SmartCache({ maxSize: 200, defaultTTL: 3 * 1000 })
export const messagesCache = new SmartCache({ maxSize: 500, defaultTTL: 2 * 1000 })

// Smart cache decorator for functions
export function withCache<T extends any[], R>(
  cache: SmartCache<R>,
  keyGenerator: (...args: T) => string,
  ttl?: number
) {
  return function (fn: (...args: T) => Promise<R>) {
    return async (...args: T): Promise<R> => {
      const key = keyGenerator(...args)
      const cached = cache.get(key)
      
      if (cached) {
        return cached
      }
      
      const result = await fn(...args)
      cache.set(key, result, ttl)
      return result
    }
  }
}

// Cache invalidation helpers
export function invalidateUserCache(userId?: string) {
  if (userId) {
    userCache.clear()
    profileCache.clear()
  }
}

export function invalidateGroupsCache() {
  groupsCache.clear()
}

export function invalidateMessagesCache(groupId?: string) {
  if (groupId) {
    messagesCache.clear()
  }
}
