import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  limit as firestoreLimit,
  startAfter,
  QueryDocumentSnapshot
} from 'firebase/firestore'

import { db } from './firebase-setup'
import { isHQGroup } from '@/config/zones'

const mediaCache: Map<string, { data: CloudinaryMediaFile[]; timestamp: number; lastDoc: QueryDocumentSnapshot | null }> = new Map()
const MEDIA_CACHE_TTL = 5 * 60 * 1000

function getCollectionName(zoneId?: string): string {
  return (zoneId && isHQGroup(zoneId)) ? 'cloudinary_media' : 'zone_cloudinary_media'
}

export interface CloudinaryMediaFile {
  id: string
  name: string
  url: string
  publicId: string
  resourceType: 'image' | 'video' | 'raw'
  type: 'image' | 'audio' | 'video' | 'document'
  size: number
  folder: string
  format?: string
  width?: number
  height?: number
  duration?: number
  zoneId?: string
  createdAt: string
  updatedAt: string
}

export interface CloudinaryUploadOptions {
  folder?: string
  resourceType?: 'image' | 'video' | 'raw' | 'auto'
  publicId?: string
}

export interface CloudinaryUploadResult {
  success: boolean
  url?: string
  publicId?: string
  error?: string
}

export async function uploadToCloudinary(
  file: File,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> {
  try {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

    if (!cloudName || !uploadPreset) {
 console.error('[Cloudinary] Missing cloud name or upload preset')
      return { success: false, error: 'Cloudinary not configured' }
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', uploadPreset)

    if (options.folder) formData.append('folder', options.folder)
    if (options.publicId) formData.append('public_id', options.publicId)

    const resourceType = options.resourceType || 'auto'
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`

    const response = await fetch(uploadUrl, { method: 'POST', body: formData })

    if (!response.ok) {
      const errorText = await response.text()
 console.error('[Cloudinary] Upload failed:', errorText)
      return { success: false, error: `Upload failed: ${response.status}` }
    }

    const data = await response.json()
    return { success: true, url: data.secure_url, publicId: data.public_id }
  } catch (error) {
 console.error('[Cloudinary] Upload error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Upload failed' }
  }
}

function mapDocToFile(doc: any): CloudinaryMediaFile {
  const data = doc.data()
  return {
    ...data,
    id: doc.id,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
  }
}

export async function getAllCloudinaryMedia(
  zoneId?: string,
  limitCount: number = 500,
  forceRefresh: boolean = false
): Promise<CloudinaryMediaFile[]> {
  try {
    const cacheKey = zoneId || 'global'
    const cached = mediaCache.get(cacheKey)

    if (!forceRefresh && cached && Date.now() - cached.timestamp < MEDIA_CACHE_TTL) {
      return cached.data
    }

    const collectionName = getCollectionName(zoneId)
    const mediaRef = collection(db, collectionName)

    const q = (zoneId && !isHQGroup(zoneId))
      ? query(mediaRef, where('zoneId', '==', zoneId), orderBy('createdAt', 'desc'), firestoreLimit(limitCount))
      : query(mediaRef, orderBy('createdAt', 'desc'), firestoreLimit(limitCount))

    const snapshot = await getDocs(q)
    const files = snapshot.docs.map(mapDocToFile)
    files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
    mediaCache.set(cacheKey, { data: files, timestamp: Date.now(), lastDoc })

    return files
  } catch (error) {
 console.error('Error getting media files:', error)
    return []
  }
}

export async function loadMoreCloudinaryMedia(
  zoneId?: string,
  limitCount: number = 500
): Promise<CloudinaryMediaFile[]> {
  try {
    const cacheKey = zoneId || 'global'
    const cached = mediaCache.get(cacheKey)

    if (!cached?.lastDoc) return []

    const collectionName = getCollectionName(zoneId)
    const mediaRef = collection(db, collectionName)

    const q = (zoneId && !isHQGroup(zoneId))
      ? query(mediaRef, where('zoneId', '==', zoneId), orderBy('createdAt', 'desc'), startAfter(cached.lastDoc), firestoreLimit(limitCount))
      : query(mediaRef, orderBy('createdAt', 'desc'), startAfter(cached.lastDoc), firestoreLimit(limitCount))

    const snapshot = await getDocs(q)
    const files = snapshot.docs.map(mapDocToFile)
    files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
    mediaCache.set(cacheKey, { data: [...cached.data, ...files], timestamp: Date.now(), lastDoc })

    return files
  } catch (error) {
 console.error('Error loading more media files:', error)
    return []
  }
}

export function hasMoreCloudinaryMedia(zoneId?: string): boolean {
  const cacheKey = zoneId || 'global'
  const cached = mediaCache.get(cacheKey)
  return cached?.lastDoc !== null && cached?.lastDoc !== undefined
}

export function clearCloudinaryMediaCache(zoneId?: string): void {
  if (zoneId) {
    mediaCache.delete(zoneId)
    mediaCache.delete('global')
  } else {
    mediaCache.clear()
  }
}

// Cache for type-specific queries
const typeMediaCache: Map<string, { data: CloudinaryMediaFile[]; timestamp: number; lastDoc: QueryDocumentSnapshot | null }> = new Map()

export async function getCloudinaryMediaByType(
  type: 'image' | 'audio' | 'video' | 'document',
  zoneId?: string,
  limitCount: number = 500,
  forceRefresh: boolean = false
): Promise<CloudinaryMediaFile[]> {
  try {
    const cacheKey = `${zoneId || 'global'}_${type}`
    const cached = typeMediaCache.get(cacheKey)

    if (!forceRefresh && cached && Date.now() - cached.timestamp < MEDIA_CACHE_TTL) {
      return cached.data
    }

    const collectionName = getCollectionName(zoneId)
    const mediaRef = collection(db, collectionName)

    const q = (zoneId && !isHQGroup(zoneId))
      ? query(mediaRef, where('zoneId', '==', zoneId), where('type', '==', type), orderBy('createdAt', 'desc'), firestoreLimit(limitCount))
      : query(mediaRef, where('type', '==', type), orderBy('createdAt', 'desc'), firestoreLimit(limitCount))

    const snapshot = await getDocs(q)
    const files = snapshot.docs.map(mapDocToFile)

    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
    typeMediaCache.set(cacheKey, { data: files, timestamp: Date.now(), lastDoc })

    return files
  } catch (error) {
 console.error(`Error getting ${type} files:`, error)
    return []
  }
}

export async function loadMoreCloudinaryMediaByType(
  type: 'image' | 'audio' | 'video' | 'document',
  zoneId?: string,
  limitCount: number = 500
): Promise<CloudinaryMediaFile[]> {
  try {
    const cacheKey = `${zoneId || 'global'}_${type}`
    const cached = typeMediaCache.get(cacheKey)

    if (!cached?.lastDoc) return []

    const collectionName = getCollectionName(zoneId)
    const mediaRef = collection(db, collectionName)

    const q = (zoneId && !isHQGroup(zoneId))
      ? query(mediaRef, where('zoneId', '==', zoneId), where('type', '==', type), orderBy('createdAt', 'desc'), startAfter(cached.lastDoc), firestoreLimit(limitCount))
      : query(mediaRef, where('type', '==', type), orderBy('createdAt', 'desc'), startAfter(cached.lastDoc), firestoreLimit(limitCount))

    const snapshot = await getDocs(q)
    const files = snapshot.docs.map(mapDocToFile)

    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
    typeMediaCache.set(cacheKey, { data: [...cached.data, ...files], timestamp: Date.now(), lastDoc })

    return files
  } catch (error) {
 console.error(`Error loading more ${type} files:`, error)
    return []
  }
}

export function hasMoreCloudinaryMediaByType(type: string, zoneId?: string): boolean {
  const cacheKey = `${zoneId || 'global'}_${type}`
  const cached = typeMediaCache.get(cacheKey)
  return cached?.lastDoc !== null && cached?.lastDoc !== undefined
}

export async function getCloudinaryMediaByFolder(
  folder: string,
  zoneId?: string
): Promise<CloudinaryMediaFile[]> {
  try {
    const collectionName = getCollectionName(zoneId)
    const mediaRef = collection(db, collectionName)

    const q = (zoneId && !isHQGroup(zoneId))
      ? query(mediaRef, where('zoneId', '==', zoneId), where('folder', '==', folder))
      : query(mediaRef, where('folder', '==', folder))

    const snapshot = await getDocs(q)
    const files = snapshot.docs.map(mapDocToFile)
    files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return files
  } catch (error) {
 console.error('Error getting files from folder:', error)
    return []
  }
}

export async function getCloudinaryMediaById(
  id: string,
  zoneId?: string
): Promise<CloudinaryMediaFile | null> {
  try {
    const collectionName = getCollectionName(zoneId)
    const mediaRef = doc(db, collectionName, id)
    const mediaDoc = await getDoc(mediaRef)

    if (!mediaDoc.exists()) return null
    return mapDocToFile(mediaDoc)
  } catch (error) {
 console.error('Error getting media file:', error)
    return null
  }
}

export async function createCloudinaryMedia(
  fileData: Omit<CloudinaryMediaFile, 'id' | 'createdAt' | 'updatedAt'>,
  zoneId?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const collectionName = getCollectionName(zoneId)

    const cleanData = {
      name: fileData.name,
      url: fileData.url,
      publicId: fileData.publicId,
      resourceType: fileData.resourceType,
      type: fileData.type,
      size: fileData.size,
      folder: fileData.folder,
      format: fileData.format || '',
      width: fileData.width || 0,
      height: fileData.height || 0,
      duration: fileData.duration || 0,
      zoneId: zoneId || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    const mediaRef = collection(db, collectionName)
    const docRef = await addDoc(mediaRef, cleanData)
    clearCloudinaryMediaCache(zoneId)

    return { success: true, id: docRef.id }
  } catch (error) {
 console.error('Error creating media file:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create media file' }
  }
}

export async function updateCloudinaryMedia(
  id: string,
  fileData: Partial<Omit<CloudinaryMediaFile, 'id' | 'createdAt' | 'updatedAt'>>,
  zoneId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const collectionName = getCollectionName(zoneId)
    const mediaRef = doc(db, collectionName, id)
    const mediaDoc = await getDoc(mediaRef)

    if (!mediaDoc.exists()) {
      return { success: false, error: 'Media file not found' }
    }

    const cleanedData = Object.entries(fileData).reduce((acc, [key, value]) => {
      if (value !== undefined) acc[key] = value
      return acc
    }, {} as any)

    await updateDoc(mediaRef, { ...cleanedData, updatedAt: serverTimestamp() })
    return { success: true }
  } catch (error) {
 console.error('Error updating media file:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update media file' }
  }
}

export async function deleteCloudinaryMedia(
  id: string,
  zoneId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const collectionName = getCollectionName(zoneId)
    const mediaRef = doc(db, collectionName, id)
    const mediaDoc = await getDoc(mediaRef)

    if (!mediaDoc.exists()) {
      return { success: false, error: 'Media file not found' }
    }

    await deleteDoc(mediaRef)
    clearCloudinaryMediaCache(zoneId)

    return { success: true }
  } catch (error) {
 console.error('Error deleting media file:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete media file' }
  }
}

export async function searchCloudinaryMedia(
  searchTerm: string,
  zoneId?: string,
  isDeepSearch: boolean = false
): Promise<CloudinaryMediaFile[]> {
  try {
    const searchLower = searchTerm.toLowerCase();

    if (isDeepSearch) {
      const collectionName = getCollectionName(zoneId);
      const mediaRef = collection(db, collectionName);

      // Since Firestore prefix search is case-sensitive, we'll try lowercase, Title Case, and UPPERCASE
      const searchTerms = [searchTerm.toLowerCase()];

      const titleCase = searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1).toLowerCase();
      if (!searchTerms.includes(titleCase)) searchTerms.push(titleCase);

      const upperCase = searchTerm.toUpperCase();
      if (!searchTerms.includes(upperCase)) searchTerms.push(upperCase);

      // Perform queries in parallel
      const queryPromises = searchTerms.map(term => {
        // To avoid missing index errors for complex queries, we simplify to just name prefix
        // and filter by zoneId client-side for Deep Search if necessary
        const q = query(
          mediaRef,
          orderBy('name'),
          firestoreLimit(100),
          where('name', '>=', term),
          where('name', '<=', term + '\uf8ff')
        );
        return getDocs(q);
      });

      const snapshots = await Promise.all(queryPromises);
      const allDocs = snapshots.flatMap(s => s.docs);

      // De-duplicate and convert
      const uniqueDocs = new Map();
      allDocs.forEach(doc => {
        const file = mapDocToFile(doc);
        // Client-side zone and type filtering for Deep Search robustness
        const matchesZone = !zoneId || file.zoneId === zoneId || isHQGroup(zoneId);
        if (matchesZone) {
          uniqueDocs.set(doc.id, file);
        }
      });

      return Array.from(uniqueDocs.values());
    }

    const allFiles = await getAllCloudinaryMedia(zoneId);
    return allFiles.filter(file => file.name.toLowerCase().includes(searchLower));
  } catch (error) {
 console.error('Error searching media files:', error);
    return [];
  }
}

export async function getCloudinaryMediaStats(zoneId?: string): Promise<{
  totalFiles: number
  totalSize: number
  byType: Record<string, number>
  byFolder: Record<string, number>
}> {
  try {
    const allFiles = await getAllCloudinaryMedia(zoneId)

    const stats = {
      totalFiles: allFiles.length,
      totalSize: allFiles.reduce((sum, file) => sum + file.size, 0),
      byType: {} as Record<string, number>,
      byFolder: {} as Record<string, number>
    }

    allFiles.forEach(file => {
      stats.byType[file.type] = (stats.byType[file.type] || 0) + 1
      stats.byFolder[file.folder] = (stats.byFolder[file.folder] || 0) + 1
    })

    return stats
  } catch (error) {
 console.error('Error getting statistics:', error)
    return { totalFiles: 0, totalSize: 0, byType: {}, byFolder: {} }
  }
}
