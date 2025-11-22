'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { createBillingPortalSession } from '@/lib/stripe/services/billing.service';
import { refundSubscriptionPayment } from '@/lib/stripe/services/payment.service';
import { stripe } from '@/utils/stripe';

/**
 * Create billing portal session for current user
 * Uses Stripe SDK directly - no database queries
 */
export async function createPortalSession(customerId?: string) {
	try {
		console.log('[Stripe Actions] Creating portal session');

		// Get current user
		const session = await auth();
		const userId = session?.user?.id;

		if (!userId && !customerId) {
			throw new Error('User authentication required');
		}

		// Get current domain for return URL
		const headersList = await headers();
		const host = headersList.get('host');
		const protocol = headersList.get('x-forwarded-proto') || 'http';
		const baseUrl = `${protocol}://${host}`;
		const returnUrl = `${baseUrl}/app/billing`;

		// If customerId provided, use it directly
		// Otherwise, find customer by userId via Stripe SDK
		let portalUrl: string;

		if (customerId) {
			console.log('[Stripe Actions] Using provided customer ID:', customerId);
			const { createBillingPortalSessionByCustomerId } = await import(
				'@/lib/stripe/services/billing.service'
			);
			portalUrl = await createBillingPortalSessionByCustomerId(customerId, returnUrl);
		} else if (userId) {
			console.log('[Stripe Actions] Finding customer for user_id:', userId);
			portalUrl = await createBillingPortalSession(userId, returnUrl);
		} else {
			throw new Error('Customer ID or user ID required');
		}

		console.log('[Stripe Actions] Portal session created successfully');
		return portalUrl;
	} catch (error: any) {
		console.error('[Stripe Actions] Error creating portal session:', error);
		throw new Error(`Failed to create portal session: ${error.message}`);
	}
}

/**
 * Refund subscription and optionally cancel it
 * Uses Stripe SDK directly - no database queries for reads
 */
export async function refund(subscriptionId: string, cancelSubscription: boolean = true) {
	try {
		console.log('[Stripe Actions] Processing refund for subscription:', subscriptionId);

		// Create refund using Stripe SDK
		const refund = await refundSubscriptionPayment(subscriptionId);
		console.log('[Stripe Actions] Refund created:', refund.id);

		// Optionally cancel the subscription
		if (cancelSubscription) {
			const cancelledSubscription = await stripe.subscriptions.cancel(subscriptionId);
			console.log('[Stripe Actions] Subscription cancelled:', cancelledSubscription.id);
		}

		// Note: We don't delete from database here
		// Database is updated by webhooks for audit trail
		// All reads should come from Stripe SDK

		return { success: true, refundId: refund.id };
	} catch (error: any) {
		console.error('[Stripe Actions] Error processing refund:', error);
		throw new Error(`Failed to process refund: ${error.message}`);
	}
}