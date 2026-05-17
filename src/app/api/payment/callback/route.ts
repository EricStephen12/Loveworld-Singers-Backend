import { NextRequest, NextResponse } from 'next/server';
import { getKingsPayPaymentStatus } from '@/lib/kingspay-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paymentId = searchParams.get('id');

    if (!paymentId) {
      return NextResponse.redirect(new URL('/subscription?error=no_payment_id', request.url));
    }

    // Get payment status
    const status = await getKingsPayPaymentStatus(paymentId);

    if (!status) {
      return NextResponse.redirect(new URL('/subscription?error=status_check_failed', request.url));
    }

    // Redirect based on payment status
    if (status.status === 'SUCCESS') {
      return NextResponse.redirect(
        new URL(`/subscription?success=true&payment_id=${paymentId}`, request.url)
      );
    } else if (status.status === 'FAILED') {
      return NextResponse.redirect(
        new URL(`/subscription?error=payment_failed&payment_id=${paymentId}`, request.url)
      );
    } else {
      return NextResponse.redirect(
        new URL(`/subscription?status=${status.status}&payment_id=${paymentId}`, request.url)
      );
    }
  } catch (error) {
 console.error('Payment callback error:', error);
    return NextResponse.redirect(new URL('/subscription?error=callback_error', request.url));
  }
}
