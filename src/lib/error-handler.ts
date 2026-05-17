// User-Friendly Error Handler
export class ErrorHandler {
  // Convert Firebase auth errors to user-friendly messages
  static getAuthErrorMessage(errorCode: string): string {
    const errorMessages: { [key: string]: string } = {
      // Authentication Errors
      'auth/user-not-found': 'No account found with this email address. Please check your email or sign up.',
      'auth/wrong-password': 'Incorrect password. Please try again or reset your password.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/user-disabled': 'This account has been disabled. Please contact support.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later or reset your password.',
      'auth/network-request-failed': 'Network error. Please check your internet connection and try again.',
      
      // Registration Errors
      'auth/email-already-in-use': 'An account with this email already exists. Please sign in instead.',
      'auth/weak-password': 'Password is too weak. Please use at least 6 characters with numbers and letters.',
      'auth/invalid-password': 'Password must be at least 6 characters long.',
      
      // Session Errors
      'auth/requires-recent-login': 'For security, please sign in again to continue.',
      'auth/user-token-expired': 'Your session has expired. Please sign in again.',
      'auth/invalid-user-token': 'Your session is invalid. Please sign in again.',
      
      // Google Sign-in Errors
      'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
      'auth/popup-blocked': 'Pop-up was blocked by your browser. Please allow pop-ups and try again.',
      'auth/cancelled-popup-request': 'Sign-in was cancelled. Please try again.',
      
      // General Errors
      'auth/operation-not-allowed': 'This sign-in method is not enabled. Please contact support.',
      'auth/invalid-api-key': 'Configuration error. Please contact support.',
      'auth/app-deleted': 'App configuration error. Please contact support.',
      'auth/invalid-credential': 'Invalid credentials. Please check your email and password.',
      
      // Custom Session Errors
      'session/already-logged-in': 'This account is already logged in on another device. Please ask the account owner to log out from that device first, or sign up for your own account instead.',
      'session/device-limit-reached': 'Maximum number of devices reached for this account.',
      'session/invalid-device': 'This device is not authorized for this account.',
      'device/already-registered': 'This device is already registered to another account. Please sign up for your own account instead.',
    }
    
    return errorMessages[errorCode] || 'An unexpected error occurred. Please try again.'
  }
  
  // Convert Firebase database errors to user-friendly messages
  static getDatabaseErrorMessage(errorCode: string): string {
    const errorMessages: { [key: string]: string } = {
      'permission-denied': 'You don\'t have permission to access this data.',
      'not-found': 'The requested data was not found.',
      'already-exists': 'This data already exists.',
      'resource-exhausted': 'Service is temporarily unavailable. Please try again later.',
      'failed-precondition': 'Operation failed. Please refresh and try again.',
      'aborted': 'Operation was cancelled. Please try again.',
      'out-of-range': 'Invalid data range provided.',
      'unimplemented': 'This feature is not yet available.',
      'internal': 'Internal server error. Please try again later.',
      'unavailable': 'Service is temporarily unavailable. Please try again later.',
      'data-loss': 'Data corruption detected. Please contact support.',
      'unauthenticated': 'Please sign in to continue.',
      'invalid-argument': 'Invalid data provided. Please check your input.',
      'deadline-exceeded': 'Request timed out. Please try again.',
      'cancelled': 'Operation was cancelled.',
    }
    
    return errorMessages[errorCode] || 'A database error occurred. Please try again.'
  }
  
  // Convert storage errors to user-friendly messages
  static getStorageErrorMessage(errorCode: string): string {
    const errorMessages: { [key: string]: string } = {
      'storage/object-not-found': 'File not found.',
      'storage/bucket-not-found': 'Storage service unavailable.',
      'storage/project-not-found': 'Storage configuration error.',
      'storage/quota-exceeded': 'Storage quota exceeded. Please contact support.',
      'storage/unauthenticated': 'Please sign in to upload files.',
      'storage/unauthorized': 'You don\'t have permission to upload files.',
      'storage/retry-limit-exceeded': 'Upload failed after multiple attempts. Please try again.',
      'storage/invalid-checksum': 'File upload corrupted. Please try again.',
      'storage/canceled': 'Upload was cancelled.',
      'storage/invalid-event-name': 'Upload configuration error.',
      'storage/invalid-url': 'Invalid file URL.',
      'storage/invalid-argument': 'Invalid file data.',
      'storage/no-default-bucket': 'Storage service not configured.',
      'storage/cannot-slice-blob': 'File processing error. Please try a different file.',
      'storage/server-file-wrong-size': 'File size mismatch. Please try again.',
    }
    
    return errorMessages[errorCode] || 'File upload error. Please try again.'
  }
  
  // Extract error code from Firebase error
  static extractErrorCode(error: any): string {
    if (typeof error === 'string') {
      return error
    }
    
    if (error?.code) {
      return error.code
    }
    
    if (error?.message) {
      // Try to extract code from message
      const codeMatch = error.message.match(/\(([^)]+)\)/)
      if (codeMatch) {
        return codeMatch[1]
      }
    }
    
    return 'unknown-error'
  }
  
  // Get user-friendly error message for any Firebase error
  static getErrorMessage(error: any, context: 'auth' | 'database' | 'storage' = 'auth'): string {
    const errorCode = this.extractErrorCode(error)
    
    switch (context) {
      case 'auth':
        return this.getAuthErrorMessage(errorCode)
      case 'database':
        return this.getDatabaseErrorMessage(errorCode)
      case 'storage':
        return this.getStorageErrorMessage(errorCode)
      default:
        return this.getAuthErrorMessage(errorCode)
    }
  }
  
  // Show user-friendly error toast/alert
  static showError(error: any, context: 'auth' | 'database' | 'storage' = 'auth'): void {
    const message = this.getErrorMessage(error, context)
    
    // You can replace this with your preferred notification system
    // For now, using alert, but you can integrate with toast libraries
    alert(message)
    
    // Log the actual error for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
 console.error('Detailed error:', error)
    }
  }
  
  // Validate common inputs and return user-friendly messages
  static validateEmail(email: string): string | null {
    if (!email) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address'
    return null
  }
  
  static validatePassword(password: string): string | null {
    if (!password) return 'Password is required'
    if (password.length < 6) return 'Password must be at least 6 characters long'
    return null
  }
  
  static validateName(name: string): string | null {
    if (!name) return 'Name is required'
    if (name.length < 2) return 'Name must be at least 2 characters long'
    if (!/^[a-zA-Z\s]+$/.test(name)) return 'Name can only contain letters and spaces'
    return null
  }
}