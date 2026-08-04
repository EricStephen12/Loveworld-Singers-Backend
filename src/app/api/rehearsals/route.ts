import { NextResponse } from 'next/server';
import { ZoneDatabaseService } from '@/lib/zone-database-service';
import { FirebaseDatabaseService } from '@/lib/firebase-database';
import { isInternalRequest } from '@/lib/api-guards';
import type { NextRequest } from 'next/server';

// OFF by default (must be explicitly true to grant access)
const OFF_BY_DEFAULT = new Set(['can_access_pre_rehearsal', 'canSeeArchive'])

// Maps page category → profile field
const CATEGORY_FIELD: Record<string, string> = {
  ongoing: 'canAccessOngoingRehearsals',
  'pre-rehearsal': 'can_access_pre_rehearsal',
  archive: 'canSeeArchive',
}

async function checkAccess(userId: string, zoneId: string, category: string): Promise<boolean> {
  if (!userId) return true // old app = no userId sent = allow through

  const fieldName = CATEGORY_FIELD[category]
  if (!fieldName) return true

  try {
    const profile = await FirebaseDatabaseService.getUserProfile(userId) as any
    if (!profile) return true

    // Only HQ admins (email whitelist) are always unrestricted
    // Coordinators and regular admins CAN be restricted by toggles
    const HQ_ADMIN_EMAILS = [
      'ihenacho23@gmail.com',
      'ephraimloveworld1@gmail.com',
      'takeshopstores@gmail.com',
      'nnennawealth@gmail.com',
      'joykures@gmail.com',
      'styleirech@gmail.com',
      'lliamzelvin@gmail.com',
    ]
    const isHQAdmin = HQ_ADMIN_EMAILS.includes((profile.email || '').toLowerCase())
    if (isHQAdmin) return true

    // ── ZONE-SPECIFIC restriction takes priority ─────────────────────────────
    // Stored as: profile.zoneRestrictions.{zoneId}.{fieldName} = true/false
    const zoneRestrictions = profile.zoneRestrictions || {}
    const zoneField = zoneRestrictions[zoneId]?.[fieldName]

    if (zoneField !== undefined) {
      // Zone-specific value exists — use it
      if (OFF_BY_DEFAULT.has(fieldName)) {
        return zoneField === true
      } else {
        return zoneField !== false
      }
    }

    // ── GLOBAL restriction fallback ───────────────────────────────────────────
    // Falls back to the flat profile field (legacy / global toggle)
    const globalField = profile[fieldName]

    if (OFF_BY_DEFAULT.has(fieldName)) {
      return globalField === true
    } else {
      return globalField !== false
    }

  } catch (err) {
    console.error('[API REHEARSALS] Permission check error:', err)
    return true // fail open
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!isInternalRequest(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get('zoneId');
    const userId = searchParams.get('userId') || '';
    const category = searchParams.get('category') || 'ongoing';
    const limit = parseInt(searchParams.get('limit') || '1000');

    if (!zoneId) {
      return NextResponse.json({ success: false, error: 'zoneId is required' }, { status: 400 });
    }

    // Zone-aware permission check
    if (userId) {
      const allowed = await checkAccess(userId, zoneId, category)
      if (!allowed) {
        console.log(`[API REHEARSALS] Blocked: user=${userId} zone=${zoneId} category=${category}`)
        return NextResponse.json({
          success: false,
          error: 'Access to this section has been disabled by your admin',
          accessDenied: true,
          category,
        }, { status: 403 });
      }
    }

    const data = await ZoneDatabaseService.getPraiseNightsByZone(zoneId, limit);
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('[API REHEARSALS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isInternalRequest(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

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
