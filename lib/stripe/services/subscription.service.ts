import { stripe } from '@/utils/stripe';
import Stripe from 'stripe';
import { getCustomerByUserId } from './customer.service';
import config from '@/config';

/**
 * Stripe Subscription Service
 * All subscription operations use Stripe SDK directly - never query database
 * 
 * USAGE EXAMPLES:
 * 
 * 1. Check if user has active subscription:
 *    const isActive = await hasActiveSubscription(userId);
 * 
 * 2. Check if user has canceled subscription with remaining access:
 *    const isCanceled = await hasCanceledSubscription(userId);
 * 
 * 3. Get full subscription details (for billing page):
 *    const details = await getSubscriptionDetails(userId);
 *    console.log(details.cancelAtPeriodEnd); // true if scheduled for cancellation
 *    console.log(details.daysRemaining);     // days until access ends
 * 
 * 4. Get canceled subscription details specifically:
 *    const canceled = await getCanceledSubscriptionByUserId(userId);
 *    if (canceled?.subscription) {
 *      console.log(`Access ends in ${canceled.daysRemaining} days`);
 *      console.log(`Until: ${canceled.accessUntil?.toLocaleDateString()}`);
 *    }
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
 * Get active subscription for a user (including those scheduled for cancellation)
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

		// Find active subscription (status = 'active')
		// NOTE: We include subscriptions with cancel_at_period_end = true
		// because they still have active access until the period ends
		const activeSubscription = subscriptions.data.find(
			(sub) => sub.status === 'active'
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
		if (activeSubscription.cancel_at_period_end) {
			console.log('[Stripe Subscription Service] ⚠️ Subscription is scheduled for cancellation');
		}

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
 * Get canceled subscription that still has active access
 * This finds subscriptions where cancel_at_period_end = true
 * @param userId - The application user ID
 * @returns Canceled subscription details or null
 */
export async function getCanceledSubscriptionByUserId(
	userId: string
): Promise<{
	subscription: Stripe.Subscription | null;
	customer: Stripe.Customer | null;
	planName: string;
	planInterval: string;
	priceId: string | null;
	customerId: string | null;
	daysRemaining: number | null;
	accessUntil: Date | null;
	canceledAt: Date | null;
} | null> {
	try {
		console.log('[Stripe Subscription Service] Checking for canceled subscription with remaining access for user_id:', userId);

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
				daysRemaining: null,
				accessUntil: null,
				canceledAt: null,
			};
		}

		console.log('[Stripe Subscription Service] Found customer:', customer.id);

		// Get all active subscriptions (status = 'active')
		const subscriptions = await stripe.subscriptions.list({
			customer: customer.id,
			status: 'active',
			limit: 10,
		});

		// Find subscription that is scheduled for cancellation
		const canceledSubscription = subscriptions.data.find(
			(sub) => sub.status === 'active' && sub.cancel_at_period_end === true
		);

		if (!canceledSubscription) {
			console.log('[Stripe Subscription Service] No canceled subscription found for customer:', customer.id);
			return {
				subscription: null,
				customer,
				planName: 'Free',
				planInterval: 'month',
				priceId: null,
				customerId: customer.id,
				daysRemaining: null,
				accessUntil: null,
				canceledAt: null,
			};
		}

		console.log('[Stripe Subscription Service] ✓ Found canceled subscription with remaining access:', canceledSubscription.id);

		// Get plan information from subscription
		const priceId = canceledSubscription.items.data[0]?.price?.id || null;
		const planInfo = priceId ? getPlanNameFromPriceId(priceId) : { name: 'Unknown Plan', interval: 'month' };

		// Calculate days remaining
		const accessUntil = canceledSubscription.current_period_end
			? new Date(canceledSubscription.current_period_end * 1000)
			: null;
		
		let daysRemaining: number | null = null;
		if (accessUntil) {
			const now = new Date();
			const diffTime = accessUntil.getTime() - now.getTime();
			daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		}

		const canceledAt = canceledSubscription.canceled_at
			? new Date(canceledSubscription.canceled_at * 1000)
			: null;

		console.log('[Stripe Subscription Service] Cancellation details:', {
			daysRemaining,
			accessUntil: accessUntil?.toISOString(),
			canceledAt: canceledAt?.toISOString(),
		});

		return {
			subscription: canceledSubscription,
			customer,
			planName: planInfo.name,
			planInterval: planInfo.interval,
			priceId,
			customerId: customer.id,
			daysRemaining,
			accessUntil,
			canceledAt,
		};
	} catch (error: any) {
		console.error('[Stripe Subscription Service] Error getting canceled subscription:', error);
		throw new Error(`Failed to get canceled subscription: ${error.message}`);
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
 * Check if user has a canceled subscription with remaining access
 * @param userId - The application user ID
 * @returns boolean
 */
export async function hasCanceledSubscription(userId: string): Promise<boolean> {
	try {
		const result = await getCanceledSubscriptionByUserId(userId);
		return result?.subscription !== null && result?.subscription?.cancel_at_period_end === true;
	} catch (error) {
		console.error('[Stripe Subscription Service] Error checking canceled subscription:', error);
		return false;
	}
}

/**
 * Get subscription details for display
 * @param userId - The application user ID
 * @returns Formatted subscription data with cancellation info
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
				subscriptionId: null,
				currentPeriodEnd: null,
				currentPeriodStart: null,
				cancelAt: null,
				cancelAtPeriodEnd: false,
				canceledAt: null,
				daysRemaining: null,
			};
		}

		const subscription = result.subscription;
		const currentPeriodEnd = subscription.current_period_end
			? new Date(subscription.current_period_end * 1000)
			: null;
		
		// Calculate days remaining
		let daysRemaining: number | null = null;
		if (currentPeriodEnd) {
			const now = new Date();
			const diffTime = currentPeriodEnd.getTime() - now.getTime();
			daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		}

		return {
			planName: result.planName,
			planInterval: result.planInterval,
			status: subscription.status,
			priceId: result.priceId,
			customerId: result.customerId,
			subscriptionId: subscription.id,
			currentPeriodEnd,
			currentPeriodStart: subscription.current_period_start
				? new Date(subscription.current_period_start * 1000)
				: null,
			// Cancellation details
			cancelAt: subscription.cancel_at
				? new Date(subscription.cancel_at * 1000)
				: null,
			cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
			canceledAt: subscription.canceled_at
				? new Date(subscription.canceled_at * 1000)
				: null,
			daysRemaining,
		};
	} catch (error: any) {
		console.error('[Stripe Subscription Service] Error getting subscription details:', error);
		return {
			planName: 'Free',
			planInterval: 'month',
			status: 'inactive',
			priceId: null,
			customerId: null,
			subscriptionId: null,
			currentPeriodEnd: null,
			currentPeriodStart: null,
			cancelAt: null,
			cancelAtPeriodEnd: false,
			canceledAt: null,
			daysRemaining: null,
		};
	}
}

