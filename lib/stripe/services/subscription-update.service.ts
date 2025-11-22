import { stripe } from '@/utils/stripe';
import Stripe from 'stripe';
import { getCustomerByUserId } from './customer.service';
import { getActiveSubscriptionByUserId } from './subscription.service';

/**
 * Subscription Update Service
 * Handles plan upgrades, downgrades, and plan changes
 */

/**
 * Update subscription to a new plan
 * IMPORTANT: This function ensures the subscription:
 * - Stays ACTIVE (not canceled)
 * - Continues to RENEW automatically with the new plan
 * - Removes any scheduled cancellation (cancel_at_period_end = false)
 * 
 * @param userId - The application user ID
 * @param newPriceId - The new Stripe Price ID to change to
 * @param prorationBehavior - How to handle proration (default: 'create_prorations')
 * @returns Updated subscription object
 */
export async function updateSubscriptionPlan(
	userId: string,
	newPriceId: string,
	prorationBehavior: 'always_invoice' | 'create_prorations' | 'none' = 'create_prorations'
): Promise<Stripe.Subscription> {
	try {
		console.log('[Subscription Update Service] Updating subscription for user:', userId, 'to price:', newPriceId);

		// Get the active subscription
		const subscriptionResult = await getActiveSubscriptionByUserId(userId);
		
		if (!subscriptionResult?.subscription) {
			throw new Error('No active subscription found');
		}

		const subscription = subscriptionResult.subscription;
		const currentPriceId = subscription.items.data[0]?.price?.id;

		if (!currentPriceId) {
			throw new Error('Current subscription price ID not found');
		}

		// Check if user is trying to switch to the same plan
		if (currentPriceId === newPriceId) {
			throw new Error('You are already subscribed to this plan');
		}

		console.log('[Subscription Update Service] Current plan:', currentPriceId, '→ New plan:', newPriceId);

		// Get the subscription item ID
		const subscriptionItemId = subscription.items.data[0]?.id;
		if (!subscriptionItemId) {
			throw new Error('Subscription item ID not found');
		}

		// Check if subscription is scheduled for cancellation
		const isScheduledForCancellation = subscription.cancel_at_period_end === true;
		
		console.log('[Subscription Update Service] Subscription details:', {
			cancel_at_period_end: subscription.cancel_at_period_end,
			status: subscription.status,
			isScheduledForCancellation,
		});

		// Update the subscription
		// IMPORTANT: Set cancel_at_period_end to false to ensure subscription continues to renew
		const updateParams: Stripe.SubscriptionUpdateParams = {
			items: [
				{
					id: subscriptionItemId,
					price: newPriceId,
				},
			],
			proration_behavior: prorationBehavior,
			// Remove cancellation and ensure subscription continues to renew
			cancel_at_period_end: false,
			metadata: {
				...subscription.metadata,
				user_id: userId,
				updated_at: new Date().toISOString(),
				plan_changed_at: new Date().toISOString(),
			},
		};

		const updatedSubscription = await stripe.subscriptions.update(subscription.id, updateParams);

		// Log important changes
		if (isScheduledForCancellation) {
			console.log('[Subscription Update Service] ✅ Removed cancellation schedule - subscription will continue to renew');
		}
		
		console.log('[Subscription Update Service] Subscription updated successfully:', {
			subscriptionId: updatedSubscription.id,
			status: updatedSubscription.status,
			cancel_at_period_end: updatedSubscription.cancel_at_period_end,
			newPriceId: updatedSubscription.items.data[0]?.price?.id,
		});

		return updatedSubscription;
	} catch (error: any) {
		console.error('[Subscription Update Service] Error updating subscription:', error);
		throw new Error(`Failed to update subscription: ${error.message}`);
	}
}

/**
 * Check if a plan change is an upgrade or downgrade
 * @param currentPriceId - Current Stripe Price ID
 * @param newPriceId - New Stripe Price ID
 * @returns 'upgrade', 'downgrade', or 'same'
 */
export async function getPlanChangeType(
	currentPriceId: string,
	newPriceId: string
): Promise<'upgrade' | 'downgrade' | 'same'> {
	if (currentPriceId === newPriceId) {
		return 'same';
	}

	try {
		// Get price details from Stripe
		const [currentPrice, newPrice] = await Promise.all([
			stripe.prices.retrieve(currentPriceId),
			stripe.prices.retrieve(newPriceId),
		]);

		const currentAmount = currentPrice.unit_amount || 0;
		const newAmount = newPrice.unit_amount || 0;

		if (newAmount > currentAmount) {
			return 'upgrade';
		} else if (newAmount < currentAmount) {
			return 'downgrade';
		}

		return 'same';
	} catch (error: any) {
		console.error('[Subscription Update Service] Error comparing plans:', error);
		// Default to upgrade if we can't determine
		return 'upgrade';
	}
}

/**
 * Get proration amount for plan change
 * @param userId - The application user ID
 * @param newPriceId - The new Stripe Price ID
 * @returns Proration amount in cents (can be negative for downgrades)
 */
export async function getProrationAmount(
	userId: string,
	newPriceId: string
): Promise<number> {
	try {
		const subscriptionResult = await getActiveSubscriptionByUserId(userId);
		
		if (!subscriptionResult?.subscription) {
			return 0;
		}

		const subscription = subscriptionResult.subscription;
		const subscriptionItemId = subscription.items.data[0]?.id;

		if (!subscriptionItemId) {
			return 0;
		}

		// Create a preview invoice to calculate proration
		const invoice = await stripe.invoices.retrieveUpcoming({
			customer: subscription.customer as string,
			subscription: subscription.id,
			subscription_items: [
				{
					id: subscriptionItemId,
					price: newPriceId,
				},
			],
			subscription_proration_behavior: 'create_prorations',
		});

		// Calculate proration (amount_due represents the prorated amount)
		const prorationAmount = invoice.amount_due || 0;
		console.log('[Subscription Update Service] Proration amount:', prorationAmount);
		
		return prorationAmount;
	} catch (error: any) {
		console.error('[Subscription Update Service] Error calculating proration:', error);
		return 0;
	}
}

