import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/utils/supabase/server';
import { stripe } from '@/utils/stripe';
import { getCustomerByUserId } from '@/lib/stripe/services/customer.service';

export async function DELETE() {
	try {
		const session = await auth();
		const userId = session?.user?.id;

		if (!userId) {
			return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
		}

		const adminSupabase = createSupabaseAdminClient();
		
		// Create a client configured for dbasakan schema
		const { createClient } = await import('@supabase/supabase-js');
		const dbasakanClient = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.SUPABASE_SECRET_KEY!,
			{
				db: { schema: 'dbasakan' },
				auth: { persistSession: false },
			}
		);

		// 1. Cancel any active Stripe subscriptions (including canceled but still active)
		console.log('[Account Delete] Checking for active subscriptions for user:', userId);
		
		try {
			// Get customer from Stripe SDK (includes canceled but still active subscriptions)
			const customer = await getCustomerByUserId(userId);
			
			if (customer) {
				console.log('[Account Delete] Found Stripe customer:', customer.id);
				
				// Get all active subscriptions for this customer
				// This includes subscriptions with cancel_at_period_end = true (scheduled for cancellation)
				const subscriptions = await stripe.subscriptions.list({
					customer: customer.id,
					status: 'active', // This includes canceled but still active subscriptions
					limit: 100, // Get all subscriptions
				});

				console.log(`[Account Delete] Found ${subscriptions.data.length} active subscription(s) to cancel`);

				// Cancel all active subscriptions immediately
				// This includes both regular active subscriptions and canceled ones (cancel_at_period_end = true)
				for (const subscription of subscriptions.data) {
					try {
						if (subscription.status === 'active') {
							// Cancel immediately (not at period end)
							await stripe.subscriptions.cancel(subscription.id);
							console.log(`[Account Delete] ✅ Cancelled subscription: ${subscription.id} (status: ${subscription.status}, cancel_at_period_end: ${subscription.cancel_at_period_end})`);
						} else {
							console.log(`[Account Delete] ⚠️ Skipping subscription ${subscription.id} - status is not active: ${subscription.status}`);
						}
					} catch (subscriptionError: any) {
						console.error(`[Account Delete] ❌ Error cancelling subscription ${subscription.id}:`, subscriptionError);
						// Continue with other subscriptions even if one fails
					}
				}

				// Also check for any other subscription statuses that might need cancellation
				const allSubscriptions = await stripe.subscriptions.list({
					customer: customer.id,
					limit: 100,
				});

				// Cancel any subscriptions that are trialing, past_due, or incomplete
				const otherStatusSubscriptions = allSubscriptions.data.filter(
					(sub) => ['trialing', 'past_due', 'incomplete', 'incomplete_expired'].includes(sub.status)
				);

				if (otherStatusSubscriptions.length > 0) {
					console.log(`[Account Delete] Found ${otherStatusSubscriptions.length} subscription(s) with other statuses to cancel`);
					
					for (const subscription of otherStatusSubscriptions) {
						try {
							await stripe.subscriptions.cancel(subscription.id);
							console.log(`[Account Delete] ✅ Cancelled subscription: ${subscription.id} (status: ${subscription.status})`);
						} catch (subscriptionError: any) {
							console.error(`[Account Delete] ❌ Error cancelling subscription ${subscription.id}:`, subscriptionError);
							// Continue with other subscriptions even if one fails
						}
					}
				}
			} else {
				console.log('[Account Delete] No Stripe customer found for user - skipping subscription cancellation');
			}
		} catch (subscriptionError: any) {
			console.error('[Account Delete] Error during subscription cancellation process:', subscriptionError);
			// Continue with account deletion even if subscription cancellation fails
			// This ensures the account can still be deleted even if Stripe is unreachable
		}

		// 2. Delete from stripe_customers
		const { error: deleteStripeError } = await adminSupabase
			.from('stripe_customers')
			.delete()
			.eq('user_id', userId);

		if (deleteStripeError) {
			console.error('Error deleting from stripe_customers:', deleteStripeError);
		}

		// 3. Delete from dbasakan.profiles if exists
		const { error: deleteProfileError } = await dbasakanClient
			.from('profiles')
			.delete()
			.eq('id', userId);

		if (deleteProfileError && deleteProfileError.code !== 'PGRST116') {
			console.error('Error deleting from profiles:', deleteProfileError);
		}

		// 4. Delete from NextAuth tables
		// Note: accounts and sessions have ON DELETE CASCADE, so deleting user will cascade
		const { error: deleteUserError } = await dbasakanClient
			.from('users')
			.delete()
			.eq('id', userId);

		if (deleteUserError) {
			console.error('Error deleting from dbasakan.users:', deleteUserError);
			// If dbasakan.users doesn't exist, try public schema
			const { error: deletePublicUserError } = await adminSupabase
				.from('users')
				.delete()
				.eq('id', userId);

			if (deletePublicUserError) {
				console.error('Error deleting from public users:', deletePublicUserError);
			}
		}

		// 5. Delete accounts (should cascade, but delete explicitly to be sure)
		const { error: deleteAccountsError } = await dbasakanClient
			.from('accounts')
			.delete()
			.eq('user_id', userId);

		if (deleteAccountsError && deleteAccountsError.code !== 'PGRST116') {
			console.error('Error deleting accounts:', deleteAccountsError);
		}

		// 6. Delete sessions
		const { error: deleteSessionsError } = await dbasakanClient
			.from('sessions')
			.delete()
			.eq('user_id', userId);

		if (deleteSessionsError && deleteSessionsError.code !== 'PGRST116') {
			console.error('Error deleting sessions:', deleteSessionsError);
		}

		// 7. Delete verification tokens (by email)
		if (session.user?.email) {
			const { error: deleteVerificationError } = await dbasakanClient
				.from('verification_tokens')
				.delete()
				.eq('identifier', session.user.email);

			if (deleteVerificationError && deleteVerificationError.code !== 'PGRST116') {
				console.error('Error deleting verification tokens:', deleteVerificationError);
			}
		}

		return NextResponse.json({ 
			success: true, 
			message: 'Account deleted successfully' 
		});

	} catch (error: any) {
		console.error('Error deleting account:', error);
		return NextResponse.json({ 
			error: 'Failed to delete account', 
			details: error.message 
		}, { status: 500 });
	}
}

