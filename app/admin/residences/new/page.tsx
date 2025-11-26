import { CreateResidenceForm } from "@/components/admin/CreateResidenceForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2 } from "lucide-react"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

export const dynamic = 'force-dynamic'

export default async function NewResidencePage() {
  const supabase = createSupabaseAdminClient()

  // Fetch all verified syndics
  const { data: syndics } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'syndic')
    .eq('verified', true)
    .order('full_name', { ascending: true })

  // Fetch user emails
  const syndicIds = syndics?.map(s => s.id) || []
  const { data: users } = syndicIds.length > 0
    ? await supabase
        .from('users')
        .select('id, email')
        .in('id', syndicIds)
    : { data: [] }

  const usersMap = new Map(users?.map(u => [u.id, u]) || [])

  // Fetch already assigned syndics
  const { data: assignedResidences } = await supabase
    .from('residences')
    .select('syndic_user_id')
    .not('syndic_user_id', 'is', null)

  const assignedSyndicIds = new Set(assignedResidences?.map(r => r.syndic_user_id) || [])

  // Combine and filter available syndics
  const availableSyndics = (syndics || [])
    .filter(syndic => !assignedSyndicIds.has(syndic.id))
    .map(syndic => ({
      id: syndic.id,
      full_name: syndic.full_name,
      email: usersMap.get(syndic.id)?.email || '',
    }))

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Building2 className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle résidence</h1>
          <p className="text-gray-500">Créez une nouvelle résidence à assigner aux syndics</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations de la résidence</CardTitle>
          <CardDescription>
            Remplissez les informations de la nouvelle résidence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateResidenceForm availableSyndics={availableSyndics} />
        </CardContent>
      </Card>
    </div>
  )
}

