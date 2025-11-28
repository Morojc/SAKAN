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
import { getResidents, createCashPayment } from '@/app/actions/payments';
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

	// Form state
	const [selectedResident, setSelectedResident] = useState('');
	const [amount, setAmount] = useState('');
	const [method, setMethod] = useState('cash');

	// Fetch residents when dialog opens
	useEffect(() => {
		if (open) {
			console.log('[AddPaymentDialog] Dialog opened, fetching residents');
			fetchResidents();
		}
	}, [open]);

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

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		console.log('[AddPaymentDialog] Submitting payment');

		// Validation
		if (!selectedResident) {
			toast.error('Please select a resident');
			return;
		}

		if (!amount || Number(amount) <= 0) {
			toast.error('Please enter a valid amount');
			return;
		}

		setSubmitting(true);

		try {
			const result = await createCashPayment({
				userId: selectedResident,
				amount: Number(amount),
			});

			if (result.success) {
				console.log('[AddPaymentDialog] Payment created:', result.payment);
				toast.success('Cash payment recorded successfully!');

				// Reset form
				setSelectedResident('');
				setAmount('');
				setMethod('cash');

				// Close dialog and refresh parent
				onSuccess();
			} else {
				console.error('[AddPaymentDialog] Error:', result.error);
				toast.error(result.error || 'Failed to record payment');
			}
		} catch (error: any) {
			console.error('[AddPaymentDialog] Error creating payment:', error);
			toast.error(error.message || 'Failed to record payment');
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Add Cash Payment</DialogTitle>
					<DialogDescription>
						Record a cash payment received from a resident. A receipt will be generated after saving.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit}>
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
										residents.map((resident) => (
											<SelectItem key={resident.id} value={resident.id}>
												{resident.full_name} - Apt. {resident.apartment_number}
											</SelectItem>
										))
									)}
								</SelectContent>
							</Select>
						</div>

						{/* Amount Input */}
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
								required
							/>
						</div>

						{/* Payment Method */}
						<div className="grid gap-2">
							<Label htmlFor="method">Payment Method</Label>
							<Select value={method} onValueChange={setMethod}>
								<SelectTrigger id="method">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="cash">Cash</SelectItem>
									<SelectItem value="bank_transfer">Bank Transfer</SelectItem>
									<SelectItem value="online_card">Online Card</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={submitting || loading}>
							{submitting ? 'Recording...' : 'Record Payment'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

