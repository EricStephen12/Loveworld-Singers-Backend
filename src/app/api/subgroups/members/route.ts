import { NextResponse } from 'next/server';
import { SubGroupDatabaseService } from '@/lib/subgroup-database-service';

export async function POST(request: Request) {
  try {
    const { subGroupId, zoneId, memberIds, action } = await request.json();
    
    if (!subGroupId) {
      return NextResponse.json({ success: false, error: 'subGroupId is required' }, { status: 400 });
    }

    if (action === 'remove') {
      const { userId } = await request.json(); // Re-read if needed or get from body
      const result = await SubGroupDatabaseService.removeMember(subGroupId, userId);
      return NextResponse.json(result);
    }

    const result = await SubGroupDatabaseService.addMembers(subGroupId, zoneId, memberIds);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API Subgroups Members] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subGroupId = searchParams.get('subGroupId');
    const userId = searchParams.get('userId');
    
    if (!subGroupId || !userId) {
      return NextResponse.json({ success: false, error: 'subGroupId and userId are required' }, { status: 400 });
    }

    const result = await SubGroupDatabaseService.removeMember(subGroupId, userId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API Subgroups Members] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
