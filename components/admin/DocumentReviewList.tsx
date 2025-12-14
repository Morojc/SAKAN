'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FileText, Check, X, Eye, Building2, Phone, Calendar, Search, GripVertical, Clock, Sparkles, ArrowRight } from 'lucide-react'
import { DocumentReviewModal } from './DocumentReviewModal'
import { reviewDocument } from '@/app/admin/documents/actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

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
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [optimisticSubmissions, setOptimisticSubmissions] = useState<Submission[]>(submissions)

  // Sync optimistic updates with server data when submissions change
  useEffect(() => {
    // Only sync if we're not currently processing a drag operation
    if (!isProcessing && !draggedSubmission) {
      setOptimisticSubmissions(submissions)
    }
  }, [submissions])

  // Use optimistic submissions for immediate UI updates
  const displaySubmissions = optimisticSubmissions.length > 0 ? optimisticSubmissions : submissions

  // Filter submissions by search query
  const filteredSubmissions = displaySubmissions.filter(submission => {
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

  // Drag and Drop handlers with enhanced visual feedback
  const handleDragStart = (e: React.DragEvent, submission: Submission) => {
    setDraggedSubmission(submission)
    e.dataTransfer.effectAllowed = 'move'
    
    // Create a custom drag image using the current target
    const target = e.currentTarget as HTMLElement
    if (target) {
      const dragImage = target.cloneNode(true) as HTMLElement
      dragImage.style.transform = 'rotate(5deg)'
      dragImage.style.opacity = '0.9'
      document.body.appendChild(dragImage)
      dragImage.style.position = 'absolute'
      dragImage.style.top = '-1000px'
      e.dataTransfer.setDragImage(dragImage, e.clientX - target.getBoundingClientRect().left, e.clientY - target.getBoundingClientRect().top)
      setTimeout(() => {
        if (document.body.contains(dragImage)) {
          document.body.removeChild(dragImage)
        }
      }, 0)
    }
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

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the column (not just moving to a child)
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverColumn(null)
    }
  }

  const handleDrop = async (e: React.DragEvent, targetStatus: ColumnType) => {
    e.preventDefault()
    setDragOverColumn(null)

    if (!draggedSubmission || draggedSubmission.status === targetStatus) {
      setDraggedSubmission(null)
      return
    }

    const submissionId = draggedSubmission.id
    setIsProcessing(submissionId)

    // Optimistic update - immediately update UI
    setOptimisticSubmissions(prev => 
      prev.map(sub => 
        sub.id === submissionId 
          ? { ...sub, status: targetStatus }
          : sub
      )
    )

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
            toast.success('✅ Document approuvé avec succès!', {
              icon: <Sparkles className="h-4 w-4" />,
            })
            router.refresh()
            // Sync with server data after refresh
            setTimeout(() => {
              setOptimisticSubmissions(submissions)
            }, 500)
          } else {
            // Revert optimistic update on error
            setOptimisticSubmissions(prev => 
              prev.map(sub => 
                sub.id === submissionId 
                  ? { ...sub, status: draggedSubmission.status }
                  : sub
              )
            )
            toast.error(result.error || 'Erreur lors de l\'approbation')
          }
        } catch {
          // Revert optimistic update on error
          setOptimisticSubmissions(prev => 
            prev.map(sub => 
              sub.id === submissionId 
                ? { ...sub, status: draggedSubmission.status }
                : sub
            )
          )
          toast.error('Une erreur est survenue')
        }
        setIsProcessing(null)
        setDraggedSubmission(null)
        return
      } else {
        // Revert optimistic update - will open modal
        setOptimisticSubmissions(prev => 
          prev.map(sub => 
            sub.id === submissionId 
              ? { ...sub, status: draggedSubmission.status }
              : sub
          )
        )
        // Syndic doesn't have a residence - open modal to create one
        setSelectedSubmission(draggedSubmission)
        setIsModalOpen(true)
        setIsProcessing(null)
        setDraggedSubmission(null)
        return
      }
    }

    // If dropping to rejected, open modal for rejection reason
    if (targetStatus === 'rejected') {
      // Revert optimistic update - will open modal
      setOptimisticSubmissions(prev => 
        prev.map(sub => 
          sub.id === submissionId 
            ? { ...sub, status: draggedSubmission.status }
            : sub
        )
      )
      setSelectedSubmission(draggedSubmission)
      setIsModalOpen(true)
      setIsProcessing(null)
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
          toast.success('⏳ Document remis en attente', {
            icon: <Clock className="h-4 w-4" />,
          })
          router.refresh()
          setTimeout(() => {
            setOptimisticSubmissions(submissions)
          }, 500)
        } else {
          // Revert optimistic update on error
          setOptimisticSubmissions(prev => 
            prev.map(sub => 
              sub.id === submissionId 
                ? { ...sub, status: draggedSubmission.status }
                : sub
            )
          )
          toast.error(result.error || 'Erreur lors de la mise à jour')
        }
      } catch {
        // Revert optimistic update on error
        setOptimisticSubmissions(prev => 
          prev.map(sub => 
            sub.id === submissionId 
              ? { ...sub, status: draggedSubmission.status }
              : sub
          )
        )
        toast.error('Une erreur est survenue')
      }
    }

    setIsProcessing(null)
    setDraggedSubmission(null)
  }

  const renderSubmissionCard = (submission: Submission, index: number) => {
    const isDragging = draggedSubmission?.id === submission.id
    const isProcessingCard = isProcessing === submission.id
    
    return (
      <div
        key={submission.id}
        draggable={!isProcessingCard}
        onDragStart={(e) => !isProcessingCard && handleDragStart(e, submission)}
        onDragEnd={handleDragEnd}
        className={`cursor-move ${isProcessingCard ? 'pointer-events-none' : ''}`}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ 
            opacity: isDragging ? 0.4 : isProcessingCard ? 0.7 : 1,
            y: 0,
            scale: isDragging ? 0.95 : 1,
            rotate: isDragging ? 2 : 0,
          }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ 
            type: "spring",
            stiffness: 300,
            damping: 25,
            delay: index * 0.05
          }}
          whileHover={{ 
            scale: isDragging ? 0.95 : 1.02,
            y: isDragging ? 0 : -4,
            transition: { duration: 0.2 }
          }}
        >
          <Card className={`hover:shadow-xl transition-all duration-300 border-2 ${
            isDragging 
              ? 'border-primary shadow-2xl ring-2 ring-primary/20' 
              : isProcessingCard
              ? 'border-blue-300 bg-blue-50/50'
              : 'hover:border-primary/50 border-gray-200'
          }`}>
          <CardHeader className="pb-3 relative overflow-hidden">
            {isProcessingCard && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-blue-400/10 to-blue-500/10"
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear'
                }}
                style={{
                  backgroundSize: '200% 100%',
                }}
              />
            )}
            <div className="flex items-start justify-between gap-2 relative z-10">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <motion.div
                  whileHover={{ scale: 1.2, rotate: 90 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <GripVertical className={`h-5 w-5 flex-shrink-0 mt-1 ${
                    isDragging ? 'text-primary' : 'text-gray-400'
                  }`} />
                </motion.div>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <motion.div 
                    className="p-2 bg-blue-100 rounded-lg flex-shrink-0"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <FileText className="h-4 w-4 text-blue-600" />
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm truncate font-semibold">
                      {submission.profiles.full_name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1 text-xs mt-0.5">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{formatDate(submission.submitted_at)}</span>
                    </CardDescription>
                  </div>
                </div>
              </div>
              {isProcessingCard && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="h-4 w-4 text-blue-500" />
                </motion.div>
              )}
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
                    if (submission.document_url) {
                      window.open(submission.document_url, '_blank')
                    }
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
                    if (submission.id_card_url) {
                      window.open(submission.id_card_url, '_blank')
                    }
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
        </motion.div>
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
      <motion.div
        className="flex-1 min-w-0"
        onDragOver={(e) => handleDragOver(e, status)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, status)}
        animate={{
          scale: isOver && canDrop ? 1.02 : 1,
          y: isOver && canDrop ? -5 : 0,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <motion.div 
          className={`rounded-lg border-2 transition-all duration-300 ${
            isOver && canDrop
              ? 'border-primary bg-primary/10 shadow-2xl ring-4 ring-primary/20'
              : 'border-gray-200 bg-gray-50'
          }`}
          animate={{
            borderColor: isOver && canDrop ? 'rgb(59, 130, 246)' : 'rgb(229, 231, 235)',
          }}
        >
          {/* Column Header */}
          <motion.div 
            className={`p-4 border-b ${colorClass} relative overflow-hidden`}
            animate={{
              backgroundColor: isOver && canDrop ? 'rgba(59, 130, 246, 0.15)' : undefined,
            }}
          >
            {isOver && canDrop && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20"
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'linear'
                }}
              />
            )}
            <div className="flex items-center justify-between relative z-10">
              <motion.div 
                className="flex items-center gap-2"
                animate={{
                  scale: isOver && canDrop ? 1.1 : 1,
                }}
              >
                {icon}
                <h3 className="font-semibold text-gray-900">{title}</h3>
              </motion.div>
              <motion.div
                animate={{
                  scale: isOver && canDrop ? 1.2 : 1,
                }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Badge variant="secondary" className="bg-white shadow-sm">
                  {submissions.length}
                </Badge>
              </motion.div>
            </div>
          </motion.div>

          {/* Column Content */}
          <div className="p-3 space-y-3 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto relative">
            {isOver && canDrop && (
              <motion.div
                className="absolute inset-0 border-2 border-dashed border-primary rounded-lg flex items-center justify-center bg-primary/5 z-10 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="flex flex-col items-center gap-2 text-primary"
                  animate={{
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }}
                >
                  <ArrowRight className="h-8 w-8" />
                  <p className="font-semibold">Déposer ici</p>
                </motion.div>
              </motion.div>
            )}
            <AnimatePresence mode="popLayout">
              {submissions.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center justify-center py-12 text-gray-400"
                >
                  {icon}
                  <p className="text-sm mt-2">Aucun document</p>
                  {isOver && canDrop && (
                    <motion.p 
                      className="text-xs text-primary mt-1 font-medium"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      Déposer ici
                    </motion.p>
                  )}
                </motion.div>
              ) : (
                submissions.map((submission, index) => renderSubmissionCard(submission, index))
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
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
      <motion.div 
        className="mb-4 p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 rounded-lg shadow-sm"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            <Sparkles className="h-5 w-5 text-blue-600" />
          </motion.div>
          <p className="text-sm text-blue-800">
            <strong>Astuce:</strong> Glissez-déposez les cartes entre les colonnes pour changer leur statut. 
            Les mises à jour sont synchronisées en temps réel!
          </p>
        </div>
      </motion.div>

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
            // Refresh data after modal closes
            router.refresh()
            setTimeout(() => {
              setOptimisticSubmissions(submissions)
            }, 300)
          }}
          submission={selectedSubmission}
          residences={residences}
        />
      )}
    </>
  )
}
