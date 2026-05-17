import { db, FieldValue } from './firebase-admin'

export async function updateUserPresence(userId: string, status: 'online' | 'offline'): Promise<void> {
  if (!userId) return
  try {
    const ref = db.collection('presence').doc(userId)
    await ref.set({ 
      status, 
      lastSeen: FieldValue.serverTimestamp() 
    }, { merge: true })
  } catch (err: any) {
    if (err?.code === 7) { // 7 is PERMISSION_DENIED in gRPC/Admin SDK
      return;
    }
    console.error('[PresenceService] update error:', err)
  }
}

export function subscribeToUserPresence(userId: string, callback: (presence: { status: 'online' | 'offline', lastSeen: any }) => void): () => void {
  if (!userId) {
    callback({ status: 'offline', lastSeen: null })
    return () => {}
  }
  
  return db.collection('presence').doc(userId).onSnapshot((d) => {
    if (d.exists) {
      callback(d.data() as any)
    } else {
      callback({ status: 'offline', lastSeen: null })
    }
  }, (err) => {
    console.warn('[PresenceService] subscribe error:', err)
    callback({ status: 'offline', lastSeen: null })
  })
}
