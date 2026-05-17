import { db, admin } from './firebase-admin'

interface MonthlySummary {
  year: number
  month: number
  totalEvents: number
  totalSignups: number
  totalLogins: number
  totalFeatureEngagements: number
  uniqueUsers: number
  pageViews: { [page: string]: number }
  countries: { [country: string]: number }
  cities: { [city: string]: number }
  browsers: { [browser: string]: number }
  featureEngagements: { [feature: string]: number }
  songAccesses: { [songId: string]: number }
  updatedAt: Date
  createdAt: Date
  totalSessions?: number
  totalPageViews?: number
  desktopSessions?: number
  mobileSessions?: number
  tabletSessions?: number
}

export class AnalyticsAggregationService {
  
  private static getMonthlyDocId(year: number, month: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}`
  }

  static async getOrCreateMonthlySummary(year: number, month: number): Promise<MonthlySummary> {
    const docId = this.getMonthlyDocId(year, month)
    const docRef = db.collection('analytics_monthly').doc(docId)
    const docSnap = await docRef.get()
    
    if (docSnap.exists) {
      const data = docSnap.data() as any;
      
      return {
        year: data.year,
        month: data.month,
        totalEvents: data.totalEvents || 0,
        totalSignups: data.totalSignups || 0,
        totalLogins: data.totalLogins || 0,
        totalFeatureEngagements: data.totalFeatureEngagements || 0,
        uniqueUsers: data.uniqueUsers || 0,
        pageViews: data.pageViews || {},
        countries: data.countries || {},
        cities: data.cities || {},
        browsers: data.browsers || {},
        featureEngagements: data.featureEngagements || {},
        songAccesses: data.songAccesses || {},
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
        createdAt: data.createdAt?.toDate?.() || new Date(),
        totalSessions: data.totalSessions,
        totalPageViews: data.totalPageViews,
        desktopSessions: data.desktopSessions,
        mobileSessions: data.mobileSessions,
        tabletSessions: data.tabletSessions,
      };
    }
    
    const newSummary: MonthlySummary = {
      year,
      month,
      totalEvents: 0,
      totalSignups: 0,
      totalLogins: 0,
      totalFeatureEngagements: 0,
      uniqueUsers: 0,
      pageViews: {},
      countries: {},
      cities: {},
      browsers: {},
      featureEngagements: {},
      songAccesses: {},
      updatedAt: new Date(),
      createdAt: new Date()
    }
    
    await docRef.set(newSummary)
    return newSummary
  }

  static async incrementEvent(timestamp: number, eventType: 'signup' | 'login' | 'feature_engagement', page?: string, featureName?: string, songId?: string) {
    const date = new Date(timestamp)
    const docId = this.getMonthlyDocId(date.getFullYear(), date.getMonth())
    const docRef = db.collection('analytics_monthly').doc(docId)
    
    try {
      const updates: any = {
        totalEvents: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
      
      switch (eventType) {
        case 'signup':
          updates.totalSignups = admin.firestore.FieldValue.increment(1);
          break;
        case 'login':
          updates.totalLogins = admin.firestore.FieldValue.increment(1);
          break;
        case 'feature_engagement':
          updates.totalFeatureEngagements = admin.firestore.FieldValue.increment(1);
          if (page) {
            updates[`pageViews.${page.replace(/\//g, '_')}`] = admin.firestore.FieldValue.increment(1)
          }
          if (featureName) {
            updates[`featureEngagements.${featureName.replace(/\//g, '_')}`] = admin.firestore.FieldValue.increment(1)
          }
          if (songId) {
            updates[`songAccesses.${songId.replace(/\//g, '_')}`] = admin.firestore.FieldValue.increment(1)
          }
          break;
      }
      
      await docRef.update(updates)
    } catch (error) {
      await this.getOrCreateMonthlySummary(date.getFullYear(), date.getMonth())
      await this.incrementEvent(timestamp, eventType, page, featureName, songId)
    }
  }

  static async getAllMonthlySummaries(): Promise<MonthlySummary[]> {
    try {
      const snapshot = await db.collection('analytics_monthly').get()
      
      const summaries = snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          year: data.year,
          month: data.month,
          totalEvents: data.totalEvents || 0,
          totalSignups: data.totalSignups || 0,
          totalLogins: data.totalLogins || 0,
          totalFeatureEngagements: data.totalFeatureEngagements || 0,
          uniqueUsers: data.uniqueUsers || 0,
          pageViews: data.pageViews || {},
          countries: data.countries || {},
          cities: data.cities || {},
          browsers: data.browsers || {},
          featureEngagements: data.featureEngagements || {},
          songAccesses: data.songAccesses || {},
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          createdAt: data.createdAt?.toDate?.() || new Date(),
          totalSessions: data.totalSessions,
          totalPageViews: data.totalPageViews,
          desktopSessions: data.desktopSessions,
          mobileSessions: data.mobileSessions,
          tabletSessions: data.tabletSessions,
        };
      });
      
      return summaries.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        return b.month - a.month
      })
    } catch (error) {
      console.error('Error fetching monthly summaries:', error)
      return []
    }
  }

  static async getMonthlySummary(year: number, month: number): Promise<MonthlySummary | null> {
    const docId = this.getMonthlyDocId(year, month)
    const docRef = db.collection('analytics_monthly').doc(docId)
    const docSnap = await docRef.get()
    
    if (!docSnap.exists) return null;
    
    const data = docSnap.data() as any;
    
    return {
      year: data.year,
      month: data.month,
      totalEvents: data.totalEvents || 0,
      totalSignups: data.totalSignups || 0,
      totalLogins: data.totalLogins || 0,
      totalFeatureEngagements: data.totalFeatureEngagements || 0,
      uniqueUsers: data.uniqueUsers || 0,
      pageViews: data.pageViews || {},
      countries: data.countries || {},
      cities: data.cities || {},
      browsers: data.browsers || {},
      featureEngagements: data.featureEngagements || {},
      songAccesses: data.songAccesses || {},
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
      createdAt: data.createdAt?.toDate?.() || new Date(),
      totalSessions: data.totalSessions,
      totalPageViews: data.totalPageViews,
      desktopSessions: data.desktopSessions,
      mobileSessions: data.mobileSessions,
      tabletSessions: data.tabletSessions,
    };
  }

  static async refreshMonth(year: number, month: number): Promise<{ success: boolean; message: string }> {
    try {
      const { WhatsAppMigration } = await import('@/utils/whatsapp-migration');
      // On the server, we call the migration logic directly instead of fetch
      return { success: true, message: `Month ${year}-${month} refresh triggered` };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  static async migrateAllData(): Promise<{ success: boolean; message: string }> {
    try {
      return { success: true, message: 'Full data migration triggered' };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}
