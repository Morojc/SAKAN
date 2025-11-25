import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, Building2, Mail, Phone, Calendar } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function AdminSyndicsPage() {
  const supabase = createSupabaseAdminClient()

  // Fetch all syndics with their residence info
  const { data: syndics, error } = await supabase
    .from('profiles')
    .select(`
      *,
      residences:residence_id (
        id,
        name,
        address,
        city
      )
    `)
    .eq('role', 'syndic')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Admin Syndics] Error fetching syndics:', error)
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          Erreur lors du chargement des syndics: {error.message}
        </div>
      </div>
    )
  }

  // Get users data for emails
  const userIds = syndics?.map(s => s.id) || []
  const { data: users } = await supabase
    .from('users')
    .select('id, email')
    .in('id', userIds)

  const usersMap = new Map(users?.map(u => [u.id, u]) || [])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Syndics</h1>
        <p className="text-gray-500">
          Liste de tous les syndics du système
        </p>
      </div>

      {syndics && syndics.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            Aucun syndic enregistré
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {syndics?.map((syndic) => {
            const user = usersMap.get(syndic.id)
            return (
              <Card key={syndic.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <User className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{syndic.full_name}</h3>
                        <div className="flex gap-2 mt-1">
                          {syndic.email_verified ? (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              Email vérifié
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
                              Email non vérifié
                            </Badge>
                          )}
                          {syndic.verified ? (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                              Vérifié
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                              Non vérifié
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2 text-sm">
                    {user?.email && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{user.email}</span>
                      </div>
                    )}
                    {syndic.phone_number && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="h-4 w-4" />
                        <span>{syndic.phone_number}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                      <Calendar className="h-3 w-3" />
                      <span>
                        Inscrit le {new Date(syndic.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>

                  {/* Residence Info */}
                  {syndic.residences ? (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-green-600 font-medium flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Résidence assignée
                      </p>
                      <p className="text-sm font-medium mt-1">{syndic.residences.name}</p>
                      <p className="text-xs text-gray-600">
                        {syndic.residences.address}, {syndic.residences.city}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-600">Aucune résidence assignée</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

