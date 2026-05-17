// Profile Recovery Utility
// Fixes incomplete user accounts created before the bug was fixed

import { FirebaseDatabaseService } from '@/lib/firebase-database'
import { User } from 'firebase/auth'

interface RecoveryResult {
  success: boolean
  message: string
  profileCreated?: boolean
  profileUpdated?: boolean
}

/**
 * Check if user has a complete profile
 */
export async function checkProfileCompleteness(userId: string): Promise<{
  hasProfile: boolean
  isComplete: boolean
  profile: any | null
}> {
  try {
    const profile = await FirebaseDatabaseService.getDocument('profiles', userId)
    
    if (!profile) {
      return { hasProfile: false, isComplete: false, profile: null }
    }
    
        const hasRequiredFields = !!(
      (profile as any).email &&
      ((profile as any).first_name || (profile as any).last_name || (profile as any).full_name)
    )
    
    return {
      hasProfile: true,
      isComplete: hasRequiredFields,
      profile
    }
  } catch (error) {
 console.error('Error checking profile completeness:', error)
    return { hasProfile: false, isComplete: false, profile: null }
  }
}

/**
 * Recover/create missing or incomplete profile
 */
export async function recoverUserProfile(user: User): Promise<RecoveryResult> {
  try {
    
    // Check current profile status
    const status = await checkProfileCompleteness(user.uid)
    
    // Profile exists and is complete - no recovery needed
    if (status.hasProfile && status.isComplete) {
      return {
        success: true,
        message: 'Profile is already complete',
        profileCreated: false,
        profileUpdated: false
      }
    }
    
    // Profile missing completely - create new one
    if (!status.hasProfile) {
      
      const newProfile = {
        id: user.uid,
        email: user.email || '',
        first_name: user.displayName?.split(' ')[0] || '',
        last_name: user.displayName?.split(' ').slice(1).join(' ') || '',
        full_name: user.displayName || '',
        profile_completed: false, // User MUST complete profile (zone, KingsChat ID, etc.)
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        recovered: true, // Flag to indicate this was recovered
        recovered_at: new Date().toISOString(),
        // Missing critical data that user must provide:
        // - zone (we don't know which zone they belong to)
        // - kingschat_id (we don't have their KingsChat ID)
        // - phone_number (optional but important)
        // User will be redirected to profile completion page
      }
      
      await FirebaseDatabaseService.createDocument('profiles', user.uid, newProfile)
      
      return {
        success: true,
        message: 'Account recovered! Please sign up again to add your zone and KingsChat ID.',
        profileCreated: true,
        profileUpdated: false
      }
    }
    
    // Profile exists but incomplete - update it
    if (status.hasProfile && !status.isComplete) {
      
      const updates = {
        email: user.email || status.profile.email || '',
        first_name: status.profile.first_name || user.displayName?.split(' ')[0] || '',
        last_name: status.profile.last_name || user.displayName?.split(' ').slice(1).join(' ') || '',
        full_name: status.profile.full_name || user.displayName || '',
        profile_completed: false, // Force profile completion (need zone, KingsChat ID)
        updated_at: new Date().toISOString(),
        recovered: true,
        recovered_at: new Date().toISOString()
      }
      
      await FirebaseDatabaseService.updateDocument('profiles', user.uid, updates)
      
      return {
        success: true,
        message: 'Account recovered! Please sign up again to add your zone and KingsChat ID.',
        profileCreated: false,
        profileUpdated: true
      }
    }
    
    return {
      success: false,
      message: 'Unknown profile state'
    }
    
  } catch (error: any) {
 console.error(' Profile recovery failed:', error)
    return {
      success: false,
      message: error.message || 'Profile recovery failed'
    }
  }
}

/**
 * Auto-recover profile on login if needed
 * Call this after successful authentication
 */
export async function autoRecoverProfile(user: User): Promise<void> {
  try {
    const status = await checkProfileCompleteness(user.uid)
    
    // Only recover if profile is missing or incomplete
    if (!status.hasProfile || !status.isComplete) {
      const result = await recoverUserProfile(user)
      
      if (result.success) {
      } else {
 console.error(' Auto-recovery failed:', result.message)
      }
    }
  } catch (error) {
 console.error(' Auto-recovery error:', error)
  }
}
