import { NextRequest, NextResponse } from 'next/server';
import { FirebaseDatabaseService } from '@/lib/firebase-database';

async function findSongCollection(id: string) {
  const collections = ['master_songs', 'subgroup_songs', 'praise_night_songs', 'zone_songs'];
  for (const col of collections) {
    const doc = await FirebaseDatabaseService.getDocument(col, id);
    if (doc) return col;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { songId, isActive } = await request.json();

    if (!songId) {
      return NextResponse.json({ success: false, error: 'songId is required' }, { status: 400 });
    }

    // Only send notification if song is being activated
    if (isActive !== false) {
      const collectionName = await findSongCollection(songId);
      if (!collectionName) {
        return NextResponse.json({ success: false, error: 'Song not found in any collection' }, { status: 404 });
      }

      console.log(`[API notify-active] Triggering notification for song: ${songId} in collection: ${collectionName}`);
      await FirebaseDatabaseService.handleLiveSongNotification(collectionName, songId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API notify-active] Error triggering live song notification:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
