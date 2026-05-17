import { NextRequest, NextResponse } from 'next/server';
import { FirebaseDatabaseService } from '@/lib/firebase-database';
import { PaymentRecordsService, SubscriptionAuditService } from '@/lib/payment-records-service';
import { isHQAdminEmail } from '@/config/roles';
import { KingsChatAuthService } from '@/lib/kingschat-auth';
import { enforceRateLimit, verifyFirebaseIdToken } from '@/lib/api-guards'

/**
 * POST /api/admin/subscriptions/refund
 * Process a refund and revoke subscription (HQ Admin only)
 */
export async function POST(request: NextRequest) {
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
            name: 'admin-subscriptions-refund',
            tokensPerInterval: 10,
            intervalMs: 60_000,
            req: request,
            key: () => `uid:${auth.uid}`,
        })
        if (!rate.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
        }

        const body = await request.json();
        const { paymentId, userId, subscriptionType, reason, adminId } = body;

        if (!paymentId || !userId || !subscriptionType) {
            return NextResponse.json(
                { error: 'paymentId, userId, and subscriptionType are required' },
                { status: 400 }
            );
        }

        // Mark payment as refunded
        await PaymentRecordsService.refundPayment(
            paymentId,
            `admin:${adminId || 'unknown'}`,
            reason || 'Refunded by admin'
        );

        // Revoke subscription
        const collectionName = subscriptionType === 'zone' ? 'zone_subscriptions' : 'individual_subscriptions';
        await FirebaseDatabaseService.updateDocument(collectionName, userId, {
            status: 'refunded',
            refundedAt: new Date().toISOString(),
            refundedBy: adminId || 'admin',
            refundReason: reason || 'Refunded by admin',
            updatedAt: new Date().toISOString()
        });

        // Log audit trail
        await SubscriptionAuditService.logAction({
            userId,
            action: 'refunded',
            performedBy: `admin:${adminId || 'unknown'}`,
            previousStatus: 'active',
            newStatus: 'refunded',
            reason: reason || 'Refunded by admin',
            metadata: {
                paymentId
            }
        });

        // Send KingsChat notification
        try {
            const userProfile = await FirebaseDatabaseService.getDocument('profiles', userId) as any;
            if (userProfile?.kingschatUserId) {
                const payment = await PaymentRecordsService.getPaymentRecord(paymentId);
                await KingsChatAuthService.sendMessage(
                    userProfile.kingschatUserId,
                    ` Refund Processed\n\nYour payment has been refunded.\n\nAmount: ${payment ? (payment.amount / 100) + ' ESPEES' : 'N/A'}\nReason: ${reason || 'Administrative action'}\n\nYour subscription has been cancelled. Please contact support if you have questions.`
                );
            }
        } catch (error) {
 console.error('Failed to send KingsChat notification:', error);
        }

        return NextResponse.json({
            success: true,
            message: 'Refund processed successfully'
        });
    } catch (error) {
 console.error('Error processing refund:', error);
        return NextResponse.json(
            { error: 'Failed to process refund' },
            { status: 500 }
        );
    }
}
