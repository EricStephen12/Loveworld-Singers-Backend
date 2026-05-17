import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const collections = [
      'master_library',
      'master_songs',
      'praise_night_songs',
      'songs',
      'zone_songs',
      'categories',
      'zone_categories'
    ];

    const counts: Record<string, number> = {};

    for (const name of collections) {
      const snapshot = await db.collection(name).count().get();
      counts[name] = snapshot.data().count;
    }

    return NextResponse.json({
      success: true,
      counts
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
