import { NextRequest, NextResponse } from 'next/server';
import { PaymentRecordsService } from '@/lib/payment-records-service';
import { enforceRateLimit, verifyFirebaseIdToken } from '@/lib/api-guards'
import { isHQAdminEmail } from '@/config/roles'

/**
 * GET /api/payments/history?userId={userId}
 * Get payment history for a specific user
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await verifyFirebaseIdToken(request)
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const rate = await enforceRateLimit({
            name: 'payments-history',
            tokensPerInterval: 60,
            intervalMs: 60_000,
            req: request,
            key: () => `uid:${auth.uid}`,
        })
        if (!rate.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
        }

        const { searchParams } = new URL(request.url);
        const requestedUserId = searchParams.get('userId');

        // Default to the authenticated user. Only HQ admins can request other users' history.
        const isAdmin = !!auth.email && isHQAdminEmail(auth.email)
        const userId = requestedUserId ?? auth.uid
        if (userId !== auth.uid && !isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const paymentHistory = await PaymentRecordsService.getUserPaymentHistory(userId);

        return NextResponse.json({
            success: true,
            payments: paymentHistory,
            count: paymentHistory.length
        });
    } catch (error) {
 console.error('Error fetching payment history:', error);
        return NextResponse.json(
            { error: 'Failed to fetch payment history' },
            { status: 500 }
        );
    }
}
