import { NextResponse } from 'next/server';
import { ZoneDatabaseService } from '@/lib/zone-database-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get('zoneId');
    const limit = parseInt(searchParams.get('limit') || '1000');

    if (!zoneId) {
      return NextResponse.json({ success: false, error: 'zoneId is required' }, { status: 400 });
    }

    console.log(`[API REHEARSALS] GET for zone: ${zoneId}`);
    const data = await ZoneDatabaseService.getPraiseNightsByZone(zoneId, limit);
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[API REHEARSALS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { zoneId, ...data } = body;

    if (!zoneId) {
      return NextResponse.json({ success: false, error: 'zoneId is required' }, { status: 400 });
    }

    const result = await ZoneDatabaseService.createPraiseNight(zoneId, data);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API REHEARSALS] POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
