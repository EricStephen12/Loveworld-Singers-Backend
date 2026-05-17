// Session Management Service - Concurrent Login Prevention
import { doc, setDoc, getDoc, onSnapshot, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { signOut, User } from 'firebase/auth' // Static import
import { db, auth } from './firebase-setup' // Static import

interface UserSession {
  userId: string
  sessionId: string // NEW: Unique ID for this specific login instance
  deviceId: string
  deviceInfo: string
  deviceModel: string
  browserInfo: string
  osInfo: string
  loginTime: { seconds: number; nanoseconds: number } | any
  lastActivity: { seconds: number; nanoseconds: number } | any
  isActive: boolean
  terminatedAt?: any
  terminatedByDeviceId?: string
  terminatedReason?: string
}

export class SessionManager {
  private static deviceId: string = ''
  private static sessionId: string = ''
  private static sessionListener: (() => void) | null = null
  private static isExempt: boolean = false // Set once on login; exempt users are NEVER kicked out

  // Emails and zones that are permanently exempt from kickout
  private static readonly EXEMPT_EMAILS = ['takeshopstores@gmail.com']
  private static readonly EXEMPT_ZONES = ['zone-president', 'zone-president-2', 'zone-oftp']

  // Generate unique device ID (Persist in SessionStorage to survive reloads)
  static generateDeviceId(forceNew: boolean = false): string {
    // Try to recover from local storage first (unless forcing new)
    if (!forceNew && typeof window !== 'undefined') {
      const storedId = localStorage.getItem('lwsrh_device_id')
      if (storedId) {
        this.deviceId = storedId
        return storedId
      }
    }

    // If active instance exists and not forcing new, return it
    if (!forceNew && this.deviceId) return this.deviceId

    // Generate NEW unique fingerprint
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx!.textBaseline = 'top'
    ctx!.font = '14px Arial'
    ctx!.fillText('Device fingerprint', 2, 2)

    const fingerprint = canvas.toDataURL()
    const userAgent = navigator.userAgent
    const screen = `${window.screen.width}x${window.screen.height}`
    // Add randomness to ensure TAB separation and prevent collisions
    const entropy = Date.now().toString(36) + Math.random().toString(36).substring(2)

    // Create unique ID
    this.deviceId = btoa(`${fingerprint}-${userAgent}-${screen}-${entropy}`).slice(0, 32)

    // Persist
    if (typeof window !== 'undefined') {
      localStorage.setItem('lwsrh_device_id', this.deviceId)
    }

    return this.deviceId
  }

  // Generate Session ID (UUID) - Ephemeral, one per login
  static generateSessionId(): string {
    return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
  }

  // Get device info for display
  static getDeviceInfo(): string {
    const userAgent = navigator.userAgent
    let deviceInfo = 'Unknown Device'

    if (/iPhone|iPad|iPod/.test(userAgent)) {
      deviceInfo = 'iPhone/iPad'
    } else if (/Android/.test(userAgent)) {
      deviceInfo = 'Android Device'
    } else if (/Windows/.test(userAgent)) {
      deviceInfo = 'Windows PC'
    } else if (/Mac/.test(userAgent)) {
      deviceInfo = 'Mac'
    } else if (/Linux/.test(userAgent)) {
      deviceInfo = 'Linux PC'
    }

    // Add browser info
    if (/Chrome/.test(userAgent)) deviceInfo += ' (Chrome)'
    else if (/Firefox/.test(userAgent)) deviceInfo += ' (Firefox)'
    else if (/Safari/.test(userAgent)) deviceInfo += ' (Safari)'
    else if (/Edge/.test(userAgent)) deviceInfo += ' (Edge)'

    // Add specific device model if available
    const deviceModel = this.getDeviceModel(userAgent)
    if (deviceModel) {
      deviceInfo = deviceModel + ' ' + deviceInfo
    }

    return deviceInfo
  }

  // Get specific device model
  static getDeviceModel(userAgent: string): string | null {
    // Samsung devices
    const samsungMatch = userAgent.match(/SM-[A-Z0-9]+/)
    if (samsungMatch) {
      return `Samsung ${samsungMatch[0]}`
    }

    // Itel devices
    const itelMatch = userAgent.match(/itel[ _][A-Z0-9]+/i)
    if (itelMatch) {
      return itelMatch[0].replace(/_/g, ' ')
    }

    // Other Android devices
    const androidMatch = userAgent.match(/Android.*?([A-Za-z0-9 ]+?)(?:Build|;)/)
    if (androidMatch) {
      return androidMatch[1].trim()
    }

    return null
  }

  // Get browser information
  static getBrowserInfo(): string {
    const userAgent = navigator.userAgent
    if (/Chrome/.test(userAgent)) return 'Chrome'
    if (/Firefox/.test(userAgent)) return 'Firefox'
    if (/Safari/.test(userAgent)) return 'Safari'
    if (/Edge/.test(userAgent)) return 'Edge'
    return 'Unknown Browser'
  }

  // Get OS information
  static getOSInfo(): string {
    const userAgent = navigator.userAgent
    if (/Windows/.test(userAgent)) return 'Windows'
    if (/Mac/.test(userAgent)) return 'macOS'
    if (/Linux/.test(userAgent)) return 'Linux'
    if (/Android/.test(userAgent)) return 'Android'
    if (/iPhone|iPad|iPod/.test(userAgent)) return 'iOS'
    return 'Unknown OS'
  }

  static async canUserLogin(userId: string): Promise<{ canLogin: boolean; activeDevice?: string }> {
    // ALWAYS ALLOW LOGIN - "Kick out" strategy
    return { canLogin: true }
  }

  // Create new session for user (terminates existing sessions by overwriting)
  static async createSession(user: User): Promise<void> {
    try {
      // FORCE NEW ID on login
      const deviceId = this.generateDeviceId(true)
      this.sessionId = this.generateSessionId() // Generate new Session ID
      const deviceInfo = this.getDeviceInfo()
      const deviceModel = this.getDeviceModel(navigator.userAgent) || 'Unknown'
      const browserInfo = this.getBrowserInfo()
      const osInfo = this.getOSInfo()

      const session: UserSession = {
        userId: user.uid,
        sessionId: this.sessionId, // Store it
        deviceId,
        deviceInfo,
        deviceModel,
        browserInfo,
        osInfo,
        loginTime: serverTimestamp(),
        lastActivity: serverTimestamp(),
        isActive: true
      }

      const sessionRef = doc(db, 'user_sessions', user.uid)
      await setDoc(sessionRef, session)

      // Store Session ID locally for validity checks
      if (typeof window !== 'undefined') {
        localStorage.setItem('lwsrh_session_id', this.sessionId)
      }

      // Start tracking immediately
      this.startActivityTracking(user.uid)

    } catch (error) {
 console.error('Error creating session:', error)
    }
  }

  // Terminate existing session - Legacy (not needed with overwrite strategy but kept for admin)
  static async terminateExistingSession(userId: string, currentDeviceId: string): Promise<void> {
    // No-op in "Last Login Wins" model (overwrite handles it)
  }

  static async updateActivity(userId: string): Promise<void> {
    try {
      // Retrieve local session ID
      const storedSessionId = typeof window !== 'undefined' ? localStorage.getItem('lwsrh_session_id') : this.sessionId

      // Safety check: If we don't have a session ID, we might be in a bad state
      if (!storedSessionId) return

      // Attempt update
      const sessionRef = doc(db, 'user_sessions', userId)

      // We perform a "Pre-condition check" implicitly via Security Rules (to be added)
      // OR we just try to write. if it fails with permission denied, we know we are dead.
      await setDoc(sessionRef, {
        lastActivity: serverTimestamp()
      }, { merge: true })

    } catch (error: any) {
      // TRAP: If write fails (Permission Denied implies our Session ID is old), we die.
      if (error.code === 'permission-denied') {
 console.warn('[Session]  Activity update blocked! Session invalid. Logging out.')
        this.handleSessionTermination()
      } else {
 console.error('Error updating activity:', error)
      }
    }
  }

  // Fetch profile once and set the isExempt flag permanently for this session
  static async checkAndSetExemption(userId: string): Promise<void> {
    try {
      // Synchronous check: if we already have it in localStorage, set it immediately
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('lwsrh_is_exempt')
        if (cached === 'true') {
          SessionManager.isExempt = true
        }
      }

      const profileRef = doc(db, 'profiles', userId)
      const profileSnap = await getDoc(profileRef)
      if (profileSnap.exists()) {
        const profile = profileSnap.data()
        const email = (profile.email || '').toLowerCase()
        
        // 1. Explicit Email/Zone Exemption (Legacy)
        const isExemptByEmail = SessionManager.EXEMPT_EMAILS.includes(email)
        const isExemptByZone = profile.zone && SessionManager.EXEMPT_ZONES.includes(profile.zone)
        
        // 2. Role-Based Exemption (Admins, HQ Admins, Bosses)
        const isExemptByRole = ['super_admin', 'boss', 'hq_admin', 'admin'].includes(profile.role)
        
        // 3. HQ Email-Based Exemption (Single Source of Truth)
        const { isHQAdminEmail } = await import('@/config/roles')
        const isExemptByHQEmail = isHQAdminEmail(email)

        SessionManager.isExempt = isExemptByEmail || !!isExemptByZone || isExemptByRole || isExemptByHQEmail

        if (SessionManager.isExempt) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('lwsrh_is_exempt', 'true')
          }
        } else {
          if (typeof window !== 'undefined') {
            localStorage.setItem('lwsrh_is_exempt', 'false')
          }
        }
      }
    } catch (e) {
      console.error('[Session] checkAndSetExemption failed:', e)
    }
  }

  // Start tracking user session validity
  static async startActivityTracking(userId: string): Promise<void> {
    if (this.sessionListener) {
      this.sessionListener() // Unsubscribe pending
    }

    // Check exemption FIRST and await it to prevent race condition with onSnapshot
    await this.checkAndSetExemption(userId)

    // Ensure we have an ID
    if (!this.deviceId) {
      this.generateDeviceId()
    }

    // ALWAYS read sessionId from localStorage — this is shared across all tabs
    // in the same browser, so same-browser tabs will never mismatch each other.
    if (typeof window !== 'undefined') {
      this.sessionId = localStorage.getItem('lwsrh_session_id') || this.sessionId
    }


    const sessionRef = doc(db, 'user_sessions', userId)
    // Real-time listener (Push Model - Industry Standard)
    // Removed { includeMetadataChanges: true } to prevent firing on every network flicker/cache sync.
    const unsubscribe = onSnapshot(sessionRef, async (docSnap) => {
      // 0. Exempt Guard: If this user is permanently exempt, NEVER kick them out
      if (SessionManager.isExempt) {
        return
      }

      // 1. Offline Guard: Never kick out if the device is currently offline
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return
      }

      if (docSnap.exists()) {
        const data = docSnap.data() as UserSession

        // Guard: If WE have no session ID yet (browser-cached login, new tab, page refresh),
        // ADOPT the existing Firestore session instead of treating it as a conflict.
        // This prevents kicking out users who are simply restoring their session.
        if (data.sessionId && !this.sessionId) {
          this.sessionId = data.sessionId
          if (typeof window !== 'undefined') {
            localStorage.setItem('lwsrh_session_id', this.sessionId)
          }
          return
        }

        // The "Highlander" Check — only runs when WE have a session ID that genuinely differs.
        // This catches: login from a different device/browser which created a new sessionId.
        if (data.sessionId && this.sessionId && data.sessionId !== this.sessionId) {
          
          // 1. Tab-Sync Check: Did another tab in THIS browser already update our session?
          const sharedSessionId = typeof window !== 'undefined' ? localStorage.getItem('lwsrh_session_id') : null
          if (sharedSessionId === data.sessionId) {
            this.sessionId = data.sessionId
            return
          }

          // 2. Multi-Device Conflict Verification
          // Wait 2 seconds and re-verify from server (avoids local cache flutters)
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          const latestSnap = await getDoc(sessionRef)
          const latestData = latestSnap.data() as UserSession
          
          // Final check: if the shared storage ID changed WHILE we were waiting, adopt it
          const finalSharedId = typeof window !== 'undefined' ? localStorage.getItem('lwsrh_session_id') : null
          if (finalSharedId === latestData?.sessionId && finalSharedId !== this.sessionId) {
            this.sessionId = finalSharedId!
            return
          }

          if (!latestData || (latestData.sessionId && latestData.sessionId !== this.sessionId)) {
            // 3. Same-Device Identity Check
            // If the DeviceID in Firestore matches ours, it's a re-login on the same browser/app.
            // We should adopt the session rather than kicking the user out.
            const myDeviceId = typeof window !== 'undefined' ? localStorage.getItem('lwsrh_device_id') : this.deviceId
            if (latestData?.deviceId === myDeviceId) {
              this.sessionId = latestData.sessionId
              if (typeof window !== 'undefined') {
                localStorage.setItem('lwsrh_session_id', this.sessionId)
              }
              return
            }

            console.warn(`[Session]  Session Mismatch! Active=${latestData?.sessionId} vs Me=${this.sessionId}`)
            this.handleSessionTermination()
          }
        }
      } else {
        // Only terminate if we are definitely online and the doc is gone
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          console.warn(`[Session]  Session deleted.`)
          this.handleSessionTermination()
        }
      }
    }, (error: any) => {
      console.error('[Session]  Listener error:', error)
    })

    this.sessionListener = unsubscribe
  }

  // Handle session termination (user logged in elsewhere)
  static async handleSessionTermination(): Promise<void> {
    // 1. Stop listening immediately to prevent loops
    if (this.sessionListener) {
      this.sessionListener()
      this.sessionListener = null
    }

 console.warn(' SESSION TERMINATED ')
    const currentPath = window.location.pathname

    // Don't kick if already on auth page
    if (currentPath.includes('/auth')) return

    try {
      await signOut(auth)
      SessionManager.clearSessionState()
      
      // Force redirect to login with message
      if (typeof window !== 'undefined') {
        window.location.href = '/auth?error=session_taken_over&message=You were logged out because this account was used on another device.'
      }
    } catch (e) {
 console.error('Logout failed', e)
      // Failsafe redirect
      window.location.href = '/auth'
    }
  }

  // End session
  static async endSession(userId: string): Promise<void> {
    try {
      const sessionRef = doc(db, 'user_sessions', userId)
      await deleteDoc(sessionRef)

      if (this.sessionListener) {
        this.sessionListener()
        this.sessionListener = null
      }
    } catch (error) {
 console.error('Error ending session:', error)
    }
  }

  // Force logout user from all devices (admin function)
  static async forceLogoutUser(userId: string): Promise<void> {
    try {
      const sessionRef = doc(db, 'user_sessions', userId)
      await setDoc(sessionRef, {
        isActive: false,
        terminatedAt: serverTimestamp(),
        terminatedReason: 'admin_force_logout'
      }, { merge: true })
    } catch (error) {
 console.error('Error force logging out user:', error)
    }
  }

  // Clear all local session state
  static clearSessionState(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken')
      localStorage.removeItem('userId')
      localStorage.removeItem('lwsrh_has_user')
      localStorage.removeItem('lwsrh_is_exempt')
      localStorage.removeItem('lwsrh_session_id')
      localStorage.removeItem('lwsrh_device_id')
    }
    this.sessionId = ''
    this.isExempt = false
  }
}
