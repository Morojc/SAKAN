import { stripe } from '@/utils/stripe';
import Stripe from 'stripe';
import { getCustomerByUserId } from './customer.service';
import config from '@/config';

/**
 * Stripe Subscription Service
 * All subscription operations use Stripe SDK directly - never query database
 */

/**
 * Get plan name from price ID (matches config.ts structure)
 */
function getPlanNameFromPriceId(priceId: string): { name: string; interval: string } {
	const configEntries = Object.entries(config.stripe);
	for (const [type, data] of configEntries) {
		if (data.monthPriceId === priceId || data.yearPriceId === priceId) {
			return {
				name: data.name || type.charAt(0).toUpperCase() + type.slice(1),
				interval: data.monthPriceId === priceId ? 'month' : 'year',
			};
		}
	}
	return { name: 'Unknown Plan', interval: 'month' };
}

/**
 * Get active subscription for a user
 * Gets Stripe customer ID from DB, then queries Stripe SDK
 * @param userId - The application user ID
 * @returns Active subscription object with plan info or null
 */
export async function getActiveSubscriptionByUserId(
	userId: string
): Promise<{
	subscription: Stripe.Subscription | null;
	customer: Stripe.Customer | null;
	planName: string;
	planInterval: string;
	priceId: string | null;
	customerId: string | null;
} | null> {
	try {
		console.log('[Stripe Subscription Service] Getting subscription for user_id:', userId);

		// Get customer from Stripe (which gets ID from DB first)
		const customer = await getCustomerByUserId(userId);
		if (!customer) {
			console.log('[Stripe Subscription Service] No customer found for user_id:', userId);
			return {
				subscription: null,
				customer: null,
				planName: 'Free',
				planInterval: 'month',
				priceId: null,
				customerId: null,
			};
		}

		console.log('[Stripe Subscription Service] Found customer:', customer.id);

		// Get all active subscriptions for this Stripe customer
		const subscriptions = await stripe.subscriptions.list({
			customer: customer.id,
			status: 'active',
			limit: 10,
		});

		// Find active subscription (status = 'active' and not canceled)
		const activeSubscription = subscriptions.data.find(
			(sub) => sub.status === 'active' && !sub.canceled_at
		);

		if (!activeSubscription) {
			console.log('[Stripe Subscription Service] No active subscription found for customer:', customer.id);
			return {
				subscription: null,
				customer,
				planName: 'Free',
				planInterval: 'month',
				priceId: null,
				customerId: customer.id,
			};
		}

		console.log('[Stripe Subscription Service] Found active subscription:', activeSubscription.id);

		// Get plan information from subscription
		const priceId = activeSubscription.items.data[0]?.price?.id || null;
		const planInfo = priceId ? getPlanNameFromPriceId(priceId) : { name: 'Unknown Plan', interval: 'month' };

		return {
			subscription: activeSubscription,
			customer,
			planName: planInfo.name,
			planInterval: planInfo.interval,
			priceId,
			customerId: customer.id,
		};
	} catch (error: any) {
		console.error('[Stripe Subscription Service] Error getting subscription:', error);
		throw new Error(`Failed to get subscription: ${error.message}`);
	}
}

/**
 * Check if user has an active subscription
 * @param userId - The application user ID
 * @returns boolean
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
	try {
		const result = await getActiveSubscriptionByUserId(userId);
		return result?.subscription !== null && result?.subscription?.status === 'active';
	} catch (error) {
		console.error('[Stripe Subscription Service] Error checking subscription status:', error);
		return false;
	}
}

/**
 * Get subscription details for display
 * @param userId - The application user ID
 * @returns Formatted subscription data
 */
export async function getSubscriptionDetails(userId: string) {
	try {
		const result = await getActiveSubscriptionByUserId(userId);

		if (!result || !result.subscription) {
			return {
				planName: 'Free',
				planInterval: 'month',
				status: 'inactive',
				priceId: null,
				customerId: null,
				currentPeriodEnd: null,
			};
		}

		return {
			planName: result.planName,
			planInterval: result.planInterval,
			status: result.subscription.status,
			priceId: result.priceId,
			customerId: result.customerId,
			currentPeriodEnd: result.subscription.current_period_end
				? new Date(result.subscription.current_period_end * 1000)
				: null,
			subscriptionId: result.subscription.id,
		};
	} catch (error: any) {
		console.error('[Stripe Subscription Service] Error getting subscription details:', error);
		return {
			planName: 'Free',
			planInterval: 'month',
			status: 'inactive',
			priceId: null,
			customerId: null,
			currentPeriodEnd: null,
		};
	}
}

