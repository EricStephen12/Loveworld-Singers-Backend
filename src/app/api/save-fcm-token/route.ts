import { NextRequest, NextResponse } from 'next/server'
import { admin, rtdb } from '@/lib/firebase-admin'
import { enforceRateLimit, verifyFirebaseIdToken } from '@/lib/api-guards'

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyFirebaseIdToken(request)
    const rate = await enforceRateLimit({
      name: 'save-fcm-token',
      tokensPerInterval: 30,
      intervalMs: 60_000,
      req: request,
      key: (r) => (auth?.uid ? `uid:${auth.uid}` : `ip:${r.headers.get('x-forwarded-for') || 'unknown'}`),
    })
    if (!rate.ok) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid or empty request body' }, { status: 400 });
    }

    const { token, platform, userId } = body;

    if (!token) {
      return NextResponse.json({ error: 'FCM token is required' }, { status: 400 });
    }

    // If a userId is provided, require it to match the authenticated user.
    if (userId && userId !== 'anonymous') {
      if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (userId !== auth.uid) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (!admin.apps.length) {
 console.warn('️ Firebase Admin not configured');
      return NextResponse.json({
        success: true,
        message: 'FCM token received (server storage disabled)'
      })
    }

    // Use Realtime Database instead of Firestore (separate quota, faster)
    const userIdToUse = userId && userId !== 'anonymous' ? userId : `anon_${token.substring(0, 20)}`;
    
    // Create a safe key for the token to support multi-device/multi-browser
    const tokenKey = token.substring(0, 50).replace(/[.#$[\]]/g, '_');

    await rtdb.ref(`fcm_tokens/${userIdToUse}/${tokenKey}`).set({
      token,
      platform: platform || 'web',
      userId: userIdToUse,
      updatedAt: Date.now()
    });


    return NextResponse.json({
      success: true,
      message: 'FCM token saved successfully'
    })

  } catch (error) {
 console.error(' Error saving FCM token:', error)
    return NextResponse.json({
      error: 'Failed to save FCM token',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'FCM token endpoint - use POST to save tokens' })
}
