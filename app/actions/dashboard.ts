'use server';

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/utils/supabase/server';
import { getBalances } from './payments';

/**
 * Dashboard Server Actions
 * Fetches aggregate statistics for the dashboard overview
 */

/**
 * Get all dashboard statistics
 */
export async function getDashboardStats() {
	console.log('[Dashboard Actions] Getting dashboard stats');

	try {
		const session = await auth();
		const userId = session?.user?.id;

		if (!userId) {
			throw new Error('User not authenticated');
		}

		const supabase = createSupabaseAdminClient();

		// Get user's residence
		const { data: profile, error: profileError } = await supabase
			.from('profiles')
			.select('residence_id')
			.eq('id', userId)
			.single();

		if (profileError || !profile?.residence_id) {
			console.error('[Dashboard Actions] Error getting profile:', profileError);
			throw new Error('User has no residence assigned');
		}

		const residenceId = profile.residence_id;

		// Fetch all stats in parallel
		const [
			totalResidentsResult,
			outstandingFeesResult,
			openIncidentsResult,
			recentAnnouncementsResult,
			balancesResult,
		] = await Promise.all([
			// Total residents
			supabase
				.from('profiles')
				.select('id', { count: 'exact', head: true })
				.eq('residence_id', residenceId)
				.eq('role', 'resident'),

			// Outstanding fees
			supabase
				.from('fees')
				.select('amount')
				.eq('residence_id', residenceId)
				.in('status', ['unpaid', 'overdue']),

			// Open incidents (if incidents table exists)
			supabase
				.from('incidents')
				.select('id', { count: 'exact', head: true })
				.eq('residence_id', residenceId)
				.in('status', ['open', 'in_progress'])
				.then((res) => res)
				.catch(() => ({ count: 0, error: null })),

			// Recent announcements (if announcements table exists)
			supabase
				.from('announcements')
				.select('id', { count: 'exact', head: true })
				.eq('residence_id', residenceId)
				.gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
				.then((res) => res)
				.catch(() => ({ count: 0, error: null })),

			// Balances
			getBalances(residenceId),
		]);

		// Process results
		const totalResidents = totalResidentsResult.count || 0;

		const outstandingFees =
			outstandingFeesResult.data?.reduce((sum, fee) => sum + Number(fee.amount), 0) || 0;

		const openIncidents = openIncidentsResult.count || 0;

		const recentAnnouncementsCount = recentAnnouncementsResult.count || 0;

		const cashOnHand = balancesResult.cashOnHand || 0;
		const bankBalance = balancesResult.bankBalance || 0;

		const stats = {
			totalResidents,
			cashOnHand,
			bankBalance,
			outstandingFees,
			openIncidents,
			recentAnnouncementsCount,
		};

		console.log('[Dashboard Actions] Stats loaded:', stats);

		return {
			success: true,
			stats,
		};
	} catch (error: any) {
		console.error('[Dashboard Actions] Error getting dashboard stats:', error);
		return {
			success: false,
			stats: {
				totalResidents: 0,
				cashOnHand: 0,
				bankBalance: 0,
				outstandingFees: 0,
				openIncidents: 0,
				recentAnnouncementsCount: 0,
			},
			error: error.message || 'Failed to load dashboard stats',
		};
	}
}

