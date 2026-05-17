import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  increment,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase-setup';
import { getAllMasterSongs } from '@/app/pages/audiolab/_lib/song-service';

interface SongMinistryRecord {
  id: string;
  songId: string;
  songTitle: string;
  date: Date;
  programType: 'rehearsal' | 'service' | 'meeting' | 'other';
  programDate: string; // YYYY-MM-DD format
  month: number; // 0-11
  year: number;
  zoneId?: string;
  createdBy: string;
  createdAt: Date;
  notes?: string;
}

interface MonthlySongMinistrySummary {
  year: number;
  month: number;
  songMinistries: { [songId: string]: number };
  totalMinistries: number;
  updatedAt: Date;
  createdAt: Date;
}

export class SongMinistryService {
  
  private static getMonthlyDocId(year: number, month: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }

  static async logSongMinistry(songId: string, songTitle: string, programType: 'rehearsal' | 'service' | 'meeting' | 'other', programDate: string, zoneId?: string, notes?: string): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const now = new Date();
      const date = new Date(programDate);
      const year = date.getFullYear();
      const month = date.getMonth();
      
      // Create the ministry record
      const record: Omit<SongMinistryRecord, 'id'> = {
        songId,
        songTitle,
        date: now,
        programType,
        programDate,
        month,
        year,
        zoneId,
        createdBy: 'admin', // This should come from auth context
        createdAt: now,
        notes
      };
      
      // Add to the main collection
      const docRef = await addDoc(collection(db, 'song_ministries'), record);
      
            await this.updateMonthlySummary(songId, year, month);
      
      return { success: true, id: docRef.id };
    } catch (error) {
 console.error('Error logging song ministry:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private static async updateMonthlySummary(songId: string, year: number, month: number) {
    const docId = this.getMonthlyDocId(year, month);
    const docRef = doc(db, 'song_ministry_summaries', docId);
    
    const updateData = {
      [`songMinistries.${songId.replace(/\./g, '_')}`]: increment(1),
      totalMinistries: increment(1),
      updatedAt: new Date()
    };
    
    try {
      await updateDoc(docRef, updateData);
    } catch (error) {
      // If document doesn't exist, create it
      const newSummary: MonthlySongMinistrySummary = {
        year,
        month,
        songMinistries: { [songId.replace(/\./g, '_')]: 1 },
        totalMinistries: 1,
        updatedAt: new Date(),
        createdAt: new Date()
      };
      await setDoc(docRef, newSummary);
    }
  }

  static async getMonthlySummary(year: number, month: number): Promise<MonthlySongMinistrySummary | null> {
    const docId = this.getMonthlyDocId(year, month);
    const docRef = doc(db, 'song_ministry_summaries', docId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    const data = docSnap.data();
    return {
      year: data.year,
      month: data.month,
      songMinistries: data.songMinistries || {},
      totalMinistries: data.totalMinistries || 0,
      updatedAt: data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt,
      createdAt: data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt
    };
  }

  static async getAllMonthlySummaries(): Promise<MonthlySongMinistrySummary[]> {
    try {
      const snapshot = await getDocs(collection(db, 'song_ministry_summaries'));
      
      const summaries = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          year: data.year,
          month: data.month,
          songMinistries: data.songMinistries || {},
          totalMinistries: data.totalMinistries || 0,
          updatedAt: data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt,
          createdAt: data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt
        };
      });
      
      return summaries.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
    } catch (error) {
 console.error('Error fetching monthly summaries:', error);
      return [];
    }
  }

  static async getMinistriesForSong(songId: string, startDate?: Date, endDate?: Date): Promise<SongMinistryRecord[]> {
    try {
      let q = query(collection(db, 'song_ministries'), where('songId', '==', songId));
      
      if (startDate && endDate) {
        q = query(q, 
          where('programDate', '>=', startDate.toISOString().split('T')[0]),
          where('programDate', '<=', endDate.toISOString().split('T')[0])
        );
      }
      
      q = query(q, orderBy('programDate', 'desc'));
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          songId: data.songId,
          songTitle: data.songTitle,
          date: data.date.toDate ? data.date.toDate() : data.date,
          programType: data.programType,
          programDate: data.programDate,
          month: data.month,
          year: data.year,
          zoneId: data.zoneId,
          createdBy: data.createdBy,
          createdAt: data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt,
          notes: data.notes
        };
      });
    } catch (error) {
 console.error('Error fetching song ministries:', error);
      return [];
    }
  }

  static async getMostMinisteredSongs(startDate?: Date, endDate?: Date): Promise<{ songId: string; songTitle: string; count: number }[]> {
    try {
      let q = query(collection(db, 'song_ministries'));
      
      if (startDate && endDate) {
        q = query(q, 
          where('programDate', '>=', startDate.toISOString().split('T')[0]),
          where('programDate', '<=', endDate.toISOString().split('T')[0])
        );
      }
      
      const snapshot = await getDocs(q);
      
      const songCounts: { [key: string]: { songTitle: string; count: number } } = {};
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const songId = data.songId;
        if (songCounts[songId]) {
          songCounts[songId].count++;
        } else {
          songCounts[songId] = {
            songTitle: data.songTitle,
            count: 1
          };
        }
      });
      
      return Object.entries(songCounts)
        .map(([songId, info]) => ({
          songId,
          songTitle: info.songTitle,
          count: info.count
        }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
 console.error('Error fetching most ministered songs:', error);
      return [];
    }
  }

  static async getAllSongs() {
    try {
      const songs = await getAllMasterSongs();
      return songs.map((song: any) => ({
        id: song.id,
        title: song.title,
        artist: song.artist
      }));
    } catch (error) {
 console.error('Error fetching all songs:', error);
      return [];
    }
  }
}