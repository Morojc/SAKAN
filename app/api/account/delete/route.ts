import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/utils/supabase/server';
import { stripe } from '@/utils/stripe';

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

		// 1. Cancel any active Stripe subscriptions
		const { data: stripeCustomer, error: _stripeError } = await adminSupabase
			.from('stripe_customers')
			.select('*')
			.eq('user_id', userId)
			.single();

		if (stripeCustomer?.subscription_id) {
			try {
				// Cancel the subscription immediately
				await stripe.subscriptions.cancel(stripeCustomer.subscription_id);
				console.log(`Cancelled Stripe subscription: ${stripeCustomer.subscription_id}`);
			} catch (stripeErr: any) {
				console.error('Error cancelling Stripe subscription:', stripeErr);
				// Continue with deletion even if Stripe cancellation fails
			}
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

