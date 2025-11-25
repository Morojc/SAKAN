import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, User, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export const dynamic = 'force-dynamic'

export default async function AdminResidencesPage() {
  const supabase = createSupabaseAdminClient()

  // Fetch all residences with syndic info
  const { data: residences, error } = await supabase
    .from('residences')
    .select(`
      *,
      syndic:syndic_user_id (
        id,
        full_name,
        email,
        phone_number
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Admin Residences] Error fetching residences:', error)
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          Erreur lors du chargement des résidences: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Résidences</h1>
          <p className="text-gray-500">
            Gérez toutes les résidences du système
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/residences/new">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle résidence
          </Link>
        </Button>
      </div>

      {residences && residences.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Aucune résidence créée</p>
            <Button asChild>
              <Link href="/admin/residences/new">
                <Plus className="h-4 w-4 mr-2" />
                Créer la première résidence
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {residences?.map((residence) => (
            <Card key={residence.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{residence.name}</CardTitle>
                      <CardDescription className="text-sm">
                        ID: {residence.id}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Address */}
                <div>
                  <p className="text-sm text-gray-500">Adresse</p>
                  <p className="text-sm font-medium">{residence.address}</p>
                  <p className="text-sm text-gray-600">{residence.city}</p>
                </div>

                {/* Bank Account */}
                {residence.bank_account_rib && (
                  <div>
                    <p className="text-sm text-gray-500">RIB</p>
                    <p className="text-sm font-mono">{residence.bank_account_rib}</p>
                  </div>
                )}

                {/* Syndic Info */}
                {residence.syndic ? (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-600 font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Syndic assigné
                    </p>
                    <p className="text-sm font-medium mt-1">
                      {residence.syndic.full_name || residence.syndic.email}
                    </p>
                    {residence.syndic.phone_number && (
                      <p className="text-xs text-gray-600">{residence.syndic.phone_number}</p>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600">Aucun syndic assigné</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/admin/residences/${residence.id}`}>
                      Modifier
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

