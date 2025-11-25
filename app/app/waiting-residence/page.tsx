import { auth } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, Building2, FileCheck, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/auth"

export const dynamic = 'force-dynamic'

export default async function WaitingResidencePage() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    redirect('/api/auth/signin')
  }

  const supabase = createSupabaseAdminClient()

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email_verified, verified, residence_id')
    .eq('id', userId)
    .maybeSingle()

  // If user has a residence, redirect to dashboard
  if (profile?.residence_id) {
    redirect('/app')
  }

  // If not verified, redirect to appropriate page
  if (!profile?.email_verified) {
    redirect('/app/verify-email-code')
  }

  if (!profile?.verified) {
    redirect('/app/verification-pending')
  }

  // Get latest document submission
  const { data: submission } = await supabase
    .from('syndic_document_submissions')
    .select('status, submitted_at, reviewed_at')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

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
                    {submission?.reviewed_at && (
                      <span className="block text-xs mt-1">
                        Le {new Date(submission.reviewed_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
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
                <form action={async () => {
                  'use server'
                  await signOut({ redirectTo: '/' })
                }}>
                  <Button variant="ghost" type="submit">
                    Se déconnecter
                  </Button>
                </form>
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

