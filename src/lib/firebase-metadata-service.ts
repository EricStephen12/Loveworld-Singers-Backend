import { db, FieldValue } from './firebase-admin'
import { isHQGroup } from '@/config/zones'

/**
 * Service to handle metadata operations for smart caching.
 */
export class FirebaseMetadataService {

    /**
     * Helper to get the correct metadata document ID based on zone.
     */
    private static getMetadataKey(zoneId: string, type: 'praise_nights' | 'songs' | 'page_categories' | 'categories' = 'praise_nights'): string {
        const prefix = isHQGroup(zoneId) ? 'hq' : `zone_${zoneId}`
        return `${prefix}_${type}_metadata`
    }

    /**
     * Helper to get the metadata document ID for a specific song.
     */
    private static getSongMetadataKey(zoneId: string, praiseNightId: string, songId: string): string {
        const prefix = isHQGroup(zoneId) ? 'hq' : `zone_${zoneId}`
        return `${prefix}_song_${praiseNightId}_${songId}`
    }

    /**
     * Helper to get the metadata document ID for a specific praise night's SONG LIST.
     */
    private static getPraiseNightSongsMetadataKey(zoneId: string, praiseNightId: string): string {
        const prefix = isHQGroup(zoneId) ? 'hq' : `zone_${zoneId}`
        return `${prefix}_praise_night_songs_${praiseNightId}`
    }

    /**
     * Updates the metadata timestamp for a specific zone and type.
     */
    static async updateMetadata(zoneId: string, type: 'praise_nights' | 'songs' | 'page_categories' | 'categories' = 'praise_nights') {
        if (!zoneId) return

        try {
            const docId = this.getMetadataKey(zoneId, type)
            await db.collection('sys_metadata').doc(docId).set({
                lastUpdated: FieldValue.serverTimestamp(),
                zoneId,
                type
            }, { merge: true })
        } catch (error) {
            console.error('Error updating metadata:', error)
        }
    }

    /**
     * Updates the metadata timestamp for a specific song.
     */
    static async updateSongMetadata(zoneId: string, praiseNightId: string, songId: string) {
        if (!zoneId || !praiseNightId || !songId) return

        try {
            const docId = this.getSongMetadataKey(zoneId, praiseNightId, songId)
            await db.collection('sys_metadata').doc(docId).set({
                lastUpdated: FieldValue.serverTimestamp(),
                zoneId,
                praiseNightId,
                songId,
                type: 'song'
            }, { merge: true })
        } catch (error) {
            console.error('Error updating song metadata:', error)
        }
    }

    /**
     * Updates the metadata timestamp for a specific praise night's song list.
     */
    static async updatePraiseNightSongsMetadata(zoneId: string, praiseNightId: string) {
        if (!zoneId || !praiseNightId) return

        try {
            const docId = this.getPraiseNightSongsMetadataKey(zoneId, praiseNightId)
            await db.collection('sys_metadata').doc(docId).set({
                lastUpdated: FieldValue.serverTimestamp(),
                zoneId,
                praiseNightId,
                type: 'praise_night_songs'
            }, { merge: true })
        } catch (error) {
            console.error('Error updating page songs metadata:', error)
        }
    }

    /**
     * Force initialize metadata if it doesn't exist.
     */
    static async ensureMetadataExists(zoneId: string, type: 'praise_nights' | 'songs' | 'page_categories' | 'categories' = 'praise_nights') {
        try {
            const docId = this.getMetadataKey(zoneId, type)
            const snap = await db.collection('sys_metadata').doc(docId).get()
            if (!snap.exists) {
                await this.updateMetadata(zoneId, type)
            }
        } catch (e) {
            console.warn('Metadata check failed', e)
        }
    }

    /**
     * Force initialize song metadata if it doesn't exist.
     */
    static async ensureSongMetadataExists(zoneId: string, praiseNightId: string, songId: string) {
        try {
            const docId = this.getSongMetadataKey(zoneId, praiseNightId, songId)
            const snap = await db.collection('sys_metadata').doc(docId).get()
            if (!snap.exists) {
                await this.updateSongMetadata(zoneId, praiseNightId, songId)
            }
        } catch (e) {
            console.warn('Song metadata check failed', e)
        }
    }

    // Listener Registry to prevent 'MaxListenersExceededWarning'
    private static listeners: Map<string, {
        unsubscribe: () => void,
        callbacks: Set<(timestamp: number) => void>,
        lastValue: number
    }> = new Map()

    /**
     * Subscribes to metadata changes for a specific zone.
     * OPTIMIZED: Uses a shared listener per document.
     */
    static subscribeToMetadata(
        zoneId: string,
        type: 'praise_nights' | 'songs' | 'page_categories' | 'categories' = 'praise_nights',
        callback: (timestamp: number) => void
    ) {
        if (!zoneId) return () => { }

        const docId = this.getMetadataKey(zoneId, type)
        const key = `metadata_${docId}`

        const existing = this.listeners.get(key)
        if (existing) {
            existing.callbacks.add(callback)
            callback(existing.lastValue)
            return () => {
                existing.callbacks.delete(callback)
                if (existing.callbacks.size === 0) {
                    existing.unsubscribe()
                    this.listeners.delete(key)
                }
            }
        }

        const callbacks = new Set<((timestamp: number) => void)>()
        callbacks.add(callback)

        const sharedState = {
            unsubscribe: () => { },
            callbacks,
            lastValue: 0
        }

        const unsub = db.collection('sys_metadata').doc(docId).onSnapshot((docSnap) => {
            let timestamp = 0
            if (docSnap.exists) {
                const data = docSnap.data()
                timestamp = data?.lastUpdated?.toMillis?.() || Date.now()
            }
            sharedState.lastValue = timestamp
            sharedState.callbacks.forEach(cb => cb(timestamp))
        }, (error) => {
            console.error(`Error in shared metadata listener [${type}]:`, error)
        })

        sharedState.unsubscribe = unsub
        this.listeners.set(key, sharedState)

        return () => {
            sharedState.callbacks.delete(callback)
            if (sharedState.callbacks.size === 0) {
                sharedState.unsubscribe()
                this.listeners.delete(key)
            }
        }
    }

    /**
     * Subscribes to metadata changes for a specific song.
     * OPTIMIZED: Uses a shared listener.
     */
    static subscribeToSongMetadata(
        zoneId: string,
        praiseNightId: string,
        songId: string,
        callback: (timestamp: number) => void
    ) {
        if (!zoneId || !praiseNightId || !songId) return () => { }

        const docId = this.getSongMetadataKey(zoneId, praiseNightId, songId)
        const key = `song_${docId}`

        const existing = this.listeners.get(key)
        if (existing) {
            existing.callbacks.add(callback)
            callback(existing.lastValue)
            return () => {
                existing.callbacks.delete(callback)
                if (existing.callbacks.size === 0) {
                    existing.unsubscribe()
                    this.listeners.delete(key)
                }
            }
        }

        const callbacks = new Set<((timestamp: number) => void)>()
        callbacks.add(callback)

        const sharedState = {
            unsubscribe: () => { },
            callbacks,
            lastValue: 0
        }

        const unsub = db.collection('sys_metadata').doc(docId).onSnapshot((docSnap) => {
            let timestamp = 0
            if (docSnap.exists) {
                const data = docSnap.data()
                timestamp = data?.lastUpdated?.toMillis?.() || Date.now()
            }
            sharedState.lastValue = timestamp
            sharedState.callbacks.forEach(cb => cb(timestamp))
        }, (error) => {
            console.error(`Error in shared song listener [${songId}]:`, error)
        })

        sharedState.unsubscribe = unsub
        this.listeners.set(key, sharedState)

        return () => {
            sharedState.callbacks.delete(callback)
            if (sharedState.callbacks.size === 0) {
                sharedState.unsubscribe()
                this.listeners.delete(key)
            }
        }
    }

    /**
     * Subscribes to metadata changes for a specific praise night's song list.
     */
    static subscribeToPraiseNightSongsMetadata(
        zoneId: string,
        praiseNightId: string,
        callback: (timestamp: number) => void
    ) {
        if (!zoneId || !praiseNightId) return () => { }

        const docId = this.getPraiseNightSongsMetadataKey(zoneId, praiseNightId)
        const key = `pn_songs_${docId}`

        const existing = this.listeners.get(key)
        if (existing) {
            existing.callbacks.add(callback)
            callback(existing.lastValue)
            return () => {
                existing.callbacks.delete(callback)
                if (existing.callbacks.size === 0) {
                    existing.unsubscribe()
                    this.listeners.delete(key)
                }
            }
        }

        const callbacks = new Set<((timestamp: number) => void)>()
        callbacks.add(callback)

        const sharedState = {
            unsubscribe: () => { },
            callbacks,
            lastValue: 0
        }

        const unsub = db.collection('sys_metadata').doc(docId).onSnapshot((docSnap) => {
            let timestamp = 0
            if (docSnap.exists) {
                const data = docSnap.data()
                timestamp = data?.lastUpdated?.toMillis?.() || Date.now()
            }
            sharedState.lastValue = timestamp
            sharedState.callbacks.forEach(cb => cb(timestamp))
        }, (error) => {
            console.error(`Error in shared pn-songs listener [${praiseNightId}]:`, error)
        })

        sharedState.unsubscribe = unsub
        this.listeners.set(key, sharedState)

        return () => {
            sharedState.callbacks.delete(callback)
            if (sharedState.callbacks.size === 0) {
                sharedState.unsubscribe()
                this.listeners.delete(key)
            }
        }
    }
}
