'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { KeyRound, Loader2, AlertCircle, Mail } from 'lucide-react';
import config from '@/config';

export default function SignInPage() {
  const searchParams = useSearchParams();
  const verificationToken = searchParams.get('verification_token');
  
  const [email, setEmail] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [isReplacementEmail, setIsReplacementEmail] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [codeStatus, setCodeStatus] = useState<{
    valid: boolean;
    message?: string;
  } | null>(null);

  // Store verification token in cookie if present (via API route for HTTP-only cookie)
  useEffect(() => {
    if (verificationToken && typeof window !== 'undefined') {
      console.log('[SignIn] Found verification token in URL, setting cookie:', verificationToken.substring(0, 10) + '...');
      // Set cookie via API route to ensure it's HTTP-only and accessible to NextAuth
      fetch('/api/residents/set-verification-cookie', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: verificationToken }),
        credentials: 'include', // Important: include credentials
      }).then(async (res) => {
        const data = await res.json();
        console.log('[SignIn] Verification token cookie set response:', data);
      }).catch((error) => {
        console.error('[SignIn] Error storing verification token:', error);
      });
    }
  }, [verificationToken]);

  // Check if email is a replacement email
  const checkReplacementEmail = async (emailValue: string) => {
    if (!emailValue || !emailValue.includes('@')) {
      setIsReplacementEmail(false);
      return;
    }

    setCheckingEmail(true);
    try {
      const response = await fetch(`/api/account/check-replacement-email?email=${encodeURIComponent(emailValue)}`);
      const data = await response.json();
      
      setIsReplacementEmail(data.isReplacementEmail || false);
    } catch (error) {
      console.error('Error checking replacement email:', error);
      setIsReplacementEmail(false);
    } finally {
      setCheckingEmail(false);
    }
  };

  // Debounce email check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (email) {
        checkReplacementEmail(email);
      } else {
        setIsReplacementEmail(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [email]);

  const validateCode = async (code: string) => {
    if (!code || !email) return;
    
    setValidating(true);
    setCodeStatus(null);
    
    try {
      const response = await fetch('/api/account/validate-replacement-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, userEmail: email }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCodeStatus({
          valid: true,
          message: 'Code validé avec succès! Vous pouvez maintenant vous connecter.'
        });
        
        // After successful validation, proceed with Google sign-in
        setTimeout(() => {
          handleGoogleSignIn();
        }, 1500);
      } else {
        setCodeStatus({
          valid: false,
          message: data.message || 'Code invalide'
        });
      }
    } catch (error) {
      console.error('Error validating code:', error);
      setCodeStatus({
        valid: false,
        message: 'Erreur lors de la validation du code. Veuillez réessayer.'
      });
    } finally {
      setValidating(false);
    }
  };

  const handleGoogleSignIn = async () => {
    await signIn('google', { callbackUrl: '/app' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">{config.metadata.title}</CardTitle>
          <CardDescription className="text-center">
            Sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Input - Optional, to check if user is a replacement email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email (Optionnel)</Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="Entrez votre email pour vérifier"
                className="pl-9"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setCodeStatus(null);
                }}
                disabled={checkingEmail}
              />
            </div>
            {checkingEmail && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Vérification en cours...
              </p>
            )}
          </div>

          {/* Access Code Section - Only shown if email is a replacement email */}
          {isReplacementEmail && (
            <div className="space-y-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                <Mail className="h-4 w-4 text-blue-600" />
                <AlertTitle>Code de validation requis</AlertTitle>
                <AlertDescription>
                  Vous avez été sélectionné comme nouveau syndic. Veuillez entrer le code de validation qui vous a été envoyé par email.
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
                    : "bg-amber-50 border-amber-200 text-amber-800"
                  }
                >
                  {codeStatus.valid ? (
                    <AlertCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {codeStatus.valid ? "Code validé" : "Code invalide"}
                  </AlertTitle>
                  <AlertDescription>
                    {codeStatus.message}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Sign in with
              </span>
            </div>
          </div>

          <Button 
            className="w-full flex items-center gap-2" 
            variant="outline" 
            onClick={handleGoogleSignIn}
            disabled={isReplacementEmail && !codeStatus?.valid}
          >
            <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>
          {isReplacementEmail && !codeStatus?.valid && (
            <p className="text-xs text-center text-amber-600">
              ⚠️ Vous devez valider le code avant de pouvoir vous connecter.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-xs text-center text-muted-foreground">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

