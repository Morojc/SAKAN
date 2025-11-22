import { stripe } from '@/utils/stripe';
import { getCustomerIdByUserId, getOrCreateCustomer } from './customer.service';

/**
 * Stripe Billing Service
 * All billing portal operations use Stripe SDK directly
 */

/**
 * Create a billing portal session for a user
 * @param userId - The application user ID
 * @param returnUrl - URL to return to after portal session
 * @returns Portal session URL
 */
export async function createBillingPortalSession(
	userId: string,
	returnUrl: string = '/app/billing'
): Promise<string> {
	try {
		console.log('[Stripe Billing Service] Creating portal session for user_id:', userId);

		// Get or create customer
		// Note: We need email, which should come from the authenticated session
		// For now, we'll find existing customer first
		const customerId = await getCustomerIdByUserId(userId);

		if (!customerId) {
			throw new Error('No Stripe customer found. Please subscribe first.');
		}

		console.log('[Stripe Billing Service] Found customer:', customerId);

		// Create portal session
		const session = await stripe.billingPortal.sessions.create({
			customer: customerId,
			return_url: returnUrl,
		});

		console.log('[Stripe Billing Service] Portal session created:', session.id);
		return session.url;
	} catch (error: any) {
		console.error('[Stripe Billing Service] Error creating portal session:', error);
		throw new Error(`Failed to create billing portal session: ${error.message}`);
	}
}

/**
 * Create billing portal session with customer ID directly
 * @param customerId - Stripe customer ID
 * @param returnUrl - URL to return to after portal session
 * @returns Portal session URL
 */
export async function createBillingPortalSessionByCustomerId(
	customerId: string,
	returnUrl: string = '/app/billing'
): Promise<string> {
	try {
		console.log('[Stripe Billing Service] Creating portal session for customer:', customerId);

		const session = await stripe.billingPortal.sessions.create({
			customer: customerId,
			return_url: returnUrl,
		});

		console.log('[Stripe Billing Service] Portal session created:', session.id);
		return session.url;
	} catch (error: any) {
		console.error('[Stripe Billing Service] Error creating portal session:', error);
		throw new Error(`Failed to create billing portal session: ${error.message}`);
	}
}

