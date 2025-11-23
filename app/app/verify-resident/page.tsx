'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, AlertCircle, Mail, KeyRound, LogIn } from 'lucide-react';
import config from '@/config';

export default function VerifyResidentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'instructions' | 'error' | 'already-verified' | 'expired'>('loading');
  const [message, setMessage] = useState('');
  const [residentName, setResidentName] = useState('');
  const [residentEmail, setResidentEmail] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    // Store token in sessionStorage for use after authentication
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('verification_token', token);
    }

    // First check the token status
    fetch(`/api/residents/verify?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        
        if (!data.success) {
          setStatus('error');
          setMessage(data.error || 'Invalid verification token');
          return;
        }

        if (data.alreadyVerified) {
          setStatus('already-verified');
          setMessage('Your account is already verified. You can sign in now.');
          setResidentName(data.residentName || '');
          return;
        }

        if (data.tokenExpired) {
          setStatus('expired');
          setMessage('This verification link has expired. Please contact your building syndic to resend the verification email.');
          return;
        }

        // Token is valid, show instructions
        setResidentName(data.residentName || '');
        setResidentEmail(data.residentEmail || '');
        setStatus('instructions');
      })
      .catch((error) => {
        console.error('Error checking verification token:', error);
        setStatus('error');
        setMessage('An error occurred while checking your verification link. Please try again later.');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">{config.metadata.title}</CardTitle>
          <CardDescription className="text-center">
            Email Verification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Checking verification link...</p>
            </div>
          )}

          {status === 'instructions' && (
            <div className="space-y-6">
              <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                <Mail className="h-4 w-4 text-blue-600" />
                <AlertTitle>Welcome, {residentName}!</AlertTitle>
                <AlertDescription>
                  To complete your account verification, please follow these steps:
                </AlertDescription>
              </Alert>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  Verification Instructions
                </h3>
                <ol className="list-decimal pl-5 space-y-3 text-sm text-gray-700">
                  <li>
                    <strong>Click the "Sign In with Google" button below</strong>
                  </li>
                  <li>
                    <strong>Use the same email address:</strong> {residentEmail || 'the email you received this link at'}
                  </li>
                  <li>
                    <strong>Complete the sign-in process</strong> with your Google account
                  </li>
                  <li>
                    <strong>Your account will be automatically verified</strong> after successful authentication
                  </li>
                </ol>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={async () => {
                    if (!token) return;
                    
                    try {
                      console.log('[VerifyResidentPage] Setting verification cookie for token:', token.substring(0, 10) + '...');
                      
                      // Set the verification token in an HTTP-only cookie via API
                      const response = await fetch('/api/residents/set-verification-cookie', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ token }),
                        credentials: 'include', // Important: include credentials to ensure cookie is set
                      });

                      const responseData = await response.json();
                      console.log('[VerifyResidentPage] Cookie set response:', responseData);

                      if (response.ok) {
                        // Wait a moment to ensure cookie is set and persisted
                        await new Promise(resolve => setTimeout(resolve, 200));
                        
                        console.log('[VerifyResidentPage] Redirecting to sign-in with token in URL as backup');
                        // Redirect to sign-in with token as query param as backup
                        // The cookie should be the primary method, but query param is a fallback
                        router.push(`/auth/signin?verification_token=${encodeURIComponent(token)}`);
                      } else {
                        console.error('[VerifyResidentPage] Failed to set verification cookie:', responseData);
                        setStatus('error');
                        setMessage('Failed to prepare verification. Please try again.');
                      }
                    } catch (error) {
                      console.error('[VerifyResidentPage] Error setting verification cookie:', error);
                      setStatus('error');
                      setMessage('An error occurred. Please try again.');
                    }
                  }}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                  size="lg"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In with Google
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Make sure to use the email address: <strong>{residentEmail || 'the one you received this link at'}</strong>
                </p>
              </div>
            </div>
          )}

          {status === 'already-verified' && (
            <Alert className="bg-blue-50 border-blue-200 text-blue-800">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              <AlertTitle>Already Verified</AlertTitle>
              <AlertDescription>
                {message}
              </AlertDescription>
            </Alert>
          )}

          {status === 'expired' && (
            <Alert className="bg-amber-50 border-amber-200 text-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle>Link Expired</AlertTitle>
              <AlertDescription>
                {message}
              </AlertDescription>
            </Alert>
          )}

          {status === 'error' && (
            <Alert className="bg-red-50 border-red-200 text-red-800">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertTitle>Verification Failed</AlertTitle>
              <AlertDescription>
                {message}
              </AlertDescription>
            </Alert>
          )}

          {(status === 'success' || status === 'already-verified') && (
            <div className="space-y-2">
              <Button
                onClick={() => router.push('/auth/signin')}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white"
              >
                Go to Sign In
              </Button>
            </div>
          )}

          {status === 'expired' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                Please contact your building syndic to request a new verification email.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

