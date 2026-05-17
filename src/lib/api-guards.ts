import type { NextRequest } from 'next/server'
import { auth as adminAuth } from '@/lib/firebase-admin'

type RateLimitKeyFn = (req: NextRequest) => string

declare global {
  // eslint-disable-next-line no-var
  var __lwsrh_rate_limit_state:
    | Map<string, { count: number; resetAtMs: number }>
    | undefined
}

function getRateLimitStore() {
  if (!globalThis.__lwsrh_rate_limit_state) {
    globalThis.__lwsrh_rate_limit_state = new Map()
  }
  return globalThis.__lwsrh_rate_limit_state
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

export async function enforceRateLimit(opts: {
  /** stable unique name for this limiter */
  name: string
  /** tokens per interval */
  tokensPerInterval: number
  /** interval in ms */
  intervalMs: number
  /** key function (defaults to ip) */
  key?: RateLimitKeyFn
  req: NextRequest
}): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const keyFn = opts.key ?? ((req) => getClientIp(req))
  const key = `${opts.name}:${keyFn(opts.req)}`

  const now = Date.now()
  const store = getRateLimitStore()
  const current = store.get(key)

  if (!current || now >= current.resetAtMs) {
    store.set(key, { count: 1, resetAtMs: now + opts.intervalMs })
    return { ok: true }
  }

  if (current.count >= opts.tokensPerInterval) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((current.resetAtMs - now) / 1000),
    )
    return { ok: false, retryAfterSeconds }
  }

  current.count += 1
  store.set(key, current)
  return { ok: true }
}

export async function verifyFirebaseIdToken(req: NextRequest): Promise<{
  uid: string
  email?: string
  token: string
} | null> {
  const header = req.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]
  if (!token) return null

  // If Admin SDK isn't configured (local dev), treat as unauthenticated.
  if (!adminAuth?.app) return null

  try {
    const decoded = await adminAuth.verifyIdToken(token)
    return { uid: decoded.uid, email: (decoded as any).email, token }
  } catch {
    return null
  }
}

export function isInternalRequest(req: NextRequest, envKeyName: string): boolean {
  const expected = process.env[envKeyName]
  if (!expected) return false
  const provided = req.headers.get('x-internal-api-key')
  return !!provided && provided === expected
}

