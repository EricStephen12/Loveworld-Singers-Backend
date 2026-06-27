import { NextRequest, NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';

// Search for the song across all relevant collections
async function findSong(songId: string): Promise<{ song: any; collectionName: string } | null> {
  const collections = ['master_songs', 'subgroup_songs', 'praise_night_songs', 'zone_songs'];
  for (const col of collections) {
    const snap = await db.collection(col).doc(songId).get();
    if (snap.exists) return { song: { id: snap.id, ...snap.data() }, collectionName: col };
  }
  return null;
}

// Resolve which user IDs should receive the notification
async function resolveRecipientIds(song: any, collectionName: string): Promise<string[]> {
  if (collectionName === 'subgroup_songs') {
    const subGroupId = song.subGroupId;
    if (!subGroupId) return [];
    const snap = await db.collection('subgroups').doc(subGroupId).get();
    return snap.exists ? (snap.data()?.memberIds || []) : [];
  }

  const zoneId = song.zoneId;
  if (!zoneId) {
    const snap = await db.collection('hq_members').get();
    return snap.docs.map(d => d.data().userId).filter(Boolean);
  }

  const { isHQGroup } = await import('@/config/zones');
  if (isHQGroup(zoneId)) {
    const snap = await db.collection('hq_members').get();
    return snap.docs.map(d => d.data().userId).filter(Boolean);
  }

  const snap = await db.collection('zone_members').where('zoneId', '==', zoneId).get();
  return snap.docs.map(d => d.data().userId).filter(Boolean);
}

// Fetch OneSignal subscription IDs from Firestore profiles (same logic as send-notification)
async function getOneSignalSubIds(userIds: string[]): Promise<string[]> {
  const subIds: string[] = [];
  const chunkSize = 10;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const snap = await db.collection('profiles')
      .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
      .get();
    snap.forEach(d => {
      const subId = d.data().onesignalSubId;
      if (subId) subIds.push(subId);
    });
  }
  return subIds;
}

export async function POST(request: NextRequest) {
  try {
    const { songId, isActive } = await request.json();
    if (!songId) {
      return NextResponse.json({ success: false, error: 'songId is required' }, { status: 400 });
    }

    // Only notify when activating a song
    if (isActive === false) {
      return NextResponse.json({ success: true, message: 'Song deactivated — no notification sent' });
    }

    const found = await findSong(songId);
    if (!found) {
      return NextResponse.json({ success: false, error: 'Song not found in any collection' }, { status: 404 });
    }

    const { song, collectionName } = found;
    const title = song.title || 'A song';
    console.log(`[notify-active] Song "${title}" activated in ${collectionName}`);

    const recipientIds = await resolveRecipientIds(song, collectionName);
    console.log(`[notify-active] Recipients found: ${recipientIds.length}`);

    if (recipientIds.length === 0) {
      console.log('[notify-active] No recipients — skipping notification');
      return NextResponse.json({ success: true, sentCount: 0 });
    }

    // Resolve OneSignal subscription IDs from Firestore
    const onesignalSubIds = await getOneSignalSubIds(recipientIds);
    console.log(`[notify-active] OneSignal sub IDs found: ${onesignalSubIds.length}`);

    const onesignalAppId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '';
    const onesignalRestApiKey = process.env.ONESIGNAL_REST_API_KEY || '';

    if (!onesignalAppId || !onesignalRestApiKey) {
      console.warn('[notify-active] OneSignal credentials missing');
      return NextResponse.json({ success: false, error: 'OneSignal not configured' }, { status: 500 });
    }

    if (onesignalSubIds.length === 0) {
      console.warn('[notify-active] No OneSignal sub IDs found — users may not have the updated app yet');
      return NextResponse.json({ success: true, sentCount: 0, message: 'No OneSignal subscribers found' });
    }

    // Send directly via OneSignal API — no HTTP round-trip to another route
    const payload: Record<string, any> = {
      app_id: onesignalAppId,
      target_channel: 'push',
      headings: { en: '🔴 Song is Live!' },
      contents: { en: `"${title}" is now active in your rehearsal.` },
      include_subscription_ids: onesignalSubIds,
      data: {
        screen: 'Rehearsal',
        songId,
        type: 'song',
        timestamp: Date.now().toString(),
      },
      priority: 5,
    };

    const onesignalResponse = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${onesignalRestApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await onesignalResponse.json();
    console.log('[notify-active] OneSignal result:', JSON.stringify(result));

    if (result.id) {
      return NextResponse.json({
        success: true,
        provider: 'onesignal',
        onesignalId: result.id,
        sentCount: result.recipients || onesignalSubIds.length,
        totalRecipients: recipientIds.length,
      });
    }

    return NextResponse.json({ success: false, error: 'OneSignal did not return an ID', result });
  } catch (error: any) {
    console.error('[notify-active] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
