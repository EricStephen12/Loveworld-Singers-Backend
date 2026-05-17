/**
 * Lyrics Service for AudioLab
 * Handles fetching, syncing, and storing lyrics for songs
 */

import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-setup';
import type { LyricLine } from '../_types';

interface SyncLyricsResponse {
  success: boolean;
  lyrics?: LyricLine[];
  rawText?: string;
  error?: string;
}

/**
 * Generate synced lyrics using Groq Whisper
 * This will transcribe the audio and return segment-level timestamps
 */
export async function generateSyncedLyrics(
  audioUrl: string,
  songId: string,
  existingLyrics?: string
): Promise<SyncLyricsResponse> {
  try {
    // Get current user's ID token for authentication
    const { auth } = await import('@/lib/firebase-setup');
    const token = await auth.currentUser?.getIdToken();

    const response = await fetch('/api/lyrics-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ audioUrl, songId, existingLyrics }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to sync lyrics' };
    }

    const data = await response.json();
    return {
      success: true,
      lyrics: data.lyrics,
      rawText: data.rawText,
    };
  } catch (error) {
 console.error('[LyricsService] Error generating synced lyrics:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Save synced lyrics to a song document
 */
export async function saveLyricsToSong(
  songId: string,
  lyrics: LyricLine[],
  rawText?: string,
  isHQSong?: boolean
): Promise<boolean> {
  try {
    // Determine which collection to update
    const collectionName = isHQSong ? 'master_songs' : 'audiolab_songs';
    const songRef = doc(db, collectionName, songId);

    await updateDoc(songRef, {
      syncedLyrics: lyrics,
      lyricsText: rawText || lyrics.map(l => l.text).join('\n'),
      lyricsUpdatedAt: new Date(),
      hasSyncedLyrics: true,
    });

    return true;
  } catch (error) {
 console.error('[LyricsService] Error saving lyrics:', error);
    // If saving to master failed (maybe permissions), try regional as fallback
    if (isHQSong) {
      try {
        const songRef = doc(db, 'audiolab_songs', songId);
        await updateDoc(songRef, {
          syncedLyrics: lyrics,
          lyricsText: rawText || lyrics.map(l => l.text).join('\n'),
          lyricsUpdatedAt: new Date(),
          hasSyncedLyrics: true,
        });
        return true;
      } catch (err) {
 console.error('[LyricsService] Fallback saving failed:', err);
      }
    }
    return false;
  }
}

/**
 * Get lyrics for a song
 * Returns synced lyrics if available, otherwise plain text
 * Checks both audiolab_songs and master_library collections
 */
export async function getSongLyrics(songId: string): Promise<{
  lyrics: LyricLine[] | null;
  lyricsText: string | null;
  karaokeLrcText: string | null;
  hasSyncedLyrics: boolean;
}> {
  try {
    // First try audiolab_songs collection
    const audiolabRef = doc(db, 'audiolab_songs', songId);
    const audiolabDoc = await getDoc(audiolabRef);

    if (audiolabDoc.exists()) {
      const data = audiolabDoc.data();
      return {
        lyrics: data.syncedLyrics || data.lyrics || null,
        lyricsText: data.lyricsText || (typeof data.lyrics === 'string' ? data.lyrics : null),
        karaokeLrcText: data.karaokeLrcText || null,
        hasSyncedLyrics: !!(data.syncedLyrics && data.syncedLyrics.length > 0),
      };
    }

    // Then try master_songs collection
    const masterRef = doc(db, 'master_songs', songId);
    const masterDoc = await getDoc(masterRef);

    if (masterDoc.exists()) {
      const data = masterDoc.data();

      // Master songs store lyrics as HTML string, need to parse
      let lyricsText = data.lyrics || data.lyricsText || null;
      let lyrics: LyricLine[] | null = null;

      if (Array.isArray(data.syncedLyrics) && data.syncedLyrics.length > 0) {
        lyrics = data.syncedLyrics;
      } else if (Array.isArray(data.lyrics) && data.lyrics.length > 0) {
        lyrics = data.lyrics;
      } else if (typeof lyricsText === 'string' && lyricsText.trim()) {
        // Convert HTML to plain text for auto-timing
        lyricsText = lyricsText
          .replace(/<div[^>]*>/gi, '')
          .replace(/<\/div>/gi, '\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<b>(.*?)<\/b>/gi, '$1')
          .replace(/<strong>(.*?)<\/strong>/gi, '$1')
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/gi, ' ')
          .trim();
      }

      return {
        lyrics,
        lyricsText,
        karaokeLrcText: data.karaokeLrcText || null,
        hasSyncedLyrics: !!(lyrics && lyrics.length > 0),
      };
    }

    return { lyrics: null, lyricsText: null, karaokeLrcText: null, hasSyncedLyrics: false };
  } catch (error) {
 console.error('[LyricsService] Error getting lyrics:', error);
    return { lyrics: null, lyricsText: null, karaokeLrcText: null, hasSyncedLyrics: false };
  }
}

/**
 * Save raw LRC text specifically for the dedicated Karaoke view
 * Bypasses the standard lyrics processing to prevent format corruption
 */
export async function saveKaraokeLrcText(songId: string, lrcText: string): Promise<boolean> {
  try {
    // Try master first since that's where most official songs live
    let songRef = doc(db, 'master_songs', songId);
    let docSnap = await getDoc(songRef);

    if (!docSnap.exists()) {
      // Fallback to audiolab_songs if not in master
      songRef = doc(db, 'audiolab_songs', songId);
      docSnap = await getDoc(songRef);
    }

    if (!docSnap.exists()) {
      throw new Error("Song not found in any library");
    }

    // Attempt to parse to see if it's valid, but save it regardless so users can fix it later
    let hasSyncedLyrics = false;
    let syncedLyrics: LyricLine[] | undefined;

    if (lrcText && lrcText.trim().length > 0) {
      const parsed = parseLRCLyrics(lrcText);
      if (parsed.length > 0) {
        hasSyncedLyrics = true;
        syncedLyrics = parsed;
      }
    }

    const payload: any = {
      karaokeLrcText: lrcText,
      lyricsUpdatedAt: new Date(),
    };

    if (hasSyncedLyrics && syncedLyrics) {
      payload.hasSyncedLyrics = true;
      payload.syncedLyrics = syncedLyrics;
    }

    await updateDoc(songRef, payload);
    return true;
  } catch (error) {
 console.error('[LyricsService] Error saving karaoke LRC text:', error);
    return false;
  }
}

/**
 * Parse plain text lyrics into auto-timed lines
 * Distributes lines evenly across the song duration
 */
export function parseAutoTimedLyrics(
  plainText: string,
  songDuration: number
): LyricLine[] {
  const lines = plainText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) return [];

  // Calculate time per line with some buffer at start/end
  const startBuffer = 2; // 2 seconds before lyrics start
  const endBuffer = 3;   // 3 seconds after lyrics end
  const availableDuration = songDuration - startBuffer - endBuffer;
  const timePerLine = availableDuration / lines.length;

  return lines.map((text, index) => ({
    time: startBuffer + (index * timePerLine),
    text,
    duration: timePerLine * 0.9, // 90% of time slot for the line
  }));
}

/**
 * Parse LRC format lyrics
 * Format: [mm:ss.xx]Lyric text
 */
export function parseLRCLyrics(lrcContent: string): LyricLine[] {
  const lines = lrcContent.split('\n');
  const lyrics: LyricLine[] = [];

  for (const line of lines) {
    // Match [mm:ss.xx] or [mm:ss] format
    const match = line.match(/\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
      const text = match[4].trim();

      if (text) {
        const time = minutes * 60 + seconds + ms / 1000;
        lyrics.push({ time, text });
      }
    }
  }

  // Calculate durations based on next line's start time
  for (let i = 0; i < lyrics.length; i++) {
    if (i < lyrics.length - 1) {
      lyrics[i].duration = lyrics[i + 1].time - lyrics[i].time;
    } else {
      lyrics[i].duration = 5; // Default 5 seconds for last line
    }
  }

  return lyrics.sort((a, b) => a.time - b.time);
}

/**
 * Export lyrics to LRC format
 */
export function exportToLRC(lyrics: LyricLine[]): string {
  return lyrics
    .map(line => {
      const minutes = Math.floor(line.time / 60);
      const seconds = Math.floor(line.time % 60);
      const centiseconds = Math.floor((line.time % 1) * 100);

      const timestamp = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}]`;
      return `${timestamp}${line.text}`;
    })
    .join('\n');
}
