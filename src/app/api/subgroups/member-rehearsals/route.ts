import { NextResponse } from 'next/server';
import { FirebaseDatabaseService } from '@/lib/firebase-database';
import { isHQGroup } from '@/config/zones';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get('zoneId');
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    if (!zoneId) {
      return NextResponse.json({ success: false, error: 'Zone ID is required' }, { status: 400 });
    }

    console.log(`[API] Fetching rehearsals for user ${userId} in zone ${zoneId}`);

    // 1. Fetch zone-level rehearsals
    const isHQ = isHQGroup(zoneId);
    const zoneCollection = isHQ ? 'praise_nights' : 'zone_praise_nights';
    
    let zoneRehearsalsRaw = [];
    if (isHQ) {
      zoneRehearsalsRaw = await FirebaseDatabaseService.getCollection(zoneCollection);
    } else {
      zoneRehearsalsRaw = await FirebaseDatabaseService.getCollectionWhere(zoneCollection, 'zoneId', '==', zoneId);
    }

    const zoneRehearsals = zoneRehearsalsRaw.map((r: any) => ({
      ...r,
      scope: 'zone',
      scopeLabel: 'Zonal Rehearsal'
    }));

    // 2. Get subgroups the user belongs to
    const subgroups = await FirebaseDatabaseService.getCollectionWhere('subgroups', 'memberIds', 'array-contains', userId);
    
    let subGroupRehearsals = [];
    if (subgroups.length > 0) {
      const subGroupIds = subgroups.map(sg => sg.id);
      console.log(`[API] User belongs to ${subGroupIds.length} subgroups:`, subGroupIds);
      
      const sgRehearsalsRaw = await FirebaseDatabaseService.getCollectionWhereIn('subgroup_praise_nights', 'subGroupId', subGroupIds);
      
      // Filter by zoneId if provided (ensure security)
      const filteredSgRehearsals = sgRehearsalsRaw.filter((r: any) => r.zoneId === zoneId);
      
      const sgMap = new Map(subgroups.map(sg => [sg.id, sg.name]));
      
      subGroupRehearsals = filteredSgRehearsals.map((r: any) => ({
        ...r,
        scope: 'subgroup',
        scopeLabel: sgMap.get(r.subGroupId) || 'Subgroup Rehearsal',
        subGroupName: sgMap.get(r.subGroupId) || ''
      }));
    }

    // 3. Combine and sort all rehearsals
    const combined = [...zoneRehearsals, ...subGroupRehearsals].sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    console.log(`[API] Returning ${zoneRehearsals.length} zone and ${subGroupRehearsals.length} subgroup rehearsals`);
    
    return NextResponse.json({
      zoneRehearsals,
      subGroupRehearsals,
      combined
    });
  } catch (error: any) {
    console.error('[API] Error fetching member rehearsals:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
