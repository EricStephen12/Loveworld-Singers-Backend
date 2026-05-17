// HQ Invitation Service
// Handles invitation codes for HQ groups (zone-001 to zone-005)
// Separate from zone invitations but uses same authentication

import { HQMembersService } from './hq-members-service'
import { getZoneByInvitationCode, isHQGroup } from '@/config/zones'

export class HQInvitationService {
  
  /**
   * Join HQ group using invitation code
   * Uses same invitation codes as zones (ZONE001-ZONE005)
   * But stores in hq_members collection instead of zone_members
   */
  static async joinHQGroup(
    invitationCode: string,
    userId: string,
    userEmail: string,
    userName: string
  ) {
    try {
      
      // Get zone by invitation code
      const zone = getZoneByInvitationCode(invitationCode)
      
      if (!zone) {
 console.error(' Invalid invitation code')
        return { success: false, error: 'Invalid invitation code' }
      }
      
            if (!isHQGroup(zone.id)) {
 console.error(' Not an HQ group invitation code')
        return { success: false, error: 'Not an HQ group invitation code' }
      }
      
      
            const existingMember = await HQMembersService.getMemberByUserId(userId, zone.id)
      if (existingMember) {
        return { success: false, error: 'Already a member of this HQ group' }
      }
      
      // Determine role based on invitation code
      const isCoordinator = invitationCode.startsWith('ZNL')
      const role = isCoordinator ? 'coordinator' : 'member'
      
      
      // Add to hq_members collection
      const result = await HQMembersService.addMember({
        userId,
        userEmail,
        userName,
        hqGroupId: zone.id,
        role
      })
      
      if (result.success) {
        return {
          success: true,
          zoneName: zone.name,
          zoneId: zone.id,
          message: `Welcome to ${zone.name}! (HQ Group - Unlimited Access)`,
          isHQGroup: true,
          role
        }
      } else {
        return result
      }
    } catch (error) {
 console.error(' Error joining HQ group:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  /**
   * Get HQ group stats
   */
  static async getHQGroupStats(hqGroupId: string) {
    try {
      if (!isHQGroup(hqGroupId)) {
        return null
      }
      
      const members = await HQMembersService.getHQGroupMembers(hqGroupId)
      const coordinator = members.find((m: any) => m.role === 'coordinator') as any
      
      return {
        memberCount: members.length,
        coordinatorEmail: coordinator?.userEmail,
        coordinatorName: coordinator?.userName,
        members
      }
    } catch (error) {
 console.error(' Error getting HQ group stats:', error)
      return null
    }
  }
  
  /**
   * Check if invitation code is for HQ group
   */
  static isHQInvitationCode(invitationCode: string): boolean {
    const zone = getZoneByInvitationCode(invitationCode)
    return zone ? isHQGroup(zone.id) : false
  }
}
