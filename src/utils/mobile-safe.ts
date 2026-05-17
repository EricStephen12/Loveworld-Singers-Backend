// Mobile Safe Area Utilities
export class MobileSafe {
  // Get safe area insets for iOS devices
  static getSafeAreaInsets() {
    if (typeof window === 'undefined') return { top: 0, bottom: 0, left: 0, right: 0 }
    
    const style = getComputedStyle(document.documentElement)
    return {
      top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0'),
      bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0'),
      left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0'),
      right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0')
    }
  }

  // Get viewport height accounting for mobile browser UI
  static getViewportHeight() {
    if (typeof window === 'undefined') return '100vh'
    
    // Use visual viewport if available (better for mobile)
    if (window.visualViewport) {
      return `${window.visualViewport.height}px`
    }
    
    // Fallback to window height
    return `${window.innerHeight}px`
  }

  // Get bottom safe area for fixed elements
  static getBottomSafeArea() {
    const insets = this.getSafeAreaInsets()
    return Math.max(insets.bottom, 20) // Minimum 20px padding
  }

    static hasSafeArea() {
    if (typeof window === 'undefined') return false
    return CSS.supports('padding: env(safe-area-inset-top)')
  }

  // Get mobile-optimized styles
  static getMobileStyles() {
    const hasSafeArea = this.hasSafeArea()
    const bottomSafe = this.getBottomSafeArea()
    
    return {
      // Full height with safe area
      fullHeight: hasSafeArea ? '100vh' : this.getViewportHeight(),
      
      // Bottom padding for safe area
      bottomPadding: `${bottomSafe}px`,
      
      // Safe area padding
      safeAreaPadding: hasSafeArea ? 'env(safe-area-inset-bottom)' : '0px',
      
      // Mobile viewport height
      mobileVh: this.getViewportHeight()
    }
  }
}



