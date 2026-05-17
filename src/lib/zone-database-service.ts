import { FirebaseDatabaseService } from './firebase-database'
import { FirebaseMetadataService } from './firebase-metadata-service'

const CATEGORIES_CACHE_TTL = 5 * 60 * 1000

interface CategoriesCache {
  data: any[]
  timestamp: number
  zoneId: string
}

const categoriesCache = new Map<string, CategoriesCache>()
const pageCategoriesCache = new Map<string, CategoriesCache>()

function isCategoriesCacheValid(cache: CategoriesCache | undefined): boolean {
  if (!cache) return false
  return Date.now() - cache.timestamp < CATEGORIES_CACHE_TTL
}

export class ZoneDatabaseService {

  static async getPraiseNightsByZone(zoneId: string, limitCount = 10) {
    try {
      const allPraiseNights = await FirebaseDatabaseService.getCollectionWhere(
        'zone_praise_nights',
        'zoneId',
        '==',
        zoneId
      )

      const sorted = allPraiseNights.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || 0).getTime()
        const dateB = new Date(b.createdAt || 0).getTime()
        return dateB - dateA
      })

      return sorted.slice(0, limitCount)
    } catch (error) {
 console.error('Error getting praise nights by zone:', error)
      return []
    }
  }

  static subscribeToPraiseNightsByZone(zoneId: string, callback: (data: any[]) => void, limitCount = 100) {
    // For zonal data
    return FirebaseDatabaseService.subscribeToCollectionWhere(
      'zone_praise_nights',
      'zoneId',
      '==',
      zoneId,
      (data) => {
        // Sort client-side since we can't easily compound index dynamically
        const sorted = data.sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt || 0).getTime()
          const dateB = new Date(b.createdAt || 0).getTime()
          return dateB - dateA
        })
        callback(sorted)
      },
      limitCount
    )
  }

  static async getSongsByPraiseNight(praiseNightId: string) {
    try {
      const songs = await FirebaseDatabaseService.getCollectionWhere(
        'zone_songs',
        'praiseNightId',
        '==',
        praiseNightId
      )
      return songs.sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0))
    } catch (error) {
 console.error('Error getting zone songs:', error)
      return []
    }
  }

  static async getAllSongsByZone(zoneId: string) {
    try {
      return await FirebaseDatabaseService.getCollectionWhere(
        'zone_songs',
        'zoneId',
        '==',
        zoneId
      )
    } catch (error) {
 console.error('Error getting zone songs by zone:', error)
      return []
    }
  }

  static async createPraiseNight(zoneId: string, data: any) {
    try {
      const { isHQGroup } = await import('@/config/zones')
      const now = new Date()
      const collection = isHQGroup(zoneId) ? 'praise_nights' : 'zone_praise_nights'
      const scope = isHQGroup(zoneId) ? 'hq' : 'zone'

      const praiseNightData = {
        ...data,
        zoneId,
        scope,
        createdAt: now,
        updatedAt: now
      }
      const result = await FirebaseDatabaseService.addDocument(collection, praiseNightData)

      // Log activity
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('showToast', {
          detail: {
            message: `Created page: ${data.name}`,
            type: 'success',
            userName: localStorage.getItem('userName') || 'Admin',
            action: 'created',
            section: 'pages',
            itemName: data.name
          }
        }));
      }

      // Metadata Update
      await FirebaseMetadataService.updateMetadata(zoneId, 'praise_nights')

      return { success: true, id: result.id, firebaseId: result.id }
    } catch (error) {
 console.error('Error creating praise night:', error)
      return { success: false }
    }
  }

  static async createSong(zoneId: string, praiseNightId: string, songData: any) {
    try {
      const data = {
        ...songData,
        zoneId,
        praiseNightId,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      )

      const result = await FirebaseDatabaseService.addDocument('zone_songs', cleanData)

      //  Trigger metadata update for realtime sync
      if (result.success && result.id) {
        await FirebaseMetadataService.updatePraiseNightSongsMetadata(zoneId, praiseNightId)
        // Also update individual song metadata
        await FirebaseMetadataService.updateSongMetadata(zoneId, praiseNightId, result.id)
      }

      return { success: true, id: result.id, song: { ...cleanData, id: result.id } }
    } catch (error) {
 console.error('Error creating zone song:', error)
      return { success: false }
    }
  }

  static async updatePraiseNight(praiseNightId: string, data: any, zoneId?: string) {
    try {
      const updateData = { ...data, updatedAt: new Date() }
      delete updateData.zoneId

      if (zoneId) {
        const { isHQGroup } = await import('@/config/zones')
        if (isHQGroup(zoneId)) {
          const result = await FirebaseDatabaseService.updatePraiseNight(praiseNightId, updateData)

          // Log activity
          if (typeof window !== 'undefined' && result.success) {
            window.dispatchEvent(new CustomEvent('showToast', {
              detail: {
                message: `Updated page: ${data.name || 'Page'}`,
                type: 'success',
                userName: localStorage.getItem('userName') || 'Admin',
                action: 'updated',
                section: 'pages',
                itemName: data.name || 'Page'
              }
            }));
          }

          // Metadata Update
          await FirebaseMetadataService.updateMetadata(zoneId, 'praise_nights')

          return result
        }
      }

      const result = await FirebaseDatabaseService.updateDocument('zone_praise_nights', praiseNightId, updateData)

      // Log activity
      if (typeof window !== 'undefined' && result.success) {
        window.dispatchEvent(new CustomEvent('showToast', {
          detail: {
            message: `Updated page: ${data.name || 'Page'}`,
            type: 'success',
            userName: localStorage.getItem('userName') || 'Admin',
            action: 'updated',
            section: 'pages',
            itemName: data.name || 'Page'
          }
        }));
      }

      // Metadata Update
      if (result.success && zoneId) {
        await FirebaseMetadataService.updateMetadata(zoneId, 'praise_nights')
      }

      return { success: true }
    } catch (error) {
 console.error('Error updating praise night:', error)
      return { success: false }
    }
  }

  static async updateSong(songId: string, data: any) {
    try {
      const updateData = { ...data, updatedAt: new Date() }
      delete updateData.zoneId
      delete updateData.id
      delete updateData.firebaseId

      const cleanData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined)
      )

      await FirebaseDatabaseService.updateDocument('zone_songs', songId, cleanData)

      //  Trigger metadata update for realtime sync
      // We need praiseNightId to update the correct list
      // Since we don't have it in data significantly often, we might need it.
      // However, for updateSong, usually we interact with a loaded song.
      // If data has praiseNightId, use it. If not, we should probably fetch the song first?
      // Optimization: Try to get praiseNightId from data, if not, fetch current doc.
      let praiseNightId = data.praiseNightId;
      if (!praiseNightId) {
        // Fetch to get praiseNightId
        try {
          const songDoc = await FirebaseDatabaseService.getDocument('zone_songs', songId);
          if (songDoc) {
            praiseNightId = (songDoc as any).praiseNightId;
            const zId = (songDoc as any).zoneId;
            if (zId && praiseNightId) {
              await FirebaseMetadataService.updatePraiseNightSongsMetadata(zId, praiseNightId)
              await FirebaseMetadataService.updateSongMetadata(zId, praiseNightId, songId)
            }
          }
        } catch (e) {
 console.error('Error fetching song for metadata update:', e);
        }
      } else {
        // If we have praiseNightId and know zoneId? 
        // updateSong generic doesn't pass zoneId, but the song has it.
        // We'll rely on the fetch above or if the caller passed it.
        // Actually, let's just do the fetch approach always to be safe and accurate about zoneId too.
      }
      return { success: true }
    } catch (error) {
 console.error('Error updating zone song:', error)
      return { success: false }
    }
  }

  static async deletePraiseNight(praiseNightId: string, zoneId?: string) {
    try {
      let result;
      if (zoneId) {
        const { isHQGroup } = await import('@/config/zones')
        if (isHQGroup(zoneId)) {
          result = await FirebaseDatabaseService.deletePraiseNight(praiseNightId)
        }
      }

      if (!result) {
        result = await FirebaseDatabaseService.deleteDocument('zone_praise_nights', praiseNightId)
      }

      // Log activity
      if (typeof window !== 'undefined' && result.success) {
        window.dispatchEvent(new CustomEvent('showToast', {
          detail: {
            message: 'Deleted page',
            type: 'success',
            userName: localStorage.getItem('userName') || 'Admin',
            action: 'deleted',
            section: 'pages',
            itemName: 'Page'
          }
        }));
      }

      // Metadata Update
      if (result.success && zoneId) {
        await FirebaseMetadataService.updateMetadata(zoneId, 'praise_nights')
      }

      return { success: true }
    } catch (error) {
 console.error('Error deleting praise night:', error)
      return { success: false }
    }
  }

  static async deleteSong(songId: string) {
    try {
      // Get song first to access praiseNightId and zoneId for metadata update
      let praiseNightId: string | undefined;
      let zId: string | undefined;
      try {
        const songDoc = await FirebaseDatabaseService.getDocument('zone_songs', songId);
        if (songDoc) {
          praiseNightId = (songDoc as any).praiseNightId;
          zId = (songDoc as any).zoneId;
        }
      } catch (e) {
 console.error('Error getting song before delete:', e);
      }

      await FirebaseDatabaseService.deleteDocument('zone_songs', songId)

      //  Trigger metadata update
      if (zId && praiseNightId) {
        await FirebaseMetadataService.updatePraiseNightSongsMetadata(zId, praiseNightId)
      }

      return { success: true }
    } catch (error) {
 console.error('Error deleting zone song:', error)
      return { success: false }
    }
  }

  static async getCategoriesByZone(zoneId: string) {
    try {
      return await FirebaseDatabaseService.getCollectionWhere(
        'zone_categories',
        'zoneId',
        '==',
        zoneId
      )
    } catch (error) {
 console.error('Error getting zone categories:', error)
      return []
    }
  }

  static async createCategory(zoneId: string, categoryData: any) {
    try {
      const { isHQGroup } = await import('@/config/zones')
      const collection = isHQGroup(zoneId) ? 'categories' : 'zone_categories'

      const data = {
        ...categoryData,
        ...(isHQGroup(zoneId) ? {} : { zoneId }),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await FirebaseDatabaseService.addDocument(collection, data)
      this.invalidateCategoriesCache(zoneId)
      //  Trigger metadata update for realtime sync
      await FirebaseMetadataService.updateMetadata(zoneId, 'categories')
      return { success: true, id: result.id, ...data }
    } catch (error) {
 console.error('Error creating category:', error)
      return { success: false }
    }
  }

  static async getPageCategoriesByZone(zoneId: string) {
    try {
      return await FirebaseDatabaseService.getCollectionWhere(
        'zone_page_categories',
        'zoneId',
        '==',
        zoneId
      )
    } catch (error) {
 console.error('Error getting zone page categories:', error)
      return []
    }
  }

  static async createPageCategory(zoneId: string, data: any) {
    try {
      const { isHQGroup } = await import('@/config/zones')
      const collection = isHQGroup(zoneId) ? 'page_categories' : 'zone_page_categories'

      const categoryData = {
        ...data,
        ...(isHQGroup(zoneId) ? {} : { zoneId }),
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await FirebaseDatabaseService.addDocument(collection, categoryData)
      this.invalidatePageCategoriesCache(zoneId)
      //  Trigger metadata update for realtime sync
      await FirebaseMetadataService.updateMetadata(zoneId, 'page_categories')
      return { success: true, id: result.id }
    } catch (error) {
 console.error('Error creating page category:', error)
      return { success: false }
    }
  }

  static async updatePageCategory(zoneId: string, pageCategoryId: string, data: any) {
    try {
      const { isHQGroup } = await import('@/config/zones')
      const collection = isHQGroup(zoneId) ? 'page_categories' : 'zone_page_categories'
      const updateData = { ...data, updatedAt: new Date() }
      delete updateData.zoneId

      await FirebaseDatabaseService.updateDocument(collection, pageCategoryId, updateData)
      this.invalidatePageCategoriesCache(zoneId)
      //  Trigger metadata update for realtime sync
      await FirebaseMetadataService.updateMetadata(zoneId, 'page_categories')
      return { success: true }
    } catch (error) {
 console.error('Error updating page category:', error)
      return { success: false }
    }
  }

  static async deletePageCategory(zoneId: string, pageCategoryId: string) {
    try {
      const { isHQGroup } = await import('@/config/zones')
      const collection = isHQGroup(zoneId) ? 'page_categories' : 'zone_page_categories'

      await FirebaseDatabaseService.deleteDocument(collection, pageCategoryId)
      this.invalidatePageCategoriesCache(zoneId)
      //  Trigger metadata update for realtime sync
      await FirebaseMetadataService.updateMetadata(zoneId, 'page_categories')
      return { success: true }
    } catch (error) {
 console.error('Error deleting page category:', error)
      return { success: false }
    }
  }

  static async updateCategory(zoneId: string, categoryId: string, data: any) {
    try {
      const { isHQGroup } = await import('@/config/zones')
      const collection = isHQGroup(zoneId) ? 'categories' : 'zone_categories'
      const updateData = { ...data, updatedAt: new Date() }
      delete updateData.zoneId

      await FirebaseDatabaseService.updateDocument(collection, categoryId, updateData)
      this.invalidateCategoriesCache(zoneId)
      //  Trigger metadata update for realtime sync
      await FirebaseMetadataService.updateMetadata(zoneId, 'categories')
      return { success: true }
    } catch (error) {
 console.error('Error updating category:', error)
      return { success: false }
    }
  }

  static async deleteCategory(zoneId: string, categoryId: string) {
    try {
      const { isHQGroup } = await import('@/config/zones')
      const collection = isHQGroup(zoneId) ? 'categories' : 'zone_categories'

      await FirebaseDatabaseService.deleteDocument(collection, categoryId)
      this.invalidateCategoriesCache(zoneId)
      //  Trigger metadata update for realtime sync
      await FirebaseMetadataService.updateMetadata(zoneId, 'categories')
      return { success: true }
    } catch (error) {
 console.error('Error deleting category:', error)
      return { success: false }
    }
  }

  static async getSongHistory(songId: string) {
    try {
      const history = await FirebaseDatabaseService.getCollectionWhere(
        'zone_song_history',
        'song_id',
        '==',
        songId
      )

      return history.sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || 0).getTime()
        const dateB = new Date(b.created_at || 0).getTime()
        return dateB - dateA
      })
    } catch (error) {
 console.error('Error getting zone song history:', error)
      return []
    }
  }

  static async createSongHistory(historyData: any) {
    try {
      const data = { ...historyData, created_at: new Date() }
      const result = await FirebaseDatabaseService.addDocument('zone_song_history', data)
      return { success: true, id: result.id }
    } catch (error) {
 console.error('Error creating zone song history:', error)
      return { success: false }
    }
  }

  static async getCategories(zoneId: string) {
    const cacheKey = `categories_${zoneId}`
    const cached = categoriesCache.get(cacheKey)
    if (isCategoriesCacheValid(cached)) {
      return cached!.data
    }

    const { isHQGroup } = await import('@/config/zones')

    const categories = isHQGroup(zoneId)
      ? await FirebaseDatabaseService.getCollection('categories')
      : await this.getCategoriesByZone(zoneId)

    categoriesCache.set(cacheKey, { data: categories, timestamp: Date.now(), zoneId })
    return categories
  }

  static async getPageCategories(zoneId: string) {
    const cacheKey = `page_categories_${zoneId}`
    const cached = pageCategoriesCache.get(cacheKey)
    if (isCategoriesCacheValid(cached)) {
      return cached!.data
    }

    const { isHQGroup } = await import('@/config/zones')

    const pageCategories = isHQGroup(zoneId)
      ? await FirebaseDatabaseService.getCollection('page_categories')
      : await this.getPageCategoriesByZone(zoneId)

    // Sort by orderIndex
    const sorted = pageCategories.sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0))

    pageCategoriesCache.set(cacheKey, { data: sorted, timestamp: Date.now(), zoneId })
    return sorted
  }

  static async updatePageCategoryOrder(zoneId: string, categories: any[]) {
    try {
      const { isHQGroup } = await import('@/config/zones')
      const collection = isHQGroup(zoneId) ? 'page_categories' : 'zone_page_categories'

      // Update each category with its new index
      // Using Promise.all for parallel updates
      await Promise.all(categories.map(async (cat, index) => {
        if (cat.id) {
          await FirebaseDatabaseService.updateDocument(collection, cat.id, {
            orderIndex: index,
            updatedAt: new Date()
          })
        }
      }))

      this.invalidatePageCategoriesCache(zoneId)
      await FirebaseMetadataService.updateMetadata(zoneId, 'page_categories')

      return { success: true }
    } catch (error) {
 console.error('Error updating page category order:', error)
      return { success: false }
    }
  }

  static invalidateCategoriesCache(zoneId: string) {
    categoriesCache.delete(`categories_${zoneId}`)
  }

  static invalidatePageCategoriesCache(zoneId: string) {
    pageCategoriesCache.delete(`page_categories_${zoneId}`)
  }

  static async getMasterSongs(limit: number = 100) {
    try {
      const { MasterLibraryService } = await import('./master-library-service')
      return await MasterLibraryService.getMasterSongs(limit)
    } catch (error) {
 console.error('Error getting Master Library songs:', error)
      return []
    }
  }

  static async searchMasterSongs(searchTerm: string) {
    try {
      const allSongs = await this.getMasterSongs()
      const term = searchTerm.toLowerCase()

      return allSongs.filter((song: any) =>
        song.title?.toLowerCase().includes(term) ||
        song.writer?.toLowerCase().includes(term) ||
        song.leadSinger?.toLowerCase().includes(term) ||
        song.category?.toLowerCase().includes(term) ||
        song.lyrics?.toLowerCase().includes(term) ||
        song.solfa?.toLowerCase().includes(term) ||
        song.key?.toLowerCase().includes(term) ||
        song.tempo?.toLowerCase().includes(term)
      )
    } catch (error) {
 console.error('Error searching Master Library:', error)
      return []
    }
  }

  static async importFromMasterLibrary(
    zoneId: string,
    praiseNightId: string,
    masterSong: any,
    importedBy: string
  ) {
    try {
      const existingSongs = await this.getSongsByPraiseNight(praiseNightId)
      const alreadyImported = existingSongs.some(
        (s: any) => s.importedFrom === 'master' && s.originalSongId === masterSong.id
      )

      if (alreadyImported) {
        return {
          success: false,
          error: 'This song has already been imported to this praise night'
        }
      }

      const maxOrderIndex = existingSongs.reduce(
        (max: number, s: any) => Math.max(max, s.orderIndex || 0),
        0
      )

      const zoneSongData = {
        title: masterSong.title || '',
        lyrics: masterSong.lyrics || '',
        solfa: masterSong.solfa || '',
        key: masterSong.key || '',
        tempo: masterSong.tempo || '',
        writer: masterSong.writer || '',
        leadSinger: masterSong.leadSinger || '',
        conductor: masterSong.conductor || '',
        leadKeyboardist: masterSong.leadKeyboardist || '',
        bassGuitarist: masterSong.bassGuitarist || '',
        drummer: masterSong.drummer || '',
        category: masterSong.category || '',
        categories: masterSong.categories || [],
        audioFile: masterSong.audioFile || '',
        audioUrls: masterSong.audioUrls || {},
        zoneId,
        praiseNightId,
        orderIndex: maxOrderIndex + 1,
        importedFrom: 'master',
        originalSongId: masterSong.id,
        importedAt: new Date(),
        importedBy,
        status: 'unheard',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const cleanData = Object.fromEntries(
        Object.entries(zoneSongData).filter(([_, v]) => v !== undefined)
      )

      const result = await FirebaseDatabaseService.addDocument('zone_songs', cleanData)

      if (result.success && result.id) {
        await this.incrementMasterSongImportCount(masterSong.id)
        return { success: true, id: result.id }
      }
      return { success: false, error: 'Failed to import song' }
    } catch (error) {
 console.error('Error importing from Master Library:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  static async incrementMasterSongImportCount(masterSongId: string) {
    try {
      const masterSong = await FirebaseDatabaseService.getDocument('master_songs', masterSongId)

      if (masterSong) {
        const newCount = ((masterSong as any).importCount || 0) + 1
        await FirebaseDatabaseService.updateDocument('master_songs', masterSongId, {
          importCount: newCount
        })
      }
    } catch (error) {
 console.error('Error incrementing import count:', error)
    }
  }

  static async isImportedFromMaster(songId: string): Promise<boolean> {
    try {
      const song = await FirebaseDatabaseService.getDocument('zone_songs', songId)
      return (song as any)?.importedFrom === 'master'
    } catch (error) {
 console.error('Error checking import status:', error)
      return false
    }
  }

  static async getImportedSongs(zoneId: string) {
    try {
      const allSongs = await this.getAllSongsByZone(zoneId)
      return allSongs.filter((song: any) => song.importedFrom === 'master')
    } catch (error) {
 console.error('Error getting imported songs:', error)
      return []
    }
  }
}
