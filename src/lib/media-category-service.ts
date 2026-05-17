'use client'

import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore'

import { db } from '@/lib/firebase-setup'

export interface MediaCategory {
  id: string
  name: string
  slug: string
  description?: string
  order: number
  createdAt: Date
  updatedAt: Date
}

const COLLECTION = 'media_categories'

export const DEFAULT_CATEGORIES: Omit<MediaCategory, 'id' | 'createdAt' | 'updatedAt'>[] = []

export async function getCategories(): Promise<MediaCategory[]> {
  try {
    const q = query(collection(db, COLLECTION), orderBy('order', 'asc'))
    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
      updatedAt: (doc.data().updatedAt as Timestamp)?.toDate() || new Date()
    })) as MediaCategory[]
  } catch (error) {
 console.error('Error fetching categories:', error)
    return []
  }
}

export async function initializeDefaultCategories(): Promise<void> {
  try {
    for (const cat of DEFAULT_CATEGORIES) {
      await addDoc(collection(db, COLLECTION), {
        ...cat,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    }
  } catch (error) {
 console.error('Error initializing categories:', error)
  }
}

export async function createCategory(name: string, description?: string): Promise<string> {
  try {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const categories = await getCategories()
    const maxOrder = Math.max(...categories.map(c => c.order), 0)

    const docRef = await addDoc(collection(db, COLLECTION), {
      name,
      slug,
      description: description || '',
      order: maxOrder + 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    return docRef.id
  } catch (error) {
 console.error('Error creating category:', error)
    throw error
  }
}

export async function updateCategory(
  categoryId: string,
  data: { name?: string; description?: string; order?: number }
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION, categoryId)
    const currentDoc = await getDoc(docRef)
    const currentSlug = currentDoc.data()?.slug

    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: serverTimestamp()
    }

    let newSlug: string | null = null
    if (data.name) {
      newSlug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      updateData.slug = newSlug
    }

    await updateDoc(docRef, updateData)

    if (newSlug && currentSlug && newSlug !== currentSlug) {
      await updateVideosCategory(currentSlug, newSlug)
    }
  } catch (error) {
 console.error('Error updating category:', error)
    throw error
  }
}

async function updateVideosCategory(oldSlug: string, newSlug: string): Promise<number> {
  try {
    const videosRef = collection(db, 'media_videos')
    const q = query(videosRef, where('type', '==', oldSlug))
    const snapshot = await getDocs(q)

    if (snapshot.empty) return 0

    const batchSize = 500
    let updatedCount = 0

    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = writeBatch(db)
      const chunk = snapshot.docs.slice(i, i + batchSize)

      chunk.forEach(docSnap => {
        batch.update(docSnap.ref, {
          type: newSlug,
          updatedAt: serverTimestamp()
        })
      })

      await batch.commit()
      updatedCount += chunk.length
    }

    return updatedCount
  } catch (error) {
 console.error('Error updating videos category:', error)
    throw error
  }
}

export async function deleteCategory(categoryId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION, categoryId))
  } catch (error) {
 console.error('Error deleting category:', error)
    throw error
  }
}
