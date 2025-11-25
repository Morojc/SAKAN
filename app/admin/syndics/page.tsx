import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { SyndicsList } from "@/components/admin/SyndicsList"

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

  // Combine syndic and user data
  const syndicsWithEmail = syndics?.map(syndic => ({
    ...syndic,
    email: usersMap.get(syndic.id)?.email || '',
  })) || []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Syndics</h1>
        <p className="text-gray-500">
          Liste de tous les syndics du système
        </p>
      </div>

      <SyndicsList syndics={syndicsWithEmail} />
    </div>
  )
}

