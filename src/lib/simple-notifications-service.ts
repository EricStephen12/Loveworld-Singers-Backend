import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp
} from 'firebase/firestore'

import { db } from './firebase-setup'
import { isHQGroup } from '@/config/zones'
import { authedFetch } from '@/lib/authed-fetch'

const CACHE_TTL = 2 * 60 * 1000

interface CacheEntry {
  data: AdminMessage[]
  timestamp: number
}

const messagesCache = new Map<string, CacheEntry>()

function getCacheKey(zoneId?: string): string {
  return `messages_${zoneId || 'default'}`
}

function isCacheValid(entry: CacheEntry | undefined): boolean {
  if (!entry) return false
  return Date.now() - entry.timestamp < CACHE_TTL
}

function invalidateCache(zoneId?: string): void {
  messagesCache.delete(getCacheKey(zoneId))
}

function getMessagesCollectionName(zoneId?: string): string {
  // All admin messages are global now
  return 'admin_messages'
}

export interface AdminMessage {
  id: string
  title: string
  message: string
  sentBy: string
  sentAt: string
  createdAt: string
}

export async function sendMessageToAllUsers(
  title: string,
  message: string,
  adminUsername: string,
  zoneId?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const collectionName = getMessagesCollectionName(zoneId)

    const messageData = {
      title: title.trim(),
      message: message.trim(),
      sentBy: adminUsername,
      sentAt: new Date().toISOString(),
      zoneId: 'global', // Always global now
      createdAt: serverTimestamp()
    }

    const messagesRef = collection(db, collectionName)
    const docRef = await addDoc(messagesRef, messageData)
    invalidateCache(zoneId)

    // Send push notification to zone members
    sendZoneAnnouncementNotification(docRef.id, title.trim(), message.trim(), zoneId).catch(err => {
    })

    return { success: true, id: docRef.id }
  } catch (error) {
 console.error('Error sending message:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send message' }
  }
}

// Send push notification for zone announcement
async function sendZoneAnnouncementNotification(
  messageId: string,
  title: string,
  message: string,
  zoneId?: string
): Promise<void> {
  try {
    // Send to all members globally
    const membersRef = collection(db, 'zone_members')

    // Get ALL zone members globally
    const membersQuery = query(membersRef)

    const snapshot = await getDocs(membersQuery)

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

    // Send in batches of 100
    const batchSize = 100
    for (let i = 0; i < recipientIds.length; i += batchSize) {
      const batch = recipientIds.slice(i, i + batchSize)
      await authedFetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'zone',
          recipientIds: batch,
          title: ` ${title}`,
          body: message.length > 100 ? message.substring(0, 100) + '...' : message,
          data: { messageId, zoneId: zoneId || '' }
        })
      })
    }

  } catch (error) {
 console.error('[Notifications] Error sending zone announcement:', error)
  }
}

export async function getAllMessages(zoneId?: string, forceRefresh = false): Promise<AdminMessage[]> {
  try {
    const cacheKey = getCacheKey(zoneId)

    if (!forceRefresh) {
      const cached = messagesCache.get(cacheKey)
      if (isCacheValid(cached)) {
        return cached!.data
      }
    }

    const collectionName = getMessagesCollectionName(zoneId)
    const messagesRef = collection(db, collectionName)

    const q = query(messagesRef, orderBy('createdAt', 'desc'))

    const snapshot = await getDocs(q)

    const messages = snapshot.docs.map((docSnap) => {
      const data = docSnap.data()
      return {
        ...data,
        id: docSnap.id,
        sentAt: data.sentAt || new Date().toISOString(),
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
      }
    }) as AdminMessage[]

    messagesCache.set(cacheKey, { data: messages, timestamp: Date.now() })

    return messages
  } catch (error) {
 console.error('Error getting messages:', error)
    return []
  }
}

export async function deleteMessage(
  messageId: string,
  zoneId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const collectionName = getMessagesCollectionName(zoneId)
    const messageRef = doc(db, collectionName, messageId)
    await deleteDoc(messageRef)
    invalidateCache(zoneId)

    return { success: true }
  } catch (error) {
 console.error('Error deleting message:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete message' }
  }
}
