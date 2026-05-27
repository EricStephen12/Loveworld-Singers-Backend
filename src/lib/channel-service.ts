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
  serverTimestamp
} from 'firebase/firestore'
import { db } from './firebase-setup'

export interface Channel {
  id: string
  name: string
  description: string
  thumbnail: string
  ownerId: string
  ownerName: string
  ownerEmail: string
  subscriberCount: number
  videoCount: number
  isHQOnly?: boolean
  allowedZones?: string[]
  createdAt: Date
  updatedAt: Date
}

const COLLECTION = 'media_channels'

class ChannelService {
  private mapDoc(doc: any): Channel {
    const data = doc.data()
    return {
      id: doc.id,
      name: data.name || '',
      description: data.description || '',
      thumbnail: data.thumbnail || '',
      ownerId: data.ownerId || '',
      ownerName: data.ownerName || '',
      ownerEmail: data.ownerEmail || '',
      subscriberCount: data.subscriberCount || 0,
      videoCount: data.videoCount || 0,
      isHQOnly: data.isHQOnly || false,
      allowedZones: data.allowedZones || [],
      createdAt: data.createdAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || new Date()
    }
  }

  async getAllChannels(limitCount: number = 100): Promise<Channel[]> {
    try {
      const q = query(
        collection(db, COLLECTION),
        orderBy('name', 'asc'),
        limit(limitCount)
      )
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => this.mapDoc(doc))
    } catch (error) {
      console.error('Error fetching all channels:', error)
      return []
    }
  }

  async getChannelById(channelId: string): Promise<Channel | null> {
    try {
      const docRef = doc(db, COLLECTION, channelId)
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        return this.mapDoc(docSnap)
      }
      return null
    } catch (error) {
      console.error('Error fetching channel by ID:', error)
      return null
    }
  }

  async createChannel(channelData: Omit<Channel, 'id' | 'subscriberCount' | 'videoCount' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTION), {
        ...channelData,
        subscriberCount: 0,
        videoCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      return docRef.id
    } catch (error) {
      console.error('Error creating channel:', error)
      throw error
    }
  }

  async updateChannel(channelId: string, updates: Partial<Omit<Channel, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION, channelId)
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      })
    } catch (error) {
      console.error('Error updating channel:', error)
      throw error
    }
  }

  async deleteChannel(channelId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION, channelId))
    } catch (error) {
      console.error('Error deleting channel:', error)
      throw error
    }
  }

  async incrementVideoCount(channelId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION, channelId)
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        const currentCount = docSnap.data().videoCount || 0
        await updateDoc(docRef, {
          videoCount: currentCount + 1,
          updatedAt: serverTimestamp()
        })
      }
    } catch (error) {
      console.error('Error incrementing video count:', error)
    }
  }

  async decrementVideoCount(channelId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION, channelId)
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        const currentCount = docSnap.data().videoCount || 0
        await updateDoc(docRef, {
          videoCount: Math.max(0, currentCount - 1),
          updatedAt: serverTimestamp()
        })
      }
    } catch (error) {
      console.error('Error decrementing video count:', error)
    }
  }
}

export const channelService = new ChannelService()
export default channelService
