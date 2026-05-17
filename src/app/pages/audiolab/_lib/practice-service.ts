/**
 * AUDIOLAB PRACTICE SERVICE
 * 
 * Firebase integration for practice progress tracking
 * Handles: session tracking, streaks, XP, weekly stats
 */

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { db } from '@/lib/firebase-setup';
import type { 
  PracticeSession, 
  PracticeProgress, 
  PracticeMode,
  PracticeStats 
} from '../_types';

// Collection names
const PROGRESS_COLLECTION = 'audiolab_progress';
const SESSIONS_COLLECTION = 'audiolab_sessions';

// XP rewards
const XP_REWARDS = {
  sessionComplete: 10,
  perfectScore: 50,
  streakBonus: 5,      // per day of streak
  accuracyBonus: 25,   // for 90%+ accuracy
  dailyFirst: 20       // first session of the day
};

// Level thresholds
const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000,
  17000, 23000, 30000, 40000, 52000, 67000, 85000, 107000, 135000, 170000
];

// SESSION TRACKING

/**
 * Start a new practice session
 */
export async function startSession(
  userId: string, 
  songId: string, 
  mode: PracticeMode
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    
    const sessionData = {
      userId,
      songId,
      mode,
      score: 0,
      accuracy: 0,
      streak: 0,
      startedAt: serverTimestamp(),
      endedAt: null,
      duration: 0
    };
    
    const docRef = await addDoc(collection(db, SESSIONS_COLLECTION), sessionData);
    
    return { success: true, sessionId: docRef.id };
  } catch (error) {
 console.error('[PracticeService] Error starting session:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to start session' 
    };
  }
}

/**
 * End a practice session and update progress
 */
export async function endSession(
  sessionId: string, 
  stats: { score: number; accuracy: number; streak: number; duration: number }
): Promise<{ success: boolean; xpEarned?: number; error?: string }> {
  try {
    
    // Get session data
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (!sessionSnap.exists()) {
      return { success: false, error: 'Session not found' };
    }
    
    const sessionData = sessionSnap.data();
    
        await updateDoc(sessionRef, {
      score: stats.score,
      accuracy: stats.accuracy,
      streak: stats.streak,
      duration: stats.duration,
      endedAt: serverTimestamp()
    });
    
        const xpEarned = await updateUserProgress(
      sessionData.userId, 
      stats,
      sessionData.mode
    );
    
    return { success: true, xpEarned };
  } catch (error) {
 console.error('[PracticeService] Error ending session:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to end session' 
    };
  }
}

// PROGRESS TRACKING

/**
 * Get user's practice progress
 */
export async function getUserProgress(userId: string): Promise<PracticeProgress | null> {
  try {
    
    const docRef = doc(db, PROGRESS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      // Create initial progress
      const initialProgress = createInitialProgress(userId);
      await setDoc(docRef, initialProgress);
      return initialProgress;
    }
    
    return docToProgress(docSnap);
  } catch (error) {
 console.error('[PracticeService] Error getting progress:', error);
    return null;
  }
}

/**
 * Get weekly stats for a user
 */
export async function getWeeklyStats(userId: string): Promise<{
  minutesPracticed: number;
  sessionsCompleted: number;
  averageScore: number;
  averageAccuracy: number;
  dailyBreakdown: { day: string; minutes: number }[];
}> {
  try {
    
        const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const sessionsQuery = query(
      collection(db, SESSIONS_COLLECTION),
      where('userId', '==', userId),
      where('startedAt', '>=', weekAgo),
      orderBy('startedAt', 'desc')
    );
    
    const snapshot = await getDocs(sessionsQuery);
    const sessions = snapshot.docs.map(doc => doc.data());
    
    // Calculate stats
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0) / 60, 0);
    const totalScore = sessions.reduce((sum, s) => sum + (s.score || 0), 0);
    const totalAccuracy = sessions.reduce((sum, s) => sum + (s.accuracy || 0), 0);
    
    // Daily breakdown
    const dailyMap = new Map<string, number>();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayKey = days[date.getDay()];
      dailyMap.set(dayKey, 0);
    }
    
    sessions.forEach(session => {
      const date = session.startedAt?.toDate?.() || new Date();
      const dayKey = days[date.getDay()];
      const current = dailyMap.get(dayKey) || 0;
      dailyMap.set(dayKey, current + (session.duration || 0) / 60);
    });
    
    const dailyBreakdown = Array.from(dailyMap.entries()).map(([day, minutes]) => ({
      day,
      minutes: Math.round(minutes)
    }));
    
    return {
      minutesPracticed: Math.round(totalMinutes),
      sessionsCompleted: sessions.length,
      averageScore: sessions.length > 0 ? Math.round(totalScore / sessions.length) : 0,
      averageAccuracy: sessions.length > 0 ? Math.round(totalAccuracy / sessions.length) : 0,
      dailyBreakdown
    };
  } catch (error) {
 console.error('[PracticeService] Error getting weekly stats:', error);
    return {
      minutesPracticed: 0,
      sessionsCompleted: 0,
      averageScore: 0,
      averageAccuracy: 0,
      dailyBreakdown: []
    };
  }
}

/**
 * Update user progress after a session
 */
async function updateUserProgress(
  userId: string, 
  stats: { score: number; accuracy: number; streak: number; duration: number },
  mode: PracticeMode
): Promise<number> {
  try {
    const docRef = doc(db, PROGRESS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    
    const today = new Date().toISOString().split('T')[0];
    let progress: PracticeProgress;
    let xpEarned = XP_REWARDS.sessionComplete;
    let isFirstSessionToday = false;
    
    if (!docSnap.exists()) {
      progress = createInitialProgress(userId);
      isFirstSessionToday = true;
    } else {
      progress = docToProgress(docSnap);
      isFirstSessionToday = progress.lastPracticeDate !== today;
    }
    
    // Calculate streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    let newStreak = progress.currentStreak;
    if (isFirstSessionToday) {
      if (progress.lastPracticeDate === yesterdayStr) {
        // Continuing streak
        newStreak = progress.currentStreak + 1;
        xpEarned += XP_REWARDS.streakBonus * newStreak;
      } else if (progress.lastPracticeDate !== today) {
        // Streak broken, start new
        newStreak = 1;
      }
      xpEarned += XP_REWARDS.dailyFirst;
    }
    
    // Bonus XP
    if (stats.accuracy >= 90) {
      xpEarned += XP_REWARDS.accuracyBonus;
    }
    if (stats.score >= 10000) {
      xpEarned += XP_REWARDS.perfectScore;
    }
    
    // Calculate new averages
    const totalSessions = progress.totalSessions + 1;
    const newAvgScore = Math.round(
      (progress.averageScore * progress.totalSessions + stats.score) / totalSessions
    );
    const newAvgAccuracy = Math.round(
      (progress.averageAccuracy * progress.totalSessions + stats.accuracy) / totalSessions
    );
    
    // Calculate new XP and level
    const newXp = progress.xp + xpEarned;
    const newLevel = calculateLevel(newXp);
    
        const updates = {
      currentStreak: newStreak,
      longestStreak: Math.max(progress.longestStreak, newStreak),
      lastPracticeDate: today,
      weeklyProgress: isFirstSessionToday 
        ? progress.weeklyProgress + Math.round(stats.duration / 60)
        : progress.weeklyProgress + Math.round(stats.duration / 60),
      totalSessions,
      totalMinutes: progress.totalMinutes + Math.round(stats.duration / 60),
      averageScore: newAvgScore,
      averageAccuracy: newAvgAccuracy,
      xp: newXp,
      level: newLevel,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(docRef, updates);
    
    return xpEarned;
  } catch (error) {
 console.error('[PracticeService] Error updating progress:', error);
    return 0;
  }
}

/**
 * Update streak (call daily to check for broken streaks)
 */
export async function updateStreak(userId: string): Promise<number> {
  try {
    const progress = await getUserProgress(userId);
    if (!progress) return 0;
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // If last practice was before yesterday, reset streak
    if (progress.lastPracticeDate !== today && progress.lastPracticeDate !== yesterdayStr) {
      const docRef = doc(db, PROGRESS_COLLECTION, userId);
      await updateDoc(docRef, {
        currentStreak: 0,
        updatedAt: serverTimestamp()
      });
      return 0;
    }
    
    return progress.currentStreak;
  } catch (error) {
 console.error('[PracticeService] Error updating streak:', error);
    return 0;
  }
}

/**
 * Reset weekly progress (call at start of each week)
 */
export async function resetWeeklyProgress(userId: string): Promise<void> {
  try {
    const docRef = doc(db, PROGRESS_COLLECTION, userId);
    await updateDoc(docRef, {
      weeklyProgress: 0,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
 console.error('[PracticeService] Error resetting weekly progress:', error);
  }
}

// LEADERBOARD

/**
 * Get top users by XP
 */
export async function getLeaderboard(limitCount: number = 10): Promise<{
  userId: string;
  xp: number;
  level: number;
  totalSessions: number;
}[]> {
  try {
    const q = query(
      collection(db, PROGRESS_COLLECTION),
      orderBy('xp', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        userId: doc.id,
        xp: data.xp || 0,
        level: data.level || 1,
        totalSessions: data.totalSessions || 0
      };
    });
  } catch (error) {
 console.error('[PracticeService] Error getting leaderboard:', error);
    return [];
  }
}

// HELPER FUNCTIONS

/**
 * Create initial progress for a new user
 */
function createInitialProgress(userId: string): PracticeProgress {
  return {
    userId,
    currentStreak: 0,
    longestStreak: 0,
    lastPracticeDate: '',
    weeklyTarget: 60, // 60 minutes per week default
    weeklyProgress: 0,
    totalSessions: 0,
    totalMinutes: 0,
    averageScore: 0,
    averageAccuracy: 0,
    xp: 0,
    level: 1,
    updatedAt: new Date()
  };
}

/**
 * Convert Firestore document to PracticeProgress
 */
function docToProgress(doc: any): PracticeProgress {
  const data = doc.data();
  return {
    userId: doc.id,
    currentStreak: data.currentStreak || 0,
    longestStreak: data.longestStreak || 0,
    lastPracticeDate: data.lastPracticeDate || '',
    weeklyTarget: data.weeklyTarget || 60,
    weeklyProgress: data.weeklyProgress || 0,
    totalSessions: data.totalSessions || 0,
    totalMinutes: data.totalMinutes || 0,
    averageScore: data.averageScore || 0,
    averageAccuracy: data.averageAccuracy || 0,
    xp: data.xp || 0,
    level: data.level || 1,
    updatedAt: data.updatedAt?.toDate?.() || new Date()
  };
}

/**
 * Calculate level from XP
 */
function calculateLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

/**
 * Get XP needed for next level
 */
export function getXpForNextLevel(currentXp: number): { current: number; needed: number; progress: number } {
  const level = calculateLevel(currentXp);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  
  const xpInLevel = currentXp - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  const progress = Math.round((xpInLevel / xpNeeded) * 100);
  
  return {
    current: xpInLevel,
    needed: xpNeeded,
    progress
  };
}

/**
 * Convert progress to PracticeStats (for UI)
 */
export function progressToStats(progress: PracticeProgress): PracticeStats {
  return {
    score: progress.averageScore,
    accuracy: progress.averageAccuracy,
    streak: progress.currentStreak,
    hitRate: progress.averageAccuracy,
    sessionsCompleted: progress.totalSessions,
    weeklyProgress: Math.round((progress.weeklyProgress / progress.weeklyTarget) * 100)
  };
}
