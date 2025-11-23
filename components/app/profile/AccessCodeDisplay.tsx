'use client';

import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, KeyRound, Loader2, AlertCircle, CheckCircle2, X, Info } from 'lucide-react';
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
  const [isCancelling, setIsCancelling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCancelCode = async (reason: 'timeout' | 'user_cancel' | 'browser_close') => {
    // Don't cancel if code is already used
    if (codeStatus === 'used') {
      return;
    }

    try {
      setIsCancelling(true);
      const response = await fetch(`/api/account/cancel-code?code=${code}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        if (reason === 'timeout') {
          toast.error('Time expired. The access code has been invalidated.');
          setCodeStatus('expired');
          
          // Close dialog automatically after timeout
          setTimeout(() => {
            onClose();
            router.refresh();
          }, 3000);
        } else if (reason === 'browser_close') {
          // Silent cancellation for browser close
          console.log('[AccessCodeDisplay] Code cancelled due to browser close');
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
      // Only show error if it's a user-initiated cancel
      if (reason === 'user_cancel') {
        toast.error('Failed to cancel code. Please try again.');
      }
    } finally {
      setIsCancelling(false);
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

        // If code is not found (and we have time remaining), it means it was deleted by the trigger
        // which happens ONLY when code_used = true (Success)
        // Note: We removed the auto-deletion on failure/invalidation to distinguish this case
        if (data.status === 'used' || (data.status === 'not_found' && timeLeft > 5)) {
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
          setStatusMessage(`Waiting for ${replacementEmail} to sign in...`);
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

  // Handle browser tab close or connection failure
  useEffect(() => {
    if (actionType !== 'change_role' || codeStatus !== 'pending') {
      return;
    }

    // Handle beforeunload (browser tab close)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only show warning if code is still pending
      if (codeStatus === 'pending' && timeLeft > 0) {
        e.preventDefault();
        e.returnValue = 'The access code process is still pending. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    // Handle visibility change (tab switch, minimize, etc.)
    const handleVisibilityChange = () => {
      if (document.hidden && codeStatus === 'pending' && timeLeft > 0) {
        // Tab is hidden but don't cancel - just log
        console.log('[AccessCodeDisplay] Tab hidden, but keeping process active');
      }
    };

    // Handle page unload (actual navigation away)
    // Note: This is not 100% reliable, but we try to cancel the code
    const handleUnload = () => {
      if (codeStatus === 'pending' && timeLeft > 0) {
        // Try to cancel the code when user actually leaves
        // Use fetch with keepalive for better reliability
        fetch(`/api/account/cancel-code?code=${code}`, {
          method: 'DELETE',
          keepalive: true,
        }).catch(() => {
          // Ignore errors - the server-side timer will handle cleanup
          console.log('[AccessCodeDisplay] Could not cancel code on unload, server timer will handle it');
        });
      }
    };

    // Handle connection failures
    const handleOnline = () => {
      console.log('[AccessCodeDisplay] Connection restored');
    };

    const handleOffline = () => {
      console.log('[AccessCodeDisplay] Connection lost - process will continue when connection is restored');
      toast.error('Connection lost. The process will continue when your connection is restored.', {
        duration: 5000,
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('unload', handleUnload);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('unload', handleUnload);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [codeStatus, timeLeft, actionType, code]);

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
        {/* Email Sent Confirmation */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center space-y-2">
          <p className="text-sm text-green-800 font-medium">
            An access code has been generated and sent to:
          </p>
          <div className="flex items-center justify-center gap-2">
            <Mail className="h-4 w-4 text-green-700" />
            <span className="font-semibold text-green-900 text-lg">
              {replacementEmail}
            </span>
          </div>
          <p className="text-xs text-green-700 mt-2">
            Please ask the replacement resident to check their email inbox (and spam folder) for the code and instructions.
          </p>
        </div>

    

        {/* Instructions for Current Syndic */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
          <h4 className="font-semibold text-amber-900 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            What happens next?
          </h4>
          <div className="text-sm text-amber-800 space-y-2">
            <p>
              <strong>You must wait</strong> for {replacementEmail} to complete the sign-in process with the access code.
            </p>
            <p>
              {actionType === 'change_role' 
                ? "Once they successfully sign in, you'll be automatically signed out and your role will change to 'Resident'."
                : "Once they successfully sign in, your account will be permanently deleted and all your data will be transferred to them."}
            </p>
            <p className="font-medium mt-2">
              ⚠️ Important: Do not close this window or navigate away until the process is complete, or you can cancel the process using the button below.
            </p>
          </div>
        </div>

        {/* Timer Display */}
        {actionType === 'change_role' && codeStatus === 'pending' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <p className="text-sm font-medium text-amber-800 mb-1">
              Time remaining: <span className="font-mono text-lg font-bold text-amber-900">{formatTime(timeLeft)}</span>
            </p>
            <p className="text-xs text-amber-700">
              If the code is not used within this time, the process will be automatically cancelled.
            </p>
          </div>
        )}

        {/* Code Expiration Note */}
        <div className="bg-muted/50 border border-muted rounded-lg p-3">
          <p className="text-xs text-center text-muted-foreground">
            <Info className="h-3 w-3 inline mr-1" />
            Note: The access code expires in 7 days from creation. However, for role changes, you have 15 minutes to complete the process.
          </p>
        </div>

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

      <DialogFooter className="flex flex-col sm:flex-row gap-2">
        {/* Cancel Button - Only show for pending change_role */}
        {actionType === 'change_role' && codeStatus === 'pending' && (
          <Button 
            variant="destructive" 
            onClick={() => handleCancelCode('user_cancel')}
            disabled={isCancelling}
            className="w-full sm:w-auto"
          >
            {isCancelling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <X className="h-4 w-4 mr-2" />
                Cancel Process
              </>
            )}
          </Button>
        )}
        
        {/* Close Button */}
        <Button 
          onClick={onClose} 
          className="w-full sm:w-auto"
          disabled={
            (actionType === 'change_role' && codeStatus === 'checking') ||
            (actionType === 'change_role' && codeStatus === 'pending' && !isCancelling)
          }
          variant={actionType === 'change_role' && codeStatus === 'pending' ? 'outline' : 'default'}
        >
          {codeStatus === 'used' ? 'Close' : 
           actionType === 'change_role' && codeStatus === 'pending' ? 'Close (Process Active)' : 
           'Close'}
        </Button>
      </DialogFooter>
    </div>
  );
}

