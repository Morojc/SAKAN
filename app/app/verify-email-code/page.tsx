'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, Loader2, AlertCircle, Mail, KeyRound, RefreshCw, X } from 'lucide-react';
import config from '@/config';
import { AuthNavigationManager } from '@/lib/auth-navigation';

export default function VerifyEmailCodePage() {
	const router = useRouter();
	const [code, setCode] = useState(['', '', '', '', '', '']);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isResending, setIsResending] = useState(false);
	const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
	const [message, setMessage] = useState('');
	const [userEmail, setUserEmail] = useState('');
	const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

	useEffect(() => {
		// Get user email from session
		fetch('/api/auth/session')
			.then(res => res.json())
			.then(data => {
				if (data?.user?.email) {
					setUserEmail(data.user.email);
				}
			})
			.catch(() => {
				// Ignore errors
			});
	}, []);

	const handleCodeChange = (index: number, value: string) => {
		// Allow alphanumeric characters (uppercase letters and numbers)
		// Convert to uppercase for consistency
		const upperValue = value.toUpperCase();
		if (upperValue && !/^[A-Z0-9]$/.test(upperValue)) {
			return;
		}

		const newCode = [...code];
		newCode[index] = upperValue;
		setCode(newCode);
		setStatus('idle');
		setMessage('');

		// Auto-focus next input
		if (upperValue && index < 5) {
			inputRefs.current[index + 1]?.focus();
		}

		// Auto-submit when all 6 characters are entered
		if (newCode.every(char => char !== '') && newCode.join('').length === 6) {
			handleSubmit(newCode.join(''));
		}
	};

	const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Backspace' && !code[index] && index > 0) {
			inputRefs.current[index - 1]?.focus();
		}
	};

	const handlePaste = (e: React.ClipboardEvent) => {
		e.preventDefault();
		const pastedData = e.clipboardData.getData('text').trim().toUpperCase();
		// Extract alphanumeric characters only
		const chars = pastedData.replace(/[^A-Z0-9]/g, '').slice(0, 6).split('');

		if (chars.length === 6) {
			const newCode = [...chars, ...Array(6 - chars.length).fill('')].slice(0, 6);
			setCode(newCode);
			setStatus('idle');
			setMessage('');
			// Focus last input
			inputRefs.current[5]?.focus();
			// Auto-submit
			setTimeout(() => handleSubmit(newCode.join('')), 100);
		}
	};

	const handleSubmit = async (codeToSubmit?: string) => {
		const codeValue = (codeToSubmit || code.join('')).toUpperCase();
		
		if (codeValue.length !== 6) {
			setStatus('error');
			setMessage('Please enter a 6-character code');
			return;
		}

		setIsSubmitting(true);
		setStatus('idle');
		setMessage('');

		try {
			const response = await fetch('/api/verify-email-code', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: codeValue }),
			});

			const data = await response.json();

			if (data.success) {
				setStatus('success');
				setMessage(data.message || 'Email verified successfully!');
				// Redirect to document upload after 1.5 seconds
				setTimeout(() => {
					router.push('/app/document-upload');
				}, 1500);
			} else {
				setStatus('error');
				setMessage(data.error || 'Invalid verification code');
				// Clear code on error
				setCode(['', '', '', '', '', '']);
				inputRefs.current[0]?.focus();
			}
		} catch (error) {
			console.error('Error verifying code:', error);
			setStatus('error');
			setMessage('An error occurred. Please try again.');
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleResendCode = async () => {
		setIsResending(true);
		setMessage('');

		try {
			const response = await fetch('/api/verify-email-code', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
			});

			const data = await response.json();

			if (data.success) {
				setStatus('success');
				setMessage('Verification code sent! Please check your email.');
				// Clear code inputs
				setCode(['', '', '', '', '', '']);
				inputRefs.current[0]?.focus();
			} else {
				setStatus('error');
				setMessage(data.error || 'Failed to resend code. Please try again.');
			}
		} catch (error) {
			console.error('Error resending code:', error);
			setStatus('error');
			setMessage('An error occurred. Please try again.');
		} finally {
			setIsResending(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
			<Card className="w-full max-w-md">
				<CardHeader className="space-y-1">
					<div className="flex items-center justify-between">
						<div className="flex-1">
							<CardTitle className="text-2xl font-bold text-center">{config.metadata.title}</CardTitle>
							<CardDescription className="text-center">
								Vérification de l'email
							</CardDescription>
						</div>
						<Button
							variant="ghost"
							size="icon"
							onClick={async (e) => {
								e.preventDefault();
								e.stopPropagation();
								
								// Mark logout as user action
								AuthNavigationManager.markLogout();
								AuthNavigationManager.clearAuthState();
								
								// Sign out and redirect to sign in page
								window.location.replace('/api/auth/signout?callbackUrl=/api/auth/signin');
							}}
							className="text-gray-400 hover:text-gray-600"
							title="Quitter"
						>
							<X className="h-5 w-5" />
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-6">
					<Alert className="bg-blue-50 border-blue-200 text-blue-800">
						<Mail className="h-4 w-4 text-blue-600" />
						<AlertTitle>Code de vérification envoyé</AlertTitle>
						<AlertDescription>
							{userEmail ? (
								<>Nous avons envoyé un code de vérification à <strong>{userEmail}</strong></>
							) : (
								'Nous avons envoyé un code de vérification à votre adresse email'
							)}
						</AlertDescription>
					</Alert>

					<div className="space-y-4">
						<label className="text-sm font-medium text-gray-700">
							Entrez le code à 6 caractères (lettres et chiffres)
						</label>
						<div className="flex gap-2 justify-center" onPaste={handlePaste}>
							{code.map((char, index) => (
															<Input
																key={index}
																ref={(el) => { inputRefs.current[index] = el }}
																type="text"
																inputMode="text"
																maxLength={1}
									value={char}
									onChange={(e) => handleCodeChange(index, e.target.value)}
									onKeyDown={(e) => handleKeyDown(index, e)}
									className="w-12 h-14 text-center text-2xl font-bold uppercase"
									disabled={isSubmitting}
									autoFocus={index === 0}
									style={{ textTransform: 'uppercase' }}
								/>
							))}
						</div>
					</div>

					{status === 'success' && (
						<Alert className="bg-green-50 border-green-200 text-green-800">
							<CheckCircle2 className="h-4 w-4 text-green-600" />
							<AlertDescription>{message}</AlertDescription>
						</Alert>
					)}

					{status === 'error' && (
						<Alert variant="destructive">
							<XCircle className="h-4 w-4" />
							<AlertDescription>{message}</AlertDescription>
						</Alert>
					)}

					<div className="flex flex-col gap-3">
						<Button
							onClick={() => handleSubmit()}
							disabled={isSubmitting || code.join('').length !== 6}
							className="w-full"
						>
							{isSubmitting ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Vérification...
								</>
							) : (
								<>
									<KeyRound className="mr-2 h-4 w-4" />
									Vérifier
								</>
							)}
						</Button>

						<Button
							variant="outline"
							onClick={handleResendCode}
							disabled={isResending}
							className="w-full"
						>
							{isResending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Envoi...
								</>
							) : (
								<>
									<RefreshCw className="mr-2 h-4 w-4" />
									Renvoyer le code
								</>
							)}
						</Button>
					</div>

					<div className="text-center text-sm text-muted-foreground">
						<p>Le code est valide pendant 15 minutes.</p>
						<p className="mt-1">Le code contient des lettres majuscules et des chiffres.</p>
						<p className="mt-1">Si vous ne recevez pas le code, vérifiez votre dossier spam.</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

