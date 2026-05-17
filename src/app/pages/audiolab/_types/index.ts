// AudioLab Types - Complete Data Models

import { Timestamp } from 'firebase/firestore';

// VOCAL PARTS & AUDIO

// Standard vocal parts
export type StandardVocalPart = 'full' | 'soprano' | 'alto' | 'tenor' | 'bass';

// VocalPart can be standard or custom (any string)
export type VocalPart = StandardVocalPart | string;

export interface AudioUrls {
  full?: string;
  soprano?: string;
  alto?: string;
  tenor?: string;
  bass?: string;
  [key: string]: string | undefined; // Allow custom parts
}

// SONG TYPES

export interface LyricLine {
  time: number;         // Start time in seconds
  text: string;
  duration?: number;    // Duration of line
  pitch?: number;       // Target pitch for scoring
}

export interface AudioLabSong {
  id: string;
  title: string;
  artist: string;
  duration: number;     // seconds

  // Multi-part audio URLs (Cloudinary)
  audioUrls: AudioUrls;

  // Available parts (for filtering)
  availableParts: VocalPart[];

  // Metadata
  genre?: string;
  key?: string;
  tempo?: number;
  albumArt?: string;
  lyricsUrl?: string;

  // Lyrics data for karaoke
  lyrics?: LyricLine[] | string;

  // Access control
  zoneId?: string;      // null = available to all zones (HQ songs)
  isHQSong: boolean;    // true = distributed from HQ

  // Timestamps
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  createdBy: string;    // userId
}

// Legacy Song type for backward compatibility
export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
  genre?: string;
  key?: string;
  tempo?: number;
  albumArt?: string;
  audioUrl?: string;
  lyricsUrl?: string;
  // Multi-part support
  audioUrls?: AudioUrls;
  availableParts?: VocalPart[];
  customParts?: string[]; // Track custom part names
  isHQSong?: boolean;     // true if from master library
  lyrics?: LyricLine[] | string;
}

// PLAYLIST TYPES

export interface Playlist {
  id: string;
  title: string;
  description: string;
  coverImage?: string;
  songIds: string[];    // References to AudioLabSong IDs
  songs?: Song[];       // Populated songs (client-side)
  userId: string;
  zoneId?: string;
  isPublic: boolean;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// PROJECT & TRACK TYPES (Multi-track Studio)

export interface Track {
  id: string;
  name: string;
  type: 'vocal' | 'harmony' | 'guide' | 'instrument';
  color: string;

  // Audio
  audioUrl?: string;    // Cloudinary URL
  audioBlob?: Blob;     // Local recording (before upload)
  waveform?: number[];  // Pre-computed waveform data

  // Mix controls
  volume: number;       // 0-100
  pan: number;          // -100 to 100
  muted: boolean;
  solo: boolean;

  // Effects (reverb, EQ, compression)
  effects?: {
    volume: number;      // 0-100
    pan: number;         // -100 to 100
    reverb: number;      // 0-100 (wet/dry mix)
    bass: number;        // -12 to 12 dB
    treble: number;      // -12 to 12 dB
    compression: number; // 0-100
  };

  // Recording metadata
  recordedAt?: Date | Timestamp;
  duration?: number;
}

export interface AudioLabProject {
  id: string;
  name: string;

  // Project settings
  tempo: number;        // BPM
  timeSignature: string; // e.g., "4/4"
  duration: number;     // Total duration in seconds

  // Tracks
  tracks: Track[];

  // Reference song (if practicing along)
  referenceSongId?: string;

  // Ownership
  ownerId: string;
  collaborators: string[];
  zoneId?: string;

  // Timestamps
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// LIVE SESSION TYPES (Real-time Collaboration)

export interface AudioLabRoom {
  id: string;
  code: string;         // Permanent 6-digit join code
  title: string;
  hostId: string;
  hostName: string;
  hostAvatar?: string | null;
  settings: {
    isPrivate: boolean;
    allowGuestMic: boolean;
    allowGuestVideo: boolean;
  };
  activeSessionId?: string | null; // Currently active session if any
  createdAt: number;
}

export interface Participant {
  id: string;
  name: string;
  avatar?: string | null;
  role: 'host' | 'participant';
  isOnline: boolean;
  isMuted: boolean;
  isCameraOn: boolean;
  joinedAt: number;     // timestamp
  networkQuality?: 'good' | 'fair' | 'poor';
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  updatedAt: number;
  updatedBy: string;
}

export interface LiveSession {
  id: string;
  roomId: string;       // Link to the permanent room
  hostId: string;
  
  // Session details
  songId?: string;
  title: string;

  // Participants
  participants: Record<string, Participant>;

  // Playback state (synced)
  playback: PlaybackState;

  // Status
  status: 'active' | 'ended';
  startedAt: number;    // timestamp
  endedAt?: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;

  type: 'text' | 'voice' | 'system' | 'file';
  content?: string;     // Text content
  voiceUrl?: string;    // Cloudinary URL for voice notes
  voiceDuration?: number;

  // File message properties
  file?: {
    name: string;
    size: number;  // in bytes
    type: string;  // MIME type
    url?: string;  // Cloudinary URL
  };

  timestamp: number;
  status: 'sent' | 'delivered' | 'read';
}

// PRACTICE & PROGRESS TYPES

export type PracticeMode = 'karaoke' | 'warmup' | 'pitch' | 'strength';

export interface PracticeSession {
  id: string;
  userId: string;
  songId: string;
  mode: PracticeMode;

  // Performance
  score: number;
  accuracy: number;
  streak: number;

  // Duration
  startedAt: Date | Timestamp;
  endedAt?: Date | Timestamp;
  duration: number;     // seconds
}

export interface PracticeProgress {
  userId: string;

  // Streak tracking
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string; // YYYY-MM-DD

  // Weekly stats
  weeklyTarget: number;     // minutes
  weeklyProgress: number;   // minutes practiced this week

  // Lifetime stats
  totalSessions: number;
  totalMinutes: number;
  averageScore: number;
  averageAccuracy: number;

  // XP/Gamification
  xp: number;
  level: number;

  updatedAt: Date | Timestamp;
}

export interface PracticeStats {
  score: number;
  accuracy: number;
  streak: number;
  hitRate: number;
  sessionsCompleted: number;
  weeklyProgress: number;
}

// PLAYER STATE TYPES

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerState {
  currentSong: Song | null;
  currentPart: VocalPart;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: RepeatMode;
  isLoading: boolean;
  isBufferLoading?: boolean;
  loadingTarget?: string | null; // e.g., "full" or "alto"
}

// VIEW & UI TYPES

export type ViewType =
  | 'home'           // Entry point - single CTA
  | 'intent-choice'  // "How do you want to start?"
  | 'library'
  | 'practice'
  | 'studio'
  | 'collab'
  | 'collab-chat'
  | 'live-session'
  | 'karaoke'
  | 'warmup'         // Vocal warm-up exercises
  | 'playlist-detail';

// COLLABORATOR TYPE

export interface Collaborator {
  id: string;
  name: string;
  avatar?: string;
  online: boolean;
  editingTrackId?: string;
}

// SERVICE INPUT TYPES

export interface CreateSongInput {
  title: string;
  artist: string;
  duration: number;
  audioUrls: AudioUrls;
  availableParts: VocalPart[];
  genre?: string;
  key?: string;
  tempo?: number;
  albumArt?: string;
  lyrics?: LyricLine[];
  zoneId?: string;
  isHQSong?: boolean;
  createdBy: string;
}

export interface CreateProjectInput {
  name: string;
  tempo?: number;
  timeSignature?: string;
  referenceSongId?: string;
  ownerId: string;
  zoneId?: string;
}

export interface CreateTrackInput {
  name: string;
  type: Track['type'];
  color?: string;
}

// AUDIO ENGINE TYPES

export interface AudioEngineState {
  isInitialized: boolean;
  isRecording: boolean;
  inputLevel: number;      // 0-1 microphone input level
  currentPitch: number;    // Hz
  pitchConfidence: number; // 0-1
}

export interface PitchData {
  pitch: number;           // Hz
  confidence: number;      // 0-1
  note?: string;           // e.g., "A4"
  cents?: number;          // deviation from perfect pitch
}
