// Automatic Notification System
// Sends notifications automatically when admin performs actions

import { FirebaseDatabaseService } from './firebase-database';

interface NotificationData {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'rehearsal' | 'announcement' | 'reminder' | 'system' | 'admin' | 'song' | 'praise_night';
  priority: 'low' | 'medium' | 'high';
  action_url?: string;
  target_audience: 'all' | 'group' | 'individual';
  target_group?: string;
}

class AutoNotificationService {
  
  // Create notification in Firebase
  private async createNotification(data: NotificationData, senderId?: string, senderName?: string) {
    try {
      const notificationData = {
        ...data,
        sender_id: senderId || 'system',
        sender_name: senderName || 'System',
        created_at: new Date().toISOString(),
        is_read: false
      };

      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await FirebaseDatabaseService.createDocument('notifications', notificationId, notificationData);

      return { success: true, notificationId };
    } catch (error) {
 console.error(' Error creating auto-notification:', error);
      return { success: false, error };
    }
  }

  // PRAISE NIGHT NOTIFICATIONS

  /**
   * Send notification when new praise night is created
   * @param praiseNightName - Name of the praise night (e.g., "January Praise Night 2025")
   * @param praiseNightId - ID to link to the page
   * @param date - Date of the event
   */
  async notifyNewPraiseNight(praiseNightName: string, praiseNightId: string, date: string, senderId?: string) {
    const formattedDate = new Date(date).toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });

    return this.createNotification({
      title: ` New Praise Night: ${praiseNightName}`,
      message: `A new praise night has been created for ${formattedDate}. Check it out!`,
      type: 'success',
      category: 'praise_night',
      priority: 'high',
      action_url: `/pages/praise-nights/${praiseNightId}`,
      target_audience: 'all'
    }, senderId, 'Admin');
  }

  /**
   * Send notification when praise night is updated
   */
  async notifyPraiseNightUpdated(praiseNightName: string, praiseNightId: string, changes: string, senderId?: string) {
    return this.createNotification({
      title: ` Praise Night Updated: ${praiseNightName}`,
      message: `Changes: ${changes}`,
      type: 'info',
      category: 'praise_night',
      priority: 'medium',
      action_url: `/pages/praise-nights/${praiseNightId}`,
      target_audience: 'all'
    }, senderId, 'Admin');
  }

  // SONG NOTIFICATIONS

  /**
   * Send notification when new song is added
   * @param songTitle - Title of the song
   * @param praiseNightName - Which praise night it's for
   * @param songId - ID to link to the song
   */
  async notifyNewSongAdded(songTitle: string, praiseNightName: string, songId: string, senderId?: string) {
    return this.createNotification({
      title: ` New Song Added: ${songTitle}`,
      message: `A new song has been added to ${praiseNightName}. Start practicing!`,
      type: 'success',
      category: 'song',
      priority: 'high',
      action_url: `/pages/songs/${songId}`,
      target_audience: 'all'
    }, senderId, 'Admin');
  }

  /**
   * Send notification when lyrics are updated
   */
  async notifyLyricsUpdated(songTitle: string, songId: string, senderId?: string) {
    return this.createNotification({
      title: ` Lyrics Updated: ${songTitle}`,
      message: `The lyrics for "${songTitle}" have been updated. Check the latest version!`,
      type: 'info',
      category: 'song',
      priority: 'medium',
      action_url: `/pages/songs/${songId}`,
      target_audience: 'all'
    }, senderId, 'Admin');
  }

  /**
   * Send notification when audio file is added
   */
  async notifyAudioAdded(songTitle: string, songId: string, senderId?: string) {
    return this.createNotification({
      title: ` Audio Added: ${songTitle}`,
      message: `Audio file is now available for "${songTitle}". Listen and practice!`,
      type: 'success',
      category: 'song',
      priority: 'high',
      action_url: `/pages/songs/${songId}`,
      target_audience: 'all'
    }, senderId, 'Admin');
  }

  /**
   * Send notification when song details are changed (key, tempo, etc.)
   */
  async notifySongDetailsChanged(songTitle: string, changes: string, songId: string, senderId?: string) {
    return this.createNotification({
      title: `️ Song Updated: ${songTitle}`,
      message: `Changes: ${changes}`,
      type: 'warning',
      category: 'song',
      priority: 'high',
      action_url: `/pages/songs/${songId}`,
      target_audience: 'all'
    }, senderId, 'Admin');
  }

  /**
   * Send notification when song is deleted
   */
  async notifySongDeleted(songTitle: string, praiseNightName: string, senderId?: string) {
    return this.createNotification({
      title: `️ Song Removed: ${songTitle}`,
      message: `"${songTitle}" has been removed from ${praiseNightName}.`,
      type: 'warning',
      category: 'song',
      priority: 'medium',
      target_audience: 'all'
    }, senderId, 'Admin');
  }

  // REHEARSAL NOTIFICATIONS

  /**
   * Send rehearsal reminder (call this 24 hours before)
   */
  async notifyRehearsalReminder(rehearsalTime: string, songCount: number, senderId?: string) {
    return this.createNotification({
      title: ` Rehearsal Tomorrow at ${rehearsalTime}`,
      message: `Don't forget! ${songCount} song${songCount > 1 ? 's' : ''} to practice. See you there!`,
      type: 'info',
      category: 'rehearsal',
      priority: 'high',
      target_audience: 'all'
    }, senderId, 'System');
  }

  /**
   * Send notification when rehearsal is cancelled
   */
  async notifyRehearsalCancelled(rehearsalDate: string, reason?: string, senderId?: string) {
    return this.createNotification({
      title: ` Rehearsal Cancelled`,
      message: `The rehearsal scheduled for ${rehearsalDate} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
      type: 'warning',
      category: 'rehearsal',
      priority: 'high',
      target_audience: 'all'
    }, senderId, 'Admin');
  }

  /**
   * Send notification when rehearsal time/location changes
   */
  async notifyRehearsalChanged(oldTime: string, newTime: string, location?: string, senderId?: string) {
    return this.createNotification({
      title: ` Rehearsal Time Changed`,
      message: `Rehearsal moved from ${oldTime} to ${newTime}.${location ? ` Location: ${location}` : ''}`,
      type: 'warning',
      category: 'rehearsal',
      priority: 'high',
      target_audience: 'all'
    }, senderId, 'Admin');
  }

  // GROUP-SPECIFIC NOTIFICATIONS

  /**
   * Send notification to specific group
   */
  async notifyGroup(groupName: string, title: string, message: string, priority: 'low' | 'medium' | 'high' = 'medium', senderId?: string) {
    return this.createNotification({
      title: ` ${groupName}: ${title}`,
      message,
      type: 'info',
      category: 'announcement',
      priority,
      target_audience: 'group',
      target_group: groupName
    }, senderId, 'Admin');
  }

  // ADMIN ANNOUNCEMENTS

  /**
   * Send general announcement to all users
   */
  async notifyAnnouncement(title: string, message: string, priority: 'low' | 'medium' | 'high' = 'medium', senderId?: string) {
    return this.createNotification({
      title: ` ${title}`,
      message,
      type: 'info',
      category: 'announcement',
      priority,
      target_audience: 'all'
    }, senderId, 'Admin');
  }

  // SYSTEM NOTIFICATIONS

  /**
   * Send notification when user profile is incomplete
   */
  async notifyProfileIncomplete(userId: string) {
    return this.createNotification({
      title: `️ Complete Your Profile`,
      message: `Your profile is incomplete. Please update your information to access all features.`,
      type: 'warning',
      category: 'system',
      priority: 'medium',
      action_url: '/pages/profile',
      target_audience: 'individual',
      target_group: undefined
    }, 'system', 'System');
  }

  /**
   * Send notification for app updates
   */
  async notifyAppUpdate(version: string, features: string) {
    return this.createNotification({
      title: ` New App Version ${version} Available!`,
      message: `What's new: ${features}`,
      type: 'success',
      category: 'system',
      priority: 'low',
      target_audience: 'all'
    }, 'system', 'System');
  }
}

// Export singleton instance
export const autoNotifications = new AutoNotificationService();

