import { DeletionRequestsList } from "@/components/admin/DeletionRequestsList"

export const dynamic = 'force-dynamic'

export default async function AdminDeletionRequestsPage() {
  // Fetch deletion requests via API to get all the details
  // We'll use a client component to fetch this data since we need to handle interactions

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Demandes de suppression de compte</h1>
        <p className="text-gray-500">
          Gérez les demandes de suppression de compte des syndics et sélectionnez un successeur
        </p>
      </div>

      <DeletionRequestsList />
    </div>
  )
}

