'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, Building2, FileCheck, CheckCircle, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AuthNavigationManager } from '@/lib/auth-navigation'

export default function WaitingResidencePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(false)

  // Handle authentication redirect
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/api/auth/signin')
    }
  }, [status, router])

  // Check for residence assignment
  const checkResidenceAssignment = useCallback(async () => {
    if (!session?.user?.id || isChecking) {
      console.log('[Waiting Page] Skipping check:', { hasUser: !!session?.user?.id, isChecking })
      return
    }
    
    console.log('[Waiting Page] Checking residence assignment for user:', session.user.id)
    setIsChecking(true)
    try {
      const response = await fetch('/api/check-residence-assignment')
      const data = await response.json()
      
      console.log('[Waiting Page] API Response:', data)
      
      if (data.hasResidence) {
        console.log('[Waiting Page] Residence found! Redirecting to dashboard...')
        // Residence assigned! Redirect to dashboard
        window.location.href = '/app'
      } else {
        console.log('[Waiting Page] No residence yet, will check again in 10 seconds')
      }
    } catch (error) {
      console.error('[Waiting Page] Error checking residence:', error)
    } finally {
      setIsChecking(false)
    }
  }, [session?.user?.id, isChecking])

  // Prevent back navigation
  useEffect(() => {
    // Push initial state
    window.history.pushState(null, '', window.location.href)

    const handlePopState = () => {
      // Push state again to prevent going back
      window.history.pushState(null, '', window.location.href)
    }

    // Add listener for back button
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  // Auto-check for residence assignment every 10 seconds
  useEffect(() => {
    if (status === 'authenticated') {
      // Check immediately on mount
      checkResidenceAssignment()
      
      // Then check every 10 seconds
      const interval = setInterval(checkResidenceAssignment, 10000)
      return () => clearInterval(interval)
    }
  }, [status, session?.user?.id, checkResidenceAssignment])

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    AuthNavigationManager.markLogout()
    AuthNavigationManager.clearAuthState()
    
    window.location.replace('/api/auth/signout?callbackUrl=/')
  }

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  }

  if (!session?.user) {
    return null
  }

  return (

    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <span className="text-white font-bold text-2xl">S</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">SAKAN</h1>
        </div>

        {/* Main Card */}
        <Card className="shadow-xl border-0">
          <CardHeader className="text-center space-y-4 pb-4">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 rounded-full mx-auto">
              <Clock className="h-10 w-10 text-orange-600 animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-2xl">En attente d'assignation</CardTitle>
              <CardDescription className="text-base mt-2">
                Votre document a été approuvé avec succès !
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Status Timeline */}
            <div className="space-y-4">
              {/* Step 1: Email Verified */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Email vérifié</h3>
                  <p className="text-sm text-gray-500">Votre adresse email a été confirmée</p>
                </div>
              </div>

              {/* Step 2: Document Approved */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <FileCheck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Document approuvé</h3>
                  <p className="text-sm text-gray-500">
                    Votre document a été vérifié et approuvé
                  </p>
                </div>
              </div>

              {/* Step 3: Waiting for Residence */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Assignation de résidence</h3>
                  <p className="text-sm text-gray-500">
                    Notre équipe va vous assigner une résidence sous peu
                  </p>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Prochaines étapes</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="mt-1">•</span>
                  <span>L'administrateur va configurer votre résidence dans le système</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1">•</span>
                  <span>Vous recevrez une notification une fois la résidence assignée</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1">•</span>
                  <span>Vous pourrez alors accéder au tableau de bord complet</span>
                </li>
              </ul>
            </div>

            {/* Support Contact */}
            <div className="text-center pt-4 border-t">
              <p className="text-sm text-gray-600 mb-4">
                Une question ? Contactez notre support
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="outline" asChild>
                  <a href="mailto:support@sakan.app">
                    Contacter le support
                  </a>
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handleSignOut}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Se déconnecter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auto-refresh hint */}
        <p className="text-center text-xs text-gray-500">
          Cette page se rafraîchit automatiquement. Vous serez redirigé vers le dashboard une fois la résidence assignée.
        </p>
      </div>
    </div>
  )
}

