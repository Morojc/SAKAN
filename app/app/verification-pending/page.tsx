'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, Loader2, Clock, FileText, RefreshCw, Upload, ArrowLeft } from 'lucide-react';
import { getDocumentStatus } from '../document-upload/actions';
import { toast } from 'react-hot-toast';

export default function VerificationPendingPage() {
	const router = useRouter();
	const [submission, setSubmission] = useState<any>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);

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

	const handleGoBack = () => {
		// Simply navigate back to document upload page
		router.push('/app/document-upload');
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
						<CardTitle className="text-2xl font-bold">Statut de vérification</CardTitle>
						<CardDescription>
							Suivez l'état de révision de votre document
						</CardDescription>
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

							<Button
								variant="outline"
								onClick={handleGoBack}
								disabled={isRefreshing}
								className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
							>
								<ArrowLeft className="mr-2 h-4 w-4" />
								Retour au téléchargement
							</Button>

							{(submission?.status === 'rejected' || !submission) && (
								<Button
									onClick={() => router.push('/app/document-upload')}
									className="flex-1"
								>
									<Upload className="mr-2 h-4 w-4" />
									{submission?.status === 'rejected' ? 'Télécharger un nouveau document' : 'Télécharger un document'}
								</Button>
							)}
						</div>

						<div className="text-sm text-muted-foreground text-center pt-4 border-t">
							<p>Cette page se met à jour automatiquement toutes les 30 secondes.</p>
							<p className="mt-1">Vous pouvez également cliquer sur "Actualiser" pour vérifier manuellement.</p>
						</div>
					</CardContent>
				</Card>

			</div>
		</div>
	);
}

