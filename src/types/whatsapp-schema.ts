/**
 * WhatsApp-Style Database Schema
 * Optimized Firestore structure for real-time chat
 */

export interface WhatsAppMessage {
  id: string
  chatId: string
  senderId: string
  senderName: string
  senderAvatar?: string
  
  // Message content
  text?: string
  image?: string
  video?: string
  audio?: string
  document?: string
  location?: {
    latitude: number
    longitude: number
    address?: string
  }
  
  // Message metadata
  messageType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'system'
  timestamp: Date
  
  // WhatsApp-style status tracking
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  statusTimestamps: {
    sent?: Date
    delivered?: Date
    read?: Date
  }
  
  // Read receipts (for group chats)
  readBy: { [userId: string]: Date }
  
  // Message features
  edited: boolean
  editedAt?: Date
  deleted: boolean
  deletedAt?: Date
  
  // Reactions (WhatsApp-style)
  reactions: Array<{
    userId: string
    userName: string
    emoji: string
    timestamp: Date
  }>
  
  // Reply/Forward
  replyTo?: {
    messageId: string
    senderName: string
    snippet: string
    messageType: string
  }
  
  forwardedFrom?: {
    originalSender: string
    forwardCount: number
  }
  
  // Media metadata
  mediaMetadata?: {
    fileName?: string
    fileSize?: number
    mimeType?: string
    duration?: number // for audio/video
    dimensions?: { width: number; height: number } // for images/video
    thumbnail?: string // for video
  }
}

export interface WhatsAppChat {
  id: string
  type: 'direct' | 'group' | 'broadcast'
  
  // Participants
  participants: string[] // User IDs
  participantNames: { [userId: string]: string }
  participantAvatars: { [userId: string]: string }
  
  // Group-specific
  name?: string // Group name
  description?: string
  avatar?: string
  admins: string[] // Group admins
  createdBy: string
  
  // Chat metadata
  createdAt: Date
  updatedAt: Date
  
  // Last message (for chat list)
  lastMessage?: {
    text: string
    senderId: string
    senderName: string
    timestamp: Date
    messageType: string
  }
  
  // User-specific settings
  unreadCount: { [userId: string]: number }
  pinned: { [userId: string]: boolean }
  muted: { [userId: string]: boolean | Date } // true = forever, Date = until
  archived: { [userId: string]: boolean }
  
  // Group settings
  settings?: {
    whoCanAddMembers: 'admins' | 'all'
    whoCanEditGroupInfo: 'admins' | 'all'
    whoCanSendMessages: 'admins' | 'all'
    disappearingMessages: boolean
    disappearingMessagesDuration?: number // in seconds
  }
  
  // Status
  isActive: boolean
}

export interface WhatsAppUser {
  id: string
  email: string
  fullName: string
  firstName?: string
  lastName?: string
  profilePic?: string
  
  // Zone/Organization info (LWSRH specific)
  zoneId?: string
  zoneName?: string
  role?: string
  
  // Privacy settings
  privacy: {
    lastSeen: 'everyone' | 'contacts' | 'nobody'
    profilePhoto: 'everyone' | 'contacts' | 'nobody'
    about: 'everyone' | 'contacts' | 'nobody'
    readReceipts: boolean
  }
  
  // Status
  about?: string // WhatsApp status/bio
  isOnline: boolean
  lastSeen: Date
  
  // Blocked users
  blockedUsers: string[]
}

export interface WhatsAppPresence {
  userId: string
  status: 'online' | 'offline' | 'typing' | 'recording'
  lastSeen: Date
  chatId?: string // for typing/recording status
}

export interface WhatsAppContact {
  id: string
  userId: string
  contactUserId: string
  contactName: string // Custom name for this contact
  addedAt: Date
  isBlocked: boolean
}

export interface WhatsAppBroadcastList {
  id: string
  name: string
  createdBy: string
  recipients: string[]
  createdAt: Date
  lastMessageAt?: Date
}

// Firestore Collections Structure:
export const WHATSAPP_COLLECTIONS = {
  // Main collections
  USERS: 'whatsapp_users',
  CHATS: 'whatsapp_chats', 
  MESSAGES: 'whatsapp_messages',
  
  // Real-time collections (Realtime Database)
  PRESENCE: 'whatsapp_presence',
  TYPING: 'whatsapp_typing',
  
  // Secondary collections
  CONTACTS: 'whatsapp_contacts',
  BROADCASTS: 'whatsapp_broadcasts',
  STARRED_MESSAGES: 'whatsapp_starred_messages',
  
  // Media collections
  MEDIA_UPLOADS: 'whatsapp_media_uploads'
} as const

// Indexes needed for optimal performance:
export const REQUIRED_FIRESTORE_INDEXES = [
  // Messages by chat, ordered by timestamp
  {
    collection: 'whatsapp_messages',
    fields: [
      { field: 'chatId', order: 'ASCENDING' },
      { field: 'timestamp', order: 'DESCENDING' }
    ]
  },
  
  // Chats by participant, ordered by last message
  {
    collection: 'whatsapp_chats',
    fields: [
      { field: 'participants', order: 'ASCENDING' },
      { field: 'lastMessage.timestamp', order: 'DESCENDING' }
    ]
  },
  
  // Messages by status for delivery tracking
  {
    collection: 'whatsapp_messages',
    fields: [
      { field: 'chatId', order: 'ASCENDING' },
      { field: 'status', order: 'ASCENDING' },
      { field: 'timestamp', order: 'DESCENDING' }
    ]
  }
]