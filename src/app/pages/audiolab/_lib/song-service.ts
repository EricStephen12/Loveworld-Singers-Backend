/**
 * AUDIOLAB SONG SERVICE
 * 
 * Firebase integration for AudioLab songs
 * Fetches from master_songs (Master Library) - songs published by HQ
 * All zones can access Master Library songs for practice
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  startAfter,
  where,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
  getCountFromServer,
  startAt,
  endAt
} from 'firebase/firestore';
import { db } from '@/lib/firebase-setup';
import type {
  AudioLabSong,
  CreateSongInput,
  VocalPart,
  AudioUrls,
  LyricLine
} from '../_types';

// Collection names
const MASTER_SONGS_COLLECTION = 'master_songs'; // Primary source - HQ published songs
const AUDIOLAB_SONGS_COLLECTION = 'audiolab_songs'; // Zone-specific songs (future use)
const COLLECTION_NAME = AUDIOLAB_SONGS_COLLECTION; // Default collection for CRUD operations

// Cache for songs (5 min TTL)
const songCache: Map<string, { data: AudioLabSong[]; timestamp: number }> = new Map();
const paginatedCache: Map<string, { data: { songs: AudioLabSong[]; lastDoc: any }; timestamp: number }> = new Map();
const countCache: { value: number; timestamp: number } | null = { value: 0, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000;

// TYPES

export interface MasterProgram {
  id: string;
  name: string;
  description?: string;
  songIds: string[];
  sortOrder?: number;
}

// FETCH OPERATIONS

/**
 * Get all programs (categories)
 */
export async function getPrograms(): Promise<MasterProgram[]> {
  try {
    const q = query(collection(db, 'master_programs'));
    const snapshot = await getDocs(q);

    const programs = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || '',
      description: doc.data().description || '',
      songIds: doc.data().songIds || [],
      sortOrder: doc.data().sortOrder
    }));

    // Sort by sortOrder first, then name
    return programs.sort((a, b) => {
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
        return a.sortOrder - b.sortOrder
      }
      if (a.sortOrder !== undefined) return -1
      if (b.sortOrder !== undefined) return 1
      return a.name.localeCompare(b.name)
    })
  } catch (error) {
 console.error('[SongService] Error fetching programs:', error);
    return [];
  }
}

/**
 * Get songs for a specific program
 */
export async function getSongsByProgram(programId: string): Promise<AudioLabSong[]> {
  try {
    if (!programId) return [];

    // 1. Get the program to get song IDs
    const programRef = doc(db, 'master_programs', programId);
    const programSnap = await getDoc(programRef);

    if (!programSnap.exists()) return [];

    const songIds = programSnap.data().songIds || [];
    if (songIds.length === 0) return [];

    // 2. Fetch the actual songs (in batches of 10 due to Firestore 'in' limit, or manually)
    // For simplicity, we'll fetch all master songs and filter, OR simpler: fetch individually if small number
    // But optimal way for large lists: Use the existing logic but filter locally if we have cache, 
    // or since we are "LibraryView", we might want to respect the "getSongs" flow.

    // Better approach: Get all songs (cached) and filter.
    // Since getSongs() uses cache, this is efficient.
    const allSongs = await getSongs(undefined, 5000); // Get a large batch
    return allSongs.filter(song => songIds.includes(song.id));

  } catch (error) {
 console.error('[SongService] Error fetching program songs:', error);
    return [];
  }
}

/**
 * Get songs from Master Library with pagination support
 */
export async function getSongsPaginated(
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  limitCount: number = 20
): Promise<{ songs: AudioLabSong[], lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
  try {
    const masterSongsRef = collection(db, MASTER_SONGS_COLLECTION);

    let q;
    if (lastDoc) {
      q = query(
        masterSongsRef,
        orderBy('publishedAt', 'desc'),
        startAfter(lastDoc),
        limit(limitCount)
      );
    } else {
      q = query(
        masterSongsRef,
        orderBy('publishedAt', 'desc'),
        limit(limitCount)
      );
    }

    // Cache logic for the FIRST page only
    const cacheKey = `paginated_first_page_${limitCount}`;
    if (!lastDoc) {
      const cached = paginatedCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {

        return cached.data;
      }
    }

    const snapshot = await getDocs(q);
    const songs = snapshot.docs.map(doc => masterSongToAudioLabSong(doc));

    const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
    const result = {
      songs,
      lastDoc: lastVisible
    };

    // Store in cache if first page
    if (!lastDoc) {
      paginatedCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    return result;
  } catch (error) {
 console.error('[SongService] Error fetching songs paginated:', error);
    return { songs: [], lastDoc: null };
  }
}

/**
 * Deep search songs across Master Library and Praise Night (Local filtering on full set for better results)
 */
export async function searchSongsDeep(searchTerm: string, zoneId?: string): Promise<AudioLabSong[]> {
  try {
    if (!searchTerm || searchTerm.trim().length < 2) return [];

    const queryTerm = searchTerm.toLowerCase().trim();
    
    // Fetch all Master Library songs (cached)
    const masterSongs = await getSongs(undefined, 5000);
    
    // Filter locally for better flexibility (matches anywhere in title/artist/genre)
    return masterSongs.filter(song => 
      song.title.toLowerCase().includes(queryTerm) ||
      song.artist.toLowerCase().includes(queryTerm) ||
      (song.genre && song.genre.toLowerCase().includes(queryTerm))
    );
  } catch (error) {
    console.error('[SongService] Error performing deep search:', error);
    return [];
  }
}

/**
 * Get total number of songs in Master Library
 */
export async function getTotalSongCount(): Promise<number> {
  try {
    // Check cache
    if (countCache && Date.now() - countCache.timestamp < CACHE_TTL) {

      return countCache.value;
    }

    const masterSongsRef = collection(db, MASTER_SONGS_COLLECTION);
    const q = query(masterSongsRef);
    const snapshot = await getCountFromServer(q);
    const count = snapshot.data().count;

    // Update cache
    if (countCache) {
      countCache.value = count;
      countCache.timestamp = Date.now();
    }

    return count;
  } catch (error) {
 console.error('[SongService] Error fetching total count:', error);
    return 0;
  }
}

export async function getSongs(zoneId?: string, limitCount: number = 500): Promise<AudioLabSong[]> {
  try {
    const cacheKey = `master_library_${limitCount}`;
    const cached = songCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }


    // Fetch from master_songs collection (HQ published songs)
    const masterSongsRef = collection(db, MASTER_SONGS_COLLECTION);
    const q = query(
      masterSongsRef,
      orderBy('publishedAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const songs = snapshot.docs.map(doc => masterSongToAudioLabSong(doc));

    songCache.set(cacheKey, { data: songs, timestamp: Date.now() });

    return songs;
  } catch (error) {
 console.error('[SongService] Error fetching songs from Master Library:', error);
    return [];
  }
}

/**
 * Get ALL songs from Master Library (including those without audio)
 * Used for browsing/viewing lyrics
 */
export async function getAllMasterSongs(limitCount: number = 200): Promise<AudioLabSong[]> {
  try {
    const cacheKey = 'master_library_all';
    const cached = songCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const masterSongsRef = collection(db, MASTER_SONGS_COLLECTION);
    const q = query(
      masterSongsRef,
      orderBy('publishedAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const songs = snapshot.docs.map(doc => masterSongToAudioLabSong(doc));

    songCache.set(cacheKey, { data: songs, timestamp: Date.now() });
    return songs;
  } catch (error) {
 console.error('[SongService] Error fetching all Master Library songs:', error);
    return [];
  }
}

/**
 * Get a single song by ID (checks Master Library first)
 */
export async function getSongById(songId: string): Promise<AudioLabSong | null> {
  try {

    // Try Master Library first
    const masterDocRef = doc(db, MASTER_SONGS_COLLECTION, songId);
    const masterDocSnap = await getDoc(masterDocRef);

    if (masterDocSnap.exists()) {
      return masterSongToAudioLabSong(masterDocSnap);
    }

    // Fallback to audiolab_songs collection
    const docRef = doc(db, AUDIOLAB_SONGS_COLLECTION, songId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docToSong(docSnap);
    }

    // Fallback to Praise Night songs
    try {
      const { PraiseNightSongsService } = await import('@/lib/praise-night-songs-service');
      // We pass null for zoneId here just to try fetching the specific song, 
      // however PraiseNightSongsService doesn't have a direct getById. 
      // Instead, we will search Firestore directly for the ID in praise_night_songs.
      const pnDocRef = doc(db, 'praise_night_songs', songId);
      const pnDocSnap = await getDoc(pnDocRef);
      if (pnDocSnap.exists()) {
         const pnData = pnDocSnap.data();
         pnData.id = pnDocSnap.id;
         
         const mergedAudioUrls = {
           full: pnData.audioFile || '',
           ...(pnData.audioUrls || {})
         };

         return {
            id: pnData.id,
            title: pnData.title || 'Untitled',
            artist: pnData.leadSinger || pnData.writer || 'Praise Night',
            duration: 300,
            audioUrls: mergedAudioUrls,
            availableParts: Object.keys(mergedAudioUrls).filter(k => !!(mergedAudioUrls as any)[k]) as VocalPart[],
            genre: pnData.category || 'Praise Night',
            key: pnData.key || '',
            tempo: pnData.tempo ? parseInt(pnData.tempo) : 0,
            albumArt: '',
            lyrics: parseLyrics(pnData.lyrics),
            zoneId: '',
            isHQSong: false,
            createdAt: pnData.createdAt?.toDate?.() || new Date(),
            updatedAt: pnData.updatedAt?.toDate?.() || new Date(),
            createdBy: 'system'
         };
      }
    } catch (e) {
      console.error('[SongService] Error fetching fallback PN song:', e);
    }

    return null;
  } catch (error) {
 console.error('[SongService] Error fetching song:', error);
    return null;
  }
}

/**
 * Search songs by title, artist, or genre
 */
export async function searchSongs(queryStr: string, zoneId?: string): Promise<AudioLabSong[]> {
  try {
    // Get all songs and filter client-side (Firestore doesn't support full-text search)
    const allSongs = await getSongs(zoneId);
    const searchLower = queryStr.toLowerCase();

    return allSongs.filter(song =>
      song.title.toLowerCase().includes(searchLower) ||
      song.artist.toLowerCase().includes(searchLower) ||
      (song.genre?.toLowerCase().includes(searchLower)) ||
      (song.key?.toLowerCase().includes(searchLower))
    );
  } catch (error) {
 console.error('[SongService] Error searching songs:', error);
    return [];
  }
}

/**
 * Get songs that have a specific vocal part available
 * Filters from Master Library songs
 */
export async function getSongsByVocalPart(part: VocalPart, zoneId?: string): Promise<AudioLabSong[]> {
  try {

    // Get all songs from Master Library and filter client-side
    // (Master songs don't have availableParts field, we derive it from audioUrls)
    const allSongs = await getSongs(zoneId);

    const filteredSongs = allSongs.filter(song =>
      song.availableParts?.includes(part)
    );

    return filteredSongs;
  } catch (error) {
 console.error('[SongService] Error fetching songs by part:', error);
    return [];
  }
}

// CRUD OPERATIONS (Admin)

/**
 * Create a new song
 */
export async function createSong(input: CreateSongInput): Promise<{ success: boolean; id?: string; error?: string }> {
  try {

    // Validate required fields
    if (!input.title || !input.artist || !input.duration) {
      return { success: false, error: 'Missing required fields' };
    }

    // Ensure at least one audio URL
    if (!input.audioUrls || Object.keys(input.audioUrls).length === 0) {
      return { success: false, error: 'At least one audio URL is required' };
    }

    const songData = {
      title: input.title,
      artist: input.artist,
      duration: input.duration,
      audioUrls: input.audioUrls,
      availableParts: input.availableParts || determineAvailableParts(input.audioUrls),
      genre: input.genre || '',
      key: input.key || '',
      tempo: input.tempo || 0,
      albumArt: input.albumArt || '',
      lyrics: input.lyrics || [],
      zoneId: input.zoneId || '',
      isHQSong: input.isHQSong ?? !input.zoneId,
      createdBy: input.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), songData);

    clearSongCache();

    return { success: true, id: docRef.id };
  } catch (error) {
 console.error('[SongService] Error creating song:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create song'
    };
  }
}

/**
 * Update an existing song
 */
export async function updateSong(
  songId: string,
  updates: Partial<Omit<AudioLabSong, 'id' | 'createdAt' | 'createdBy'>>
): Promise<{ success: boolean; error?: string }> {
  try {

    const docRef = doc(db, COLLECTION_NAME, songId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: 'Song not found' };
    }

    // If audioUrls changed, update availableParts
    if (updates.audioUrls) {
      updates.availableParts = determineAvailableParts(updates.audioUrls);
    }

    // Remove undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await updateDoc(docRef, {
      ...cleanUpdates,
      updatedAt: serverTimestamp()
    });

    clearSongCache();

    return { success: true };
  } catch (error) {
 console.error('[SongService] Error updating song:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update song'
    };
  }
}

/**
 * Delete a song
 */
export async function deleteSong(songId: string): Promise<{ success: boolean; error?: string }> {
  try {

    const docRef = doc(db, COLLECTION_NAME, songId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: 'Song not found' };
    }

    await deleteDoc(docRef);

    clearSongCache();

    return { success: true };
  } catch (error) {
 console.error('[SongService] Error deleting song:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete song'
    };
  }
}

// AUDIO PART MANAGEMENT

/**
 * Upload/update a specific vocal part for a song
 */
export async function updateSongAudioPart(
  songId: string,
  part: VocalPart,
  url: string
): Promise<{ success: boolean; error?: string }> {
  try {

    const docRef = doc(db, COLLECTION_NAME, songId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: 'Song not found' };
    }

    const currentData = docSnap.data();
    const audioUrls = { ...currentData.audioUrls, [part]: url };
    const availableParts = determineAvailableParts(audioUrls);

    await updateDoc(docRef, {
      audioUrls,
      availableParts,
      updatedAt: serverTimestamp()
    });

    clearSongCache();

    return { success: true };
  } catch (error) {
 console.error('[SongService] Error updating audio part:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update audio part'
    };
  }
}

/**
 * Remove a specific vocal part from a song
 */
export async function removeSongAudioPart(
  songId: string,
  part: VocalPart
): Promise<{ success: boolean; error?: string }> {
  try {

    const docRef = doc(db, COLLECTION_NAME, songId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: 'Song not found' };
    }

    const currentData = docSnap.data();
    const audioUrls = { ...currentData.audioUrls };
    delete audioUrls[part];

    // Ensure at least one part remains
    if (Object.keys(audioUrls).length === 0) {
      return { success: false, error: 'Cannot remove the last audio part' };
    }

    const availableParts = determineAvailableParts(audioUrls);

    await updateDoc(docRef, {
      audioUrls,
      availableParts,
      updatedAt: serverTimestamp()
    });

    clearSongCache();

    return { success: true };
  } catch (error) {
 console.error('[SongService] Error removing audio part:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove audio part'
    };
  }
}

// LYRICS MANAGEMENT

/**
 * Update lyrics for a song
 */
export async function updateSongLyrics(
  songId: string,
  lyrics: LyricLine[]
): Promise<{ success: boolean; error?: string }> {
  try {

    const docRef = doc(db, COLLECTION_NAME, songId);

    await updateDoc(docRef, {
      lyrics,
      updatedAt: serverTimestamp()
    });

    clearSongCache();

    return { success: true };
  } catch (error) {
 console.error('[SongService] Error updating lyrics:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update lyrics'
    };
  }
}

// HELPER FUNCTIONS

/**
 * Convert Firestore document to AudioLabSong
 */
function docToSong(doc: any): AudioLabSong {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title || '',
    artist: data.artist || '',
    duration: data.duration || 0,
    audioUrls: data.audioUrls || {},
    availableParts: data.availableParts || [],
    genre: data.genre || '',
    key: data.key || '',
    tempo: data.tempo || 0,
    albumArt: data.albumArt || '',
    lyricsUrl: data.lyricsUrl || '',
    lyrics: data.lyrics || [],
    zoneId: data.zoneId || '',
    isHQSong: data.isHQSong ?? true,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
    createdBy: data.createdBy || ''
  };
}

/**
 * Convert Master Library song to AudioLabSong format
 * Master songs have slightly different field names
 */
function masterSongToAudioLabSong(doc: any): AudioLabSong {
  const data = doc.data();

  // Determine available parts from audioUrls (including custom parts)
  const audioUrls: AudioUrls = data.audioUrls || {};
  const customParts: string[] = data.customParts || [];
  const availableParts: VocalPart[] = [];

  // Check standard parts
  if (audioUrls.full) availableParts.push('full');
  if (audioUrls.soprano) availableParts.push('soprano');
  if (audioUrls.alto) availableParts.push('alto');
  if (audioUrls.tenor) availableParts.push('tenor');
  if (audioUrls.bass) availableParts.push('bass');

  // Add custom parts that have audio URLs
  customParts.forEach(part => {
    if (audioUrls[part]) {
      availableParts.push(part);
    }
  });

  // If no multi-part audio but has single audioFile, use it as 'full'
  if (availableParts.length === 0 && data.audioFile) {
    audioUrls.full = data.audioFile;
    availableParts.push('full');
  }

  return {
    id: doc.id,
    title: data.title || '',
    artist: data.writer || data.leadSinger || 'Unknown Artist', // Master songs use writer/leadSinger
    duration: data.duration || 0,
    audioUrls,
    availableParts,
    genre: data.category || '', // Master songs use category
    key: data.key || '',
    tempo: typeof data.tempo === 'string' ? parseInt(data.tempo) || 0 : data.tempo || 0,
    albumArt: data.albumArt || '',
    lyricsUrl: data.lyricsUrl || '',
    lyrics: parseLyrics(data.lyrics), // Parse lyrics string to LyricLine[]
    zoneId: '', // Master songs are available to all zones
    isHQSong: true,
    createdAt: data.publishedAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
    createdBy: data.publishedBy || ''
  };
}

/**
 * Parse lyrics from string or array format to LyricLine[]
 */
function parseLyrics(lyrics: any): LyricLine[] {
  if (!lyrics) return [];

  // If already in LyricLine[] format
  if (Array.isArray(lyrics) && lyrics.length > 0 && typeof lyrics[0] === 'object') {
    return lyrics;
  }

  // If string format, convert to simple lines (no timing)
  if (typeof lyrics === 'string') {
    const lines = lyrics.split('\n').filter(line => line.trim());
    return lines.map((text, index) => ({
      time: index * 5, // Default 5 seconds per line
      text: text.trim(),
      duration: 5
    }));
  }

  return [];
}

/**
 * Determine available parts from audioUrls (including custom parts)
 */
function determineAvailableParts(audioUrls: AudioUrls): VocalPart[] {
  const parts: VocalPart[] = [];
  const standardParts: VocalPart[] = ['full', 'soprano', 'alto', 'tenor', 'bass'];

  // Check all keys in audioUrls
  Object.keys(audioUrls).forEach(key => {
    if (audioUrls[key]) {
      parts.push(key as VocalPart);
    }
  });

  return parts;
}

/**
 * Clear song cache
 */
export function clearSongCache(): void {
  songCache.clear();
}

// CONVERSION UTILITIES

/**
 * Convert AudioLabSong to legacy Song format (for backward compatibility)
 */
export function toLegacySong(song: AudioLabSong) {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    duration: song.duration,
    genre: song.genre,
    key: song.key,
    tempo: song.tempo,
    albumArt: song.albumArt,
    audioUrl: song.audioUrls.full || Object.values(song.audioUrls)[0] || '',
    lyricsUrl: song.lyricsUrl,
    audioUrls: song.audioUrls,
    availableParts: song.availableParts,
    isHQSong: song.isHQSong,
    lyrics: song.lyrics
  };
}
