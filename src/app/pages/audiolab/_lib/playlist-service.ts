'use client';

import { db } from '@/lib/firebase-setup';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import type { Playlist } from '../_types';

const COLLECTION = 'audiolab_playlists';

/**
 * Get all playlists for a specific user
 */
export async function getUserPlaylists(userId: string): Promise<Playlist[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', userId)
      // orderBy removed temporarily to avoid index requirements
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
      updatedAt: (doc.data().updatedAt as Timestamp)?.toDate() || new Date()
    })) as Playlist[];
  } catch (error) {
    console.error('[AudioLabPlaylistService] Error fetching user playlists:', error);
    return [];
  }
}

/**
 * Get a single playlist by ID
 */
export async function getPlaylistById(playlistId: string): Promise<Playlist | null> {
  try {
    const docRef = doc(db, COLLECTION, playlistId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;

    return {
      id: snapshot.id,
      ...snapshot.data(),
      createdAt: (snapshot.data().createdAt as Timestamp)?.toDate() || new Date(),
      updatedAt: (snapshot.data().updatedAt as Timestamp)?.toDate() || new Date()
    } as Playlist;
  } catch (error) {
    console.error('[AudioLabPlaylistService] Error fetching playlist:', error);
    return null;
  }
}

/**
 * Create a new playlist
 */
export async function createPlaylist(data: {
  title: string;
  description?: string;
  userId: string;
  zoneId?: string;
  isPublic?: boolean;
}): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION), {
      title: data.title,
      description: data.description || '',
      userId: data.userId,
      zoneId: data.zoneId || null,
      songIds: [],
      isPublic: data.isPublic ?? false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('[AudioLabPlaylistService] Error creating playlist:', error);
    throw error;
  }
}

/**
 * Update a playlist's details
 */
export async function updatePlaylist(
  playlistId: string,
  data: Partial<Omit<Playlist, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION, playlistId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('[AudioLabPlaylistService] Error updating playlist:', error);
    throw error;
  }
}

/**
 * Delete a playlist
 */
export async function deletePlaylist(playlistId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION, playlistId));
  } catch (error) {
    console.error('[AudioLabPlaylistService] Error deleting playlist:', error);
    throw error;
  }
}

/**
 * Add a song to a playlist
 */
export async function addSongToPlaylist(playlistId: string, songId: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION, playlistId);
    await updateDoc(docRef, {
      songIds: arrayUnion(songId),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('[AudioLabPlaylistService] Error adding song to playlist:', error);
    throw error;
  }
}

/**
 * Remove a song from a playlist
 */
export async function removeSongFromPlaylist(playlistId: string, songId: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION, playlistId);
    await updateDoc(docRef, {
      songIds: arrayRemove(songId),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('[AudioLabPlaylistService] Error removing song from playlist:', error);
    throw error;
  }
}

/**
 * Check which playlists contain a specific song
 */
export async function getPlaylistsContainingSong(userId: string, songId: string): Promise<string[]> {
  try {
    const playlists = await getUserPlaylists(userId);
    return playlists
      .filter(p => p.songIds.includes(songId))
      .map(p => p.id);
  } catch (error) {
    console.error('[AudioLabPlaylistService] Error checking song in playlists:', error);
    return [];
  }
}
