// KingsChat Authentication Service
import kingsChatWebSdk from 'kingschat-web-sdk'

// TEMPORARY: Hardcode your Client ID here for testing
const HARDCODED_CLIENT_ID = '331c9eda-a130-4bb8-9a00-9231a817207d' // Your KingsChat Client ID

// Try to get from env first, fallback to hardcoded
const KINGSCHAT_CLIENT_ID = process.env.NEXT_PUBLIC_KINGSCHAT_CLIENT_ID || HARDCODED_CLIENT_ID

// Debug: Log what we're using

interface KingsChatAuthTokens {
  accessToken: string
  expiresInMillis: number
  refreshToken: string
}

interface KingsChatUserProfile {
  userId: string
  email?: string
  firstName?: string
  lastName?: string
  profilePicture?: string
}

export class KingsChatAuthService {

  /**
   * Initiate KingsChat login flow
   * Opens KingsChat OAuth popup and returns authentication tokens
   * Browser/PWA flow only
   */
  static async login(): Promise<KingsChatAuthTokens | null> {
    try {
      
      if (!KINGSCHAT_CLIENT_ID || KINGSCHAT_CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
 console.error(' KingsChat Client ID is not configured!')
        alert('KingsChat Client ID is missing. Please configure NEXT_PUBLIC_KINGSCHAT_CLIENT_ID in your .env.local file')
        return null
      }

      // BROWSER/PWA FLOW
      const loginOptions = {
        scopes: ['profile', 'email', 'send_chat_message'], // Request all available scopes
        clientId: KINGSCHAT_CLIENT_ID
      }
      

      const authResponse = await kingsChatWebSdk.login(loginOptions)
      
      
      // Store tokens in localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('kingschat_access_token', authResponse.accessToken)
        localStorage.setItem('kingschat_refresh_token', authResponse.refreshToken)
        localStorage.setItem('kingschat_token_expiry', (Date.now() + authResponse.expiresInMillis).toString())
        
        // Store user profile if it's in the response
        if ((authResponse as any).user || (authResponse as any).profile) {
          const userProfile = (authResponse as any).user || (authResponse as any).profile
          localStorage.setItem('kingschat_user_profile', JSON.stringify(userProfile))
        }
      }
      
      return authResponse
    } catch (error: any) {
 console.error(' KingsChat login failed:', error)
 console.error(' Error details:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      })
      
      // Show user-friendly error message
      if (error.code === 1) {
        alert('KingsChat Error: Invalid Client ID or configuration. Please check:\n1. Client ID is correct\n2. Domain is whitelisted in KingsChat Developer Portal\n3. Scopes are enabled')
      }
      
      return null
    }
  }


  /**
   * Refresh KingsChat authentication token
   */
  static async refreshToken(refreshToken: string): Promise<KingsChatAuthTokens | null> {
    try {
      
      const refreshOptions = {
        clientId: KINGSCHAT_CLIENT_ID,
        refreshToken: refreshToken
      }

      const authResponse = await kingsChatWebSdk.refreshAuthenticationToken(refreshOptions)
      
      
            if (typeof window !== 'undefined') {
        localStorage.setItem('kingschat_access_token', authResponse.accessToken)
        localStorage.setItem('kingschat_refresh_token', authResponse.refreshToken)
        localStorage.setItem('kingschat_token_expiry', (Date.now() + authResponse.expiresInMillis).toString())
      }
      
      return authResponse
    } catch (error) {
 console.error(' KingsChat token refresh failed:', error)
      return null
    }
  }

  /**
   * Get stored KingsChat tokens from localStorage
   */
  static getStoredTokens(): KingsChatAuthTokens | null {
    if (typeof window === 'undefined') return null

    const accessToken = localStorage.getItem('kingschat_access_token')
    const refreshToken = localStorage.getItem('kingschat_refresh_token')
    const expiryStr = localStorage.getItem('kingschat_token_expiry')

    if (!accessToken || !refreshToken || !expiryStr) return null

    const expiresInMillis = parseInt(expiryStr) - Date.now()

    return {
      accessToken,
      refreshToken,
      expiresInMillis
    }
  }

  /**
   * Check if KingsChat token is expired
   */
  static isTokenExpired(): boolean {
    if (typeof window === 'undefined') return true

    const expiryStr = localStorage.getItem('kingschat_token_expiry')
    if (!expiryStr) return true

    const expiry = parseInt(expiryStr)
    return Date.now() >= expiry
  }

  /**
   * Get valid access token (refresh if needed)
   */
  static async getValidAccessToken(): Promise<string | null> {
    const tokens = this.getStoredTokens()
    if (!tokens) return null

    // If token is expired, refresh it
    if (this.isTokenExpired()) {
      const refreshedTokens = await this.refreshToken(tokens.refreshToken)
      return refreshedTokens?.accessToken || null
    }

    return tokens.accessToken
  }

  /**
   * Send message to KingsChat user
   */
  static async sendMessage(userIdentifier: string, message: string): Promise<boolean> {
    try {
      const accessToken = await this.getValidAccessToken()
      if (!accessToken) {
 console.error(' No valid access token')
        return false
      }

      const sendMessageOptions = {
        message,
        userIdentifier,
        accessToken
      }

      await kingsChatWebSdk.sendMessage(sendMessageOptions)
      return true
    } catch (error) {
 console.error(' Failed to send message:', error)
      return false
    }
  }

  /**
   * Get KingsChat user profile from stored data or decode from token
   */
  static async getUserProfile(accessToken: string): Promise<KingsChatUserProfile | null> {
    try {
      
      // First, try to get profile from localStorage (stored during login)
      if (typeof window !== 'undefined') {
        const storedProfile = localStorage.getItem('kingschat_user_profile')
        if (storedProfile) {
          const profileData = JSON.parse(storedProfile)
          
          const profile: KingsChatUserProfile = {
            userId: profileData.id || profileData.userId || profileData.user_id || profileData.kingschatId || profileData.sub,
            email: profileData.email || profileData.emailAddress,
            firstName: profileData.firstName || profileData.first_name || profileData.givenName || profileData.given_name || profileData.name?.split(' ')[0],
            lastName: profileData.lastName || profileData.last_name || profileData.familyName || profileData.family_name || profileData.name?.split(' ').slice(1).join(' '),
            profilePicture: profileData.profilePicture || profileData.profile_picture || profileData.avatar || profileData.picture || profileData.photoUrl
          }
          
          
          if (profile.userId) {
            return profile
          }
        }
      }
      
      // If no stored profile, try to decode JWT token to get user info
      try {
        // JWT tokens have 3 parts separated by dots
        const tokenParts = accessToken.split('.')
        if (tokenParts.length === 3) {
          // Decode the payload (middle part)
          const payload = JSON.parse(atob(tokenParts[1]))
          
          // Extract all possible user info from token
          const profile: KingsChatUserProfile = {
            userId: payload.sub || payload.userId || payload.user_id || payload.id || payload.kingschatId,
            email: payload.email || payload.emailAddress || payload.mail,
            firstName: payload.given_name || payload.firstName || payload.first_name || payload.givenName || payload.name?.split(' ')[0],
            lastName: payload.family_name || payload.lastName || payload.last_name || payload.familyName || payload.name?.split(' ').slice(1).join(' '),
            profilePicture: payload.picture || payload.avatar || payload.profilePicture || payload.profile_picture || payload.photo
          }
          
          
          if (profile.userId) {
            // Store this profile for future use
            if (typeof window !== 'undefined') {
              localStorage.setItem('kingschat_user_profile', JSON.stringify(profile))
            }
            return profile
          }
        }
      } catch (decodeError) {
 console.warn('️ Could not decode token:', decodeError)
      }
      
      throw new Error('Could not extract user profile from token or storage')
    } catch (error: any) {
 console.error(' Failed to get user profile:', error)
 console.error(' Error details:', {
        message: error.message,
        stack: error.stack
      })
      return null
    }
  }

  /**
   * Clear KingsChat tokens (logout)
   */
  static clearTokens(): void {
    if (typeof window === 'undefined') return

    localStorage.removeItem('kingschat_access_token')
    localStorage.removeItem('kingschat_refresh_token')
    localStorage.removeItem('kingschat_token_expiry')
  }

  /**
   * Check if user is authenticated with KingsChat
   */
  static isAuthenticated(): boolean {
    const tokens = this.getStoredTokens()
    return tokens !== null && !this.isTokenExpired()
  }
}
