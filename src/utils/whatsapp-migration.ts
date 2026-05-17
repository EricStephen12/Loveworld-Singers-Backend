/**
 * WhatsApp Migration Utility
 * Migrates existing chat data to WhatsApp-style schema
 */

import { 
  collection, 
  doc, 
  getDocs, 
  writeBatch, 
  query, 
  where,
  orderBy,
  limit
} from 'firebase/firestore'
import { db } from '@/lib/firebase-setup'
import { 
  WhatsAppChat, 
  WhatsAppMessage, 
  WhatsAppUser,
  WHATSAPP_COLLECTIONS 
} from '@/types/whatsapp-schema'
import { Chat, ChatMessage, ChatUser } from '@/types/chat'
import { MigrationPermissionCheck } from './migration-permission-check'

// Utility function to remove undefined values from objects
const cleanUndefinedValues = (obj: any): any => {
  const cleaned: any = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
        cleaned[key] = cleanUndefinedValues(value)
      } else {
        cleaned[key] = value
      }
    }
  }
  return cleaned
}

export class WhatsAppMigration {
  
  /**
   * Migrate existing chats to WhatsApp schema
   */
  static async migrateChats(): Promise<void> {
    
    try {
      // Get all existing chats
      const chatsSnapshot = await getDocs(collection(db, 'chats'))
      const batch = writeBatch(db)
      let migratedCount = 0
      
      for (const chatDoc of chatsSnapshot.docs) {
        const oldChat = { id: chatDoc.id, ...chatDoc.data() } as Chat
        
        // Convert to WhatsApp schema - filter out undefined values
        const whatsappChat: any = {
          id: oldChat.id,
          type: oldChat.type,
          participants: oldChat.participants || [],
          participantNames: oldChat.participantNames || {},
          participantAvatars: {},
          admins: oldChat.admins || [],
          createdBy: oldChat.createdBy,
          createdAt: oldChat.createdAt || new Date(),
          updatedAt: new Date(),
          unreadCount: oldChat.unreadCount || {},
          pinned: oldChat.pinned || {},
          muted: {},
          archived: {},
          isActive: oldChat.isActive !== false, // Default to true
          settings: {
            whoCanAddMembers: 'all',
            whoCanEditGroupInfo: 'admins',
            whoCanSendMessages: 'all',
            disappearingMessages: false
          }
        }
        
        // Only add optional fields if they have values
        if (oldChat.name) whatsappChat.name = oldChat.name
        if (oldChat.description) whatsappChat.description = oldChat.description
        if (oldChat.avatar) whatsappChat.avatar = oldChat.avatar
        if (oldChat.lastMessage) {
          whatsappChat.lastMessage = {
            ...oldChat.lastMessage,
            messageType: 'text'
          }
        }
        
        // Write to new collection
        const newChatRef = doc(db, WHATSAPP_COLLECTIONS.CHATS, oldChat.id)
        batch.set(newChatRef, whatsappChat)
        migratedCount++
      }
      
      await batch.commit()
      
    } catch (error) {
 console.error(' Chat migration failed:', error)
      throw error
    }
  }
  
  /**
   * Migrate existing messages to WhatsApp schema
   */
  static async migrateMessages(): Promise<void> {
    
    try {
      // Get all existing messages (in batches to avoid memory issues)
      const messagesRef = collection(db, 'messages')
      const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1000))
      const messagesSnapshot = await getDocs(messagesQuery)
      
      const batch = writeBatch(db)
      let migratedCount = 0
      
      for (const messageDoc of messagesSnapshot.docs) {
        const oldMessage = { id: messageDoc.id, ...messageDoc.data() } as ChatMessage
        
        // Convert to WhatsApp schema - filter out undefined values
        const whatsappMessage: any = {
          id: oldMessage.id,
          chatId: oldMessage.chatId,
          senderId: oldMessage.senderId,
          senderName: oldMessage.senderName || 'Unknown User',
          messageType: oldMessage.messageType === 'file' ? 'document' : (oldMessage.messageType || 'text'),
          timestamp: oldMessage.timestamp || new Date(),
          status: 'delivered', // Default status for existing messages
          statusTimestamps: {
            sent: oldMessage.timestamp || new Date(),
            delivered: oldMessage.timestamp || new Date()
          },
          readBy: {},
          edited: oldMessage.edited || false,
          deleted: oldMessage.deleted || false,
          reactions: oldMessage.reactions || []
        }
        
        // Only add optional fields if they have values
        if (oldMessage.senderAvatar) whatsappMessage.senderAvatar = oldMessage.senderAvatar
        if (oldMessage.text) whatsappMessage.text = oldMessage.text
        if (oldMessage.image) whatsappMessage.image = oldMessage.image
        if (oldMessage.editedAt) whatsappMessage.editedAt = oldMessage.editedAt
        
        if (oldMessage.replyTo) {
          whatsappMessage.replyTo = {
            messageId: oldMessage.replyTo,
            senderName: oldMessage.replySenderName || 'Unknown',
            snippet: oldMessage.replySnippet || 'Message',
            messageType: 'text'
          }
        }
        
        if (oldMessage.fileName) {
          whatsappMessage.mediaMetadata = {
            fileName: oldMessage.fileName,
            fileSize: 0,
            mimeType: 'application/octet-stream'
          }
        }
        
        // Write to new collection
        const newMessageRef = doc(db, WHATSAPP_COLLECTIONS.MESSAGES, oldMessage.id)
        batch.set(newMessageRef, whatsappMessage)
        migratedCount++
      }
      
      await batch.commit()
      
    } catch (error) {
 console.error(' Message migration failed:', error)
      throw error
    }
  }
  
  /**
   * Migrate existing users to WhatsApp schema
   */
  static async migrateUsers(): Promise<void> {
    
    try {
      // Get all existing chat users
      const usersSnapshot = await getDocs(collection(db, 'chat_users'))
      const batch = writeBatch(db)
      let migratedCount = 0
      
      for (const userDoc of usersSnapshot.docs) {
        const oldUser = { id: userDoc.id, ...userDoc.data() } as ChatUser
        
        // Convert to WhatsApp schema - filter out undefined values
        const whatsappUser: any = {
          id: oldUser.id,
          email: oldUser.email || '',
          fullName: oldUser.fullName || 'Unknown User',
          privacy: {
            lastSeen: 'everyone',
            profilePhoto: 'everyone',
            about: 'everyone',
            readReceipts: true
          },
          about: 'Hey there! I am using LWSRH Chat.',
          isOnline: oldUser.isOnline || false,
          lastSeen: oldUser.lastSeen || new Date(),
          blockedUsers: []
        }
        
        // Only add optional fields if they have values
        if (oldUser.firstName) whatsappUser.firstName = oldUser.firstName
        if (oldUser.lastName) whatsappUser.lastName = oldUser.lastName
        if (oldUser.profilePic) whatsappUser.profilePic = oldUser.profilePic
        if (oldUser.zoneId) whatsappUser.zoneId = oldUser.zoneId
        if (oldUser.zoneName) whatsappUser.zoneName = oldUser.zoneName
        
        // Write to new collection
        const newUserRef = doc(db, WHATSAPP_COLLECTIONS.USERS, oldUser.id)
        batch.set(newUserRef, whatsappUser)
        migratedCount++
      }
      
      await batch.commit()
      
    } catch (error) {
 console.error(' User migration failed:', error)
      throw error
    }
  }
  
  /**
   * Run complete migration
   */
  static async runFullMigration(): Promise<void> {
    try {
      // Backend version: In a real backend, this would come from a secure token
      // For now we use 'admin' as a placeholder or try to extract from passed context
      const userId = 'admin'; 
      
      // Check permissions first
      const hasPermissions = await MigrationPermissionCheck.quickCheck(userId)
      
      if (!hasPermissions) {
        throw new Error(' Insufficient permissions for migration. Please check Firestore rules.')
      }
      
      await this.migrateUsers()
      await this.migrateChats()
      await this.migrateMessages()
      
    } catch (error) {
      console.error(' Full migration failed:', error)
      throw error
    }
  }
  
  /**
   * Cleanup old collections (use with caution!)
   */
  static async cleanupOldCollections(): Promise<void> {
    
    // This is intentionally not implemented for safety
    // You should manually verify the migration before cleaning up
  }
}

/**
 * Quick migration starter for console - Backend version (manual trigger)
 */
export const startMigration = async () => {
  try {
    await WhatsAppMigration.runFullMigration()
  } catch (error) {
 console.error(' Migration failed:', error)
  }
}
