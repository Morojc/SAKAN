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
		const { data, error } = await supabase
			.from('stripe_customers')
			.select('stripe_customer_id')
			.eq('user_id', userId)
			.single();

		console.log('[Stripe Customer Service] Data:', data);
		if (error || !data) {
			console.log('[Stripe Customer Service] No Stripe customer found in DB for user:', userId);
			return null;
		}

		console.log('[Stripe Customer Service] Found Stripe customer ID:', data.stripe_customer_id);
		return data.stripe_customer_id;
	} catch (error: any) {
		console.error('[Stripe Customer Service] Error getting customer ID from DB:', error);
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

