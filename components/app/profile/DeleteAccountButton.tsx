'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import TermsAndConditionsDialog from './TermsAndConditionsDialog';
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
  // 2: Confirmation
  // 3: API Call (Loading)
  
  const [step, setStep] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Simple delete for non-syndics
  const [isSimpleDeleting, setIsSimpleDeleting] = useState(false);
  const [showSimpleConfirm, setShowSimpleConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleReset = () => {
    setStep(0);
    setConfirmText('');
    setShowSimpleConfirm(false);
  };

  const handleSyndicDelete = async () => {
    if (confirmText !== 'DELETE') {
      toast.error('Please type "DELETE" to confirm');
      return;
    }

    setIsProcessing(true);
    setStep(3);

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actionType: 'delete_account',
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account');
      }
      
      toast.success('Account deleted successfully');
      await signOut({ callbackUrl: '/', redirect: true });
      
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error(error.message || 'An error occurred');
      setIsProcessing(false);
      setStep(2); // Go back to confirmation
    }
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
        Delete Account
      </Button>

      <Dialog open={step > 0} onOpenChange={(open) => {
        if (!open) {
          handleReset();
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
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
                  Confirm Account Deletion
                </DialogTitle>
                <DialogDescription>
                  Your account will be permanently deleted. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>

              <Alert className="bg-red-50 text-red-800 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-800" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription className="mt-2">
                  This action cannot be undone. Your account and all associated data will be permanently deleted. 
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
                  onClick={handleSyndicDelete}
                  disabled={confirmText !== 'DELETE' || isProcessing}
                >
                  {isProcessing ? 'Deleting...' : 'Delete My Account'}
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === 3 && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
              <p className="text-sm text-muted-foreground">Deleting your account...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
