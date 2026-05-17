import { NextResponse } from 'next/server';
import { FirebaseDatabaseService } from '@/lib/firebase-database';

export async function GET() {
  try {
    // All admin messages are stored in 'admin_messages'
    const messages = await FirebaseDatabaseService.getCollection('admin_messages', 50);
    
    // Sort by newest first
    const sorted = messages.sort((a: any, b: any) => {
      const timeA = (a.createdAt?.toMillis?.() || new Date(a.sentAt || 0).getTime()) as number;
      const timeB = (b.createdAt?.toMillis?.() || new Date(b.sentAt || 0).getTime()) as number;
      return timeB - timeA;
    });

    return NextResponse.json({
      success: true,
      data: sorted
    });
  } catch (error: any) {
    console.error('[API] Error fetching announcements:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
