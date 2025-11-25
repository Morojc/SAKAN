'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, Check, X, Eye, Building2, User, Phone, Calendar } from 'lucide-react'
import { DocumentReviewModal } from './DocumentReviewModal'

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
    apartment_number: string | null
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

export function DocumentReviewList({ submissions, residences }: DocumentReviewListProps) {
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const pendingSubmissions = submissions.filter(s => s.status === 'pending')
  const approvedSubmissions = submissions.filter(s => s.status === 'approved')
  const rejectedSubmissions = submissions.filter(s => s.status === 'rejected')

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">En attente</Badge>
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approuvé</Badge>
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejeté</Badge>
      default:
        return null
    }
  }

  const getDocumentTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      'proces_verbal': 'Procès Verbal',
      'id_card': 'Carte d\'identité',
      'other': 'Autre'
    }
    return labels[type] || type
  }

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

  const renderSubmissionCard = (submission: any) => {
    // Debug: Log ALL submission properties
    console.log('[renderSubmissionCard] Full submission:', submission)
    console.log('[renderSubmissionCard] id_card_url value:', submission.id_card_url)
    console.log('[renderSubmissionCard] id_card_url exists:', submission.id_card_url !== null && submission.id_card_url !== undefined)
    
    return (
    <Card key={submission.id} className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">{submission.profiles.full_name}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Calendar className="h-3 w-3" />
                Soumis le {formatDate(submission.submitted_at)}
              </CardDescription>
            </div>
          </div>
          {getStatusBadge(submission.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Document Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Type de document</p>
            <p className="font-medium">{getDocumentTypeBadge(submission.document_type)}</p>
          </div>
          {submission.profiles.phone_number && (
            <div>
              <p className="text-gray-500 flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Téléphone
              </p>
              <p className="font-medium">{submission.profiles.phone_number}</p>
            </div>
          )}
        </div>

        {/* Assigned Residence */}
        {submission.assigned_residence && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600 font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Résidence assignée
            </p>
            <p className="text-sm font-medium mt-1">{submission.assigned_residence.name}</p>
            <p className="text-xs text-gray-600">
              {submission.assigned_residence.address}, {submission.assigned_residence.city}
            </p>
          </div>
        )}

        {/* Rejection Reason */}
        {submission.status === 'rejected' && submission.rejection_reason && (
          <div className="p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-600 font-medium">Raison du rejet</p>
            <p className="text-sm text-gray-700 mt-1">{submission.rejection_reason}</p>
          </div>
        )}

        {/* Reviewer Info */}
        {submission.reviewer && submission.reviewed_at && (
          <div className="text-xs text-gray-500">
            Vérifié par {submission.reviewer.full_name} le {formatDate(submission.reviewed_at)}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {/* Document Viewing Buttons */}
          <div className="flex gap-2 flex-wrap">
            {submission.document_url ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log('[Document View] Opening procès verbal:', submission.document_url)
                  window.open(submission.document_url, '_blank')
                }}
                className="flex-1"
              >
                <Eye className="h-4 w-4 mr-2" />
                Voir procès verbal
              </Button>
            ) : (
              <div className="flex-1 text-xs text-gray-400 p-2 border border-dashed rounded">
                Pas de PV
              </div>
            )}
            
            {(submission.id_card_url && submission.id_card_url !== 'null' && submission.id_card_url !== '') ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log('[Document View] Opening ID card:', submission.id_card_url)
                  window.open(submission.id_card_url, '_blank')
                }}
                className="flex-1"
              >
                <Eye className="h-4 w-4 mr-2" />
                Voir carte d'identité
              </Button>
            ) : (
              <div className="flex-1 text-xs text-gray-400 p-2 border border-dashed rounded">
                Pas de carte ID
              </div>
            )}
          </div>
          
          {/* Debug Info (remove after testing) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-gray-400 font-mono">
              PV: {submission.document_url ? '✓' : '✗'} | 
              ID: {submission.id_card_url ? '✓' : '✗'}
            </div>
          )}
          
          {/* Verification Button */}
          {submission.status === 'pending' && (
            <Button
              size="sm"
              onClick={() => handleReview(submission)}
              className="w-full"
            >
              <Check className="h-4 w-4 mr-2" />
              Vérifier
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

  return (
    <>
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="relative">
            En attente
            {pendingSubmissions.length > 0 && (
              <Badge className="ml-2 bg-orange-500" variant="secondary">
                {pendingSubmissions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approuvés ({approvedSubmissions.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejetés ({rejectedSubmissions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingSubmissions.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-gray-500">
                Aucun document en attente de vérification
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingSubmissions.map(renderSubmissionCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          {approvedSubmissions.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-gray-500">
                Aucun document approuvé
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {approvedSubmissions.map(renderSubmissionCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          {rejectedSubmissions.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-gray-500">
                Aucun document rejeté
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rejectedSubmissions.map(renderSubmissionCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

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

