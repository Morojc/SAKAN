/**
 * Auth Navigation Manager
 * Handles proper sign-in/sign-out flow without confusion between browser navigation and user actions
 */

export class AuthNavigationManager {
  private static SESSION_KEY = 'sakan_auth_state'
  private static LOGOUT_FLAG = 'sakan_logout_initiated'
  
  /**
   * Mark that user is logging out (user action, not browser navigation)
   */
  static markLogout() {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(this.LOGOUT_FLAG, 'true')
      sessionStorage.setItem(`${this.LOGOUT_FLAG}_time`, Date.now().toString())
    }
  }
  
  /**
   * Check if logout was initiated by user action
   */
  static isLogoutInitiated(): boolean {
    if (typeof window === 'undefined') return false
    
    const flag = sessionStorage.getItem(this.LOGOUT_FLAG)
    const time = sessionStorage.getItem(`${this.LOGOUT_FLAG}_time`)
    
    if (!flag || !time) return false
    
    // Check if logout was initiated in the last 5 seconds
    const elapsed = Date.now() - parseInt(time)
    return elapsed < 5000
  }
  
  /**
   * Clear logout flag
   */
  static clearLogout() {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(this.LOGOUT_FLAG)
      sessionStorage.removeItem(`${this.LOGOUT_FLAG}_time`)
    }
  }
  
  /**
   * Mark current auth state
   */
  static saveAuthState(userId: string) {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(this.SESSION_KEY, userId)
    }
  }
  
  /**
   * Clear auth state
   */
  static clearAuthState() {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(this.SESSION_KEY)
    }
  }
  
  /**
   * Get saved auth state
   */
  static getAuthState(): string | null {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(this.SESSION_KEY)
    }
    return null
  }
  
  /**
   * Perform safe logout - marks logout and redirects
   */
  static async performLogout() {
    this.markLogout()
    this.clearAuthState()
    
    // Use replace to prevent back button from going to authenticated pages
    window.location.replace('/api/auth/signout?callbackUrl=/')
  }
  
  /**
   * Check if user is navigating back after logout
   */
  static isNavigatingBackAfterLogout(): boolean {
    if (typeof window === 'undefined') return false
    
    const logoutFlag = sessionStorage.getItem(this.LOGOUT_FLAG)
    const authState = this.getAuthState()
    
    // If logout flag exists but no auth state, user logged out and is navigating back
    return logoutFlag === 'true' && !authState
  }
  
  /**
   * Prevent browser back to authenticated pages after logout
   */
  static preventBackAfterLogout() {
    if (typeof window === 'undefined') return
    
    // Add a page to history to prevent going back
    window.history.pushState(null, '', window.location.href)
    
    const handlePopState = () => {
      if (this.isLogoutInitiated() || this.isNavigatingBackAfterLogout()) {
        // Redirect to home instead of allowing back navigation
        window.location.replace('/')
      } else {
        // Allow normal back navigation
        window.history.pushState(null, '', window.location.href)
      }
    }
    
    window.addEventListener('popstate', handlePopState)
    
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }
  
  /**
   * Setup page visibility handler to refresh session
   */
  static setupVisibilityHandler(refreshCallback: () => void) {
    if (typeof window === 'undefined') return
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if user logged out in another tab
        if (this.isNavigatingBackAfterLogout()) {
          window.location.replace('/')
        } else {
          // Refresh session when page becomes visible
          refreshCallback()
        }
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }
}

