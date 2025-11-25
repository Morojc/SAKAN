'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, X, Loader2 } from 'lucide-react'
import { reviewDocument } from '@/app/admin/documents/actions'
import { useRouter } from 'next/navigation'

interface Submission {
  id: string
  user_id: string
  document_url: string
  id_card_url?: string
  document_type: string
  status: string
  profiles: {
    full_name: string
  }
}

interface Residence {
  id: number
  name: string
  address: string
  city: string
  syndic_user_id: string | null
}

interface DocumentReviewModalProps {
  isOpen: boolean
  onClose: () => void
  submission: Submission
  residences: Residence[]
}

export function DocumentReviewModal({
  isOpen,
  onClose,
  submission,
  residences,
}: DocumentReviewModalProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [action, setAction] = useState<'approve' | 'reject' | 'pending' | null>(null)
  const [selectedResidenceId, setSelectedResidenceId] = useState<string>('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [error, setError] = useState('')

  // Filter residences that don't have a syndic or only show all for now
  const availableResidences = residences.filter(r => !r.syndic_user_id || r.syndic_user_id === submission.user_id)

  const handleSubmit = async () => {
    setError('')

    if (action === 'approve' && !selectedResidenceId) {
      setError('Veuillez sélectionner une résidence pour approuver')
      return
    }

    if (action === 'reject' && !rejectionReason.trim()) {
      setError('Veuillez indiquer la raison du rejet')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await reviewDocument({
        submissionId: submission.id,
        userId: submission.user_id,
        action: action!,
        residenceId: action === 'approve' ? parseInt(selectedResidenceId) : undefined,
        rejectionReason: action === 'reject' ? rejectionReason : undefined,
      })

      if (result.success) {
        // Reset form state
        setAction(null)
        setSelectedResidenceId('')
        setRejectionReason('')
        router.refresh()
        onClose()
      } else {
        setError(result.error || 'Une erreur est survenue')
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vérifier le document</DialogTitle>
          <DialogDescription>
            Document soumis par {submission.profiles.full_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Document Previews */}
          <div className="space-y-3">
            <Label>Documents soumis</Label>
            
            {/* Procès Verbal */}
            {submission.document_url && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <p className="text-sm font-medium text-gray-700 mb-2">📄 Procès Verbal</p>
                <a
                  href={submission.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  Ouvrir le procès verbal dans un nouvel onglet
                </a>
              </div>
            )}
            
            {/* ID Card */}
            {(submission as any).id_card_url && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <p className="text-sm font-medium text-gray-700 mb-2">🪪 Carte d'identité</p>
                <a
                  href={(submission as any).id_card_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  Ouvrir la carte d'identité dans un nouvel onglet
                </a>
              </div>
            )}
            
            {!submission.document_url && !(submission as any).id_card_url && (
              <div className="border rounded-lg p-4 bg-yellow-50 text-sm text-yellow-700">
                ⚠️ Aucun document disponible
              </div>
            )}
          </div>

          {/* Action Selection */}
          {!action && (
            <div className="flex gap-4">
              <Button
                onClick={() => setAction('approve')}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Approuver
              </Button>
              <Button
                onClick={() => setAction('reject')}
                variant="destructive"
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Rejeter
              </Button>
              {submission.status !== 'pending' && (
                <Button
                  onClick={() => setAction('pending')}
                  variant="outline"
                  className="flex-1"
                >
                  Remettre en attente
                </Button>
              )}
            </div>
          )}

          {/* Approve Flow */}
          {action === 'approve' && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">
                  Approbation du document
                </p>
                <p className="text-sm text-green-700 mt-1">
                  Sélectionnez une résidence à assigner à ce syndic
                </p>
              </div>

              <div>
                <Label htmlFor="residence">Résidence à assigner *</Label>
                <Select value={selectedResidenceId} onValueChange={setSelectedResidenceId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Choisir une résidence" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableResidences.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500">
                        Aucune résidence disponible. Créez-en une d'abord.
                      </div>
                    ) : (
                      availableResidences.map((residence) => (
                        <SelectItem key={residence.id} value={residence.id.toString()}>
                          <div>
                            <p className="font-medium">{residence.name}</p>
                            <p className="text-xs text-gray-500">
                              {residence.address}, {residence.city}
                            </p>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Le syndic sera assigné à cette résidence et pourra accéder au dashboard
                </p>
              </div>
            </div>
          )}

          {/* Reject Flow */}
          {action === 'reject' && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-800">
                  Rejet du document
                </p>
                <p className="text-sm text-red-700 mt-1">
                  Expliquez la raison du rejet pour que le syndic puisse corriger
                </p>
              </div>

              <div>
                <Label htmlFor="reason">Raison du rejet *</Label>
                <Textarea
                  id="reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ex: Document illisible, informations manquantes, etc."
                  className="mt-2 min-h-[100px]"
                />
              </div>
            </div>
          )}

          {/* Pending Flow */}
          {action === 'pending' && (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-yellow-800">
                  Remettre en attente
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Le document sera remis en attente et toutes les actions précédentes seront annulées (assignation de résidence, vérification, etc.)
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          {action && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setAction(null)
                  setSelectedResidenceId('')
                  setRejectionReason('')
                  setError('')
                }}
                disabled={isSubmitting}
                className="flex-1"
              >
                Retour
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`flex-1 ${
                  action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : action === 'reject'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-yellow-600 hover:bg-yellow-700'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  <>
                    {action === 'approve' ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Confirmer l'approbation
                      </>
                    ) : action === 'reject' ? (
                      <>
                        <X className="h-4 w-4 mr-2" />
                        Confirmer le rejet
                      </>
                    ) : (
                      <>
                        Remettre en attente
                      </>
                    )}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

