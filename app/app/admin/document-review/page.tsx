'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, Clock, Eye, Loader2, RefreshCw, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Submission {
	id: number;
	user_id: string;
	document_url: string;
	id_card_url?: string;
	status: 'pending' | 'approved' | 'rejected';
	submitted_at: string;
	reviewed_at?: string;
	rejection_reason?: string;
	profiles?: {
		id: string;
		full_name: string;
		email_verified: boolean;
	};
}

export default function AdminDocumentReviewPage() {
	const [submissions, setSubmissions] = useState<Submission[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
	const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
	const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
	const [rejectionReason, setRejectionReason] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

	useEffect(() => {
		loadSubmissions();
	}, []);

	const loadSubmissions = async () => {
		setIsLoading(true);
		try {
			const response = await fetch('/api/admin/documents/review');
			const data = await response.json();

			if (data.success) {
				setSubmissions(data.submissions || []);
			} else {
				toast.error(data.error || 'Failed to load submissions');
			}
		} catch (error) {
			console.error('Error loading submissions:', error);
			toast.error('An error occurred');
		} finally {
			setIsLoading(false);
		}
	};

	const handleReview = (submission: Submission, action: 'approve' | 'reject') => {
		setSelectedSubmission(submission);
		setReviewAction(action);
		setRejectionReason('');
		setIsReviewDialogOpen(true);
	};

	const handleSubmitReview = async () => {
		if (!selectedSubmission || !reviewAction) return;

		if (reviewAction === 'reject' && !rejectionReason.trim()) {
			toast.error('Please provide a rejection reason');
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await fetch('/api/admin/documents/review', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					submissionId: selectedSubmission.id,
					action: reviewAction,
					rejectionReason: reviewAction === 'reject' ? rejectionReason : undefined,
				}),
			});

			const data = await response.json();

			if (data.success) {
				toast.success(data.message || 'Review submitted successfully');
				setIsReviewDialogOpen(false);
				setSelectedSubmission(null);
				setReviewAction(null);
				setRejectionReason('');
				loadSubmissions();
			} else {
				toast.error(data.error || 'Failed to submit review');
			}
		} catch (error) {
			console.error('Error submitting review:', error);
			toast.error('An error occurred');
		} finally {
			setIsSubmitting(false);
		}
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case 'approved':
				return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Approuvé</Badge>;
			case 'rejected':
				return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejeté</Badge>;
			default:
				return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
		}
	};

	const filteredSubmissions = filter === 'all' 
		? submissions 
		: submissions.filter(s => s.status === filter);

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-50 px-4 py-12">
				<div className="max-w-7xl mx-auto">
					<Card>
						<CardContent className="flex items-center justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 px-4 py-12">
			<div className="max-w-7xl mx-auto space-y-6">
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="text-2xl font-bold">Révision des documents</CardTitle>
								<CardDescription>
									Réviser et approuver les documents "procès verbal" soumis par les syndics
								</CardDescription>
							</div>
							<Button
								variant="outline"
								onClick={loadSubmissions}
								disabled={isLoading}
							>
								<RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
								Actualiser
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						<div className="flex gap-2 mb-4">
							<Button
								variant={filter === 'all' ? 'default' : 'outline'}
								size="sm"
								onClick={() => setFilter('all')}
							>
								Tous ({submissions.length})
							</Button>
							<Button
								variant={filter === 'pending' ? 'default' : 'outline'}
								size="sm"
								onClick={() => setFilter('pending')}
							>
								En attente ({submissions.filter(s => s.status === 'pending').length})
							</Button>
							<Button
								variant={filter === 'approved' ? 'default' : 'outline'}
								size="sm"
								onClick={() => setFilter('approved')}
							>
								Approuvés ({submissions.filter(s => s.status === 'approved').length})
							</Button>
							<Button
								variant={filter === 'rejected' ? 'default' : 'outline'}
								size="sm"
								onClick={() => setFilter('rejected')}
							>
								Rejetés ({submissions.filter(s => s.status === 'rejected').length})
							</Button>
						</div>

						{filteredSubmissions.length === 0 ? (
							<Alert>
								<AlertDescription>
									Aucune soumission {filter !== 'all' ? `avec le statut "${filter}"` : ''} trouvée.
								</AlertDescription>
							</Alert>
						) : (
							<div className="border rounded-lg overflow-hidden">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Syndic</TableHead>
											<TableHead>Date de soumission</TableHead>
											<TableHead>Statut</TableHead>
											<TableHead>Document</TableHead>
											<TableHead>Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredSubmissions.map((submission) => (
											<TableRow key={submission.id}>
												<TableCell>
													<div>
														<div className="font-medium">
															{submission.profiles?.full_name || 'N/A'}
														</div>
														<div className="text-sm text-muted-foreground">
															{submission.profiles?.email_verified ? (
																<span className="text-green-600">Email vérifié</span>
															) : (
																<span className="text-yellow-600">Email non vérifié</span>
															)}
														</div>
													</div>
												</TableCell>
												<TableCell>
													{new Date(submission.submitted_at).toLocaleString('fr-FR')}
												</TableCell>
												<TableCell>
													{getStatusBadge(submission.status)}
												</TableCell>
												<TableCell>
													<div className="flex gap-2">
														<Button
															variant="outline"
															size="sm"
															onClick={() => window.open(submission.document_url, '_blank')}
														>
															<Eye className="mr-2 h-4 w-4" />
															Procès Verbal
														</Button>
														{submission.id_card_url && (
															<Button
																variant="outline"
																size="sm"
																onClick={() => window.open(submission.id_card_url, '_blank')}
															>
																<Eye className="mr-2 h-4 w-4" />
																Carte ID
															</Button>
														)}
													</div>
												</TableCell>
												<TableCell>
													{submission.status === 'pending' ? (
														<div className="flex gap-2">
															<Button
																size="sm"
																onClick={() => handleReview(submission, 'approve')}
																className="bg-green-600 hover:bg-green-700"
															>
																<CheckCircle2 className="mr-2 h-4 w-4" />
																Approuver
															</Button>
															<Button
																size="sm"
																variant="destructive"
																onClick={() => handleReview(submission, 'reject')}
															>
																<XCircle className="mr-2 h-4 w-4" />
																Rejeter
															</Button>
														</div>
													) : (
														<span className="text-sm text-muted-foreground">
															{submission.reviewed_at && 
																`Révisé le ${new Date(submission.reviewed_at).toLocaleDateString('fr-FR')}`
															}
														</span>
													)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						)}
					</CardContent>
				</Card>

				<Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{reviewAction === 'approve' ? 'Approuver le document' : 'Rejeter le document'}
							</DialogTitle>
							<DialogDescription>
								{reviewAction === 'approve' 
									? 'Êtes-vous sûr de vouloir approuver ce document? L\'utilisateur pourra accéder à l\'application.'
									: 'Veuillez fournir une raison pour le rejet de ce document.'}
							</DialogDescription>
						</DialogHeader>

						{selectedSubmission && (
							<div className="space-y-4">
								<div className="bg-gray-50 p-4 rounded-lg space-y-2">
									<div className="text-sm">
										<span className="font-semibold">Syndic:</span> {selectedSubmission.profiles?.full_name || 'N/A'}
									</div>
									<div className="text-sm">
										<span className="font-semibold">Soumis le:</span> {new Date(selectedSubmission.submitted_at).toLocaleString('fr-FR')}
									</div>
								</div>

								{reviewAction === 'reject' && (
									<div className="space-y-2">
										<label className="text-sm font-medium">Raison du rejet *</label>
										<Textarea
											value={rejectionReason}
											onChange={(e) => setRejectionReason(e.target.value)}
											placeholder="Expliquez pourquoi ce document est rejeté..."
											rows={4}
										/>
									</div>
								)}
							</div>
						)}

						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => {
									setIsReviewDialogOpen(false);
									setSelectedSubmission(null);
									setReviewAction(null);
									setRejectionReason('');
								}}
								disabled={isSubmitting}
							>
								Annuler
							</Button>
							<Button
								onClick={handleSubmitReview}
								disabled={isSubmitting || (reviewAction === 'reject' && !rejectionReason.trim())}
								variant={reviewAction === 'approve' ? 'default' : 'destructive'}
							>
								{isSubmitting ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										En cours...
									</>
								) : (
									<>
										{reviewAction === 'approve' ? (
											<>
												<CheckCircle2 className="mr-2 h-4 w-4" />
												Approuver
											</>
										) : (
											<>
												<XCircle className="mr-2 h-4 w-4" />
												Rejeter
											</>
										)}
									</>
								)}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}

