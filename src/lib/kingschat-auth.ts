// KingsChat Authentication Service

// Try to get from env first, fallback to hardcoded
const KINGSCHAT_CLIENT_ID = process.env.NEXT_PUBLIC_KINGSCHAT_CLIENT_ID || 'a1f444fa-ea50-47cf-ba2b-232d0b46d1f5'

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
   * Opens KingsChat V2 OAuth popup and returns authentication tokens
   */
  static async login(): Promise<KingsChatAuthTokens | null> {
    try {
      if (!KINGSCHAT_CLIENT_ID || KINGSCHAT_CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
        console.error(' KingsChat Client ID is not configured!')
        return null
      }

      // Open a popup window to authenticate
      const width = 500
      const height = 650
      const left = typeof window !== 'undefined' ? window.screen.width / 2 - width / 2 : 0
      const top = typeof window !== 'undefined' ? window.screen.height / 2 - height / 2 : 0

      if (typeof window === 'undefined') {
        console.error('KingsChat login popup flow is only available on client-side.')
        return null
      }

      const popup = window.open(
        `https://accounts.kingschat.online/log-in?clientId=${KINGSCHAT_CLIENT_ID}&origin=web`,
        'KingsChat Login',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
      )

      if (!popup) {
        alert('Popup blocker prevented the login window from opening. Please enable popups and try again.')
        return null
      }

      return new Promise((resolve) => {
        const handleMessage = (event: MessageEvent) => {
          // Accept messages from our own origin
          if (event.origin !== window.location.origin) return

          if (event.data?.type === 'kingschat_auth_success') {
            const { accessToken, refreshToken, expiresInMillis } = event.data

            // Store tokens in localStorage for persistence
            if (typeof window !== 'undefined') {
              localStorage.setItem('kingschat_access_token', accessToken)
              localStorage.setItem('kingschat_refresh_token', refreshToken || '')
              localStorage.setItem('kingschat_token_expiry', (Date.now() + (expiresInMillis || 3600000)).toString())
              // Clear profile cache on new login to force refresh
              localStorage.removeItem('kingschat_user_profile')
            }

            window.removeEventListener('message', handleMessage)
            resolve({
              accessToken,
              refreshToken: refreshToken || '',
              expiresInMillis: expiresInMillis || 3600000
            })
          }
        }

        window.addEventListener('message', handleMessage)

        // Poll to check if popup is closed by user without success
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed)
            window.removeEventListener('message', handleMessage)
            resolve(null)
          }
        }, 1000)
      })
    } catch (error: any) {
      console.error(' KingsChat login failed:', error)
      return null
    }
  }

  /**
   * Refresh KingsChat authentication token
   */
  static async refreshToken(refreshToken: string): Promise<KingsChatAuthTokens | null> {
    try {
      const response = await fetch('https://connect.kingsch.at/developer/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      })

      if (!response.ok) {
        throw new Error('Refresh token request failed')
      }

      const authResponse = await response.json()
      const access_token = authResponse.access_token
      const refresh_token = authResponse.refresh_token
      const expires_in_millis = authResponse.expires_in_millis || 3600000

      if (typeof window !== 'undefined') {
        localStorage.setItem('kingschat_access_token', access_token)
        localStorage.setItem('kingschat_refresh_token', refresh_token)
        localStorage.setItem('kingschat_token_expiry', (Date.now() + expires_in_millis).toString())
      }

      return {
        accessToken: access_token,
        expiresInMillis: expires_in_millis,
        refreshToken: refresh_token
      }
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
   * Send message to KingsChat user (SDK Legacy placeholder)
   */
  static async sendMessage(userIdentifier: string, message: string): Promise<boolean> {
    console.warn('KingsChatAuthService.sendMessage is deprecated in KingsChat V2.')
    return false
  }

  /**
   * Get KingsChat user profile from stored data, API fetch, or decode from token
   */
  static async getUserProfile(accessToken: string): Promise<KingsChatUserProfile | null> {
    try {
      // First, try to get profile from localStorage (stored during login)
      if (typeof window !== 'undefined') {
        const storedProfile = localStorage.getItem('kingschat_user_profile')
        if (storedProfile) {
          try {
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
          } catch (e) {
            console.warn('Error parsing cached user profile:', e)
          }
        }
      }

      // Fetch from V2 API if API Key is configured
      const apiKey = process.env.NEXT_PUBLIC_KINGSCHAT_API_KEY
      if (apiKey) {
        try {
          const response = await fetch('https://connect.kingsch.at/developer/api/user/profile', {
            headers: {
              'api-key': apiKey,
              'Authorization': `Bearer ${accessToken}`
            }
          })

          if (response.ok) {
            const data = await response.json()
            if (data && data.profile) {
              const p = data.profile
              const profile: KingsChatUserProfile = {
                userId: p.id,
                email: p.email || undefined,
                firstName: p.name?.split(' ')[0] || '',
                lastName: p.name?.split(' ').slice(1).join(' ') || '',
                profilePicture: p.avatar || undefined
              }
              if (typeof window !== 'undefined') {
                localStorage.setItem('kingschat_user_profile', JSON.stringify(p))
              }
              return profile
            }
          } else {
            console.error('Failed to fetch profile from KingsChat V2 API:', await response.text())
          }
        } catch (fetchErr) {
          console.warn('Error fetching user profile via API, falling back:', fetchErr)
        }
      }

      // Fallback: Decode JWT token
      try {
        const tokenParts = accessToken.split('.')
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]))
          const profile: KingsChatUserProfile = {
            userId: payload.sub || payload.userId || payload.user_id || payload.id || payload.kingschatId,
            email: payload.email || payload.emailAddress || payload.mail,
            firstName: payload.given_name || payload.firstName || payload.first_name || payload.givenName || payload.name?.split(' ')[0],
            lastName: payload.family_name || payload.lastName || payload.last_name || payload.familyName || payload.name?.split(' ').slice(1).join(' '),
            profilePicture: payload.picture || payload.avatar || payload.profilePicture || payload.profile_picture || payload.photo
          }

          if (profile.userId) {
            if (typeof window !== 'undefined') {
              localStorage.setItem('kingschat_user_profile', JSON.stringify(profile))
            }
            return profile
          }
        }
      } catch (decodeError) {
        console.warn('Could not decode token payload:', decodeError)
      }

      throw new Error('Could not extract user profile from token, storage, or V2 API')
    } catch (error: any) {
      console.error(' Failed to get user profile:', error)
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
    localStorage.removeItem('kingschat_user_profile')
  }

  /**
   * Check if user is authenticated with KingsChat
   */
  static isAuthenticated(): boolean {
    const tokens = this.getStoredTokens()
    return tokens !== null && !this.isTokenExpired()
  }
}
