import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ResidenceResidentsList } from "@/components/admin/ResidenceResidentsList"
import { Building2, MapPin, CreditCard, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const dynamic = 'force-dynamic'

export default async function ResidenceDetailsPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseAdminClient()
  
  // Fetch residence
  const { data: residence, error: residenceError } = await supabase
    .from('residences')
    .select('*')
    .eq('id', params.id)
    .single()

  if (residenceError || !residence) {
    return notFound()
  }

  // Fetch residents
  // First get profile IDs from profile_residences
  const { data: profileResidences } = await supabase
    .from('profile_residences')
    .select('profile_id')
    .eq('residence_id', params.id)
  
  const profileIds = profileResidences?.map(pr => pr.profile_id) || []
  
  // Also include the current syndic if not in profile_residences (should be, but just in case)
  if (residence.syndic_user_id && !profileIds.includes(residence.syndic_user_id)) {
    profileIds.push(residence.syndic_user_id)
  }

  let residents: any[] = []
  
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone_number, role, avatar_url')
      .in('id', profileIds)
    
    residents = profiles || []
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/residences">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{residence.name}</h1>
          <p className="text-gray-500">Détails et gestion de la résidence</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Residence Info Card */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Informations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-gray-400 mt-1" />
              <div>
                <p className="text-sm font-medium text-gray-900">Adresse</p>
                <p className="text-sm text-gray-600">{residence.address}</p>
                <p className="text-sm text-gray-600">{residence.city}</p>
              </div>
            </div>

            {residence.bank_account_rib && (
              <div className="flex items-start gap-3">
                <CreditCard className="h-4 w-4 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm font-medium text-gray-900">RIB Bancaire</p>
                  <p className="text-xs font-mono bg-gray-50 p-1 rounded">
                    {residence.bank_account_rib}
                  </p>
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <p className="text-xs text-gray-400">
                Créée le {new Date(residence.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Residents List */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Gestion des résidents</CardTitle>
            <CardDescription>
              Gérez les résidents et assignez le rôle de syndic
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResidenceResidentsList 
              residents={residents} 
              residenceId={residence.id} 
              currentSyndicId={residence.syndic_user_id} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

