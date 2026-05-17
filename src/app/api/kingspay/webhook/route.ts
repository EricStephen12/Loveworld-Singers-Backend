import { NextRequest, NextResponse } from 'next/server'
import { verifyKingsPayWebhookSignature } from '@/lib/kingspay-service'
import { FirebaseDatabaseService } from '@/lib/firebase-database'

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-kingspay-signature')
    const body = await request.text()
    const payload = JSON.parse(body)

    // Verify webhook signature
    const secretKey = process.env.KINGSPAY_SECRET_KEY

    if (!secretKey) {
 console.error(' KingsPay secret key not configured')
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 })
    }

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    if (!verifyKingsPayWebhookSignature(signature, body, secretKey)) {
 console.error(' Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Handle payment.succeeded event
    if (payload.event === 'payment.succeeded') {
      const { data } = payload
      const { metadata, payment_id, amount, status } = data

      if (status === 'SUCCESS' && metadata) {
        const { userId } = metadata

        if (!userId) {
 console.error(' Webhook metadata missing userId')
          return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 })
        }

        // Handle individual subscription activation (Global Account Based)
        const subscriptionId = userId
        const endDate = new Date()
        endDate.setDate(endDate.getDate() + 30)

        try {
          await FirebaseDatabaseService.createDocument('individual_subscriptions', subscriptionId, {
            userId: userId,
            status: 'active',
            tier: 'premium',
            expiresAt: endDate.toISOString(),
            paymentId: payment_id,
            amount: amount,
            paidAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })

 console.log(` Individual subscription activated for user ${userId}`)
          return NextResponse.json({ success: true, message: 'Global Individual subscription activated' })
        } catch (error) {
 console.error(' Error updating individual subscription:', error)
          return NextResponse.json({ error: 'Failed to activate individual subscription' }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Webhook received' })
  } catch (error) {
 console.error(' Error processing KingsPay webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
