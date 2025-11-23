'use client';

import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, KeyRound, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

interface AccessCodeDisplayProps {
  code: string;
  replacementEmail: string;
  actionType: 'delete_account' | 'change_role';
  onClose: () => void;
}

export default function AccessCodeDisplay({ code, replacementEmail, actionType, onClose }: AccessCodeDisplayProps) {
  const [codeStatus, setCodeStatus] = useState<'pending' | 'used' | 'invalidated' | 'expired' | 'checking'>('pending');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes in seconds
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCancelCode = async (reason: 'timeout' | 'user_cancel') => {
    try {
      const response = await fetch(`/api/account/cancel-code?code=${code}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        if (reason === 'timeout') {
          toast.error('Time expired. The access code has been invalidated.');
          setCodeStatus('expired');
        } else {
          toast.success('Process cancelled. The access code has been invalidated.');
        }
      } else {
        const data = await response.json();
        // If code already used, just close
        if (data.error?.includes('already been used')) {
          toast('The code has already been used.', { icon: 'ℹ️' });
        } else {
          toast.error(data.error || 'Failed to cancel code');
        }
      }
    } catch (error) {
      console.error('Error cancelling code:', error);
      toast.error('Failed to cancel code. Please try again.');
    }
    
    // Stop polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    if (reason === 'user_cancel') {
      onClose();
    }
  };

  // Timer effect
  useEffect(() => {
    if (codeStatus !== 'pending' || actionType !== 'change_role') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleCancelCode('timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [codeStatus, actionType]);

  // Poll for code status if actionType is 'change_role'
  useEffect(() => {
    if (actionType !== 'change_role') {
      return; // Only poll for change_role
    }

    const checkStatus = async () => {
      try {
        // Don't set status to 'checking' to avoid resetting the timer or causing UI flicker
        // setCodeStatus('checking');
        
        const response = await fetch(`/api/account/check-code-status?code=${code}`);
        const data = await response.json();

        if (data.status === 'used') {
          // Code has been used successfully
          setCodeStatus('used');
          setStatusMessage('The replacement user has successfully signed in. Your role has been changed to Resident.');
          
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          // Show success message and sign out after a delay
          toast.success('Role change completed! You will be signed out.');
          setTimeout(async () => {
            onClose();
            // Sign out the current user as their role has changed
            await signOut({ callbackUrl: '/' });
          }, 2000);
        } else if (data.status === 'invalidated' || data.status === 'expired') {
          // Code has been invalidated or expired
          setCodeStatus(data.status);
          setStatusMessage(data.message || 'The code is no longer valid.');
          
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          // Show error and close after a delay
          toast.error('The access code has been invalidated. The process has been cancelled.');
          setTimeout(() => {
            onClose();
          }, 3000);
        } else if (data.status === 'pending') {
          // Code is still pending
          setCodeStatus('pending');
          const attemptsRemaining = data.attemptsRemaining || 0;
          setStatusMessage(
            attemptsRemaining > 0 
              ? `Waiting for ${replacementEmail} to sign in... (${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining)`
              : `Waiting for ${replacementEmail} to sign in...`
          );
        }
      } catch (error) {
        console.error('Error checking code status:', error);
        setCodeStatus('pending');
        setStatusMessage('Error checking code status. Please try again.');
      }
    };

    // Check immediately
    checkStatus();

    // Then poll every 3 seconds
    pollingIntervalRef.current = setInterval(checkStatus, 3000);

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [code, actionType, replacementEmail, onClose, router]);

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-green-600">
          <KeyRound className="h-5 w-5" />
          Access Code Generated
        </DialogTitle>
        <DialogDescription>
          An access code has been sent to {replacementEmail}. The replacement resident must use this code when signing in to claim the syndic role.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center space-y-2">
          <p className="text-sm text-green-800 font-medium">
            An access code has been generated and sent to:
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className="font-semibold text-green-900 text-lg">
              {replacementEmail}
            </span>
          </div>
          <p className="text-xs text-green-700 mt-2">
            Please ask the replacement resident to check their email inbox (and spam folder) for the code and instructions.
          </p>
        </div>

        <div className="text-sm space-y-3 bg-muted/30 p-4 rounded-lg">
          <h4 className="font-semibold flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Instructions sent to {replacementEmail}
          </h4>
          <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
            <li>Ask the replacement resident to go to the Sign In page.</li>
            <li>Enter the access code above in the "Access Code" field.</li>
            <li>Sign in with their Google account ({replacementEmail}).</li>
            <li>
              {actionType === 'delete_account' 
                ? "Once they sign in, your account will be permanently deleted."
                : "Once they sign in, your role will change to 'Resident'."}
            </li>
          </ol>
        </div>

        {actionType === 'change_role' && codeStatus === 'pending' && (
          <div className="text-center">
            <p className="text-sm font-medium text-amber-600">
              Time remaining: <span className="font-mono text-lg">{formatTime(timeLeft)}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              If the code is not used within this time, the process will be cancelled.
            </p>
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground italic">
          Note: The code expires in 7 days.
        </p>

        {/* Status display for change_role */}
        {actionType === 'change_role' && (
          <div className="mt-4">
            {codeStatus === 'checking' && (
              <Alert className="bg-blue-50 border-blue-200">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <AlertTitle>Checking status...</AlertTitle>
                <AlertDescription>Verifying if the replacement user has signed in.</AlertDescription>
              </Alert>
            )}
            
            {codeStatus === 'pending' && (
              <Alert className="bg-amber-50 border-amber-200">
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                <AlertTitle>Waiting for replacement user</AlertTitle>
                <AlertDescription>{statusMessage || `Waiting for ${replacementEmail} to sign in with the code...`}</AlertDescription>
              </Alert>
            )}
            
            {codeStatus === 'used' && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle>Success!</AlertTitle>
                <AlertDescription>{statusMessage || 'The replacement user has successfully signed in. Your role has been changed to Resident.'}</AlertDescription>
              </Alert>
            )}
            
            {(codeStatus === 'invalidated' || codeStatus === 'expired') && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Process Cancelled</AlertTitle>
                <AlertDescription>
                  {statusMessage || 'The access code is no longer valid. The role change process has been cancelled.'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        {actionType === 'change_role' && codeStatus === 'pending' ? (
          <Button 
            variant="outline" 
            className="w-full sm:w-auto opacity-50 cursor-not-allowed"
            disabled={true}
            title="Please wait for the replacement user to sign in"
          >
            Processing...
          </Button>
        ) : (
          <Button 
            onClick={onClose} 
            className="w-full sm:w-auto"
            disabled={actionType === 'change_role' && codeStatus === 'checking'}
          >
            {codeStatus === 'used' ? 'Close' : 'Close'}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}

