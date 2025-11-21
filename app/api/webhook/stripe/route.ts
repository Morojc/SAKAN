import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/utils/stripe';
import { createSupabaseAdminClient } from '@/utils/supabase/server';
import Stripe from 'stripe';
// This is where we receive Stripe webhook events
// It used to update the user data, send emails, etc...
// By default, it'll store the user in the database

const supabaseAdmin = await createSupabaseAdminClient();

export async function POST(request: NextRequest) {
	try {
		const rawBody = await request.text();
		const signature = request.headers.get('stripe-signature');
		// verify Stripe event is legit
		let event;
		try {
			event = await stripe.webhooks.constructEventAsync(rawBody, signature!, process.env.STRIPE_WEBHOOK_SECRET!);
		} catch (error: any) {
			console.error(`Webhook signature verification failed: ${error.message}`);
			return NextResponse.json({ statusCode: 400, message: 'Webhook Error' }, { status: 400 });
		}

		const eventType = event.type;
		try {
			switch (eventType) {
				case 'checkout.session.completed': {
					// First payment is successful and a subscription is created (if mode was set to "subscription" in ButtonCheckout)
					// ✅ Grant access to the product
					console.log('checkout.session.completed');
					const session: Stripe.Checkout.Session = event.data.object;
					const userId = session.metadata?.user_id;
					const customerId = session.customer;
					// 用 subscription ID 
					const subscription = await stripe.subscriptions.retrieve(session.subscription as string);


					// console.log('session.subscription', session);
					// Create or update the stripe_customer_id in the stripe_customers table
					const { data, error } = await supabaseAdmin.from('stripe_customers')
						.upsert([{
							user_id: userId as string,
							stripe_customer_id: customerId as string,
							subscription_id: session.subscription as string,
							plan_active: true,
							plan_expires: subscription.current_period_end * 1000
						}]);
					if (error) {
						console.log('checkout.session.completed.....', error);
					}
					break;
				}

				case 'customer.subscription.updated': {
					// The customer might have changed the plan (higher or lower plan, cancel soon etc...)
					console.log('subscription.updated.....');
					const subscription: Stripe.Subscription = event.data.object;
					// console.log(subscription);
					const processedData = processSubscriptionWebhook(subscription);
					if (processedData?.type === 'cancellation') {
						console.log('subscription cancelled .....', processedData);
					} else if (processedData?.type === 'new_subscription') {
						console.log('subscription new .....');
					} else if (processedData?.type === 'renewal') {
						console.log('subscription renewal .....', processedData);
					}
					break;
				}

				case 'customer.subscription.deleted': {
					// The customer subscription stopped
					// refund the subscription
					// ❌ Revoke access to the product
					const subscription = event.data.object;
					console.log('customer.subscription.deleted..........');
					const { error } = await supabaseAdmin
						.from('stripe_customers')
						.update({ plan_active: false, subscription_id: null })
						.eq('subscription_id', subscription.id);
					if (error) {
						console.log('customer.subscription.deleted..........', error);
					}
					break;
				}

				case 'invoice.payment_succeeded': {
					const invoice = event.data.object;
					console.log("invoice payment succeeded......");
					// Extract plan and product info from the first line item
					// const lineItem = invoice.lines.data[0];

					// const qty = lineItem.quantity ?? 1;
					// let plan_expires_time = null;
					// plan_expires_time = new Date().getTime() + qty * 30 * 24 * 60 * 60 * 1000;

					// const subscription_id = invoice.subscription;
					// const { data: subscription_data, error: subscription_error } = await supabaseAdmin
					// 	.from('stripe_customers')
					// 	.select('subscription_id')
					// 	.eq('subscription_id', subscription_id);
					// console.log("subscription_data", subscription_data);
					// console.log("subscription_error", subscription_error);
					// const { data, error } = await supabaseAdmin
					// 	.from('stripe_customers')
					// 	.update({ plan_expires: plan_expires_time })
					// 	.eq('subscription_id', subscription_id);
					// console.log("update plan_expires ", data, error);
					break;
				}

				case 'invoice.payment_failed': {
					// A payment failed (for instance the customer does not have a valid payment method)
					// ❌ Revoke access to the product
					// ⏳ OR wait for the customer to pay (more friendly):
					//      - Stripe will automatically email the customer (Smart Retries)
					//      - We will receive a "customer.subscription.deleted" when all retries were made and the subscription has expired
					break;
				}

				case 'invoice.paid': {
					// Customer just paid an invoice (for instance, a recurring payment for a subscription)
					// ✅ Grant access to the product
					const priceId = event.data.object.lines.data[0].price?.id;
					const customerId = event.data.object.customer;
					console.log("event.data.object");
					console.log("priceId", priceId);
					console.log("customerId", customerId);
					// Make sure the invoice is for the same plan (priceId) the user subscribed to

					break;
				}

				case 'charge.refunded': {
					const charge = event.data.object;
					console.log('charge.refunded.........');
					console.log('refund amount:', charge.amount_refunded);
					console.log('charge id:', charge.id);
					break;
				}
			}
		} catch (error: any) {
			console.error('Error processing webhook:', error);
			return NextResponse.json({ message: error.message }, { status: 500 });
		}

		return NextResponse.json({ statusCode: 200, message: 'success' });
	} catch (error: any) {
		return NextResponse.json({ message: error.message }, { status: 500 });
	}
}

// 定义提取的数据类型
interface BaseSubscriptionData {
	subscription_id: string;
	customer_id: string;
	status: string;
	type: 'new_subscription' | 'renewal' | 'cancellation';
}

interface NewSubscriptionData extends BaseSubscriptionData {
	type: 'new_subscription';
	start_date: number;
	current_period_start: number;
	current_period_end: number;
	plan_amount: number;
	currency: string;
	latest_invoice: string;
}

interface RenewalData extends BaseSubscriptionData {
	type: 'renewal';
	current_period_start: number;
	current_period_end: number;
	plan_amount: number;
	currency: string;
	latest_invoice: string;
}

interface CancellationData extends BaseSubscriptionData {
	type: 'cancellation';
	cancel_at_period_end: boolean;
	canceled_at: number;
	cancel_at: number;
	reason: string;
	current_period_end: number;
}

type SubscriptionData = NewSubscriptionData | RenewalData | CancellationData;

// 处理 Webhook 的函数
function processSubscriptionWebhook(subscription: Stripe.Subscription): SubscriptionData | null {
	const baseData = {
		subscription_id: subscription.id,
		customer_id: subscription.customer as string,
		status: subscription.status,
	};

	// 退订: 有 cancel_at_period_end 和 canceled_at
	if (subscription.cancel_at_period_end && subscription.canceled_at) {
		return {
			...baseData,
			type: 'cancellation',
			cancel_at_period_end: subscription.cancel_at_period_end,
			canceled_at: subscription.canceled_at,
			cancel_at: subscription.cancel_at!,
			reason: subscription.cancellation_details?.reason || 'unknown',
			current_period_end: subscription.current_period_end,
		};
	}

	// 新订阅: created 和 current_period_start 相同
	if (subscription.created === subscription.current_period_start) {
		const items = subscription.items.data[0];
		return {
			...baseData,
			type: 'new_subscription',
			start_date: subscription.start_date,
			current_period_start: subscription.current_period_start,
			current_period_end: subscription.current_period_end,
			plan_amount: items?.price?.unit_amount || 0,
			currency: subscription.currency,
			latest_invoice: typeof subscription.latest_invoice === 'string' ? subscription.latest_invoice : subscription.latest_invoice?.id || '',
		};
	}

	// 续订: created 早于 current_period_start
	const items = subscription.items.data[0];
	return {
		...baseData,
		type: 'renewal',
		current_period_start: subscription.current_period_start,
		current_period_end: subscription.current_period_end,
		plan_amount: items?.price?.unit_amount || 0,
		currency: subscription.currency,
		latest_invoice: typeof subscription.latest_invoice === 'string' ? subscription.latest_invoice : subscription.latest_invoice?.id || '',
	};
}