// Type definitions for Supabase data structures

// User Profile Types
export interface UserProfile {
  id: string;
  uid?: string; // Common alias for id in Auth context
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email: string;
  phone_number?: string;
  gender?: 'Male' | 'Female';
  birthday?: string;
  region?: string;
  zone?: string;
  church?: string;
  designation?: 'Soprano' | 'Alto' | 'Tenor' | 'Bass' | 'Instrumentalist' | 'Backup Singer';
  administration?: 'Coordinator' | 'Assistant Coordinator' | 'Secretary' | 'Treasurer' | 'Member';
  role?: 'user' | 'admin' | 'boss';
  social_provider?: 'google' | 'kingschat' | 'email';
  social_id?: string;
  profile_image_url?: string;
  profile_completed: boolean;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  // KingsChat linking fields
  kingschatUserId?: string;
  kingschatEmail?: string;
  kingschatPassword?: string; // Stored password for auto sign-in
  kingschatLinkedAt?: string;
  authProviders?: string[];
  // Onboarding tour fields
  has_seen_onboarding_tour?: boolean;
  onboarding_completed_at?: string;
  // Permissions
  can_access_pre_rehearsal?: boolean;
  is_hq_member?: boolean;
  has_hq_access?: boolean;
  can_manage_subgroups?: boolean;
  // AudioLab / profile UI helpers (Firebase-style fields)
  avatar_url?: string | null;
  display_name?: string | null;
}

export interface UserGroup {
  id: string;
  user_id: string;
  group_name: string;
  created_at: string;
}

// Chat System Types
export interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  updated_at: string;
  // Populated fields
  user1?: UserProfile;
  user2?: UserProfile;
  last_message?: Message;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'voice' | 'file';
  file_url?: string;
  file_name?: string;
  file_size?: number;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  // Snapchat-like features
  is_disappearing: boolean;
  expires_at?: string;
  is_screenshot_taken: boolean;
  screenshot_taken_at?: string;
  // Populated fields
  sender?: UserProfile;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  reaction_type: 'heart' | 'laugh' | 'wow' | 'sad' | 'angry' | 'thumbs_up';
  created_at: string;
  // Populated fields
  user?: UserProfile;
}

export interface TypingIndicator {
  id: string;
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
  updated_at: string;
  // Populated fields
  user?: UserProfile;
}

export interface UserOnlineStatus {
  id: string;
  user_id: string;
  is_online: boolean;
  last_seen: string;
  updated_at: string;
  // Populated fields
  user?: UserProfile;
}

// Chat UI Types
export interface ChatContact {
  user: UserProfile;
  shared_groups: string[];
  last_message?: Message;
  unread_count: number;
  is_online: boolean;
  last_seen?: string;
}



export interface Attendance {
  id: string;
  user_id: string;
  event_name: string;
  event_date: string;
  status: 'Present' | 'Late' | 'Absent';
  check_in_time?: string;
  created_at: string;
}

export interface Achievement {
  id: string;
  user_id: string;
  achievement_name: string;
  achievement_description?: string;
  earned_date: string;
  created_at: string;
}

// Auth Types
export interface SignUpData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface ProfileCompletionData {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  gender?: 'Male' | 'Female';
  birthday?: string;
  phoneNumber?: string;
  region?: string;
  zone?: string;
  church?: string;
  designation?: 'Soprano' | 'Alto' | 'Tenor' | 'Bass' | 'Instrumentalist' | 'Backup Singer';
  administration?: 'Coordinator' | 'Assistant Coordinator' | 'Secretary' | 'Treasurer' | 'Member';
}

export interface PraiseNight {
  id: string; // Firebase-generated document ID
  firebaseId?: string; // Deprecated: kept for backward compatibility
  name: string;
  date: string;
  location: string;
  category: 'unassigned' | 'pre-rehearsal' | 'ongoing' | 'archive';
  pageCategory?: string; // New field for page categories
  scope?: 'zone' | 'subgroup'; // New field for context scope
  subGroupName?: string; // New field for subgroup specificity
  bannerImage?: string;
  songCount?: number; // Added to cache song count for UI
  categoryOrder?: string[]; // New field for manual category sorting
  countdown: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  };
  songs: PraiseNightSong[];
  createdAt?: any;
  updatedAt?: any;
}

export interface PraiseNightSong {
  id?: string; // Firebase-generated document ID
  firebaseId?: string; // Deprecated: kept for backward compatibility
  title: string;
  status: 'heard' | 'unheard';
  category: string; // Keep for backward compatibility
  categories?: string[]; // New multi-category support
  praiseNightId: string; // Reference to PraiseNight ID (Firebase-generated)
  isActive?: boolean; // TRUE = Song is currently being discussed (users see blinking border)
  leadSinger?: string;
  writer?: string;
  conductor?: string;
  key?: string;
  tempo?: string;
  leadKeyboardist?: string;
  leadGuitarist?: string;
  bassGuitarist?: string;
  drummer?: string;
  lyrics?: string;
  solfas?: string;
  notation?: string;
  rehearsalCount?: number; // Manual rehearsal count
  audioFile?: string;
  mediaId?: number; // Reference to media table for uploaded audio files
  // Multiple audio parts for AudioLab
  audioUrls?: Record<string, string>; // { full: url, soprano: url, alto: url, tenor: url, bass: url, custom: url }
  customParts?: string[]; // Array of custom part names beyond default S/A/T/B
  availableParts?: string[]; // List of available parts (computed from audioUrls keys)
  comments: Comment[];
  history: HistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Comment {
  id: string;
  text: string;
  audioUrl?: string; // Optional audio comment
  date: string;
  author: string;
}

export interface HistoryEntry {
  id: string;
  type: 'lyrics' | 'solfas' | 'notation' | 'audio' | 'comments' | 'song-details' | 'personnel' | 'music-details';
  title: string;
  description: string;
  old_value: string;
  new_value: string;
  created_by: string;
  date: string;
  version: string;
  audioUrl?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PageCategory {
  id: string;
  name: string;
  description?: string;
  image?: string;
  zoneId?: string;
  orderIndex?: number;
  createdAt: Date;
  updatedAt: Date;
}


// yd