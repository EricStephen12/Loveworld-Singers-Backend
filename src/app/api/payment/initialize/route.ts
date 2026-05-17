import { NextRequest, NextResponse } from 'next/server';
import { initializeKingsPayPayment, getKingsPayPaymentUrl } from '@/lib/kingspay-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, description, metadata, email } = body;

    // Validate required fields
    if (!amount || !description) {
      return NextResponse.json(
        { error: 'Amount and description are required' },
        { status: 400 }
      );
    }

    // Get base URL for callbacks
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Initialize payment
    const result = await initializeKingsPayPayment({
      amount,
      currency: 'ESP',
      description,
      merchant_callback_url: `${baseUrl}/api/payment/callback`,
      merchant_webhook_url: `${baseUrl}/api/payment/webhook`,
      payment_type: 'espees',
      metadata,
      email,
    });

    if (result.success && result.payment_id) {
      return NextResponse.json({
        success: true,
        payment_id: result.payment_id,
        payment_url: getKingsPayPaymentUrl(result.payment_id),
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to initialize payment' },
        { status: 500 }
      );
    }
  } catch (error) {
 console.error('Payment initialization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
