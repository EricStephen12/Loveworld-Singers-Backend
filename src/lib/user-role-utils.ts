// User Role Utilities
// Determines user permissions based on email prefix and zone context

import type { UserProfile } from '@/types/supabase'
import { isHQAdminEmail } from '@/config/roles'

// Boss emails that have full access to all features in all zones
const BOSS_EMAILS = [
  'takeshopstores@gmail.com'
];

/**
 * Check if user is a Boss or HQ Admin (has Boss/Admin status across all zones)
 */
export function isBoss(user: UserProfile | null): boolean {
  if (!user) return false

  const email = user.email?.toLowerCase();

  if (user.role === 'boss') return true;

  if (email?.startsWith('boss')) return true;

  if (email && BOSS_EMAILS.includes(email)) return true;

  if (email && isHQAdminEmail(email)) return true;

  return false;
}

/**
 * Check if user is a Zone Leader (has ZNL prefix in email)
 */
export function isZoneLeader(user: UserProfile | null): boolean {
  if (!user?.email) return false

  return user.email.toLowerCase().startsWith('znl')
}

/**
 * Check if user can see upgrade prompts
 * Only Zone Leaders (ZNL prefix) should see upgrade prompts
 */
export function canSeeUpgradePrompts(user: UserProfile | null): boolean {
  return isZoneLeader(user)
}

/**
 * Check if user is a zone coordinator
 * Zone coordinators have administrative privileges within their zone
 */
export function isZoneCoordinator(user: UserProfile | null): boolean {
  if (!user) return false

  return user.administration === 'Coordinator' || isZoneLeader(user)
}

/**
 * Check if user can manage zone subscription
 * Only zone coordinators and zone leaders can manage subscriptions
 */
export function canManageZoneSubscription(user: UserProfile | null): boolean {
  return isZoneCoordinator(user) || isZoneLeader(user)
}

/**
 * Get user display role for UI
 */
export function getUserDisplayRole(user: UserProfile | null): string {
  if (!user) return 'Guest'

  if (isBoss(user)) return 'Central Admin'
  if (isZoneLeader(user)) return 'Zone Leader'
  if (user.administration === 'Coordinator') return 'Zone Coordinator'
  if (user.administration === 'Assistant Coordinator') return 'Assistant Coordinator'
  if (user.administration) return user.administration
  if (user.role === 'admin') return 'Admin'

  return 'Member'
}

/**
 * Check if user has elevated permissions in zone
 */
export function hasZoneElevatedPermissions(user: UserProfile | null): boolean {
  return isZoneLeader(user) || isZoneCoordinator(user)
}

/**
 * Get user permissions summary
 */
export function getUserPermissions(user: UserProfile | null) {
  return {
    isBoss: isBoss(user),
    isZoneLeader: isZoneLeader(user),
    isZoneCoordinator: isZoneCoordinator(user),
    canSeeUpgradePrompts: canSeeUpgradePrompts(user),
    canManageSubscription: canManageZoneSubscription(user),
    hasElevatedPermissions: hasZoneElevatedPermissions(user),
    displayRole: getUserDisplayRole(user)
  }
}