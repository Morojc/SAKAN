import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/utils/supabase/server';
import { auth } from "@/lib/auth";
import { stripe } from '@/utils/stripe';
import config from '@/config';

// Helper function to get plan name from price ID
function getPlanNameFromPriceId(priceId: string): { name: string; interval: string } {
	for (const [planType, planData] of Object.entries(config.stripe)) {
		if (planData.monthPriceId === priceId) {
			return { name: planData.name, interval: 'month' };
		}
		if (planData.yearPriceId === priceId) {
			return { name: planData.name, interval: 'year' };
		}
	}
	return { name: 'Unknown Plan', interval: 'month' };
}

export async function GET() {
	try {
		const session = await auth();
		const userId = session?.user?.id;

		if (!userId || !session?.supabaseAccessToken) {
			return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
		}

		// Use admin client for accessing all tables (bypasses RLS)
		// Note: We don't need getSupabaseClient here since we're using admin client
		const adminSupabase = createSupabaseAdminClient();
		
		// Get user data from NextAuth users table
		// Try dbasakan.users first, then fallback to public.users
		let userData = null;
		let userError = null;
		
		// Try querying users table - Supabase will look in accessible schemas
		const { data: userDataResult, error: userErrorResult } = await adminSupabase
			.from('users')
			.select('*')
			.eq('id', userId)
			.single();

		userData = userDataResult;
		userError = userErrorResult;

		// If that fails, use session user data as fallback
		if (userError && !userData) {
			// Fallback to session data if database query fails
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
			console.error('Error fetching user data:', userError);
			return NextResponse.json({ error: 'Error fetching user data' }, { status: 500 });
		}

		// Get subscription data
		const { data: subscriptionData, error: _subscriptionError } = await adminSupabase
			.from('stripe_customers')
			.select('*')
			.eq('user_id', userId)
			.eq('plan_active', true)
			.single();

		let planName = 'Free';
		let planInterval = 'month';
		let subscription = null;

		if (subscriptionData?.subscription_id) {
			subscription = await stripe.subscriptions.retrieve(subscriptionData.subscription_id);
			const priceId = subscription.items.data[0].price.id;
			const planInfo = getPlanNameFromPriceId(priceId);
			planName = planInfo.name;
			planInterval = planInfo.interval;
		}

		// Convert the price data object into an array with type information
		const priceData = Object.entries(config.stripe).map(([type, data]) => ({
			type,
			...data
		}));

		return NextResponse.json({
			userData,
			subscriptionData,
			planName,
			planInterval,
			priceData
		});
	} catch (error: any) {
		// Handle authentication errors specifically
		if (error.message === 'User not authenticated' || error.message === 'NEXT_REDIRECT') {
			return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
		}
		console.error('Error in profile API route:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
} 