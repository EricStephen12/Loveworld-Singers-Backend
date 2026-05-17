import { db } from './firebase-admin'

export class FirebaseDatabaseService {
  // Fetch praise nights
  static async getPraiseNights(limitCount = 10) {
    try {
      const snapshot = await db.collection('praise_nights')
        .orderBy('createdAt', 'desc')
        .limit(limitCount)
        .get()

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('Error getting praise nights:', error)
      return []
    }
  }

  // Get songs for a specific praise night
  static async getSongs(praiseNightId: string) {
    try {
      const snapshot = await db.collection('songs')
        .where('praiseNightId', '==', praiseNightId)
        .get()

      const results = snapshot.docs.map(doc => ({
        id: doc.id, // Firebase document ID (string)
        firebaseId: doc.id, // Also store as firebaseId for clarity
        ...doc.data()
      }))

      // Sort by orderIndex in JavaScript to avoid index requirement
      return results.sort((a, b) => {
        const indexA = (a as any).orderIndex || 0
        const indexB = (b as any).orderIndex || 0
        return indexA - indexB // Ascending order
      })
    } catch (error) {
      console.error('Error getting songs:', error)
      return []
    }
  }

  // Fetch song by ID
  static async getSongById(songId: string) {
    try {
      const docSnap = await db.collection('songs').doc(songId).get()

      if (docSnap.exists) {
        const data = docSnap.data();
        const songData: any = {
          id: docSnap.id,
          firebaseId: docSnap.id,
          ...data
        };

        return songData;
      } else {
        console.warn('[getSongById] Song not found with ID:', songId);
        return null;
      }
    } catch (error) {
      console.error('[getSongById] Error:', error);
      return null;
    }
  }


  // Get user profile
  static async getUserProfile(userId: string) {
    try {
      const docSnap = await db.collection('profiles').doc(userId).get()

      if (docSnap.exists) {
        return { id: docSnap.id, ...docSnap.data() }
      }
      return null
    } catch (error) {
      console.error('Error getting user profile:', error)
      return null
    }
  }

  static async updateUserProfile(userId: string, data: any) {
    try {
      await db.collection('profiles').doc(userId).update({
        ...data,
        updatedAt: new Date()
      })
      return { success: true }
    } catch (error) {
      console.error('Error updating user profile:', error)
      return { success: false }
    }
  }

  // Get all users
  static async getAllUsers() {
    try {
      const snapshot = await db.collection('profiles').get()
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('Error getting all users:', error)
      return []
    }
  }

  // Real-time listener for praise nights
  static subscribeToPraiseNights(callback: (data: any[]) => void) {
    return db.collection('praise_nights')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .onSnapshot((snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        callback(data)
      })
  }

  // Generic subscription to any collection
  static subscribeToCollection(collectionName: string, callback: (data: any[]) => void, limitCount: number = 100) {
    return db.collection(collectionName)
      .limit(limitCount)
      .onSnapshot((snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          firebaseId: doc.id,
          ...doc.data()
        }))
        callback(data)
      })
  }

  // Generic subscription with filter
  static subscribeToCollectionWhere(collectionName: string, field: string, operator: any, value: any, callback: (data: any[]) => void, limitCount: number = 100) {
    return db.collection(collectionName)
      .where(field, operator, value)
      .limit(limitCount)
      .onSnapshot((snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          firebaseId: doc.id,
          ...doc.data()
        }))
        callback(data)
      })
  }

  // Add new praise night with Firebase-generated ID
  static async addPraiseNight(data: any) {
    try {
      const pageData = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await db.collection('praise_nights').add(pageData);

      return { id: docRef.id, firebaseId: docRef.id, success: true }
    } catch (error) {
      console.error('Error adding praise night:', error)
      return { id: null, firebaseId: null, success: false }
    }
  }

  static async updatePraiseNight(id: string, data: any) {
    try {
      await db.collection('praise_nights').doc(id).update({
        ...data,
        updatedAt: new Date()
      })

      return { success: true }
    } catch (error) {
      console.error('Error updating praise night:', error)
      return { success: false }
    }
  }

  // Delete praise night
  static async deletePraiseNight(id: string) {
    try {
      await db.collection('praise_nights').doc(id).delete()
      return { success: true }
    } catch (error) {
      console.error('Error deleting praise night:', error)
      return { success: false }
    }
  }

  // Test connection
  static async testConnection() {
    try {
      // Test if Firestore is initialized
      if (!db) {
        return { status: 'error', message: 'Firestore not initialized' }
      }

      // Test if we can access the database
      await db.collection('test').limit(1).get()
      return {
        status: 'success',
        message: 'Firebase Firestore Admin connected successfully'
      }
    } catch (error: any) {
      return { status: 'error', message: error.message }
    }
  }

  // Generic methods
  // Fetch collection
  static async getCollection(collectionName: string, maxLimit: number = 500) {
    try {
      const snapshot = await db.collection(collectionName).limit(maxLimit).get()
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          firebaseId: doc.id,
          supabaseId: data.id,
          ...data
        }
      })
    } catch (error) {
      console.error(`Error getting collection ${collectionName}:`, error)
      return []
    }
  }

  // Get ALL documents from a collection (no limit) - use carefully!
  static async getAllFromCollection(collectionName: string) {
    try {
      const snapshot = await db.collection(collectionName).get()
      return snapshot.docs.map(doc => ({
        id: doc.id,
        firebaseId: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error(`Error getting all from ${collectionName}:`, error)
      return []
    }
  }

  // Batch fetch with cursor pagination
  static async getCollectionInBatches(
    collectionName: string,
    batchSize: number = 500,
    maxTotal: number = 10000,
    orderByField: string = 'timestamp',
    onBatch?: (batch: any[], totalFetched: number, isComplete: boolean) => void
  ): Promise<any[]> {
    try {
      const allResults: any[] = []
      let lastDoc: any = null
      let hasMore = true

      while (hasMore && allResults.length < maxTotal) {
        let query = db.collection(collectionName)
          .orderBy(orderByField, 'desc')
          .limit(batchSize)

        if (lastDoc) {
          query = query.startAfter(lastDoc)
        }

        const snapshot = await query.get()
        const batchDocs = snapshot.docs

        if (batchDocs.length === 0) {
          hasMore = false
        } else {
          const batchData = batchDocs.map(docSnap => ({
            id: docSnap.id,
            firebaseId: docSnap.id,
            ...docSnap.data()
          }))

          allResults.push(...batchData)
          lastDoc = batchDocs[batchDocs.length - 1]

          if (onBatch) {
            const isComplete = batchDocs.length < batchSize || allResults.length >= maxTotal
            onBatch(batchData, allResults.length, isComplete)
          }

          if (batchDocs.length < batchSize) {
            hasMore = false
          }
        }
      }

      return allResults
    } catch (error) {
      console.error('[Batch] Error fetching', collectionName, ':', error)
      return []
    }
  }

  // Batch fetch for analytics_sessions (uses startTime field)
  static async getSessionsInBatches(
    batchSize: number = 500,
    maxTotal: number = 5000,
    onBatch?: (batch: any[], totalFetched: number, isComplete: boolean) => void
  ): Promise<any[]> {
    return this.getCollectionInBatches('analytics_sessions', batchSize, maxTotal, 'startTime', onBatch)
  }

  // Batch fetch for analytics_events (uses timestamp field)
  static async getEventsInBatches(
    batchSize: number = 500,
    maxTotal: number = 10000,
    onBatch?: (batch: any[], totalFetched: number, isComplete: boolean) => void
  ): Promise<any[]> {
    return this.getCollectionInBatches('analytics_events', batchSize, maxTotal, 'timestamp', onBatch)
  }

  static async getDocument(collectionName: string, docId: string) {
    try {
      const docSnap = await db.collection(collectionName).doc(docId).get()

      if (docSnap.exists) {
        return { id: docSnap.id, ...docSnap.data() }
      } else {
        return null
      }
    } catch (error) {
      console.error(`Error getting document ${docId}:`, error)
      return null
    }
  }

  static async createDocument(collectionName: string, docId: string, data: any) {
    try {
      await db.collection(collectionName).doc(docId).set(data)

      if (collectionName === 'analytics_events' && data.type) {
        try {
          const { AnalyticsAggregationService } = await import('./analytics-aggregation-service');
          await AnalyticsAggregationService.incrementEvent(
            data.timestamp || Date.now(),
            data.type,
            data.page,
            data.featureName
          );
        } catch (analyticsError) {
          console.warn('Could not update analytics aggregation:', analyticsError);
        }
      }

      return { id: docId, ...data }
    } catch (error) {
      console.error(`Error creating document ${docId}:`, error)
      throw error
    }
  }

  static async addDocument(collectionName: string, data: any) {
    try {
      const docRef = await db.collection(collectionName).add(data)

      if (collectionName === 'analytics_events' && data.type) {
        try {
          const { AnalyticsAggregationService } = await import('./analytics-aggregation-service');
          await AnalyticsAggregationService.incrementEvent(
            data.timestamp || Date.now(),
            data.type,
            data.page,
            data.featureName
          );
        } catch (analyticsError) {
          console.warn('Could not update analytics aggregation:', analyticsError);
        }
      }

      return { success: true, id: docRef.id, ...data }
    } catch (error) {
      console.error(`Error adding document to ${collectionName}:`, error)
      throw error
    }
  }

  static async updateDocument(collectionName: string, docId: string, data: any) {
    try {
      await db.collection(collectionName).doc(docId).set(data, { merge: true })
      return { success: true }
    } catch (error) {
      console.error(`Error updating document ${docId}:`, error)
      throw error
    }
  }

  static async deleteDocument(collectionName: string, docId: string) {
    try {
      await db.collection(collectionName).doc(docId).delete()
      return { success: true }
    } catch (error) {
      console.error(`Error deleting document ${docId}:`, error)
      throw error
    }
  }

  static async getCollectionWhere(collectionName: string, field: string, operator: any, value: any) {
    try {
      const snapshot = await db.collection(collectionName).where(field, operator, value).get()
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error(`Error getting collection ${collectionName} with where:`, error)
      return []
    }
  }

  static async getCollectionWhereIn(collectionName: string, field: string, values: string[]) {
    try {
      if (values.length === 0) return []

      const maxBatchSize = 30
      const results: any[] = []

      for (let i = 0; i < values.length; i += maxBatchSize) {
        const batchValues = values.slice(i, i + maxBatchSize)
        const snapshot = await db.collection(collectionName).where(field, 'in', batchValues).get()
        snapshot.docs.forEach(doc => {
          results.push({
            id: doc.id,
            ...doc.data()
          })
        })
      }

      return results
    } catch (error) {
      console.error(`Error batch fetching from ${collectionName}:`, error)
      return []
    }
  }

  static async getDocumentsByIds(collectionName: string, docIds: string[]) {
    try {
      if (docIds.length === 0) return []

      const results: any[] = []
      const maxBatchSize = 30

      for (let i = 0; i < docIds.length; i += maxBatchSize) {
        const batchIds = docIds.slice(i, i + maxBatchSize)
        const promises = batchIds.map(id =>
          db.collection(collectionName).doc(id).get()
            .then(docSnap => docSnap.exists ? { id: docSnap.id, ...docSnap.data() } : null)
            .catch(() => null)
        )
        const batchResults = await Promise.all(promises)
        results.push(...batchResults.filter(Boolean))
      }

      return results
    } catch (error) {
      console.error(`Error batch fetching documents from ${collectionName}:`, error)
      return []
    }
  }

  static async getDocuments(collectionName: string, filters: Array<{ field: string; operator: any; value: any }>) {
    try {
      let query: any = db.collection(collectionName)

      for (const filter of filters) {
        query = query.where(filter.field, filter.operator, filter.value)
      }

      const snapshot = await query.get()
      return snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('[getDocuments] Error getting documents from', collectionName, ':', error)
      return []
    }
  }

  // Category methods
  static async createCategory(categoryData: any) {
    try {
      const docRef = await db.collection('categories').add(categoryData)
      return { success: true, id: docRef.id, ...categoryData }
    } catch (error) {
      console.error('Error creating category:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async updateCategory(categoryId: string | number, data: any) {
    try {
      await db.collection('categories').doc(categoryId.toString()).update(data)
      return { success: true }
    } catch (error) {
      console.error('Error updating category:', error)
      return { success: false }
    }
  }

  static async deleteCategory(categoryId: string | number) {
    try {
      await db.collection('categories').doc(categoryId.toString()).delete()
      return { success: true }
    } catch (error) {
      console.error('Error deleting category:', error)
      return { success: false }
    }
  }

  // Song methods
  static async createSong(songData: any) {
    try {
      const cleanData = Object.fromEntries(
        Object.entries(songData).filter(([_, value]) => value !== undefined)
      )

      const docRef = await db.collection('songs').add(cleanData)

      return {
        success: true,
        id: docRef.id,
        song: {
          ...cleanData,
          id: docRef.id,
          firebaseId: docRef.id,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }
    } catch (error) {
      console.error('Error creating song:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async updateSong(songId: string | number, data: any) {
    try {
      const firebaseDocId = String(songId).trim();
      if (!firebaseDocId) return { success: false, error: 'Invalid song ID' };

      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([k, v]) => v !== undefined && k !== 'id' && k !== 'firebaseId')
      )

      const docRef = db.collection('songs').doc(firebaseDocId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) return { success: false, error: 'Song not found' };

      cleanData.updatedAt = new Date();
      await docRef.update(cleanData);

      if (data.history && data.history.length > 0) {
        const existingHistory = await this.getCollectionWhere('song_history', 'song_id', '==', firebaseDocId);
        const existingIds = new Set(existingHistory?.map(h => h.id) || []);
        const newHistoryEntries = data.history.filter((h: any) => !existingIds.has(h.id));

        for (const historyEntry of newHistoryEntries) {
          await this.createHistoryEntry({
            ...historyEntry,
            song_id: firebaseDocId,
            created_at: new Date()
          });
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Firebase updateSong error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async deleteSong(songId: string | number) {
    try {
      const firebaseDocId = String(songId).trim();
      if (!firebaseDocId) return { success: false, error: 'Invalid song ID' };

      const docRef = db.collection('songs').doc(firebaseDocId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) return { success: false, error: 'Song not found' };

      await docRef.delete();
      return { success: true };
    } catch (error) {
      console.error('Delete error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Page methods
  static async createPage(pageData: any) {
    try {
      const docRef = await db.collection('praise_nights').add(pageData)
      return { id: docRef.id, ...pageData }
    } catch (error) {
      console.error('Error creating page:', error)
      return null
    }
  }

  static async updatePage(pageId: string | number, data: any) {
    try {
      const docId = String(pageId)
      const docRef = db.collection('praise_nights').doc(docId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) return false;

      await docRef.update(data);
      return true
    } catch (error) {
      console.error('Firebase updatePage error:', error)
      return false
    }
  }

  static async deletePage(pageId: string | number) {
    try {
      const docId = String(pageId)
      await db.collection('praise_nights').doc(docId).delete()
      return true
    } catch (error) {
      console.error('Firebase deletePage error:', error)
      return false
    }
  }

  static async getHistoryBySongId(songId: string | number) {
    try {
      const snapshot = await db.collection('song_history')
        .where('song_id', '==', songId.toString())
        .get()

      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return results.sort((a, b) => {
        const dateA = new Date((a as any).created_at || 0).getTime()
        const dateB = new Date((b as any).created_at || 0).getTime()
        return dateB - dateA
      });
    } catch (error) {
      console.error('Error getting song history:', error)
      return []
    }
  }

  static async getGroupPosts(groupId: string) {
    try {
      const snapshot = await db.collection('group_posts')
        .where('group_id', '==', groupId)
        .orderBy('timestamp', 'desc')
        .get()
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('Error getting group posts:', error)
      return []
    }
  }

  static async createGroupPost(postData: any) {
    try {
      const docRef = await db.collection('group_posts').add(postData)
      return { id: docRef.id, ...postData }
    } catch (error) {
      console.error('Error creating group post:', error)
      return null
    }
  }

  static async updateGroupPost(postId: string, data: any) {
    try {
      await db.collection('group_posts').doc(postId).update(data)
      return true
    } catch (error) {
      console.error('Error updating group post:', error)
      return false
    }
  }

  static async deleteGroupPost(postId: string) {
    try {
      await db.collection('group_posts').doc(postId).delete()
      return true
    } catch (error) {
      console.error('Error deleting group post:', error)
      return false
    }
  }

  static async createHistoryEntry(data: any) {
    try {
      const docRef = await db.collection('song_history').add(data)
      return { id: docRef.id, ...data }
    } catch (error) {
      console.error('Error creating history entry:', error)
      return null
    }
  }

  static async updateHistoryEntry(entryId: string, data: any) {
    try {
      await db.collection('song_history').doc(entryId).update({
        ...data,
        updated_at: new Date()
      })
      return true
    } catch (error) {
      console.error('Error updating history entry:', error)
      return false
    }
  }

  static async deleteHistoryEntry(entryId: string) {
    try {
      await db.collection('song_history').doc(entryId).delete()
      return true
    } catch (error) {
      console.error('Error deleting history entry:', error)
      return false
    }
  }

  static async getPageCategories() {
    try {
      const snapshot = await db.collection('page_categories')
        .orderBy('createdAt', 'desc')
        .get()
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (error) {
      console.error('Error getting page categories:', error)
      return []
    }
  }

  static async createPageCategory(data: any) {
    try {
      const docRef = await db.collection('page_categories').add({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      return { success: true, id: docRef.id }
    } catch (error) {
      console.error('Error creating page category:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed' }
    }
  }

  static async getUserNotifications(userId: string) {
    try {
      const snapshot = await db.collection('admin_messages')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get()
      
      const allNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      const readNotifs = await this.getCollectionWhere('user_notifications', 'user_id', '==', userId)
      const readMap = new Map(readNotifs.map((rn: any) => [rn.notification_id, rn.read_at]))

      return allNotifications.map((notif: any) => ({
        ...notif,
        is_read: readMap.has(notif.id),
        read_at: readMap.get(notif.id)
      }))
    } catch (error) {
      console.error('Error fetching notifications:', error)
      return []
    }
  }
}
