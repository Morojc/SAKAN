import { stripe } from '@/lib/stripe/client';
import Stripe from 'stripe';
import { getActiveSubscriptionByUserId } from './subscription.service';

/**
 * Stripe Payment Service
 * All payment operations use Stripe SDK directly
 */

/**
 * Create a refund for a payment intent
 * @param paymentIntentId - Stripe payment intent ID
 * @param amount - Optional amount to refund (partial refund), in cents
 * @returns Refund object
 */
export async function createRefund(
	paymentIntentId: string,
	amount?: number
): Promise<Stripe.Refund> {
	try {
		console.log('[Stripe Payment Service] Creating refund for payment intent:', paymentIntentId);

		const refundParams: Stripe.RefundCreateParams = {
			payment_intent: paymentIntentId,
		};

		if (amount) {
			refundParams.amount = amount;
			console.log('[Stripe Payment Service] Partial refund amount:', amount);
		}

		const refund = await stripe.refunds.create(refundParams);
		console.log('[Stripe Payment Service] Refund created:', refund.id);
		return refund;
	} catch (error: any) {
		console.error('[Stripe Payment Service] Error creating refund:', error);
		throw new Error(`Failed to create refund: ${error.message}`);
	}
}

/**
 * Get payment intent ID from subscription
 * Uses Stripe SDK to retrieve the latest invoice's payment intent
 * @param subscriptionId - Stripe subscription ID
 * @returns Payment intent ID or null
 */
export async function getPaymentIntentIdFromSubscription(
	subscriptionId: string
): Promise<string | null> {
	try {
		console.log('[Stripe Payment Service] Getting payment intent for subscription:', subscriptionId);

		// Retrieve subscription
		const subscription = await stripe.subscriptions.retrieve(subscriptionId);
		console.log('[Stripe Payment Service] Subscription retrieved:', subscription.id);

		// Get the latest invoice
		if (!subscription.latest_invoice) {
			console.log('[Stripe Payment Service] No latest invoice found for subscription');
			return null;
		}

		const invoice = await stripe.invoices.retrieve(
			typeof subscription.latest_invoice === 'string'
				? subscription.latest_invoice
				: subscription.latest_invoice.id
		);
		console.log('[Stripe Payment Service] Invoice retrieved:', invoice.id);

		// Get payment intent ID from invoice
		const paymentIntentId =
			typeof invoice.payment_intent === 'string'
				? invoice.payment_intent
				: invoice.payment_intent?.id || null;

		if (paymentIntentId) {
			console.log('[Stripe Payment Service] Payment intent ID found:', paymentIntentId);
		} else {
			console.log('[Stripe Payment Service] No payment intent found in invoice');
		}

		return paymentIntentId;
	} catch (error: any) {
		console.error('[Stripe Payment Service] Error getting payment intent:', error);
		throw new Error(`Failed to get payment intent: ${error.message}`);
	}
}

/**
 * Create refund for a subscription
 * Gets payment intent from subscription and creates refund
 * @param subscriptionId - Stripe subscription ID
 * @param amount - Optional amount to refund (partial refund), in cents
 * @returns Refund object
 */
export async function refundSubscriptionPayment(
	subscriptionId: string,
	amount?: number
): Promise<Stripe.Refund> {
	try {
		console.log('[Stripe Payment Service] Refunding subscription payment:', subscriptionId);

		// Get payment intent ID from subscription
		const paymentIntentId = await getPaymentIntentIdFromSubscription(subscriptionId);
		if (!paymentIntentId) {
			throw new Error('No payment intent found for subscription');
		}

		// Create refund
		return await createRefund(paymentIntentId, amount);
	} catch (error: any) {
		console.error('[Stripe Payment Service] Error refunding subscription:', error);
		throw error;
	}
}

/**
 * Create refund by user ID
 * Finds subscription for user and creates refund
 * @param userId - Application user ID
 * @param amount - Optional amount to refund (partial refund), in cents
 * @returns Refund object
 */
export async function refundByUserId(userId: string, amount?: number): Promise<Stripe.Refund> {
	try {
		console.log('[Stripe Payment Service] Refunding payment for user_id:', userId);

		// Get active subscription
		const result = await getActiveSubscriptionByUserId(userId);
		if (!result?.subscription) {
			throw new Error('No active subscription found for user');
		}

		// Get payment intent and create refund
		return await refundSubscriptionPayment(result.subscription.id, amount);
	} catch (error: any) {
		console.error('[Stripe Payment Service] Error refunding by user ID:', error);
		throw error;
	}
}

