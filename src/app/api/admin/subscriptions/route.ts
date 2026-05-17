import { NextRequest, NextResponse } from 'next/server';
import { PaymentRecordsService, SubscriptionAuditService } from '@/lib/payment-records-service';
import { FirebaseDatabaseService } from '@/lib/firebase-database';
import { isHQAdminEmail } from '@/config/roles';
import { enforceRateLimit, verifyFirebaseIdToken } from '@/lib/api-guards'

/**
 * GET /api/admin/subscriptions
 * Get all subscriptions with filters (HQ Admin only)
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await verifyFirebaseIdToken(request)
        const userEmail = auth?.email
        if (!auth || !userEmail || !isHQAdminEmail(userEmail)) {
            return NextResponse.json(
                { error: 'Unauthorized. HQ Admin access required.' },
                { status: 403 }
            );
        }

        const rate = await enforceRateLimit({
            name: 'admin-subscriptions',
            tokensPerInterval: 60,
            intervalMs: 60_000,
            req: request,
            key: () => `uid:${auth.uid}`,
        })
        if (!rate.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') as any;
        const subscriptionType = searchParams.get('type') as any;
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // Get all payment records with filters
        const payments = await PaymentRecordsService.getAllPaymentRecords({
            status,
            subscriptionType,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined
        });

        // Get subscription details
        const subscriptions = await Promise.all(
            payments.map(async (payment) => {
                let subscriptionData = null;

                if (payment.subscriptionType === 'zone' && payment.metadata?.zoneId) {
                    subscriptionData = await FirebaseDatabaseService.getDocument(
                        'zone_subscriptions',
                        payment.metadata.zoneId
                    );
                } else if (payment.subscriptionType === 'individual') {
                    subscriptionData = await FirebaseDatabaseService.getDocument(
                        'individual_subscriptions',
                        payment.userId
                    );
                }

                return {
                    payment,
                    subscription: subscriptionData
                };
            })
        );

        return NextResponse.json({
            success: true,
            subscriptions,
            count: subscriptions.length
        });
    } catch (error) {
 console.error('Error fetching subscriptions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch subscriptions' },
            { status: 500 }
        );
    }
}
