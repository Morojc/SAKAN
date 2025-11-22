import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/utils/supabase/server';
import { auth } from '@/lib/auth';
import { getSubscriptionDetails } from '@/lib/stripe/services/subscription.service';
import config from '@/config';

/**
 * Profile API Route
 * Uses Stripe SDK directly for subscription data - no database queries for Stripe info
 */
export async function GET() {
	try {
		console.log('[Profile API] Fetching profile data');

		const session = await auth();
		const userId = session?.user?.id;

		if (!userId) {
			console.error('[Profile API] User not authenticated');
			return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
		}

		// Use admin client for accessing user data only
		const adminSupabase = createSupabaseAdminClient();

		// Get user data from NextAuth users table
		let userData = null;
		let userError = null;

		// Try querying users table
		const { data: userDataResult, error: userErrorResult } = await adminSupabase
			.from('users')
			.select('*')
			.eq('id', userId)
			.single();

		userData = userDataResult;
		userError = userErrorResult;

		// If that fails, use session user data as fallback
		if (userError && !userData) {
			console.log('[Profile API] Using session data as fallback');
			const sessionUser = session.user;
			userData = {
				id: sessionUser.id,
				name: sessionUser.name || null,
				email: sessionUser.email || null,
				image: (sessionUser as any).image || null,
				email_verified: null,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};
			userError = null;
		}

		if (userError && !userData) {
			console.error('[Profile API] Error fetching user data:', userError);
			return NextResponse.json({ error: 'Error fetching user data' }, { status: 500 });
		}

		// Get subscription data using Stripe SDK directly
		console.log('[Profile API] Getting subscription details from Stripe SDK');
		const subscriptionDetails = await getSubscriptionDetails(userId);

		// Format subscription data for backward compatibility
		const subscriptionData = subscriptionDetails.customerId
			? {
					subscription_id: subscriptionDetails.subscriptionId || null,
					stripe_customer_id: subscriptionDetails.customerId,
					plan_active: subscriptionDetails.status === 'active',
					plan_expires: subscriptionDetails.currentPeriodEnd
						? subscriptionDetails.currentPeriodEnd.getTime()
						: null,
					// Cancellation details
					cancel_at: subscriptionDetails.cancelAt
						? subscriptionDetails.cancelAt.getTime()
						: null,
					cancel_at_period_end: subscriptionDetails.cancelAtPeriodEnd || false,
					canceled_at: subscriptionDetails.canceledAt
						? subscriptionDetails.canceledAt.getTime()
						: null,
					days_remaining: subscriptionDetails.daysRemaining,
				}
			: null;

		// Convert the price data object into an array with type information
		const priceData = Object.entries(config.stripe || {}).map(([type, data]) => ({
			type,
			...data,
		}));

		console.log('[Profile API] Profile data fetched successfully');
		console.log('[Profile API] Price data:', {
			hasPriceData: !!priceData,
			priceDataLength: priceData.length,
			priceDataTypes: priceData.map((p: any) => p.type),
		});
		console.log('[Profile API] Cancellation status:', {
			cancel_at_period_end: subscriptionData?.cancel_at_period_end,
			days_remaining: subscriptionData?.days_remaining,
			plan_expires: subscriptionData?.plan_expires,
		});

		// Ensure priceData is always an array, even if empty
		const safePriceData = Array.isArray(priceData) ? priceData : [];

		return NextResponse.json({
			userData,
			subscriptionData,
			planName: subscriptionDetails.planName,
			planInterval: subscriptionDetails.planInterval,
			priceData: safePriceData,
		});
	} catch (error: any) {
		// Handle authentication errors specifically
		if (error.message === 'User not authenticated' || error.message === 'NEXT_REDIRECT') {
			return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
		}
		console.error('[Profile API] Error in profile API route:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
} 