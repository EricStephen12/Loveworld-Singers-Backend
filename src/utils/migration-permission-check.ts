/**
 * Migration Permission Checker
 * Verifies user has proper permissions before running migration
 */

import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase-setup'

export class MigrationPermissionCheck {
  
  /**
   * Test if user can write to WhatsApp collections
   */
  static async checkPermissions(userId: string): Promise<{
    canWriteUsers: boolean
    canWriteChats: boolean  
    canWriteMessages: boolean
    errors: string[]
  }> {
    const results = {
      canWriteUsers: false,
      canWriteChats: false,
      canWriteMessages: false,
      errors: [] as string[]
    }
    
    
    // Test WhatsApp Users collection
    try {
      const testUserRef = doc(db, 'whatsapp_users', `test_${userId}`)
      await setDoc(testUserRef, {
        id: `test_${userId}`,
        email: 'test@example.com',
        fullName: 'Test User',
        privacy: {
          lastSeen: 'everyone',
          profilePhoto: 'everyone',
          about: 'everyone',
          readReceipts: true
        },
        about: 'Test migration user',
        isOnline: false,
        lastSeen: new Date(),
        blockedUsers: []
      })
      
      // Try to read it back
      const testDoc = await getDoc(testUserRef)
      if (testDoc.exists()) {
        results.canWriteUsers = true
        // Clean up test document
        await deleteDoc(testUserRef)
      }
    } catch (error: any) {
      results.errors.push(`WhatsApp Users: ${error.message}`)
 console.error(' [Migration] WhatsApp Users collection - WRITE FAILED:', error.message)
    }
    
    // Test WhatsApp Chats collection
    try {
      const testChatRef = doc(db, 'whatsapp_chats', `test_${userId}`)
      await setDoc(testChatRef, {
        id: `test_${userId}`,
        type: 'direct',
        participants: [userId, 'test_user'],
        participantNames: {},
        participantAvatars: {},
        admins: [],
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        unreadCount: {},
        pinned: {},
        muted: {},
        archived: {},
        isActive: true,
        settings: {
          whoCanAddMembers: 'all',
          whoCanEditGroupInfo: 'admins',
          whoCanSendMessages: 'all',
          disappearingMessages: false
        }
      })
      
      const testDoc = await getDoc(testChatRef)
      if (testDoc.exists()) {
        results.canWriteChats = true
        await deleteDoc(testChatRef)
      }
    } catch (error: any) {
      results.errors.push(`WhatsApp Chats: ${error.message}`)
 console.error(' [Migration] WhatsApp Chats collection - WRITE FAILED:', error.message)
    }
    
    // Test WhatsApp Messages collection
    try {
      const testMessageRef = doc(db, 'whatsapp_messages', `test_${userId}`)
      await setDoc(testMessageRef, {
        id: `test_${userId}`,
        chatId: `test_${userId}`,
        senderId: userId,
        senderName: 'Test User',
        text: 'Test migration message',
        messageType: 'text',
        timestamp: new Date(),
        status: 'sent',
        statusTimestamps: {
          sent: new Date()
        },
        readBy: {},
        edited: false,
        deleted: false,
        reactions: []
      })
      
      const testDoc = await getDoc(testMessageRef)
      if (testDoc.exists()) {
        results.canWriteMessages = true
        await deleteDoc(testMessageRef)
      }
    } catch (error: any) {
      results.errors.push(`WhatsApp Messages: ${error.message}`)
 console.error(' [Migration] WhatsApp Messages collection - WRITE FAILED:', error.message)
    }
    
    const allPermissionsOk = results.canWriteUsers && results.canWriteChats && results.canWriteMessages
    
    if (allPermissionsOk) {
    } else {
 console.error(' [Migration] Permission check failed:', results.errors)
    }
    
    return results
  }
  
  static async quickCheck(userId: string): Promise<boolean> {
    const results = await this.checkPermissions(userId)
    
    if (results.canWriteUsers && results.canWriteChats && results.canWriteMessages) {
      return true
    }
    
 console.error(' [Migration] Permission Issues Found:')
 results.errors.forEach(error => console.error(` • ${error}`))
 console.error('')
 console.error(' [Migration] To fix permissions:')
 console.error(' 1. Make sure you are logged in')
 console.error(' 2. Deploy the updated Firestore rules')
 console.error(' 3. Wait a few minutes for rules to propagate')
 console.error(' 4. Try the migration again')
    
    return false
  }
}
