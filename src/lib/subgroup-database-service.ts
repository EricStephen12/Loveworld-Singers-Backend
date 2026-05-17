import { db, FieldValue, admin, messaging } from './firebase-admin'
import { isHQGroup } from '@/config/zones'

// Types
export interface SubGroupComment {
  id: string;
  text: string;
  audioUrl?: string;
  date: string;
  author: string;
}

export interface SubGroupSong {
  id: string;
  subGroupId: string;
  zoneId: string;
  title: string;
  lyrics?: string;
  solfa?: string;
  key?: string;
  tempo?: string;
  writer?: string;
  leadSinger?: string;
  category?: string;
  status?: 'heard' | 'unheard';
  isActive?: boolean;
  audioUrls?: {
    full?: string;
    soprano?: string;
    alto?: string;
    tenor?: string;
    bass?: string;
  };
  importedFrom?: 'zone';
  originalSongId?: string;
  importedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  comments?: SubGroupComment[];
  audioFile?: string;
  praiseNightId?: string;
  history?: any[];
}

export interface SubGroupRehearsal {
  id: string;
  subGroupId: string;
  zoneId: string;
  name: string;
  date: string;
  location?: string;
  description?: string;
  songIds: string[];
  scope: 'subgroup';
  category: 'ongoing' | 'archive' | 'pre-rehearsal';
  scopeLabel?: string;
  subGroupName?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  bannerImage?: string;
}

export class SubGroupDatabaseService {
  private static sanitizeLyrics(text: string): string {
    if (!text) return '';
    return text.trim();
  }

  // --- SONGS ---

  static async getSubGroupSongs(subGroupId: string): Promise<SubGroupSong[]> {
    try {
      const snapshot = await db.collection('subgroup_songs')
        .where('subGroupId', '==', subGroupId)
        .orderBy('title', 'asc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
        importedAt: doc.data().importedAt?.toDate?.()
      })) as SubGroupSong[];
    } catch (error) {
      console.error('Error getting sub-group songs:', error);
      return [];
    }
  }

  static subscribeToSubGroupSongs(
    subGroupId: string,
    onUpdate: (songs: SubGroupSong[]) => void,
    onError?: (error: any) => void
  ) {
    return db.collection('subgroup_songs')
      .where('subGroupId', '==', subGroupId)
      .orderBy('title', 'asc')
      .onSnapshot((snapshot) => {
        const songs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
          importedAt: doc.data().importedAt?.toDate?.()
        })) as SubGroupSong[];
        onUpdate(songs);
      }, (error) => {
        console.error('Sub-group songs subscription error:', error);
        if (onError) onError(error);
      });
  }

  static async getSubGroupSongsByRehearsalId(rehearsalId: string): Promise<SubGroupSong[]> {
    try {
      const rehearsalSnap = await db.collection('subgroup_praise_nights').doc(rehearsalId).get();
      if (!rehearsalSnap.exists) return [];
      
      const songIds = rehearsalSnap.data()?.songIds || [];
      if (songIds.length === 0) return [];
      
      const songs: SubGroupSong[] = [];
      for (let i = 0; i < songIds.length; i += 30) {
        const batch = songIds.slice(i, i + 30);
        const snapshot = await db.collection('subgroup_songs')
          .where(admin.firestore.FieldPath.documentId(), 'in', batch)
          .get();
        songs.push(...snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate?.() || new Date()
        })) as SubGroupSong[]);
      }
      return songs;
    } catch (error) {
      console.error('Error getting rehearsal songs:', error);
      return [];
    }
  }

  static async createSong(
    subGroupId: string,
    zoneId: string,
    songData: Partial<SubGroupSong>,
    createdBy: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const now = FieldValue.serverTimestamp();
      const newSong = {
        subGroupId,
        zoneId,
        title: songData.title || '',
        lyrics: this.sanitizeLyrics(songData.lyrics || ''),
        solfa: songData.solfa || '',
        key: songData.key || '',
        tempo: songData.tempo || '',
        writer: songData.writer || '',
        leadSinger: songData.leadSinger || '',
        category: songData.category || '',
        status: 'unheard',
        isActive: true,
        audioFile: songData.audioFile || '',
        audioUrls: songData.audioUrls || {},
        createdBy,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await db.collection('subgroup_songs').add(newSong);

      try {
        await this.sendSubGroupNotification(subGroupId, {
          title: ' New Song Added',
          message: `"${newSong.title}" has been added to your subgroup library.`,
          type: 'zone'
        });
      } catch (fcmError) {
        console.error('[SubGroupService] FCM error:', fcmError);
      }

      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error creating sub-group song:', error);
      return { success: false, error: 'Failed to create song' };
    }
  }

  static async updateSong(songId: string, updates: Partial<SubGroupSong>): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {
        ...updates,
        updatedAt: FieldValue.serverTimestamp()
      };
      if (updates.lyrics) updateData.lyrics = this.sanitizeLyrics(updates.lyrics);
      if (updates.audioUrls?.full && !updates.audioFile) updateData.audioFile = updates.audioUrls.full;

      await db.collection('subgroup_songs').doc(songId).update(updateData);
      return { success: true };
    } catch (error) {
      console.error('Error updating song:', error);
      return { success: false, error: 'Failed to update song' };
    }
  }

  static async deleteSong(songId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await db.collection('subgroup_songs').doc(songId).delete();
      return { success: true };
    } catch (error) {
      console.error('Error deleting song:', error);
      return { success: false, error: 'Failed to delete song' };
    }
  }

  static async toggleSongStatus(songId: string, currentStatus: string): Promise<{ success: boolean; error?: string }> {
    try {
      const newStatus = currentStatus === 'heard' ? 'unheard' : 'heard';
      await db.collection('subgroup_songs').doc(songId).update({
        status: newStatus,
        updatedAt: FieldValue.serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error toggling song status:', error);
      return { success: false, error: 'Failed to toggle status' };
    }
  }

  // --- REHEARSALS ---

  static async createRehearsal(
    subGroupId: string,
    zoneId: string,
    rehearsalData: any,
    createdBy: string,
    sendNotification: boolean = true
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const now = FieldValue.serverTimestamp();
      const newRehearsal = {
        subGroupId,
        zoneId,
        name: rehearsalData.name,
        date: rehearsalData.date,
        location: rehearsalData.location || '',
        description: rehearsalData.description || '',
        songIds: [],
        scope: 'subgroup',
        category: rehearsalData.category || 'ongoing',
        subGroupName: rehearsalData.subGroupName || '',
        createdBy,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await db.collection('subgroup_praise_nights').add(newRehearsal);

      if (sendNotification) {
        const formattedDate = new Date(rehearsalData.date).toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric'
        });
        await this.sendSubGroupNotification(subGroupId, {
          title: ' New Rehearsal Scheduled',
          message: `${rehearsalData.name} on ${formattedDate}`,
          type: 'rehearsal',
          rehearsalId: docRef.id
        });
      }
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error creating rehearsal:', error);
      return { success: false, error: 'Failed to create rehearsal' };
    }
  }

  static async getRehearsalById(rehearsalId: string): Promise<SubGroupRehearsal | null> {
    try {
      const snapshot = await db.collection('subgroup_praise_nights').doc(rehearsalId).get();
      if (!snapshot.exists) return null;
      const data = snapshot.data() || {};
      return {
        id: snapshot.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date()
      } as SubGroupRehearsal;
    } catch (error) {
      console.error('Error getting rehearsal:', error);
      return null;
    }
  }

  static async getSubGroupRehearsals(subGroupId: string): Promise<SubGroupRehearsal[]> {
    try {
      const snapshot = await db.collection('subgroup_praise_nights')
        .where('subGroupId', '==', subGroupId)
        .get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date()
      })) as SubGroupRehearsal[];
    } catch (error) {
      console.error('Error getting subgroup rehearsals:', error);
      return [];
    }
  }

  // --- MEMBERS ---

  static async addMembers(subGroupId: string, zoneId: string, memberIds: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      const zoneMembersCol = db.collection('zone_members');
      for (const memberId of memberIds) {
        const snapshot = await zoneMembersCol.where('userId', '==', memberId).where('zoneId', '==', zoneId).get();
        if (snapshot.empty) {
          const profileSnap = await db.collection('profiles').doc(memberId).get();
          const profileData = profileSnap.exists ? profileSnap.data() : {};
          await zoneMembersCol.add({
            zoneId,
            userId: memberId,
            userEmail: profileData?.email || '',
            userName: profileData?.first_name ? `${profileData.first_name} ${profileData.last_name || ''}` : 'User',
            role: 'member',
            joinedAt: FieldValue.serverTimestamp(),
            status: 'active'
          });
        }
      }
      await db.collection('subgroups').doc(subGroupId).update({
        memberIds: admin.firestore.FieldValue.arrayUnion(...memberIds),
        updatedAt: FieldValue.serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error adding members:', error);
      return { success: false, error: 'Failed to add members' };
    }
  }

  static async notifyRequester(userId: string, zoneId: string, title: string, body: string, data: any = {}) {
    try {
      const collectionName = isHQGroup(zoneId) ? 'notifications' : 'zone_notifications';
      const notificationId = `notif_sg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      const notificationData = {
        title,
        message: body,
        type: 'info',
        category: 'rehearsal',
        priority: 'medium',
        sender_id: 'system',
        sender_name: 'SubGroup Service',
        target_audience: 'individual',
        target_user_id: userId,
        zoneId: zoneId,
        created_at: new Date().toISOString(),
        is_read: false,
        data: { ...data, subGroupId: data.subGroupId }
      };

      await db.collection(collectionName).doc(notificationId).set(notificationData);
      
      return { success: true };
    } catch (error) {
      console.error('Error sending requester notification:', error);
      return { success: false };
    }
  }

  static async removeMember(subGroupId: string, memberId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await db.collection('subgroups').doc(subGroupId).update({
        memberIds: admin.firestore.FieldValue.arrayRemove(memberId),
        updatedAt: FieldValue.serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error removing member:', error);
      return { success: false, error: 'Failed' };
    }
  }

  static async getSubGroupMembers(subGroupId: string): Promise<any[]> {
    try {
      const snapshot = await db.collection('subgroups').doc(subGroupId).get();
      if (!snapshot.exists) return [];
      const memberIds = snapshot.data()?.memberIds || [];
      if (memberIds.length === 0) return [];

      const members: any[] = [];
      for (let i = 0; i < memberIds.length; i += 30) {
        const batch = memberIds.slice(i, i + 30);
        const profilesSnap = await db.collection('profiles').where(admin.firestore.FieldPath.documentId(), 'in', batch).get();
        members.push(...profilesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
      return members;
    } catch (error) {
      console.error('Error getting subgroup members:', error);
      return [];
    }
  }

  // --- SUBGROUPS CRUD ---

  static async createSubGroup(zoneId: string, data: any, createdBy: string): Promise<{ success: boolean; id?: string }> {
    try {
      const now = FieldValue.serverTimestamp();
      const docRef = await db.collection('subgroups').add({
        zoneId,
        ...data,
        memberIds: data.leaderId ? [data.leaderId] : [],
        createdBy,
        createdAt: now,
        updatedAt: now
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error creating subgroup:', error);
      return { success: false };
    }
  }

  static async getSubGroupById(subGroupId: string): Promise<any | null> {
    try {
      const snapshot = await db.collection('subgroups').doc(subGroupId).get();
      return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
    } catch (error) {
      return null;
    }
  }

  static async getSubGroupsByZone(zoneId: string): Promise<any[]> {
    try {
      const snapshot = await db.collection('subgroups').where('zoneId', '==', zoneId).orderBy('name', 'asc').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      return [];
    }
  }

  // --- NOTIFICATIONS (FCM) ---

  static async sendSubGroupNotification(
    subGroupId: string,
    notification: { title: string; message: string; type: string; rehearsalId?: string }
  ): Promise<{ success: boolean; count: number }> {
    try {
      const subGroupSnap = await db.collection('subgroups').doc(subGroupId).get();
      if (!subGroupSnap.exists) return { success: false, count: 0 };
      
      const memberIds = subGroupSnap.data()?.memberIds || [];
      const zoneId = subGroupSnap.data()?.zoneId;
      if (memberIds.length === 0 || !zoneId) return { success: true, count: 0 };

      const subGroupName = subGroupSnap.data()?.name || 'Subgroup';
      const collectionName = isHQGroup(zoneId) ? 'notifications' : 'zone_notifications';

      for (const mId of memberIds) {
        const notificationId = `notif_sg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const notificationData = {
          title: notification.title,
          message: notification.message,
          type: 'info',
          category: notification.type === 'rehearsal' ? 'rehearsal' : 'system',
          priority: 'medium',
          sender_id: 'system',
          sender_name: subGroupName,
          target_audience: 'individual',
          target_user_id: mId,
          zoneId: zoneId,
          created_at: new Date().toISOString(),
          is_read: false,
          data: { subGroupId, subGroupName, rehearsalId: notification.rehearsalId || '' }
        };
        await db.collection(collectionName).doc(notificationId).set(notificationData);
      }

      // FCM logic
      const tokens: string[] = [];
      for (let i = 0; i < memberIds.length; i += 30) {
        const batchIds = memberIds.slice(i, i + 30);
        const devicesSnap = await db.collection('user_devices').where('userId', 'in', batchIds).get();
        devicesSnap.docs.forEach(doc => { if (doc.data().token) tokens.push(doc.data().token); });
      }

      if (tokens.length > 0) {
        await messaging.sendEachForMulticast({
          tokens,
          notification: { title: notification.title, body: notification.message },
          data: { subGroupId, subGroupName, rehearsalId: notification.rehearsalId || '' }
        }).catch(err => console.warn('FCM Multicast error:', err));
      }

      return { success: true, count: memberIds.length };
    } catch (error) {
      console.error('Error sending subgroup notification:', error);
      return { success: false, count: 0 };
    }
  }

  // --- UTILS ---

  static async searchProfiles(searchTerm: string): Promise<any[]> {
    try {
      const queryLower = (searchTerm || '').toLowerCase().trim();
      const snapshot = await db.collection('profiles').limit(1000).get();
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      return all.filter(p => {
        const searchStr = `${p.first_name} ${p.last_name} ${p.email} ${p.display_name}`.toLowerCase();
        return searchStr.includes(queryLower);
      });
    } catch (error) {
      return [];
    }
  }
}
