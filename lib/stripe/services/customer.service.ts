import { stripe } from '@/utils/stripe';
import Stripe from 'stripe';
import { createSupabaseAdminClient } from '@/utils/supabase/server';

/**
 * Stripe Customer Service
 * Gets Stripe Customer ID from database, then queries Stripe SDK
 */

/**
 * Get Stripe Customer ID from database by user_id
 * @param userId - The application user ID (NextAuth)
 * @returns Stripe customer ID or null
 */
export async function getStripeCustomerIdFromDB(userId: string): Promise<string | null> {
	try {
		console.log('[Stripe Customer Service] Getting Stripe customer ID from DB for user:', userId);
		
		const supabase = createSupabaseAdminClient();
		
		// Use .limit(1) instead of .single() to handle duplicate entries gracefully
		// Order by updated_at or created_at to get the most recent entry
		const { data, error } = await supabase
			.from('stripe_customers')
			.select('stripe_customer_id, created_at')
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
			.limit(1);

		console.log('[Stripe Customer Service] Query result:', { 
			data, 
			error, 
			hasData: !!data,
			rowCount: data?.length 
		});
		
		if (error) {
			console.error('[Stripe Customer Service] Database error:', {
				code: error.code,
				message: error.message,
				details: error.details,
				hint: error.hint
			});
			return null;
		}
		
		if (!data || data.length === 0) {
			console.log('[Stripe Customer Service] No Stripe customer found in DB for user:', userId);
			return null;
		}

		// Get the first (most recent) entry
		const stripeCustomerId = data[0].stripe_customer_id;
		
		// Log warning if duplicates exist
		if (data.length > 1) {
			console.warn(`[Stripe Customer Service] ⚠️ Found multiple entries for user ${userId}. Using most recent.`);
		}

		console.log('[Stripe Customer Service] Found Stripe customer ID:', stripeCustomerId);
		return stripeCustomerId;
	} catch (error: any) {
		console.error('[Stripe Customer Service] Exception getting customer ID from DB:', error);
		return null;
	}
}

/**
 * Get Stripe customer by user_id
 * First gets customer ID from database, then retrieves from Stripe
 * @param userId - The application user ID
 * @returns Stripe customer object or null
 */
export async function getCustomerByUserId(userId: string): Promise<Stripe.Customer | null> {
	try {
		console.log('[Stripe Customer Service] Getting customer for user_id:', userId);

		// Get Stripe customer ID from database
		const stripeCustomerId = await getStripeCustomerIdFromDB(userId);
		if (!stripeCustomerId) {
			console.log('[Stripe Customer Service] No customer found for user_id:', userId);
			return null;
		}

		// Retrieve customer from Stripe using the customer ID
		const customer = await stripe.customers.retrieve(stripeCustomerId);

		if (customer.deleted) {
			console.log('[Stripe Customer Service] Customer is deleted:', stripeCustomerId);
			return null;
		}

		console.log('[Stripe Customer Service] Retrieved customer from Stripe:', customer.id);
		return customer as Stripe.Customer;
	} catch (error: any) {
		console.error('[Stripe Customer Service] Error retrieving customer:', error);
		throw new Error(`Failed to retrieve customer: ${error.message}`);
	}
}

/**
 * Get customer ID by user_id
 * @param userId - The application user ID
 * @returns Stripe customer ID or null
 */
export async function getCustomerIdByUserId(userId: string): Promise<string | null> {
	return await getStripeCustomerIdFromDB(userId);
}

/**
 * Create or retrieve customer for a user
 * @param userId - The application user ID
 * @param email - Customer email
 * @param name - Customer name (optional)
 * @returns Stripe customer object
 */
export async function getOrCreateCustomer(
	userId: string,
	email: string,
	name?: string
): Promise<Stripe.Customer> {
	console.log('[Stripe Customer Service] Getting or creating customer for user_id:', userId);

	// First try to find existing customer
	const existingCustomer = await getCustomerByUserId(userId);
	if (existingCustomer) {
		console.log('[Stripe Customer Service] Using existing customer:', existingCustomer.id);
		return existingCustomer;
	}

	// Create new customer with user_id in metadata
	console.log('[Stripe Customer Service] Creating new customer for user_id:', userId);
	const customer = await stripe.customers.create({
		email,
		name,
		metadata: {
			user_id: userId,
		},
	});

	console.log('[Stripe Customer Service] Created new customer:', customer.id);
	return customer;
}

