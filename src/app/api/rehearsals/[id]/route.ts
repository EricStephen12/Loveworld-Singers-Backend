import { NextResponse } from 'next/server';
import { ZoneDatabaseService } from '@/lib/zone-database-service';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
