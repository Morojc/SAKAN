import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileCheck, Building2, Users } from 'lucide-react'
import Link from 'next/link'

export default async function AdminDashboardPage() {
  const supabase = createSupabaseAdminClient()
  
  // Get stats
  const [
    { count: pendingDocs },
    { count: totalResidences },
    { count: totalSyndics },
    { count: totalResidents },
  ] = await Promise.all([
    supabase.from('syndic_document_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('residences').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'syndic'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'resident'),
  ])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-600 mt-2">Vue d'ensemble de la plateforme SAKAN</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents en attente</CardTitle>
            <FileCheck className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingDocs || 0}</div>
            <p className="text-xs text-gray-500 mt-1">À vérifier</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Résidences</CardTitle>
            <Building2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResidences || 0}</div>
            <p className="text-xs text-gray-500 mt-1">Total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Syndics</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSyndics || 0}</div>
            <p className="text-xs text-gray-500 mt-1">Total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Résidents</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResidents || 0}</div>
            <p className="text-xs text-gray-500 mt-1">Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
            <CardDescription>Accès rapide aux fonctions principales</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href="/admin/documents"
              className="block p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileCheck className="h-5 w-5 text-orange-600" />
                <div>
                  <h3 className="font-medium text-gray-900">Vérifier les documents</h3>
                  <p className="text-sm text-gray-600">{pendingDocs || 0} documents en attente</p>
                </div>
              </div>
            </Link>

            <Link
              href="/admin/residences/new"
              className="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-medium text-gray-900">Ajouter une résidence</h3>
                  <p className="text-sm text-gray-600">Créer une nouvelle résidence</p>
                </div>
              </div>
            </Link>

            <Link
              href="/admin/syndics"
              className="block p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-green-600" />
                <div>
                  <h3 className="font-medium text-gray-900">Gérer les syndics</h3>
                  <p className="text-sm text-gray-600">Voir tous les syndics</p>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activité récente</CardTitle>
            <CardDescription>Dernières actions sur la plateforme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <p>Aucune activité récente</p>
              <p className="text-sm mt-2">Les activités apparaîtront ici</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
