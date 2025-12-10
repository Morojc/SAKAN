'use client';

import { useState, useEffect } from 'react';
import { Plus, Wallet, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AddPaymentDialog from './AddPaymentDialog';
import PaymentsTable from './PaymentsTable';
import { getBalances } from '@/app/actions/payments';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n/client';

/**
 * Payments Content Component
 * Displays balance cards and payments table with add payment functionality
 */
export default function PaymentsContent() {
	const { t } = useI18n();
	const [showAddDialog, setShowAddDialog] = useState(false);
	const [balances, setBalances] = useState({ cashOnHand: 0, bankBalance: 0 });
	const [loading, setLoading] = useState(true);
	const [refreshTrigger, setRefreshTrigger] = useState(0);

	// Fetch balances on mount and when refreshTrigger changes
	useEffect(() => {
		async function fetchBalances() {
			console.log('[PaymentsContent] Fetching balances');
			setLoading(true);

			try {
				const result = await getBalances();
				if (result.error) {
					console.error('[PaymentsContent] Error fetching balances:', result.error);
					toast.error(result.error);
				} else {
					console.log('[PaymentsContent] Balances loaded:', result);
					setBalances({
						cashOnHand: result.cashOnHand,
						bankBalance: result.bankBalance,
					});
				}
			} catch (error: any) {
				console.error('[PaymentsContent] Error:', error);
					toast.error(error.message || t('payments.failedToLoadBalances'));
			} finally {
				setLoading(false);
			}
		}

		fetchBalances();
	}, [refreshTrigger]);

	// Refresh data after payment added
	const handlePaymentAdded = () => {
		console.log('[PaymentsContent] Payment added, refreshing data');
		setRefreshTrigger((prev) => prev + 1);
		setShowAddDialog(false);
	};

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('en-MA', {
			style: 'currency',
			currency: 'MAD',
		}).format(amount);
	};

	return (
		<div className="space-y-6">
			{/* Debug log */}

			{/* Balance Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{/* Cash on Hand Card */}
				<Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium text-emerald-900">{t('payments.cashOnHand')}</CardTitle>
						<Wallet className="h-4 w-4 text-emerald-600" />
					</CardHeader>
					<CardContent>
						{loading ? (
							<div className="h-8 bg-emerald-200 rounded animate-pulse w-3/4"></div>
						) : (
							<div className="text-2xl font-bold text-emerald-900">
								{formatCurrency(balances.cashOnHand)}
							</div>
						)}
						<p className="text-xs text-emerald-700 mt-1">
							{t('payments.cashOnHandDesc')}
						</p>
					</CardContent>
				</Card>

				{/* Bank Balance Card */}
				<Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium text-blue-900">{t('payments.bankBalance')}</CardTitle>
						<Building2 className="h-4 w-4 text-blue-600" />
					</CardHeader>
					<CardContent>
						{loading ? (
							<div className="h-8 bg-blue-200 rounded animate-pulse w-3/4"></div>
						) : (
							<div className="text-2xl font-bold text-blue-900">
								{formatCurrency(balances.bankBalance)}
							</div>
						)}
						<p className="text-xs text-blue-700 mt-1">
							{t('payments.bankBalanceDesc')}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Add Payment Button */}
			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-lg font-semibold">{t('payments.paymentRecords')}</h2>
					<p className="text-sm text-muted-foreground">
						{t('payments.paymentRecordsDesc')}
					</p>
				</div>
				<Button 
					onClick={() => setShowAddDialog(true)} 
					className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md"
				>
					<Plus className="h-4 w-4" />
					{t('payments.addPayment')}
				</Button>
			</div>

			{/* Payments Table */}
			<PaymentsTable refreshTrigger={refreshTrigger} />

			{/* Add Payment Dialog */}
			<AddPaymentDialog
				open={showAddDialog}
				onOpenChange={setShowAddDialog}
				onSuccess={handlePaymentAdded}
			/>
		</div>
	);
}

