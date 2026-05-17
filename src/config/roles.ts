// User Roles Configuration
import { isHQGroup } from '@/config/zones'

export type UserRole = 'super_admin' | 'boss' | 'zone_coordinator' | 'zone_member' | 'hq_admin' | 'hq_member';

export interface RolePermissions {
  // Zone Management
  canManageZone: boolean;
  canViewZoneSettings: boolean;
  canUpgradeSubscription: boolean;
  canCancelSubscription: boolean;
  canViewPaymentHistory: boolean;

  // Member Management
  canAddMembers: boolean;
  canRemoveMembers: boolean;
  canViewMembers: boolean;
  canShareInviteLink: boolean;

  // Content Management
  canCreatePraiseNight: boolean;
  canEditPraiseNight: boolean;
  canDeletePraiseNight: boolean;
  canCreateSong: boolean;
  canEditSong: boolean;
  canDeleteSong: boolean;
  canCreateCategory: boolean;
  canEditCategory: boolean;
  canDeleteCategory: boolean;

  // Super Admin Only
  canViewAllZones: boolean;
  canAccessSuperAdmin: boolean;
  canAccessBoss: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  // Super Admin - Organization level (YOU)
  // Can VIEW all zones and ASSIGN zone coordinators
  super_admin: {
    // Zone Management - FULL ACCESS (for all zones)
    canManageZone: true,
    canViewZoneSettings: true,
    canUpgradeSubscription: true,
    canCancelSubscription: true,
    canViewPaymentHistory: true,

    // Member Management - FULL ACCESS (can assign coordinators)
    canAddMembers: true,
    canRemoveMembers: true,
    canViewMembers: true,
    canShareInviteLink: true,

    // Content Management - FULL ACCESS (for all zones)
    canCreatePraiseNight: true,
    canEditPraiseNight: true,
    canDeletePraiseNight: true,
    canCreateSong: true,
    canEditSong: true,
    canDeleteSong: true,
    canCreateCategory: true,
    canEditCategory: true,
    canDeleteCategory: true,

    // Super Admin Only
    canViewAllZones: true,
    canAccessSuperAdmin: true,
    canAccessBoss: false
  },

  // Boss - Can view everything across all zones but cannot edit super admin content
  // Has full visibility but limited editing rights
  boss: {
    // Zone Management - VIEW ONLY
    canManageZone: false,
    canViewZoneSettings: true,
    canUpgradeSubscription: false,
    canCancelSubscription: false,
    canViewPaymentHistory: true,

    // Member Management - VIEW ONLY
    canAddMembers: false,
    canRemoveMembers: false,
    canViewMembers: true,
    canShareInviteLink: false,

    // Content Management - VIEW ONLY
    canCreatePraiseNight: false,
    canEditPraiseNight: false,
    canDeletePraiseNight: false,
    canCreateSong: false,
    canEditSong: false,
    canDeleteSong: false,
    canCreateCategory: false,
    canEditCategory: false,
    canDeleteCategory: false,

    // Boss Access
    canViewAllZones: true,
    canAccessSuperAdmin: false,
    canAccessBoss: true
  },

  // Zone Coordinator - The person who pays for the zone
  // Has FULL ADMIN rights for THEIR zone only
  zone_coordinator: {
    // Zone Management - FULL ACCESS
    canManageZone: true,
    canViewZoneSettings: true,
    canUpgradeSubscription: true,
    canCancelSubscription: true,
    canViewPaymentHistory: true,

    // Member Management - FULL ACCESS
    canAddMembers: true,
    canRemoveMembers: true,
    canViewMembers: true,
    canShareInviteLink: true,

    // Content Management - FULL ACCESS
    canCreatePraiseNight: true,
    canEditPraiseNight: true,
    canDeletePraiseNight: true,
    canCreateSong: true,
    canEditSong: true,
    canDeleteSong: true,
    canCreateCategory: true,
    canEditCategory: true,
    canDeleteCategory: true,

    // Super Admin Only
    canViewAllZones: false,
    canAccessSuperAdmin: false,
    canAccessBoss: false
  },

  // Zone Member - Regular user
  // Can only VIEW content, no admin rights
  zone_member: {
    // Zone Management - NO ACCESS
    canManageZone: false,
    canViewZoneSettings: false,
    canUpgradeSubscription: false,
    canCancelSubscription: false,
    canViewPaymentHistory: false,

    // Member Management - NO ACCESS
    canAddMembers: false,
    canRemoveMembers: false,
    canViewMembers: true, // Can see other members
    canShareInviteLink: false,

    // Content Management - NO ACCESS
    canCreatePraiseNight: false,
    canEditPraiseNight: false,
    canDeletePraiseNight: false,
    canCreateSong: false,
    canEditSong: false,
    canDeleteSong: false,
    canCreateCategory: false,
    canEditCategory: false,
    canDeleteCategory: false,

    // Super Admin Only
    canViewAllZones: false,
    canAccessSuperAdmin: false,
    canAccessBoss: false
  },

  // HQ Admin - Headquarters administrator
  // Can manage ALL HQ groups and their members (like super admin but for HQ only)
  hq_admin: {
    // Zone Management - FULL ACCESS for HQ groups
    canManageZone: true,
    canViewZoneSettings: true,
    canUpgradeSubscription: false, // HQ doesn't need subscriptions
    canCancelSubscription: false,
    canViewPaymentHistory: false,

    // Member Management - FULL ACCESS (can manage HQ group members)
    canAddMembers: true,
    canRemoveMembers: true,
    canViewMembers: true,
    canShareInviteLink: true,

    // Content Management - FULL ACCESS for HQ groups
    canCreatePraiseNight: true,
    canEditPraiseNight: true,
    canDeletePraiseNight: true,
    canCreateSong: true,
    canEditSong: true,
    canDeleteSong: true,
    canCreateCategory: true,
    canEditCategory: true,
    canDeleteCategory: true,

    // HQ Admin Access - Can view all HQ groups and access admin features
    canViewAllZones: true, // Can view all HQ groups
    canAccessSuperAdmin: true, // Can access HQ admin panel
    canAccessBoss: false
  },

  // HQ Member - Headquarters group member
  // Full access like coordinator but for HQ groups (no subscription needed)
  hq_member: {
    // Zone Management - FULL ACCESS (no subscription needed)
    canManageZone: true,
    canViewZoneSettings: true,
    canUpgradeSubscription: false, // HQ doesn't need subscriptions
    canCancelSubscription: false,
    canViewPaymentHistory: false,

    // Member Management - FULL ACCESS
    canAddMembers: true,
    canRemoveMembers: true,
    canViewMembers: true,
    canShareInviteLink: true,

    // Content Management - FULL ACCESS
    canCreatePraiseNight: true,
    canEditPraiseNight: true,
    canDeletePraiseNight: true,
    canCreateSong: true,
    canEditSong: true,
    canDeleteSong: true,
    canCreateCategory: true,
    canEditCategory: true,
    canDeleteCategory: true,

    // Super Admin Only
    canViewAllZones: false,
    canAccessSuperAdmin: false,
    canAccessBoss: false
  }
};

// Helper function to check permission
export function hasPermission(
  role: UserRole,
  permission: keyof RolePermissions
): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

// Helper function to get user role in a zone
export function getUserRoleInZone(
  userId: string,
  zoneId: string,
  zoneMembership: any,
  userEmail?: string
): UserRole {
  if (zoneMembership?.isSuperAdmin) {
    return 'super_admin';
  }

  if (zoneMembership?.role === 'boss' || zoneId === 'zone-boss') {
    return 'boss';
  }

  if (isHQGroup(zoneId) && userEmail && isHQAdminEmail(userEmail)) {
    return 'hq_admin';
  }

  if (isHQGroup(zoneId) && zoneMembership?.role === 'hq_admin') {
    return 'hq_admin';
  }

  if (isHQGroup(zoneId)) {
    return 'hq_member';
  }

  if (zoneMembership?.role === 'coordinator') {
    return 'zone_coordinator';
  }

  // Default to member
  return 'zone_member';
}

// Helper function to get user's global role based on email (for detecting HQ admins)
export function getUserGlobalRole(userEmail: string | null | undefined): UserRole | null {
  if (!userEmail) return null;

  if (isHQAdminEmail(userEmail)) {
    return 'hq_admin';
  }

  return null;
}

// isHQGroup is now imported from '@/config/zones' (single source of truth)

// Helper to check if user can access all HQ groups
export function canAccessAllHQGroups(role: UserRole): boolean {
  return role === 'super_admin' || role === 'boss' || role === 'hq_admin';
}

// Helper to check if user is an HQ administrator
export function isHQAdministrator(role: UserRole): boolean {
  return role === 'hq_admin';
}

// HQ Admin email list - Add emails of people who should be HQ admins
export const HQ_ADMIN_EMAILS = [
  'ihenacho23@gmail.com',       // Ihenacho Uche - HQ Admin  
  'ephraimloveworld1@gmail.com', // Ephraim Udoji - HQ Admin
  'takeshopstores@gmail.com',   // Eric Stephen - HQ Admin
  'nnennawealth@gmail.com',     // Nnenna Wealth - HQ Admin
  'joykures@gmail.com',         // Joy Kures - HQ Admin (Restricted)
  'styleirech@gmail.com',       // HQ Admin
];

// Helper to check if email should be HQ admin
export function isHQAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return HQ_ADMIN_EMAILS.includes(email.toLowerCase());
}

// Helper to check if user should see admin button on home page
export function shouldShowAdminButton(
  userEmail: string | null | undefined,
  currentRole?: UserRole
): boolean {
  if (!userEmail) return false;

  // Show admin button for HQ admins
  if (isHQAdminEmail(userEmail)) {
    return true;
  }

  // Show admin button for other admin roles
  if (currentRole && (
    currentRole === 'super_admin' ||
    currentRole === 'boss' ||
    currentRole === 'zone_coordinator' ||
    currentRole === 'hq_admin'
  )) {
    return true;
  }

  return false;
}
