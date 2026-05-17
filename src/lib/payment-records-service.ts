import { FirebaseDatabaseService } from './firebase-database'

export interface PaymentRecord {
    id: string // payment_id from KingsPay
    userId: string
    userEmail?: string
    userName?: string
    kingschatUserId?: string // For sending notifications

    // Payment details
    amount: number
    currency: string
    status: 'success' | 'failed' | 'refunded' | 'pending'
    paymentMethod: 'espees'
    paymentCode?: string
    transactionRef?: string

    // Subscription details
    subscriptionType: 'individual' | 'zone'
    subscriptionPeriod: {
        start: Date
        end: Date
    }

    // Receipt
    receiptUrl?: string
    receiptGenerated?: boolean

    // Metadata
    metadata?: {
        zoneId?: string
        zoneName?: string
        memberCount?: number
        ipAddress?: string
        userAgent?: string
    }

    // Timestamps
    createdAt: Date
    processedAt?: Date
    refundedAt?: Date
    refundReason?: string
    refundedBy?: string
}

export interface SubscriptionAuditLog {
    id: string
    userId: string
    action: 'created' | 'activated' | 'extended' | 'revoked' | 'expired' | 'refunded' | 'cancelled'
    performedBy: string // userId or 'system' or 'admin:{adminId}'
    previousStatus?: string
    newStatus: string
    reason?: string
    metadata?: {
        paymentId?: string
        amount?: number
        expiryDate?: string
        [key: string]: any
    }
    timestamp: Date
}

export class PaymentRecordsService {

    /**
     * Create a new payment record
     */
    static async createPaymentRecord(data: Omit<PaymentRecord, 'id' | 'createdAt'>): Promise<PaymentRecord> {
        const paymentId = data.metadata?.zoneId
            ? `pay_${Date.now()}_zone_${data.metadata.zoneId}`
            : `pay_${Date.now()}_user_${data.userId}`

        const record: PaymentRecord = {
            ...data,
            id: paymentId,
            createdAt: new Date(),
            receiptGenerated: false
        }

        await FirebaseDatabaseService.createDocument('payment_records', paymentId, record)
        return record
    }

    /**
     * Update payment record
     */
    static async updatePaymentRecord(
        paymentId: string,
        updates: Partial<PaymentRecord>
    ): Promise<boolean> {
        try {
            await FirebaseDatabaseService.updateDocument('payment_records', paymentId, {
                ...updates,
                updatedAt: new Date()
            })
            return true
        } catch (error) {
 console.error('Error updating payment record:', error)
            return false
        }
    }

    /**
     * Get payment record by ID
     */
    static async getPaymentRecord(paymentId: string): Promise<PaymentRecord | null> {
        try {
            const record = await FirebaseDatabaseService.getDocument('payment_records', paymentId)
            return record as PaymentRecord | null
        } catch (error) {
 console.error('Error getting payment record:', error)
            return null
        }
    }

    /**
     * Get user's payment history
     */
    static async getUserPaymentHistory(userId: string): Promise<PaymentRecord[]> {
        try {
            const records = await FirebaseDatabaseService.getDocuments('payment_records', [
                { field: 'userId', operator: '==', value: userId }
            ])

            return records
                .map((r: any) => r as PaymentRecord)
                .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        } catch (error) {
            console.error('Error getting payment history:', error)
            return []
        }
    }

    /**
     * Get all payment records (admin only)
     */
    static async getAllPaymentRecords(filters?: {
        status?: PaymentRecord['status']
        subscriptionType?: PaymentRecord['subscriptionType']
        startDate?: Date
        endDate?: Date
    }): Promise<PaymentRecord[]> {
        try {
            const conditions: any[] = []

            if (filters?.status) {
                conditions.push({ field: 'status', operator: '==', value: filters.status })
            }
            if (filters?.subscriptionType) {
                conditions.push({ field: 'subscriptionType', operator: '==', value: filters.subscriptionType })
            }

            const records = await FirebaseDatabaseService.getDocuments('payment_records', conditions)

            let filtered = records.map((r: any) => r as PaymentRecord)

            // Client-side date filtering (Firestore date queries can be complex)
            if (filters?.startDate) {
                filtered = filtered.filter((r: any) => new Date(r.createdAt) >= filters.startDate!)
            }
            if (filters?.endDate) {
                filtered = filtered.filter((r: any) => new Date(r.createdAt) <= filters.endDate!)
            }

            return filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        } catch (error) {
            console.error('Error getting all payment records:', error)
            return []
        }
    }

    /**
     * Mark payment as refunded
     */
    static async refundPayment(
        paymentId: string,
        refundedBy: string,
        reason: string
    ): Promise<boolean> {
        try {
            await this.updatePaymentRecord(paymentId, {
                status: 'refunded',
                refundedAt: new Date(),
                refundedBy,
                refundReason: reason
            })
            return true
        } catch (error) {
            console.error('Error refunding payment:', error)
            return false
        }
    }
}

export class SubscriptionAuditService {

    /**
     * Log subscription action
     */
    static async logAction(data: Omit<SubscriptionAuditLog, 'id' | 'timestamp'>): Promise<void> {
        try {
            const logId = `audit_${Date.now()}_${data.userId}_${data.action}`

            const log: SubscriptionAuditLog = {
                ...data,
                id: logId,
                timestamp: new Date()
            }

            await FirebaseDatabaseService.createDocument('subscription_audit_logs', logId, log)
        } catch (error) {
            console.error('Error logging subscription action:', error)
        }
    }

    /**
     * Get user's audit history
     */
    static async getUserAuditHistory(userId: string): Promise<SubscriptionAuditLog[]> {
        try {
            const logs = await FirebaseDatabaseService.getDocuments('subscription_audit_logs', [
                { field: 'userId', operator: '==', value: userId }
            ])

            return logs
                .map((l: any) => l as SubscriptionAuditLog)
                .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        } catch (error) {
            console.error('Error getting audit history:', error)
            return []
        }
    }

    /**
     * Get all audit logs (admin only)
     */
    static async getAllAuditLogs(limit: number = 100): Promise<SubscriptionAuditLog[]> {
        try {
            const logs = await FirebaseDatabaseService.getDocuments('subscription_audit_logs', [])

            return logs
                .map((l: any) => l as SubscriptionAuditLog)
                .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, limit)
        } catch (error) {
            console.error('Error getting all audit logs:', error)
            return []
        }
    }
}
