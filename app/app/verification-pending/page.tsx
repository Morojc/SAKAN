'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, Loader2, Clock, FileText, RefreshCw, Upload, LogOut, Trash2 } from 'lucide-react';
import { getDocumentStatus } from '../document-upload/actions';
import { toast } from 'react-hot-toast';
import { signOut, useSession } from 'next-auth/react';
import { AuthNavigationManager } from '@/lib/auth-navigation';

export default function VerificationPendingPage() {
	const router = useRouter();
	const { data: session } = useSession();
	const [submission, setSubmission] = useState<any>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	// Save auth state
	useEffect(() => {
		if (session?.user?.id) {
			AuthNavigationManager.saveAuthState(session.user.id);
		}
	}, [session?.user?.id]);

	// Prevent back navigation while on verification pending page
	useEffect(() => {
		// Push initial state
		window.history.pushState(null, '', window.location.href);

		const handlePopState = () => {
			// Push state again to prevent going back
			window.history.pushState(null, '', window.location.href);
		};

		// Add listener for back button
		window.addEventListener('popstate', handlePopState);

		return () => {
			window.removeEventListener('popstate', handlePopState);
		};
	}, []);

	// Setup proper logout handling
	useEffect(() => {
		const cleanup = AuthNavigationManager.preventBackAfterLogout();
		return cleanup;
	}, []);

	// Setup session refresh on page visibility
	useEffect(() => {
		const cleanup = AuthNavigationManager.setupVisibilityHandler(() => {
			loadStatus(true);
		});
		return cleanup;
	}, []);

	useEffect(() => {
		loadStatus();
		// Auto-refresh every 30 seconds
		const interval = setInterval(() => {
			loadStatus(true);
		}, 30000);

		return () => clearInterval(interval);
	}, []);

	const loadStatus = async (silent = false) => {
		if (!silent) {
			setIsLoading(true);
		} else {
			setIsRefreshing(true);
		}

		try {
			const result = await getDocumentStatus();
			if (result.success) {
				const previousStatus = submission?.status;
				setSubmission(result.submission);
				
				// If approved, redirect to dashboard immediately
				if (result.submission?.status === 'approved') {
					// Show success message if status just changed to approved
					if (previousStatus !== 'approved') {
						toast.success('Document approuvé ! Redirection vers le tableau de bord...');
					}
					// Redirect immediately
					router.push('/app');
				}
			}
		} catch (error) {
			console.error('Error loading status:', error);
			if (!silent) {
				toast.error('Failed to load status');
			}
		} finally {
			setIsLoading(false);
			setIsRefreshing(false);
		}
	};

	const handleDeleteAccount = async () => {
		setIsDeleting(true);
		try {
			const response = await fetch('/api/account/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			});

			const data = await response.json();

			if (data.success || response.ok) {
				toast.success('Compte supprimé avec succès. Déconnexion...');
				
				// Clear auth state
				AuthNavigationManager.clearAuthState();
				
				// Sign out and redirect to home
				await signOut({ redirect: false });
				
				// Force clean redirect to home without back navigation
				window.location.replace('/');
			} else {
				toast.error(data.error || 'Échec de la suppression du compte');
				setIsDeleting(false);
			}
		} catch (error) {
			console.error('Delete account error:', error);
			toast.error('Une erreur s\'est produite. Veuillez réessayer.');
			setIsDeleting(false);
		}
	};


	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<Card className="w-full max-w-2xl">
					<CardContent className="flex items-center justify-center py-12">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
					</CardContent>
				</Card>
			</div>
		);
	}

	const getStatusIcon = () => {
		switch (submission?.status) {
			case 'approved':
				return <CheckCircle2 className="h-12 w-12 text-green-600" />;
			case 'rejected':
				return <XCircle className="h-12 w-12 text-red-600" />;
			default:
				return <Clock className="h-12 w-12 text-yellow-600" />;
		}
	};

	const getStatusMessage = () => {
		switch (submission?.status) {
			case 'approved':
				return {
					title: 'Document approuvé!',
					description: 'Votre document a été approuvé. Vous allez être redirigé vers l\'application...',
					variant: 'success' as const,
				};
			case 'rejected':
				return {
					title: 'Document rejeté',
					description: submission?.rejection_reason || 'Votre document a été rejeté. Veuillez télécharger un nouveau document.',
					variant: 'destructive' as const,
				};
			default:
				return {
					title: 'En attente de révision',
					description: 'Votre document est en cours de révision par un administrateur. Vous recevrez une notification une fois la révision terminée.',
					variant: 'default' as const,
				};
		}
	};

	const statusInfo = getStatusMessage();

	return (
		<div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
			<div className="max-w-2xl mx-auto">
				<Card>
					<CardHeader>
						<div className="flex items-start justify-between">
							<div>
								<CardTitle className="text-2xl font-bold">Statut de vérification</CardTitle>
								<CardDescription>
									Suivez l'état de révision de votre document
								</CardDescription>
							</div>
							{/* Sign out button */}
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={async (e) => {
									e.preventDefault();
									e.stopPropagation();
									
									// Mark as user-initiated logout
									AuthNavigationManager.markLogout();
									AuthNavigationManager.clearAuthState();
									
									// Sign out and redirect
									await signOut({ redirect: false });
									window.location.replace('/');
								}}
								className="border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-70"
							>
								<LogOut className="h-4 w-4 mr-2" />
								<span className="hidden sm:inline">Se déconnecter</span>
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="flex flex-col items-center justify-center py-8 space-y-4">
							{getStatusIcon()}
							<div className="text-center">
								<h3 className="text-xl font-semibold mb-2">{statusInfo.title}</h3>
								<p className="text-muted-foreground">{statusInfo.description}</p>
							</div>
						</div>

						{submission && (
							<div className="space-y-4">
								<Alert className={submission.status === 'approved' ? 'bg-green-50 border-green-200' : 
									submission.status === 'rejected' ? 'bg-red-50 border-red-200' : 
									'bg-yellow-50 border-yellow-200'}>
									<FileText className="h-4 w-4" />
									<AlertTitle>Détails de la soumission</AlertTitle>
									<AlertDescription className="space-y-2 mt-2">
										<div className="grid grid-cols-2 gap-2 text-sm">
											<div>
												<span className="font-semibold">Soumis le:</span>
											</div>
											<div>
												{new Date(submission.submitted_at).toLocaleString('fr-FR')}
											</div>
											{submission.reviewed_at && (
												<>
													<div>
														<span className="font-semibold">Révisé le:</span>
													</div>
													<div>
														{new Date(submission.reviewed_at).toLocaleString('fr-FR')}
													</div>
												</>
											)}
											<div>
												<span className="font-semibold">Statut:</span>
											</div>
											<div className="capitalize">
												{submission.status === 'pending' && 'En attente'}
												{submission.status === 'approved' && 'Approuvé'}
												{submission.status === 'rejected' && 'Rejeté'}
											</div>
										</div>
									</AlertDescription>
								</Alert>
							</div>
						)}

						<div className="space-y-3">
							<div className="flex gap-3">
								<Button
									variant="outline"
									onClick={() => loadStatus()}
									disabled={isRefreshing}
									className="flex-1"
								>
									{isRefreshing ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Actualisation...
										</>
									) : (
										<>
											<RefreshCw className="mr-2 h-4 w-4" />
											Actualiser
										</>
									)}
								</Button>

								{(submission?.status === 'rejected' || !submission) && (
									<Button
										onClick={() => router.push('/app/document-upload')}
										className="flex-1 bg-blue-600 hover:bg-blue-700"
									>
										<Upload className="mr-2 h-4 w-4" />
										{submission?.status === 'rejected' ? 'Télécharger un nouveau document' : 'Télécharger un document'}
									</Button>
								)}
							</div>

							{/* Delete account button for rejected documents */}
							{submission?.status === 'rejected' && (
								<Button
									variant="destructive"
									onClick={() => setShowDeleteDialog(true)}
									disabled={isDeleting}
									className="w-full bg-red-600 hover:bg-red-700"
								>
									{isDeleting ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Suppression...
										</>
									) : (
										<>
											<Trash2 className="mr-2 h-4 w-4" />
											Supprimer mon compte
										</>
									)}
								</Button>
							)}
						</div>

						<div className="text-sm text-muted-foreground text-center pt-4 border-t">
							<p>Cette page se met à jour automatiquement toutes les 30 secondes.</p>
							<p className="mt-1">Vous pouvez également cliquer sur "Actualiser" pour vérifier manuellement.</p>
						</div>
					</CardContent>
				</Card>

				{/* Delete Account Confirmation Dialog */}
				<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Supprimer mon compte et me déconnecter</DialogTitle>
							<DialogDescription asChild>
								<div>
									<p className="text-sm text-muted-foreground">
										Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible et :
									</p>
									<ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
										<li>Supprimera définitivement votre compte utilisateur</li>
										<li>Supprimera tous vos documents soumis</li>
										<li>Supprimera votre profil et toutes les données associées</li>
										<li>Annulera vos abonnements et paiements</li>
										<li className="font-semibold text-red-600">Vous serez automatiquement déconnecté</li>
									</ul>
									<p className="mt-3 text-sm font-semibold text-red-600">Cette action ne peut pas être annulée.</p>
								</div>
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setShowDeleteDialog(false)}
								disabled={isDeleting}
							>
								Annuler
							</Button>
							<Button
								variant="destructive"
								className="bg-red-600 hover:bg-red-700"
								onClick={async () => {
									setShowDeleteDialog(false);
									await handleDeleteAccount();
								}}
								disabled={isDeleting}
							>
								{isDeleting ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Suppression...
									</>
								) : (
									'Oui, supprimer et me déconnecter'
								)}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

			</div>
		</div>
	);
}

