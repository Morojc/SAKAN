'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, FileText, CheckCircle2, XCircle, Loader2, AlertCircle, Eye, X, CreditCard, LogOut } from 'lucide-react';
import { uploadDocument, getDocumentStatus, cancelSubmission } from './actions';
import { toast } from 'react-hot-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { signOut, useSession } from 'next-auth/react';
import { AuthNavigationManager } from '@/lib/auth-navigation';

export default function DocumentUploadPage() {
	const router = useRouter();
	const { data: session } = useSession();
	const [file, setFile] = useState<File | null>(null);
	const [idCardFile, setIdCardFile] = useState<File | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [isCanceling, setIsCanceling] = useState(false);
	const [submission, setSubmission] = useState<any>(null);
	const [isLoadingStatus, setIsLoadingStatus] = useState(true);
	const [showCancelDialog, setShowCancelDialog] = useState(false);

	// Save auth state
	useEffect(() => {
		if (session?.user?.id) {
			AuthNavigationManager.saveAuthState(session.user.id);
		}
	}, [session?.user?.id]);

	// Prevent back navigation during document upload flow
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

	useEffect(() => {
		loadStatus();
	}, []);

	const loadStatus = async () => {
		setIsLoadingStatus(true);
		const result = await getDocumentStatus();
		if (result.success && result.submission) {
			setSubmission(result.submission);
		}
		setIsLoadingStatus(false);
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'proces-verbal' | 'id-card') => {
		const selectedFile = e.target.files?.[0];
		if (selectedFile) {
			// Validate file type
			const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
			if (!allowedTypes.includes(selectedFile.type)) {
				toast.error(`Invalid file type for ${type === 'proces-verbal' ? 'procès verbal' : 'ID card'}. Please upload a PDF or image file.`);
				return;
			}

			// Validate file size (10MB)
			const maxSize = 10 * 1024 * 1024;
			if (selectedFile.size > maxSize) {
				toast.error(`File size too large. Maximum size is 10MB.`);
				return;
			}

			if (type === 'proces-verbal') {
				setFile(selectedFile);
			} else {
				setIdCardFile(selectedFile);
			}
		}
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		
		if (!file) {
			toast.error('Veuillez sélectionner le document procès verbal');
			return;
		}

		if (!idCardFile) {
			toast.error('Veuillez sélectionner la carte d\'identité');
			return;
		}

		setIsUploading(true);

		try {
			const formData = new FormData();
			formData.append('file', file);
			if (idCardFile) {
				formData.append('idCard', idCardFile);
			}

			const result = await uploadDocument(formData);

			if (result.success) {
				toast.success(result.message || 'Document uploaded successfully!');
				// Redirect immediately to verification pending page
				router.push('/app/verification-pending');
			} else {
				toast.error(result.error || 'Failed to upload document');
			}
		} catch (error) {
			console.error('Upload error:', error);
			toast.error('An error occurred. Please try again.');
		} finally {
			setIsUploading(false);
		}
	};

	const handleDeleteAccount = async () => {
		setIsCanceling(true);
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
				setIsCanceling(false);
			}
		} catch (error) {
			console.error('Delete account error:', error);
			toast.error('Une erreur s\'est produite. Veuillez réessayer.');
			setIsCanceling(false);
		}
	};

	if (isLoadingStatus) {
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

	return (
		<div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
			<div className="max-w-2xl mx-auto">
				<Card>
					<CardHeader>
						<div className="flex items-start justify-between">
							<div>
								<CardTitle className="text-2xl font-bold">Téléchargement du Procès Verbal</CardTitle>
								<CardDescription>
									Veuillez télécharger votre document "procès verbal" pour compléter votre vérification
								</CardDescription>
							</div>
							<div className="flex gap-2">
								{/* Sign out button */}
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => window.location.href = '/api/auth/signout'}
									disabled={isCanceling || isUploading}
									className="border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"
								>
									<LogOut className="h-4 w-4 mr-2" />
									<span className="hidden sm:inline">Se déconnecter</span>
								</Button>
								{/* Delete account button */}
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setShowCancelDialog(true)}
									disabled={isCanceling || isUploading}
									className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-6">
						{submission && submission.status === 'pending' && (
							<Alert className="bg-yellow-50 border-yellow-200 text-yellow-800">
								<AlertCircle className="h-4 w-4 text-yellow-600" />
								<AlertTitle>Document en attente de révision</AlertTitle>
								<AlertDescription>
									Votre document a été soumis le {new Date(submission.submitted_at).toLocaleDateString('fr-FR')} 
									et est en attente de révision par un administrateur.
								</AlertDescription>
							</Alert>
						)}

						{submission && submission.status === 'approved' && (
							<Alert className="bg-green-50 border-green-200 text-green-800">
								<CheckCircle2 className="h-4 w-4 text-green-600" />
								<AlertTitle>Document approuvé</AlertTitle>
								<AlertDescription>
									Votre document a été approuvé le {new Date(submission.reviewed_at).toLocaleDateString('fr-FR')}.
									Vous pouvez maintenant accéder à l'application.
								</AlertDescription>
							</Alert>
						)}

						{submission && submission.status === 'rejected' && (
							<Alert variant="destructive">
								<XCircle className="h-4 w-4" />
								<AlertTitle>Document rejeté</AlertTitle>
								<AlertDescription>
									{submission.rejection_reason ? (
										<>
											<strong>Raison:</strong> {submission.rejection_reason}
											<br />
											Veuillez télécharger un nouveau document.
										</>
									) : (
										'Votre document a été rejeté. Veuillez télécharger un nouveau document.'
									)}
								</AlertDescription>
							</Alert>
						)}

						<form onSubmit={handleSubmit} className="space-y-6">
							{/* Procès Verbal Document */}
							<div className="space-y-2">
								<label htmlFor="file-input" className="text-sm font-medium text-gray-700">
									Procès Verbal * (PDF, JPG, PNG)
								</label>
								<p className="text-xs text-muted-foreground">
									Document requis pour vérifier votre résidence
								</p>
								<div className="flex items-center justify-center w-full">
									<label
										htmlFor="file-input"
										className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
									>
										<div className="flex flex-col items-center justify-center pt-5 pb-6">
											{file ? (
												<>
													<FileText className="w-10 h-10 mb-2 text-gray-400" />
													<p className="mb-2 text-sm text-gray-500">
														<span className="font-semibold">{file.name}</span>
													</p>
													<p className="text-xs text-gray-500">
														{(file.size / 1024 / 1024).toFixed(2)} MB
													</p>
												</>
											) : (
												<>
													<Upload className="w-10 h-10 mb-2 text-gray-400" />
													<p className="mb-2 text-sm text-gray-500">
														<span className="font-semibold">Cliquez pour télécharger</span> ou glissez-déposez
													</p>
													<p className="text-xs text-gray-500">PDF, JPG ou PNG (MAX. 10MB)</p>
												</>
											)}
										</div>
										<input
											id="file-input"
											type="file"
											className="hidden"
											accept=".pdf,.jpg,.jpeg,.png"
											onChange={(e) => handleFileChange(e, 'proces-verbal')}
											disabled={isUploading || submission?.status === 'approved'}
										/>
									</label>
								</div>
							</div>

							{/* ID Card Document */}
							<div className="space-y-2">
								<label htmlFor="id-card-input" className="text-sm font-medium text-gray-700">
									Carte d'identité * (PDF, JPG, PNG)
								</label>
								<p className="text-xs text-muted-foreground">
									Pour confirmer les informations du syndic
								</p>
								<div className="flex items-center justify-center w-full">
									<label
										htmlFor="id-card-input"
										className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
									>
										<div className="flex flex-col items-center justify-center pt-5 pb-6">
											{idCardFile ? (
												<>
													<CreditCard className="w-10 h-10 mb-2 text-gray-400" />
													<p className="mb-2 text-sm text-gray-500">
														<span className="font-semibold">{idCardFile.name}</span>
													</p>
													<p className="text-xs text-gray-500">
														{(idCardFile.size / 1024 / 1024).toFixed(2)} MB
													</p>
												</>
											) : (
												<>
													<CreditCard className="w-10 h-10 mb-2 text-gray-400" />
													<p className="mb-2 text-sm text-gray-500">
														<span className="font-semibold">Cliquez pour télécharger</span> ou glissez-déposez
													</p>
													<p className="text-xs text-gray-500">PDF, JPG ou PNG (MAX. 10MB)</p>
												</>
											)}
										</div>
										<input
											id="id-card-input"
											type="file"
											className="hidden"
											accept=".pdf,.jpg,.jpeg,.png"
											onChange={(e) => handleFileChange(e, 'id-card')}
											disabled={isUploading || submission?.status === 'approved'}
										/>
									</label>
								</div>
							</div>

							{(submission?.document_url || submission?.id_card_url) && (
								<div className="flex items-center gap-2 flex-wrap">
									{submission?.document_url && (
										<Button
											type="button"
											variant="outline"
											onClick={() => window.open(submission.document_url, '_blank')}
											className="border-gray-300 text-gray-700 hover:bg-gray-50"
										>
											<Eye className="mr-2 h-4 w-4" />
											Voir le procès verbal
										</Button>
									)}
									{submission?.id_card_url && (
										<Button
											type="button"
											variant="outline"
											onClick={() => window.open(submission.id_card_url, '_blank')}
											className="border-gray-300 text-gray-700 hover:bg-gray-50"
										>
											<Eye className="mr-2 h-4 w-4" />
											Voir la carte d'identité
										</Button>
									)}
								</div>
							)}

							<div className="flex gap-3">
								<Button
									type="submit"
									disabled={!file || !idCardFile || isUploading || (submission?.status === 'approved')}
									className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{isUploading ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Téléchargement...
										</>
									) : (
										<>
											<Upload className="mr-2 h-4 w-4" />
											{submission?.status === 'pending' 
												? 'Remplacer' 
												: submission?.status === 'rejected'
												? 'Télécharger un nouveau document'
												: 'Télécharger'}
										</>
									)}
								</Button>

								{/* Delete account button - always visible */}
								<Button
									type="button"
									variant="destructive"
									onClick={() => setShowCancelDialog(true)}
									disabled={isCanceling || isUploading}
									className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{isCanceling ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Suppression...
										</>
									) : (
										<>
											<X className="mr-2 h-4 w-4" />
											Supprimer mon compte
										</>
									)}
								</Button>
							</div>

							{submission?.status === 'pending' && (
								<Button
									type="button"
									variant="outline"
									onClick={() => router.push('/app/verification-pending')}
									className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
								>
									Voir le statut de vérification
								</Button>
							)}
						</form>

						{/* Cancel Confirmation Dialog */}
						<Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
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
										onClick={() => setShowCancelDialog(false)}
										disabled={isCanceling}
									>
										Annuler
									</Button>
									<Button
										className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
										variant="destructive"
										onClick={async () => {
											setShowCancelDialog(false);
											await handleDeleteAccount();
										}}
										disabled={isCanceling}
									>
										{isCanceling ? (
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

						<div className="text-sm text-muted-foreground space-y-2">
							<p className="font-semibold">Instructions:</p>
							<ul className="list-disc list-inside space-y-1 ml-2">
								<li>Le procès verbal est <strong>requis</strong> pour la vérification</li>
								<li>La carte d'identité est <strong>requise</strong> et recommandée pour confirmer les informations du syndic</li>
								<li>Les documents doivent être des fichiers PDF, JPG ou PNG</li>
								<li>La taille maximale est de 10MB par fichier</li>
								<li>Assurez-vous que les documents sont lisibles et complets</li>
								<li>Vos documents seront révisés par un administrateur</li>
							</ul>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

