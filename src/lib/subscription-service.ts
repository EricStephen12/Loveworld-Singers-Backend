import { FirebaseDatabaseService } from './firebase-database'
import { initializeKingsPayPayment, getKingsPayPaymentUrl, getKingsPayPaymentStatus } from './kingspay-service'
import { calculateSubscriptionPrice, calculateIndividualPrice } from './subscription-pricing'

export interface ZoneSubscription {
  id: string
  zoneId: string
  status: 'free' | 'active' | 'expired' | 'pending'
  plan: 'free' | 'premium'
  memberCount: number
  amountPaid?: number
  currency?: string
  paymentId?: string
  paidBy?: string
  paidAt?: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

export interface IndividualSubscription {
  id: string
  userId: string
  status: 'active' | 'expired' | 'pending'
  amountPaid: number
  currency: string
  paymentId: string
  paidAt: string
  expiresAt: string
  createdAt: string
  updatedAt: string
}

export async function initializeZoneSubscription(
  zoneId: string,
  memberCount: number,
  coordinatorId: string,
  coordinatorEmail?: string
): Promise<{ success: boolean; payment_url?: string; error?: string }> {
  try {
    const pricing = calculateSubscriptionPrice(memberCount)

    const result = await initializeKingsPayPayment({
      amount: pricing.priceInKobe,
      currency: 'ESP',
      description: `Premium Subscription - ${memberCount} members`,
      merchant_callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/callback`,
      merchant_webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/webhook`,
      payment_type: 'espees',
      metadata: {
        type: 'zone_subscription',
        zoneId,
        memberCount,
        coordinatorId,
        basePrice: pricing.basePrice,
        discount: pricing.discount,
        finalPrice: pricing.finalPrice,
      },
      email: coordinatorEmail,
    })

    if (result.success && result.payment_id) {
      await FirebaseDatabaseService.createDocument('zone_subscriptions', zoneId, {
        zoneId,
        status: 'pending',
        plan: 'premium',
        memberCount,
        paymentId: result.payment_id,
        paidBy: coordinatorId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      return { success: true, payment_url: getKingsPayPaymentUrl(result.payment_id) }
    }
    return { success: false, error: result.error || 'Failed to initialize payment' }
  } catch (error) {
 console.error('Error initializing zone subscription:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function initializeIndividualSubscription(
  userId: string,
  zoneId: string,
  userEmail?: string
): Promise<{ success: boolean; payment_url?: string; error?: string }> {
  try {
    const pricing = calculateIndividualPrice()

    const result = await initializeKingsPayPayment({
      amount: pricing.priceInKobe,
      currency: 'ESP',
      description: 'Premium Subscription - Individual',
      merchant_callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/callback`,
      merchant_webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/webhook`,
      payment_type: 'espees',
      metadata: { type: 'individual_subscription', userId, zoneId, price: pricing.price },
      email: userEmail,
    })

    if (result.success && result.payment_id) {
      const subscriptionId = userId // Global account-based lookup
      await FirebaseDatabaseService.createDocument('individual_subscriptions', subscriptionId, {
        userId,
        status: 'pending',
        paymentId: result.payment_id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      return { success: true, payment_url: getKingsPayPaymentUrl(result.payment_id) }
    }
    return { success: false, error: result.error || 'Failed to initialize payment' }
  } catch (error) {
 console.error('Error initializing individual subscription:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function getZoneSubscription(zoneId: string): Promise<ZoneSubscription | null> {
  try {
    const doc = await FirebaseDatabaseService.getDocument('zone_subscriptions', zoneId)
    return doc as ZoneSubscription | null
  } catch (error) {
 console.error('Error getting zone subscription:', error)
    return null
  }
}

export async function getIndividualSubscription(
  userId: string
): Promise<IndividualSubscription | null> {
  try {
    const subscriptionId = userId
    const doc = await FirebaseDatabaseService.getDocument('individual_subscriptions', subscriptionId)
    return doc as IndividualSubscription | null
  } catch (error) {
 console.error('Error getting individual subscription:', error)
    return null
  }
}

export async function hasPremiumAccess(userId: string, zoneId?: string): Promise<boolean> {
  try {
    // 1. Check if user has global individual premium status
    const individualSubscription = await getIndividualSubscription(userId)
    if (individualSubscription?.status === 'active') return true

    // 2. Check if the specific zone has premium (Legacy Support / HQ)
    if (zoneId) {
      const zoneSubscription = await getZoneSubscription(zoneId)
      if (zoneSubscription?.status === 'active') return true
    }

    return false
  } catch (error) {
 console.error('Error checking premium access:', error)
    return false
  }
}

export async function syncPaymentStatus(
  userId: string,
  type: 'individual' | 'zone',
  targetId: string // userId or zoneId
): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    let subscription: any = null
    const collectionName = type === 'individual' ? 'individual_subscriptions' : 'zone_subscriptions'
    
    subscription = await FirebaseDatabaseService.getDocument(collectionName, targetId)
    
    if (!subscription || subscription.status !== 'pending' || !subscription.paymentId) {
      return { success: true, status: subscription?.status || 'none' }
    }

    //  Check REAL status from KingsPay
    const kpStatus = await getKingsPayPaymentStatus(subscription.paymentId)
    
    if (kpStatus?.status === 'SUCCESS') {
      const expiresAt = new Date()
      expiresAt.setFullYear(expiresAt.getFullYear() + 1) // 1 year default

      const updateData = {
        status: 'active',
        paidAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        updatedAt: new Date().toISOString()
      }

      await FirebaseDatabaseService.updateDocument(collectionName, targetId, updateData)
      return { success: true, status: 'active' }
    }

    return { success: true, status: 'pending' }
  } catch (error) {
    console.error('Error syncing payment status:', error)
    return { success: false, error: 'Reconciliation failed' }
  }
}

export async function cancelSubscription(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const subscriptionId = userId;
    await FirebaseDatabaseService.updateDocument('individual_subscriptions', subscriptionId, {
      status: 'cancelled',
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
 console.error('Error cancelling subscription:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
