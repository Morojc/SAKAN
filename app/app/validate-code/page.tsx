'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { KeyRound, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import config from '@/config';

export default function ValidateCodePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [accessCode, setAccessCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [codeStatus, setCodeStatus] = useState<{
    valid: boolean;
    message?: string;
    attemptsRemaining?: number;
    codeDeleted?: boolean;
  } | null>(null);
  const [isReplacementEmail, setIsReplacementEmail] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is a replacement email
  useEffect(() => {
    const checkReplacementEmail = async () => {
      if (status === 'loading' || !session?.user?.email) {
        return;
      }

      if (status === 'unauthenticated') {
        router.push('/auth/signin');
        return;
      }

      try {
        const response = await fetch(`/api/account/check-replacement-email?email=${encodeURIComponent(session.user.email!)}`);
        const data = await response.json();
        
        if (data.isReplacementEmail) {
          setIsReplacementEmail(true);
        } else {
          // Not a replacement email, redirect to app
          router.push('/app');
        }
      } catch (error) {
        console.error('Error checking replacement email:', error);
        router.push('/app');
      } finally {
        setLoading(false);
      }
    };

    checkReplacementEmail();
  }, [session, status, router]);

  const validateCode = async (code: string) => {
    if (!code || !session?.user?.email) return;
    
    setValidating(true);
    setCodeStatus(null);
    
    try {
      const response = await fetch('/api/account/validate-replacement-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, userEmail: session.user.email }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCodeStatus({
          valid: true,
          message: 'Code validé avec succès! Votre rôle a été mis à jour. Redirection...',
          attemptsRemaining: 3
        });
        
        // Update role and transfer data immediately (since user is already authenticated)
        try {
          const updateResponse = await fetch('/api/account/complete-replacement', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code, userEmail: session.user.email }),
          });
          
          if (updateResponse.ok) {
            // Refresh session and redirect
            setTimeout(() => {
              window.location.href = '/app';
            }, 1500);
          } else {
            // Still redirect even if update fails (code is valid)
            setTimeout(() => {
              window.location.href = '/app';
            }, 1500);
          }
        } catch (error) {
          console.error('Error completing replacement:', error);
          // Still redirect
          setTimeout(() => {
            window.location.href = '/app';
          }, 1500);
        }
      } else {
        const attemptsRemaining = data.attemptsRemaining || 0;
        let message = data.message || 'Invalid code';
        
        if (!data.codeDeleted && attemptsRemaining > 0) {
          message += ` (${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining)`;
        }
        
        setCodeStatus({
          valid: false,
          message,
          attemptsRemaining,
          codeDeleted: data.codeDeleted || false
        });
        
        // If account was deleted (3 failed attempts), sign out and redirect
        if (data.accountDeleted) {
          toast.error('Account deleted due to too many failed attempts.');
          setTimeout(() => {
            signOut({ callbackUrl: '/auth/signin', redirect: true });
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error validating code:', error);
      setCodeStatus({
        valid: false,
        message: 'Error validating code. Please try again.'
      });
    } finally {
      setValidating(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!session || isReplacementEmail === false) {
    return null; // Will redirect
  }

  if (isReplacementEmail === null) {
    return null; // Still checking
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">{config.metadata.title}</CardTitle>
          <CardDescription className="text-center">
            Access Code Required
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-blue-50 border-blue-200 text-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle>Access Code Required</AlertTitle>
            <AlertDescription>
              You have been selected as a replacement syndic. Please enter the access code that was sent to your email ({session.user.email}) to claim the syndic role.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="access-code">Code de validation</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="access-code"
                  placeholder="Entrez votre code de validation"
                  className="pl-9"
                  value={accessCode}
                  onChange={(e) => {
                    setAccessCode(e.target.value.toUpperCase());
                    if (codeStatus) setCodeStatus(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && accessCode) {
                      validateCode(accessCode);
                    }
                  }}
                  disabled={validating}
                />
              </div>
              <Button 
                onClick={() => validateCode(accessCode)}
                disabled={!accessCode || validating}
                className="bg-gray-900 hover:bg-gray-800 text-white"
              >
                {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Valider'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Entrez le code à 8 caractères qui vous a été envoyé par email.
            </p>
          </div>

          {/* Validation Status */}
          {codeStatus && (
            <Alert 
              variant={codeStatus.valid ? "default" : "destructive"} 
              className={codeStatus.valid 
                ? "bg-green-50 border-green-200 text-green-800" 
                : codeStatus.codeDeleted 
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              }
            >
              {codeStatus.valid ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {codeStatus.valid 
                  ? "Code validé" 
                  : codeStatus.codeDeleted 
                    ? "Code invalidé"
                    : "Code invalide"
                }
              </AlertTitle>
              <AlertDescription>
                {codeStatus.message}
                {!codeStatus.valid && !codeStatus.codeDeleted && codeStatus.attemptsRemaining !== undefined && codeStatus.attemptsRemaining > 0 && (
                  <span className="block mt-2 text-xs font-semibold">
                    ⚠️ {codeStatus.attemptsRemaining} tentative{codeStatus.attemptsRemaining !== 1 ? 's' : ''} restante{codeStatus.attemptsRemaining !== 1 ? 's' : ''}. Après 3 tentatives échouées, votre compte sera supprimé.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

