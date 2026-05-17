/**
 * SIMPLE UNIFIED ID MANAGER
 * Rule: ALWAYS use firebaseId for Firebase operations. That's it!
 */

export class IDManager {
  /**
   * Get the Firebase document ID - ALWAYS use this for database operations
   * Priority: firebaseId ONLY (ignore numeric id from Supabase migration)
   */
  static getPrimaryId(song: any): string {
    if (!song) return '';

    // ONLY use firebaseId - this is the actual Firebase document ID
    const firebaseId = song.firebaseId;

    if (firebaseId && typeof firebaseId === 'string' && firebaseId.trim() !== '') {
      return firebaseId.trim();
    }

    // Fallback: if no firebaseId, check if id is a string (not a number from Supabase)
    const id = song.id;
    if (id && typeof id === 'string' && id.trim() !== '') {
      return id.trim();
    }

 console.error(' No valid Firebase ID found for song:', {
      title: song.title,
      firebaseId: song.firebaseId,
      id: song.id,
      idType: typeof song.id
    });
    return '';
  }

  /**
   * Normalize any ID to string format
   */
  static normalizeId(id: any): string {
    if (!id || id === null || id === undefined) return '';

    const stringId = String(id).trim();

    if (stringId === '' || stringId === 'null' || stringId === 'undefined') {
      return '';
    }

    return stringId;
  }

  /**
   * Check if an ID is valid for Firebase operations
   */
  static isValidId(id: any): boolean {
    const normalized = this.normalizeId(id);
    return normalized !== '' && normalized !== 'null' && normalized !== 'undefined';
  }

  /**
   * Check if two IDs are the same
   */
  static areIdsEqual(id1: any, id2: any): boolean {
    const normalized1 = this.normalizeId(id1);
    const normalized2 = this.normalizeId(id2);
    return normalized1 === normalized2 && normalized1 !== '';
  }

  /**
   * Debug helper
   */
  static debugIds(song: any, context: string = ''): void {
  }

  // Legacy compatibility methods (not used anymore, but kept to avoid breaking code)
  static isFirebaseId(id: any): boolean { return true; }
  static isSupabaseId(id: any): boolean { return false; }
  static getDisplayId(song: any): string { return this.getPrimaryId(song); }
  static createNewId(): string { return ''; }
}

export default IDManager;
