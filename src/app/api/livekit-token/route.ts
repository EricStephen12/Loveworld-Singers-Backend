import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const roomName = searchParams.get('room');
  const participantName = searchParams.get('participant') || `User-${Math.floor(Math.random() * 1000)}`;

  if (!roomName) {
    return NextResponse.json({ error: 'room parameter is required' }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'LiveKit credentials missing' }, { status: 500 });
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
    });
    
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

    const token = await at.toJwt();
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
