// Message Interaction Service for Reply, Like, Share, Forward
export interface MessageInteraction {
  id: string
  messageId: string
  userId: string
  type: 'like' | 'reply' | 'share' | 'forward'
  data?: any
  timestamp: string
}

export interface MessageReaction {
  messageId: string
  likes: string[] // Array of user IDs who liked
  shares: string[] // Array of user IDs who shared
  forwards: string[] // Array of user IDs who forwarded
  replies: MessageReply[] // Array of replies
}

export interface MessageReply {
  id: string
  messageId: string
  userId: string
  userName: string
  content: string
  timestamp: string
}

export interface MessageToForward {
  id: string
  content: string
  senderName: string
  timestamp: string
  originalMessageId: string
}

export class MessageInteractionService {
  private static instance: MessageInteractionService

  static getInstance(): MessageInteractionService {
    if (!MessageInteractionService.instance) {
      MessageInteractionService.instance = new MessageInteractionService()
    }
    return MessageInteractionService.instance
  }

  // Like a message
  async likeMessage(messageId: string, userId: string): Promise<boolean> {
    try {
      
      // Get current reactions
      const reactions = await this.getMessageReactions(messageId)
      
      // Toggle like
      const likeIndex = reactions.likes.indexOf(userId)
      if (likeIndex > -1) {
        reactions.likes.splice(likeIndex, 1) // Remove like
      } else {
        reactions.likes.push(userId) // Add like
      }
      
      // Save reactions
      await this.saveMessageReactions(messageId, reactions)
      
      return true
    } catch (error) {
 console.error('Error liking message:', error)
      return false
    }
  }

  // Reply to a message
  async replyToMessage(messageId: string, userId: string, userName: string, content: string): Promise<boolean> {
    try {
      
      const reply: MessageReply = {
        id: Date.now().toString(),
        messageId,
        userId,
        userName,
        content,
        timestamp: new Date().toISOString()
      }
      
      // Get current reactions
      const reactions = await this.getMessageReactions(messageId)
      
      // Add reply
      reactions.replies.push(reply)
      
      // Save reactions
      await this.saveMessageReactions(messageId, reactions)
      
      return true
    } catch (error) {
 console.error('Error replying to message:', error)
      return false
    }
  }

  // Share a message
  async shareMessage(messageId: string, userId: string, targetGroupId?: string, targetFriendId?: string): Promise<boolean> {
    try {
      
      // Get current reactions
      const reactions = await this.getMessageReactions(messageId)
      
      // Add to shares
      if (!reactions.shares.includes(userId)) {
        reactions.shares.push(userId)
      }
      
      // Save reactions
      await this.saveMessageReactions(messageId, reactions)
      
      // Create shared message
      const originalMessage = await this.getOriginalMessage(messageId)
      if (originalMessage) {
        const sharedMessage = {
          id: Date.now().toString(),
          group_id: targetGroupId || `dm_${targetFriendId}`,
          sender_id: userId,
          sender_name: 'Shared Message',
          content: ` Shared: ${originalMessage.content}`,
          timestamp: new Date().toISOString(),
          read: false,
          is_shared: true,
          original_message_id: messageId
        }
        
        // Save shared message
        await this.saveSharedMessage(sharedMessage)
      }
      
      return true
    } catch (error) {
 console.error('Error sharing message:', error)
      return false
    }
  }

  // Forward a message
  async forwardMessage(messageId: string, userId: string, targetGroupId?: string, targetFriendId?: string): Promise<boolean> {
    try {
      
      // Get current reactions
      const reactions = await this.getMessageReactions(messageId)
      
      // Add to forwards
      if (!reactions.forwards.includes(userId)) {
        reactions.forwards.push(userId)
      }
      
      // Save reactions
      await this.saveMessageReactions(messageId, reactions)
      
      // Create forwarded message
      const originalMessage = await this.getOriginalMessage(messageId)
      if (originalMessage) {
        const forwardedMessage = {
          id: Date.now().toString(),
          group_id: targetGroupId || `dm_${targetFriendId}`,
          sender_id: userId,
          sender_name: 'Forwarded Message',
          content: `↗️ Forwarded: ${originalMessage.content}`,
          timestamp: new Date().toISOString(),
          read: false,
          is_forwarded: true,
          original_message_id: messageId
        }
        
        // Save forwarded message
        await this.saveForwardedMessage(forwardedMessage)
      }
      
      return true
    } catch (error) {
 console.error('Error forwarding message:', error)
      return false
    }
  }

  // Get message reactions
  async getMessageReactions(messageId: string): Promise<MessageReaction> {
    try {
      // In a real app, this would fetch from Firebase
      // For now, return default structure
      return {
        messageId,
        likes: [],
        shares: [],
        forwards: [],
        replies: []
      }
    } catch (error) {
 console.error('Error getting message reactions:', error)
      return {
        messageId,
        likes: [],
        shares: [],
        forwards: [],
        replies: []
      }
    }
  }

  // Save message reactions
  private async saveMessageReactions(messageId: string, reactions: MessageReaction): Promise<void> {
    try {
      // In a real app, this would save to Firebase
    } catch (error) {
 console.error('Error saving message reactions:', error)
    }
  }

  // Get original message
  private async getOriginalMessage(messageId: string): Promise<any> {
    try {
      // In a real app, this would fetch from Firebase
      return {
        id: messageId,
        content: 'Original message content',
        sender_name: 'Original Sender'
      }
    } catch (error) {
 console.error('Error getting original message:', error)
      return null
    }
  }

  // Save shared message
  private async saveSharedMessage(message: any): Promise<void> {
    try {
      // In a real app, this would save to Firebase
    } catch (error) {
 console.error('Error saving shared message:', error)
    }
  }

  // Save forwarded message
  private async saveForwardedMessage(message: any): Promise<void> {
    try {
      // In a real app, this would save to Firebase
    } catch (error) {
 console.error('Error saving forwarded message:', error)
    }
  }

  // Get reaction count
  getReactionCount(reactions: MessageReaction, type: 'likes' | 'shares' | 'forwards' | 'replies'): number {
    return reactions[type].length
  }

    hasUserReacted(reactions: MessageReaction, userId: string, type: 'likes' | 'shares' | 'forwards'): boolean {
    return reactions[type].includes(userId)
  }

  // Format reaction text
  formatReactionText(count: number, type: string): string {
    if (count === 0) return ''
    if (count === 1) return `1 ${type}`
    return `${count} ${type}s`
  }
}







