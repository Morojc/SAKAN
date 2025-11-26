'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FileText, Check, X, Eye, Building2, User, Phone, Calendar, Download, Search, GripVertical, Clock } from 'lucide-react'
import { DocumentReviewModal } from './DocumentReviewModal'
import { reviewDocument } from '@/app/admin/documents/actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Submission {
  id: string
  user_id: string
  document_url: string
  id_card_url: string | null
  document_type: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  assigned_residence_id: number | null
  rejection_reason: string | null
  profiles: {
    id: string
    full_name: string
    phone_number: string | null
  }
  assigned_residence: {
    id: number
    name: string
    address: string
    city: string
  } | null
  reviewer: {
    id: string
    full_name: string
    email: string
  } | null
}

interface Residence {
  id: number
  name: string
  address: string
  city: string
  syndic_user_id: string | null
}

interface DocumentReviewListProps {
  submissions: Submission[]
  residences: Residence[]
}

type ColumnType = 'pending' | 'approved' | 'rejected'

export function DocumentReviewList({ submissions, residences }: DocumentReviewListProps) {
  const router = useRouter()
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [draggedSubmission, setDraggedSubmission] = useState<Submission | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<ColumnType | null>(null)

  // Filter submissions by search query
  const filteredSubmissions = submissions.filter(submission => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      submission.profiles.full_name?.toLowerCase().includes(query) ||
      submission.profiles.phone_number?.toLowerCase().includes(query)
    )
  })

  const pendingSubmissions = filteredSubmissions.filter(s => s.status === 'pending')
  const approvedSubmissions = filteredSubmissions.filter(s => s.status === 'approved')
  const rejectedSubmissions = filteredSubmissions.filter(s => s.status === 'rejected')

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleReview = (submission: Submission) => {
    setSelectedSubmission(submission)
    setIsModalOpen(true)
  }

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, submission: Submission) => {
    setDraggedSubmission(submission)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML)
  }

  const handleDragEnd = () => {
    setDraggedSubmission(null)
    setDragOverColumn(null)
  }

  const handleDragOver = (e: React.DragEvent, column: ColumnType) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(column)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = async (e: React.DragEvent, targetStatus: ColumnType) => {
    e.preventDefault()
    setDragOverColumn(null)

    if (!draggedSubmission || draggedSubmission.status === targetStatus) {
      setDraggedSubmission(null)
      return
    }

    // If dropping to approved, check if syndic already has a residence
    if (targetStatus === 'approved') {
      // Check if syndic already has a residence assigned
      const syndicResidence = residences.find(r => r.syndic_user_id === draggedSubmission.user_id)
      
      if (syndicResidence) {
        // Syndic already has a residence - approve directly without modal
        try {
          const result = await reviewDocument({
            submissionId: draggedSubmission.id,
            userId: draggedSubmission.user_id,
            action: 'approve',
            // No newResidence needed - will use existing residence
          })

          if (result.success) {
            toast.success('Document approuvé (résidence existante utilisée)')
            router.refresh()
          } else {
            toast.error(result.error || 'Erreur lors de l\'approbation')
          }
        } catch (error) {
          toast.error('Une erreur est survenue')
        }
        setDraggedSubmission(null)
        return
      } else {
        // Syndic doesn't have a residence - open modal to create one
        setSelectedSubmission(draggedSubmission)
        setIsModalOpen(true)
        setDraggedSubmission(null)
        return
      }
    }

    // If dropping to rejected, open modal for rejection reason
    if (targetStatus === 'rejected') {
      setSelectedSubmission(draggedSubmission)
      setIsModalOpen(true)
      setDraggedSubmission(null)
      return
    }

    // If moving back to pending, just update status
    if (targetStatus === 'pending') {
      try {
        const result = await reviewDocument({
          submissionId: draggedSubmission.id,
          userId: draggedSubmission.user_id,
          action: 'pending',
        })

        if (result.success) {
          toast.success('Document remis en attente')
          router.refresh()
        } else {
          toast.error(result.error || 'Erreur lors de la mise à jour')
        }
      } catch (error) {
        toast.error('Une erreur est survenue')
      }
    }

    setDraggedSubmission(null)
  }

  const renderSubmissionCard = (submission: Submission) => {
    const isDragging = draggedSubmission?.id === submission.id
    
    return (
      <div
        key={submission.id}
        draggable
        onDragStart={(e) => handleDragStart(e, submission)}
        onDragEnd={handleDragEnd}
        className={`cursor-move transition-all ${
          isDragging ? 'opacity-50 scale-95' : 'opacity-100'
        }`}
      >
        <Card className="hover:shadow-lg transition-shadow border-2 hover:border-primary/50">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <GripVertical className="h-5 w-5 text-gray-400 flex-shrink-0 mt-1" />
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm truncate">{submission.profiles.full_name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 text-xs mt-0.5">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{formatDate(submission.submitted_at)}</span>
                    </CardDescription>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {/* Contact Info */}
            {submission.profiles.phone_number && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Phone className="h-3 w-3" />
                <span className="truncate">{submission.profiles.phone_number}</span>
              </div>
            )}

            {/* Assigned Residence */}
            {submission.assigned_residence && (
              <div className="p-2 bg-blue-50 rounded-md">
                <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  <span className="truncate">{submission.assigned_residence.name}</span>
                </p>
              </div>
            )}

            {/* Rejection Reason */}
            {submission.status === 'rejected' && submission.rejection_reason && (
              <div className="p-2 bg-red-50 rounded-md">
                <p className="text-xs text-red-600 font-medium">Raison:</p>
                <p className="text-xs text-gray-700 mt-0.5 line-clamp-2">{submission.rejection_reason}</p>
              </div>
            )}

            {/* Document Actions */}
            <div className="flex gap-1.5">
              {submission.document_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(submission.document_url, '_blank')
                  }}
                  className="flex-1 h-8 text-xs"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  PV
                </Button>
              )}
              {submission.id_card_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(submission.id_card_url, '_blank')
                  }}
                  className="flex-1 h-8 text-xs"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  ID
                </Button>
              )}
            </div>

            {/* Review Button for Pending */}
            {submission.status === 'pending' && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleReview(submission)
                }}
                className="w-full h-8 text-xs bg-green-600 hover:bg-green-700"
              >
                <Check className="h-3 w-3 mr-1" />
                Vérifier
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderColumn = (
    title: string,
    status: ColumnType,
    submissions: Submission[],
    icon: React.ReactNode,
    colorClass: string
  ) => {
    const isOver = dragOverColumn === status
    const canDrop = draggedSubmission && draggedSubmission.status !== status

    return (
      <div
        className="flex-1 min-w-0"
        onDragOver={(e) => handleDragOver(e, status)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, status)}
      >
        <div className={`rounded-lg border-2 transition-all ${
          isOver && canDrop
            ? 'border-primary bg-primary/5 shadow-lg'
            : 'border-gray-200 bg-gray-50'
        }`}>
          {/* Column Header */}
          <div className={`p-4 border-b ${colorClass}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {icon}
                <h3 className="font-semibold text-gray-900">{title}</h3>
              </div>
              <Badge variant="secondary" className="bg-white">
                {submissions.length}
              </Badge>
            </div>
          </div>

          {/* Column Content */}
          <div className="p-3 space-y-3 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto">
            {submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                {icon}
                <p className="text-sm mt-2">Aucun document</p>
                {isOver && canDrop && (
                  <p className="text-xs text-primary mt-1">Déposer ici</p>
                )}
              </div>
            ) : (
              submissions.map(renderSubmissionCard)
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Rechercher par nom ou téléphone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Info Banner */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 <strong>Astuce:</strong> Glissez-déposez les cartes entre les colonnes pour changer leur statut
        </p>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {renderColumn(
          'En attente',
          'pending',
          pendingSubmissions,
          <Clock className="h-5 w-5 text-orange-600" />,
          'bg-orange-50'
        )}
        {renderColumn(
          'Approuvé',
          'approved',
          approvedSubmissions,
          <Check className="h-5 w-5 text-green-600" />,
          'bg-green-50'
        )}
        {renderColumn(
          'Rejeté',
          'rejected',
          rejectedSubmissions,
          <X className="h-5 w-5 text-red-600" />,
          'bg-red-50'
        )}
      </div>

      {selectedSubmission && (
        <DocumentReviewModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedSubmission(null)
          }}
          submission={selectedSubmission}
          residences={residences}
        />
      )}
    </>
  )
}
