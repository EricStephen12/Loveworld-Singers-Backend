import { db, FieldValue } from './firebase-admin';

interface SimplifiedAnalyticsRecord {
  id: string;
  year: number;
  month: number;
  totalSignups: number;
  totalLogins: number;
  totalFeatureEngagements: number;
  totalSongMinistries: number;
  uniqueUsers: number;
  pageViews: { [page: string]: number };
  countries: { [country: string]: number };
  cities: { [city: string]: number };
  browsers: { [browser: string]: number };
  featureEngagements: { [feature: string]: number };
  songMinistries: { [songId: string]: number };
  updatedAt: any;
  createdAt: any;
}

export class SimplifiedAnalyticsService {
  
  private static getMonthlyDocId(year: number, month: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }

  static async incrementSignups(count: number = 1) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const docId = this.getMonthlyDocId(year, month);
    const docRef = db.collection('simplified_analytics').doc(docId);
    
    await docRef.set({
      year,
      month,
      totalSignups: FieldValue.increment(count),
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp() // Only used if creating new doc
    }, { merge: true });
  }

  static async incrementLogins(count: number = 1) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const docId = this.getMonthlyDocId(year, month);
    const docRef = db.collection('simplified_analytics').doc(docId);
    
    await docRef.set({
      year,
      month,
      totalLogins: FieldValue.increment(count),
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  static async incrementFeatureEngagements(featureName: string, count: number = 1) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const docId = this.getMonthlyDocId(year, month);
    const docRef = db.collection('simplified_analytics').doc(docId);
    
    const safeFeatureName = featureName.replace(/\./g, '_');
    
    await docRef.set({
      year,
      month,
      totalFeatureEngagements: FieldValue.increment(count),
      featureEngagements: {
        [safeFeatureName]: FieldValue.increment(count)
      },
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  static async incrementSongMinistries(songId: string, songTitle: string, count: number = 1) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const docId = this.getMonthlyDocId(year, month);
    const docRef = db.collection('simplified_analytics').doc(docId);
    
    const safeSongId = songId.replace(/\./g, '_');
    
    await docRef.set({
      year,
      month,
      totalSongMinistries: FieldValue.increment(count),
      songMinistries: {
        [safeSongId]: FieldValue.increment(count)
      },
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  static async trackLocation(country: string, city: string) {
    if (!country) return;
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const docId = this.getMonthlyDocId(year, month);
    const docRef = db.collection('simplified_analytics').doc(docId);
    
    const safeCountry = country.replace(/[.\/]/g, '_');
    const safeCity = city ? city.replace(/[.\/]/g, '_') : 'Unknown';
    
    await docRef.set({
      year,
      month,
      countries: { [safeCountry]: FieldValue.increment(1) },
      cities: { [safeCity]: FieldValue.increment(1) },
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  static async getUserLocation(): Promise<{ country: string; city: string } | null> {
    try {
      const response = await fetch('http://ip-api.com/json/?fields=country,city');
      if (!response.ok) return null;
      
      const data = await response.json();
      return {
        country: data.country || 'Unknown',
        city: data.city || 'Unknown'
      };
    } catch (error) {
      console.error('Error getting user location:', error);
      return null;
    }
  }

  static async trackUserLocation() {
    try {
      const location = await this.getUserLocation();
      if (location) {
        await this.trackLocation(location.country, location.city);
      }
    } catch (error) {
      console.error('Error tracking user location:', error);
    }
  }

  static async getMonthlySummary(year: number, month: number): Promise<SimplifiedAnalyticsRecord | null> {
    const docId = this.getMonthlyDocId(year, month);
    const docSnap = await db.collection('simplified_analytics').doc(docId).get();
    
    if (!docSnap.exists) return null;
    
    const data = docSnap.data() || {};
    return {
      id: docId,
      year: data.year,
      month: data.month,
      totalSignups: data.totalSignups || 0,
      totalLogins: data.totalLogins || 0,
      totalFeatureEngagements: data.totalFeatureEngagements || 0,
      totalSongMinistries: data.totalSongMinistries || 0,
      uniqueUsers: data.uniqueUsers || 0,
      pageViews: data.pageViews || {},
      countries: data.countries || {},
      cities: data.cities || {},
      browsers: data.browsers || {},
      featureEngagements: data.featureEngagements || {},
      songMinistries: data.songMinistries || {},
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      createdAt: data.createdAt?.toDate?.() || data.createdAt
    } as SimplifiedAnalyticsRecord;
  }

  static async getAllMonthlySummaries(): Promise<SimplifiedAnalyticsRecord[]> {
    try {
      const snapshot = await db.collection('simplified_analytics').get();
      
      const records = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          year: data.year,
          month: data.month,
          totalSignups: data.totalSignups || 0,
          totalLogins: data.totalLogins || 0,
          totalFeatureEngagements: data.totalFeatureEngagements || 0,
          totalSongMinistries: data.totalSongMinistries || 0,
          uniqueUsers: data.uniqueUsers || 0,
          pageViews: data.pageViews || {},
          countries: data.countries || {},
          cities: data.cities || {},
          browsers: data.browsers || {},
          featureEngagements: data.featureEngagements || {},
          songMinistries: data.songMinistries || {},
          updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
          createdAt: data.createdAt?.toDate?.() || data.createdAt
        };
      });
      
      return records.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      }) as SimplifiedAnalyticsRecord[];
    } catch (error) {
      console.error('Error fetching monthly summaries:', error);
      return [];
    }
  }
}