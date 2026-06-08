// app/api/agora-token/route.ts
// Generates a short-lived Agora RTC token for voice/video calls
// GET /api/agora-token?channel=CALL_ID&uid=0

import { NextRequest, NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

const APP_ID   = process.env.AGORA_APP_ID   || '';
const APP_CERT = process.env.AGORA_APP_CERT || '';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get('channel');
  const uid     = parseInt(searchParams.get('uid') || '0', 10);

  if (!channel) {
    return NextResponse.json({ error: 'channel is required' }, { status: 400 });
  }

  if (!APP_ID || !APP_CERT) {
    // No certificate — return null so app joins without token (testing mode)
    return NextResponse.json({ token: null });
  }

  try {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERT,
      channel,
      uid,
      RtcRole.PUBLISHER,
      expiresAt,
      expiresAt
    );

    return NextResponse.json({ token });
  } catch (err: any) {
    console.error('[Agora Token] Error:', err);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
