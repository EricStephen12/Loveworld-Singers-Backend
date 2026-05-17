// Comprehensive Backup Service for Firebase Data
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from './firebase-setup'

interface BackupData {
  users: any[]
  profiles: any[]
  songs: any[]
  praiseNights: any[]
  sessions: any[]
  comments: any[]
  attendance: any[]
  achievements: any[]
  conversations: any[]
  messages: any[]
  exportDate: string
  totalRecords: number
}

export class BackupService {
  
  // Export all data to JSON
  static async exportToJSON(): Promise<string> {
    try {
      
      const backupData: BackupData = {
        users: [],
        profiles: [],
        songs: [],
        praiseNights: [],
        sessions: [],
        comments: [],
        attendance: [],
        achievements: [],
        conversations: [],
        messages: [],
        exportDate: new Date().toISOString(),
        totalRecords: 0
      }
      
      // Export Users/Profiles
      const profilesSnapshot = await getDocs(collection(db, 'profiles'))
      backupData.profiles = profilesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      // Export Songs
      try {
        const songsSnapshot = await getDocs(collection(db, 'songs'))
        backupData.songs = songsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      } catch (e) {
      }
      
      // Export Praise Nights
      try {
        const praiseNightsSnapshot = await getDocs(collection(db, 'praise_nights'))
        backupData.praiseNights = praiseNightsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      } catch (e) {
      }
      
      // Export User Sessions
      try {
        const sessionsSnapshot = await getDocs(collection(db, 'user_sessions'))
        backupData.sessions = sessionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      } catch (e) {
      }
      
      // Export Attendance
      try {
        const attendanceSnapshot = await getDocs(collection(db, 'attendance'))
        backupData.attendance = attendanceSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      } catch (e) {
      }
      
      // Export Achievements
      try {
        const achievementsSnapshot = await getDocs(collection(db, 'achievements'))
        backupData.achievements = achievementsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      } catch (e) {
      }
      
      // Export Conversations
      try {
        const conversationsSnapshot = await getDocs(collection(db, 'conversations'))
        backupData.conversations = conversationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      } catch (e) {
      }
      
      // Export Messages
      try {
        const messagesSnapshot = await getDocs(collection(db, 'messages'))
        backupData.messages = messagesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      } catch (e) {
      }
      
      // Calculate total records
      backupData.totalRecords = 
        backupData.profiles.length +
        backupData.songs.length +
        backupData.praiseNights.length +
        backupData.sessions.length +
        backupData.attendance.length +
        backupData.achievements.length +
        backupData.conversations.length +
        backupData.messages.length
      
      
      return JSON.stringify(backupData, null, 2)
    } catch (error) {
 console.error(' Export failed:', error)
      throw error
    }
  }
  
  // Download JSON backup file
  static async downloadJSONBackup(): Promise<void> {
    try {
      const jsonData = await this.exportToJSON()
      const blob = new Blob([jsonData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `loveworld-singers-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
    } catch (error) {
 console.error(' JSON backup download failed:', error)
      alert('Failed to download backup. Please try again.')
    }
  }
  
  // Export to CSV format
  static async exportToCSV(collectionName: string): Promise<string> {
    try {
      const snapshot = await getDocs(collection(db, collectionName))
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      if (data.length === 0) {
        return `No data found in ${collectionName} collection`
      }
      
      // Get all unique keys for CSV headers
      const allKeys = new Set<string>()
      data.forEach(item => {
        Object.keys(item).forEach(key => allKeys.add(key))
      })
      
      const headers = Array.from(allKeys)
      const csvRows = [headers.join(',')]
      
      // Convert each record to CSV row
      data.forEach(item => {
        const row = headers.map(header => {
          const value = (item as any)[header as any]
          if (value === null || value === undefined) return ''
          if (typeof value === 'object') return JSON.stringify(value)
          return `"${String(value).replace(/"/g, '""')}"`
        })
        csvRows.push(row.join(','))
      })
      
      return csvRows.join('\n')
    } catch (error) {
 console.error(` CSV export failed for ${collectionName}:`, error)
      throw error
    }
  }
  
  // Download CSV backup for specific collection
  static async downloadCSVBackup(collectionName: string): Promise<void> {
    try {
      const csvData = await this.exportToCSV(collectionName)
      const blob = new Blob([csvData], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `${collectionName}-backup-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
    } catch (error) {
 console.error(` CSV backup download failed for ${collectionName}:`, error)
      alert(`Failed to download ${collectionName} backup. Please try again.`)
    }
  }
  
  // Export to Excel format (XLSX)
  static async exportToExcel(): Promise<void> {
    try {
      // This would require a library like xlsx or exceljs
      // For now, we'll create multiple CSV files in a zip
      const collections = ['profiles', 'songs', 'praise_nights', 'attendance', 'achievements']
      
      for (const collection of collections) {
        await this.downloadCSVBackup(collection)
      }
      
      alert('Multiple CSV files downloaded. You can open these in Excel.')
    } catch (error) {
 console.error(' Excel export failed:', error)
      alert('Failed to export to Excel format. Please try again.')
    }
  }
  
  // Auto-backup to Google Sheets (requires Google Sheets API)
  static async backupToGoogleSheets(): Promise<void> {
    try {
      // This is a placeholder for Google Sheets integration
      // You would need to set up Google Sheets API credentials
      
      
      // For now, we'll show instructions to the user
      const instructions = `
To set up automatic Google Sheets backup:

1. Go to Google Cloud Console
2. Enable Google Sheets API
3. Create service account credentials
4. Share your Google Sheet with the service account email
5. Add the credentials to your app

For now, please download the JSON or CSV backup and manually import to Google Sheets.
      `
      
      alert(instructions)
      
      // Download JSON backup as alternative
      await this.downloadJSONBackup()
      
    } catch (error) {
 console.error(' Google Sheets backup failed:', error)
      alert('Google Sheets backup not yet configured. JSON backup downloaded instead.')
    }
  }
  
  // Scheduled backup (runs automatically)
  static setupAutoBackup(): void {
    // Run backup every 24 hours
    setInterval(async () => {
      try {
        await this.downloadJSONBackup()
      } catch (error) {
 console.error(' Scheduled backup failed:', error)
      }
    }, 24 * 60 * 60 * 1000) // 24 hours
    
  }
  
  // Get backup statistics
  static async getBackupStats(): Promise<any> {
    try {
      const collections = ['profiles', 'songs', 'praise_nights', 'attendance', 'achievements', 'conversations', 'messages']
      const stats: any = {
        totalCollections: collections.length,
        collections: {},
        lastBackup: localStorage.getItem('lastBackupDate') || 'Never',
        totalRecords: 0
      }
      
      for (const collectionName of collections) {
        try {
          const snapshot = await getDocs(collection(db, collectionName))
          const count = snapshot.docs.length
          stats.collections[collectionName] = count
          stats.totalRecords += count
        } catch (e) {
          stats.collections[collectionName] = 0
        }
      }
      
      return stats
    } catch (error) {
 console.error(' Failed to get backup stats:', error)
      return null
    }
  }
  
  // Restore from JSON backup
  static async restoreFromJSON(jsonData: string): Promise<void> {
    try {
      
      const backupData = JSON.parse(jsonData) as BackupData
      
      // This is a dangerous operation - should be admin only
      const confirmRestore = confirm(
        `️ WARNING: This will restore ${backupData.totalRecords} records from ${backupData.exportDate}. 
        
This may overwrite existing data. Are you sure you want to continue?`
      )
      
      if (!confirmRestore) {
        return
      }
      
            // to avoid data conflicts and ensure data integrity
      
      alert('Restore feature requires additional implementation for safety.')
      
    } catch (error) {
 console.error(' Restore failed:', error)
      alert('Failed to restore data. Please check the backup file format.')
    }
  }
}




