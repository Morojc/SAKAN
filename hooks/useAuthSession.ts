'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AuthNavigationManager } from '@/lib/auth-navigation'

interface UseAuthSessionOptions {
  required?: boolean
  onUnauthenticated?: () => void
  checkInterval?: number // milliseconds
}

/**
 * Enhanced auth session hook with proper navigation handling
 */
export function useAuthSession(options: UseAuthSessionOptions = {}) {
  const {
    required = false,
    onUnauthenticated,
    checkInterval = 60000, // 1 minute
  } = options

  const { data: session, status } = useSession()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(false)

  // Save auth state when user is logged in
  useEffect(() => {
    if (session?.user?.id) {
      AuthNavigationManager.saveAuthState(session.user.id)
    }
  }, [session?.user?.id])

  // Check session periodically
  useEffect(() => {
    const checkSession = async () => {
      if (isChecking) return
      
      setIsChecking(true)
      try {
        const response = await fetch('/api/auth/session-check')
        const data = await response.json()

        if (!data.authenticated && status === 'authenticated') {
          // Session expired - redirect to sign in
          AuthNavigationManager.clearAuthState()
          if (onUnauthenticated) {
            onUnauthenticated()
          } else {
            window.location.replace('/api/auth/signin')
          }
        }
      } catch (error) {
        console.error('[useAuthSession] Session check failed:', error)
      } finally {
        setIsChecking(false)
      }
    }

    if (status === 'authenticated' && checkInterval > 0) {
      const interval = setInterval(checkSession, checkInterval)
      return () => clearInterval(interval)
    }
  }, [status, checkInterval, onUnauthenticated, isChecking])

  // Handle required authentication
  useEffect(() => {
    if (required && status === 'unauthenticated') {
      AuthNavigationManager.clearAuthState()
      if (onUnauthenticated) {
        onUnauthenticated()
      } else {
        router.push('/api/auth/signin')
      }
    }
  }, [required, status, onUnauthenticated, router])

  // Prevent back navigation after logout
  useEffect(() => {
    const cleanup = AuthNavigationManager.preventBackAfterLogout()
    return cleanup
  }, [])

  // Handle page visibility changes
  useEffect(() => {
    const cleanup = AuthNavigationManager.setupVisibilityHandler(() => {
      // Refresh session when page becomes visible
      router.refresh()
    })
    return cleanup
  }, [router])

  return {
    session,
    status,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    user: session?.user,
  }
}

