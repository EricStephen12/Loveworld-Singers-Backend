// Bulk Profile Recovery Tool
// Admin utility to fix all incomplete profiles at once

import { FirebaseDatabaseService } from '@/lib/firebase-database'
import { auth } from '@/lib/firebase-setup'
// This utility is for reference only and should be run server-side

interface BulkRecoveryResult {
  total: number
  recovered: number
  failed: number
  skipped: number
  details: Array<{
    userId: string
    email: string
    status: 'recovered' | 'failed' | 'skipped'
    message: string
  }>
}

/**
 * Scan all Firebase Auth users and recover missing/incomplete profiles
 * This should be run by an admin to fix all affected users at once
 */
export async function bulkRecoverProfiles(): Promise<BulkRecoveryResult> {
  const result: BulkRecoveryResult = {
    total: 0,
    recovered: 0,
    failed: 0,
    skipped: 0,
    details: []
  }
  
  try {
    
    // Get all profiles from Firestore
    const profiles = await FirebaseDatabaseService.getCollection('profiles')
    const profileMap = new Map(profiles.map((p: any) => [p.id, p]))
    
    
        // For now, we'll just check existing profiles and fix incomplete ones
    
    for (const profile of profiles) {
      result.total++
      
      const userId = profile.id
      const email = (profile as any).email || 'unknown'
      
            const isIncomplete = !(
        (profile as any).email &&
        ((profile as any).first_name || (profile as any).last_name || (profile as any).full_name)
      )
      
      if (!isIncomplete) {
        result.skipped++
        result.details.push({
          userId,
          email,
          status: 'skipped',
          message: 'Profile is already complete'
        })
        continue
      }
      
      // Try to recover incomplete profile
      try {
        const updates = {
          email: (profile as any).email || email,
          first_name: (profile as any).first_name || '',
          last_name: (profile as any).last_name || '',
          full_name: (profile as any).full_name || (profile as any).first_name || (profile as any).last_name || '',
          updated_at: new Date().toISOString(),
          recovered: true,
          recovered_at: new Date().toISOString(),
          profile_completed: false // User should complete their profile
        }
        
        await FirebaseDatabaseService.updateDocument('profiles', userId, updates)
        
        result.recovered++
        result.details.push({
          userId,
          email,
          status: 'recovered',
          message: 'Profile recovered successfully'
        })
        
      } catch (error: any) {
        result.failed++
        result.details.push({
          userId,
          email,
          status: 'failed',
          message: error.message || 'Recovery failed'
        })
        
 console.error(` Failed to recover profile for ${email}:`, error)
      }
    }
    
    
    return result
    
  } catch (error: any) {
 console.error(' Bulk recovery error:', error)
    throw error
  }
}

/**
 * Generate a recovery report
 */
export function generateRecoveryReport(result: BulkRecoveryResult): string {
  const lines = [
    '=== Profile Recovery Report ===',
    '',
    `Total Profiles Checked: ${result.total}`,
    ` Recovered: ${result.recovered}`,
    ` Failed: ${result.failed}`,
    `⏭️ Skipped (Already Complete): ${result.skipped}`,
    '',
    '=== Details ===',
    ''
  ]
  
  // Group by status
  const recovered = result.details.filter(d => d.status === 'recovered')
  const failed = result.details.filter(d => d.status === 'failed')
  
  if (recovered.length > 0) {
    lines.push('Recovered Profiles:')
    recovered.forEach(d => {
      lines.push(` - ${d.email} (${d.userId})`)
    })
    lines.push('')
  }
  
  if (failed.length > 0) {
    lines.push('Failed Recoveries:')
    failed.forEach(d => {
      lines.push(` - ${d.email} (${d.userId}): ${d.message}`)
    })
    lines.push('')
  }
  
  return lines.join('\n')
}

// Make it available in browser console for admins
if (typeof window !== 'undefined') {
  (window as any).bulkRecoverProfiles = bulkRecoverProfiles;
  (window as any).generateRecoveryReport = async () => {
    const result = await bulkRecoverProfiles()
    return generateRecoveryReport(result)
  }
}
