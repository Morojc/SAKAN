'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Trash2, 
  User, 
  Building2, 
  Phone, 
  Mail, 
  Calendar, 
  Search,
  Check,
  X,
  AlertCircle
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface DeletionRequest {
  id: number
  syndic_user_id: string
  residence_id: number
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  requested_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  successor_user_id: string | null
  rejection_reason: string | null
  completed_at: string | null
  syndic: {
    id: string
    full_name: string | null
    email: string | null
    phone_number: string | null
  }
  residence: {
    id: number
    name: string
    address: string
    city: string
  } | null
  eligibleSuccessors: Array<{
    id: string
    full_name: string | null
    phone_number: string | null
    email: string | null
    role: string | null
  }>
  selectedSuccessor: {
    id: string
    full_name: string | null
    phone_number: string | null
    email: string | null
    role: string | null
  } | null
}

export function DeletionRequestsList() {
  const router = useRouter()
  const [requests, setRequests] = useState<DeletionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRequest, setSelectedRequest] = useState<DeletionRequest | null>(null)
  const [selectedSuccessorId, setSelectedSuccessorId] = useState<string>('')
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    fetchRequests()
  }, [])

  useEffect(() => {
    console.log('[DeletionRequestsList] Dialog state changed:', {
      isApprovalDialogOpen,
      hasSelectedRequest: !!selectedRequest,
      selectedRequestId: selectedRequest?.id,
      eligibleSuccessorsCount: selectedRequest?.eligibleSuccessors?.length || 0
    })
  }, [isApprovalDialogOpen, selectedRequest])

  const fetchRequests = async () => {
    try {
      console.log('[DeletionRequestsList] Fetching deletion requests...')
      const response = await fetch('/api/admin/deletion-requests')
      const data = await response.json()
      
      if (response.ok) {
        console.log('[DeletionRequestsList] Fetched requests:', data.requests?.length || 0)
        data.requests?.forEach((req: DeletionRequest) => {
          console.log(`[DeletionRequestsList] Request ${req.id}: ${req.eligibleSuccessors?.length || 0} eligible successors`)
        })
        setRequests(data.requests || [])
      } else {
        console.error('[DeletionRequestsList] Error fetching requests:', data.error)
        toast.error(data.error || 'Failed to fetch deletion requests')
      }
    } catch (error) {
      console.error('[DeletionRequestsList] Error fetching requests:', error)
      toast.error('An error occurred while fetching requests')
    } finally {
      setLoading(false)
    }
  }

  const filteredRequests = requests.filter(request => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      request.syndic.full_name?.toLowerCase().includes(query) ||
      request.syndic.email?.toLowerCase().includes(query) ||
      request.residence?.name?.toLowerCase().includes(query)
    )
  })

  const pendingRequests = filteredRequests.filter(r => r.status === 'pending')

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleApprove = async () => {
    if (!selectedRequest) {
      toast.error('No request selected')
      return
    }

    // Use selected successor or fall back to pre-selected successor
    const finalSuccessorId = selectedSuccessorId?.trim() || selectedRequest.selectedSuccessor?.id

    if (!finalSuccessorId || finalSuccessorId.trim() === '') {
      toast.error('Please select a successor before approving. A successor must be selected to become the new syndic.')
      return
    }

    // Double-check that the selected successor is in the eligible list
    const isValidSuccessor = selectedRequest.eligibleSuccessors.some(
      (s: any) => s.id === finalSuccessorId
    )

    if (!isValidSuccessor && selectedRequest.selectedSuccessor?.id !== finalSuccessorId) {
      toast.error('Invalid successor selected. Please select a valid resident from the list.')
      return
    }

    setIsProcessing(true)
    try {
      const response = await fetch('/api/admin/deletion-requests/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          successorId: finalSuccessorId.trim() || undefined // Send the selected successor (or undefined to use pre-selected)
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Deletion request approved and account deleted successfully')
        setIsApprovalDialogOpen(false)
        setSelectedRequest(null)
        setSelectedSuccessorId('')
        fetchRequests()
        router.refresh()
      } else {
        if (data.code === 'SUCCESSOR_REQUIRED') {
          toast.error('Successor selection is required. Please select a resident to become the new syndic.')
        } else {
          toast.error(data.error || 'Failed to approve deletion request')
        }
      }
    } catch (error) {
      console.error('Error approving request:', error)
      toast.error('An error occurred while approving the request')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async (requestId: number) => {
    if (!confirm('Are you sure you want to reject this deletion request?')) {
      return
    }

    try {
      const response = await fetch('/api/admin/deletion-requests/approve', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          rejectionReason: 'Rejected by administrator'
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Deletion request rejected')
        fetchRequests()
        router.refresh()
      } else {
        toast.error(data.error || 'Failed to reject deletion request')
      }
    } catch (error) {
      console.error('Error rejecting request:', error)
      toast.error('An error occurred while rejecting the request')
    }
  }

  const openApprovalDialog = (request: DeletionRequest) => {
    console.log('[DeletionRequestsList] Opening approval dialog for request:', request.id)
    console.log('[DeletionRequestsList] Eligible successors:', request.eligibleSuccessors)
    console.log('[DeletionRequestsList] Pre-selected successor:', request.selectedSuccessor)
    
    if (!request.eligibleSuccessors || request.eligibleSuccessors.length === 0) {
      toast.error('No eligible successors found for this residence. Please ensure there are residents (not syndics) in this residence.')
      console.error('[DeletionRequestsList] No eligible successors found for request:', request.id)
      return
    }
    
    console.log('[DeletionRequestsList] Setting selected request and opening dialog')
    setSelectedRequest(request)
    // Pre-select the successor if one was already selected by the syndic
    setSelectedSuccessorId(request.selectedSuccessor?.id || '')
    setIsApprovalDialogOpen(true)
    console.log('[DeletionRequestsList] Dialog state should be open now')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search by syndic name, email, or residence..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Requests List */}
      {pendingRequests.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            No pending deletion requests
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingRequests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Trash2 className="h-5 w-5 text-red-600" />
                    <div>
                      <CardTitle className="text-lg">
                        {request.syndic.full_name || request.syndic.email || 'Unknown Syndic'}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Building2 className="h-4 w-4" />
                        {request.residence?.name || 'Unknown Residence'}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                    Pending
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Syndic Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <Mail className="h-4 w-4" />
                        Email
                      </div>
                      <div className="font-medium">{request.syndic.email || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <Phone className="h-4 w-4" />
                        Phone
                      </div>
                      <div className="font-medium">{request.syndic.phone_number || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Residence Info */}
                  {request.residence && (
                    <div className="text-sm">
                      <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <Building2 className="h-4 w-4" />
                        Address
                      </div>
                      <div className="font-medium">
                        {request.residence.address}, {request.residence.city}
                      </div>
                    </div>
                  )}

                  {/* Request Date */}
                  <div className="text-sm">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Calendar className="h-4 w-4" />
                      Requested At
                    </div>
                    <div className="font-medium">{formatDate(request.requested_at)}</div>
                  </div>

                  {/* Pre-selected Successor */}
                  {request.selectedSuccessor && (
                    <Alert className="bg-green-50 text-green-800 border-green-200">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="font-semibold mb-1">Pre-selected Successor:</div>
                        <div>
                          {request.selectedSuccessor.full_name || request.selectedSuccessor.email || 'Unknown'}
                          {request.selectedSuccessor.email && (
                            <span className="text-sm text-green-700 ml-2">({request.selectedSuccessor.email})</span>
                          )}
                        </div>
                        <div className="text-xs text-green-700 mt-1">
                          The syndic has selected this resident to become the new syndic. You can change this selection if needed.
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Eligible Successors Count */}
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {request.eligibleSuccessors.length} eligible {request.eligibleSuccessors.length === 1 ? 'successor' : 'successors'} available
                    </AlertDescription>
                  </Alert>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        console.log('[DeletionRequestsList] Approve button clicked for request:', request.id)
                        openApprovalDialog(request)
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={!request.eligibleSuccessors || request.eligibleSuccessors.length === 0}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {request.selectedSuccessor ? 'Review & Approve' : 'Approve & Select Successor'}
                      {request.eligibleSuccessors && request.eligibleSuccessors.length > 0 && (
                        <span className="ml-2 text-xs">({request.eligibleSuccessors.length})</span>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleReject(request.id)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approval Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={(open) => {
        console.log('[DeletionRequestsList] Dialog open state changed:', open)
        setIsApprovalDialogOpen(open)
        if (!open) {
          setSelectedRequest(null)
          setSelectedSuccessorId('')
        }
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRequest?.selectedSuccessor ? 'Review or Change Successor' : 'Select a Successor'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.selectedSuccessor 
                ? `The syndic has pre-selected a successor. You can approve this selection or choose a different resident to become the new syndic for ${selectedRequest?.residence?.name || 'this residence'}.`
                : `Select a resident to become the new syndic for ${selectedRequest?.residence?.name || 'this residence'}`
              }
            </DialogDescription>
          </DialogHeader>
          
          {!selectedRequest && (
            <div className="p-4 text-center text-gray-500">
              Loading request details...
            </div>
          )}

          {selectedRequest && (
            <div className="space-y-4">
              {selectedRequest.eligibleSuccessors.length === 0 ? (
                <Alert className="bg-yellow-50 text-yellow-800 border-yellow-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No eligible successors found for this residence. Please ensure there are residents (not syndics) in this residence before approving the deletion request.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Alert className="bg-blue-50 text-blue-800 border-blue-200">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You must select a successor to become the new syndic. The selected resident will be promoted to syndic role and the current syndic's account will be deleted.
                    </AlertDescription>
                  </Alert>
                  <ScrollArea className="h-[300px] w-full border rounded-md p-4">
                    <RadioGroup
                      value={selectedSuccessorId}
                      onValueChange={setSelectedSuccessorId}
                    >
                      <div className="space-y-4">
                        {selectedRequest.eligibleSuccessors.map((successor) => {
                          const displayName = successor.full_name || successor.email || `Resident ${successor.id.substring(0, 8)}...`;
                          const initials = displayName.substring(0, 2).toUpperCase();

                          return (
                            <div key={successor.id} className="flex items-center space-x-4 border p-3 rounded-lg hover:bg-gray-50">
                              <RadioGroupItem value={successor.id} id={successor.id} />
                              <Label htmlFor={successor.id} className="flex items-center gap-3 cursor-pointer flex-1">
                                <Avatar>
                                  <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col flex-1">
                                  <span className="font-medium">{displayName}</span>
                                  <div className="flex gap-2 text-xs text-gray-500">
                                    {successor.email && <span>{successor.email}</span>}
                                    {successor.phone_number && successor.email && <span>•</span>}
                                    {successor.phone_number && <span>{successor.phone_number}</span>}
                                    {!successor.email && !successor.phone_number && <span>Resident</span>}
                                  </div>
                                </div>
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </RadioGroup>
                  </ScrollArea>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApprovalDialogOpen(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={
                (!selectedSuccessorId && !selectedRequest?.selectedSuccessor) || 
                isProcessing || 
                (selectedRequest?.eligibleSuccessors.length === 0)
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? 'Processing...' : 'Approve & Delete Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

