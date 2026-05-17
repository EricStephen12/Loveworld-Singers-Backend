import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider,
  deleteUser, setPersistence, browserLocalPersistence
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'

import { auth, db } from './firebase-setup'
import { SessionManager } from './session-manager'
import { ErrorHandler } from './error-handler'
import { SimplifiedAnalyticsService } from './simplified-analytics-service'

export class FirebaseAuthService {
  static async signIn(email: string, password: string, rememberMe: boolean = true) {
    try {
      const emailError = ErrorHandler.validateEmail(email)
      if (emailError) {
        return { user: null, error: emailError, userFriendly: true }
      }

      const passwordError = ErrorHandler.validatePassword(password)
      if (passwordError) {
        return { user: null, error: passwordError, userFriendly: true }
      }

      await setPersistence(auth, browserLocalPersistence)
      const result = await signInWithEmailAndPassword(auth, email, password)

      // Kick-Out Strategy: Always allow login, overwrite previous session
      await SessionManager.createSession(result.user)

      // Track login analytics
      try {
        await SimplifiedAnalyticsService.incrementLogins(1)
        // Track user location
        SimplifiedAnalyticsService.trackUserLocation() // Fire and forget
      } catch (analyticsError) {
 console.error('Analytics tracking failed:', analyticsError)
      }

      if (rememberMe && typeof window !== 'undefined') {
        const token = await result.user.getIdToken()
        localStorage.setItem('authToken', token)
        localStorage.setItem('userEmail', email)
        localStorage.setItem('userId', result.user.uid)
        localStorage.setItem('lastLoginTime', Date.now().toString())
      }

      return { user: result.user, error: null }
    } catch (error: any) {
      const friendlyError = ErrorHandler.getErrorMessage(error, 'auth')
      return { user: null, error: friendlyError, userFriendly: true }
    }
  }

  static async signUp(email: string, password: string, userData: any) {
    try {
      await setPersistence(auth, browserLocalPersistence)
      const result = await createUserWithEmailAndPassword(auth, email, password)

      await setDoc(doc(db, 'profiles', result.user.uid), {
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      // Track signup analytics
      try {
        await SimplifiedAnalyticsService.incrementSignups(1)
        // Track user location
        SimplifiedAnalyticsService.trackUserLocation() // Fire and forget
      } catch (analyticsError) {
 console.error('Analytics tracking failed:', analyticsError)
      }

      return { user: result.user, error: null }
    } catch (error: any) {
      return { user: null, error: error.message }
    }
  }

  static async signOut() {
    try {
      const currentUser = auth.currentUser
      if (currentUser) {
        await SessionManager.endSession(currentUser.uid)
      }
      await signOut(auth)
      return { error: null, success: true }
    } catch (error: any) {
      const friendlyError = ErrorHandler.getErrorMessage(error, 'auth')
      return { error: friendlyError, success: false }
    }
  }

  static getCurrentUser(): User | null {
    return auth.currentUser
  }

  static onAuthStateChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback)
  }

  static async ensurePersistence() {
    try {
      await setPersistence(auth, browserLocalPersistence)
      return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          unsubscribe()
          resolve(user)
        })
      })
    } catch (error) {
 console.error('Failed to set auth persistence:', error)
    }
  }

  static async checkPersistenceStatus() {
    try {
      const currentUser = auth.currentUser
      return {
        hasUser: !!currentUser,
        userEmail: currentUser?.email || null,
        persistenceSet: true,
        message: currentUser ? 'User will stay signed in' : 'No user signed in'
      }
    } catch (error) {
      return {
        hasUser: false,
        userEmail: null,
        persistenceSet: false,
        message: 'Error checking persistence'
      }
    }
  }

  static async getUserProfile(userId: string) {
    try {
      const docRef = doc(db, 'profiles', userId)
      const docSnap = await getDoc(docRef)
      return docSnap.exists() ? docSnap.data() : null
    } catch (error) {
 console.error('Error getting user profile:', error)
      return null
    }
  }

  static async testConnection() {
    try {
      if (!auth) {
        return { status: 'error', message: 'Firebase Auth not initialized' }
      }
      const currentUser = auth.currentUser
      return {
        status: 'success',
        message: 'Firebase Auth connected successfully',
        currentUser: currentUser ? 'User logged in' : 'No user logged in'
      }
    } catch (error: any) {
      return { status: 'error', message: error.message }
    }
  }

  static async createUserWithEmailAndPassword(email: string, password: string, userData?: any) {
    try {
      await setPersistence(auth, browserLocalPersistence)
      const result = await createUserWithEmailAndPassword(auth, email, password)

      try {
        if (userData && Object.keys(userData).length > 0) {
          const profileData = {
            id: result.user.uid,
            email: result.user.email,
            profile_completed: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...userData
          }
          await setDoc(doc(db, 'profiles', result.user.uid), profileData)
        }

        // Track signup analytics
        try {
          await SimplifiedAnalyticsService.incrementSignups(1)
        } catch (analyticsError) {
 console.error('Analytics tracking failed:', analyticsError)
        }

        return { user: result.user, error: null }
      } catch (profileError: any) {
        try {
 console.error('Failed to create profile, deleting auth user:', profileError)
          await deleteUser(result.user)
        } catch (cleanupError) {
 console.error('Failed to delete auth user after profile error:', cleanupError)
        }
        return { user: null, error: profileError?.message || 'Failed to complete signup. Please check your connection and try again.' }
      }
    } catch (error: any) {
      return { user: null, error: error.message }
    }
  }

  static async signInWithEmailAndPassword(email: string, password: string, rememberMe: boolean = true) {
    return this.signIn(email, password, rememberMe)
  }

  static async autoLogin(): Promise<{ user: User | null, error: string | null }> {
    try {
      if (typeof window === 'undefined') {
        return { user: null, error: 'Not in browser' }
      }

      const isLoggingOut = localStorage.getItem('isLoggingOut') === 'true' ||
        localStorage.getItem('logging_out') === 'true'
      const urlParams = new URLSearchParams(window.location.search)
      const logoutFromUrl = urlParams.get('logout') === 'true'

      if (isLoggingOut || logoutFromUrl) {
        return { user: null, error: 'Logout in progress' }
      }

      const authToken = localStorage.getItem('authToken')
      const userId = localStorage.getItem('userId')
      const lastLoginTime = localStorage.getItem('lastLoginTime')

      if (!authToken || !userId || !lastLoginTime) {
        return { user: null, error: 'No stored credentials' }
      }

      const tokenAge = Date.now() - parseInt(lastLoginTime)
      const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
      if (tokenAge > maxAge) {
        localStorage.removeItem('authToken')
        localStorage.removeItem('userId')
        localStorage.removeItem('userEmail')
        localStorage.removeItem('lastLoginTime')
        return { user: null, error: 'Token expired' }
      }

      const currentUser = auth.currentUser
      if (currentUser && currentUser.uid === userId) {
        return { user: currentUser, error: null }
      }

      return { user: null, error: 'Session expired - please login again' }
    } catch (error: any) {
 console.error('Auto-login failed:', error)
      return { user: null, error: error.message }
    }
  }

  static async resetPassword(email: string) {
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth')
      const actionCodeSettings = (typeof window !== 'undefined') ? {
        url: `${window.location.origin}/auth/reset-password`,
        handleCodeInApp: true
      } : undefined as any

      await sendPasswordResetEmail(auth, email, actionCodeSettings)
      return { error: null }
    } catch (error: any) {
      return { error: error.message }
    }
  }

  static async verifyPasswordResetCode(oobCode: string) {
    try {
      const { verifyPasswordResetCode } = await import('firebase/auth')
      const email = await verifyPasswordResetCode(auth, oobCode)
      return { email, error: null }
    } catch (error: any) {
      return { email: null, error: error.message }
    }
  }

  static async confirmPasswordReset(oobCode: string, newPassword: string) {
    try {
      const { confirmPasswordReset } = await import('firebase/auth')
      await confirmPasswordReset(auth, oobCode, newPassword)
      return { error: null }
    } catch (error: any) {
      return { error: error.message }
    }
  }

  static async updatePassword(newPassword: string) {
    try {
      const { updatePassword } = await import('firebase/auth')
      const user = auth.currentUser
      if (!user) throw new Error('No user logged in')
      await updatePassword(user, newPassword)
      return { error: null }
    } catch (error: any) {
      return { error: error.message }
    }
  }

  static async signInWithGoogle() {
    try {
      await setPersistence(auth, browserLocalPersistence)
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)

      const userProfile = await this.getUserProfile(result.user.uid)

      if (!userProfile) {
        const displayName = result.user.displayName || ''
        const nameParts = displayName.split(' ')
        await setDoc(doc(db, 'profiles', result.user.uid), {
          id: result.user.uid,
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
          email: result.user.email,
          profile_completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }

      return { user: result.user, error: null }
    } catch (error: any) {
      return { user: null, error: error.message }
    }
  }

  static async deleteUser() {
    try {
      const user = auth.currentUser
      if (!user) throw new Error('No user logged in')
      await deleteUser(user)
      return { success: true, error: null }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}
