'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { KeyRound, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import config from '@/config';
import toast from 'react-hot-toast';

interface ResidentVerificationGuardProps {
  children: React.ReactNode;
  needsVerification: boolean;
}

export default function ResidentVerificationGuard({ children, needsVerification }: ResidentVerificationGuardProps) {
  const { data: session } = useSession();
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isVerified, setIsVerified] = useState(!needsVerification);
  const [error, setError] = useState<string | null>(null);

  // Check verification status on mount
  useEffect(() => {
    if (needsVerification) {
      setIsVerified(false);
    } else {
      setIsVerified(true);
    }
  }, [needsVerification]);

  const handleValidate = async () => {
    if (!code.trim()) {
      setError('Please enter the verification code');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch('/api/residents/validate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to validate code');
        return;
      }

      if (data.success) {
        toast.success('Your account has been verified successfully!');
        setIsVerified(true);
        setCode('');
        // Reload the page to refresh the session
        window.location.reload();
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

  // If verified, show children
  if (isVerified) {
    return <>{children}</>;
  }

  // Show verification form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">{config.metadata.title}</CardTitle>
          <CardDescription className="text-center">
            Account Verification Required
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-blue-50 border-blue-200 text-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle>Verification Required</AlertTitle>
            <AlertDescription>
              Your account needs to be verified before you can access the application. 
              Please enter the verification code that was sent to your email address ({session?.user?.email}).
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="verification-code">Verification Code</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="verification-code"
                  placeholder="Enter your verification code"
                  className="pl-9"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && code) {
                      handleValidate();
                    }
                  }}
                  disabled={isValidating}
                />
              </div>
              <Button 
                onClick={handleValidate}
                disabled={!code || isValidating}
                className="bg-gray-900 hover:bg-gray-800 text-white"
              >
                {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
              </Button>
            </div>
            {error && (
              <Alert className="bg-red-50 border-red-200 text-red-800">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <div className="text-sm text-muted-foreground text-center space-y-2">
            <p>Didn't receive the code?</p>
            <p>Please contact your building syndic to resend the verification code.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

