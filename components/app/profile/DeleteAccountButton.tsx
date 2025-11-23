'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import TermsAndConditionsDialog from './TermsAndConditionsDialog';
import ReplacementResidentSelect from './ReplacementResidentSelect';
import ActionSelectionDialog from './ActionSelectionDialog';
import AccessCodeDisplay from './AccessCodeDisplay';
import AccessCodeValidation from './AccessCodeValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Trash2, AlertCircle } from 'lucide-react';

interface DeleteAccountButtonProps {
  userRole: string;
}

export default function DeleteAccountButton({ userRole }: DeleteAccountButtonProps) {
  // Steps:
  // 0: Idle
  // 1: Terms
  // 2: Replacement Select
  // 2.5: No Residents Confirmation
  // 3: Action Select
  // 4: API Call (Loading)
  // 5: Success (Show Code) - for delete_account
  // 6: Code Validation - for change_role
  
  const [step, setStep] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasNoResidents, setHasNoResidents] = useState(false);
  
  // Data collected through steps
  const [selectedResidentEmail, setSelectedResidentEmail] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<'delete_account' | 'change_role' | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');

  // Simple delete for non-syndics
  const [isSimpleDeleting, setIsSimpleDeleting] = useState(false);
  const [showSimpleConfirm, setShowSimpleConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleReset = () => {
    setStep(0);
    setSelectedResidentEmail('');
    setSelectedAction(null);
    setGeneratedCode('');
    setConfirmText('');
    setShowSimpleConfirm(false);
    setHasNoResidents(false);
  };

  const processSyndicRequest = async (email: string | null, action: 'delete_account' | 'change_role') => {
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          replacementEmail: email, // null if no residents
          actionType: action,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process request');
      }
      
      // If no replacement, account is deleted immediately, sign out
      if (!email) {
        toast.success('Account deleted successfully');
        await signOut({ callbackUrl: '/', redirect: true });
        return;
      }
      
      // Check if validation is required (for change_role)
      if (data.requiresValidation && action === 'change_role') {
        setGeneratedCode(data.accessCode);
        setStep(6); // Show code validation step
        toast.success('Access code sent to replacement user. Please wait for them to sign in, then enter the code.');
      } else {
        // For delete_account, show the code display
        setGeneratedCode(data.accessCode);
        setStep(5); // Success state
      }
      
    } catch (error: any) {
      console.error('Error processing request:', error);
      toast.error(error.message || 'An error occurred');
      if (hasNoResidents) {
        setStep(2.5); // Go back to no residents confirmation
      } else {
        setStep(3); // Go back to action selection
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNoResidentsDelete = async () => {
    setIsProcessing(true);
    setStep(4);
    await processSyndicRequest(null, 'delete_account');
  };

  const handleSimpleDelete = async () => {
    if (confirmText !== 'DELETE') {
      toast.error('Please type "DELETE" to confirm');
      return;
    }

    setIsSimpleDeleting(true);

    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Account deleted successfully');
        await signOut({ callbackUrl: '/', redirect: true });
      } else {
        toast.error(data.error || 'Failed to delete account');
        setIsSimpleDeleting(false);
      }
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account. Please try again.');
      setIsSimpleDeleting(false);
    }
  };

  // If not a syndic, show simple delete button (or hide it based on requirements)
  // But usually residents can delete their own accounts
  if (userRole !== 'syndic') {
    // Assuming we keep the original simple delete for residents
    // reusing the original code structure for non-syndics
    return (
      <div className="mt-8">
        {!showSimpleConfirm ? (
          <Button
            variant="destructive"
            onClick={() => setShowSimpleConfirm(true)}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Account
          </Button>
        ) : (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 space-y-4">
             {/* Simplified version of previous delete confirmation */}
             <h3 className="text-lg font-bold text-red-900">Delete Your Account</h3>
             <p className="text-sm text-red-800">
               This action cannot be undone. Type DELETE to confirm.
             </p>
             <input
               type="text"
               value={confirmText}
               onChange={(e) => setConfirmText(e.target.value)}
               className="w-full px-3 py-2 border border-red-300 rounded-md"
               placeholder="DELETE"
             />
             <div className="flex gap-3">
               <Button
                 variant="destructive"
                 onClick={handleSimpleDelete}
                 disabled={isSimpleDeleting || confirmText !== 'DELETE'}
               >
                 {isSimpleDeleting ? 'Deleting...' : 'Confirm Delete'}
               </Button>
               <Button variant="outline" onClick={handleReset} disabled={isSimpleDeleting}>
                 Cancel
               </Button>
             </div>
          </div>
        )}
      </div>
    );
  }

  // Syndic Flow
  return (
    <div className="mt-8">
      <Button
        variant="destructive"
        onClick={() => setStep(1)}
        className="bg-red-600 hover:bg-red-700 text-white"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete / Transfer Account
      </Button>

      <Dialog open={step > 0} onOpenChange={(open) => !open && step !== 5 && handleReset()}>
        <DialogContent className="sm:max-w-[500px]">
          {step === 1 && (
            <TermsAndConditionsDialog
              onAccept={() => setStep(2)}
              onCancel={handleReset}
            />
          )}

          {step === 2 && (
            <ReplacementResidentSelect
              onSelect={(email) => {
                setSelectedResidentEmail(email);
                setStep(3);
              }}
              onNoResidents={() => {
                setHasNoResidents(true);
                setStep(2.5);
              }}
              onCancel={handleReset}
            />
          )}

          {step === 2.5 && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  Confirm Account Deletion
                </DialogTitle>
                <DialogDescription>
                  No residents available for transfer. Your account will be permanently deleted.
                </DialogDescription>
              </DialogHeader>

              <Alert className="bg-red-50 text-red-800 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-800" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription className="mt-2">
                  This action cannot be undone. Your account and the entire residence will be permanently deleted. 
                  All data including residence information, fees, payments, incidents, announcements, and all related records will be removed and cannot be recovered.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="confirm-delete">Type DELETE to confirm:</Label>
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
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleNoResidentsDelete}
                  disabled={confirmText !== 'DELETE' || isProcessing}
                >
                  {isProcessing ? 'Deleting...' : 'Delete My Account'}
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === 3 && (
            <ActionSelectionDialog
              onSelect={(action) => {
                // Set local state for the action
                setSelectedAction(action);
                
                // Set processing state immediately to show spinner
                setIsProcessing(true);
                setStep(4);

                // Trigger the API call with the passed action value
                // We use a separate function that takes the values as args to avoid closure staleness
                processSyndicRequest(selectedResidentEmail, action);
              }}
              onCancel={handleReset}
            />
          )}

          {step === 4 && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
              <p className="text-sm text-muted-foreground">Processing your request...</p>
            </div>
          )}

          {step === 5 && (
            <AccessCodeDisplay
              code={generatedCode}
              replacementEmail={selectedResidentEmail}
              actionType={selectedAction!}
              onClose={handleReset}
            />
          )}

          {step === 6 && (
            <AccessCodeValidation
              replacementEmail={selectedResidentEmail}
              onSuccess={async () => {
                toast.success('Role change completed! Your role is now Resident.');
                handleReset();
                // Refresh the page to update the UI
                window.location.reload();
              }}
              onCancel={handleReset}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
