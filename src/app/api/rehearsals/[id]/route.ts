import { NextResponse } from 'next/server';
import { ZoneDatabaseService } from '@/lib/zone-database-service';
import { isInternalRequest } from '@/lib/api-guards';
import type { NextRequest } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isInternalRequest(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams.id;
    const body = await request.json();
    const { zoneId, ...data } = body;

    const result = await ZoneDatabaseService.updatePraiseNight(id, data, zoneId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API REHEARSALS ID] PATCH Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isInternalRequest(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams.id;
    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get('zoneId');

    const result = await ZoneDatabaseService.deletePraiseNight(id, zoneId || undefined);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API REHEARSALS ID] DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
