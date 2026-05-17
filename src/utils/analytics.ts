// Simplified Analytics tracking utility
import { FirebaseDatabaseService } from '@/lib/firebase-database';

export interface AnalyticsEvent {
  id: string;
  type: 'signup' | 'login' | 'feature_engagement';
  featureName?: string; // For feature engagement events
  songId?: string; // For song-specific tracking
  timestamp: number;
  userId?: string;
  page?: string;
  country?: string;
  city?: string;
  browser?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  metadata?: Record<string, any>;
}

export interface SessionData {
  sessionId: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  country?: string;
  city?: string;
  browser?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
}

class AnalyticsTracker {
  private isTracking: boolean = false;

  constructor() {
    this.initializeTracking();
  }

  private getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    if (typeof navigator === 'undefined') return 'desktop';
    const userAgent = navigator.userAgent.toLowerCase();
    if (/tablet|ipad/.test(userAgent)) return 'tablet';
    if (/mobile|android|iphone/.test(userAgent)) return 'mobile';
    return 'desktop';
  }

  private getBrowser(): string {
    if (typeof navigator === 'undefined') return 'Unknown';
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  }

  private async getLocation(): Promise<{ country?: string; city?: string }> {
    try {
      // Using a free IP geolocation service
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      return {
        country: data.country_name,
        city: data.city
      };
    } catch (error) {
 console.warn('Could not fetch location data:', error);
      return {};
    }
  }

  private initializeTracking(): void {
    if (typeof window === 'undefined') return;

    this.isTracking = true;
  }

  private async updateSessionPageViews(): Promise<void> {
    // Simplified update - not needed in this version
  }

  public async trackEvent(type: AnalyticsEvent['type'], featureName?: string, page?: string): Promise<void> {
    if (!this.isTracking) return;

    const location = await this.getLocation();

    const event: AnalyticsEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: Date.now(),
      page: page || undefined,
      featureName: featureName || undefined,
      country: location.country || undefined,
      city: location.city || undefined,
      browser: this.getBrowser(),
      deviceType: this.getDeviceType(),
      metadata: {}
    };

    // Remove undefined fields to prevent Firebase errors
    const sanitizedEvent = JSON.parse(JSON.stringify(event));

    this.sendEvent(sanitizedEvent);
  }

  public async trackSessionEnd(): Promise<void> {
    if (!this.isTracking) return;

    this.isTracking = false;
  }

  private async sendEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Store event in Firebase
      await this.storeEventInFirebase(event);
    } catch (error) {
 console.warn('Failed to send analytics event:', error);
    }
  }

  private async storeEventInFirebase(event: AnalyticsEvent): Promise<void> {
    try {
      await FirebaseDatabaseService.createDocument('analytics_events', event.id, event as any);
    } catch (error) {
 console.warn('Failed to store analytics event in Firebase:', error);
    }
  }



  public async getStoredEvents(): Promise<AnalyticsEvent[]> {
    try {
      const events = await FirebaseDatabaseService.getCollection('analytics_events');
      return (events as any) || [];
    } catch (error) {
 console.warn('Failed to get stored events from Firebase:', error);
      return [];
    }
  }



  public async clearStoredData(): Promise<void> {
    try {
 console.warn('Clear data functionality needs to be implemented in FirebaseDatabaseService');
    } catch (error) {
 console.warn('Failed to clear stored data:', error);
    }
  }

  // Public method to get analytics data for the dashboard
  public async getAnalyticsData(dateRange: string = '7d'): Promise<any> {
    const events = await this.getStoredEvents();

    const now = Date.now();
    const daysBack = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
    const cutoffTime = now - (daysBack * 24 * 60 * 60 * 1000);

    const filteredEvents = events.filter(event => event.timestamp >= cutoffTime);

    // Calculate metrics
    const signups = filteredEvents.filter(e => e.type === 'signup').length;
    const logins = filteredEvents.filter(e => e.type === 'login').length;
    const featureEngagements = filteredEvents.filter(e => e.type === 'feature_engagement').length;

    // Top pages (from feature engagement events that have pages)
    const pageViewsByPage = filteredEvents
      .filter(e => e.type === 'feature_engagement' && e.page)
      .reduce((acc, event) => {
        acc[event.page!] = (acc[event.page!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const topPages = Object.entries(pageViewsByPage)
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    // Browser stats
    const browserCounts = filteredEvents.reduce((acc, event) => {
      if (event.browser) {
        acc[event.browser] = (acc[event.browser] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const totalBrowsers = Object.values(browserCounts).reduce((sum, count) => sum + count, 0);
    const browserStats = Object.entries(browserCounts).map(([browser, count]) => ({
      browser,
      count,
      percentage: totalBrowsers > 0 ? (count / totalBrowsers) * 100 : 0
    }));

    // Countries
    const countryCounts = filteredEvents.reduce((acc, event) => {
      if (event.country) {
        acc[event.country] = (acc[event.country] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const totalCountries = Object.values(countryCounts).reduce((sum, count) => sum + count, 0);
    const countries = Object.entries(countryCounts).map(([country, count]) => ({
      country,
      count,
      percentage: totalCountries > 0 ? (count / totalCountries) * 100 : 0
    }));

    // Cities
    const cityCounts = filteredEvents.reduce((acc, event) => {
      if (event.city) {
        acc[event.city] = (acc[event.city] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const totalCities = Object.values(cityCounts).reduce((sum, count) => sum + count, 0);
    const cities = Object.entries(cityCounts).map(([city, count]) => ({
      city,
      count,
      percentage: totalCities > 0 ? (count / totalCities) * 100 : 0
    }));

    // Feature engagement
    const featureCounts = filteredEvents
      .filter(e => e.type === 'feature_engagement' && e.featureName)
      .reduce((acc, event) => {
        acc[event.featureName!] = (acc[event.featureName!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const featureEngagementStats = Object.entries(featureCounts).map(([feature, count]) => ({
      feature,
      count
    }));

    return {
      signups,
      logins,
      featureEngagements,
      topPages,
      browserStats,
      countries,
      cities,
      featureEngagementStats
    };
  }
}

// Create singleton instance
export const analyticsTracker = new AnalyticsTracker();

// Export for use in components
export const trackSignup = async (userId?: string) => {
  await analyticsTracker.trackEvent('signup');
};
export const trackLogin = async (userId?: string) => {
  await analyticsTracker.trackEvent('login');
};
export const trackFeatureEngagement = async (featureName: string, page?: string) => {
  await analyticsTracker.trackEvent('feature_engagement', featureName, page);
};
export const getAnalyticsData = (dateRange?: string) => analyticsTracker.getAnalyticsData(dateRange);
export const clearAnalyticsData = () => analyticsTracker.clearStoredData();
