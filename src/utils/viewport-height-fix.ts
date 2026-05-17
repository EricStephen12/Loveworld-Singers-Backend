// Viewport Height Fix for Mobile Browsers
export class ViewportHeightFix {
  private static isInitialized = false

  static init() {
    if (typeof window === 'undefined' || this.isInitialized) return
    
    this.isInitialized = true
    
    // Set CSS custom property for viewport height
    const setVH = () => {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }

    // Set initial value
    setVH()

        window.addEventListener('resize', setVH)
    
        window.addEventListener('orientationchange', () => {
      setTimeout(setVH, 100)
    })

        if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', setVH)
    }

    // Handle app resume from background (iOS Safari issue)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setTimeout(setVH, 100)
        setTimeout(setVH, 500) // Double check after animations
      }
    })

    // Handle page focus (when switching back to tab)
    window.addEventListener('focus', () => {
      setTimeout(setVH, 100)
    })

    // Handle page show (when page becomes visible)
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        setTimeout(setVH, 100)
      }
    })

  }

  static getViewportHeight() {
    if (typeof window === 'undefined') return '100vh'
    
    // Use visual viewport if available
    if (window.visualViewport) {
      return `${window.visualViewport.height}px`
    }
    
    // Use CSS custom property
    const vh = document.documentElement.style.getPropertyValue('--vh')
    if (vh) {
      return `calc(var(--vh, 1vh) * 100)`
    }
    
    return '100vh'
  }

  static forceRefresh() {
    if (typeof window === 'undefined') return
    
    const vh = window.innerHeight * 0.01
    document.documentElement.style.setProperty('--vh', `${vh}px`)
    
    // Also trigger a resize event to update any components listening
    window.dispatchEvent(new Event('resize'))
  }
}



