import { NextRequest, NextResponse } from 'next/server';
import { verifyKingsPayWebhookSignature } from '@/lib/kingspay-service';
import { FirebaseDatabaseService } from '@/lib/firebase-database';
import { PaymentRecordsService, SubscriptionAuditService } from '@/lib/payment-records-service';
import { KingsChatAuthService } from '@/lib/kingschat-auth';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-kingspay-signature');
    const body = await request.text();
    const data = JSON.parse(body);

    // Verify webhook signature
    // IMPORTANT: never use NEXT_PUBLIC_* for webhook secrets
    const environment = process.env.KINGSPAY_ENVIRONMENT || 'test';
    const secretKey = environment === 'production'
      ? process.env.KINGSPAY_PRODUCTION_SECRET_KEY || ''
      : process.env.KINGSPAY_TEST_SECRET_KEY || '';

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }
    if (!secretKey) {
      console.error('[Webhook] Secret key not configured');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }
    if (!verifyKingsPayWebhookSignature(signature, body, secretKey)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }


    // Handle payment.succeeded event
    if (data.event === 'payment.succeeded') {
      const paymentData = data.data;



      try {
        // Store payment record in Firebase
        await FirebaseDatabaseService.createDocument('payments', paymentData.payment_id, {
          payment_id: paymentData.payment_id,
          payment_code: paymentData.payment_code,
          amount: paymentData.amount,
          currency: paymentData.currency,
          status: paymentData.status,
          description: paymentData.description,
          metadata: paymentData.metadata,
          payment_type: paymentData.payment_type,
          environment: paymentData.environment,
          timestamp_utc: paymentData.timestamp_utc,
          processed_at: new Date().toISOString(),
        });


        // Handle different subscription types
        const subscriptionType = paymentData.metadata?.type;

        if (subscriptionType === 'zone_subscription') {
          // Zone subscription (Coordinator pays for entire zone)
          const { zoneId, coordinatorId, memberCount } = paymentData.metadata;

          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year subscription

          // INSTANT ACCESS: Update subscription status immediately
          await FirebaseDatabaseService.updateDocument('zone_subscriptions', zoneId, {
            status: 'active',
            plan: 'premium',
            memberCount,
            paymentId: paymentData.payment_id,
            amountPaid: paymentData.amount,
            currency: paymentData.currency,
            paidBy: coordinatorId,
            paidAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Get coordinator info for notifications
          const coordinatorProfile = await FirebaseDatabaseService.getDocument('profiles', coordinatorId) as any;

          // Create detailed payment record
          await PaymentRecordsService.createPaymentRecord({
            userId: coordinatorId,
            userEmail: coordinatorProfile?.email,
            userName: `${coordinatorProfile?.first_name || ''} ${coordinatorProfile?.last_name || ''}`.trim(),
            kingschatUserId: coordinatorProfile?.kingschatUserId,
            amount: paymentData.amount,
            currency: paymentData.currency,
            status: 'success',
            paymentMethod: 'espees',
            paymentCode: paymentData.payment_code,
            transactionRef: paymentData.payment_id,
            subscriptionType: 'zone',
            subscriptionPeriod: {
              start: new Date(),
              end: expiresAt
            },
            metadata: {
              zoneId,
              zoneName: paymentData.metadata.zoneName,
              memberCount,
            },
            processedAt: new Date()
          });

          // Log audit trail
          await SubscriptionAuditService.logAction({
            userId: coordinatorId,
            action: 'activated',
            performedBy: 'system',
            newStatus: 'active',
            metadata: {
              paymentId: paymentData.payment_id,
              amount: paymentData.amount,
              expiryDate: expiresAt.toISOString(),
              zoneId,
              memberCount
            }
          });

          // Send KingsChat notification if user has KingsChat linked
          if (coordinatorProfile?.kingschatUserId) {
            try {
              const message = ` Payment Successful!\n\nYour zone subscription is now active!\n\nAmount: ${paymentData.amount / 100} ESPEES\nMembers: ${memberCount}\nExpires: ${expiresAt.toLocaleDateString()}\n\nThank you for subscribing! `;

              await KingsChatAuthService.sendMessage(
                coordinatorProfile.kingschatUserId,
                message
              );

            } catch (error) {
 console.error('Failed to send KingsChat notification:', error);
            }
          }

        } else if (subscriptionType === 'individual_subscription') {
          // Individual subscription (Member pays for themselves)
          const { userId } = paymentData.metadata;

          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year subscription

          const subscriptionId = userId;

          // INSTANT ACCESS: Update subscription status immediately
          await FirebaseDatabaseService.updateDocument('individual_subscriptions', subscriptionId, {
            status: 'active',
            paymentId: paymentData.payment_id,
            amountPaid: paymentData.amount,
            currency: paymentData.currency,
            paidAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Get user info for notifications
          const userProfile = await FirebaseDatabaseService.getDocument('profiles', userId) as any;

          // Create detailed payment record
          await PaymentRecordsService.createPaymentRecord({
            userId,
            userEmail: userProfile?.email,
            userName: `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim(),
            kingschatUserId: userProfile?.kingschatUserId,
            amount: paymentData.amount,
            currency: paymentData.currency,
            status: 'success',
            paymentMethod: 'espees',
            paymentCode: paymentData.payment_code,
            transactionRef: paymentData.payment_id,
            subscriptionType: 'individual',
            subscriptionPeriod: {
              start: new Date(),
              end: expiresAt
            },
            processedAt: new Date()
          });

          // Log audit trail
          await SubscriptionAuditService.logAction({
            userId,
            action: 'activated',
            performedBy: 'system',
            newStatus: 'active',
            metadata: {
              paymentId: paymentData.payment_id,
              amount: paymentData.amount,
              expiryDate: expiresAt.toISOString()
            }
          });

          // Send KingsChat notification if user has KingsChat linked
          if (userProfile?.kingschatUserId) {
            try {
              const message = ` Payment Successful!\n\nYour premium subscription is now active!\n\nAmount: ${paymentData.amount / 100} ESPEES\nExpires: ${expiresAt.toLocaleDateString()}\n\nEnjoy unlimited access to all features! `;

              await KingsChatAuthService.sendMessage(
                userProfile.kingschatUserId,
                message
              );

            } catch (error) {
 console.error('Failed to send KingsChat notification:', error);
            }
          }
        }


      } catch (error) {
 console.error('Error processing payment webhook:', error);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
 console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
