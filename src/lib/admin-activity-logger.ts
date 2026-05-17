// Admin Activity Logger - Tracks admin actions for accountability

export interface AdminActivity {
  id: string;
  adminId: string;
  adminUsername: string;
  adminFullName: string;
  action: string;
  details: string;
  section: string;
  timestamp: string;
  ipAddress?: string;
}

class AdminActivityLogger {
  private static STORAGE_KEY = 'admin_activity_log';
  private static MAX_LOGS = 1000;

  static log(
    adminId: string,
    adminUsername: string,
    adminFullName: string,
    action: string,
    details: string,
    section: string
  ): void {
    if (typeof window === 'undefined') return;

    const activity: AdminActivity = {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      adminId,
      adminUsername,
      adminFullName,
      action,
      details,
      section,
      timestamp: new Date().toISOString()
    };

    try {
      const logs = this.getLogs();
      logs.unshift(activity);
      if (logs.length > this.MAX_LOGS) logs.splice(this.MAX_LOGS);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
    } catch (error) {
 console.error('Error logging admin activity:', error);
    }
  }

  // Get all activity logs
  static getLogs(): AdminActivity[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
 console.error('Error getting activity logs:', error);
      return [];
    }
  }

  static getLogsByAdmin(adminId: string): AdminActivity[] {
    return this.getLogs().filter(log => log.adminId === adminId);
  }

  static getLogsBySection(section: string): AdminActivity[] {
    return this.getLogs().filter(log => log.section === section);
  }

  static getLogsByDateRange(startDate: Date, endDate: Date): AdminActivity[] {
    return this.getLogs().filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= startDate && logDate <= endDate;
    });
  }

  static getRecentLogs(count: number = 50): AdminActivity[] {
    return this.getLogs().slice(0, count);
  }

  static clearLogs(): void {
    if (typeof window !== 'undefined') localStorage.removeItem(this.STORAGE_KEY);
  }

  static exportLogs(): string {
    return JSON.stringify(this.getLogs(), null, 2);
  }

  static getSummary() {
    const logs = this.getLogs();
    const adminActivities: { [adminId: string]: number } = {};
    const sectionActivities: { [section: string]: number } = {};

    logs.forEach(log => {
      adminActivities[log.adminId] = (adminActivities[log.adminId] || 0) + 1;
      sectionActivities[log.section] = (sectionActivities[log.section] || 0) + 1;
    });

    return {
      totalActivities: logs.length,
      adminActivities,
      sectionActivities,
      recentActivity: logs[0] || null
    };
  }
}

// Helper functions for common actions
export const logAdminAction = {
  // Page actions
  createPage: (admin: { id: string; username: string; fullName: string }, pageName: string) => {
    AdminActivityLogger.log(
      admin.id,
      admin.username,
      admin.fullName,
      'CREATE_PAGE',
      `Created page: ${pageName}`,
      'Pages'
    );
  },

  updatePage: (admin: { id: string; username: string; fullName: string }, pageName: string) => {
    AdminActivityLogger.log(
      admin.id,
      admin.username,
      admin.fullName,
      'UPDATE_PAGE',
      `Updated page: ${pageName}`,
      'Pages'
    );
  },

  deletePage: (admin: { id: string; username: string; fullName: string }, pageName: string) => {
    AdminActivityLogger.log(
      admin.id,
      admin.username,
      admin.fullName,
      'DELETE_PAGE',
      `Deleted page: ${pageName}`,
      'Pages'
    );
  },

  // Category actions
  createCategory: (admin: { id: string; username: string; fullName: string }, categoryName: string) => {
    AdminActivityLogger.log(
      admin.id,
      admin.username,
      admin.fullName,
      'CREATE_CATEGORY',
      `Created category: ${categoryName}`,
      'Categories'
    );
  },

  updateCategory: (admin: { id: string; username: string; fullName: string }, categoryName: string) => {
    AdminActivityLogger.log(
      admin.id,
      admin.username,
      admin.fullName,
      'UPDATE_CATEGORY',
      `Updated category: ${categoryName}`,
      'Categories'
    );
  },

  deleteCategory: (admin: { id: string; username: string; fullName: string }, categoryName: string) => {
    AdminActivityLogger.log(
      admin.id,
      admin.username,
      admin.fullName,
      'DELETE_CATEGORY',
      `Deleted category: ${categoryName}`,
      'Categories'
    );
  },

  // Song actions
  addSong: (admin: { id: string; username: string; fullName: string }, songTitle: string, category: string) => {
    AdminActivityLogger.log(
      admin.id,
      admin.username,
      admin.fullName,
      'ADD_SONG',
      `Added song: ${songTitle} to ${category}`,
      'Songs'
    );
  },

  updateSong: (admin: { id: string; username: string; fullName: string }, songTitle: string) => {
    AdminActivityLogger.log(
      admin.id,
      admin.username,
      admin.fullName,
      'UPDATE_SONG',
      `Updated song: ${songTitle}`,
      'Songs'
    );
  },

  deleteSong: (admin: { id: string; username: string; fullName: string }, songTitle: string) => {
    AdminActivityLogger.log(
      admin.id,
      admin.username,
      admin.fullName,
      'DELETE_SONG',
      `Deleted song: ${songTitle}`,
      'Songs'
    );
  },

  // Media actions
  uploadMedia: (admin: { id: string; username: string; fullName: string }, fileName: string) => {
    AdminActivityLogger.log(
      admin.id,
      admin.username,
      admin.fullName,
      'UPLOAD_MEDIA',
      `Uploaded media: ${fileName}`,
      'Media'
    );
  },

  deleteMedia: (admin: { id: string; username: string; fullName: string }, fileName: string) => {
    AdminActivityLogger.log(
      admin.id,
      admin.username,
      admin.fullName,
      'DELETE_MEDIA',
      `Deleted media: ${fileName}`,
      'Media'
    );
  },

  // User actions
  updateUser: (admin: { id: string; username: string; fullName: string }, userName: string) => {
    AdminActivityLogger.log(
      admin.id,
      admin.username,
      admin.fullName,
      'UPDATE_USER',
      `Updated user: ${userName}`,
      'Users'
    );
  },

  deleteUser: (admin: { id: string; username: string; fullName: string }, userName: string) => {
    AdminActivityLogger.log(
      admin.id,
      admin.username,
      admin.fullName,
      'DELETE_USER',
      `Deleted user: ${userName}`,
      'Users'
    );
  },

  // Support actions
  replySupport: (admin: { id: string; username: string; fullName: string }, messageId: string) => {
    AdminActivityLogger.log(
      admin.id,
      admin.username,
      admin.fullName,
      'REPLY_SUPPORT',
      `Replied to support message: ${messageId}`,
      'Support'
    );
  },

  // Login/Logout
  login: (admin: { id: string; username: string; fullName: string }) => {
    AdminActivityLogger.log(
      admin.id,
      admin.username,
      admin.fullName,
      'LOGIN',
      `Logged in to admin panel`,
      'Authentication'
    );
  },

  logout: (admin: { id: string; username: string; fullName: string }) => {
    AdminActivityLogger.log(
      admin.id,
      admin.username,
      admin.fullName,
      'LOGOUT',
      `Logged out from admin panel`,
      'Authentication'
    );
  }
};

export default AdminActivityLogger;

