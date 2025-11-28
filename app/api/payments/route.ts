import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

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

		// Get user's residence
		const { data: profile, error: profileError } = await supabase
			.from('profiles')
			.select('residence_id')
			.eq('id', userId)
			.single();

		if (profileError || !profile?.residence_id) {
			console.error('[Payments API] Error getting user profile:', profileError);
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
					full_name,
					apartment_number
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
			.eq('residence_id', profile.residence_id)
			.order('paid_at', { ascending: false })
			.limit(50);

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

