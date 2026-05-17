// Performance Optimizer - Fix PWA Slowness
export class PerformanceOptimizer {
  // Disable heavy real-time subscriptions
  static disableHeavyFeatures() {
    // Disable real-time notifications
    if (typeof window !== 'undefined') {
      localStorage.setItem('disable_realtime', 'true')
      localStorage.setItem('disable_chat', 'true')
      localStorage.setItem('disable_notifications', 'true')
    }
  }

  // Enable only essential features
  static enableEssentialFeatures() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('enable_caching', 'true')
      localStorage.setItem('enable_offline', 'true')
    }
  }

    static clearHeavyCaches() {
    if (typeof window !== 'undefined') {
            localStorage.removeItem('realtime_data')
      localStorage.removeItem('chat_data')
      localStorage.removeItem('notification_data')
    }
  }

  // Optimize for speed
  static optimizeForSpeed() {
    this.disableHeavyFeatures()
    this.enableEssentialFeatures()
    this.clearHeavyCaches()
  }

  // Optimize for low data usage
  static optimizeForLowData() {
    if (typeof window !== 'undefined') {
      // Enable data-saving features
      localStorage.setItem('low_data_mode', 'true')
      localStorage.setItem('disable_images', 'true')
      localStorage.setItem('disable_videos', 'true')
      localStorage.setItem('disable_animations', 'true')
      localStorage.setItem('cache_aggressive', 'true')
      
      // Disable heavy features
      localStorage.setItem('disable_realtime', 'true')
      localStorage.setItem('disable_chat', 'true')
      localStorage.setItem('disable_notifications', 'true')
      
    }
  }

  // Auto-detect slow connection and optimize
  static autoOptimize() {
    if (typeof window !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection
      if (connection) {
        const isSlowConnection = connection.effectiveType === 'slow-2g' || 
                               connection.effectiveType === '2g' ||
                               connection.downlink < 1.5
        
        if (isSlowConnection) {
          this.optimizeForLowData()
        }
      }
    }
  }
}

