'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { KeyRound, Loader2, AlertCircle, CheckCircle2, Mail, ArrowRight } from 'lucide-react';
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
  const [showInstructions, setShowInstructions] = useState(true);

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

  // Show instructions first, then verification form
  if (showInstructions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">{config.metadata.title}</CardTitle>
            <CardDescription className="text-center">
              Welcome! Account Verification Required
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="bg-blue-50 border-blue-200 text-blue-800">
              <Mail className="h-4 w-4 text-blue-600" />
              <AlertTitle>Verification Code Sent</AlertTitle>
              <AlertDescription>
                A verification code has been sent to your email address: <strong>{session?.user?.email}</strong>
              </AlertDescription>
            </Alert>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Verification Instructions
              </h3>
              <ol className="list-decimal pl-5 space-y-3 text-sm text-gray-700">
                <li>
                  <strong>Check your email inbox</strong> ({session?.user?.email}) for a message from {config.metadata.title}
                </li>
                <li>
                  <strong>Look for the verification code</strong> - it's an 8-character alphanumeric code (e.g., ABC12345)
                </li>
                <li>
                  <strong>Click "Continue to Verification"</strong> below to proceed to the code entry screen
                </li>
                <li>
                  <strong>Enter the code</strong> exactly as shown in the email (case-insensitive)
                </li>
                <li>
                  <strong>Once verified</strong>, you'll have full access to your account and dashboard
                </li>
              </ol>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                <strong>Note:</strong> The verification code expires in 7 days. If you don't see the email, check your spam folder or contact support.
              </div>
            </div>

            <div className="flex flex-col space-y-2">
              <Button
                onClick={() => setShowInstructions(false)}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                size="lg"
              >
                Continue to Verification
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Can't find the email? Check your spam folder or contact your building syndic.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show verification form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">{config.metadata.title}</CardTitle>
          <CardDescription className="text-center">
            Enter Verification Code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-blue-50 border-blue-200 text-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle>Verification Required</AlertTitle>
            <AlertDescription>
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

          <div className="flex flex-col space-y-2">
            <Button
              onClick={() => setShowInstructions(true)}
              variant="outline"
              className="w-full"
            >
              Back to Instructions
            </Button>
            <div className="text-sm text-muted-foreground text-center space-y-2">
              <p>Didn't receive the code?</p>
              <p>Please contact your building syndic to resend the verification code.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

