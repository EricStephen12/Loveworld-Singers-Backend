import { db, FieldValue } from './firebase-admin'
import { isHQGroup } from '@/config/zones'

const SONGS_COLLECTION = 'songs'
const SUBMITTED_SONGS_COLLECTION = 'submitted_songs'
const SONG_NOTIFICATIONS_COLLECTION = 'notifications'

export interface ConversationMessage {
  id: string
  sender: 'admin' | 'user'
  senderName: string
  message: string
  timestamp: string
}

export interface SongSubmission {
  id?: string
  title: string
  lyrics: string
  writer: string
  category: string
  key: string
  tempo: string
  leadSinger: string
  conductor: string
  leadKeyboardist: string
  leadGuitarist: string
  drummer: string
  solfas: string
  notes: string
  audioUrl?: string
  status: 'pending' | 'approved' | 'rejected'
  adminSeen?: boolean
  replyMessage?: string // Legacy - kept for backward compatibility
  userReply?: string // Legacy - kept for backward compatibility
  conversation?: ConversationMessage[] // New chat-like conversation
  zoneId: string
  zoneName?: string
  submittedBy: {
    userId: string
    userName: string
    email: string
    submittedAt: string
  }
  reviewedBy?: {
    userId: string
    userName: string
    reviewedAt: string
  }
  reviewNotes?: string
  createdAt: string
  updatedAt: string
}

export interface SongNotification {
  id?: string
  songId: string
  songTitle: string
  submittedBy: string
  submittedByEmail: string
  type: 'new_submission' | 'approved' | 'rejected' | 'seen' | 'replied'
  message: string
  read: boolean
  createdAt: string
  timestamp: any
  // Unified notification fields
  target_audience?: string
  target_user_id?: string
  target_zones?: string[]
  target_group?: string
  category?: string
  priority?: string
  title?: string
  action_url?: string
  created_at?: string
}

export async function submitSong(songData: Omit<SongSubmission, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const submissionData: Omit<SongSubmission, 'id'> = {
      ...songData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const docRef = await db.collection(SUBMITTED_SONGS_COLLECTION).add({
      ...submissionData,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    })

    await createSubmissionNotification(docRef.id, songData.title, songData.submittedBy, songData.zoneId, songData.zoneName)

    return { success: true, id: docRef.id }
  } catch (error) {
 console.error('Error submitting song:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to submit song' }
  }
}

async function createSubmissionNotification(
  songId: string,
  songTitle: string,
  submittedBy: SongSubmission['submittedBy'],
  zoneId?: string,
  zoneName?: string
): Promise<void> {
  try {
    const notificationData = {
      target_audience: 'all',
      category: 'song',
      priority: 'medium',
      title: 'New Song Submission',
      songId,
      songTitle,
      submittedBy: submittedBy.userName,
      submittedByEmail: submittedBy.email,
      type: 'info',
      message: `New song "${songTitle}" submitted by ${submittedBy.userName}${zoneName ? ` from ${zoneName}` : ''}`,
      read: false,
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      timestamp: FieldValue.serverTimestamp(),
      zoneId: zoneId || 'unknown',
      zoneName: zoneName || 'Unknown Zone'
    }

    await db.collection(SONG_NOTIFICATIONS_COLLECTION).add(notificationData)

    // Trigger FCM push notification for admins (HQ members)
    try {
      const hqSnapshot = await db.collection('hq_members').limit(100).get()
      const adminIds = hqSnapshot.docs.map(doc => doc.data().userId).filter(Boolean)

      if (adminIds.length > 0) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        await fetch(`${baseUrl}/api/send-notification`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-internal-api-key': process.env.LWSRH_INTERNAL_API_KEY || ''
          },
          body: JSON.stringify({
            type: 'song',
            recipientIds: adminIds,
            title: ' New Song Submission',
            body: `New song "${songTitle}" submitted by ${submittedBy.userName}${zoneName ? ` from ${zoneName}` : ''}`,
            data: { songId, songTitle, type: 'new_submission' }
          })
        })
      }
    } catch (fcmError) {
 console.error('Error sending admin song notification:', fcmError)
    }
  } catch (error) {
 console.error('Error creating notification:', error)
  }
}

export async function getAllSubmittedSongs(zoneId?: string, isHQGroup?: boolean): Promise<SongSubmission[]> {
  try {
    const snapshot = await db.collection(SUBMITTED_SONGS_COLLECTION).get()
    const { BOSS_ZONE_ID, HQ_GROUP_IDS } = await import('@/config/zones')

    const allSubmissions = snapshot.docs.map((docSnap) => {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        ...data,
        adminSeen: data.adminSeen || false,
        zoneId: data.zoneId || 'unknown',
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
      } as SongSubmission
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    if (!zoneId) return []

    if (zoneId === BOSS_ZONE_ID) {
      return allSubmissions
    }

    if (isHQGroup) {
      const hqZoneIds = [...HQ_GROUP_IDS, BOSS_ZONE_ID]
      return allSubmissions.filter(sub => hqZoneIds.includes(sub.zoneId))
    }

    return allSubmissions.filter(sub => sub.zoneId === zoneId)

  } catch (error) {
 console.error('Error getting submitted songs:', error)
    return []
  }
}

export async function getPendingSongs(zoneId?: string, isHQGroup?: boolean): Promise<SongSubmission[]> {
  try {
    const allSubmitted = await getAllSubmittedSongs(zoneId, isHQGroup)
    return allSubmitted.filter(s => s.status === 'pending')
  } catch (error) {
 console.error('Error getting pending songs:', error)
    return []
  }
}

export async function approveSong(
  submissionId: string,
  reviewerId: string,
  reviewerName: string,
  reviewNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const submissionRef = db.collection(SUBMITTED_SONGS_COLLECTION).doc(submissionId)
    const submissionDoc = await submissionRef.get()

    if (!submissionDoc.exists) throw new Error('Submission not found')

    const submissionData = submissionDoc.data() as SongSubmission

    const isHQ = submissionData.zoneId && isHQGroup(submissionData.zoneId)
    const targetCollection = isHQ ? 'praise_night_songs' : 'zone_songs'

    const songData = {
      title: submissionData.title,
      lyrics: submissionData.lyrics,
      writer: submissionData.writer,
      category: submissionData.category || 'Other',
      key: submissionData.key || '',
      tempo: submissionData.tempo || '',
      leadSinger: submissionData.leadSinger || '',
      conductor: submissionData.conductor || '',
      leadKeyboardist: submissionData.leadKeyboardist || '',
      leadGuitarist: submissionData.leadGuitarist || '',
      drummer: submissionData.drummer || '',
      solfas: submissionData.solfas || '',
      audioUrl: submissionData.audioUrl || '',
      status: 'unheard',
      rehearsalCount: 0,
      zoneId: submissionData.zoneId || '',
      praiseNightId: '', 
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }

    await db.collection(targetCollection).add(songData)

    await submissionRef.update({
      status: 'approved',
      reviewedBy: { userId: reviewerId, userName: reviewerName, reviewedAt: new Date().toISOString() },
      reviewNotes: reviewNotes || '',
      updatedAt: FieldValue.serverTimestamp(),
      isUpdated: false,
      hasNewUserReply: false
    })

    await createStatusNotification(submissionId, submissionData.title, submissionData.submittedBy, 'approved')

    return { success: true }
  } catch (error) {
 console.error('Error approving song:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to approve song' }
  }
}

export async function rejectSong(
  submissionId: string,
  reviewerId: string,
  reviewerName: string,
  reviewNotes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const submissionRef = db.collection(SUBMITTED_SONGS_COLLECTION).doc(submissionId)

    await submissionRef.update({
      status: 'rejected',
      reviewedBy: { userId: reviewerId, userName: reviewerName, reviewedAt: new Date().toISOString() },
      reviewNotes: reviewNotes,
      updatedAt: FieldValue.serverTimestamp(),
      isUpdated: false,
      hasNewUserReply: false
    })

    const submissionDoc = await submissionRef.get()
    const submissionData = submissionDoc.data() as SongSubmission | undefined

    if (submissionData) {
      await createStatusNotification(submissionId, submissionData.title, submissionData.submittedBy, 'rejected')
    }

    return { success: true }
  } catch (error) {
 console.error('Error rejecting song:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to reject song' }
  }
}

async function createStatusNotification(
  songId: string,
  songTitle: string,
  submittedBy: SongSubmission['submittedBy'],
  status: 'approved' | 'rejected' | 'seen' | 'replied',
  customMessage?: string
): Promise<void> {
  try {
    const notificationData: Omit<SongNotification, 'id'> = {
      target_audience: 'individual',
      target_user_id: submittedBy.userId,
      category: 'song',
      priority: status === 'rejected' ? 'medium' : 'high',
      title: status === 'approved' ? 'Song Approved!' : status === 'rejected' ? 'Song Feedback' : 'Song Update',
      songId,
      songTitle,
      submittedBy: submittedBy.userName,
      submittedByEmail: submittedBy.email,
      type: status,
      message: customMessage || `Your song "${songTitle}" has been ${status}`,
      read: false,
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      timestamp: FieldValue.serverTimestamp()
    }

    await db.collection(SONG_NOTIFICATIONS_COLLECTION).add(notificationData)

    if (status !== 'seen' && submittedBy.userId) {
      const title = status === 'approved'
        ? ' Song Approved!'
        : status === 'rejected'
          ? ' Song Feedback'
          : ' Song Reply'

      const body = customMessage || `Your song "${songTitle}" has been ${status}`

      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        await fetch(`${baseUrl}/api/send-notification`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-internal-api-key': process.env.LWSRH_INTERNAL_API_KEY || ''
          },
          body: JSON.stringify({
            type: 'song',
            recipientIds: [submittedBy.userId],
            title,
            body,
            data: { songId, songTitle, status }
          })
        })
      } catch (pushError) {
      }
    }
  } catch (error) {
 console.error('Error creating status notification:', error)
  }
}

export async function getUnreadNotifications(zoneId?: string, isHQGroup?: boolean): Promise<SongNotification[]> {
  try {
    const snapshot = await db.collection(SONG_NOTIFICATIONS_COLLECTION)
      .where('read', '==', false)
      .where('type', '==', 'new_submission')
      .orderBy('timestamp', 'desc')
      .get()

    let notifications = snapshot.docs.map((docSnap) => {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        ...data,
        zoneId: data.zoneId || 'unknown',
        createdAt: data.createdAt || data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as SongNotification & { zoneId?: string }
    })

    if (zoneId && !isHQGroup) {
      notifications = notifications.filter(n => (n as any).zoneId === zoneId)
    }

    return notifications
  } catch (error) {
 console.error('Error getting notifications:', error)
    return []
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await db.collection(SONG_NOTIFICATIONS_COLLECTION).doc(notificationId).update({ read: true })
  } catch (error) {
 console.error('Error marking notification as read:', error)
  }
}

export async function markSubmissionSeen(submissionId: string, adminName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const submissionRef = db.collection(SUBMITTED_SONGS_COLLECTION).doc(submissionId)
    const submissionDoc = await submissionRef.get()
    if (!submissionDoc.exists) throw new Error('Submission not found')

    const submissionData = submissionDoc.data() as SongSubmission

    await submissionRef.update({ adminSeen: true, updatedAt: FieldValue.serverTimestamp() })
    await createStatusNotification(submissionId, submissionData.title, submissionData.submittedBy, 'seen', `${adminName} has seen your submission`)

    return { success: true }
  } catch (error) {
 console.error('Error marking seen:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to mark seen' }
  }
}

export async function replyToSubmission(submissionId: string, adminName: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    const submissionRef = db.collection(SUBMITTED_SONGS_COLLECTION).doc(submissionId)
    const submissionDoc = await submissionRef.get()
    if (!submissionDoc.exists) throw new Error('Submission not found')

    const submissionData = submissionDoc.data() as SongSubmission

    const newMessage: ConversationMessage = {
      id: `msg-${Date.now()}`,
      sender: 'admin',
      senderName: adminName,
      message: message,
      timestamp: new Date().toISOString()
    }

    const existingConversation = submissionData.conversation || []
    const updatedConversation = [...existingConversation, newMessage]

    await submissionRef.update({
      replyMessage: message, 
      conversation: updatedConversation,
      updatedAt: FieldValue.serverTimestamp(),
      isUpdated: false,
      hasNewUserReply: false,
      lastUpdatedBy: 'admin'
    })
    await createStatusNotification(submissionId, submissionData.title, submissionData.submittedBy, 'replied', `${adminName} replied: ${message}`)

    return { success: true }
  } catch (error) {
 console.error('Error replying to submission:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to reply' }
  }
}

export async function getUserSubmissions(userId: string): Promise<SongSubmission[]> {
  try {
    const snapshot = await db.collection(SUBMITTED_SONGS_COLLECTION)
      .where('submittedBy.userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get()

    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        ...data,
        zoneId: data.zoneId || 'unknown',
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
      } as SongSubmission
    })
  } catch (error) {
 console.error('Error getting user submissions:', error)
    return []
  }
}

export async function getUserSubmissionsByEmail(userEmail: string): Promise<SongSubmission[]> {
  try {
    if (!userEmail) return []
    const { BOSS_ZONE_ID } = await import('@/config/zones')
    const allSubmissions = await getAllSubmittedSongs(BOSS_ZONE_ID, true)
    const lower = userEmail.toLowerCase()
    return allSubmissions.filter((sub) => (sub.submittedBy?.email || '').toLowerCase() === lower)
  } catch (error) {
 console.error('Error getting user submissions by email:', error)
    return []
  }
}

export async function getUserSongNotifications(userEmail: string): Promise<SongNotification[]> {
  try {
    const snapshot = await db.collection(SONG_NOTIFICATIONS_COLLECTION)
        .where('submittedByEmail', '==', userEmail)
        .get()

    const notifications = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data()
          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt || data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
          } as SongNotification
        })
        .filter(n => ['approved', 'rejected', 'replied'].includes(n.type))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return notifications
  } catch (error) {
 console.error('Error getting user notifications:', error)
    return []
  }
}

export async function deleteUserSubmission(submissionId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const submissionRef = db.collection(SUBMITTED_SONGS_COLLECTION).doc(submissionId)
    const submissionDoc = await submissionRef.get()

    if (!submissionDoc.exists) return { success: false, error: 'Submission not found' }

    const submissionData = submissionDoc.data() as SongSubmission

    if (submissionData.submittedBy.userId !== userId) {
      return { success: false, error: 'You can only delete your own submissions' }
    }

    if (submissionData.status !== 'pending') {
      return { success: false, error: 'Can only delete pending submissions' }
    }

    await submissionRef.delete()
    return { success: true }
  } catch (error) {
 console.error('Error deleting submission:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete submission' }
  }
}

export async function deleteSubmissionAsAdmin(submissionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db.collection(SUBMITTED_SONGS_COLLECTION).doc(submissionId).delete()
    return { success: true }
  } catch (error) {
 console.error('Error deleting submission:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete submission' }
  }
}

export async function updateUserSubmission(
  submissionId: string,
  userId: string,
  updates: Partial<Pick<SongSubmission, 'title' | 'lyrics' | 'writer' | 'key' | 'leadSinger' | 'notes' | 'audioUrl'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const submissionRef = db.collection(SUBMITTED_SONGS_COLLECTION).doc(submissionId)
    const submissionDoc = await submissionRef.get()

    if (!submissionDoc.exists) {
      return { success: false, error: 'Submission not found' }
    }

    const submissionData = submissionDoc.data() as SongSubmission

    if (submissionData.submittedBy.userId !== userId) {
      return { success: false, error: 'You can only edit your own submissions' }
    }

    if (submissionData.status === 'rejected') {
      return { success: false, error: 'Cannot edit rejected submissions' }
    }

    await submissionRef.set({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
      isUpdated: true, 
      lastUpdatedBy: 'user'
    }, { merge: true })

    return { success: true }
  } catch (error) {
 console.error('Error updating submission:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update submission' }
  }
}

export async function userReplyToSubmission(
  submissionId: string,
  userId: string,
  message: string,
  userName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const submissionRef = db.collection(SUBMITTED_SONGS_COLLECTION).doc(submissionId)
    const submissionDoc = await submissionRef.get()

    if (!submissionDoc.exists) {
      return { success: false, error: 'Submission not found' }
    }

    const submissionData = submissionDoc.data() as SongSubmission

    if (submissionData.submittedBy.userId !== userId) {
      return { success: false, error: 'You can only reply to your own submissions' }
    }

    const newMessage: ConversationMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      senderName: userName || submissionData.submittedBy.userName || 'User',
      message: message,
      timestamp: new Date().toISOString()
    }

    const existingConversation = submissionData.conversation || []
    const updatedConversation = [...existingConversation, newMessage]

    const existingUserReply = submissionData.userReply || ''
    const newLegacyReply = existingUserReply
      ? `${existingUserReply}\n---\n${new Date().toLocaleString()}: ${message}`
      : `${new Date().toLocaleString()}: ${message}`

    await submissionRef.update({
      userReply: newLegacyReply,
      conversation: updatedConversation,
      updatedAt: FieldValue.serverTimestamp(),
      hasNewUserReply: true,
      lastUpdatedBy: 'user'
    })

    await createStatusNotification(
      submissionId,
      submissionData.title,
      submissionData.submittedBy,
      'replied',
      `User replied: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`
    )

    return { success: true }
  } catch (error) {
 console.error('Error sending user reply:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send reply' }
  }
}

export async function markSubmissionAsSeen(submissionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const submissionRef = db.collection(SUBMITTED_SONGS_COLLECTION).doc(submissionId)

    await submissionRef.update({
      isUpdated: false,
      hasNewUserReply: false,
      lastSeenByAdmin: FieldValue.serverTimestamp()
    })

    return { success: true }
  } catch (error) {
 console.error('Error marking submission as seen:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to mark as seen' }
  }
}
