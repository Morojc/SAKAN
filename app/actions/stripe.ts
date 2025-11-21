'use server';

import { stripe } from '@/utils/stripe';
import { headers } from 'next/headers';
import { createSupabaseAdminClient } from '@/utils/supabase/server';
const supabaseAdmin = await createSupabaseAdminClient();
export async function createPortalSession(customerId: string) {
	if (!customerId) {
		throw new Error('Customer ID is required');
	}

	try {
		// get the current domain
		const headersList = await headers();
		const host = headersList.get('host');
		const protocol = headersList.get('x-forwarded-proto') || 'http';
		const baseUrl = `${protocol}://${host}`;
		const session = await stripe.billingPortal.sessions.create({
			customer: customerId,
			return_url: `${baseUrl}/app`,
		});
		return session.url; // return Portal URL
	} catch (error) {
		console.error('Error creating portal session:', error);
		throw new Error('Failed to create portal session');
	}
}


export async function refund(subscriptionId: string) {
	try {
		const subscription = await stripe.subscriptions.retrieve(subscriptionId);
		const latestInvoice = await stripe.invoices.retrieve(subscription.latest_invoice as string);

		if (latestInvoice.payment_intent) {
			const refund = await stripe.refunds.create({
				payment_intent: latestInvoice.payment_intent as string,
			});
			console.log('Refund created:', refund);
		}

		// Cancel the subscription immediately
		const cancelledSubscription = await stripe.subscriptions.cancel(subscriptionId);
		console.log('Cancelled subscription:', cancelledSubscription);

		//supabase delete the subscription
		const { data, error } = await supabaseAdmin.from('stripe_customers').delete().eq('subscription_id', subscriptionId);
		if (error) {
			console.error('Error deleting subscription:', error);
		}
		console.log('Deleted subscription:', data);

		return { success: true };
	} catch (error: any) {
		console.error('Error processing refund:', error);
		throw new Error('Failed to process refund');
	}
}