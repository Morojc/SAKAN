'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import TermsAndConditionsDialog from './TermsAndConditionsDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Trash2, AlertCircle, UserCheck, Search, X, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useI18n } from '@/lib/i18n/client';

interface DeleteAccountButtonProps {
  userRole: string;
}

export default function DeleteAccountButton({ userRole }: DeleteAccountButtonProps) {
  const { t } = useI18n();
  // Steps:
  // 0: Idle
  // 1: Terms
  // 2: Confirmation
  // 3: API Call (Loading)
  
  const [step, setStep] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [eligibleSuccessors, setEligibleSuccessors] = useState<any[]>([]);
  const [selectedSuccessorId, setSelectedSuccessorId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSuccessorIsSyndic, setSelectedSuccessorIsSyndic] = useState(false);

  // Simple delete for non-syndics
  const [isSimpleDeleting, setIsSimpleDeleting] = useState(false);
  const [showSimpleConfirm, setShowSimpleConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Deletion request status
  const [deletionRequest, setDeletionRequest] = useState<any>(null);
  const [isLoadingRequest, setIsLoadingRequest] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch deletion request status on mount
  useEffect(() => {
    if (userRole === 'syndic') {
      fetchDeletionRequest();
    } else {
      setIsLoadingRequest(false);
    }
  }, [userRole]);

  const fetchDeletionRequest = async () => {
    try {
      setIsLoadingRequest(true);
      const response = await fetch('/api/account/deletion-request');
      const data = await response.json();
      
      if (response.ok) {
        setDeletionRequest(data.request);
      } else {
        console.error('Failed to fetch deletion request:', data.error);
      }
    } catch (error) {
      console.error('Error fetching deletion request:', error);
    } finally {
      setIsLoadingRequest(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!deletionRequest || deletionRequest.status !== 'pending') {
      return;
    }

    setIsCancelling(true);
    try {
      const response = await fetch('/api/account/deletion-request', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(t('profile.deletionRequestCancelled'));
        setDeletionRequest(null);
      } else {
        toast.error(data.error || t('profile.failedToCancelDeletionRequest'));
      }
    } catch (error: any) {
      console.error('Error cancelling deletion request:', error);
      toast.error(t('profile.failedToCancelDeletionRequestTryAgain'));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReset = () => {
    setStep(0);
    setConfirmText('');
    setShowSimpleConfirm(false);
    setEligibleSuccessors([]);
    setSelectedSuccessorId('');
    setSearchQuery('');
    setSelectedSuccessorIsSyndic(false);
    // Refresh deletion request status after reset
    if (userRole === 'syndic') {
      fetchDeletionRequest();
    }
  };

  const handleSyndicDelete = async () => {
    // At step 4 (successor selection), we don't need to check confirmText
    if (step !== 4 && confirmText !== 'DELETE') {
      toast.error(t('profile.typeDeleteToConfirm'));
      return;
    }

    if (step === 4 && !selectedSuccessorId) {
      toast.error(t('profile.pleaseSelectSuccessor'));
      return;
    }

    if (step === 4 && selectedSuccessorIsSyndic) {
      toast.error(t('profile.cannotSelectSyndicAsSuccessor'));
      return;
    }

    setIsProcessing(true);
    // Don't change step if we are in step 4 (Successor Selection), just show loading
    if (step !== 4) setStep(3); 

    try {
      const body: any = {
        actionType: 'delete_account',
      };

      if (selectedSuccessorId) {
        body.successorId = selectedSuccessorId;
      }

      console.log('[DeleteAccount] Making API call with body:', body, 'at step:', step);

      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Handle request already exists
        if (response.status === 409 && data.code === 'REQUEST_ALREADY_EXISTS') {
          toast.error(t('profile.deletionRequestAlreadyPending'));
          setIsProcessing(false);
          handleReset();
          return;
        }
        // Handle residence has residents error (old flow - should not happen now)
        if (response.status === 403 && data.code === 'RESIDENCE_HAS_RESIDENTS') {
          console.log('[DeleteAccount] Received eligibleSuccessors:', data.eligibleSuccessors);
          // Filter out syndics as a safety measure (backend should already do this, but double-check)
          const filteredSuccessors = (data.eligibleSuccessors || []).filter((successor: any) => successor.role !== 'syndic');
          setEligibleSuccessors(filteredSuccessors);
          setStep(4); // Move to successor selection step
          setIsProcessing(false);
          return;
        }
        
        // Handle error if successor is a syndic
        if (response.status === 400 && data.error?.includes('syndic')) {
          toast.error(data.error || t('profile.cannotSelectSyndicAsSuccessor'));
          setSelectedSuccessorIsSyndic(true);
          setIsProcessing(false);
          return;
        }
        throw new Error(data.error || t('profile.failedToDeleteAccount'));
      }
      
      // Handle successful deletion request creation
      if (data.code === 'DELETION_REQUEST_CREATED') {
        toast.success(t('profile.deletionRequestSubmittedSuccess'));
        setIsProcessing(false);
        handleReset();
        // Refresh deletion request status
        await fetchDeletionRequest();
        return;
      }
      
      // Handle immediate deletion (no residence or no other residents)
      toast.success(t('profile.accountDeletedSuccess'));
      await signOut({ callbackUrl: '/', redirect: true });
      
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error(error.message || t('common.error'));
      setIsProcessing(false);
      if (step === 3) setStep(2); // Go back to confirmation if failed at initial step
      // If failed at step 4, stay at step 4
    }
  };

  const handleSimpleDelete = async () => {
    if (confirmText !== 'DELETE') {
      toast.error(t('profile.typeDeleteToConfirm'));
      return;
    }

    setIsSimpleDeleting(true);

    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(t('profile.accountDeletedSuccess'));
        await signOut({ callbackUrl: '/', redirect: true });
      } else {
        toast.error(data.error || t('profile.failedToDeleteAccount'));
        setIsSimpleDeleting(false);
      }
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error(t('profile.failedToDeleteAccountTryAgain'));
      setIsSimpleDeleting(false);
    }
  };

  // If not a syndic, show simple delete button (or hide it based on requirements)
  // But usually residents can delete their own accounts
  if (userRole !== 'syndic') {
    // Use Dialog for non-syndic users to prevent inline input display
    return (
      <div className="mt-8">
        <Button
          variant="destructive"
          onClick={() => setShowSimpleConfirm(true)}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t('profile.deleteAccount')}
        </Button>

        <Dialog open={showSimpleConfirm} onOpenChange={(open) => {
          if (!open) {
            handleReset();
          }
        }}>
          <DialogContent className="sm:max-w-[500px]">
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  {t('profile.confirmAccountDeletion')}
                </DialogTitle>
                <DialogDescription>
                  {t('profile.accountWillBePermanentlyDeleted')}
                </DialogDescription>
              </DialogHeader>

              <Alert className="bg-red-50 text-red-800 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-800" />
                <AlertTitle>{t('profile.warning')}</AlertTitle>
                <AlertDescription className="mt-2">
                  {t('profile.warningCannotBeUndone')}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="confirm-delete">{t('profile.typeDeleteToConfirm')}</Label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="font-mono"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={handleReset} disabled={isSimpleDeleting}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleSimpleDelete}
                  disabled={isSimpleDeleting || confirmText !== 'DELETE'}
                >
                  {isSimpleDeleting ? t('profile.deleting') : t('profile.confirmDelete')}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Syndic Flow
  return (
    <div className="mt-8 space-y-4">
      {/* Display deletion request status if exists */}
      {isLoadingRequest ? (
        <div className="text-sm text-gray-500">{t('profile.loadingDeletionRequestStatus')}</div>
      ) : deletionRequest ? (
        <Alert className={
          deletionRequest.status === 'pending' 
            ? 'bg-yellow-50 text-yellow-800 border-yellow-200' 
            : deletionRequest.status === 'approved' || deletionRequest.status === 'completed'
            ? 'bg-green-50 text-green-800 border-green-200'
            : 'bg-red-50 text-red-800 border-red-200'
        }>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              {deletionRequest.status === 'pending' && <Clock className="h-4 w-4 mt-0.5" />}
              {(deletionRequest.status === 'approved' || deletionRequest.status === 'completed') && <CheckCircle className="h-4 w-4 mt-0.5" />}
              {deletionRequest.status === 'rejected' && <XCircle className="h-4 w-4 mt-0.5" />}
              <div className="flex-1">
                <AlertTitle className="font-semibold mb-1">
                  {t('profile.deletionRequest')} {deletionRequest.status === 'pending' ? t('profile.pending') : 
                                   deletionRequest.status === 'approved' || deletionRequest.status === 'completed' ? t('profile.approved') : 
                                   t('profile.rejected')}
                </AlertTitle>
                <AlertDescription className="text-sm">
                  {deletionRequest.status === 'pending' && (
                    <>
                      {t('profile.deletionRequestSubmittedOn', { date: new Date(deletionRequest.requested_at).toLocaleDateString() })} 
                      {t('profile.adminWillReviewAndSelectSuccessor')}
                    </>
                  )}
                  {deletionRequest.status === 'approved' && (
                    <>
                      {t('profile.deletionRequestApprovedOn', { date: new Date(deletionRequest.reviewed_at).toLocaleDateString() })} 
                      {t('profile.accountWillBeDeletedSoon')}
                    </>
                  )}
                  {deletionRequest.status === 'completed' && (
                    <>
                      {t('profile.deletionRequestCompletedOn', { date: new Date(deletionRequest.completed_at).toLocaleDateString() })} 
                      {t('profile.accountHasBeenDeleted')}
                    </>
                  )}
                  {deletionRequest.status === 'rejected' && (
                    <>
                      {t('profile.deletionRequestRejectedOn', { date: new Date(deletionRequest.reviewed_at).toLocaleDateString() })}
                      {deletionRequest.rejection_reason && (
                        <span className="block mt-1">{t('profile.reason')}: {deletionRequest.rejection_reason}</span>
                      )}
                    </>
                  )}
                </AlertDescription>
              </div>
            </div>
            {deletionRequest.status === 'pending' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelRequest}
                disabled={isCancelling}
                className="ml-4"
              >
                {isCancelling ? t('profile.cancelling') : (
                  <>
                    <X className="h-4 w-4 mr-1" />
                    {t('profile.cancelRequest')}
                  </>
                )}
              </Button>
            )}
          </div>
        </Alert>
      ) : null}

      {/* Delete Account Button - only show if no pending/approved request */}
      {(!deletionRequest || deletionRequest.status === 'rejected' || deletionRequest.status === 'completed') && (
        <Button
          variant="destructive"
          onClick={() => setStep(1)}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t('profile.deleteAccount')}
        </Button>
      )}

      <Dialog open={step > 0} onOpenChange={(open) => {
        if (!open) {
          handleReset();
        }
      }}>
        <DialogContent className={step === 4 ? "sm:max-w-[600px]" : "sm:max-w-[500px]"}>
          {step === 1 && (
            <TermsAndConditionsDialog
              onAccept={() => setStep(2)}
              onCancel={handleReset}
            />
          )}

          {step === 2 && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  {t('profile.confirmAccountDeletion')}
                </DialogTitle>
                <DialogDescription>
                  {t('profile.accountWillBePermanentlyDeleted')}
                </DialogDescription>
              </DialogHeader>

              <Alert className="bg-red-50 text-red-800 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-800" />
                <AlertTitle>{t('profile.warning')}</AlertTitle>
                <AlertDescription className="mt-2">
                  {t('profile.warningCannotBeUndoneFull')}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="confirm-delete">{t('profile.typeDeleteToConfirm')}</Label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="font-mono"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={handleReset} disabled={isProcessing}>
                  {t('common.cancel')}
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleSyndicDelete}
                  disabled={confirmText !== 'DELETE' || isProcessing}
                >
                  {isProcessing ? t('profile.deleting') : t('profile.deleteMyAccount')}
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-blue-600">
                  <UserCheck className="h-5 w-5" />
                  {t('profile.selectSuccessor')}
                </DialogTitle>
                <DialogDescription>
                  {t('profile.selectSuccessorDesc')}
                </DialogDescription>
              </DialogHeader>

              {eligibleSuccessors.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {t('profile.noEligibleResidentsFound')}
                </div>
              ) : (
                <>
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder={t('profile.searchSuccessorPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Filtered Results */}
                  <ScrollArea className="h-[300px] w-full border rounded-md p-4">
                    <RadioGroup 
                      value={selectedSuccessorId} 
                      onValueChange={(value) => {
                        console.log('[DeleteAccount] Successor selected:', value);
                        const selectedSuccessor = eligibleSuccessors.find((s: any) => s.id === value);
                        const isSyndic = selectedSuccessor?.role === 'syndic';
                        setSelectedSuccessorIsSyndic(isSyndic);
                        setSelectedSuccessorId(value);
                        if (isSyndic) {
                          toast.error(t('profile.cannotSelectSyndicAsSuccessorFull'));
                        }
                      }}
                    >
                      <div className="space-y-4">
                        {eligibleSuccessors
                          .filter((resident) => {
                            // Filter out syndics (safety measure - backend should already do this)
                            if (resident.role === 'syndic') return false;
                            // Apply search filter
                            if (!searchQuery) return true;
                            const query = searchQuery.toLowerCase();
                            const name = (resident.full_name || '').toLowerCase();
                            const email = (resident.email || '').toLowerCase();
                            const phone = (resident.phone_number || '').toLowerCase();
                            return name.includes(query) || email.includes(query) || phone.includes(query);
                          })
                          .map((resident) => {
                            // Use full_name if available, otherwise fallback to email or generated name
                            const displayName = resident.full_name || `${t('profile.resident')} ${resident.id.substring(0, 8)}...`;
                            const initials = (resident.full_name || resident.email || 'UN').substring(0, 2).toUpperCase();
                            
                            return (
                              <div key={resident.id} className="flex items-center space-x-4 border p-3 rounded-lg hover:bg-gray-50">
                                <RadioGroupItem value={resident.id} id={resident.id} />
                                <Label htmlFor={resident.id} className="flex items-center gap-3 cursor-pointer flex-1">
                                  <Avatar>
                                    <AvatarFallback>{initials}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col flex-1">
                                    <span className="font-medium">{displayName}</span>
                                    <div className="flex gap-2 text-xs text-gray-500">
                                      {resident.email && <span>{resident.email}</span>}
                                      {resident.phone_number && resident.email && <span>•</span>}
                                      {resident.phone_number && <span>{resident.phone_number}</span>}
                                      {!resident.email && !resident.phone_number && <span>{t('profile.resident')}</span>}
                                    </div>
                                  </div>
                                </Label>
                              </div>
                            );
                          })}
                        {eligibleSuccessors.filter((resident) => {
                          // Filter out syndics
                          if (resident.role === 'syndic') return false;
                          if (!searchQuery) return false;
                          const query = searchQuery.toLowerCase();
                          const name = (resident.full_name || '').toLowerCase();
                          const email = (resident.email || '').toLowerCase();
                          const phone = (resident.phone_number || '').toLowerCase();
                          return name.includes(query) || email.includes(query) || phone.includes(query);
                        }).length === 0 && eligibleSuccessors.filter((r: any) => r.role !== 'syndic').length > 0 && (
                          <div className="p-4 text-center text-gray-500">
                            {t('profile.noResidentsMatchSearch')}
                          </div>
                        )}
                      </div>
                    </RadioGroup>
                  </ScrollArea>
                  
                  {selectedSuccessorIsSyndic && (
                    <Alert className="bg-red-50 text-red-800 border-red-200 mt-4">
                      <AlertCircle className="h-4 w-4 text-red-800" />
                      <AlertDescription>
                        {t('profile.cannotSelectSyndicAsSuccessorFull')}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={handleReset} disabled={isProcessing}>
                  {t('common.cancel')}
                </Button>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    console.log('[DeleteAccount] Step 4 button clicked, selectedSuccessorId:', selectedSuccessorId);
                    if (!selectedSuccessorId) {
                      toast.error(t('profile.pleaseSelectSuccessorBeforeSubmit'));
                      return;
                    }
                    if (selectedSuccessorIsSyndic) {
                      toast.error(t('profile.cannotSelectSyndicAsSuccessor'));
                      return;
                    }
                    handleSyndicDelete();
                  }}
                  disabled={!selectedSuccessorId || isProcessing || selectedSuccessorIsSyndic}
                >
                  {isProcessing ? t('profile.submittingRequest') : t('profile.submitDeletionRequest')}
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === 3 && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
              <p className="text-sm text-muted-foreground">{t('profile.deletingYourAccount')}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
