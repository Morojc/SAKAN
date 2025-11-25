'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { User, Building2, Mail, Phone, Calendar, Search, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { deleteSyndic } from '@/app/admin/syndics/actions'
import { toast } from 'sonner'

interface Syndic {
  id: string
  full_name: string
  email: string
  phone_number?: string
  email_verified: boolean
  verified: boolean
  created_at: string
  residences?: {
    id: number
    name: string
    address: string
    city: string
  }
}

interface SyndicsListProps {
  syndics: Syndic[]
}

export function SyndicsList({ syndics }: SyndicsListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'unverified' | 'with_residence' | 'without_residence'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filter syndics
  const filteredSyndics = syndics.filter((syndic) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        syndic.full_name?.toLowerCase().includes(query) ||
        syndic.email?.toLowerCase().includes(query) ||
        syndic.phone_number?.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }

    // Status filter
    if (statusFilter === 'verified' && !syndic.verified) return false
    if (statusFilter === 'unverified' && syndic.verified) return false
    if (statusFilter === 'with_residence' && !syndic.residences) return false
    if (statusFilter === 'without_residence' && syndic.residences) return false

    return true
  })

  const handleDelete = async () => {
    if (!deletingId) return

    setIsDeleting(true)
    try {
      const result = await deleteSyndic(deletingId)
      
      if (result.success) {
        toast.success('Syndic supprimé avec succès')
        setDeletingId(null)
        // Reload the page to refresh the list
        window.location.reload()
      } else {
        toast.error(result.error || 'Erreur lors de la suppression')
      }
    } catch (error) {
      console.error('[Delete Syndic] Error:', error)
      toast.error('Une erreur est survenue')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Rechercher par nom, email ou téléphone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les syndics</SelectItem>
            <SelectItem value="verified">Vérifiés uniquement</SelectItem>
            <SelectItem value="unverified">Non vérifiés</SelectItem>
            <SelectItem value="with_residence">Avec résidence</SelectItem>
            <SelectItem value="without_residence">Sans résidence</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600">
        {filteredSyndics.length} syndic{filteredSyndics.length !== 1 ? 's' : ''} trouvé{filteredSyndics.length !== 1 ? 's' : ''}
      </div>

      {/* Syndics Grid */}
      {filteredSyndics.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            Aucun syndic trouvé
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSyndics.map((syndic) => (
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
                      <div className="flex gap-2 mt-1 flex-wrap">
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
                  {syndic.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{syndic.email}</span>
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

                {/* Actions */}
                <div className="pt-4 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => setDeletingId(syndic.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer le syndic
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Cela supprimera définitivement :
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Le compte du syndic</li>
                <li>Tous ses documents téléchargés</li>
                <li>Toutes ses données personnelles</li>
                <li>L'assignation de résidence (si existante)</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer définitivement'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

