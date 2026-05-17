import { NextResponse } from 'next/server';
import { FirebaseDatabaseService } from '@/lib/firebase-database';

export async function GET(request: Request) {
  try {
    const zones = await FirebaseDatabaseService.getCollection('zones', 50);
    return NextResponse.json({
      success: true,
      data: zones
    });
  } catch (error: any) {
    console.error('[API] Error fetching zones:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
