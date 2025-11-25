'use server';

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getBalances } from './payments';

/**
 * Dashboard Server Actions
 * Fetches aggregate statistics for the dashboard overview
 */

/**
 * Get all dashboard statistics with user and residence info
 * Enhanced with residents management data
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

		// Get user's profile and residence info
		const { data: profile, error: profileError } = await supabase
			.from('profiles')
			.select(`
				id,
				full_name,
				role,
				residence_id,
				onboarding_completed,
				residences (
					id,
					name,
					address,
					city
				)
			`)
			.eq('id', userId)
			.maybeSingle();

		// Handle case where profile doesn't exist or has no residence
		if (profileError) {
			console.error('[Dashboard Actions] Error getting profile:', profileError);
			// Return empty stats with success: true to avoid showing error
			// The onboarding guard will handle showing the onboarding wizard
			const { data: userData } = await supabase
				.from('users')
				.select('email, name, image')
				.eq('id', userId)
				.maybeSingle();
			
			return {
				success: true,
				stats: {
					totalResidents: 0,
					cashOnHand: 0,
					bankBalance: 0,
					outstandingFees: 0,
					openIncidents: 0,
					recentAnnouncementsCount: 0,
					todayPayments: 0,
					monthlyPayments: 0,
					fillRate: 100,
					residentsChange: 0,
					topResidents: [],
					user: {
						name: userData?.name || 'User',
						email: userData?.email || '',
						image: userData?.image || null,
						role: 'syndic',
					},
					residence: null,
					onboardingCompleted: false,
				},
			};
		}

		if (!profile) {
			console.log('[Dashboard Actions] Profile not found for user - returning empty stats for onboarding');
			// Get user email for display
			const { data: userData } = await supabase
				.from('users')
				.select('email, name, image')
				.eq('id', userId)
				.maybeSingle();
			
			// Return success: true with empty stats - onboarding guard will handle the rest
			return {
				success: true,
				stats: {
					totalResidents: 0,
					cashOnHand: 0,
					bankBalance: 0,
					outstandingFees: 0,
					openIncidents: 0,
					recentAnnouncementsCount: 0,
					todayPayments: 0,
					monthlyPayments: 0,
					fillRate: 100,
					residentsChange: 0,
					topResidents: [],
					user: {
						name: userData?.name || 'User',
						email: userData?.email || '',
						image: userData?.image || null,
						role: 'syndic',
					},
					residence: null,
					onboardingCompleted: false,
				},
			};
		}

		// If user has no residence_id, return empty stats (likely in onboarding)
		if (!profile.residence_id) {
			console.log('[Dashboard Actions] User has no residence assigned - returning empty stats');
			
			// Get user email for display
			const { data: userData } = await supabase
				.from('users')
				.select('email, name, image')
				.eq('id', userId)
				.maybeSingle();

			return {
				success: true,
				stats: {
					totalResidents: 0,
					cashOnHand: 0,
					bankBalance: 0,
					outstandingFees: 0,
					openIncidents: 0,
					recentAnnouncementsCount: 0,
					todayPayments: 0,
					monthlyPayments: 0,
					fillRate: 100,
					residentsChange: 0,
					topResidents: [],
					user: {
						name: profile.full_name || userData?.name || 'Syndic',
						email: userData?.email || '',
						image: userData?.image || null,
						role: profile.role || 'syndic',
					},
					residence: null,
					onboardingCompleted: profile.onboarding_completed || false,
				},
			};
		}

		const residenceId = profile.residence_id;

		// Get user email from users table
		const { data: userData } = await supabase
			.from('users')
			.select('email, name, image')
			.eq('id', userId)
			.maybeSingle();

		// Fetch residence data explicitly to ensure all fields are available
		let residenceData = null;
		if (residenceId) {
			const { data: residence } = await supabase
				.from('residences')
				.select('id, name, address, city')
				.eq('id', residenceId)
				.maybeSingle();
			
			residenceData = residence;
		}

		// Fetch all stats in parallel
		const [
			totalResidentsResult,
			allResidentsResult,
			outstandingFeesResult,
			allFeesResult,
			openIncidentsResult,
			recentAnnouncementsResult,
			balancesResult,
			recentPaymentsResult,
		] = await Promise.all([
			// Total verified residents
			supabase
				.from('profiles')
				.select('id', { count: 'exact', head: true })
				.eq('residence_id', residenceId)
				.eq('role', 'resident')
				.eq('verified', true),

			// All verified residents with fees for top residents calculation
			supabase
				.from('profiles')
				.select(`
					id,
					full_name,
					apartment_number,
					fees (
						id,
						amount,
						status
					)
				`)
				.eq('residence_id', residenceId)
				.eq('role', 'resident')
				.eq('verified', true) // Only verified residents
				.order('full_name', { ascending: true }),

			// Outstanding fees
			supabase
				.from('fees')
				.select('amount')
				.eq('residence_id', residenceId)
				.in('status', ['unpaid', 'overdue']),

			// All fees for payment rate calculation
			supabase
				.from('fees')
				.select('amount, status')
				.eq('residence_id', residenceId),

			// Open incidents (if incidents table exists)
			Promise.resolve(
				supabase
					.from('incidents')
					.select('id', { count: 'exact', head: true })
					.eq('residence_id', residenceId)
					.in('status', ['open', 'in_progress'])
			).catch(() => ({ count: 0, error: null, data: null } as any)),

			// Recent announcements (if announcements table exists)
			Promise.resolve(
				supabase
					.from('announcements')
					.select('id', { count: 'exact', head: true })
					.eq('residence_id', residenceId)
					.gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
			).catch(() => ({ count: 0, error: null, data: null } as any)),

			// Balances
			getBalances(residenceId),

			// Recent payments (last 7 days)
			supabase
				.from('payments')
				.select('id, amount, paid_at')
				.eq('residence_id', residenceId)
				.gte('paid_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
				.order('paid_at', { ascending: false })
				.limit(10),
		]);

		// Process results
		const totalResidents = totalResidentsResult.count || 0;

		const outstandingFees =
			outstandingFeesResult.data?.reduce((sum: number, fee: any) => sum + Number(fee.amount), 0) || 0;

		const openIncidents = openIncidentsResult.count || 0;

		const recentAnnouncementsCount = recentAnnouncementsResult.count || 0;

		const cashOnHand = balancesResult.cashOnHand || 0;
		const bankBalance = balancesResult.bankBalance || 0;

		// Calculate recent payments stats
		const recentPayments = recentPaymentsResult.data || [];
		const todayPayments = recentPayments.filter((p: any) => {
			const paymentDate = new Date(p.paid_at);
			const today = new Date();
			return paymentDate.toDateString() === today.toDateString();
		}).length;

		// Calculate monthly average payments
		const monthlyPayments = recentPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

		// Calculate top residents with payment compliance
		const allResidents = allResidentsResult.data || [];
		const allFees = allFeesResult.data || [];
		
		// Calculate payment compliance for each resident
		const residentsWithCompliance = allResidents.map((resident: any) => {
			const residentFees = resident.fees || [];
			const totalFees = residentFees.length;
			const paidFees = residentFees.filter((f: any) => f.status === 'paid').length;
			const complianceRate = totalFees > 0 ? Math.round((paidFees / totalFees) * 100) : 100;
			
			return {
				id: resident.id,
				full_name: resident.full_name,
				apartment_number: resident.apartment_number,
				complianceRate,
				totalFees,
				paidFees,
			};
		});

		// Sort by compliance rate and get top 3
		const topResidents = residentsWithCompliance
			.sort((a, b) => b.complianceRate - a.complianceRate)
			.slice(0, 3);

		// Calculate payment rate (percentage of fees paid)
		const totalFeesAmount = allFees.reduce((sum: number, fee: any) => sum + Number(fee.amount), 0);
		const paidFeesAmount = allFees
			.filter((fee: any) => fee.status === 'paid')
			.reduce((sum: number, fee: any) => sum + Number(fee.amount), 0);
		const fillRate = totalFeesAmount > 0 
			? Math.round((paidFeesAmount / totalFeesAmount) * 100) 
			: 100;

		// Calculate residents growth (compare with last month - placeholder for now)
		const residentsChange = 0; // TODO: Calculate from historical data

		const stats = {
			totalResidents,
			cashOnHand,
			bankBalance,
			outstandingFees,
			openIncidents,
			recentAnnouncementsCount,
			todayPayments,
			monthlyPayments,
			fillRate,
			residentsChange,
			topResidents,
			user: {
				name: profile.full_name || userData?.name || 'Syndic',
				email: userData?.email || '',
				image: userData?.image || null,
				role: profile.role || 'syndic',
			},
			residence: residenceData,
		};

		console.log('[Dashboard Actions] Stats loaded:', {
			totalResidents,
			outstandingFees,
			fillRate,
			topResidentsCount: topResidents.length,
		});

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
				todayPayments: 0,
				monthlyPayments: 0,
				fillRate: 100,
				residentsChange: 0,
				topResidents: [],
				user: {
					name: 'Syndic',
					email: '',
					image: null,
					role: 'syndic',
				},
				residence: null,
			},
			error: error.message || 'Failed to load dashboard stats',
		};
	}
}
