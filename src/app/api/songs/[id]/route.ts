import { NextResponse } from 'next/server';
import { FirebaseDatabaseService } from '@/lib/firebase-database';

// Helper to find which collection a song belongs to
async function findSongCollection(id: string) {
  const collections = ['master_songs', 'subgroup_songs', 'praise_night_songs', 'zone_songs'];
  for (const col of collections) {
    const doc = await FirebaseDatabaseService.getDocument(col, id);
    if (doc) return { collectionName: col, doc };
  }
  return null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const found = await findSongCollection(id);
    if (!found) {
      return NextResponse.json({ success: false, error: 'Song not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: found.doc });
  } catch (error: any) {
    console.error('[API] Error getting song by id:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await request.json();
    
    const found = await findSongCollection(id);
    if (!found) {
      return NextResponse.json({ success: false, error: 'Song not found for update' }, { status: 404 });
    }

    console.log(`[API] Updating song ${id} in ${found.collectionName}`);
    const result = await FirebaseDatabaseService.updateDocument(found.collectionName, id, body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] Error updating song:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    
    const found = await findSongCollection(id);
    if (!found) {
      return NextResponse.json({ success: false, error: 'Song not found for deletion' }, { status: 404 });
    }

    console.log(`[API] Deleting song ${id} from ${found.collectionName}`);
    const result = await FirebaseDatabaseService.deleteDocument(found.collectionName, id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] Error deleting song:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
