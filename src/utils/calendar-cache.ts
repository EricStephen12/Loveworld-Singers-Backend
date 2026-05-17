/**
 * Calendar Cache - Frontend Only
 * Stubbed for backend compatibility
 */

export class CalendarCache {
  static saveEvents(zoneId: string, events: any[]): void {
    // No-op on backend
  }

  static loadEvents(zoneId: string): any[] | null {
    // No-op on backend
    return null;
  }

  static clearEvents(zoneId: string): void {
    // No-op on backend
  }

  static clearAll(): void {
    // No-op on backend
  }
}
