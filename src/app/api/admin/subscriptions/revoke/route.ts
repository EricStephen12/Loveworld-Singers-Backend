import { NextRequest, NextResponse } from 'next/server';
import { FirebaseDatabaseService } from '@/lib/firebase-database';
import { SubscriptionAuditService } from '@/lib/payment-records-service';
import { isHQAdminEmail } from '@/config/roles';
import { KingsChatAuthService } from '@/lib/kingschat-auth';
import { enforceRateLimit, verifyFirebaseIdToken } from '@/lib/api-guards'

/**
 * POST /api/admin/subscriptions/revoke
 * Revoke a user's subscription (HQ Admin only)
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
            name: 'admin-subscriptions-revoke',
            tokensPerInterval: 20,
            intervalMs: 60_000,
            req: request,
            key: () => `uid:${auth.uid}`,
        })
        if (!rate.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
        }

        const body = await request.json();
        const { userId, subscriptionType, reason, adminId } = body;

        if (!userId || !subscriptionType) {
            return NextResponse.json(
                { error: 'userId and subscriptionType are required' },
                { status: 400 }
            );
        }

        // Revoke subscription
        if (subscriptionType === 'zone') {
            await FirebaseDatabaseService.updateDocument('zone_subscriptions', userId, {
                status: 'cancelled',
                cancelledAt: new Date().toISOString(),
                cancelledBy: adminId || 'admin',
                cancelReason: reason || 'Revoked by admin',
                updatedAt: new Date().toISOString()
            });
        } else if (subscriptionType === 'individual') {
            await FirebaseDatabaseService.updateDocument('individual_subscriptions', userId, {
                status: 'cancelled',
                cancelledAt: new Date().toISOString(),
                cancelledBy: adminId || 'admin',
                cancelReason: reason || 'Revoked by admin',
                updatedAt: new Date().toISOString()
            });
        }

        // Log audit trail
        await SubscriptionAuditService.logAction({
            userId,
            action: 'revoked',
            performedBy: `admin:${adminId || 'unknown'}`,
            previousStatus: 'active',
            newStatus: 'cancelled',
            reason: reason || 'Revoked by admin'
        });

        // Send KingsChat notification
        try {
            const userProfile = await FirebaseDatabaseService.getDocument('profiles', userId) as any;
            if (userProfile?.kingschatUserId) {
                await KingsChatAuthService.sendMessage(
                    userProfile.kingschatUserId,
                    `️ Subscription Cancelled\n\nYour subscription has been cancelled by an administrator.\n\nReason: ${reason || 'Administrative action'}\n\nPlease contact support if you have questions.`
                );
            }
        } catch (error) {
 console.error('Failed to send KingsChat notification:', error);
        }

        return NextResponse.json({
            success: true,
            message: 'Subscription revoked successfully'
        });
    } catch (error) {
 console.error('Error revoking subscription:', error);
        return NextResponse.json(
            { error: 'Failed to revoke subscription' },
            { status: 500 }
        );
    }
}
