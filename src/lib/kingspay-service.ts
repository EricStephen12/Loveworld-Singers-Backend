import { KINGSPAY_CONFIG } from '@/config/subscriptions'

export interface KingsPayInitializeParams {
  amount: number
  currency: string
  description: string
  merchant_callback_url: string
  merchant_webhook_url: string
  metadata?: Record<string, any>
  payment_type: 'espees'
  email?: string
}

export interface KingsPayInitializeResponse {
  success: boolean
  payment_id?: string
  message?: string
  error?: string
  statusCode?: number
}

export interface KingsPayPaymentStatus {
  amount: string
  currency: string
  description: string
  environment: string
  merchant_callback_url: string
  metadata: Record<string, any>
  status: 'INITIALIZED' | 'WAITING' | 'SUCCESS' | 'FAILED'
  merchant_name: string
  payment_id: string
  payment_type: { type: string }
}

export async function initializeKingsPayPayment(
  params: KingsPayInitializeParams
): Promise<KingsPayInitializeResponse> {
  try {
    const secretKey = process.env.KINGSPAY_SECRET_KEY || process.env.NEXT_PUBLIC_KINGSPAY_SECRET_KEY

    if (!secretKey) {
 console.error(' KingsPay secret key not configured')
      return { success: false, error: 'Payment system not configured' }
    }



    // Add a timeout to the fetch request
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

    const requestBody: any = {
      amount: Number(params.amount),
      currency: params.currency || 'ESP',
      description: params.description,
      merchant_callback_url: params.merchant_callback_url,
      merchant_webhook_url: params.merchant_webhook_url,
      payment_type: params.payment_type || 'espees',
      metadata: params.metadata || {}
    }

    if (KINGSPAY_CONFIG.clientId) {
      requestBody.client_id = KINGSPAY_CONFIG.clientId
    }

    if (params.email) {
      requestBody.email = params.email
    }



    const response = await fetch(`${KINGSPAY_CONFIG.apiUrl}/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    const responseText = await response.text()

    let data
    try {
      data = JSON.parse(responseText)
    } catch (e) {
 console.error('Failed to parse KingsPay response as JSON')
      return { success: false, error: `Invalid API response: ${responseText.substring(0, 100)}` }
    }

    if (response.ok && data.payment_id) {
      return { success: true, payment_id: data.payment_id, message: data.message, statusCode: response.status }
    }
    return { success: false, error: data.message || 'Failed to initialize payment', statusCode: response.status }
  } catch (error: any) {
    if (error.name === 'AbortError') {
 console.error(' KingsPay Request Timeout: The API didn\'t respond within 15 seconds.')
      return { success: false, error: 'Payment initialization timed out. KingsPay API may be down.', statusCode: 504 }
    }
 console.error(' Error initializing KingsPay payment:', error)
    return { success: false, error: `Network error: ${error.message || 'Unknown error'}`, statusCode: 500 }
  }
}

export async function getKingsPayPaymentStatus(
  paymentId: string
): Promise<KingsPayPaymentStatus | null> {
  try {
    const response = await fetch(`${KINGSPAY_CONFIG.apiUrl}/${paymentId}`)
    if (response.ok) return await response.json()
    return null
  } catch (error) {
 console.error('Error getting payment status:', error)
    return null
  }
}

export async function cancelKingsPayPayment(
  paymentId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${KINGSPAY_CONFIG.apiUrl}/${paymentId}/cancel`)

    if (response.ok) {
      const data = await response.json()
      return { success: true, message: data.message }
    }
    return { success: false, message: 'Failed to cancel payment' }
  } catch (error) {
 console.error('Error canceling payment:', error)
    return { success: false, message: 'Network error' }
  }
}

export function getKingsPayPaymentUrl(paymentId: string): string {
  return `${KINGSPAY_CONFIG.paymentUrl}?id=${paymentId}`
}

export function verifyKingsPayWebhookSignature(
  signature: string,
  payload: string,
  secretKey: string
): boolean {
  try {
    const crypto = require('crypto')
    const hmac = crypto.createHmac('sha256', secretKey)
    hmac.update(payload)
    const expectedSignature = hmac.digest('hex')
    return signature === expectedSignature
  } catch (error) {
 console.error('Error verifying webhook signature:', error)
    return false
  }
}
