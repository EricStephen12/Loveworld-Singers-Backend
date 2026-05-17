import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database Tables - Fresh Schema
export const TABLES = {
  // Main Pages/Categories
  PAGES: 'pages',
  CATEGORIES: 'categories',
  
  // Songs and their data
  SONGS: 'songs',
  SONG_HISTORY: 'song_history',
  
  // Audio files
  AUDIO_FILES: 'audio_files',
  
  // Comments/Remarks
  COMMENTS: 'comments',
} as const;

// Database Types
export interface Database {
  public: {
    Tables: {
      pages: {
        Row: {
          id: number;
          name: string;
          description: string;
          date: string;
          location: string;
          icon: string;
          color: string;
          isActive: boolean;
          category: 'unassigned' | 'pre-rehearsal' | 'ongoing' | 'archive';
          bannerImage?: string;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: number;
          name: string;
          description: string;
          date: string;
          location: string;
          icon: string;
          color: string;
          isActive?: boolean;
          category: 'unassigned' | 'pre-rehearsal' | 'ongoing' | 'archive';
          bannerImage?: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: number;
          name?: string;
          description?: string;
          date?: string;
          location?: string;
          icon?: string;
          color?: string;
          isActive?: boolean;
          category?: 'unassigned' | 'pre-rehearsal' | 'ongoing' | 'archive';
          bannerImage?: string;
          createdAt?: string;
          updatedAt?: string;
        };
      };
      categories: {
        Row: {
          id: number;
          name: string;
          description: string;
          color: string;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: number;
          name: string;
          description: string;
          color: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: number;
          name?: string;
          description?: string;
          color?: string;
          createdAt?: string;
          updatedAt?: string;
        };
      };
      songs: {
        Row: {
          id: number;
          title: string;
          leadSinger: string;
          writer: string;
          conductor: string;
          key: string;
          tempo: string;
          keyboardist: string;
          guitarist: string;
          drummer: string;
          lyrics: string;
          solfas: string;
          comments: string;
          category: string;
          status: 'new' | 'ongoing' | 'completed';
          pageId: number;
          rehearsalCount: number;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          id?: number;
          title: string;
          leadSinger: string;
          writer: string;
          conductor: string;
          key: string;
          tempo: string;
          keyboardist: string;
          guitarist: string;
          drummer: string;
          lyrics: string;
          solfas: string;
          comments: string;
          category: string;
          status?: 'new' | 'ongoing' | 'completed';
          pageId: number;
          rehearsalCount?: number;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          id?: number;
          title?: string;
          leadSinger?: string;
          writer?: string;
          conductor?: string;
          key?: string;
          tempo?: string;
          keyboardist?: string;
          guitarist?: string;
          drummer?: string;
          lyrics?: string;
          solfas?: string;
          comments?: string;
          category?: string;
          status?: 'new' | 'ongoing' | 'completed';
          pageId?: number;
          rehearsalCount?: number;
          createdAt?: string;
          updatedAt?: string;
        };
      };
      song_history: {
        Row: {
          id: number;
          songId: number;
          type: 'lyrics' | 'solfas' | 'audio' | 'comments' | 'metadata';
          content: string;
          version: number;
          createdAt: string;
        };
        Insert: {
          id?: number;
          songId: number;
          type: 'lyrics' | 'solfas' | 'audio' | 'comments' | 'metadata';
          content: string;
          version: number;
          createdAt?: string;
        };
        Update: {
          id?: number;
          songId?: number;
          type?: 'lyrics' | 'solfas' | 'audio' | 'comments' | 'metadata';
          content?: string;
          version?: number;
          createdAt?: string;
        };
      };
      audio_files: {
        Row: {
          id: number;
          songId: number;
          filename: string;
          url: string;
          size: number;
          isCurrent: boolean;
          createdAt: string;
        };
        Insert: {
          id?: number;
          songId: number;
          filename: string;
          url: string;
          size: number;
          isCurrent?: boolean;
          createdAt?: string;
        };
        Update: {
          id?: number;
          songId?: number;
          filename?: string;
          url?: string;
          size?: number;
          isCurrent?: boolean;
          createdAt?: string;
        };
      };
      comments: {
        Row: {
          id: number;
          songId: number;
          content: string;
          author: string;
          isCurrent: boolean;
          createdAt: string;
        };
        Insert: {
          id?: number;
          songId: number;
          content: string;
          author: string;
          isCurrent?: boolean;
          createdAt?: string;
        };
        Update: {
          id?: number;
          songId?: number;
          content?: string;
          author?: string;
          isCurrent?: boolean;
          createdAt?: string;
        };
      };
    };
  };
}
