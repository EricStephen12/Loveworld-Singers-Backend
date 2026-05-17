import { persistentStorage } from './persistent-storage'

export class NavigationManager {
  private static isInitialized = false
  private static LAST_PATH_KEY = 'lwsrh_last_path'

  static async init() {
    if (typeof window === 'undefined' || this.isInitialized) return
    this.isInitialized = true

    // We strictly use browser history now, but we can keep track of the "last path" 
    // for simple state restoration if needed.
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.pathname + window.location.search
      // Don't overwrite useful history with the root path or auth path
      if (currentUrl !== '/' && !currentUrl.startsWith('/auth')) {
        localStorage.setItem(this.LAST_PATH_KEY, currentUrl)
      }
    }

    // Listen for visibility changes to update last path
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const currentUrl = window.location.pathname + window.location.search
        if (currentUrl !== '/' && !currentUrl.startsWith('/auth')) {
          localStorage.setItem(this.LAST_PATH_KEY, currentUrl)
        }
      }
    })

    // Track internal navigation depth
    if (typeof window !== 'undefined') {
      // Initialize or increment depth on load
      const isRevisit = sessionStorage.getItem('lwsrh_is_revisit')
      if (!isRevisit) {
        sessionStorage.setItem('lwsrh_nav_depth', '0')
        sessionStorage.setItem('lwsrh_is_revisit', 'true')
      }

      // Hook into Next.js navigation if possible, but for now we rely on explicit calls
      // or simple history length checks which we are enhancing below.
    }
  }

  // Called manually by app components when they navigate deeper
  // This helps us build a reliable "app stack" even if browser history is complex
  static push() {
    if (typeof window === 'undefined') return
    const depth = parseInt(sessionStorage.getItem('lwsrh_nav_depth') || '0')
    sessionStorage.setItem('lwsrh_nav_depth', (depth + 1).toString())
  }

  static getLastPath(): string {
    if (typeof window === 'undefined') return '/home'
    return localStorage.getItem(this.LAST_PATH_KEY) || '/home'
  }

  static getSafeFallback(): string {
    const isAdmin = typeof window !== 'undefined' && localStorage.getItem('adminAuthenticated') === 'true'

    if (isAdmin) {
      return '/admin'
    }

    const isAuthenticated = typeof window !== 'undefined' && (
      localStorage.getItem('userAuthenticated') === 'true' ||
      localStorage.getItem('hasCompletedProfile') === 'true' ||
      localStorage.getItem('bypassLogin') === 'true'
    )

    if (isAuthenticated) {
      return '/home'
    }

    return '/auth'
  }

  /**
   * legacy safeBack - now redirected to robust handleBack
   */
  static safeBack(router: any) {
    this.handleBack(router)
  }

  /**
   * Robust Native Back Navigation
   * 1. Check internal depth: If we know we pushed > 0 times, we can safely pop.
   * 2. Check history length: If > 1, arguably safe, but "revisit" can trick this.
   * 3. Fallback: If unsure, go to logical parent / fallback.
   */
  static handleBack(router: any, fallbackUrl?: string) {
    if (typeof window === 'undefined') return;

    // 1. Internal Depth Check (Best for SPA feeling)
    const currentDepth = parseInt(sessionStorage.getItem('lwsrh_nav_depth') || '0');

    // We strictly use browser history now, but we check if we have "room" to go back
    const hasHistory = window.history.length > 2; // >2 is safer for "revisits" where 1 is current, 0 is unavailable
    const canGoBack = currentDepth > 0 || hasHistory;

    // Decrement depth if we are going back
    if (currentDepth > 0) {
      sessionStorage.setItem('lwsrh_nav_depth', (currentDepth - 1).toString());
    }

    if (canGoBack) {
      router.back();
      return;
    }

    // 2. Fallback needed
    if (fallbackUrl) {
      router.replace(fallbackUrl);
      return;
    }

    // 3. Deduction Logic
    const currentPath = window.location.pathname;

    // Close modal query params first?
    if (window.location.search.length > 0) {
      router.replace(currentPath);
      return;
    }

    // Path deduction: /pages/section/item -> /pages/section
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length > 1) {
      const parentPath = '/' + parts.slice(0, -1).join('/');
      router.replace(parentPath);
    } else {
      router.replace(this.getSafeFallback());
    }
  }

  /**
   * Externally update the last path (e.g. from a router listener)
   * This ensures we track client-side navigations too, not just initial loads
   */
  static saveCurrentPath(path: string) {
    if (typeof window === 'undefined') return

    // Don't save root, auth, or transitions
    if (path !== '/' && !path.startsWith('/auth') && !path.includes('_next')) {
      localStorage.setItem(this.LAST_PATH_KEY, path)
    }
  }
}
