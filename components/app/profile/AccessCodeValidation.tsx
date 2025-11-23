'use client';

import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { KeyRound, CheckCircle, AlertCircle, Loader2, Mail } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface AccessCodeValidationProps {
  replacementEmail: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AccessCodeValidation({ replacementEmail, onSuccess, onCancel }: AccessCodeValidationProps) {
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingForReplacement, setWaitingForReplacement] = useState(false);

  const handleValidate = async () => {
    if (!code.trim()) {
      setError('Please enter the access code');
      return;
    }

    setIsValidating(true);
    setError(null);
    setWaitingForReplacement(false);

    try {
      const response = await fetch('/api/account/validate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.waitingForReplacement) {
          setWaitingForReplacement(true);
          setError(data.error || 'Waiting for replacement user to sign in');
        } else {
          setError(data.error || 'Failed to validate code');
        }
        return;
      }

      if (data.success) {
        toast.success('Role change completed successfully!');
        onSuccess();
      } else {
        setError(data.error || 'Validation failed');
      }
    } catch (error: any) {
      console.error('Error validating code:', error);
      setError('Failed to validate code. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-blue-600">
          <KeyRound className="h-5 w-5" />
          Validate Access Code
        </DialogTitle>
        <DialogDescription>
          Enter the access code that was sent to the replacement user to complete the role change.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <Alert className="bg-blue-50 text-blue-800 border-blue-200">
          <Mail className="h-4 w-4 text-blue-800" />
          <AlertTitle>Email Sent</AlertTitle>
          <AlertDescription className="mt-2">
            An access code has been sent to <strong>{replacementEmail}</strong>. 
            Please wait for them to sign in with the code, then enter the code below to complete the process.
          </AlertDescription>
        </Alert>

        {waitingForReplacement && (
          <Alert className="bg-amber-50 text-amber-800 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-800" />
            <AlertTitle>Waiting for Replacement User</AlertTitle>
            <AlertDescription className="mt-2">
              The replacement user has not yet signed in with the access code. 
              Please wait for them to complete the sign-in process, then try again.
            </AlertDescription>
          </Alert>
        )}

        {error && !waitingForReplacement && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="mt-2">{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="access-code">Access Code</Label>
          <Input
            id="access-code"
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(null);
              setWaitingForReplacement(false);
            }}
            placeholder="Enter access code"
            className="font-mono text-lg tracking-wider text-center"
            disabled={isValidating}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isValidating) {
                handleValidate();
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Enter the 8-character code that was sent to {replacementEmail}
          </p>
        </div>

        <div className="bg-muted/30 p-4 rounded-lg space-y-2">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Steps to Complete:
          </h4>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
            <li>Replacement user receives email with access code</li>
            <li>Replacement user goes to Sign In page</li>
            <li>Replacement user enters code and signs in</li>
            <li>You enter the same code here to complete the process</li>
          </ol>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onCancel} disabled={isValidating}>
          Cancel
        </Button>
        <Button 
          onClick={handleValidate} 
          disabled={!code.trim() || isValidating}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isValidating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              <KeyRound className="mr-2 h-4 w-4" />
              Validate Code
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}

