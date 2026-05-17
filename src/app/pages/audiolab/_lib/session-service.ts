/**
 * AUDIOLAB SESSION SERVICE (V2)
 * 
 * Separates persistent Rooms from ephemeral Live Sessions.
 * Structure:
 * audiolab_rooms/{roomId} -> Metadata & Permanent Codes
 * audiolab_sessions/{sessionId} -> Transient Live State & Signaling
 * audiolab_presence/{roomId}/{userId} -> Low-latency presence
 */

import {
  ref,
  set,
  get,
  update,
  remove,
  push,
  onValue,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  off,
  query,
  orderByChild,
  equalTo,
  onDisconnect,
  serverTimestamp
} from 'firebase/database';
import { realtimeDb, isRealtimeDbAvailable } from '@/lib/firebase-setup';
import type {
  AudioLabRoom,
  LiveSession,
  Participant,
  PlaybackState,
  ChatMessage
} from '../_types';

// UTILS

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ROOM MANAGEMENT (PERMANENT)

export async function createRoom(
  hostId: string,
  hostName: string,
  title: string,
  hostAvatar?: string | null
): Promise<{ success: boolean; room?: AudioLabRoom; error?: string }> {
  try {
    if (!isRealtimeDbAvailable() || !realtimeDb) return { success: false, error: 'DB Unavailable' };

    const roomRef = push(ref(realtimeDb, 'audiolab_rooms'));
    const id = roomRef.key!;
    const code = generateInviteCode();

    const room: AudioLabRoom = {
      id,
      code,
      title,
      hostId,
      hostName,
      hostAvatar: hostAvatar ?? null,
      settings: {
        isPrivate: false,
        allowGuestMic: true,
        allowGuestVideo: false
      },
      createdAt: Date.now()
    };

    await set(roomRef, room);
    return { success: true, room };
  } catch (e: any) {
    console.error('[SessionService] createRoom error:', e);
    return { success: false, error: e?.message || 'Failed to create room' };
  }
}

export async function getRoom(roomId: string): Promise<AudioLabRoom | null> {
  if (!realtimeDb) return null;
  const snap = await get(ref(realtimeDb, `audiolab_rooms/${roomId}`));
  return snap.exists() ? { ...snap.val(), id: roomId } : null;
}

export async function getRoomByCode(code: string): Promise<AudioLabRoom | null> {
  if (!realtimeDb) return null;
  const roomsRef = ref(realtimeDb, 'audiolab_rooms');
  const codeQuery = query(roomsRef, orderByChild('code'), equalTo(code.toUpperCase()));
  const snap = await get(codeQuery);
  
  if (snap.exists()) {
    const val = snap.val();
    const id = Object.keys(val)[0];
    return { ...val[id], id };
  }
  return null;
}

export async function getUserRooms(userId: string): Promise<AudioLabRoom[]> {
  if (!realtimeDb) return [];
  const roomsRef = ref(realtimeDb, 'audiolab_rooms');
  const hostQuery = query(roomsRef, orderByChild('hostId'), equalTo(userId));
  const snap = await get(hostQuery);
  
  const rooms: AudioLabRoom[] = [];
  if (snap.exists()) {
    snap.forEach((child) => {
      rooms.push({ ...child.val(), id: child.key });
    });
  }
  return rooms.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteRoom(roomId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!realtimeDb) return { success: false, error: 'DB Unavailable' };
    const room = await getRoom(roomId);
    if (!room) return { success: false, error: 'Room not found' };
    if (room.hostId !== userId) return { success: false, error: 'Unauthorized' };

    await remove(ref(realtimeDb, `audiolab_rooms/${roomId}`));
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Failed to delete' };
  }
}

// SESSION MANAGEMENT (EPHEMERAL)

export async function activateSession(
  roomId: string,
  hostId: string,
  title: string
): Promise<{ success: boolean; session?: LiveSession; error?: string }> {
  try {
    if (!realtimeDb) return { success: false, error: 'DB Unavailable' };

    const sessionRef = push(ref(realtimeDb, 'audiolab_sessions'));
    const sessionId = sessionRef.key!;

    const session: LiveSession = {
      id: sessionId,
      roomId,
      hostId,
      title,
      participants: {}, // Will be populated on join
      playback: {
        isPlaying: false,
        currentTime: 0,
        updatedAt: Date.now(),
        updatedBy: hostId
      },
      status: 'active',
      startedAt: Date.now()
    };

    await set(sessionRef, session);
    // Link room to active session
    await update(ref(realtimeDb, `audiolab_rooms/${roomId}`), { activeSessionId: sessionId });

    return { success: true, session };
  } catch (e) {
    return { success: false, error: 'Failed to activate' };
  }
}

export async function joinSession(
  sessionId: string,
  user: { id: string; name: string; avatar?: string | null; role: 'host' | 'participant' }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!realtimeDb) return { success: false, error: 'DB Unavailable' };

    const participantRef = ref(realtimeDb, `audiolab_sessions/${sessionId}/participants/${user.id}`);
    const participant: Participant = {
      ...user,
      isOnline: true,
      isMuted: false,
      isCameraOn: false,
      joinedAt: Date.now(),
      networkQuality: 'good'
    };

    await set(participantRef, participant);
    onDisconnect(participantRef).remove();

    return { success: true };
  } catch (e) {
    return { success: false, error: 'Failed to join' };
  }
}

export async function endSession(sessionId: string, roomId: string): Promise<void> {
  if (!realtimeDb) return;
  await update(ref(realtimeDb, `audiolab_sessions/${sessionId}`), { 
    status: 'ended',
    endedAt: Date.now()
  });
  await update(ref(realtimeDb, `audiolab_rooms/${roomId}`), { activeSessionId: null });
}

// MESSAGING & SIGNALS (REDIRECT TO SESSION)

export function subscribeToSession(sessionId: string, callbacks: any) {
  if (!realtimeDb) return () => {};
  const sessionRef = ref(realtimeDb, `audiolab_sessions/${sessionId}`);
  const unsub = onValue(sessionRef, (snap) => {
    if (snap.exists()) callbacks.onUpdate?.(snap.val());
  });
  return unsub;
}

export async function sendMessage(sessionId: string, message: any) {
  if (!realtimeDb) return;
  const msgRef = push(ref(realtimeDb, `audiolab_sessions/${sessionId}/messages`));
  await set(msgRef, { ...message, timestamp: Date.now() });
}

export async function leaveSession(sessionId: string, userId: string): Promise<void> {
  if (!realtimeDb) return;
  await remove(ref(realtimeDb, `audiolab_sessions/${sessionId}/participants/${userId}`));
}

export async function toggleMute(sessionId: string, userId: string, isMuted: boolean): Promise<void> {
  if (!realtimeDb) return;
  await update(ref(realtimeDb, `audiolab_sessions/${sessionId}/participants/${userId}`), { isMuted });
}

export async function toggleCamera(sessionId: string, userId: string, isCameraOn: boolean): Promise<void> {
  if (!realtimeDb) return;
  await update(ref(realtimeDb, `audiolab_sessions/${sessionId}/participants/${userId}`), { isCameraOn });
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  if (!realtimeDb) return [];
  const snap = await get(ref(realtimeDb, `audiolab_sessions/${sessionId}/messages`));
  if (!snap.exists()) return [];
  const msgs: ChatMessage[] = [];
  snap.forEach((child) => {
    msgs.push({ ...child.val(), id: child.key });
  });
  return msgs.sort((a, b) => a.timestamp - b.timestamp);
}

export function subscribeToMessages(sessionId: string, callback: (msg: ChatMessage) => void) {
  if (!realtimeDb) return () => {};
  const msgRef = ref(realtimeDb, `audiolab_sessions/${sessionId}/messages`);
  return onChildAdded(msgRef, (snap) => callback({ ...snap.val(), id: snap.key! }));
}

export async function deleteMessage(sessionId: string, messageId: string): Promise<void> {
  if (!realtimeDb) return;
  await remove(ref(realtimeDb, `audiolab_sessions/${sessionId}/messages/${messageId}`));
}

export async function getSession(sessionId: string): Promise<LiveSession | null> {
  if (!realtimeDb) return null;
  const snap = await get(ref(realtimeDb, `audiolab_sessions/${sessionId}`));
  return snap.exists() ? { ...snap.val(), id: sessionId } : null;
}

// EXPORT EXISTING HELPERS
export { generateInviteCode as generateMeetingId };
