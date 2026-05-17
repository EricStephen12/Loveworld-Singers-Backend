// Firebase Activity Logs Service - Persistent storage for admin actions
import { db, FieldValue } from './firebase-admin';

export interface ActivityLog {
  id?: string;
  adminId: string;
  adminUsername: string;
  adminFullName: string;
  action: string;
  details: string;
  section: string;
  zoneId: string;
  zoneName: string;
  timestamp: any;
  ipAddress?: string;
  userAgent?: string;
}

class ActivityLogsService {
  private static COLLECTION_NAME = 'activityLogs';

  // Log an activity to Firebase
  static async logActivity(activity: Omit<ActivityLog, 'id' | 'timestamp'>): Promise<{ success: boolean; error?: string }> {
    try {
      const logData = {
        ...activity,
        timestamp: FieldValue.serverTimestamp(),
      };

      await db.collection(this.COLLECTION_NAME).add(logData);
      return { success: true };
    } catch (error) {
      console.error('Error logging activity:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to log activity' };
    }
  }

  // Get all activity logs with optional filtering
  static async getLogs(filters?: {
    zoneId?: string;
    adminId?: string;
    action?: string;
    section?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<{ success: boolean; logs: ActivityLog[]; error?: string }> {
    try {
      let query: any = db.collection(this.COLLECTION_NAME);

      // Apply filters
      if (filters?.zoneId) {
        query = query.where('zoneId', '==', filters.zoneId);
      }
      if (filters?.adminId) {
        query = query.where('adminId', '==', filters.adminId);
      }
      if (filters?.action) {
        query = query.where('action', '==', filters.action);
      }
      if (filters?.section) {
        query = query.where('section', '==', filters.section);
      }
      if (filters?.startDate) {
        query = query.where('timestamp', '>=', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.where('timestamp', '<=', filters.endDate);
      }

      // Always order by timestamp (newest first) and apply limit
      query = query.orderBy('timestamp', 'desc').limit(filters?.limit || 1000);

      const querySnapshot = await query.get();
      const logs: ActivityLog[] = querySnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));

      return { success: true, logs };
    } catch (error) {
      console.error('Error getting logs:', error);
      return { success: false, logs: [], error: error instanceof Error ? error.message : 'Failed to get logs' };
    }
  }

  // Get logs by admin ID
  static async getLogsByAdmin(adminId: string, limitCount: number = 100): Promise<{ success: boolean; logs: ActivityLog[]; error?: string }> {
    return this.getLogs({ adminId, limit: limitCount });
  }

  // Get logs by zone
  static async getLogsByZone(zoneId: string, limitCount: number = 500): Promise<{ success: boolean; logs: ActivityLog[]; error?: string }> {
    return this.getLogs({ zoneId, limit: limitCount });
  }

  // Get recent logs across all zones
  static async getRecentLogs(limitCount: number = 50): Promise<{ success: boolean; logs: ActivityLog[]; error?: string }> {
    return this.getLogs({ limit: limitCount });
  }

  // Get logs by date range
  static async getLogsByDateRange(startDate: Date, endDate: Date, zoneId?: string): Promise<{ success: boolean; logs: ActivityLog[]; error?: string }> {
    return this.getLogs({ startDate, endDate, zoneId });
  }

  // Get activity summary statistics
  static async getSummary(zoneId?: string): Promise<{ success: boolean; summary: any; error?: string }> {
    try {
      const result = await this.getLogs({ zoneId, limit: 1000 });
      if (!result.success) {
        return { success: false, summary: null, error: result.error };
      }

      const logs = result.logs;
      const adminActivities: { [adminId: string]: number } = {};
      const sectionActivities: { [section: string]: number } = {};
      const actionCounts: { [action: string]: number } = {};
      const zoneActivities: { [zoneId: string]: number } = {};

      logs.forEach(log => {
        adminActivities[log.adminId] = (adminActivities[log.adminId] || 0) + 1;
        sectionActivities[log.section] = (sectionActivities[log.section] || 0) + 1;
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
        zoneActivities[log.zoneId] = (zoneActivities[log.zoneId] || 0) + 1;
      });

      const summary = {
        totalActivities: logs.length,
        adminActivities,
        sectionActivities,
        actionCounts,
        zoneActivities,
        recentActivity: logs[0] || null,
        dateRange: logs.length > 0 ? {
          oldest: logs[logs.length - 1]?.timestamp?.toDate?.() || logs[logs.length - 1]?.timestamp,
          newest: logs[0]?.timestamp?.toDate?.() || logs[0]?.timestamp
        } : null
      };

      return { success: true, summary };
    } catch (error) {
      console.error('Error getting summary:', error);
      return { success: false, summary: null, error: error instanceof Error ? error.message : 'Failed to get summary' };
    }
  }

  // Export logs to JSON
  static async exportLogs(filters?: {
    zoneId?: string;
    adminId?: string;
    action?: string;
    section?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ success: boolean; data: string; error?: string }> {
    try {
      const result = await this.getLogs(filters);
      if (!result.success) {
        return { success: false, data: '', error: result.error };
      }

      const exportData = result.logs.map(log => {
        const date = log.timestamp?.toDate?.() || log.timestamp;
        return {
          ...log,
          timestamp: date ? date.toISOString() : null,
          timestampDate: date ? date.toLocaleString() : null
        };
      });

      const jsonString = JSON.stringify(exportData, null, 2);
      return { success: true, data: jsonString };
    } catch (error) {
      console.error('Error exporting logs:', error);
      return { success: false, data: '', error: error instanceof Error ? error.message : 'Failed to export logs' };
    }
  }
}

export default ActivityLogsService;
