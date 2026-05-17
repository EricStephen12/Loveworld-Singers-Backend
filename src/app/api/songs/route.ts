import { NextResponse } from 'next/server';
import { FirebaseDatabaseService } from '@/lib/firebase-database';

export async function GET() {
  try {
    // We use a higher limit for the universal API to ensure all master songs are loaded
    const songs = await FirebaseDatabaseService.getCollection('master_songs', 10000);
    
    console.log(`[API] Fetching from master_songs, found ${songs.length} songs`);
    
    return NextResponse.json({
      success: true,
      count: songs.length,
      data: songs
    });
  } catch (error: any) {
    console.error('[API] Error fetching songs:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    let collectionName = 'master_songs';
    if (body.subGroupId) {
      collectionName = 'subgroup_songs';
    } else if (body.zoneId) {
      if (body.zoneId === 'hq' || body.zoneId.toLowerCase().includes('hq')) {
        collectionName = 'praise_night_songs';
      } else {
        collectionName = 'zone_songs';
      }
    }

    console.log(`[API] Creating song in ${collectionName}: ${body.title}`);
    
    const result = await FirebaseDatabaseService.addDocument(collectionName, body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] Error creating song:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
