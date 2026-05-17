import { supabase } from './supabase-client';

export interface SupportMessage {
  id: string;
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
  category: 'general' | 'technical' | 'billing' | 'feature' | 'bug' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  adminResponse?: string;
  adminRespondedAt?: string;
}

export class SupabaseSupport {
  // Get all support messages (for admin)
  static async getMessages(): Promise<SupportMessage[]> {
    try {

            const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError) {
 console.error(' Admin auth error:', authError);
        return [];
      }

      if (!user) {
 console.error(' Admin: No authenticated user');
        return [];
      }


      // Try multiple approaches to get messages
      let { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
 console.error('Approach 1 error:', error);

        // Fallback: Get user's own messages (this should work with RLS)
        const result = await supabase
          .from('support_messages')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        data = result.data;
        error = result.error;

        if (error) {
 console.error(' Admin: Both approaches failed:', error);
          return [];
        } else {
        }
      } else {
      }


      const mappedMessages = (data || []).map(msg => ({
        id: msg.id,
        userName: msg.user_name,
        userEmail: msg.user_email,
        subject: msg.subject,
        message: msg.message,
        category: msg.category,
        priority: msg.priority,
        status: msg.status,
        createdAt: msg.created_at,
        adminResponse: msg.admin_response,
        adminRespondedAt: msg.admin_responded_at
      }));

      return mappedMessages;
    } catch (error) {
 console.error(' Admin: Unexpected error in getMessages:', error);
      return [];
    }
  }

  // Get messages for current user
  static async getUserMessages(): Promise<SupportMessage[]> {
    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError) {
 console.error(' Auth error in getUserMessages:', authError);
        return [];
      }

      if (!user) {
 console.error(' No authenticated user found in getUserMessages');
        return [];
      }


      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
 console.error(' Error fetching user messages:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return [];
      }


      const mappedMessages = (data || []).map(msg => ({
        id: msg.id,
        userName: msg.user_name,
        userEmail: msg.user_email,
        subject: msg.subject,
        message: msg.message,
        category: msg.category,
        priority: msg.priority,
        status: msg.status,
        createdAt: msg.created_at,
        adminResponse: msg.admin_response,
        adminRespondedAt: msg.admin_responded_at
      }));

      return mappedMessages;
    } catch (error) {
 console.error(' Unexpected error in getUserMessages:', error);
      return [];
    }
  }

  // Add a new support message
  static async addMessage(messageData: {
    userName: string;
    userEmail: string;
    subject: string;
    message: string;
    category: string;
    priority: string;
  }): Promise<SupportMessage | null> {
    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError) {
 console.error('Auth error:', authError);
        return null;
      }

      if (!user) {
 console.error('No authenticated user found');
        return null;
      }


      const { data, error } = await supabase
        .from('support_messages')
        .insert([
          {
            user_id: user.id,
            user_name: messageData.userName,
            user_email: messageData.userEmail,
            subject: messageData.subject,
            message: messageData.message,
            category: messageData.category,
            priority: messageData.priority,
            status: 'pending'
          }
        ])
        .select()
        .single();

      if (error) {
 console.error('Error adding message:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: error
        });
        return null;
      }

      const newMessage: SupportMessage = {
        id: data.id,
        userName: data.user_name,
        userEmail: data.user_email,
        subject: data.subject,
        message: data.message,
        category: data.category,
        priority: data.priority,
        status: data.status,
        createdAt: data.created_at,
        adminResponse: data.admin_response,
        adminRespondedAt: data.admin_responded_at
      };

      // Add auto-response after a delay
      setTimeout(() => {
        this.addAutoResponse(newMessage.id);
      }, 2000);

      return newMessage;
    } catch (error) {
 console.error('Error in addMessage:', error);
      return null;
    }
  }

  // Add auto-response to a message
  static async addAutoResponse(messageId: string): Promise<void> {
    try {
      const autoResponseText = "Thank you for your message! I've received your request and our team will get back to you as soon as possible. In the meantime, you can check our FAQ section for quick answers to common questions.";
      
      await supabase
        .from('support_messages')
        .update({
          admin_response: autoResponseText,
          admin_responded_at: new Date().toISOString(),
          status: 'in_progress'
        })
        .eq('id', messageId);

      // Trigger update event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('supportMessageUpdated', { 
          detail: { messageId } 
        }));
      }
    } catch (error) {
 console.error('Error adding auto-response:', error);
    }
  }

  // Add a reply to a message (creates a new message in the conversation)
  static async addReply(originalMessageId: string, replyText: string): Promise<SupportMessage | null> {
    try {
      // Get the original message to copy user details
      const { data: originalMessage, error: fetchError } = await supabase
        .from('support_messages')
        .select('*')
        .eq('id', originalMessageId)
        .single();

      if (fetchError || !originalMessage) {
 console.error('Error fetching original message:', fetchError);
        return null;
      }

      // Create a new message as admin reply
      const { data, error } = await supabase
        .from('support_messages')
        .insert([
          {
            user_id: originalMessage.user_id,
            user_name: 'Admin Support',
            user_email: 'admin@loveworld.com',
            subject: `Re: ${originalMessage.subject}`,
            message: replyText,
            category: originalMessage.category,
            priority: originalMessage.priority,
            status: 'resolved',
            admin_response: replyText,
            admin_responded_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) {
 console.error('Error adding reply:', error);
        return null;
      }

            await supabase
        .from('support_messages')
        .update({ status: 'resolved' })
        .eq('id', originalMessageId);

      // Trigger update event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('supportMessageUpdated', {
          detail: { messageId: originalMessageId }
        }));
      }

      return {
        id: data.id,
        userName: data.user_name,
        userEmail: data.user_email,
        subject: data.subject,
        message: data.message,
        category: data.category,
        priority: data.priority,
        status: data.status,
        createdAt: data.created_at,
        adminResponse: data.admin_response,
        adminRespondedAt: data.admin_responded_at
      };
    } catch (error) {
 console.error('Error in addReply:', error);
      return null;
    }
  }

    static async updateMessage(messageId: string, updates: {
    status?: string;
  }): Promise<void> {
    try {
      const updateData: any = {};

      if (updates.status) {
        updateData.status = updates.status;
      }

      const { error } = await supabase
        .from('support_messages')
        .update(updateData)
        .eq('id', messageId);

      if (error) {
 console.error('Error updating message:', error);
        return;
      }

      // Trigger update event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('supportMessageUpdated', {
          detail: { messageId }
        }));
      }
    } catch (error) {
 console.error('Error in updateMessage:', error);
    }
  }

  // Convert messages to chat format
  static convertToChat(messages: SupportMessage[]): Array<{
    id: string;
    text: string;
    isBot: boolean;
    timestamp: Date;
    supportMessageId?: string;
  }> {
    const chatMessages: Array<{
      id: string;
      text: string;
      isBot: boolean;
      timestamp: Date;
      supportMessageId?: string;
    }> = [];

    messages.forEach(msg => {
      // Add user message
      chatMessages.push({
        id: `user-${msg.id}`,
        text: msg.message,
        isBot: false,
        timestamp: new Date(msg.createdAt),
        supportMessageId: msg.id
      });

      // Add admin response if exists
      if (msg.adminResponse) {
        chatMessages.push({
          id: `admin-${msg.id}`,
          text: msg.adminResponse,
          isBot: true,
          timestamp: new Date(msg.adminRespondedAt || msg.createdAt)
        });
      }
    });

    // Sort by timestamp
    return chatMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // Subscribe to real-time updates
  static subscribeToUpdates(callback: () => void) {
    const channel = supabase
      .channel('support_messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_messages'
        },
        () => {
          callback();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // Subscribe to updates for current user only
  static async subscribeToUserUpdates(callback: () => void) {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
 console.error('No authenticated user found for subscription');
        return () => {};
      }

      const channel = supabase
        .channel('user_support_messages')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'support_messages',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            callback();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (error) {
 console.error('Error setting up user subscription:', error);
      return () => {};
    }
  }
}
