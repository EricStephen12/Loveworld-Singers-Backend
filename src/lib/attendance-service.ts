import { db, FieldValue } from './firebase-admin'
import { HQ_GROUP_IDS, BOSS_ZONE_ID } from '@/config/zones'

export interface AttendanceRecord {
  id?: string
  user_id: string
  event_type: 'rehearsal' | 'service' | 'event'
  event_name: string
  check_in_time: string
  check_out_time?: string
  qr_code_used?: string
  status: 'present' | 'late' | 'absent'
  notes?: string
  zone_id?: string
  created_at?: any
  date_string: string // "YYYY-MM-DD"
}

export class AttendanceService {
  // Check in user for attendance
  static async checkIn(userId: string, qrCode: string, eventName: string = 'Rehearsal', zoneId?: string): Promise<{ success: boolean; message: string; record?: AttendanceRecord }> {
    try {
      // Verify QR code is valid (not expired)
      const qrData = this.parseQRCode(qrCode)
      if (!qrData.isValid) {
        return { success: false, message: 'Invalid or expired QR code' }
      }

      const scannedUserId = qrData.userId
      if (!scannedUserId) {
        return { success: false, message: 'Invalid QR code format' }
      }

      // Use LOCAL date string for daily tracking
      const now = new Date()
      const dateString = now.toLocaleDateString('en-CA') // Format: YYYY-MM-DD
      const timestampString = now.toISOString()

      // Get today's attendance record for this user and event
      const snapshot = await db.collection('attendance')
        .where('user_id', '==', scannedUserId)
        .where('date_string', '==', dateString)
        .where('event_name', '==', eventName)
        .limit(1)
        .get()

      const fullName = await this.getUserFullName(scannedUserId)
      const nowTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      if (!snapshot.empty) {
        const doc = snapshot.docs[0]
        const existingRecord = { id: doc.id, ...doc.data() } as any

        // Logic: already clocked in, perform CLOCK OUT or update it
        const updateData = {
          check_out_time: timestampString,
          updatedAt: FieldValue.serverTimestamp()
        }

        await db.collection('attendance').doc(doc.id).update(updateData)

        const action = existingRecord.check_out_time ? 're-clocked out' : 'clocked out'
        return {
          success: true,
          message: `${fullName} ${action} at ${nowTimeStr}`,
          record: { ...existingRecord, ...updateData } as any
        }
      }

      // No record for today: perform CLOCK IN
      const attendanceData = {
        user_id: scannedUserId,
        event_type: 'rehearsal',
        event_name: eventName,
        check_in_time: timestampString,
        date_string: dateString,
        qr_code_used: qrCode,
        status: this.determineStatus(),
        notes: 'Checked in via QR code',
        zone_id: zoneId || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }

      const result = await db.collection('attendance').add(attendanceData)

      return {
        success: true,
        message: `${fullName} clocked in at ${nowTimeStr}`,
        record: { ...attendanceData, id: result.id } as any
      }
    } catch (error) {
      console.error('Check-in error:', error)
      return { success: false, message: 'Failed to process attendance. Please try again.' }
    }
  }

  // Helper method to fetch and format user's full name
  public static async getUserFullName(userId: string): Promise<string> {
    try {
      const doc = await db.collection('profiles').doc(userId).get()
      if (doc.exists) {
        const profile = doc.data() as any
        const first = profile.first_name || profile.firstName || ''
        const last = profile.last_name || profile.lastName || ''
        if (first || last) {
          return `${first} ${last}`.trim()
        }
      }
      return 'Member'
    } catch (error) {
      console.error('Error fetching user profile for attendance:', error)
      return 'Member'
    }
  }

  // Get user's attendance history
  static async getUserAttendance(userId: string, limitCount: number = 10): Promise<AttendanceRecord[]> {
    try {
      const snapshot = await db.collection('attendance')
        .where('user_id', '==', userId)
        .orderBy('check_in_time', 'desc')
        .limit(limitCount)
        .get()

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord))
    } catch (error) {
      console.error('Get attendance error:', error)
      return []
    }
  }

  // Get attendance for an entire zone
  static async getZoneAttendance(zoneId: string, isHQ: boolean = false, limitCount: number = 100): Promise<(AttendanceRecord & { user_name: string })[]> {
    try {
      let query: any = db.collection('attendance')

      if (isHQ) {
        const hqZones = [...HQ_GROUP_IDS, BOSS_ZONE_ID]
        query = query.where('zone_id', 'in', hqZones)
      } else {
        query = query.where('zone_id', '==', zoneId)
      }

      const snapshot = await query.orderBy('check_in_time', 'desc').limit(limitCount).get()

      // Fetch user names for the records
      const enrichedRecords = await Promise.all(
        snapshot.docs.map(async (doc: any) => {
          const record = { id: doc.id, ...doc.data() }
          const userName = await this.getUserFullName(record.user_id)
          return { ...record, user_name: userName } as AttendanceRecord & { user_name: string }
        })
      )

      return enrichedRecords
    } catch (error) {
      console.error('Get zone attendance error:', error)
      return []
    }
  }

  // Generate QR code for attendance
  static generateAttendanceQR(userId: string): string {
    const timestamp = Math.floor(Date.now() / 300000) // Changes every 5 minutes
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `LW-ATTEND-${userId}-${timestamp}-${randomCode}`
  }

  // Parse and validate QR code
  static parseQRCode(qrCode: string): { isValid: boolean; userId?: string; timestamp?: number } {
    try {
      const parts = qrCode.split('-')
      if (parts.length < 5 || parts[0] !== 'LW' || parts[1] !== 'ATTEND') {
        return { isValid: false }
      }

      const timestampPart = parts[parts.length - 2]
      const timestamp = parseInt(timestampPart)
      const userIdParts = parts.slice(2, parts.length - 2)
      const userId = userIdParts.join('-')

      const currentTimeWindow = Math.floor(Date.now() / 300000)

      if (Math.abs(currentTimeWindow - timestamp) > 1) {
        return { isValid: false }
      }

      return { isValid: true, userId, timestamp }
    } catch {
      return { isValid: false }
    }
  }

  // Determine if user is on time, late, or absent
  private static determineStatus(): 'present' | 'late' | 'absent' {
    const now = new Date()
    const hour = now.getHours()
    if (hour < 21) return 'present'
    if (hour === 21) return 'late'
    return 'absent'
  }

  // Get attendance statistics
  static async getAttendanceStats(userId: string): Promise<{ total: number; present: number; late: number; absent: number; rate: number }> {
    try {
      const snapshot = await db.collection('attendance')
        .where('user_id', '==', userId)
        .get()

      const total = snapshot.size
      const present = snapshot.docs.filter(doc => doc.data().status === 'present').length
      const late = snapshot.docs.filter(doc => doc.data().status === 'late').length
      const absent = snapshot.docs.filter(doc => doc.data().status === 'absent').length
      const rate = total > 0 ? Math.round((present / total) * 100) : 0

      return { total, present, late, absent, rate }
    } catch (error) {
      console.error('Get stats error:', error)
      return { total: 0, present: 0, late: 0, absent: 0, rate: 0 }
    }
  }
}
