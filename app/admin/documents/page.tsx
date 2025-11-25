import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { DocumentReviewList } from "@/components/admin/DocumentReviewList"

export const dynamic = 'force-dynamic'

export default async function AdminDocumentsPage() {
  const supabase = createSupabaseAdminClient()

  // Fetch all document submissions with user and residence info
  const { data: submissions, error } = await supabase
    .from('syndic_document_submissions')
    .select(`
      *,
      profiles:user_id (
        id,
        full_name,
        phone_number,
        apartment_number
      ),
      assigned_residence:assigned_residence_id (
        id,
        name,
        address,
        city
      ),
      reviewer:reviewed_by (
        id,
        full_name,
        email
      )
    `)
    .order('submitted_at', { ascending: false })

  if (error) {
    console.error('[Admin Documents] Error fetching submissions:', error)
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          Erreur lors du chargement des documents: {error.message}
        </div>
      </div>
    )
  }

  // Debug: Log document URLs
  console.log('[Admin Documents] Fetched submissions:', submissions?.map(s => ({
    id: s.id,
    has_pv: !!s.document_url,
    has_id_card: !!s.id_card_url,
    document_url: s.document_url?.substring(0, 50),
    id_card_url: s.id_card_url?.substring(0, 50)
  })))

  // Fetch all residences for the dropdown
  const { data: residences } = await supabase
    .from('residences')
    .select('id, name, address, city, syndic_user_id')
    .order('name', { ascending: true })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents à vérifier</h1>
        <p className="text-gray-500">
          Vérifiez et approuvez les documents des syndics, puis assignez-leur une résidence
        </p>
      </div>

      <DocumentReviewList 
        submissions={submissions || []} 
        residences={residences || []}
      />
    </div>
  )
}

