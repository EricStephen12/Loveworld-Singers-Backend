// Device Registration Service
import { doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from './firebase-setup'

interface DeviceInfo {
  id: string
  userId: string
  userAgent: string
  platform: string
  vendor: string
  deviceMemory?: number
  hardwareConcurrency?: number
  screenResolution: string
  timezone: string
  createdAt: any
  lastSeen: any
}

export class DeviceRegistration {
  // Generate a unique device fingerprint
  static generateDeviceFingerprint(): string {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return 'server-env-device'
    }
    // Create a canvas fingerprint
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillStyle = '#f6f6f6'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#060606'
      ctx.fillText('Device fingerprint', 2, 2)
    }
    
    const canvasFingerprint = canvas.toDataURL()
    
    // Combine with other device characteristics
    const fingerprintData = [
      canvasFingerprint,
      navigator.userAgent,
      navigator.platform,
      navigator.vendor,
      window.screen.width + 'x' + window.screen.height,
      window.screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone
    ].join('|')
    
    // Generate hash
    return btoa(fingerprintData).slice(0, 32)
  }
  
  // Get detailed device information
  static getDeviceInfo(): DeviceInfo {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {
        id: 'server-env-device',
        userId: '',
        userAgent: 'server',
        platform: 'server',
        vendor: 'server',
        screenResolution: '0x0',
        timezone: 'UTC',
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp()
      }
    }
    return {
      id: this.generateDeviceFingerprint(),
      userId: '',
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor || 'Unknown',
      deviceMemory: (navigator as any).deviceMemory || undefined,
      hardwareConcurrency: navigator.hardwareConcurrency || undefined,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp()
    }
  }
  
  // Register device for a user
  static async registerDevice(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Ensure auth token is fresh so Firestore sees request.auth
      try {
        const auth = getAuth()
        if (auth.currentUser) {
          await auth.currentUser.getIdToken(true)
        }
      } catch {}

      const deviceInfo = this.getDeviceInfo()
      deviceInfo.userId = userId
      
            const deviceRef = doc(db, 'devices', deviceInfo.id)
      const deviceDoc = await getDoc(deviceRef)
      
      if (deviceDoc.exists()) {
        const existingDevice = deviceDoc.data()
        if (existingDevice.userId !== userId) {
          // Device registered to different user - this is account sharing
          return {
            success: false,
            error: 'This device is already registered to another account. Please sign up for your own account.'
          }
        }
        
                await setDoc(deviceRef, {
          lastSeen: serverTimestamp()
        }, { merge: true })
      } else {
        // Register new device
        await setDoc(deviceRef, deviceInfo)
      }
      
      // Clean up old devices (best-effort, do not block)
      try {
        void this.cleanupOldDevices(userId)
      } catch { /* ignore cleanup errors */ }
      
      return { success: true }
    } catch (error: any) {
 console.error('Error registering device:', error)
      const message = (error && (error.message || error.code)) ? `${error.code || ''} ${error.message || ''}`.trim() : 'Failed to register device'
      return { success: false, error: message }
    }
  }
  
    static async isDeviceRegisteredToOtherUser(userId: string): Promise<{ isRegistered: boolean; deviceInfo?: DeviceInfo }> {
    try {
      const deviceId = this.generateDeviceFingerprint()
      const deviceRef = doc(db, 'devices', deviceId)
      const deviceDoc = await getDoc(deviceRef)
      
      if (deviceDoc.exists()) {
        const deviceData = deviceDoc.data() as DeviceInfo
        if (deviceData.userId !== userId) {
          return { isRegistered: true, deviceInfo: deviceData }
        }
      }
      
      return { isRegistered: false }
    } catch (error) {
 console.error('Error checking device registration:', error)
      return { isRegistered: false }
    }
  }
  
  // Get user's registered devices
  static async getUserDevices(userId: string): Promise<DeviceInfo[]> {
    try {
      const devicesRef = collection(db, 'devices')
      const q = query(devicesRef, where('userId', '==', userId))
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DeviceInfo))
    } catch (error) {
 console.error('Error getting user devices:', error)
      return []
    }
  }
  
  // Remove device registration
  static async removeDevice(deviceId: string): Promise<void> {
    try {
      const deviceRef = doc(db, 'devices', deviceId)
      await deleteDoc(deviceRef)
    } catch (error) {
 console.error('Error removing device:', error)
    }
  }

  // Revoke all other devices for this user except the provided one
  static async revokeOtherDevices(userId: string, keepDeviceId: string): Promise<{ revokedCount: number }> {
    const devicesRef = collection(db, 'devices')
    const qByUser = query(devicesRef, where('userId', '==', userId))
    const snap = await getDocs(qByUser)
    let revoked = 0
    for (const d of snap.docs) {
      if (d.id !== keepDeviceId) {
        await deleteDoc(d.ref)
        revoked++
      }
    }
    return { revokedCount: revoked }
  }
  
  // Clean up old device registrations (older than 30 days)
  static async cleanupOldDevices(userId: string): Promise<void> {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const devicesRef = collection(db, 'devices')
      const q = query(
        devicesRef, 
        where('userId', '==', userId),
        where('lastSeen', '<', thirtyDaysAgo)
      )
      const querySnapshot = await getDocs(q)
      
      for (const doc of querySnapshot.docs) {
        await deleteDoc(doc.ref)
      }
    } catch (error) {
 console.error('Error cleaning up old devices:', error)
    }
  }
  
  // Get readable device name
  static getDeviceName(userAgent: string): string {
    // Samsung devices
    if (/SM-[A-Z0-9]+/.test(userAgent)) {
      const match = userAgent.match(/SM-[A-Z0-9]+/)
      return `Samsung ${match ? match[0] : 'Device'}`
    }
    
    // Itel devices
    if (/itel/i.test(userAgent)) {
      const match = userAgent.match(/itel[ _][A-Z0-9]+/i)
      return match ? match[0].replace(/_/g, ' ') : 'Itel Device'
    }
    
    // Other common devices
    if (/iPhone/.test(userAgent)) return 'iPhone'
    if (/iPad/.test(userAgent)) return 'iPad'
    if (/Android/.test(userAgent)) return 'Android Device'
    if (/Windows/.test(userAgent)) return 'Windows PC'
    if (/Mac/.test(userAgent)) return 'Mac'
    if (/Linux/.test(userAgent)) return 'Linux PC'
    
    return 'Unknown Device'
  }
}
