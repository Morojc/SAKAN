'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calendar, FileText, Loader2 } from 'lucide-react';
import { getResidents, createCashPayment } from '@/app/actions/payments';
// Removed recurring fees import - using API endpoints instead
import toast from 'react-hot-toast';

interface AddPaymentDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}

/**
 * Add Payment Dialog Component
 * Form for recording cash payments
 */
export default function AddPaymentDialog({ open, onOpenChange, onSuccess }: AddPaymentDialogProps) {
	const [residents, setResidents] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [loadingFees, setLoadingFees] = useState(false);
	const [unpaidFees, setUnpaidFees] = useState<any[]>([]);
	const [selectedFeeIds, setSelectedFeeIds] = useState<number[]>([]);
	const [paymentMode, setPaymentMode] = useState<'fees' | 'custom'>('custom');

	// Form state
	const [selectedResident, setSelectedResident] = useState(''); // Format: "userId|apartmentNumber|profileResidenceId"
	const [amount, setAmount] = useState('');
	const [method, setMethod] = useState('cash');

	// Fetch residents when dialog opens
	useEffect(() => {
		if (open) {
			console.log('[AddPaymentDialog] Dialog opened, fetching residents');
			fetchResidents();
			// Reset form when dialog opens
			setSelectedResident('');
			setAmount('');
			setMethod('cash');
			setUnpaidFees([]);
			setSelectedFeeIds([]);
			setPaymentMode('custom');
		}
	}, [open]);

	// Fetch unpaid fees when resident is selected
	useEffect(() => {
		if (selectedResident) {
			const [userId] = selectedResident.split('|');
			fetchUnpaidFees(userId);
		} else {
			setUnpaidFees([]);
			setSelectedFeeIds([]);
			setPaymentMode('custom');
		}
	}, [selectedResident]);

	async function fetchResidents() {
		setLoading(true);
		try {
			const result = await getResidents();
			if (result.success) {
				console.log('[AddPaymentDialog] Residents fetched:', result.residents.length);
				setResidents(result.residents);
			} else {
				console.error('[AddPaymentDialog] Error:', result.error);
				toast.error(result.error || 'Failed to load residents');
			}
		} catch (error: any) {
			console.error('[AddPaymentDialog] Error fetching residents:', error);
			toast.error(error.message || 'Failed to load residents');
		} finally {
			setLoading(false);
		}
	}

	async function fetchUnpaidFees(residentId: string) {
		setLoadingFees(true);
		try {
			// Get residence ID first
			const resResponse = await fetch('/api/user/residence');
			const resResult = await resResponse.json();
			const residenceId = resResult.success ? resResult.data?.residence_id : null;

			if (!residenceId) {
				console.warn('[AddPaymentDialog] No residence ID found');
				setUnpaidFees([]);
				setLoadingFees(false);
				return;
			}

			// Fetch outstanding payments (fees and contributions)
			const response = await fetch(`/api/payments/outstanding?residenceId=${residenceId}&userId=${residentId}`);
			const result = await response.json();

			if (result.success && result.data) {
				// Combine fees and contributions into a single list
				const allOutstanding = [
					...result.data.fees.map((f: any) => ({ ...f, type: 'fee' })),
					...result.data.contributions.map((c: any) => ({ 
						...c, 
						type: 'contribution',
						title: `Contribution - ${c.period}`,
						amount: c.outstanding,
					})),
				];
				setUnpaidFees(allOutstanding);
				// Auto-switch to fees mode if outstanding items exist
				if (allOutstanding.length > 0) {
					setPaymentMode('fees');
				}
			} else {
				console.error('[AddPaymentDialog] Error fetching outstanding:', result.error);
				setUnpaidFees([]);
			}
		} catch (error) {
			console.error('[AddPaymentDialog] Error fetching unpaid fees:', error);
			toast.error('Failed to load unpaid fees');
			setUnpaidFees([]);
		} finally {
			setLoadingFees(false);
		}
	}

	const handleFeeToggle = (feeId: number) => {
		setSelectedFeeIds((prev) =>
			prev.includes(feeId)
				? prev.filter((id) => id !== feeId)
				: [...prev, feeId]
		);
	};

	const handleSelectAll = () => {
		if (selectedFeeIds.length === unpaidFees.length) {
			setSelectedFeeIds([]);
		} else {
			setSelectedFeeIds(unpaidFees.map((fee) => fee.id));
		}
	};

	const getTotalAmount = () => {
		return unpaidFees
			.filter((fee) => selectedFeeIds.includes(fee.id))
			.reduce((sum, fee) => sum + Number(fee.amount), 0);
	};

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		console.log('[AddPaymentDialog] Submitting payment');

		// Validation
		if (!selectedResident) {
			toast.error('Please select a resident');
			return;
		}

		setSubmitting(true);

		try {
			// Parse selected resident value: userId|apartmentNumber|profileResidenceId
			const [userId, apartmentNumber, profileResidenceId] = selectedResident.split('|');
			
			if (!userId || !apartmentNumber) {
				toast.error('Invalid resident selection. Please select a resident with an apartment number.');
				setSubmitting(false);
				return;
			}

			// Check if we're paying fees or custom amount
			if (paymentMode === 'fees' && selectedFeeIds.length > 0) {
				// Create payments for selected fees/contributions
				const selectedItems = unpaidFees.filter((item) => selectedFeeIds.includes(item.id));
				let successCount = 0;
				let errorCount = 0;

				for (const item of selectedItems) {
					try {
						const paymentResponse = await fetch('/api/payments', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								user_id: userId,
								apartment_number: apartmentNumber,
								amount: item.amount || item.outstanding,
								method: method,
								payment_type: item.type === 'fee' ? 'fee' : 'contribution',
								fee_id: item.type === 'fee' ? item.id : null,
								contribution_id: item.type === 'contribution' ? item.id : null,
								status: 'verified', // Syndic marking as paid is verified
							}),
						});

						const paymentResult = await paymentResponse.json();
						if (paymentResult.success) {
							successCount++;
						} else {
							errorCount++;
							console.error(`Failed to create payment for ${item.id}:`, paymentResult.error);
						}
					} catch (error: any) {
						errorCount++;
						console.error(`Error creating payment for ${item.id}:`, error);
					}
				}

				if (successCount > 0) {
					toast.success(`Successfully recorded ${successCount} payment(s)`);
					if (errorCount > 0) {
						toast.error(`${errorCount} payment(s) failed`);
					}
					resetForm();
					onSuccess();
				} else {
					toast.error('Failed to record payments');
				}
			} else {
				// Create custom payment (not linked to fees)
				if (!amount || Number(amount) <= 0) {
					toast.error('Please enter a valid amount');
					setSubmitting(false);
					return;
				}

				const result = await createCashPayment({
					userId: userId,
					apartmentNumber: apartmentNumber,
					profileResidenceId: profileResidenceId ? Number(profileResidenceId) : undefined,
					amount: Number(amount),
				});

				if (result.success) {
					console.log('[AddPaymentDialog] Payment created:', result.payment);
					toast.success('Cash payment recorded successfully!');
					resetForm();
					onSuccess();
				} else {
					console.error('[AddPaymentDialog] Error:', result.error);
					toast.error(result.error || 'Failed to record payment');
				}
			}
		} catch (error: any) {
			console.error('[AddPaymentDialog] Error creating payment:', error);
			toast.error(error.message || 'Failed to record payment');
		} finally {
			setSubmitting(false);
		}
	}

	const resetForm = () => {
		setSelectedResident('');
		setAmount('');
		setMethod('cash');
		setUnpaidFees([]);
		setSelectedFeeIds([]);
		setPaymentMode('custom');
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>Add Cash Payment</DialogTitle>
					<DialogDescription>
						Record a cash payment received from a resident. Select from unpaid fees or enter a custom amount.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="flex-1 overflow-auto">
					<div className="grid gap-4 py-4">
						{/* Resident Select */}
						<div className="grid gap-2">
							<Label htmlFor="resident">Resident *</Label>
							<Select
								value={selectedResident}
								onValueChange={setSelectedResident}
								disabled={loading}
							>
								<SelectTrigger id="resident">
									<SelectValue placeholder="Select a resident" />
								</SelectTrigger>
								<SelectContent>
									{loading ? (
										<SelectItem value="loading" disabled>
											Loading residents...
										</SelectItem>
									) : residents.length === 0 ? (
										<SelectItem value="empty" disabled>
											No residents found
										</SelectItem>
									) : (
										residents.map((resident) => {
											// Create composite value: userId|apartmentNumber|profileResidenceId
											const value = `${resident.id}|${resident.apartment_number || ''}|${resident.profile_residence_id || ''}`;
											return (
												<SelectItem key={`${resident.id}-${resident.apartment_number || 'no-apt'}-${resident.profile_residence_id || ''}`} value={value}>
													{resident.full_name} - Apt. {resident.apartment_number || 'N/A'}
												</SelectItem>
											);
										})
									)}
								</SelectContent>
							</Select>
						</div>

						{/* Show loading state for fees */}
						{loadingFees && selectedResident && (
							<div className="flex items-center justify-center py-4">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
								<span className="ml-2 text-sm text-muted-foreground">Loading unpaid fees...</span>
							</div>
						)}

						{/* Show unpaid fees if exist */}
						{!loadingFees && selectedResident && unpaidFees.length > 0 && (
							<>
								<Separator />
								
								<div className="space-y-3">
									<div className="flex justify-between items-center">
										<Label>Unpaid Fees for this Resident</Label>
										<div className="flex gap-2">
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={handleSelectAll}
											>
												{selectedFeeIds.length === unpaidFees.length ? 'Deselect All' : 'Select All'}
											</Button>
											<Button
												type="button"
												variant={paymentMode === 'fees' ? 'default' : 'outline'}
												size="sm"
												onClick={() => setPaymentMode('fees')}
											>
												Pay Fees
											</Button>
											<Button
												type="button"
												variant={paymentMode === 'custom' ? 'default' : 'outline'}
												size="sm"
												onClick={() => setPaymentMode('custom')}
											>
												Custom Amount
											</Button>
										</div>
									</div>

									{paymentMode === 'fees' && (
										<div className="space-y-2 border rounded-lg p-3 max-h-60 overflow-y-auto bg-muted/30">
											{unpaidFees.map((fee) => (
												<div
													key={fee.id}
													className={`flex items-start space-x-3 p-3 rounded-lg border bg-background transition-colors ${
														selectedFeeIds.includes(fee.id)
															? 'border-blue-500 bg-blue-50'
															: 'hover:bg-muted/50'
													}`}
												>
													<Checkbox
														id={`fee-${fee.id}`}
														checked={selectedFeeIds.includes(fee.id)}
														onCheckedChange={() => handleFeeToggle(fee.id)}
														className="mt-1"
													/>
													<div className="flex-1 min-w-0">
														<label
															htmlFor={`fee-${fee.id}`}
															className="block cursor-pointer"
														>
															<div className="font-medium text-sm">{fee.title}</div>
															<div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
																<Calendar className="h-3 w-3" />
																Due: {new Date(fee.due_date).toLocaleDateString()}
																{new Date(fee.due_date) < new Date() && (
																	<Badge variant="destructive" className="text-[10px] px-1 py-0">
																		Overdue
																	</Badge>
																)}
															</div>
														</label>
													</div>
													<div className="text-right">
														<div className="font-semibold text-sm">{fee.amount} MAD</div>
													</div>
												</div>
											))}
										</div>
									)}

									{/* Total Amount for selected fees */}
									{paymentMode === 'fees' && selectedFeeIds.length > 0 && (
										<div className="flex justify-between items-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
											<span className="font-medium">Total Amount ({selectedFeeIds.length} fees)</span>
											<span className="text-xl font-bold text-blue-600">
												{getTotalAmount()} MAD
											</span>
										</div>
									)}
								</div>

								<Separator />
							</>
						)}

						{/* Custom Amount Input - Only show in custom mode or no fees */}
						{(!selectedResident || unpaidFees.length === 0 || paymentMode === 'custom') && (
							<div className="grid gap-2">
								<Label htmlFor="amount">Amount (MAD) *</Label>
								<Input
									id="amount"
									type="number"
									step="0.01"
									min="0"
									placeholder="0.00"
									value={amount}
									onChange={(e) => setAmount(e.target.value)}
									required={paymentMode === 'custom'}
									disabled={paymentMode === 'fees'}
								/>
								{unpaidFees.length > 0 && paymentMode === 'custom' && (
									<p className="text-xs text-muted-foreground">
										Enter a custom amount not related to the fees above
									</p>
								)}
							</div>
						)}

						{/* Payment Method */}
						<div className="grid gap-2">
							<Label htmlFor="method">Payment Method</Label>
							<Select value={method} onValueChange={setMethod}>
								<SelectTrigger id="method">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="cash">Cash</SelectItem>
									<SelectItem value="check">Check</SelectItem>
									<SelectItem value="transfer">Bank Transfer</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button 
							type="submit" 
							disabled={submitting || loading}
							className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
						>
							{submitting ? 'Recording...' : 'Record Payment'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

