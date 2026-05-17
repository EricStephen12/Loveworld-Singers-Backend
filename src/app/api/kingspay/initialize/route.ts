import { NextRequest, NextResponse } from 'next/server'
import { initializeKingsPayPayment } from '@/lib/kingspay-service'
import { KINGSPAY_CONFIG } from '@/config/subscriptions'

export async function POST(request: NextRequest) {
  try {
    const text = await request.text()
 console.log(' KingsPay Raw Request Body:', text)

    if (!text) {
 console.error(' KingsPay Initialize Request Body is empty')
      return NextResponse.json(
        { success: false, error: 'Request body is empty' },
        { status: 400 }
      )
    }

    let body
    try {
      body = JSON.parse(text)
    } catch (parseError) {
 console.error(' Failed to parse KingsPay request body as JSON:', parseError)
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

 console.log(' KingsPay parsed body:', JSON.stringify(body, null, 2))
    const { amount, description, zoneId, zoneName, userId, userEmail, duration, type = 'zone_subscription' } = body

    // Validate required fields
    if (!amount || !userId) {
 console.error(' Missing required fields:', { amount: !!amount, userId: !!userId })
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Build callback and webhook URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
 console.log(' Base URL for KingPay callback:', baseUrl)
    const callbackUrl = `${baseUrl}/subscription/callback?userId=${userId}`
    const webhookUrl = `${baseUrl}/api/kingspay/webhook`

    // Initialize payment with KingsPay
    const result = await initializeKingsPayPayment({
      amount: amount, // Amount in KOBE (cents)
      currency: 'ESP',
      description: `LWSRH Premium Individual Subscription`,
      merchant_callback_url: callbackUrl,
      merchant_webhook_url: webhookUrl,
      metadata: {
        userId,
        zoneId: zoneId || 'global',
        type: 'individual_subscription',
        product: 'individual_premium'
      },
      payment_type: 'espees',
      email: userEmail
    })

    if (result.success && result.payment_id) {
      return NextResponse.json({
        success: true,
        payment_id: result.payment_id,
        message: result.message
      })
    } else {
      // Pass through the actual error status from KingPay (e.g. 422)
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to initialize payment',
          instruction: result.statusCode === 422 ? 'Please log in to your KingsPay Merchant Panel and ensure your Espees wallet address is configured.' : undefined
        },
        { status: result.statusCode || 500 }
      )
    }
  } catch (error) {
 console.error(' Error in KingsPay initialize API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
