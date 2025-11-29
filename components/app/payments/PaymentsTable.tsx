'use client';

import { useState, useEffect } from 'react';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { generateCashReceiptPDF, downloadPDF } from '@/lib/pdf/generator';
import toast from 'react-hot-toast';

interface PaymentsTableProps {
	refreshTrigger: number;
}

/**
 * Payments Table Component
 * Displays payment records with receipt download functionality
 */
export default function PaymentsTable({ refreshTrigger }: PaymentsTableProps) {
	const [payments, setPayments] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [generatingReceipt, setGeneratingReceipt] = useState<number | null>(null);

	// Fetch payments
	useEffect(() => {
		fetchPayments();
	}, [refreshTrigger]);

	async function fetchPayments() {
		console.log('[PaymentsTable] Fetching payments');
		setLoading(true);

		try {
			// Note: This would normally be a server action, but showing client-side for demonstration
			// In production, create a server action to fetch payments
			const response = await fetch('/api/payments');
			if (!response.ok) {
				throw new Error('Failed to fetch payments');
			}

			// Check content type to ensure it's JSON
			const contentType = response.headers.get('content-type');
			if (!contentType || !contentType.includes('application/json')) {
				throw new Error('Invalid response format from server');
			}

			const data = await response.json();
			console.log('[PaymentsTable] Payments fetched:', data.payments?.length);
			setPayments(data.payments || []);
		} catch (error: any) {
			console.error('[PaymentsTable] Error fetching payments:', error);
			toast.error(error.message || 'Failed to load payments');
		} finally {
			setLoading(false);
		}
	}

	// Generate and download receipt
	async function handleDownloadReceipt(payment: any) {
		console.log('[PaymentsTable] Generating receipt for payment:', payment.id);
		setGeneratingReceipt(payment.id);

		try {
			// Generate PDF
			const pdfBytes = await generateCashReceiptPDF({
				paymentId: payment.id,
				residentName: payment.profiles?.full_name || 'Unknown',
				apartmentNumber: payment.profiles?.apartment_number || 'N/A',
				amount: payment.amount,
				paymentDate: new Date(payment.paid_at),
				receiptNumber: `REC-${payment.id.toString().padStart(6, '0')}`,
				residenceName: payment.residences?.name || 'Residence',
				residenceAddress: payment.residences?.address || '',
				syndicName: payment.verified_by_profile?.full_name || 'Syndic',
			});

			// Download PDF
			const filename = `receipt-${payment.id}-${new Date(payment.paid_at).toISOString().split('T')[0]}.pdf`;
			downloadPDF(pdfBytes, filename);

			toast.success('Receipt downloaded successfully!');
		} catch (error: any) {
			console.error('[PaymentsTable] Error generating receipt:', error);
			toast.error(error.message || 'Failed to generate receipt');
		} finally {
			setGeneratingReceipt(null);
		}
	}

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('en-MA', {
			style: 'currency',
			currency: 'MAD',
		}).format(amount);
	};

	// Format date
	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString('en-MA', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	};

	// Get method badge
	const getMethodBadge = (method: string) => {
		const variants: Record<string, { variant: any; label: string }> = {
			cash: { variant: 'default', label: 'Cash' },
			bank_transfer: { variant: 'secondary', label: 'Bank Transfer' },
			online_card: { variant: 'outline', label: 'Online Card' },
		};

		const config = variants[method] || { variant: 'outline', label: method };
		return (
			<Badge variant={config.variant as any} className="capitalize">
				{config.label}
			</Badge>
		);
	};

	// Get status badge
	const getStatusBadge = (status: string) => {
		const variants: Record<string, { variant: any; label: string }> = {
			completed: { variant: 'default', label: 'Completed' },
			pending: { variant: 'secondary', label: 'Pending' },
			rejected: { variant: 'destructive', label: 'Rejected' },
		};

		const config = variants[status] || { variant: 'outline', label: status };
		return (
			<Badge variant={config.variant as any} className="capitalize">
				{config.label}
			</Badge>
		);
	};

	if (loading) {
		return (
			<Card className="p-6">
				<div className="space-y-3">
					<div className="h-10 bg-muted rounded animate-pulse"></div>
					<div className="h-10 bg-muted rounded animate-pulse"></div>
					<div className="h-10 bg-muted rounded animate-pulse"></div>
				</div>
			</Card>
		);
	}

	if (payments.length === 0) {
		return (
			<Card className="p-12 text-center">
				<FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
				<h3 className="text-lg font-semibold mb-2">No payments recorded yet</h3>
				<p className="text-sm text-muted-foreground">
					Click "Add Payment" to record your first payment.
				</p>
			</Card>
		);
	}

	return (
		<Card>
			<div className="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Date</TableHead>
							<TableHead>Resident</TableHead>
							<TableHead>Apartment</TableHead>
							<TableHead>Amount</TableHead>
							<TableHead>Method</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{payments.map((payment) => (
							<TableRow key={payment.id}>
								<TableCell className="font-medium">{formatDate(payment.paid_at)}</TableCell>
								<TableCell>{payment.profiles?.full_name || 'Unknown'}</TableCell>
								<TableCell>{payment.profiles?.apartment_number || 'N/A'}</TableCell>
								<TableCell className="font-semibold">{formatCurrency(payment.amount)}</TableCell>
								<TableCell>{getMethodBadge(payment.method)}</TableCell>
								<TableCell>{getStatusBadge(payment.status)}</TableCell>
								<TableCell className="text-right">
									{payment.method === 'cash' && payment.status === 'completed' && (
										<Button
											size="sm"
											variant="outline"
											onClick={() => handleDownloadReceipt(payment)}
											disabled={generatingReceipt === payment.id}
											className="gap-2"
										>
											<Download className="h-3 w-3" />
											{generatingReceipt === payment.id ? 'Generating...' : 'Receipt'}
										</Button>
									)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</Card>
	);
}

