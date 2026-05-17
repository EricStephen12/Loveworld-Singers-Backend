import { FirebaseDatabaseService } from './firebase-database'
import { HQMembersService } from './hq-members-service'
import { HQInvitationService } from './hq-invitation-service'
import { ZONES, getZoneByInvitationCode, isHQGroup, Zone } from '@/config/zones'
import { UserProfile } from '@/types/supabase'

export class ZoneInvitationService {

  static async joinZoneWithCode(
    userId: string,
    invitationCode: string,
    userEmail: string,
    userName: string,
    role: 'member' | 'coordinator' | 'boss' = 'member'
  ) {
    try {
      const zone = getZoneByInvitationCode(invitationCode)

      if (!zone) {
        return {
          success: false,
          error: 'Invalid invitation code. Please check and try again.'
        }
      }

      if (isHQGroup(zone.id)) {
        return await HQInvitationService.joinHQGroup(
          invitationCode,
          userId,
          userEmail,
          userName
        )
      }

      const existingMembers = await FirebaseDatabaseService.getCollectionWhere(
        'zone_members',
        'userId',
        '==',
        userId
      )

      const alreadyMember = existingMembers.some((m: any) => m.zoneId === zone.id)

      if (alreadyMember) {
        return {
          success: true,
          alreadyMember: true,
          zoneName: zone.name,
          message: `You are already a member of ${zone.name}`
        }
      }

      // We explicitly check legacy document structure or standard zone structure
      const zoneData = await FirebaseDatabaseService.getDocument('zones', zone.id) as any
      const currentMemberCount = zoneData?.memberCount || 0

      if (!zoneData) {
        await FirebaseDatabaseService.createDocument('zones', zone.id, {
          id: zone.id,
          name: zone.name,
          slug: zone.slug,
          region: zone.region,
          invitationCode: zone.invitationCode,
          themeColor: zone.themeColor,
          coordinatorId: userId,
          memberCount: 0,
          maxMembers: 20,
          subscriptionTier: 'free',
          subscriptionStatus: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }

      const isFirstMember = currentMemberCount === 0
      const finalRole = role || (isFirstMember ? 'coordinator' : 'member')

      const memberId = `mem_${Date.now()}_${userId}`
      await FirebaseDatabaseService.createDocument('zone_members', memberId, {
        id: memberId,
        zoneId: zone.id,
        userId,
        userEmail,
        userName,
        role: finalRole,
        joinedAt: new Date(),
        status: 'active'
      })

      if (finalRole === 'coordinator') {
        await FirebaseDatabaseService.updateDocument('zones', zone.id, {
          coordinatorId: userId,
          coordinatorName: userName,
          coordinatorEmail: userEmail,
          updatedAt: new Date()
        })
      }

      await FirebaseDatabaseService.updateDocument('zones', zone.id, {
        memberCount: currentMemberCount + 1,
        updatedAt: new Date()
      })

      return {
        success: true,
        zoneName: zone.name,
        zoneId: zone.id,
        message: `Welcome to ${zone.name}!`
      }

    } catch (error) {
 console.error('Error joining zone:', error)
      return {
        success: false,
        error: 'Failed to join zone. Please try again.'
      }
    }
  }

  static getZoneSignupLink(invitationCode: string): string {
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    return `${baseUrl}/auth?zone=${invitationCode}`
  }

  static async getAllZonesWithStats() {
    try {
      const zonesWithStats = await Promise.all(
        ZONES.map(async (zone: any) => {
          const zoneData = await FirebaseDatabaseService.getDocument('zones', zone.id) as any

          const members = isHQGroup(zone.id)
            ? await HQMembersService.getHQGroupMembers(zone.id)
            : await FirebaseDatabaseService.getCollectionWhere('zone_members', 'zoneId', '==', zone.id)

          return {
            ...zone,
            memberCount: members.length,
            maxMembers: zoneData?.maxMembers || (isHQGroup(zone.id) ? 999999 : 20),
            subscriptionTier: isHQGroup(zone.id) ? 'unlimited' : (zoneData?.subscriptionTier || 'free'),
            subscriptionStatus: isHQGroup(zone.id) ? 'active' : (zoneData?.subscriptionStatus || 'active'),
            signupLink: this.getZoneSignupLink(zone.invitationCode),
            isHQGroup: isHQGroup(zone.id)
          }
        })
      )

      return zonesWithStats
    } catch (error) {
 console.error('Error getting zones with stats:', error)
      return []
    }
  }

  static async getZoneMembers(zoneId: string) {
    try {
      const members = isHQGroup(zoneId)
        ? await HQMembersService.getHQGroupMembers(zoneId)
        : await FirebaseDatabaseService.getCollectionWhere('zone_members', 'zoneId', '==', zoneId)

      const membersWithProfiles = await Promise.all(
        members.map(async (member: any) => {
          const profile = await FirebaseDatabaseService.getDocument('profiles', member.userId)
          return { ...member, profile }
        })
      )

      return membersWithProfiles
    } catch (error) {
 console.error('Error getting zone members:', error)
      return []
    }
  }

  static async removeMember(memberId: string, zoneId: string) {
    try {
      if (isHQGroup(zoneId)) {
        const parts = memberId.split('_')
        const userId = parts.slice(0, -1).join('_')
        await HQMembersService.removeMember(userId, zoneId)
      } else {
        await FirebaseDatabaseService.deleteDocument('zone_members', memberId)

        const zoneData = await FirebaseDatabaseService.getDocument('zones', zoneId) as any
        if (zoneData) {
          await FirebaseDatabaseService.updateDocument('zones', zoneId, {
            memberCount: Math.max(0, (zoneData.memberCount || 1) - 1),
            updatedAt: new Date()
          })
        }
      }

      return { success: true }
    } catch (error) {
 console.error('Error removing member:', error)
      return { success: false }
    }
  }

  /**
   * Removes ALL membership records for a user in a specific zone.
   * Useful for cleaning up duplicate records.
   */
  static async removeUserFromZone(userId: string, zoneId: string) {
    try {
      if (isHQGroup(zoneId)) {
        // HQ members have deterministic IDs, so duplicates are synonymous with standard removal
        await HQMembersService.removeMember(userId, zoneId)
      } else {
        // 1. Find ALL membership records for this user in this zone
        const members = await FirebaseDatabaseService.getCollectionWhere('zone_members', 'userId', '==', userId);
        const zoneMembers = members.filter((m: any) => m.zoneId === zoneId);

 console.log(`[ZoneInvitation] Found ${zoneMembers.length} records for user ${userId} in zone ${zoneId}`);

        // 2. Delete each one
        let deletedCount = 0;
        for (const member of zoneMembers) {
          await FirebaseDatabaseService.deleteDocument('zone_members', member.id);
          deletedCount++;
        }

        // 3. Update count
        if (deletedCount > 0) {
          const zoneData = await FirebaseDatabaseService.getDocument('zones', zoneId) as any
          if (zoneData) {
            const newCount = Math.max(0, (zoneData.memberCount || 0) - deletedCount);
            await FirebaseDatabaseService.updateDocument('zones', zoneId, {
              memberCount: newCount,
              updatedAt: new Date()
            })
          }
        }
      }

      return { success: true }
    } catch (error) {
 console.error('Error removing user from zone:', error)
      return { success: false }
    }
  }
}
