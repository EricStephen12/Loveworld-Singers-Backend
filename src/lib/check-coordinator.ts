/**
 * Check if user is a zone coordinator
 * Directly queries the database instead of relying on ZoneContext
 */

import { FirebaseDatabaseService } from './firebase-database'

export async function isUserCoordinator(userId: string): Promise<boolean> {
  try {
    // Get user's zone memberships
    const memberships = await FirebaseDatabaseService.getCollectionWhere(
      'zone_members',
      'userId',
      '==',
      userId
    )
    
        const hasCoordinatorRole = memberships.some((m: any) => m.role === 'coordinator')
    
    return hasCoordinatorRole
  } catch (error) {
 console.error('Error checking coordinator status:', error)
    return false
  }
}

/**
 * Synchronous check using cached profile data
 * Use this when you already have the user's memberships loaded
 */
export function checkCoordinatorFromMemberships(memberships: any[]): boolean {
  return memberships.some((m: any) => m.role === 'coordinator')
}
