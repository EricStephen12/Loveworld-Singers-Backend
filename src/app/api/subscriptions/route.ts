import { NextResponse } from 'next/server';
import { getIndividualSubscription, hasPremiumAccess } from '@/lib/subscription-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const zoneId = searchParams.get('zoneId');
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const subscription = await getIndividualSubscription(userId);
    const premiumAccess = await hasPremiumAccess(userId, zoneId || undefined);
    
    return NextResponse.json({
      success: true,
      data: {
        subscription,
        hasPremium: premiumAccess
      }
    });
  } catch (error: any) {
    console.error('[API] Error checking subscription:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
