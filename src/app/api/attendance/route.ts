import { NextResponse } from 'next/server';
import { FirebaseDatabaseService } from '@/lib/firebase-database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rehearsalId = searchParams.get('rehearsalId');
    const userId = searchParams.get('userId');
    const zoneId = searchParams.get('zoneId');
    
    let records;
    if (rehearsalId) {
      records = await FirebaseDatabaseService.getCollectionWhere('attendance', 'rehearsalId', '==', rehearsalId);
    } else if (userId) {
      records = await FirebaseDatabaseService.getCollectionWhere('attendance', 'userId', '==', userId);
    } else if (zoneId) {
      const { ZONES } = await import('@/config/zones');
      const targetZone = ZONES.find(z => z.id === zoneId);
      const zoneName = targetZone?.name || '';
      const zoneSlug = targetZone?.slug || '';

      // Fetch broad collection of attendance records to ensure we catch all variations of zoneId
      const allRecords = await FirebaseDatabaseService.getCollection('attendance', 1000);
      
      // Also fetch zone members to match records by userId if zoneId is missing/unknown in the attendance record
      const zoneMembers = await FirebaseDatabaseService.getCollectionWhere('zone_members', 'zoneId', '==', zoneId);
      const memberUserIds = new Set(zoneMembers.map((m: any) => m.userId));

      records = allRecords.filter((r: any) => {
        if (r.zoneId === zoneId) return true;
        if (zoneName && r.zoneId === zoneName) return true;
        if (zoneSlug && r.zoneId === zoneSlug) return true;
        if (r.userId && memberUserIds.has(r.userId)) return true;
        if (r.user_id && memberUserIds.has(r.user_id)) return true;
        return false;
      });
    } else {
      records = await FirebaseDatabaseService.getCollection('attendance', 500);
    }

    // Sort records by timestamp descending (most recent first)
    records.sort((a: any, b: any) => {
      const timeA = new Date(a.timestamp || a.check_in_time || a.created_at || 0).getTime();
      const timeB = new Date(b.timestamp || b.check_in_time || b.created_at || 0).getTime();
      return timeB - timeA;
    });
    
    return NextResponse.json({
      success: true,
      data: records
    });
  } catch (error: any) {
    console.error('[API] Error fetching attendance:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId: adminId, qrCode, eventName, zoneId } = body;

    if (!qrCode) {
      return NextResponse.json({ success: false, message: 'QR Code is required' }, { status: 400 });
    }

    // qrCode format: LW-ATTEND-<userId>-<timestamp>-<randomCode>
    const parts = qrCode.split('-');
    if (parts.length < 5 || parts[0] !== 'LW' || parts[1] !== 'ATTEND') {
      return NextResponse.json({ success: false, message: 'Invalid QR Code format' }, { status: 400 });
    }

    // Extract attendee userId
    const attendeeUserId = parts.slice(2, parts.length - 2).join('-');
    
    // Fetch attendee profile
    const profile = await FirebaseDatabaseService.getDocument('profiles', attendeeUserId);
    
    let userName = 'Unknown Member';
    if (profile) {
      const p = profile as any;
      userName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || 'Unknown Member';
    }

    const attendanceData = {
      userId: attendeeUserId,
      user_id: attendeeUserId,
      recordedByAdminId: adminId || 'anonymous-admin',
      userName,
      user_name: userName,
      eventName: eventName || 'Rehearsal',
      event_name: eventName || 'Rehearsal',
      status: 'present',
      zoneId: zoneId || (profile as any)?.zone || (profile as any)?.zoneId || 'unknown',
      qrCode,
      timestamp: new Date(),
      check_in_time: new Date().toISOString()
    };

    const result = await FirebaseDatabaseService.addDocument('attendance', attendanceData);
    
    return NextResponse.json({
      success: true,
      message: `${userName} checked in successfully!`,
      data: {
        id: result.id,
        ...attendanceData
      }
    });
  } catch (error: any) {
    console.error('[API] Error marking attendance:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
