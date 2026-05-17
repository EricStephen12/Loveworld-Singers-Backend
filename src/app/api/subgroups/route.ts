import { NextResponse } from 'next/server';
import { FirebaseDatabaseService } from '@/lib/firebase-database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get('zoneId');
    
    let groups;
    if (zoneId && zoneId !== 'zone-boss') {
      groups = await FirebaseDatabaseService.getCollectionWhere('subgroups', 'zoneId', '==', zoneId);
    } else {
      groups = await FirebaseDatabaseService.getCollection('subgroups', 500);
    }
    
    return NextResponse.json({
      success: true,
      count: groups.length,
      data: groups
    });
  } catch (error: any) {
    console.error('[API] Error fetching subgroups:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await FirebaseDatabaseService.addDocument('subgroups', {
      ...body,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] Error creating subgroup:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
