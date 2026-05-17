import { NextResponse } from 'next/server';
import { FirebaseDatabaseService } from '@/lib/firebase-database';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chatId, message, userId, userName, type = 'text', mediaUrl = null } = body;
    
    if (!chatId || !message || !userId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Add message to Firestore
    const messageData = {
      chatId,
      text: message,
      senderId: userId,
      senderName: userName || 'User',
      timestamp: new Date(),
      type,
      mediaUrl,
      status: 'sent'
    };

    const result = await FirebaseDatabaseService.addDocument(`chats_v2/${chatId}/messages`, messageData);
    
    // Update the last message in the main chat document
    await FirebaseDatabaseService.updateDocument('chats_v2', chatId, {
      lastMessage: message,
      lastMessageTime: new Date(),
      lastSenderId: userId
    });

    return NextResponse.json({
      success: true,
      messageId: result.id
    });
  } catch (error: any) {
    console.error('[API] Error sending message:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
