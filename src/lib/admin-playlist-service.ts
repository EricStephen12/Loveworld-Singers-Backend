import { db, FieldValue, messaging } from './firebase-admin'

export interface AdminPlaylist {
  id: string
  name: string
  description: string
  thumbnail: string
  videoIds: string[]
  childPlaylistIds?: string[] // IDs of nested playlists
  isPublic: boolean
  isFeatured: boolean
  forHQ: boolean // Zone targeting
  zoneId?: string // Link to specific zone
  type?: string // Category type
  createdBy: string
  createdByName: string
  createdAt: any
  updatedAt: any
}

const COLLECTION = 'admin_playlists'

// Get all admin playlists
export async function getAdminPlaylists(): Promise<AdminPlaylist[]> {
  try {
    const snapshot = await db.collection(COLLECTION).orderBy('createdAt', 'desc').get()
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate?.() || new Date()
    })) as AdminPlaylist[]
  } catch (error) {
    console.error('Error fetching admin playlists:', error)
    return []
  }
}

// Get public playlists
export async function getPublicAdminPlaylists(isHQZone: boolean, currentZoneId?: string, categoryType?: string): Promise<AdminPlaylist[]> {
  try {
    const snapshot = await db.collection(COLLECTION)
      .where('isPublic', '==', true)
      .orderBy('createdAt', 'desc')
      .get()

    let allPlaylists = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate?.() || new Date()
    })) as AdminPlaylist[]

    // Collect nested playlist IDs
    const nestedPlaylistIds = new Set<string>()
    allPlaylists.forEach(p => {
      p.childPlaylistIds?.forEach(childId => nestedPlaylistIds.add(childId))
    })

    // Filter by zone and exclude nested
    let filtered = allPlaylists.filter(p => {
      if (nestedPlaylistIds.has(p.id)) return false
      if (isHQZone) {
        return p.forHQ === true
      } else {
        return p.forHQ === false && (!p.zoneId || p.zoneId === currentZoneId)
      }
    })

    if (categoryType && categoryType !== 'all') {
      filtered = filtered.filter(p => p.type === categoryType)
    }

    return filtered
  } catch (error) {
    console.error('Error fetching public playlists:', error)
    return []
  }
}

// Get featured playlists
export async function getFeaturedPlaylists(isHQZone: boolean): Promise<AdminPlaylist[]> {
  try {
    const snapshot = await db.collection(COLLECTION)
      .where('isFeatured', '==', true)
      .where('forHQ', '==', isHQZone)
      .orderBy('createdAt', 'desc')
      .get()
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate?.() || new Date()
    })) as AdminPlaylist[]
  } catch (error) {
    console.error('Error fetching featured playlists:', error)
    return []
  }
}

// Get single playlist
export async function getAdminPlaylist(id: string): Promise<AdminPlaylist | null> {
  try {
    const snapshot = await db.collection(COLLECTION).doc(id).get()
    if (!snapshot.exists) return null
    const data = snapshot.data() || {}
    return {
      id: snapshot.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || new Date()
    } as AdminPlaylist
  } catch (error) {
    console.error('Error fetching playlist:', error)
    return null
  }
}

// Create playlist
export async function createAdminPlaylist(data: {
  name: string
  description?: string
  thumbnail?: string
  isPublic?: boolean
  isFeatured?: boolean
  forHQ?: boolean
  zoneId?: string
  type?: string
  createdBy: string
  createdByName: string
}): Promise<string> {
  try {
    const now = FieldValue.serverTimestamp()
    const docRef = await db.collection(COLLECTION).add({
      name: data.name,
      description: data.description || '',
      thumbnail: data.thumbnail || '',
      videoIds: [],
      isPublic: data.isPublic ?? true,
      isFeatured: data.isFeatured ?? false,
      forHQ: data.forHQ ?? true,
      zoneId: data.zoneId || null,
      type: data.type || null,
      createdBy: data.createdBy,
      createdByName: data.createdByName,
      createdAt: now,
      updatedAt: now
    })

    if (data.isPublic !== false) {
      triggerPlaylistNotification(docRef.id, data.name, data.forHQ ?? true).catch(err => {
        console.error('[PlaylistNotif] Notification error:', err)
      })
    }

    return docRef.id
  } catch (error) {
    console.error('Error creating playlist:', error)
    throw error
  }
}

// Helper to trigger playlist notification using Admin Messaging
async function triggerPlaylistNotification(playlistId: string, name: string, forHQ: boolean) {
  try {
    const topic = forHQ ? 'hq_members' : 'zone_members'
    
    // Instead of fetching all users (expensive), we use topics
    // If topics aren't set up, we'd need a different approach, but this is best practice
    const message = {
      notification: {
        title: 'New Playlist',
        body: `Check out the new playlist: "${name}"`
      },
      data: {
        type: 'media',
        playlistId: playlistId
      },
      topic: topic
    }

    await messaging.send(message)
    console.log(`[PlaylistNotif] Notification sent to topic: ${topic}`)
  } catch (err) {
    console.error('Error in triggerPlaylistNotification:', err)
  }
}

export async function updateAdminPlaylist(
  id: string,
  data: Partial<Omit<AdminPlaylist, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  try {
    const cleanData: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleanData[key] = value
      }
    }
    await db.collection(COLLECTION).doc(id).update({
      ...cleanData,
      updatedAt: FieldValue.serverTimestamp()
    })
  } catch (error) {
    console.error('Error updating playlist:', error)
    throw error
  }
}

// Delete playlist
export async function deleteAdminPlaylist(id: string): Promise<void> {
  try {
    await db.collection(COLLECTION).doc(id).delete()
  } catch (error) {
    console.error('Error deleting playlist:', error)
    throw error
  }
}

// Add video to playlist
export async function addVideoToPlaylist(playlistId: string, videoId: string): Promise<void> {
  try {
    const playlist = await getAdminPlaylist(playlistId)
    if (!playlist) throw new Error('Playlist not found')

    if (!playlist.videoIds.includes(videoId)) {
      await updateAdminPlaylist(playlistId, {
        videoIds: [...playlist.videoIds, videoId]
      })
    }
  } catch (error) {
    console.error('Error adding video to playlist:', error)
    throw error
  }
}

// Remove video from playlist
export async function removeVideoFromPlaylist(playlistId: string, videoId: string): Promise<void> {
  try {
    const playlist = await getAdminPlaylist(playlistId)
    if (!playlist) throw new Error('Playlist not found')

    await updateAdminPlaylist(playlistId, {
      videoIds: playlist.videoIds.filter(id => id !== videoId)
    })
  } catch (error) {
    console.error('Error removing video from playlist:', error)
    throw error
  }
}

// Reorder videos in playlist
export async function reorderPlaylistVideos(playlistId: string, videoIds: string[]): Promise<void> {
  try {
    await updateAdminPlaylist(playlistId, { videoIds })
  } catch (error) {
    console.error('Error reordering playlist:', error)
    throw error
  }
}

// Add child playlist to parent playlist
export async function addChildPlaylist(parentId: string, childId: string): Promise<void> {
  try {
    if (parentId === childId) throw new Error('Cannot add playlist to itself')

    const parent = await getAdminPlaylist(parentId)
    if (!parent) throw new Error('Parent playlist not found')

    const child = await getAdminPlaylist(childId)
    if (!child) throw new Error('Child playlist not found')

    if (child.childPlaylistIds?.includes(parentId)) {
      throw new Error('Cannot create circular playlist reference')
    }

    const currentChildren = parent.childPlaylistIds || []
    if (!currentChildren.includes(childId)) {
      await updateAdminPlaylist(parentId, {
        childPlaylistIds: [...currentChildren, childId]
      })
    }
  } catch (error) {
    console.error('Error adding child playlist:', error)
    throw error
  }
}

// Remove child playlist from parent
export async function removeChildPlaylist(parentId: string, childId: string): Promise<void> {
  try {
    const parent = await getAdminPlaylist(parentId)
    if (!parent) throw new Error('Playlist not found')

    await updateAdminPlaylist(parentId, {
      childPlaylistIds: (parent.childPlaylistIds || []).filter(id => id !== childId)
    })
  } catch (error) {
    console.error('Error removing child playlist:', error)
    throw error
  }
}

// Get playlists that can be added as children
export async function getAddableChildPlaylists(parentId: string): Promise<AdminPlaylist[]> {
  try {
    const allPlaylists = await getAdminPlaylists()
    const parent = await getAdminPlaylist(parentId)
    if (!parent) return []

    const existingChildren = parent.childPlaylistIds || []

    return allPlaylists.filter(p => {
      if (p.id === parentId) return false
      if (existingChildren.includes(p.id)) return false
      if (p.childPlaylistIds?.includes(parentId)) return false
      return true
    })
  } catch (error) {
    console.error('Error getting addable playlists:', error)
    return []
  }
}
