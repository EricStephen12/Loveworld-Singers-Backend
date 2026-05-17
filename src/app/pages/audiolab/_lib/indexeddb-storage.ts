/**
 * INDEXEDDB STORAGE FOR AUDIOLAB
 * 
 * Best practice: Use IndexedDB instead of localStorage for audio files
 * - localStorage: 5-10MB limit, synchronous, blocks UI
 * - IndexedDB: Can store GBs, asynchronous, non-blocking
 * 
 * This is the industry standard for storing large files locally
 */

const DB_NAME = 'audiolab_storage';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

interface StoredRecording {
  trackId: string;
  blob: Blob;
  timestamp: number;
  projectId?: string;
}

/**
 * Open IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'trackId' });
        store.createIndex('projectId', 'projectId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Save recording to IndexedDB (BEST PRACTICE - replaces localStorage)
 */
export async function saveRecordingToIndexedDB(
  trackId: string, 
  blob: Blob, 
  projectId?: string
): Promise<boolean> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const recording: StoredRecording = {
      trackId,
      blob,
      timestamp: Date.now(),
      projectId
    };
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(recording);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    db.close();
    return true;
  } catch (error) {
 console.error('[IndexedDB] Failed to save recording:', error);
    return false;
  }
}

/**
 * Get recording from IndexedDB
 */
export async function getRecordingFromIndexedDB(trackId: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const recording = await new Promise<StoredRecording | null>((resolve, reject) => {
      const request = store.get(trackId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    
    db.close();
    
    if (recording) {
      return recording.blob;
    }
    
    return null;
  } catch (error) {
 console.error('[IndexedDB] Failed to get recording:', error);
    return null;
  }
}

/**
 * Get all recordings for a project
 */
export async function getProjectRecordings(projectId: string): Promise<Map<string, Blob>> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('projectId');
    
    const recordings = await new Promise<StoredRecording[]>((resolve, reject) => {
      const request = index.getAll(projectId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    
    db.close();
    
    const map = new Map<string, Blob>();
    recordings.forEach(rec => {
      map.set(rec.trackId, rec.blob);
    });
    
    return map;
  } catch (error) {
 console.error('[IndexedDB] Failed to get project recordings:', error);
    return new Map();
  }
}

/**
 * Get all recordings (for recovery on app restart)
 */
export async function getAllRecordings(): Promise<Map<string, { blob: Blob; projectId?: string; timestamp: number }>> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    const recordings = await new Promise<StoredRecording[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    
    db.close();
    
    const map = new Map<string, { blob: Blob; projectId?: string; timestamp: number }>();
    recordings.forEach(rec => {
      map.set(rec.trackId, { 
        blob: rec.blob, 
        projectId: rec.projectId,
        timestamp: rec.timestamp 
      });
    });
    
    return map;
  } catch (error) {
 console.error('[IndexedDB] Failed to get all recordings:', error);
    return new Map();
  }
}

/**
 * Delete recording from IndexedDB
 */
export async function deleteRecordingFromIndexedDB(trackId: string): Promise<boolean> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(trackId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    db.close();
    return true;
  } catch (error) {
 console.error('[IndexedDB] Failed to delete recording:', error);
    return false;
  }
}

/**
 * Get storage usage (estimate)
 */
export async function getStorageUsage(): Promise<{ used: number; available: number }> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        available: estimate.quota || 0
      };
    }
    return { used: 0, available: 0 };
  } catch (error) {
 console.error('[IndexedDB] Failed to get storage estimate:', error);
    return { used: 0, available: 0 };
  }
}






