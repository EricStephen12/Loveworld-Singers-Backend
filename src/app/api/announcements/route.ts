import { NextResponse } from 'next/server';
import { FirebaseDatabaseService } from '@/lib/firebase-database';

export async function GET() {
  try {
    // All admin messages are now stored in 'notifications' with category='admin'
    const messages = await FirebaseDatabaseService.getCollectionWhere('notifications', 'category', '==', 'admin');
    
    // Sort by newest first
    const sorted = messages.sort((a: any, b: any) => {
      const timeA = (a.createdAt?.toMillis?.() || new Date(a.created_at || a.sentAt || 0).getTime()) as number;
      const timeB = (b.createdAt?.toMillis?.() || new Date(b.created_at || b.sentAt || 0).getTime()) as number;
      return timeB - timeA;
    });

    return NextResponse.json({
      success: true,
      data: sorted.slice(0, 50)
    });
  } catch (error: any) {
    console.error('[API] Error fetching announcements:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
