import { db, FieldValue } from './firebase-admin'
import { PraiseNightSong } from '@/types/supabase'
import { isHQGroup } from '@/config/zones'
import { FirebaseMetadataService } from './firebase-metadata-service'

function getCollectionName(zoneId?: string): string {
  return (zoneId && isHQGroup(zoneId)) ? 'praise_night_songs' : 'zone_songs'
}

export class PraiseNightSongsService {

  static async getSongsByPraiseNight(praiseNightId: string, zoneId?: string): Promise<PraiseNightSong[]> {
    try {
      const collectionName = getCollectionName(zoneId)
      const songsCol = db.collection(collectionName)

      let snapshot = await songsCol.where('praiseNightId', '==', praiseNightId).get()

      // Try alternative field names for HQ groups
      if (snapshot.empty && zoneId && isHQGroup(zoneId)) {
        snapshot = await songsCol.where('praisenightid', '==', praiseNightId).get()

        if (snapshot.empty) {
          snapshot = await songsCol.where('praisenight_id', '==', praiseNightId).get()
        }

        if (snapshot.empty) {
          snapshot = await songsCol.where('pageId', '==', praiseNightId).get()
        }
      }

      return snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          ...data,
          id: doc.id,
          rehearsalCount: data.rehearsalCount ?? data.rehearsalcount ?? 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
        }
      }) as unknown as PraiseNightSong[]
    } catch (error) {
      console.error('Error getting songs:', error)
      return []
    }
  }

  static async getAllSongs(zoneId?: string): Promise<PraiseNightSong[]> {
    try {
      const collectionName = getCollectionName(zoneId)
      let query = db.collection(collectionName) as any

      if (zoneId && !isHQGroup(zoneId)) {
        query = query.where('zoneId', '==', zoneId)
      }

      const snapshot = await query.get()

      return snapshot.docs.map((doc: any) => {
        const data = doc.data()
        return {
          ...data,
          id: doc.id,
          rehearsalCount: data.rehearsalCount ?? data.rehearsalcount ?? 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
        }
      }) as unknown as PraiseNightSong[]
    } catch (error) {
      console.error('Error getting all songs:', error)
      return []
    }
  }

  static async getSongById(songId: string, zoneId?: string): Promise<PraiseNightSong | null> {
    try {
      const collectionName = getCollectionName(zoneId)
      const songDoc = await db.collection(collectionName).doc(songId).get()

      if (!songDoc.exists) return null

      const data = songDoc.data() || {}
      return {
        ...data,
        id: songDoc.id,
        rehearsalCount: data.rehearsalCount ?? data.rehearsalcount ?? 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
      } as unknown as PraiseNightSong
    } catch (error) {
      console.error('Error getting song:', error)
      return null
    }
  }

  static async createSong(songData: Partial<PraiseNightSong>, zoneId?: string): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const collectionName = getCollectionName(zoneId)
      const now = FieldValue.serverTimestamp()

      const cleanData = {
        title: songData.title || '',
        leadSinger: songData.leadSinger || '',
        writer: songData.writer || '',
        conductor: songData.conductor || '',
        key: songData.key || '',
        tempo: songData.tempo || '',
        leadKeyboardist: songData.leadKeyboardist || '',
        leadGuitarist: songData.leadGuitarist || '',
        bassGuitarist: songData.bassGuitarist || '',
        drummer: songData.drummer || '',
        lyrics: songData.lyrics || '',
        solfas: songData.solfas || '',
        notation: songData.notation || '',
        audioFile: songData.audioFile || '',
        category: songData.category || '',
        categories: songData.categories || [],
        status: songData.status || 'unheard',
        praiseNightId: songData.praiseNightId || '',
        rehearsalCount: songData.rehearsalCount ?? 0,
        comments: songData.comments || [],
        history: songData.history || [],
        isActive: songData.isActive || false,
        mediaId: songData.mediaId || null,
        zoneId: zoneId || '',
        audioUrls: songData.audioUrls || {},
        customParts: songData.customParts || [],
        availableParts: songData.availableParts || [],
        createdAt: now,
        updatedAt: now
      }

      const docRef = await db.collection(collectionName).add(cleanData)

      if (zoneId && songData.praiseNightId) {
        await FirebaseMetadataService.updateSongMetadata(zoneId, songData.praiseNightId, docRef.id)
        await FirebaseMetadataService.updatePraiseNightSongsMetadata(zoneId, songData.praiseNightId)
      }

      return { success: true, id: docRef.id }
    } catch (error) {
      console.error('Error creating song:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create song' }
    }
  }

  static async updateSong(songId: string, songData: Partial<PraiseNightSong>, zoneId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const collectionName = getCollectionName(zoneId)
      const songRef = db.collection(collectionName).doc(songId)
      const songDoc = await songRef.get()

      if (!songDoc.exists) {
        return { success: false, error: 'Song not found' }
      }

      const { id, firebaseId, createdAt, zoneId: _, ...updateData } = songData as any

      const cleanedData = Object.entries(updateData).reduce((acc, [key, value]) => {
        if (value !== undefined) acc[key] = value
        return acc
      }, {} as any)

      await songRef.update({ ...cleanedData, updatedAt: FieldValue.serverTimestamp() })

      const existingData = songDoc.data() || {}
      const praiseNightId = songData.praiseNightId || existingData.praiseNightId

      if (zoneId && praiseNightId) {
        await FirebaseMetadataService.updateSongMetadata(zoneId, praiseNightId, songId)
        await FirebaseMetadataService.updatePraiseNightSongsMetadata(zoneId, praiseNightId)
      }

      return { success: true }
    } catch (error) {
      console.error('Error updating song:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update song' }
    }
  }

  static async deleteSong(songId: string, zoneId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const collectionName = getCollectionName(zoneId)
      const songRef = db.collection(collectionName).doc(songId)
      const songDoc = await songRef.get()

      if (!songDoc.exists) {
        return { success: false, error: 'Song not found' }
      }

      const existingData = songDoc.data() || {}
      const praiseNightId = existingData.praiseNightId

      await songRef.delete()

      if (zoneId && praiseNightId) {
        await FirebaseMetadataService.updateSongMetadata(zoneId, praiseNightId, songId)
        await FirebaseMetadataService.updatePraiseNightSongsMetadata(zoneId, praiseNightId)
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting song:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete song' }
    }
  }

  static async updateSongStatus(songId: string, status: 'heard' | 'unheard', zoneId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const collectionName = getCollectionName(zoneId)
      const songRef = db.collection(collectionName).doc(songId)
      const songDoc = await songRef.get()

      if (!songDoc.exists) {
        return { success: false, error: 'Song not found' }
      }

      await songRef.update({ status, updatedAt: FieldValue.serverTimestamp() })

      const existingData = songDoc.data() || {}
      const praiseNightId = existingData.praiseNightId
      if (zoneId && praiseNightId) {
        await FirebaseMetadataService.updateSongMetadata(zoneId, praiseNightId, songId)
        await FirebaseMetadataService.updatePraiseNightSongsMetadata(zoneId, praiseNightId)
      }

      return { success: true }
    } catch (error) {
      console.error('Error updating status:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update status' }
    }
  }
}
