import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore'
import { db } from './firebase-setup'
import { isHQGroup } from '@/config/zones'

// Types

export interface ScheduleCategory {
    id: string
    zoneId: string | null
    label: string
    description: string
    icon: string        // lucide icon name e.g. "Music"
    color: string       // tailwind bg class e.g. "bg-purple-100"
    iconColor: string   // tailwind text class e.g. "text-purple-600"
    order: number
    isActive: boolean
    parentId?: string   // For nested folders/categories
    createdAt: string
    updatedAt: string
    createdBy: string
    spreadsheetData?: SpreadsheetData
}

export interface ScheduleSong {
    id: string
    zoneId: string | null
    categoryId: string
    type?: 'song' | 'activity' | 'title'
    title: string
    comment?: string
    writer: string
    leadSinger: string
    rehearsalCount: number
    dateReceived: string
    order: number
    date?: string       // YYYY-MM-DD
    createdAt: string
    updatedAt: string
    createdBy: string
}

export interface GridCell {
    value: string
    bold?: boolean
    italic?: boolean
    align?: 'left' | 'center' | 'right'
    color?: string
}

export interface SpreadsheetData {
    columns: { width: number; label?: string }[]
    rows: { height: number; label?: string }[]
    data: Record<string, GridCell> // key is "row:col"
}

export interface ScheduleProgram {
    id?: string
    zoneId: string | null
    categoryId?: string // For generic sub-categories
    program: string
    date: string        // YYYY-MM-DD (also serves as a logical sort key for dates)
    time: string
    dailyTarget: string
    spreadsheetData?: SpreadsheetData

    updatedAt: string
    updatedBy: string
}

// Helpers

function isHQ(zoneId?: string | null): boolean {
    if (!zoneId) return true
    return isHQGroup(zoneId)
}

function toDate(val: any): string {
    if (!val) return new Date().toISOString()
    if (val?.toDate) return val.toDate().toISOString()
    return String(val)
}

// Category Service

export class ScheduleCategoryService {

    static async getCategories(zoneId?: string | null): Promise<ScheduleCategory[]> {
        try {
            const ref = collection(db, 'schedule_categories')
            const q = isHQ(zoneId)
                ? query(ref, where('isActive', '==', true))
                : query(ref, where('zoneId', '==', zoneId), where('isActive', '==', true))

            const snap = await getDocs(q)
            return snap.docs
                .map(d => {
                    const data = d.data()
                    return {
                        ...data,
                        id: d.id,
                        createdAt: toDate(data.createdAt),
                        updatedAt: toDate(data.updatedAt),
                    } as ScheduleCategory
                })
                .sort((a, b) => (a.order || 0) - (b.order || 0))
        } catch (error) {
 console.error('Error getting schedule categories:', error)
            return []
        }
    }

    static async addCategory(
        data: Omit<ScheduleCategory, 'id' | 'createdAt' | 'updatedAt'>,
        zoneId?: string | null
    ): Promise<string | null> {
        try {
            const ref = collection(db, 'schedule_categories')
            const docRef = await addDoc(ref, {
                ...data,
                zoneId: isHQ(zoneId) ? null : zoneId,
                isActive: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            })
            return docRef.id
        } catch (error) {
 console.error('Error adding schedule category:', error)
            alert(`Error adding category: ${error}`)
            return null
        }
    }

    static async updateCategory(
        id: string,
        data: Partial<Omit<ScheduleCategory, 'id' | 'createdAt'>>
    ): Promise<boolean> {
        try {
            const ref = doc(db, 'schedule_categories', id)
            await updateDoc(ref, { ...data, updatedAt: serverTimestamp() })
            return true
        } catch (error) {
 console.error('Error updating schedule category:', error)
            return false
        }
    }

    static async deleteCategory(id: string): Promise<boolean> {
        try {
            const ref = doc(db, 'schedule_categories', id)
            await updateDoc(ref, { isActive: false, updatedAt: serverTimestamp() })
            return true
        } catch (error) {
 console.error('Error deleting schedule category:', error)
            return false
        }
    }
}

// Song Service

export class ScheduleSongService {

    static async getSongs(categoryId: string, zoneId?: string | null, date?: string): Promise<ScheduleSong[]> {
        try {
            const ref = collection(db, 'schedule_songs')
            let q = query(ref, where('categoryId', '==', categoryId))

            if (!isHQ(zoneId)) {
                q = query(q, where('zoneId', '==', zoneId))
            }

            // Filter by date if provided, otherwise assume general/daily
            if (date) {
                q = query(q, where('date', '==', date))
            } else {
                // Legacy support or "General" songs? 
                // For now, if no date is passed, we might get songs with NO date (if we allow that).
                // But typically we should always pass date for daily schedule.
                // Let's assume if date is missing, we fetch songs with NO date field (legacy).
                // Or we can just ignore date filter (fetch all).
                // The prompt implies we want date-specific. 
                // Let's filter by date ONLY if provided.
            }

            const snap = await getDocs(q)
            return snap.docs
                .map(d => {
                    const data = d.data()
                    return {
                        ...data,
                        id: d.id,
                        createdAt: toDate(data.createdAt),
                        updatedAt: toDate(data.updatedAt),
                        dateReceived: toDate(data.dateReceived),
                    } as ScheduleSong
                })
                .sort((a, b) => (a.order || 0) - (b.order || 0))
        } catch (error) {
 console.error('Error getting schedule songs:', error)
            return []
        }
    }

    static async addSong(
        data: Omit<ScheduleSong, 'id' | 'createdAt' | 'updatedAt'>,
        zoneId?: string | null
    ): Promise<string | null> {
        try {
            const ref = collection(db, 'schedule_songs')
            const docRef = await addDoc(ref, {
                ...data, // data should include 'date' now
                zoneId: isHQ(zoneId) ? null : zoneId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                dateReceived: data.dateReceived || new Date().toISOString(),
            })
            return docRef.id
        } catch (error) {
 console.error('Error adding schedule song:', error)
            alert(`Error adding song: ${error}`)
            return null
        }
    }

    static async updateSong(
        id: string,
        data: Partial<Omit<ScheduleSong, 'id' | 'createdAt'>>
    ): Promise<boolean> {
        try {
            const ref = doc(db, 'schedule_songs', id)
            await updateDoc(ref, { ...data, updatedAt: serverTimestamp() })
            return true
        } catch (error) {
 console.error('Error updating schedule song:', error)
            return false
        }
    }

    static async deleteSong(id: string): Promise<boolean> {
        try {
            const ref = doc(db, 'schedule_songs', id)
            await deleteDoc(ref)
            return true
        } catch (error) {
 console.error('Error deleting schedule song:', error)
            return false
        }
    }
}

// Program Service

export class ScheduleProgramService {

    private static getProgramDocId(zoneId?: string | null, date?: string, categoryId?: string): string {
        const dateSuffix = date ? `_${date}` : ''
        const catSuffix = categoryId ? `_cat_${categoryId}` : ''
        return isHQ(zoneId) ? `hq_program${catSuffix}${dateSuffix}` : `zone_${zoneId}_program${catSuffix}${dateSuffix}`
    }

    static async getProgram(zoneId?: string | null, date?: string, categoryId?: string): Promise<ScheduleProgram | null> {
        try {
            const docId = this.getProgramDocId(zoneId, date, categoryId)
            const ref = doc(db, 'schedule_programs', docId)
            const snap = await getDoc(ref)
            if (!snap.exists()) return null
            const data = snap.data()
            return {
                ...data,
                id: snap.id,
                updatedAt: toDate(data.updatedAt),
            } as ScheduleProgram
        } catch (error) {
 console.error('Error getting schedule program:', error)
            return null
        }
    }

    static async getAllPrograms(zoneId?: string | null): Promise<ScheduleProgram[]> {
        try {
            const ref = collection(db, 'schedule_programs')
            let q = query(ref)

            if (!isHQ(zoneId)) {
                q = query(q, where('zoneId', '==', zoneId))
            }

            const snap = await getDocs(q)
            return snap.docs.map(d => {
                const data = d.data()
                return {
                    ...data,
                    id: d.id,
                    updatedAt: toDate(data.updatedAt),
                } as ScheduleProgram
            }).sort((a, b) => {
                const timeA = new Date(a.date).getTime();
                const timeB = new Date(b.date).getTime();
                if (!isNaN(timeA) && !isNaN(timeB)) {
                    return timeB - timeA;
                }
                return (b.date || "").localeCompare(a.date || "");
            })
        } catch (error) {
 console.error('Error getting all programs:', error)
            return []
        }
    }

    static async updateProgram(
        data: Omit<ScheduleProgram, 'id' | 'updatedAt'>,
        zoneId?: string | null,
        date?: string
    ): Promise<boolean> {
        try {
            const docId = this.getProgramDocId(zoneId, date, data.categoryId)
            const ref = doc(db, 'schedule_programs', docId)

            const cleanUndefined = (o: any): any => {
                if (o === undefined) return null;
                if (o === null) return null;
                if (typeof o !== 'object') return o;
                if (Array.isArray(o)) return o.map(i => i === undefined ? null : cleanUndefined(i));
                const res: any = {};
                for (const k in o) {
                    if (o[k] !== undefined) {
                        res[k] = cleanUndefined(o[k]);
                    }
                }
                return res;
            }

            const cleanData = cleanUndefined(data);

            await setDoc(ref, {
                ...cleanData,
                zoneId: isHQ(zoneId) ? null : zoneId,
                updatedAt: serverTimestamp(),
            }, { merge: true })
            return true
        } catch (error) {
 console.error('Error updating schedule program:', error)
            return false
        }
    }

    static async deleteProgram(zoneId?: string | null, date?: string, categoryId?: string): Promise<boolean> {
        try {
            const docId = this.getProgramDocId(zoneId, date, categoryId)
            const ref = doc(db, 'schedule_programs', docId)
            await deleteDoc(ref)
            return true
        } catch (error) {
 console.error('Error deleting schedule program:', error)
            return false
        }
    }
}
