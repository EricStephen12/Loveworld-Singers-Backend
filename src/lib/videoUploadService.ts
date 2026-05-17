import {
  addDoc,
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  limit,
  orderBy,
  query,
  Timestamp
} from 'firebase/firestore'
import { db } from './firebase-setup'

export type VideoSourceType = 'upload' | 'youtube'

export interface VideoUploadInput {
  title: string
  description: string
  type: string
  genre: string[]
  playbackUrl: string
  videoUrl?: string
  youtubeUrl?: string
  thumbnail: string
  backdropImage?: string
  duration?: number
  releaseYear?: number
  featured: boolean
  isYouTube: boolean
  sourceType: VideoSourceType
  createdBy: string
  createdByEmail?: string | null
  createdByName?: string | null
  views?: number
  likes?: number
}

export interface VideoUploadRecord extends VideoUploadInput {
  id: string
  createdAt: Date
  updatedAt: Date
}

class VideoUploadService {
  // Changed to media_videos for unified video management
  private collectionName = 'media_videos'

  async createUpload(payload: VideoUploadInput): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), {
      ...payload,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })
    return docRef.id
  }

  async getRecentUploads(count = 10): Promise<VideoUploadRecord[]> {
    const q = query(
      collection(db, this.collectionName),
      orderBy('createdAt', 'desc'),
      limit(count)
    )
    const snapshot = await getDocs(q)

    return snapshot.docs.map((doc) => {
      const data = doc.data() as any
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate()
          : new Date(),
        updatedAt: data.updatedAt?.toDate
          ? data.updatedAt.toDate()
          : new Date()
      } as VideoUploadRecord
    })
  }

  async getAllUploads(): Promise<VideoUploadRecord[]> {
    const q = query(
      collection(db, this.collectionName),
      orderBy('createdAt', 'desc')
    )
    const snapshot = await getDocs(q)

    return snapshot.docs.map((doc) => {
      const data = doc.data() as any
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate()
          : new Date(),
        updatedAt: data.updatedAt?.toDate
          ? data.updatedAt.toDate()
          : new Date()
      } as VideoUploadRecord
    })
  }

  async getUploadById(id: string): Promise<VideoUploadRecord | null> {
    try {
      const docRef = doc(db, this.collectionName, id)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        const data = docSnap.data() as any
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate()
            : new Date(),
          updatedAt: data.updatedAt?.toDate
            ? data.updatedAt.toDate()
            : new Date()
        } as VideoUploadRecord
      }
      return null
    } catch (error) {
 console.error('Error getting upload by ID:', error)
      return null
    }
  }

  async updateUpload(id: string, updates: Partial<VideoUploadInput>): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, id)
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      })
    } catch (error) {
 console.error('Error updating upload:', error)
      throw error
    }
  }

  async deleteUpload(id: string): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, id)
      await deleteDoc(docRef)
    } catch (error) {
 console.error('Error deleting upload:', error)
      throw error
    }
  }
}

export const videoUploadService = new VideoUploadService()
export default videoUploadService


