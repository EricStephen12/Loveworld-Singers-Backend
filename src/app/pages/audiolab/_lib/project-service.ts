/**
 * AUDIOLAB PROJECT SERVICE
 * 
 * Firebase integration for multi-track recording projects
 * Handles: project CRUD, track management, audio file storage
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
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase-setup';
import { authedFetch } from '@/lib/authed-fetch'
import type {
  AudioLabProject,
  Track,
  CreateProjectInput,
  CreateTrackInput
} from '../_types';

// Collection name
const COLLECTION_NAME = 'audiolab_projects';

// Default track colors
const TRACK_COLORS = [
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#6366f1', // indigo
  '#84cc16', // lime
];

// PROJECT CRUD

/**
 * Create a new project
 */
export async function createProject(input: CreateProjectInput): Promise<{ success: boolean; id?: string; project?: AudioLabProject; error?: string }> {
  try {

    if (!input.name || !input.ownerId) {
      return { success: false, error: 'Name and owner ID are required' };
    }

    const projectData = {
      name: input.name,
      tempo: input.tempo || 120,
      timeSignature: input.timeSignature || '4/4',
      duration: 0,
      tracks: [],
      referenceSongId: input.referenceSongId || null,
      ownerId: input.ownerId,
      collaborators: [],
      zoneId: input.zoneId || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), projectData);


    // Return the created project
    const project: AudioLabProject = {
      id: docRef.id,
      name: input.name,
      tempo: projectData.tempo,
      timeSignature: projectData.timeSignature,
      duration: 0,
      tracks: [],
      referenceSongId: input.referenceSongId,
      ownerId: input.ownerId,
      collaborators: [],
      zoneId: input.zoneId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return { success: true, id: docRef.id, project };
  } catch (error) {
 console.error('[ProjectService] Error creating project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create project'
    };
  }
}

/**
 * Listen for project updates in real-time
 */
export function onProjectUpdate(projectId: string, callback: (project: AudioLabProject | null) => void) {
  const docRef = doc(db, COLLECTION_NAME, projectId);
  
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const project: AudioLabProject = {
        id: snapshot.id,
        name: data.name,
        tempo: data.tempo,
        timeSignature: data.timeSignature,
        duration: data.duration,
        tracks: data.tracks || [],
        referenceSongId: data.referenceSongId,
        ownerId: data.ownerId,
        collaborators: data.collaborators || [],
        zoneId: data.zoneId,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date()
      };
      callback(project);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('[ProjectService] Error listening for project updates:', error);
    callback(null);
  });
}

/**
 * Get a project by ID
 */
export async function getProject(id: string): Promise<AudioLabProject | null> {
  try {

    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return docToProject(docSnap);
  } catch (error) {
 console.error('[ProjectService] Error fetching project:', error);
    return null;
  }
}

/**
 * Get all projects for a user
 */
export async function getUserProjects(userId: string, limitCount: number = 50): Promise<AudioLabProject[]> {
  try {

    // Get projects where user is owner (simple query without orderBy to avoid index requirement)
    const ownerQuery = query(
      collection(db, COLLECTION_NAME),
      where('ownerId', '==', userId),
      limit(limitCount)
    );

    const ownerSnapshot = await getDocs(ownerQuery);
    const ownedProjects = ownerSnapshot.docs.map(doc => docToProject(doc));


    // Get projects where user is collaborator (simple query)
    let collabProjects: AudioLabProject[] = [];
    try {
      const collabQuery = query(
        collection(db, COLLECTION_NAME),
        where('collaborators', 'array-contains', userId),
        limit(limitCount)
      );

      const collabSnapshot = await getDocs(collabQuery);
      collabProjects = collabSnapshot.docs.map(doc => docToProject(doc));
    } catch (collabError) {
      // Collab query might fail if no index, that's okay
    }

    // Merge and dedupe
    const allProjects = [...ownedProjects];
    for (const project of collabProjects) {
      if (!allProjects.find(p => p.id === project.id)) {
        allProjects.push(project);
      }
    }

    // Sort by updatedAt client-side (to avoid index requirement)
    allProjects.sort((a, b) => {
      const dateA = a.updatedAt instanceof Date ? a.updatedAt : (a.updatedAt as any)?.toDate?.() || new Date(0);
      const dateB = b.updatedAt instanceof Date ? b.updatedAt : (b.updatedAt as any)?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    return allProjects;
  } catch (error) {
 console.error('[ProjectService] Error fetching user projects:', error);
    return [];
  }
}

/**
 * Recursively remove undefined values from an object
 */
function removeUndefinedValues(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedValues(item));
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedValues(value);
      }
    }
    return cleaned;
  }

  return obj;
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Omit<AudioLabProject, 'id' | 'createdAt' | 'ownerId'>>
): Promise<{ success: boolean; error?: string }> {
  try {

    const docRef = doc(db, COLLECTION_NAME, projectId);

    // Remove undefined values recursively (handles nested objects and arrays)
    const cleanUpdates = removeUndefinedValues(updates);

    // Ensure we have at least one field to update (besides updatedAt)
    if (!cleanUpdates || Object.keys(cleanUpdates).length === 0) {
      return { success: true };
    }

    await updateDoc(docRef, {
      ...cleanUpdates,
      updatedAt: serverTimestamp()
    });

    // Trigger FCM for collaborators
    try {
      const project = await getProject(projectId);
      if (project && project.collaborators.length > 0) {
        // Find all recipients (collaborators + owner, excluding the person making the change)
        const allParticipants = [project.ownerId, ...project.collaborators];
        // We'd ideally need the current user's ID here, but since this is a service, 
        // we might not have it unless passed. 
        // For now, we'll send to all collaborators if it's the owner, or owner + other collaborators.
        // The API /api/send-notification can handle 'excludeUserId' if we pass it, 
        // but here we don't have the context easily without changing the signature.
        // Let's assume most updates are worthwhile to notify about.

        await authedFetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'audiolab',
            recipientIds: allParticipants,
            title: ' Project Updated',
            body: `Project "${project.name}" has been updated.`,
            data: { projectId, type: 'project_update' }
          })
        });
      }
    } catch (fcmError) {
 console.error('[ProjectService] FCM error (update):', fcmError);
    }

    return { success: true };
  } catch (error) {
 console.error('[ProjectService] Error updating project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update project'
    };
  }
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string): Promise<{ success: boolean; error?: string }> {
  try {

    const docRef = doc(db, COLLECTION_NAME, projectId);
    await deleteDoc(docRef);


    return { success: true };
  } catch (error) {
 console.error('[ProjectService] Error deleting project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete project'
    };
  }
}

// TRACK MANAGEMENT

/**
 * Add a track to a project
 */
export async function addTrack(
  projectId: string,
  input: CreateTrackInput
): Promise<{ success: boolean; track?: Track; error?: string }> {
  try {

    const project = await getProject(projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    // Generate track ID and assign color
    const trackId = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const colorIndex = project.tracks.length % TRACK_COLORS.length;

    const track: Track = {
      id: trackId,
      name: input.name,
      type: input.type,
      color: input.color || TRACK_COLORS[colorIndex],
      volume: 80,
      pan: 0,
      muted: false,
      solo: false
    };

    // Add track to project
    const docRef = doc(db, COLLECTION_NAME, projectId);
    await updateDoc(docRef, {
      tracks: [...project.tracks, track],
      updatedAt: serverTimestamp()
    });

    // Trigger FCM for track addition
    try {
      const allParticipants = [project.ownerId, ...project.collaborators];
      if (allParticipants.length > 0) {
        await authedFetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'audiolab',
            recipientIds: allParticipants,
            title: ' New Track Added',
            body: `A new track "${track.name}" was added to "${project.name}"`,
            data: { projectId, trackId, type: 'track_added' }
          })
        });
      }
    } catch (fcmError) {
 console.error('[ProjectService] FCM error (track):', fcmError);
    }

    return { success: true, track };
  } catch (error) {
 console.error('[ProjectService] Error adding track:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add track'
    };
  }
}

/**
 * Update a track in a project
 */
export async function updateTrack(
  projectId: string,
  trackId: string,
  updates: Partial<Omit<Track, 'id'>>
): Promise<{ success: boolean; error?: string }> {
  try {

    const project = await getProject(projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const trackIndex = project.tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) {
      return { success: false, error: 'Track not found' };
    }

    const cleanTrackUpdates = removeUndefinedValues(updates);
    const updatedTracks = [...project.tracks];
    updatedTracks[trackIndex] = { ...updatedTracks[trackIndex], ...cleanTrackUpdates };

    // Clean the entire tracks array to remove any undefined values
    const cleanedTracks = removeUndefinedValues(updatedTracks);

    let duration = project.duration;
    if (updates.duration && updates.duration > duration) {
      duration = updates.duration;
    }

    const docRef = doc(db, COLLECTION_NAME, projectId);
    await updateDoc(docRef, {
      tracks: cleanedTracks,
      duration,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
 console.error('[ProjectService] Error updating track:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update track'
    };
  }
}

/**
 * Delete a track from a project
 */
export async function deleteTrack(
  projectId: string,
  trackId: string
): Promise<{ success: boolean; error?: string }> {
  try {

    const project = await getProject(projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const track = project.tracks.find(t => t.id === trackId);
    if (!track) {
      return { success: false, error: 'Track not found' };
    }


    // Remove track from project
    const updatedTracks = project.tracks.filter(t => t.id !== trackId);

    // Recalculate duration
    const duration = Math.max(0, ...updatedTracks.map(t => t.duration || 0));

    const docRef = doc(db, COLLECTION_NAME, projectId);
    await updateDoc(docRef, {
      tracks: updatedTracks,
      duration,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
 console.error('[ProjectService] Error deleting track:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete track'
    };
  }
}

/**
 * Update track audio URL (after upload to Cloudinary)
 */
export async function updateTrackAudio(
  projectId: string,
  trackId: string,
  audioUrl: string,
  duration: number,
  waveform?: number[]
): Promise<{ success: boolean; error?: string }> {
  return updateTrack(projectId, trackId, {
    audioUrl,
    duration,
    waveform,
    recordedAt: new Date()
  });
}

// COLLABORATOR MANAGEMENT

/**
 * Add a collaborator to a project
 */
export async function addCollaborator(
  projectId: string,
  userId: string,
  projectName?: string,
  inviterName?: string
): Promise<{ success: boolean; error?: string }> {
  try {

    const docRef = doc(db, COLLECTION_NAME, projectId);

    // Get project name if not provided
    let finalProjectName = projectName;
    if (!finalProjectName) {
      const projectDoc = await getDoc(docRef);
      if (projectDoc.exists()) {
        finalProjectName = projectDoc.data().name || 'Untitled Project';
      }
    }

    await updateDoc(docRef, {
      collaborators: arrayUnion(userId),
      updatedAt: serverTimestamp()
    });


    // Send push notification to the invited user (non-blocking)
    authedFetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'audiolab',
        recipientIds: [userId],
        title: 'Studio Collaboration Invite',
        body: inviterName
          ? `${inviterName} invited you to collaborate on "${finalProjectName}"`
          : `You've been invited to collaborate on "${finalProjectName}"`,
        data: { projectId, projectName: finalProjectName }
      })
    }).catch(err => console.error('[ProjectService] Failed to send notification (background):', err));

    return { success: true };
  } catch (error) {
 console.error('[ProjectService] Error adding collaborator:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add collaborator'
    };
  }
}

/**
 * Remove a collaborator from a project
 */
export async function removeCollaborator(
  projectId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {

    const docRef = doc(db, COLLECTION_NAME, projectId);
    await updateDoc(docRef, {
      collaborators: arrayRemove(userId),
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
 console.error('[ProjectService] Error removing collaborator:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove collaborator'
    };
  }
}

// HELPER FUNCTIONS

/**
 * Convert Firestore document to AudioLabProject
 */
function docToProject(doc: any): AudioLabProject {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name || '',
    tempo: data.tempo || 120,
    timeSignature: data.timeSignature || '4/4',
    duration: data.duration || 0,
    tracks: data.tracks || [],
    referenceSongId: data.referenceSongId || undefined,
    ownerId: data.ownerId || '',
    collaborators: data.collaborators || [],
    zoneId: data.zoneId || undefined,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date()
  };
}

/**
 * Generate waveform data from audio buffer
 */
export function generateWaveform(audioBuffer: AudioBuffer, samples: number = 100): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / samples);
  const waveform: number[] = [];

  for (let i = 0; i < samples; i++) {
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(channelData[i * blockSize + j]);
    }
    waveform.push(sum / blockSize);
  }

  // Normalize to 0-100
  const max = Math.max(...waveform);
  return waveform.map(v => Math.round((v / max) * 100));
}
