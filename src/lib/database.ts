// Database Service for Loveworld Praise App
// This service bridges your existing data structure with Supabase

import { createClient } from '@supabase/supabase-js';
import type {
  PraiseNight,
  PraiseNightSong,
  Comment,
  HistoryEntry,
  Category
} from '@/types/supabase';
import { offlineManager } from '@/utils/offlineManager';
import { getCacheBuster } from '@/utils/cacheBuster';
import { getCommentsBySongId, createComment } from './comment-service';
import { getHistoryBySongId, createHistoryEntry } from './history-service';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to get audio URL from media table
export async function getAudioFromMedia(mediaId: number): Promise<string | null> {
  try {
    const { data: mediaFile, error } = await supabase
      .from('media')
      .select('url')
      .eq('id', mediaId)
      .single();

    if (error) {
 console.error('Error fetching media file:', error);
      return null;
    }

    let url = mediaFile?.url || null;

    // Supabase Storage URLs work directly - no conversion needed!

    return url;
  } catch (error) {
 console.error('Error in getAudioFromMedia:', error);
    return null;
  }
}

// Database interfaces that match your existing structure
export interface DatabasePage {
  id: number;
  name: string;
  date: string;
  location: string;
  category: 'unassigned' | 'pre-rehearsal' | 'ongoing' | 'archive';
  bannerImage?: string;
  countdownDays: number;
  countdownHours: number;
  countdownMinutes: number;
  countdownSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseSong {
  id: number;
  title: string;
  status: 'heard' | 'unheard';
  category: string;
  praiseNightId: number;
  leadSinger: string;
  writer: string;
  conductor: string;
  key: string;
  tempo: string;
  leadKeyboardist: string;
  leadGuitarist: string;
  drummer: string;
  lyrics: string;
  solfas?: string;
  notation?: string;
  rehearsalCount?: number;
  audioFile?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseComment {
  id: string;
  songId: number;
  text: string;
  date: string;
  author: string;
  createdAt: string;
}

export interface DatabaseHistoryEntry {
  id: string;
  songId: number;
  type: 'lyrics' | 'solfas' | 'audio' | 'comment' | 'metadata';
  content: string;
  date: string;
  version: number;
  createdAt: string;
}

// Pages Operations

export async function getAllPages(): Promise<PraiseNight[]> {
  try {
    const isOnline = navigator.onLine;

    if (!isOnline) {
      const cachedData = await offlineManager.getCachedData('pages');
      if (cachedData) {
        return cachedData;
      }
    }

    const startTime = performance.now();

    // OPTIMIZATION: Single query with joins for maximum speed
    const { data: pagesWithSongs, error } = await supabase
      .from('pages')
      .select(`
        *,
        songs (
          id,
          title,
          status,
          category,
          praisenightid,
          leadsinger,
          writer,
          conductor,
          key,
          tempo,
          leadkeyboardist,
          leadguitarist,
          drummer,
          lyrics,
          solfas,
          notation,
          rehearsalcount,
          audiofile,
          mediaid,
          createdat,
          updatedat
        )
      `)
      .order('id', { ascending: true });

    if (error) throw error;

    const loadTime = performance.now() - startTime;

    // Convert database pages to your PraiseNight format
    const praiseNights: PraiseNight[] = [];

    for (const page of pagesWithSongs || []) {
      // Process songs in parallel for this page
      const songs = await Promise.all(
        (page.songs || []).map(async (song: any) => {
          // Get audio file from media table if mediaId exists
          let audioFile = song.audiofile;
          if (song.mediaid) {
            const mediaAudioUrl = await getAudioFromMedia(song.mediaid);
            if (mediaAudioUrl) {
              audioFile = mediaAudioUrl;
            }
          }

          return {
            id: song.id,
            title: song.title,
            status: song.status,
            category: song.category,
            leadSinger: song.leadsinger,
            writer: song.writer,
            conductor: song.conductor,
            key: song.key,
            tempo: song.tempo,
            leadKeyboardist: song.leadkeyboardist,
            leadGuitarist: song.leadguitarist,
            drummer: song.drummer,
            lyrics: song.lyrics,
            solfas: song.solfas,
            notation: song.notation,
            rehearsalCount: song.rehearsalcount ?? 0,
            audioFile: audioFile,
            mediaId: song.mediaid,
            praiseNightId: song.praisenightid,
            comments: [], // Load comments on demand for better performance
            history: []   // Load history on demand for better performance
          };
        })
      );

      praiseNights.push({
        id: page.id,
        name: page.name,
        date: page.date,
        location: page.location,
        category: page.category,
        bannerImage: page.bannerimage,
        countdown: {
          days: page.countdowndays,
          hours: page.countdownhours,
          minutes: page.countdownminutes,
          seconds: page.countdownseconds
        },
        songs: songs
      });
    }

    // Cache the data for offline use
    if (isOnline) {
      await offlineManager.cacheData('pages', praiseNights);
    }

    const totalTime = performance.now() - startTime;

    return praiseNights;
  } catch (error) {
 console.error('Error fetching pages:', error);

    // Try to get cached data as fallback
    const cachedData = await offlineManager.getCachedData('pages');
    if (cachedData) {
      return cachedData;
    }

    return [];
  }
}

export async function getPageById(id: number): Promise<PraiseNight | null> {
  try {
    const { data: page, error } = await supabase
      .from('pages')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!page) return null;

    // Get songs for this page
    const songs = await getSongsByPageId(page.id);

    return {
      id: page.id,
      name: page.name,
      date: page.date,
      location: page.location,
      category: page.category,
      bannerImage: page.bannerimage,
      countdown: {
        days: page.countdowndays,
        hours: page.countdownhours,
        minutes: page.countdownminutes,
        seconds: page.countdownseconds
      },
      songs: songs
    };
  } catch (error) {
 console.error('Error fetching page:', error);
    return null;
  }
}

export async function createPage(pageData: Omit<PraiseNight, 'songs'>): Promise<PraiseNight | null> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cached_pages_data');
      localStorage.removeItem('cached_pages_timestamp');
    }

    const { data, error } = await supabase
      .from('pages')
      .insert({
        name: pageData.name,
        date: pageData.date,
        location: pageData.location,
        category: pageData.category,
        bannerimage: pageData.bannerImage,
        countdowndays: pageData.countdown.days,
        countdownhours: pageData.countdown.hours,
        countdownminutes: pageData.countdown.minutes,
        countdownseconds: pageData.countdown.seconds
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      date: data.date,
      location: data.location,
      category: data.category,
      bannerImage: data.bannerimage,
      countdown: {
        days: data.countdowndays,
        hours: data.countdownhours,
        minutes: data.countdownminutes,
        seconds: data.countdownseconds
      },
      songs: []
    };
  } catch (error) {
 console.error('Error creating page:', error);
    return null;
  }
}

export async function updatePage(id: number, pageData: Partial<Omit<PraiseNight, 'songs'>>): Promise<boolean> {
  try {

    if (typeof window !== 'undefined') {
      localStorage.removeItem('cached_pages_data');
      localStorage.removeItem('cached_pages_timestamp');
    }

    const updateData: any = {};

    if (pageData.name) updateData.name = pageData.name;
    if (pageData.date) updateData.date = pageData.date;
    if (pageData.location) updateData.location = pageData.location;
    if (pageData.category) updateData.category = pageData.category;
    if (pageData.bannerImage !== undefined) updateData.bannerimage = pageData.bannerImage;
    if (pageData.countdown) {
      updateData.countdowndays = pageData.countdown.days;
      updateData.countdownhours = pageData.countdown.hours;
      updateData.countdownminutes = pageData.countdown.minutes;
      updateData.countdownseconds = pageData.countdown.seconds;
    }


    const { error } = await supabase
      .from('pages')
      .update(updateData)
      .eq('id', id);


    if (error) {
      if (error.code === '42703' && error.message.includes('updated_at')) {

        // Remove any fields that might not exist in the database
        const cleanUpdateData = { ...updateData };
        delete cleanUpdateData.updated_at;
        delete cleanUpdateData.created_at;
        delete cleanUpdateData.id;

        const { error: retryError } = await supabase
          .from('pages')
          .update(cleanUpdateData)
          .eq('id', id);

        if (retryError) throw retryError;
        return true;
      }
      throw error;
    }
    return true;
  } catch (error) {
 console.error('Error updating page:', error);
    return false;
  }
}

export async function deletePage(id: number): Promise<boolean> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cached_pages_data');
      localStorage.removeItem('cached_pages_timestamp');
    }

    const { error } = await supabase
      .from('pages')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
 console.error('Error deleting page:', error);
    return false;
  }
}

// Songs Operations

export async function getSongsByPageId(pageId: string | number): Promise<PraiseNightSong[]> {
  try {
    const { data: songs, error } = await supabase
      .from('songs')
      .select('*')
      .eq('praisenightid', pageId)
      .order('id', { ascending: true });

    if (error) throw error;

    const praiseNightSongs: PraiseNightSong[] = [];

    for (const song of songs || []) {
      // Get comments and history for this song
      const [comments, history] = await Promise.all([
        getCommentsBySongId(song.id),
        getHistoryBySongId(song.id)
      ]);

      // Get audio file from media table if mediaId exists, otherwise use direct audiofile
      let audioFile = song.audiofile;
      if (song.mediaid) {
        const mediaAudioUrl = await getAudioFromMedia(song.mediaid);
        if (mediaAudioUrl) {
          audioFile = mediaAudioUrl;
        }
      }

      // Supabase Storage URLs work directly - no CORS issues!

      praiseNightSongs.push({
        id: song.id,
        title: song.title,
        status: song.status,
        category: song.category,
        praiseNightId: song.praisenightid,
        leadSinger: song.leadsinger,
        writer: song.writer,
        conductor: song.conductor,
        key: song.key,
        tempo: song.tempo,
        leadKeyboardist: song.leadkeyboardist,
        leadGuitarist: song.leadguitarist,
        drummer: song.drummer,
        lyrics: song.lyrics,
        solfas: song.solfas,
        notation: song.notation,
        rehearsalCount: song.rehearsalcount,
        audioFile: audioFile,
        comments: comments,
        history: history
      });
    }

    return praiseNightSongs;
  } catch (error) {
 console.error('Error fetching songs:', error);
    return [];
  }
}

export async function createSong(songData: Omit<PraiseNightSong, 'comments' | 'history'>): Promise<PraiseNightSong | null> {
  try {

    if (typeof window !== 'undefined') {
      localStorage.removeItem('cached_pages_data');
      localStorage.removeItem('cached_pages_timestamp');
    }

    const { data, error } = await supabase
      .from('songs')
      .insert({
        title: songData.title,
        status: songData.status,
        category: songData.category,
        praisenightid: songData.praiseNightId,
        leadsinger: songData.leadSinger,
        writer: songData.writer,
        conductor: songData.conductor,
        key: songData.key,
        tempo: songData.tempo,
        leadkeyboardist: songData.leadKeyboardist,
        leadguitarist: songData.leadGuitarist,
        drummer: songData.drummer,
        lyrics: songData.lyrics,
        solfas: songData.solfas,
        notation: songData.notation,
        rehearsalcount: songData.rehearsalCount,
        audiofile: songData.audioFile,
        mediaid: songData.mediaId
      })
      .select()
      .single();

    if (error) {
 console.error(' Database error creating song:', error);
      throw error;
    }

    return {
      title: data.title,
      status: data.status,
      category: data.category,
      praiseNightId: data.praisenightid,
      leadSinger: data.leadsinger,
      writer: data.writer,
      conductor: data.conductor,
      key: data.key,
      tempo: data.tempo,
      leadKeyboardist: data.leadkeyboardist,
      leadGuitarist: data.leadguitarist,
      drummer: data.drummer,
      lyrics: data.lyrics,
      solfas: data.solfas,
      notation: data.notation,
      rehearsalCount: data.rehearsalcount,
      audioFile: data.audiofile,
      comments: [],
      history: []
    };
  } catch (error) {
 console.error('Error creating song:', error);
    return null;
  }
}

export async function updateSong(songId: number, songData: Partial<PraiseNightSong>): Promise<boolean> {
  try {

    if (typeof window !== 'undefined') {
      localStorage.removeItem('cached_pages_data');
      localStorage.removeItem('cached_pages_timestamp');
    }

    const updateData: any = {};

    if (songData.title !== undefined) updateData.title = songData.title;
    if (songData.status !== undefined) updateData.status = songData.status;
    if (songData.category !== undefined) {
      updateData.category = songData.category;
    }
    // Always update these fields if they're in songData (even if empty string)
    if (songData.leadSinger !== undefined) updateData.leadsinger = songData.leadSinger;
    if (songData.writer !== undefined) updateData.writer = songData.writer;
    if (songData.conductor !== undefined) updateData.conductor = songData.conductor;
    if (songData.key !== undefined) updateData.key = songData.key;
    if (songData.tempo !== undefined) updateData.tempo = songData.tempo;
    if (songData.leadKeyboardist !== undefined) updateData.leadkeyboardist = songData.leadKeyboardist;
    if (songData.leadGuitarist !== undefined) updateData.leadguitarist = songData.leadGuitarist;
    if (songData.drummer !== undefined) updateData.drummer = songData.drummer;
    if (songData.lyrics !== undefined) updateData.lyrics = songData.lyrics;
    if (songData.solfas !== undefined) updateData.solfas = songData.solfas;
    if (songData.notation !== undefined) updateData.notation = songData.notation;
    if (songData.rehearsalCount !== undefined) updateData.rehearsalcount = songData.rehearsalCount;
    if (songData.comments !== undefined) updateData.comments = songData.comments;
    // Handle audio file updates - always update both fields together
    if (songData.audioFile !== undefined) updateData.audiofile = songData.audioFile || null;
    if (songData.mediaId !== undefined) updateData.mediaid = songData.mediaId || null;

    // Remove any fields that might not exist in the database
    delete updateData.history; // Don't try to update history field directly
    delete updateData.id; // Don't try to update the ID
    delete updateData.praiseNightId; // This is praisenightid in the database
    delete updateData.updatedAt; // Don't try to update updatedAt field
    delete updateData.updated_at; // Don't try to update updated_at field
    delete updateData.createdAt; // Don't try to update createdAt field
    delete updateData.created_at; // Don't try to update created_at field


    const { error } = await supabase
      .from('songs')
      .update(updateData)
      .eq('id', songId);

    if (error) {
 console.error(' Database error updating song:', error);
 console.error(' Full error details:', JSON.stringify(error, null, 2));
 console.error(' Update data that failed:', JSON.stringify(updateData, null, 2));

      // If it's the comments field error, try again without comments
      if (error.code === 'PGRST204' && error.message.includes('comments')) {
        delete updateData.comments;

        const { error: retryError } = await supabase
          .from('songs')
          .update(updateData)
          .eq('id', songId);

        if (retryError) {
 console.error(' Retry also failed:', retryError);
          throw retryError;
        }

        return true;
      }

      // If it's the updated_at field error, try again with a minimal update
      if (error.code === '42703' && error.message.includes('updated_at')) {

        // Create a minimal update object with only essential fields
        const minimalUpdateData: any = {};
        if (updateData.title) minimalUpdateData.title = updateData.title;
        if (updateData.status) minimalUpdateData.status = updateData.status;
        if (updateData.category) minimalUpdateData.category = updateData.category;
        if (updateData.leadsinger !== undefined) minimalUpdateData.leadsinger = updateData.leadsinger;
        if (updateData.writer !== undefined) minimalUpdateData.writer = updateData.writer;
        if (updateData.conductor !== undefined) minimalUpdateData.conductor = updateData.conductor;
        if (updateData.key !== undefined) minimalUpdateData.key = updateData.key;
        if (updateData.tempo !== undefined) minimalUpdateData.tempo = updateData.tempo;
        if (updateData.leadkeyboardist !== undefined) minimalUpdateData.leadkeyboardist = updateData.leadkeyboardist;
        if (updateData.leadguitarist !== undefined) minimalUpdateData.leadguitarist = updateData.leadguitarist;
        if (updateData.drummer !== undefined) minimalUpdateData.drummer = updateData.drummer;
        if (updateData.lyrics) minimalUpdateData.lyrics = updateData.lyrics;
        if (updateData.solfas) minimalUpdateData.solfas = updateData.solfas;
        if (updateData.notation) minimalUpdateData.notation = updateData.notation;
        if (updateData.rehearsalcount !== undefined) minimalUpdateData.rehearsalcount = updateData.rehearsalcount;
        if (updateData.comments) minimalUpdateData.comments = updateData.comments;
        if (updateData.audiofile !== undefined) minimalUpdateData.audiofile = updateData.audiofile;
        if (updateData.mediaid !== undefined) minimalUpdateData.mediaid = updateData.mediaid;


        const { error: retryError } = await supabase
          .from('songs')
          .update(minimalUpdateData)
          .eq('id', songId);

        if (retryError) {
 console.error(' Retry also failed:', retryError);
          throw retryError;
        } else {
        }
      } else {
        throw error;
      }
    }


    // Save history entries if provided
    if (songData.history && songData.history.length > 0) {

      // Get existing history to avoid duplicates
      const existingHistory = await getHistoryBySongId(songId);
      const existingIds = new Set(existingHistory.map(h => h.id));

      // Only save new history entries
      const newHistoryEntries = songData.history.filter(h => !existingIds.has(h.id));

      for (const historyEntry of newHistoryEntries) {
        const savedEntry = await createHistoryEntry({
          ...historyEntry,
          song_id: songId
        });

        if (savedEntry) {
        } else {
 console.error(' Failed to save history entry:', historyEntry.type);
        }
      }

    }

    return true;
  } catch (error) {
 console.error('Error updating song:', error);
    return false;
  }
}

export async function deleteSong(songId: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('songs')
      .delete()
      .eq('id', songId);

    if (error) throw error;
    return true;
  } catch (error) {
 console.error('Error deleting song:', error);
    return false;
  }
}

// Comments Operations

export { getCommentsBySongId, createComment } from './comment-service';

// History Operations

export { getHistoryBySongId, createHistoryEntry } from './history-service';


// File Upload Operations

// File Upload Operations

export { uploadFile, deleteFile } from './file-service';

// Category Management Functions

export async function getAllCategories(): Promise<Category[]> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('isactive', true)
      .order('name');

    if (error) throw error;

    return data.map(cat => ({
      id: cat.id.toString(),
      name: cat.name,
      description: cat.description || '',
      icon: cat.icon || 'Music',
      color: cat.color || '#3B82F6',
      isActive: cat.isactive,
      createdAt: cat.createdat,
      updatedAt: cat.updatedat
    }));
  } catch (error) {
 console.error('Error fetching categories:', error);
    return [];
  }
}

export async function createCategory(categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('categories')
      .insert({
        name: categoryData.name,
        description: categoryData.description,
        color: categoryData.color,
        icon: categoryData.icon,
        isactive: categoryData.isActive
      });

    if (error) throw error;
    return true;
  } catch (error) {
 console.error('Error creating category:', error);
    return false;
  }
}

export async function updateCategory(categoryId: number, categoryData: Partial<Category>): Promise<boolean> {
  try {
    const updateData: any = {};

    if (categoryData.name) updateData.name = categoryData.name;
    if (categoryData.description !== undefined) updateData.description = categoryData.description;
    if (categoryData.color) updateData.color = categoryData.color;
    if (categoryData.icon) updateData.icon = categoryData.icon;
    if (categoryData.isActive !== undefined) updateData.isactive = categoryData.isActive;

    const { error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', categoryId);

    if (error) throw error;
    return true;
  } catch (error) {
 console.error('Error updating category:', error);
    return false;
  }
}

export async function deleteCategory(categoryId: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;
    return true;
  } catch (error) {
 console.error('Error deleting category:', error);
    return false;
  }
}

// Category Operations

export async function updateSongsCategory(oldCategoryName: string, newCategoryName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('songs')
      .update({ category: newCategoryName })
      .eq('category', oldCategoryName);

    if (error) throw error;

    return true;
  } catch (error) {
 console.error('Error updating songs category:', error);
    return false;
  }
}

export async function getSongsByCategory(categoryName: string): Promise<PraiseNightSong[]> {
  try {
    const { data: songs, error } = await supabase
      .from('songs')
      .select('*')
      .eq('category', categoryName)
      .order('id', { ascending: true });

    if (error) throw error;

    const praiseNightSongs: PraiseNightSong[] = [];

    for (const song of songs || []) {
      // Get comments and history for this song
      const [comments, history] = await Promise.all([
        getCommentsBySongId(song.id),
        getHistoryBySongId(song.id)
      ]);

      praiseNightSongs.push({
        id: song.id,
        title: song.title,
        status: song.status,
        category: song.category,
        praiseNightId: song.praisenightid,
        leadSinger: song.leadsinger,
        writer: song.writer,
        conductor: song.conductor,
        key: song.key,
        tempo: song.tempo,
        leadKeyboardist: song.leadkeyboardist,
        leadGuitarist: song.leadguitarist,
        drummer: song.drummer,
        lyrics: song.lyrics,
        solfas: song.solfas,
        notation: song.notation,
        rehearsalCount: song.rehearsalcount,
        audioFile: song.audiofile,
        comments: comments,
        history: history
      });
    }

    return praiseNightSongs;
  } catch (error) {
 console.error('Error fetching songs by category:', error);
    return [];
  }
}



export async function handleCategoryDeletion(categoryName: string, fallbackCategory: string = 'Uncategorized'): Promise<boolean> {
  try {
    // First, check if there are songs with this category
    const { data: songs, error: checkError } = await supabase
      .from('songs')
      .select('id, title')
      .eq('category', categoryName);

    if (checkError) throw checkError;

    if (songs && songs.length > 0) {
      const { error: updateError } = await supabase
        .from('songs')
        .update({ category: fallbackCategory })
        .eq('category', categoryName);

      if (updateError) throw updateError;

    }

    return true;
  } catch (error) {
 console.error('Error handling category deletion:', error);
    return false;
  }
}

// Media Operations

export interface MediaFile {
  id: number;
  name: string;
  url: string;
  type: 'image' | 'audio' | 'video' | 'document';
  size: number;
  folder?: string;
  storagePath?: string; // Path in Supabase Storage for deletion
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

// Cache for media files
let mediaCache: { data: MediaFile[]; timestamp: number } | null = null;
const MEDIA_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes (longer cache for better performance)

export async function getAllMedia(): Promise<MediaFile[]> {
  try {
    // Check memory cache first
    if (mediaCache && (Date.now() - mediaCache.timestamp) < MEDIA_CACHE_DURATION) {
      return mediaCache.data;
    }

    // Check localStorage cache for instant loading
    if (typeof window !== 'undefined') {
      const cachedData = localStorage.getItem('media_cache');
      const cacheTimestamp = localStorage.getItem('media_cache_timestamp');

      if (cachedData && cacheTimestamp) {
        const age = Date.now() - parseInt(cacheTimestamp);
        if (age < MEDIA_CACHE_DURATION) {
          const parsedData = JSON.parse(cachedData);
          mediaCache = { data: parsedData, timestamp: parseInt(cacheTimestamp) };
          return parsedData;
        }
      }
    }

    const startTime = performance.now();

    // Optimized query - only select needed fields, with pagination for better performance
    const { data, error } = await supabase
      .from('media')
      .select('id, name, url, type, size, folder, storagepath, uploadedat, createdat, updatedat', { count: 'exact' })
      .order('uploadedat', { ascending: false })
      .limit(500); // Reduced limit for faster initial load

    if (error) {
 console.error(' Database error:', error);
      throw error;
    }

    const loadTime = performance.now() - startTime;

    const mediaFiles = (data || []).map(media => ({
      id: media.id,
      name: media.name,
      url: media.url,
      type: media.type,
      size: media.size,
      folder: media.folder,
      storagePath: media.storagepath,
      uploadedAt: media.uploadedat,
      createdAt: media.createdat,
      updatedAt: media.updatedat
    }));

    // Cache the result in memory
    mediaCache = {
      data: mediaFiles,
      timestamp: Date.now()
    };

    // Also cache in localStorage for persistence
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('media_cache', JSON.stringify(mediaFiles));
        localStorage.setItem('media_cache_timestamp', Date.now().toString());
      } catch (error) {
 console.warn('Failed to cache media data to localStorage:', error);
      }
    }

    return mediaFiles;
  } catch (error) {
 console.error('Error fetching media files:', error);

    // Return cached data if available, even if expired
    if (mediaCache) {
      return mediaCache.data;
    }

    return [];
  }
}

// Function to clear media cache
export function clearMediaCache(): void {
  mediaCache = null;
}

// User Management Operations

export async function getAllUsers(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
 console.error('Error fetching users:', error);
    return [];
  }
}

export async function getUserStats(): Promise<{ total: number, recent: number, active: number }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('created_at, updated_at');

    if (error) throw error;

    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const total = data?.length || 0;
    const recent = data?.filter(user => new Date(user.created_at) > lastWeek).length || 0;
    const active = data?.filter(user =>
      user.updated_at && new Date(user.updated_at) > lastMonth
    ).length || 0;

    return { total, recent, active };
  } catch (error) {
 console.error('Error fetching user stats:', error);
    return { total: 0, recent: 0, active: 0 };
  }
}

// Function to preload media data in background
export async function preloadMediaData(): Promise<void> {
  try {
    await getAllMedia(); // This will cache the data
  } catch (error) {
 console.error(' Error preloading media data:', error);
  }
}

export async function createMediaFile(mediaData: Omit<MediaFile, 'id' | 'createdAt' | 'updatedAt'>): Promise<MediaFile | null> {
  try {
    const { data, error } = await supabase
      .from('media')
      .insert({
        name: mediaData.name,
        url: mediaData.url,
        type: mediaData.type,
        size: mediaData.size,
        folder: mediaData.folder,
        storagepath: mediaData.storagePath, // Use Supabase Storage path
        uploadedat: mediaData.uploadedAt
      })
      .select()
      .single();

    if (error) throw error;

    clearMediaCache();

    return {
      id: data.id,
      name: data.name,
      url: data.url,
      type: data.type,
      size: data.size,
      folder: data.folder,
      storagePath: data.storagepath, // Return Supabase Storage path
      uploadedAt: data.uploadedat,
      createdAt: data.createdat,
      updatedAt: data.updatedat
    };
  } catch (error) {
 console.error('Error creating media file:', error);
    return null;
  }
}

export async function deleteMediaFile(mediaId: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('media')
      .delete()
      .eq('id', mediaId);

    if (error) throw error;

    clearMediaCache();

    return true;
  } catch (error) {
 console.error('Error deleting media file:', error);
    return false;
  }
}

// Create history entry with the new format


// Delete history entry
export async function deleteHistoryEntry(historyId: string): Promise<boolean> {
  try {

    const { error } = await supabase
      .from('song_history')
      .delete()
      .eq('id', historyId);

    if (error) {
 console.error(' Supabase error:', error);
      throw error;
    }

    return true;
  } catch (error) {
 console.error('Error deleting history entry:', error);
    return false;
  }
}
