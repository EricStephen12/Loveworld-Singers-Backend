import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  startAfter,
  writeBatch
} from 'firebase/firestore'

import { db } from './firebase-setup'
import { authedFetch } from '@/lib/authed-fetch'

export interface MediaVideo {
  id: string
  title: string
  description: string
  thumbnail: string
  videoUrl?: string
  youtubeUrl?: string
  isYouTube: boolean
  type: string
  duration?: number
  releaseYear?: number
  featured: boolean
  forHQ: boolean
  hidden: boolean
  views: number
  likes: number
  createdAt: Date
  updatedAt: Date
  createdBy?: string
  createdByName?: string
}

export type MediaVideoInput = Omit<MediaVideo, 'id' | 'createdAt' | 'updatedAt' | 'views' | 'likes'>

const COLLECTION = 'media_videos'

class MediaVideosService {
  async create(data: MediaVideoInput, notifyUsers: boolean = false): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      views: 0,
      likes: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })

    // Send push notification for new media (optional, admin can choose)
    if (notifyUsers) {
      this.sendMediaNotification(docRef.id, data.title, data.forHQ).catch(err => {
      })
    }

    return docRef.id
  }

  async createBatch(videos: (MediaVideoInput & { notifyUsers?: boolean })[]): Promise<void> {
    const batch = writeBatch(db)
    const newDocs: { id: string, title: string, forHQ: boolean }[] = []

    videos.forEach((video) => {
      const { notifyUsers, ...data } = video
      const docRef = doc(collection(db, COLLECTION))
      batch.set(docRef, {
        ...data,
        views: 0,
        likes: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
      if (notifyUsers) {
        newDocs.push({ id: docRef.id, title: data.title, forHQ: data.forHQ })
      }
    })

    await batch.commit()

    // Send notifications after commit
    for (const docInfo of newDocs) {
      this.sendMediaNotification(docInfo.id, docInfo.title, docInfo.forHQ).catch(() => { })
    }
  }

  // Send push notification for new media to zone members
  async sendMediaNotification(videoId: string, title: string, forHQ: boolean): Promise<void> {
    try {
      // Get zone members to notify based on forHQ flag
      const membersCollection = forHQ ? 'hq_members' : 'zone_members'
      const membersRef = collection(db, membersCollection)
      const snapshot = await getDocs(query(membersRef, limit(500))) // Limit to prevent too many notifications

      const recipientIds: string[] = []
      snapshot.forEach(doc => {
        const data = doc.data()
        if (data.userId) {
          recipientIds.push(data.userId)
        }
      })

      if (recipientIds.length === 0) {
        return
      }

      // Send in batches of 100 to avoid overwhelming the API
      const batchSize = 100
      for (let i = 0; i < recipientIds.length; i += batchSize) {
        const batch = recipientIds.slice(i, i + batchSize)
        await authedFetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'media',
            recipientIds: batch,
            title: ' New Video',
            body: `New video uploaded: "${title}"`,
            data: { videoId }
          })
        })
      }

    } catch (error) {
 console.error('[MediaVideos] Error sending notification:', error)
    }
  }

  async getAll(limitCount = 24): Promise<MediaVideo[]> {
    const q = query(
      collection(db, COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    )
    const snapshot = await getDocs(q)
    return this.mapDocs(snapshot.docs)
  }

  async loadMore(lastCreatedAt: Date, limitCount = 12): Promise<MediaVideo[]> {
    const q = query(
      collection(db, COLLECTION),
      orderBy('createdAt', 'desc'),
      startAfter(Timestamp.fromDate(lastCreatedAt)),
      limit(limitCount)
    )
    const snapshot = await getDocs(q)
    return this.mapDocs(snapshot.docs)
  }

  async getById(id: string): Promise<MediaVideo | null> {
    const docRef = doc(db, COLLECTION, id)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) return null
    return this.mapDoc(docSnap)
  }

  async getByType(type: MediaVideo['type']): Promise<MediaVideo[]> {
    const q = query(
      collection(db, COLLECTION),
      where('type', '==', type),
      orderBy('createdAt', 'desc')
    )
    const snapshot = await getDocs(q)
    return this.mapDocs(snapshot.docs)
  }

  async getFeatured(): Promise<MediaVideo[]> {
    const q = query(
      collection(db, COLLECTION),
      where('featured', '==', true),
      orderBy('views', 'desc'),
      limit(10)
    )
    const snapshot = await getDocs(q)
    return this.mapDocs(snapshot.docs)
  }

  async getForHQ(limitCount = 24): Promise<MediaVideo[]> {
    const q = query(
      collection(db, COLLECTION),
      where('forHQ', '==', true),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    )
    const snapshot = await getDocs(q)
    return this.mapDocs(snapshot.docs)
  }

  async getForRegularZones(limitCount = 24): Promise<MediaVideo[]> {
    const q = query(
      collection(db, COLLECTION),
      where('forHQ', '==', false),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    )
    const snapshot = await getDocs(q)
    return this.mapDocs(snapshot.docs)
  }

  async getForZoneType(isHQZone: boolean, limitCount = 24): Promise<MediaVideo[]> {
    return isHQZone ? this.getForHQ(limitCount) : this.getForRegularZones(limitCount)
  }

  async update(id: string, data: Partial<MediaVideoInput>): Promise<void> {
    const docRef = doc(db, COLLECTION, id)
    const cleanData: Record<string, any> = {}

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleanData[key] = value
      }
    }

    await updateDoc(docRef, {
      ...cleanData,
      updatedAt: Timestamp.now()
    })
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION, id)
    await deleteDoc(docRef)

    // Clean up playlists to maintain accurate counts
    try {
      const playlistsRef = collection(db, 'admin_playlists')
      const playlistSnap = await getDocs(playlistsRef)

      const updatePromises = playlistSnap.docs
        .filter(pDoc => pDoc.data().videoIds?.includes(id))
        .map(pDoc => {
          const newVideoIds = pDoc.data().videoIds.filter((vId: string) => vId !== id)
          return updateDoc(doc(db, 'admin_playlists', pDoc.id), {
            videoIds: newVideoIds,
            updatedAt: Timestamp.now()
          })
        })

      await Promise.all(updatePromises)
    } catch (err) {
 console.error('[MediaVideos] Error cleaning up playlists after video delete:', err)
    }
  }

  async incrementViews(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION, id)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      const currentViews = docSnap.data().views || 0
      await updateDoc(docRef, { views: currentViews + 1 })
    }
  }

  async incrementLikes(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION, id)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      const currentLikes = docSnap.data().likes || 0
      await updateDoc(docRef, { likes: currentLikes + 1 })
    }
  }

  async search(searchTerm: string): Promise<MediaVideo[]> {
    const all = await this.getAll(100)
    const term = searchTerm.toLowerCase()
    return all.filter(v =>
      v.title.toLowerCase().includes(term) ||
      v.description?.toLowerCase().includes(term)
    )
  }

  private mapDocs(docs: any[]): MediaVideo[] {
    return docs.map(doc => this.mapDoc(doc))
  }

  private mapDoc(doc: any): MediaVideo {
    const data = doc.data()
    return {
      id: doc.id,
      title: data.title || '',
      description: data.description || '',
      thumbnail: data.thumbnail || '',
      videoUrl: data.videoUrl,
      youtubeUrl: data.youtubeUrl,
      isYouTube: data.isYouTube || false,
      type: data.type || 'other',
      duration: data.duration,
      releaseYear: data.releaseYear,
      featured: data.featured || false,
      forHQ: data.forHQ !== false,
      hidden: data.hidden || false,
      views: data.views || 0,
      likes: data.likes || 0,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
      createdBy: data.createdBy,
      createdByName: data.createdByName
    }
  }
}

export const mediaVideosService = new MediaVideosService()
export default mediaVideosService
