'use server';

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getUserResidenceId } from '@/lib/residence-utils';

/**
 * Payment Server Actions
 * All payment operations use Supabase for non-Stripe payments (cash, bank transfers)
 */

/**
 * Get balances for a residence
 * Calculates cash on hand and bank balance from payments and expenses
 */
export async function getBalances(residenceId?: bigint) {
	console.log('[Payments Actions] Getting balances');

	try {
		const session = await auth();
		const userId = session?.user?.id;

		if (!userId) {
			throw new Error('User not authenticated');
		}

		const supabase = createSupabaseAdminClient();

		// Get user's residence if not provided
		let targetResidenceId = residenceId;
		if (!targetResidenceId) {
            targetResidenceId = await getUserResidenceId(supabase, userId) as any;
			if (!targetResidenceId) {
				throw new Error('User has no residence assigned');
			}
		}

		// Calculate cash on hand: cash payments - cash expenses
		const { data: cashPayments, error: cashPaymentsError } = await supabase
			.from('payments')
			.select('amount')
			.eq('residence_id', targetResidenceId)
			.in('method', ['cash'])
			.eq('status', 'completed');

		if (cashPaymentsError) {
			console.error('[Payments Actions] Error fetching cash payments:', cashPaymentsError);
			throw cashPaymentsError;
		}

		const { data: cashExpenses, error: cashExpensesError } = await supabase
			.from('expenses')
			.select('amount')
			.eq('residence_id', targetResidenceId);
		// Note: expenses table doesn't have paid_from field yet, will need migration

		if (cashExpensesError) {
			console.error('[Payments Actions] Error fetching cash expenses:', cashExpensesError);
			throw cashExpensesError;
		}

		// Calculate bank balance: online payments - bank expenses
		const { data: bankPayments, error: bankPaymentsError } = await supabase
			.from('payments')
			.select('amount')
			.eq('residence_id', targetResidenceId)
			.in('method', ['bank_transfer', 'online_card'])
			.eq('status', 'completed');

		if (bankPaymentsError) {
			console.error('[Payments Actions] Error fetching bank payments:', bankPaymentsError);
			throw bankPaymentsError;
		}

		// Compute totals
		const cashIn = cashPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
		const cashOut = cashExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
		const bankIn = bankPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
		// For now, assume all expenses are from cash until we add paid_from field
		const bankOut = 0;

		const cashOnHand = cashIn - cashOut;
		const bankBalance = bankIn - bankOut;

		console.log('[Payments Actions] Balances calculated:', {
			cashIn,
			cashOut,
			bankIn,
			bankOut,
			cashOnHand,
			bankBalance,
		});

		return {
			cashOnHand,
			bankBalance,
			error: null,
		};
	} catch (error: any) {
		console.error('[Payments Actions] Error getting balances:', error);
		return {
			cashOnHand: 0,
			bankBalance: 0,
			error: error.message || 'Failed to get balances',
		};
	}
}

/**
 * Create a cash payment record
 */
export async function createCashPayment(data: {
	userId: string;
	amount: number;
	feeId?: bigint;
	residenceId?: bigint;
}) {
	console.log('[Payments Actions] Creating cash payment:', data);

	try {
		const session = await auth();
		const currentUserId = session?.user?.id;

		if (!currentUserId) {
			throw new Error('User not authenticated');
		}

		const supabase = createSupabaseAdminClient();

		// Get residence ID if not provided
		let targetResidenceId = data.residenceId;
		if (!targetResidenceId) {
            targetResidenceId = await getUserResidenceId(supabase, currentUserId) as any;
			if (!targetResidenceId) {
				throw new Error('User has no residence assigned');
			}
		}

		// Create payment record
		const { data: payment, error: paymentError } = await supabase
			.from('payments')
			.insert({
				residence_id: targetResidenceId,
				user_id: data.userId,
				fee_id: data.feeId || null,
				amount: data.amount,
				method: 'cash',
				status: 'completed',
				paid_at: new Date().toISOString(),
				verified_by: currentUserId, // Syndic who recorded the payment
			})
			.select()
			.single();

		if (paymentError) {
			console.error('[Payments Actions] Error creating payment:', paymentError);
			throw paymentError;
		}

		console.log('[Payments Actions] Cash payment created:', payment.id);

		// If linked to a fee, update fee status to paid
		if (data.feeId) {
			const { error: feeUpdateError } = await supabase
				.from('fees')
				.update({ status: 'paid' })
				.eq('id', data.feeId);

			if (feeUpdateError) {
				console.error('[Payments Actions] Error updating fee status:', feeUpdateError);
				// Don't throw - payment is recorded, just log the error
			}
		}

		return {
			success: true,
			payment,
		};
	} catch (error: any) {
		console.error('[Payments Actions] Error creating cash payment:', error);
		return {
			success: false,
			error: error.message || 'Failed to create cash payment',
		};
	}
}

/**
 * Get all residents for a residence
 */
export async function getResidents(residenceId?: bigint) {
	console.log('[Payments Actions] Getting residents');

	try {
		const session = await auth();
		const userId = session?.user?.id;

		if (!userId) {
			throw new Error('User not authenticated');
		}

		const supabase = createSupabaseAdminClient();

		// Get user's residence if not provided
		let targetResidenceId = residenceId;
		if (!targetResidenceId) {
            targetResidenceId = await getUserResidenceId(supabase, userId) as any;
			if (!targetResidenceId) {
				throw new Error('User has no residence assigned');
			}
		}

		// Get all verified residents for the residence via profile_residences
		const { data: residentsLinks, error: residentsError } = await supabase
			.from('profile_residences')
			.select(`
                apartment_number,
                verified,
                profiles (
                    id,
                    full_name,
                    role
                )
            `)
			.eq('residence_id', targetResidenceId)
			.eq('verified', true) // Only show verified residents
			.order('apartment_number', { ascending: true });

		if (residentsError) {
			console.error('[Payments Actions] Error fetching residents:', residentsError);
			throw residentsError;
		}

        // Transform to flat structure
        const residents = residentsLinks?.map((link: any) => ({
            id: link.profiles.id,
            full_name: link.profiles.full_name,
            role: link.profiles.role,
            apartment_number: link.apartment_number
        })) || [];

		console.log('[Payments Actions] Residents fetched:', residents.length);

		return {
			success: true,
			residents,
		};
	} catch (error: any) {
		console.error('[Payments Actions] Error getting residents:', error);
		return {
			success: false,
			residents: [],
			error: error.message || 'Failed to get residents',
		};
	}
}
