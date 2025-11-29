import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getUserResidenceId } from '@/lib/residence-utils';

/**
 * Payments API Route
 * Get all payments for current user's residence
 */
export async function GET() {
	try {
		console.log('[Payments API] Fetching payments');

		const session = await auth();
		const userId = session?.user?.id;

		if (!userId) {
			console.error('[Payments API] User not authenticated');
			return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
		}

		const supabase = createSupabaseAdminClient();

		// Get user's residence using the utility function
		const residenceId = await getUserResidenceId(supabase, userId);

		if (!residenceId) {
			console.error('[Payments API] Error getting user residence');
			return NextResponse.json({ error: 'User has no residence assigned' }, { status: 400 });
		}

		// Get all payments for the residence with related data
		const { data: payments, error: paymentsError } = await supabase
			.from('payments')
			.select(
				`
				*,
				profiles:user_id (
					id,
					full_name
				),
				residences:residence_id (
					name,
					address
				),
				verified_by_profile:verified_by (
					full_name
				)
			`
			)
			.eq('residence_id', residenceId)
			.order('paid_at', { ascending: false })
			.limit(50);

		// Fetch apartment numbers separately from profile_residences
		if (payments && payments.length > 0) {
			const userIds = payments.map((p: any) => p.user_id).filter(Boolean);
			if (userIds.length > 0) {
				const { data: profileResidences } = await supabase
					.from('profile_residences')
					.select('profile_id, apartment_number')
					.eq('residence_id', residenceId)
					.in('profile_id', userIds);

				// Add apartment_number to each payment
				if (profileResidences) {
					const apartmentMap = new Map(
						profileResidences.map((pr: any) => [pr.profile_id, pr.apartment_number])
					);
					payments.forEach((payment: any) => {
						if (payment.profiles) {
							payment.profiles.apartment_number = apartmentMap.get(payment.user_id) || null;
						}
					});
				}
			}
		}

		if (paymentsError) {
			console.error('[Payments API] Error fetching payments:', paymentsError);
			return NextResponse.json(
				{ error: 'Failed to fetch payments', details: paymentsError },
				{ status: 500 }
			);
		}

		console.log('[Payments API] Payments fetched:', payments?.length);

		return NextResponse.json({
			payments: payments || [],
		});
	} catch (error: any) {
		console.error('[Payments API] Error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}

