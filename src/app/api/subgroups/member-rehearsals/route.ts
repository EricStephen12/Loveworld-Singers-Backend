import { NextResponse } from 'next/server';
import { FirebaseDatabaseService } from '@/lib/firebase-database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get('zoneId');
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    console.log(`[API] Fetching rehearsals for user ${userId} in zone ${zoneId}`);

    // 1. Get subgroups the user belongs to
    const subgroups = await FirebaseDatabaseService.getCollectionWhere('subgroups', 'memberIds', 'array-contains', userId);
    
    if (subgroups.length === 0) {
      console.log(`[API] No subgroups found for user ${userId}`);
      return NextResponse.json([]);
    }

    const subGroupIds = subgroups.map(sg => sg.id);
    console.log(`[API] User belongs to ${subGroupIds.length} subgroups:`, subGroupIds);
    
    // 2. Get rehearsals for these subgroups
    const rehearsals = await FirebaseDatabaseService.getCollectionWhereIn('subgroup_praise_nights', 'subGroupId', subGroupIds);
    
    // 3. Filter by zoneId if provided
    let filteredRehearsals = rehearsals;
    if (zoneId) {
      filteredRehearsals = rehearsals.filter(r => r.zoneId === zoneId);
    }

    // 4. Sort by date/time (or createdAt)
    const sorted = filteredRehearsals.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    console.log(`[API] Returning ${sorted.length} rehearsals`);
    return NextResponse.json(sorted);
  } catch (error: any) {
    console.error('[API] Error fetching member rehearsals:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
