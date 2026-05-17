import { FirebaseDatabaseService } from '@/lib/firebase-database'
import { PaymentRequest } from '@/config/subscriptions'

export interface PaymentSubmissionData {
  zoneId: string
  zoneName: string
  coordinatorName: string
  coordinatorEmail: string
  amount: number
  duration: 'monthly' | 'yearly'
  proofImageUrl: string
}

export class EspeesPaymentService {
  
  static async submitPaymentProof(data: PaymentSubmissionData): Promise<{ success: boolean; error?: string; paymentId?: string }> {
    try {
      const paymentId = `pay_${Date.now()}_${data.zoneId}`
      
      const paymentRequest: PaymentRequest = {
        id: paymentId,
        zoneId: data.zoneId,
        zoneName: data.zoneName,
        coordinatorName: data.coordinatorName,
        coordinatorEmail: data.coordinatorEmail,
        amount: data.amount,
        duration: data.duration,
        proofImageUrl: data.proofImageUrl,
        status: 'pending',
        submittedAt: new Date()
      }
      
      await FirebaseDatabaseService.createDocument('payment_requests', paymentId, paymentRequest)
      
      await FirebaseDatabaseService.updateDocument('zones', data.zoneId, {
        subscriptionStatus: 'pending',
        pendingPaymentId: paymentId,
        updatedAt: new Date()
      })
      
      return { success: true, paymentId }
    } catch (error) {
 console.error('Error submitting payment proof:', error)
      return { success: false, error: 'Failed to submit payment proof. Please try again.' }
    }
  }
  
  static async getPaymentRequest(paymentId: string): Promise<PaymentRequest | null> {
    try {
      const payment = await FirebaseDatabaseService.getDocument('payment_requests', paymentId)
      return payment as PaymentRequest || null
    } catch (error) {
 console.error('Error getting payment request:', error)
      return null
    }
  }
  
  static async getPendingPayments(): Promise<PaymentRequest[]> {
    try {
      const payments = await FirebaseDatabaseService.getDocuments('payment_requests', [
        { field: 'status', operator: '==', value: 'pending' }
      ])
      
      return payments
        .map((p: any) => p as PaymentRequest)
        .sort((a: PaymentRequest, b: PaymentRequest) => 
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        )
    } catch (error) {
 console.error('Error getting pending payments:', error)
      return []
    }
  }
  
  static async approvePayment(
    paymentId: string, 
    approvedBy: string, 
    customDurationMonths?: number,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const payment = await this.getPaymentRequest(paymentId)
      if (!payment) return { success: false, error: 'Payment request not found' }
      
      const durationMonths = customDurationMonths || (payment.duration === 'yearly' ? 12 : 1)
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + durationMonths)
      
      await FirebaseDatabaseService.updateDocument('payment_requests', paymentId, {
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: approvedBy,
        approvedDuration: durationMonths,
        notes: notes || ''
      })
      
      await FirebaseDatabaseService.updateDocument('zones', payment.zoneId, {
        subscriptionTier: 'premium',
        subscriptionStatus: 'active',
        subscriptionStartDate: new Date(),
        subscriptionExpiresAt: expiresAt,
        subscriptionAmount: payment.amount,
        maxMembers: 500,
        pendingPaymentId: null,
        updatedAt: new Date()
      })
      
      return { success: true }
    } catch (error) {
 console.error('Error approving payment:', error)
      return { success: false, error: 'Failed to approve payment. Please try again.' }
    }
  }
  
  static async rejectPayment(
    paymentId: string, 
    rejectedBy: string, 
    notes: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const payment = await this.getPaymentRequest(paymentId)
      if (!payment) return { success: false, error: 'Payment request not found' }
      
      await FirebaseDatabaseService.updateDocument('payment_requests', paymentId, {
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: rejectedBy,
        notes
      })
      
      await FirebaseDatabaseService.updateDocument('zones', payment.zoneId, {
        subscriptionStatus: 'active',
        pendingPaymentId: null,
        updatedAt: new Date()
      })
      
      return { success: true }
    } catch (error) {
 console.error('Error rejecting payment:', error)
      return { success: false, error: 'Failed to reject payment. Please try again.' }
    }
  }
  
  static async hasPendingPayment(zoneId: string): Promise<boolean> {
    try {
      const payments = await FirebaseDatabaseService.getDocuments('payment_requests', [
        { field: 'zoneId', operator: '==', value: zoneId },
        { field: 'status', operator: '==', value: 'pending' }
      ])
      return payments.length > 0
    } catch (error) {
 console.error('Error checking pending payment:', error)
      return false
    }
  }
  
  static async getZonePaymentHistory(zoneId: string): Promise<PaymentRequest[]> {
    try {
      const payments = await FirebaseDatabaseService.getDocuments('payment_requests', [
        { field: 'zoneId', operator: '==', value: zoneId }
      ])
      
      return payments
        .map((p: any) => p as PaymentRequest)
        .sort((a: PaymentRequest, b: PaymentRequest) => 
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        )
    } catch (error) {
 console.error('Error getting payment history:', error)
      return []
    }
  }
}
