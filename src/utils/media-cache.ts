// Media caching utility with zone-specific support
interface Media {
  id: string
  title: string
  description?: string
  type: string
  [key: string]: any
}

const CACHE_KEY_BASE = 'media-cache'
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes (media changes less frequently)

interface CachedData {
  data: Media[]
  timestamp: number
}

// Get cache key with optional zone suffix
function getCacheKey(zoneType?: string): string {
  return zoneType ? `${CACHE_KEY_BASE}-${zoneType}` : CACHE_KEY_BASE
}

export class MediaCache {
  // Save media to localStorage (with optional zone-specific key)
  static saveMedia(media: Media[], zoneType?: string): void {
    try {
      const cached: CachedData = {
        data: media,
        timestamp: Date.now()
      }
      const key = getCacheKey(zoneType)
      localStorage.setItem(key, JSON.stringify(cached))
    } catch (error) {
 console.error('Failed to cache media:', error)
    }
  }

  // Load media from localStorage (with optional zone-specific key)
  static loadMedia(zoneType?: string): Media[] | null {
    try {
      const key = getCacheKey(zoneType)
      const cached = localStorage.getItem(key)
      if (!cached) {
        return null
      }

      const parsed: CachedData = JSON.parse(cached)
      
            const age = Date.now() - parsed.timestamp
      if (age > CACHE_DURATION) {
        this.clearMedia(zoneType)
        return null
      }

      return parsed.data
    } catch (error) {
 console.error('Failed to load cached media:', error)
      return null
    }
  }

    static clearMedia(zoneType?: string): void {
    try {
      const key = getCacheKey(zoneType)
      localStorage.removeItem(key)
    } catch (error) {
 console.error('Failed to clear cached media:', error)
    }
  }
  
    static clearAllMedia(): void {
    try {
      localStorage.removeItem(getCacheKey())
      localStorage.removeItem(getCacheKey('hq'))
      localStorage.removeItem(getCacheKey('regular'))
    } catch (error) {
 console.error('Failed to clear all cached media:', error)
    }
  }
}
