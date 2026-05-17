import {
  collection,
  query,
  orderBy,
  getDocs,
  where,
  doc,
  getDoc,
  updateDoc,
  increment,
  limit as firestoreLimit,
  startAfter,
  QueryDocumentSnapshot,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore'

import { FirebaseDatabaseService } from './firebase-database'
import { db } from './firebase-setup'

let masterSongsCache: { data: MasterSong[]; timestamp: number } | null = null
let hqInternalSongsCache: { data: any[]; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

let lastMasterSongDoc: QueryDocumentSnapshot | null = null
let lastHQInternalDoc: QueryDocumentSnapshot | null = null

export interface MasterSong {
  id: string
  title: string
  lyrics?: string
  syncedLyrics?: any[]
  solfa?: string
  key?: string
  tempo?: string
  writer?: string
  leadSinger?: string
  conductor?: string
  leadKeyboardist?: string
  bassGuitarist?: string
  drummer?: string
  category?: string
  categories?: string[]
  audioFile?: string
  audioUrls?: {
    full?: string
    soprano?: string
    alto?: string
    tenor?: string
    bass?: string
    [key: string]: string | undefined // Allow custom parts
  }
  customParts?: string[] // Track custom part names
  sourceType: 'hq_internal' | 'manual'
  originalSongId?: string // Optional for manually created songs
  publishedBy: string
  publishedByName?: string
  publishedAt: Date
  updatedAt: Date
  importCount: number
}

export interface ImportedSongTracking {
  importedFrom: 'master' | 'zone'
  originalSongId: string
  importedAt: Date
  importedBy: string
}

export interface MasterProgram {
  id: string
  name: string
  description?: string
  songIds: string[]
  publishedBy: string
  publishedByName: string
  createdAt: Date
  updatedAt: Date
  sortOrder?: number
}

export class MasterLibraryService {

  // Load ALL master songs at once (no pagination needed for typical library sizes)
  static async getMasterSongs(limitCount: number = 5000, forceRefresh: boolean = false): Promise<MasterSong[]> {
    try {
      if (!forceRefresh && masterSongsCache && Date.now() - masterSongsCache.timestamp < CACHE_TTL) {
        return masterSongsCache.data
      }

      // Fetch ALL songs - no limit for practical purposes
      // Firestore can handle thousands of documents efficiently
      const q = query(
        collection(db, 'master_songs'),
        firestoreLimit(limitCount)
      )

      const querySnapshot = await getDocs(q)
      const songs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MasterSong[]

      // Sort by title alphabetically for consistent display
      songs.sort((a, b) => {
        const titleA = (a.title || '').toLowerCase()
        const titleB = (b.title || '').toLowerCase()
        return titleA.localeCompare(titleB)
      })

      masterSongsCache = { data: songs, timestamp: Date.now() }

      // Track if there might be more (for UI purposes)
      lastMasterSongDoc = querySnapshot.docs.length >= limitCount
        ? querySnapshot.docs[querySnapshot.docs.length - 1]
        : null


      return songs
    } catch (error) {
 console.error('Error getting Master Library songs:', error)
      return []
    }
  }

  // Load more is rarely needed now, but keep for backwards compatibility
  static async loadMoreMasterSongs(limitCount: number = 1000): Promise<MasterSong[]> {
    try {
      if (!lastMasterSongDoc) return []

      const q = query(
        collection(db, 'master_library'),
        startAfter(lastMasterSongDoc),
        firestoreLimit(limitCount)
      )

      const querySnapshot = await getDocs(q)
      const songs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MasterSong[]

      if (querySnapshot.docs.length > 0) {
        lastMasterSongDoc = querySnapshot.docs.length >= limitCount
          ? querySnapshot.docs[querySnapshot.docs.length - 1]
          : null

        if (masterSongsCache) {
          // Add new songs, avoiding duplicates
          const existingIds = new Set(masterSongsCache.data.map(s => s.id))
          const newSongs = songs.filter(s => !existingIds.has(s.id))
          masterSongsCache.data = [...masterSongsCache.data, ...newSongs]

          // Re-sort by title
          masterSongsCache.data.sort((a, b) => {
            const titleA = (a.title || '').toLowerCase()
            const titleB = (b.title || '').toLowerCase()
            return titleA.localeCompare(titleB)
          })

          masterSongsCache.timestamp = Date.now()
        }
      } else {
        lastMasterSongDoc = null
      }


      return songs
    } catch (error) {
 console.error('Error loading more Master Library songs:', error)
      return []
    }
  }

  static hasMoreMasterSongs(): boolean {
    return lastMasterSongDoc !== null
  }

  static clearMasterSongsCache(): void {
    masterSongsCache = null
    lastMasterSongDoc = null
  }

  static async getMasterSong(songId: string): Promise<MasterSong | null> {
    try {
      const docRef = doc(db, 'master_library', songId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as MasterSong
      }
      return null
    } catch (error) {
 console.error('Error getting Master song:', error)
      return null
    }
  }

  static async publishToMasterLibrary(
    originalSong: any,
    publishedBy: string,
    publishedByName?: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const existing = await this.getMasterSongByOriginalId(originalSong.id)
      if (existing) {
        return { success: false, error: 'This song is already in the Master Library' }
      }

      const masterSongData = {
        title: originalSong.title || '',
        lyrics: originalSong.lyrics || '',
        solfa: originalSong.solfa || '',
        key: originalSong.key || '',
        tempo: originalSong.tempo || '',
        writer: originalSong.writer || '',
        leadSinger: originalSong.leadSinger || '',
        conductor: originalSong.conductor || '',
        leadKeyboardist: originalSong.leadKeyboardist || '',
        bassGuitarist: originalSong.bassGuitarist || '',
        drummer: originalSong.drummer || '',
        category: originalSong.category || '',
        categories: originalSong.categories || [],
        audioFile: originalSong.audioFile || '',
        audioUrls: originalSong.audioUrls || {},
        customParts: originalSong.customParts || [],
        sourceType: 'hq_internal',
        originalSongId: originalSong.id || originalSong.firebaseId,
        publishedBy,
        publishedByName: publishedByName || '',
        publishedAt: new Date(),
        updatedAt: new Date(),
        importCount: 0
      }

      const cleanData = Object.fromEntries(
        Object.entries(masterSongData).filter(([_, v]) => v !== undefined)
      )

      const result = await FirebaseDatabaseService.addDocument('master_library', cleanData)

      if (result.success) {
        this.clearMasterSongsCache()
        return { success: true, id: result.id }
      }
      return { success: false, error: 'Failed to publish song' }
    } catch (error) {
 console.error('Error publishing to Master Library:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async createMasterSong(
    songData: Partial<MasterSong>,
    publishedBy: string,
    publishedByName?: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const masterSongData = {
        title: songData.title || '',
        lyrics: songData.lyrics || '',
        solfa: songData.solfa || '',
        key: songData.key || '',
        tempo: songData.tempo || '',
        writer: songData.writer || '',
        leadSinger: songData.leadSinger || '',
        conductor: songData.conductor || '',
        leadKeyboardist: songData.leadKeyboardist || '',
        bassGuitarist: songData.bassGuitarist || '',
        drummer: songData.drummer || '',
        category: songData.category || '',
        categories: songData.categories || [],
        audioFile: songData.audioUrls?.full || songData.audioFile || '',
        audioUrls: songData.audioUrls || {},
        customParts: songData.customParts || [],
        sourceType: 'manual' as const,
        publishedBy,
        publishedByName: publishedByName || '',
        publishedAt: new Date(),
        updatedAt: new Date(),
        importCount: 0
      }

      const cleanData = Object.fromEntries(
        Object.entries(masterSongData).filter(([_, v]) => v !== undefined)
      )

      const result = await FirebaseDatabaseService.addDocument('master_library', cleanData)

      if (result.success) {
        this.clearMasterSongsCache()
        return { success: true, id: result.id }
      }
      return { success: false, error: 'Failed to create song' }
    } catch (error) {
 console.error('Error creating Master song:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async getMasterSongByOriginalId(originalSongId: string): Promise<MasterSong | null> {
    try {
      const q = query(
        collection(db, 'master_library'),
        where('originalSongId', '==', originalSongId)
      )

      const querySnapshot = await getDocs(q)
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0]
        return { id: doc.id, ...doc.data() } as MasterSong
      }
      return null
    } catch (error) {
 console.error('Error checking Master Library:', error)
      return null
    }
  }

  static async updateMasterSong(
    songId: string,
    data: Partial<MasterSong>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData = { ...data }
      delete (updateData as any).sourceType
      delete (updateData as any).originalSongId
      delete (updateData as any).publishedBy
      delete (updateData as any).publishedAt
      delete (updateData as any).importCount

      updateData.updatedAt = new Date()

      await FirebaseDatabaseService.updateDocument('master_library', songId, updateData)
      return { success: true }
    } catch (error) {
 console.error('Error updating Master song:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async deleteMasterSong(songId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await FirebaseDatabaseService.deleteDocument('master_library', songId)
      this.clearMasterSongsCache()
      return { success: true }
    } catch (error) {
 console.error('Error deleting Master song:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async importToZone(
    masterSong: MasterSong,
    zoneId: string,
    praiseNightId: string,
    importedBy: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const zoneSongData = {
        title: masterSong.title,
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
        importedFrom: 'master',
        originalSongId: masterSong.id,
        importedAt: new Date(),
        importedBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'unheard'
      }

      const cleanData = Object.fromEntries(
        Object.entries(zoneSongData).filter(([_, v]) => v !== undefined)
      )

      const result = await FirebaseDatabaseService.addDocument('zone_songs', cleanData)

      if (result.success) {
        await this.incrementImportCount(masterSong.id)
        return { success: true, id: result.id }
      }
      return { success: false, error: 'Failed to import song' }
    } catch (error) {
 console.error('Error importing to zone:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async incrementImportCount(masterSongId: string): Promise<void> {
    try {
      const docRef = doc(db, 'master_library', masterSongId)
      await updateDoc(docRef, { importCount: increment(1) })
    } catch (error) {
 console.error('Error incrementing import count:', error)
    }
  }

  static async getHQInternalSongs(limitCount: number = 200, forceRefresh: boolean = false): Promise<any[]> {
    try {
      if (!forceRefresh && hqInternalSongsCache && Date.now() - hqInternalSongsCache.timestamp < CACHE_TTL) {
        return hqInternalSongsCache.data
      }

      const q = query(collection(db, 'praise_night_songs'), firestoreLimit(limitCount))
      const querySnapshot = await getDocs(q)

      const songs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        firebaseId: doc.id,
        ...doc.data()
      })) as Array<{ id: string; firebaseId: string; title?: string;[key: string]: any }>

      songs.sort((a, b) => (a.title || '').localeCompare(b.title || ''))

      hqInternalSongsCache = { data: songs, timestamp: Date.now() }

      if (querySnapshot.docs.length > 0) {
        lastHQInternalDoc = querySnapshot.docs[querySnapshot.docs.length - 1]
      }

      return songs
    } catch (error) {
 console.error('Error getting HQ Internal songs:', error)
      return []
    }
  }

  static async loadMoreHQInternalSongs(limitCount: number = 100): Promise<any[]> {
    try {
      if (!lastHQInternalDoc) return []

      const q = query(
        collection(db, 'praise_night_songs'),
        startAfter(lastHQInternalDoc),
        firestoreLimit(limitCount)
      )

      const querySnapshot = await getDocs(q)
      const songs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        firebaseId: doc.id,
        ...doc.data()
      })) as Array<{ id: string; firebaseId: string; title?: string;[key: string]: any }>

      songs.sort((a, b) => (a.title || '').localeCompare(b.title || ''))

      if (querySnapshot.docs.length > 0) {
        lastHQInternalDoc = querySnapshot.docs[querySnapshot.docs.length - 1]
        if (hqInternalSongsCache) {
          hqInternalSongsCache.data = [...hqInternalSongsCache.data, ...songs]
          hqInternalSongsCache.timestamp = Date.now()
        }
      } else {
        lastHQInternalDoc = null
      }

      return songs
    } catch (error) {
 console.error('Error loading more HQ Internal songs:', error)
      return []
    }
  }

  static hasMoreHQInternalSongs(): boolean {
    return lastHQInternalDoc !== null
  }

  static clearHQInternalSongsCache(): void {
    hqInternalSongsCache = null
    lastHQInternalDoc = null
  }

  static async searchMasterSongs(searchTerm: string): Promise<MasterSong[]> {
    try {
      const allSongs = await this.getMasterSongs()
      const term = searchTerm.toLowerCase()

      return allSongs.filter(song =>
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

  static async getMasterLibraryStats(): Promise<{
    totalSongs: number
    totalImports: number
    mostImported: MasterSong[]
  }> {
    try {
      const songs = await this.getMasterSongs()

      const totalImports = songs.reduce((sum, song) => sum + (song.importCount || 0), 0)
      const mostImported = [...songs]
        .sort((a, b) => (b.importCount || 0) - (a.importCount || 0))
        .slice(0, 5)

      return { totalSongs: songs.length, totalImports, mostImported }
    } catch (error) {
 console.error('Error getting Master Library stats:', error)
      return { totalSongs: 0, totalImports: 0, mostImported: [] }
    }
  }

  // --- Program Management ---

  static async getMasterPrograms(): Promise<MasterProgram[]> {
    try {
      const q = query(collection(db, 'master_programs'))
      const querySnapshot = await getDocs(q)
      const programsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date()
      })) as MasterProgram[]

      // Sort by sortOrder first, then name
      return programsList.sort((a, b) => {
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
          return a.sortOrder - b.sortOrder
        }
        if (a.sortOrder !== undefined) return -1
        if (b.sortOrder !== undefined) return 1
        return a.name.localeCompare(b.name)
      })
    } catch (error) {
 console.error('Error getting Master programs:', error)
      return []
    }
  }

  static async createMasterProgram(
    name: string,
    publishedBy: string,
    publishedByName: string,
    description?: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const programData = {
        name,
        description: description || '',
        songIds: [],
        publishedBy,
        publishedByName,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      const result = await FirebaseDatabaseService.addDocument('master_programs', programData)
      return { success: result.success, id: result.id, error: result.error }
    } catch (error) {
 console.error('Error creating Master program:', error)
      return { success: false, error: 'Failed to create program' }
    }
  }

  static async updateMasterProgram(
    programId: string,
    data: Partial<MasterProgram>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData = { ...data, updatedAt: new Date() }
      delete (updateData as any).id
      await FirebaseDatabaseService.updateDocument('master_programs', programId, updateData)
      return { success: true }
    } catch (error) {
 console.error('Error updating Master program:', error)
      return { success: false, error: 'Failed to update program' }
    }
  }

  static async deleteMasterProgram(programId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await FirebaseDatabaseService.deleteDocument('master_programs', programId)
      return { success: true }
    } catch (error) {
 console.error('Error deleting Master program:', error)
      return { success: false, error: 'Failed to delete program' }
    }
  }

  static async addSongToProgram(programId: string, songId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const programRef = doc(db, 'master_programs', programId)
      await updateDoc(programRef, {
        songIds: arrayUnion(songId),
        updatedAt: new Date()
      })
      return { success: true }
    } catch (error) {
 console.error('Error adding song to program:', error)
      return { success: false, error: 'Failed to add song' }
    }
  }

  static async addSongsToProgram(programId: string, songIds: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      const programRef = doc(db, 'master_programs', programId)
      await updateDoc(programRef, {
        songIds: arrayUnion(...songIds),
        updatedAt: new Date()
      })
      return { success: true }
    } catch (error) {
 console.error('Error adding songs to program:', error)
      return { success: false, error: 'Failed to add songs' }
    }
  }

  static async removeSongFromProgram(programId: string, songId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const programRef = doc(db, 'master_programs', programId)
      await updateDoc(programRef, {
        songIds: arrayRemove(songId),
        updatedAt: new Date()
      })
      return { success: true }
    } catch (error) {
 console.error('Error removing song from program:', error)
      return { success: false, error: 'Failed to remove song' }
    }
  }

  static async updateMasterProgramsOrder(updatedPrograms: MasterProgram[]): Promise<{ success: boolean; error?: string }> {
    try {
      const promises = updatedPrograms.map((program, index) => {
        const programRef = doc(db, 'master_programs', program.id)
        return updateDoc(programRef, {
          sortOrder: index,
          updatedAt: new Date()
        })
      })
      await Promise.all(promises)
      return { success: true }
    } catch (error) {
 console.error('Error updating Master programs order:', error)
      return { success: false, error: 'Failed to update program order' }
    }
  }
}
