import { NextRequest, NextResponse } from 'next/server';
import { PaymentRecordsService } from '@/lib/payment-records-service';
import { enforceRateLimit, verifyFirebaseIdToken } from '@/lib/api-guards'
import { isHQAdminEmail } from '@/config/roles'

/**
 * GET /api/payments/receipt/{paymentId}
 * Get receipt details for a specific payment
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ paymentId: string }> }
) {
    try {
        const auth = await verifyFirebaseIdToken(request)
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const rate = await enforceRateLimit({
            name: 'payments-receipt',
            tokensPerInterval: 60,
            intervalMs: 60_000,
            req: request,
            key: () => `uid:${auth.uid}`,
        })
        if (!rate.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
        }

        const { paymentId } = await params;

        if (!paymentId) {
            return NextResponse.json(
                { error: 'paymentId is required' },
                { status: 400 }
            );
        }

        const paymentRecord = await PaymentRecordsService.getPaymentRecord(paymentId);

        if (!paymentRecord) {
            return NextResponse.json(
                { error: 'Payment record not found' },
                { status: 404 }
            );
        }

        const isAdmin = !!auth.email && isHQAdminEmail(auth.email)
        // Only the payment owner (or HQ admin) can view a receipt
        if (!isAdmin && paymentRecord.userId && paymentRecord.userId !== auth.uid) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Return receipt data
        return NextResponse.json({
            success: true,
            receipt: {
                id: paymentRecord.id,
                paymentCode: paymentRecord.paymentCode,
                transactionRef: paymentRecord.transactionRef,
                amount: paymentRecord.amount,
                currency: paymentRecord.currency,
                status: paymentRecord.status,
                paymentMethod: paymentRecord.paymentMethod,
                subscriptionType: paymentRecord.subscriptionType,
                subscriptionPeriod: paymentRecord.subscriptionPeriod,
                userName: paymentRecord.userName,
                userEmail: paymentRecord.userEmail,
                createdAt: paymentRecord.createdAt,
                processedAt: paymentRecord.processedAt,
                receiptUrl: paymentRecord.receiptUrl,
                metadata: paymentRecord.metadata
            }
        });
    } catch (error) {
 console.error('Error fetching payment receipt:', error);
        return NextResponse.json(
            { error: 'Failed to fetch payment receipt' },
            { status: 500 }
        );
    }
}
