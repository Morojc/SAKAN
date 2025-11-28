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

		// Get user's profile
		const { data: profile, error: profileError } = await supabase
			.from('profiles')
			.select('id, full_name, role, onboarding_completed')
			.eq('id', userId)
			.maybeSingle();

		// Handle case where profile doesn't exist
		if (profileError || !profile) {
			console.error('[Dashboard Actions] Error getting profile or not found:', profileError);
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

        // Determine Residence ID based on role
        let residenceId = null;
        let residenceData = null;

        if (profile.role === 'syndic') {
            const { data: res } = await supabase.from('residences').select('id, name, address, city').eq('syndic_user_id', userId).maybeSingle();
            if (res) {
                residenceId = res.id;
                residenceData = res;
            }
        } else if (profile.role === 'guard') {
            const { data: res } = await supabase.from('residences').select('id, name, address, city').eq('guard_user_id', userId).maybeSingle();
            if (res) {
                residenceId = res.id;
                residenceData = res;
            }
        } else {
            // Resident
            const { data: prLink } = await supabase
                .from('profile_residences')
                .select('residence_id, residences(id, name, address, city)')
                .eq('profile_id', userId)
                .limit(1)
                .maybeSingle();
            
            if (prLink && prLink.residences) {
                residenceId = prLink.residence_id;
                residenceData = prLink.residences; // Join returns object or array? Assuming object if singular relation, but types say array usually.
                if (Array.isArray(residenceData)) residenceData = residenceData[0];
            }
        }

		// If user has no residence assigned, return empty stats (likely in onboarding)
		if (!residenceId) {
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

		// Get user email from users table
		const { data: userData } = await supabase
			.from('users')
			.select('email, name, image')
			.eq('id', userId)
			.maybeSingle();

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
				.from('profile_residences')
				.select('id', { count: 'exact', head: true })
				.eq('residence_id', residenceId)
				.eq('verified', true),

			// All verified residents with fees for top residents calculation
            // We join profile_residences -> profiles -> fees
            // Note: fees are related to profiles (user_id), but we should filter fees by residence_id as well?
            // Since fees table has residence_id, we can just fetch fees separately or trust the join.
            // But Supabase simple joins might be tricky for "fees where residence_id = X".
            // Let's fetch profiles first, then we can match fees if needed, or rely on the fact that we fetch all fees for the residence below.
			supabase
				.from('profile_residences')
				.select(`
                    apartment_number,
                    profiles (
                        id,
                        full_name
                    )
				`)
				.eq('residence_id', residenceId)
				.eq('verified', true),

			// Outstanding fees
			supabase
				.from('fees')
				.select('amount')
				.eq('residence_id', residenceId)
				.in('status', ['unpaid', 'overdue']),

			// All fees for payment rate calculation
			supabase
				.from('fees')
				.select('id, amount, status, user_id')
				.eq('residence_id', residenceId),

			// Open incidents
			Promise.resolve(
				supabase
					.from('incidents')
					.select('id', { count: 'exact', head: true })
					.eq('residence_id', residenceId)
					.in('status', ['open', 'in_progress'])
			).catch(() => ({ count: 0, error: null, data: null } as any)),

			// Recent announcements
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
		const residentLinks = allResidentsResult.data || [];
        const allFeesData = allFeesResult.data || [];

		// Calculate payment compliance for each resident
		const residentsWithCompliance = residentLinks.map((link: any) => {
            const profile = link.profiles;
            // Filter fees for this user
            const residentFees = allFeesData.filter((f: any) => f.user_id === profile.id);
            
			const totalFees = residentFees.length;
			const paidFees = residentFees.filter((f: any) => f.status === 'paid').length;
			const complianceRate = totalFees > 0 ? Math.round((paidFees / totalFees) * 100) : 100;
			
			return {
				id: profile.id,
				full_name: profile.full_name,
				apartment_number: link.apartment_number,
				complianceRate,
				totalFees,
				paidFees,
			};
		});

		// Sort by compliance rate and get top 3
		const topResidents = residentsWithCompliance
			.sort((a: any, b: any) => b.complianceRate - a.complianceRate)
			.slice(0, 3);

		// Calculate payment rate (percentage of fees paid)
		const totalFeesAmount = allFeesData.reduce((sum: number, fee: any) => sum + Number(fee.amount), 0);
		const paidFeesAmount = allFeesData
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
            onboardingCompleted: profile.onboarding_completed || false,
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
