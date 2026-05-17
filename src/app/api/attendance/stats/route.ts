import { NextResponse } from 'next/server';
import { FirebaseDatabaseService } from '@/lib/firebase-database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const records = await FirebaseDatabaseService.getCollectionWhere('attendance', 'userId', '==', userId);

    const total = records.length;
    const present = records.filter((r: any) => r.status === 'present').length;
    const late = records.filter((r: any) => r.status === 'late').length;
    const absent = records.filter((r: any) => r.status === 'absent').length;

    const attendedCount = present + late;
    const rate = total > 0 ? Math.round((attendedCount / total) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        total,
        present,
        late,
        absent,
        rate
      }
    });
  } catch (error: any) {
    console.error('[API] Error calculating attendance stats:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
