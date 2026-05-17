import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get the current server time
    const serverTime = new Date();
    
    // Return server time with timezone info
    return NextResponse.json({
      serverTime: serverTime.toISOString(),
      timestamp: serverTime.getTime(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      unix: Math.floor(serverTime.getTime() / 1000)
    });
  } catch (error) {
 console.error('Error getting server time:', error);
    return NextResponse.json(
      { error: 'Failed to get server time' },
      { status: 500 }
    );
  }
}