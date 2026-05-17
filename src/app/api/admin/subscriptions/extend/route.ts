import { NextRequest, NextResponse } from 'next/server';
import { FirebaseDatabaseService } from '@/lib/firebase-database';
import { SubscriptionAuditService } from '@/lib/payment-records-service';
import { isHQAdminEmail } from '@/config/roles';
import { KingsChatAuthService } from '@/lib/kingschat-auth';
import { enforceRateLimit, verifyFirebaseIdToken } from '@/lib/api-guards'

/**
 * POST /api/admin/subscriptions/extend
 * Extend a user's subscription (HQ Admin only)
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
            name: 'admin-subscriptions-extend',
            tokensPerInterval: 20,
            intervalMs: 60_000,
            req: request,
            key: () => `uid:${auth.uid}`,
        })
        if (!rate.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
        }

        const body = await request.json();
        const { userId, subscriptionType, months, reason, adminId } = body;

        if (!userId || !subscriptionType || !months) {
            return NextResponse.json(
                { error: 'userId, subscriptionType, and months are required' },
                { status: 400 }
            );
        }

        // Get current subscription
        const collectionName = subscriptionType === 'zone' ? 'zone_subscriptions' : 'individual_subscriptions';
        const subscription = await FirebaseDatabaseService.getDocument(collectionName, userId) as any;

        if (!subscription) {
            return NextResponse.json(
                { error: 'Subscription not found' },
                { status: 404 }
            );
        }

        // Calculate new expiry date
        const currentExpiry = subscription.expiresAt ? new Date(subscription.expiresAt) : new Date();
        const newExpiry = new Date(currentExpiry);
        newExpiry.setMonth(newExpiry.getMonth() + parseInt(months));

        // Update subscription
        await FirebaseDatabaseService.updateDocument(collectionName, userId, {
            expiresAt: newExpiry.toISOString(),
            status: 'active',
            extendedBy: adminId || 'admin',
            extendedAt: new Date().toISOString(),
            extensionReason: reason || 'Extended by admin',
            updatedAt: new Date().toISOString()
        });

        // Log audit trail
        await SubscriptionAuditService.logAction({
            userId,
            action: 'extended',
            performedBy: `admin:${adminId || 'unknown'}`,
            previousStatus: subscription.status,
            newStatus: 'active',
            reason: reason || 'Extended by admin',
            metadata: {
                previousExpiry: subscription.expiresAt,
                newExpiry: newExpiry.toISOString(),
                extensionMonths: months
            }
        });

        // Send KingsChat notification
        try {
            const userProfile = await FirebaseDatabaseService.getDocument('profiles', userId) as any;
            if (userProfile?.kingschatUserId) {
                await KingsChatAuthService.sendMessage(
                    userProfile.kingschatUserId,
                    ` Subscription Extended!\n\nYour subscription has been extended by ${months} month(s).\n\nNew expiry date: ${newExpiry.toLocaleDateString()}\n\nThank you for being with us! `
                );
            }
        } catch (error) {
 console.error('Failed to send KingsChat notification:', error);
        }

        return NextResponse.json({
            success: true,
            message: 'Subscription extended successfully',
            newExpiry: newExpiry.toISOString()
        });
    } catch (error) {
 console.error('Error extending subscription:', error);
        return NextResponse.json(
            { error: 'Failed to extend subscription' },
            { status: 500 }
        );
    }
}
