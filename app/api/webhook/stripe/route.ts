import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/utils/stripe';
import { createSupabaseAdminClient } from '@/utils/supabase/server';
import Stripe from 'stripe';
import config from '@/config';
// This is where we receive Stripe webhook events
// It used to update the user data, send emails, etc...
// By default, it'll store the user in the database
//
// WEBHOOK URL CONFIGURATION:
// 
// LOCAL DEVELOPMENT:
//   Option 1 (localhost): npm run stripe:listen (forwards to localhost:3000/api/webhook/stripe)
//   Option 2 (ngrok): 
//     1. Start ngrok: ngrok http 3000
//     2. Copy the HTTPS URL (e.g., https://abc123.ngrok-free.app)
//     3. Run: stripe listen --forward-to https://YOUR_NGROK_URL.ngrok-free.app/api/webhook/stripe
//     4. Update STRIPE_WEBHOOK_SECRET in .env.local with the secret from stripe listen
//
// PRODUCTION:
//   Configure webhook endpoint in Stripe Dashboard: https://yourdomain.com/api/webhook/stripe
//
// IMPORTANT: 
//   - Update STRIPE_WEBHOOK_SECRET in .env.local with the secret from Stripe CLI
//   - Run: stripe listen --print-secret to get the webhook signing secret
//   - See NGROK_SETUP.md for detailed ngrok configuration

// Create admin client with dbasakan schema configuration
// Note: We create this at module level for webhook handler
let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;

/**
 * Calculate plan expiration timestamp based on interval
 * Falls back to this when Stripe's current_period_end is not available
 * @param interval - 'month' or 'year'
 * @returns Unix timestamp in milliseconds
 */
function calculatePlanExpiresFromInterval(interval: string | null | undefined): number | null {
	if (!interval) {
		return null;
	}

	const now = new Date();
	const expiresAt = new Date(now);

	if (interval === 'month') {
		// Add 1 month, handling month-end correctly
		// This properly handles cases like Jan 31 -> Feb 28/29, and month boundaries
		const currentMonth = now.getMonth();
		const currentYear = now.getFullYear();
		const currentDay = now.getDate();
		
		// Calculate next month and year
		let nextMonth = currentMonth + 1;
		let nextYear = currentYear;
		
		if (nextMonth > 11) {
			nextMonth = 0; // January
			nextYear = currentYear + 1;
		}
		
		// Get the number of days in the target month
		// new Date(year, month + 1, 0) gives the last day of the specified month
		const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
		
		// Set the date, ensuring we don't exceed the number of days in the target month
		// e.g., Jan 31 -> Feb 28 (or 29 in leap year)
		const targetDay = Math.min(currentDay, daysInNextMonth);
		
		// Set year, month, and day separately to avoid Date object quirks
		expiresAt.setFullYear(nextYear, nextMonth, targetDay);
		
	} else if (interval === 'year') {
		// Add 1 year - handles leap years automatically
		expiresAt.setFullYear(now.getFullYear() + 1);
		// Keep the same month and day, handling leap year edge cases
		// If current date is Feb 29 and next year is not a leap year, it will become Feb 28
	} else {
		// Unknown interval, default to 30 days
		expiresAt.setDate(now.getDate() + 30);
	}

	return expiresAt.getTime();
}

async function getSupabaseAdmin() {
	if (!supabaseAdmin) {
		console.log('[Webhook] Initializing Supabase admin client with dbasakan schema');
		const { createClient } = await import('@supabase/supabase-js');
		
		if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
			console.error('[Webhook] Missing Supabase environment variables');
			throw new Error('Supabase environment variables not configured');
		}
		
		supabaseAdmin = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL,
			process.env.SUPABASE_SECRET_KEY,
			{
				db: { schema: 'dbasakan' },
				auth: { persistSession: false },
			}
		) as any;
		
		console.log('[Webhook] Supabase admin client initialized');
	}
	return supabaseAdmin;
}

export async function POST(request: NextRequest) {
	// Log the incoming request URL for debugging
	const url = request.url;
	console.log('[Webhook] Received webhook request at:', url);
	console.log('[Webhook] Request method:', request.method);
	
	try {
		const rawBody = await request.text();
		const signature = request.headers.get('stripe-signature');
		
		if (!signature) {
			console.error('[Webhook] Missing stripe-signature header');
			return NextResponse.json({ statusCode: 400, message: 'Missing signature' }, { status: 400 });
		}
		
		if (!process.env.STRIPE_WEBHOOK_SECRET) {
			console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured');
			return NextResponse.json({ statusCode: 500, message: 'Webhook secret not configured' }, { status: 500 });
		}
		
		// verify Stripe event is legit
		let event;
		try {
			console.log('[Webhook] Verifying webhook signature...');
			event = await stripe.webhooks.constructEventAsync(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
			console.log('[Webhook] Signature verified, event type:', event.type);
		} catch (error: any) {
			console.error('[Webhook] ❌ Signature verification failed:', {
				message: error.message,
				type: error.type,
				detail: error.detail
			});
			return NextResponse.json({ statusCode: 400, message: 'Webhook signature verification failed' }, { status: 400 });
		}

		// Get admin client with dbasakan schema
		const supabaseAdmin = await getSupabaseAdmin();
		
		if (!supabaseAdmin) {
			console.error('[Webhook] Failed to initialize Supabase admin client');
			return NextResponse.json({ statusCode: 500, message: 'Database connection failed' }, { status: 500 });
		}
		
		console.log('[Webhook] Supabase admin client initialized, processing event:', event.type);

		const eventType = event.type;
		try {
			switch (eventType) {
				case 'checkout.session.completed': {
					// First payment is successful and a subscription is created (if mode was set to "subscription" in ButtonCheckout)
					// ✅ Grant access to the product
					console.log('[Webhook] checkout.session.completed - Event received');
					const session: Stripe.Checkout.Session = event.data.object;
					
					// Extract and validate required data
					const userId = session.metadata?.user_id;
					const customerId = typeof session.customer === 'string' 
						? session.customer 
						: session.customer?.id || session.customer;
					const subscriptionId = typeof session.subscription === 'string' 
						? session.subscription 
						: session.subscription?.id || session.subscription;

					console.log('[Webhook] Session data extracted:', {
						userId,
						customerId,
						subscriptionId,
						customerType: typeof session.customer,
						subscriptionType: typeof session.subscription,
						mode: session.mode,
						paymentStatus: session.payment_status
					});

					// Validate required fields
					if (!userId) {
						console.error('[Webhook] Missing user_id in session metadata:', session.metadata);
						break;
					}
					
					if (!customerId) {
						console.error('[Webhook] Missing customer ID in session:', { 
							customer: session.customer,
							sessionId: session.id 
						});
						break;
					}
					
					if (!subscriptionId) {
						console.error('[Webhook] Missing subscription ID in session. This might be a one-time payment, not a subscription:', {
							subscription: session.subscription,
							mode: session.mode,
							sessionId: session.id
						});
						break;
					}

					try {
						// Retrieve full subscription details to get plan information
						console.log('[Webhook] Retrieving subscription details for:', subscriptionId);
						const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
						
						const priceId = subscription.items.data[0]?.price?.id;
						const productId = subscription.items.data[0]?.price?.product;
						const amount = subscription.items.data[0]?.price?.unit_amount || 0;
						const currency = subscription.currency || 'usd';
						const interval = subscription.items.data[0]?.price?.recurring?.interval || 'month';

						// Determine plan name from price ID
						let planName = 'Unknown';
						if (priceId) {
							for (const [planType, planData] of Object.entries(config.stripe)) {
								if (planData.monthPriceId === priceId || planData.yearPriceId === priceId) {
									planName = planData.name;
									break;
								}
							}
						}

						// Safely handle current_period_end - may be null/undefined for some subscription states
						const currentPeriodEnd = subscription.current_period_end;
						let planExpires: number | null = null;
						
						if (currentPeriodEnd && !isNaN(currentPeriodEnd)) {
							// Use Stripe's current_period_end if available
							planExpires = currentPeriodEnd * 1000;
						} else {
							// Fallback: calculate based on interval
							planExpires = calculatePlanExpiresFromInterval(interval);
							console.log('[Webhook] current_period_end not available, calculated plan_expires from interval:', {
								interval,
								planExpires,
								planExpiresDate: planExpires ? new Date(planExpires).toISOString() : null
							});
						}
						
						const expiresAtISO = planExpires ? new Date(planExpires).toISOString() : null;

						console.log('[Webhook] Preparing to save billing data:', {
							userId,
							customerId: String(customerId),
							subscriptionId: String(subscriptionId),
							planName,
							priceId,
							amount: amount / 100, // Convert from cents
							currency,
							interval,
							expiresAt: expiresAtISO,
							planExpires: planExpires,
							currentPeriodEndRaw: currentPeriodEnd
						});

						// Prepare data for database insert with all billing information
						const billingData = {
							user_id: String(userId),
							stripe_customer_id: String(customerId),
							subscription_id: String(subscriptionId),
							plan_active: true,
							plan_expires: planExpires,
							plan_name: planName,
							price_id: priceId || null,
							amount: amount > 0 ? amount / 100 : null, // Convert from cents to currency units
							currency: currency || 'usd',
							interval: interval || null,
							subscription_status: subscription.status || null
							// days_remaining will be calculated automatically by trigger
						};

						console.log('[Webhook] Attempting to upsert to stripe_customers:', billingData);

						// Create or update the stripe_customer_id in the stripe_customers table
						console.log('[Webhook] Executing upsert to stripe_customers table...');
						
						const { data, error } = await supabaseAdmin
							.from('stripe_customers')
							.upsert([billingData], {
								onConflict: 'stripe_customer_id'
							})
							.select();

						if (error) {
							console.error('[Webhook] ❌ Error saving stripe_customers:', {
								error: error.message,
								code: error.code,
								details: error.details,
								hint: error.hint,
								billingData,
								table: 'stripe_customers',
								schema: 'dbasakan'
							});
							
							// Try to insert without onConflict as fallback
							console.log('[Webhook] Attempting fallback insert without onConflict...');
							const { data: fallbackData, error: fallbackError } = await supabaseAdmin
								.from('stripe_customers')
								.insert([billingData])
								.select();
							
							if (fallbackError) {
								console.error('[Webhook] ❌ Fallback insert also failed:', {
									error: fallbackError.message,
									code: fallbackError.code,
									billingData
								});
							} else {
								console.log('[Webhook] ✅ Fallback insert succeeded:', fallbackData);
							}
						} else {
							console.log('[Webhook] ✅ Successfully saved billing data to stripe_customers:', {
								rowsAffected: data?.length || 0,
								data: data
							});
						}
					} catch (subscriptionError: any) {
						console.error('[Webhook] ❌ Error retrieving subscription or saving data:', {
							error: subscriptionError.message,
							subscriptionId,
							stack: subscriptionError.stack
						});
						// Don't break - continue to return success to Stripe
					}
					break;
				}

				case 'customer.subscription.created': {
					// Subscription was just created (may fire before or after checkout.session.completed)
					// This is a critical event to capture subscription data
					console.log('[Webhook] customer.subscription.created - Event received');
					const subscription: Stripe.Subscription = event.data.object;
					
					const subscriptionId = subscription.id;
					const customerId = typeof subscription.customer === 'string' 
						? subscription.customer 
						: subscription.customer?.id;
					
					console.log('[Webhook] Subscription created data:', {
						subscriptionId,
						customerId,
						status: subscription.status,
						metadata: subscription.metadata
					});

					// Validate required fields
					if (!customerId) {
						console.error('[Webhook] Missing customer ID in subscription.created');
						break;
					}

					if (!subscriptionId) {
						console.error('[Webhook] Missing subscription ID in subscription.created');
						break;
					}

					try {
						// Try to get user_id from multiple sources
						let userId: string | null = null;
						
						// 1. Check subscription metadata first
						if (subscription.metadata?.user_id) {
							userId = subscription.metadata.user_id;
							console.log('[Webhook] Found user_id in subscription metadata:', userId);
						}
						
						// 2. If not in metadata, check if we already have this customer in our database
						if (!userId) {
							console.log('[Webhook] user_id not in metadata, checking existing stripe_customers...');
							const { data: existingCustomer, error: lookupError } = await supabaseAdmin
								.from('stripe_customers')
								.select('user_id')
								.eq('stripe_customer_id', String(customerId))
								.maybeSingle();
							
							if (existingCustomer?.user_id) {
								userId = existingCustomer.user_id;
								console.log('[Webhook] Found user_id from existing stripe_customers:', userId);
							} else if (lookupError) {
								console.error('[Webhook] Error looking up existing customer:', lookupError);
							}
						}
						
						// 3. If still no user_id, try to get from customer metadata via Stripe API
						if (!userId) {
							console.log('[Webhook] Attempting to retrieve customer metadata from Stripe...');
							try {
								const customer = await stripe.customers.retrieve(String(customerId));
								if (typeof customer !== 'string' && !customer.deleted && customer.metadata?.user_id) {
									userId = customer.metadata.user_id;
									console.log('[Webhook] Found user_id from customer metadata:', userId);
								}
							} catch (stripeError: any) {
								console.error('[Webhook] Error retrieving customer from Stripe:', stripeError.message);
							}
						}

						// Get subscription details for plan information
						const priceId = subscription.items.data[0]?.price?.id;
						const productId = subscription.items.data[0]?.price?.product;
						const amount = subscription.items.data[0]?.price?.unit_amount || 0;
						const currency = subscription.currency || 'usd';
						const interval = subscription.items.data[0]?.price?.recurring?.interval || 'month';

						// Determine plan name from price ID
						let planName = 'Unknown';
						if (priceId) {
							for (const [planType, planData] of Object.entries(config.stripe)) {
								if (planData.monthPriceId === priceId || planData.yearPriceId === priceId) {
									planName = planData.name;
									break;
								}
							}
						}

						// Safely handle current_period_end - may be null/undefined for some subscription states
						const currentPeriodEnd = subscription.current_period_end;
						let planExpires: number | null = null;
						
						if (currentPeriodEnd && !isNaN(currentPeriodEnd)) {
							// Use Stripe's current_period_end if available
							planExpires = currentPeriodEnd * 1000;
						} else {
							// Fallback: calculate based on interval
							planExpires = calculatePlanExpiresFromInterval(interval);
							console.log('[Webhook] current_period_end not available, calculated plan_expires from interval:', {
								interval,
								planExpires,
								planExpiresDate: planExpires ? new Date(planExpires).toISOString() : null
							});
						}
						
						const expiresAtISO = planExpires ? new Date(planExpires).toISOString() : null;

						console.log('[Webhook] Preparing to save subscription data:', {
							userId,
							customerId: String(customerId),
							subscriptionId: String(subscriptionId),
							planName,
							priceId,
							amount: amount / 100,
							currency,
							interval,
							status: subscription.status,
							expiresAt: expiresAtISO,
							planExpires: planExpires,
							currentPeriodEndRaw: currentPeriodEnd
						});

						// If we have user_id, save to database
						if (userId) {
							const billingData = {
								user_id: String(userId),
								stripe_customer_id: String(customerId),
								subscription_id: String(subscriptionId),
								plan_active: subscription.status === 'active' || subscription.status === 'trialing',
								plan_expires: planExpires,
								plan_name: planName,
								price_id: priceId || null,
								amount: amount > 0 ? amount / 100 : null, // Convert from cents to currency units
								currency: currency || 'usd',
								interval: interval || null,
								subscription_status: subscription.status || null
								// days_remaining will be calculated automatically by trigger
							};

							console.log('[Webhook] Attempting to upsert to stripe_customers:', billingData);
							
							const { data, error } = await supabaseAdmin
								.from('stripe_customers')
								.upsert([billingData], {
									onConflict: 'stripe_customer_id'
								})
								.select();

							if (error) {
								console.error('[Webhook] ❌ Error saving stripe_customers:', {
									error: error.message,
									code: error.code,
									details: error.details,
									hint: error.hint,
									billingData
								});
								
								// Try fallback insert
								console.log('[Webhook] Attempting fallback insert...');
								const { data: fallbackData, error: fallbackError } = await supabaseAdmin
									.from('stripe_customers')
									.insert([billingData])
									.select();
								
								if (fallbackError) {
									console.error('[Webhook] ❌ Fallback insert also failed:', {
										error: fallbackError.message,
										code: fallbackError.code
									});
								} else {
									console.log('[Webhook] ✅ Fallback insert succeeded:', fallbackData);
								}
							} else {
								console.log('[Webhook] ✅ Successfully saved subscription data to stripe_customers:', {
									rowsAffected: data?.length || 0,
									data: data
								});
							}
						} else {
							console.warn('[Webhook] ⚠️ Cannot save subscription - user_id not found. Subscription will be saved when checkout.session.completed fires or user_id is available.', {
								customerId: String(customerId),
								subscriptionId: String(subscriptionId),
								note: 'This is normal if checkout.session.completed fires first with user_id'
							});
						}
					} catch (error: any) {
						console.error('[Webhook] ❌ Error processing customer.subscription.created:', {
							error: error.message,
							subscriptionId,
							customerId,
							stack: error.stack
						});
					}
					break;
				}

				case 'customer.subscription.updated': {
					// The customer might have changed the plan (higher or lower plan, cancel soon etc...)
					console.log('[Webhook] customer.subscription.updated');
					const subscription: Stripe.Subscription = event.data.object;
					const processedData = processSubscriptionWebhook(subscription);
					
					if (!processedData) {
						console.error('[Webhook] Failed to process subscription data');
						break;
					}

					const customerId = typeof subscription.customer === 'string' 
						? subscription.customer 
						: subscription.customer?.id;

					if (!customerId) {
						console.error('[Webhook] Missing customer ID in subscription.updated');
						break;
					}

					// Get price and plan details
					const priceId = subscription.items.data[0]?.price?.id;
					const amount = subscription.items.data[0]?.price?.unit_amount || 0;
					const currency = subscription.currency || 'usd';
					const interval = subscription.items.data[0]?.price?.recurring?.interval || 'month';

					// Determine plan name from price ID
					let planName = 'Unknown';
					if (priceId) {
						for (const [planType, planData] of Object.entries(config.stripe)) {
							if (planData.monthPriceId === priceId || planData.yearPriceId === priceId) {
								planName = planData.name;
								break;
							}
						}
					}

					// Prepare update data with all fields
					const updateData: any = {
						subscription_status: subscription.status || null,
						plan_active: subscription.status === 'active' || subscription.status === 'trialing',
						plan_name: planName,
						price_id: priceId || null,
						amount: amount > 0 ? amount / 100 : null,
						currency: currency || 'usd',
						interval: interval || null
					};

					if (processedData.type === 'cancellation') {
						// Safely handle current_period_end
						const currentPeriodEnd = subscription.current_period_end;
						let planExpires: number | null = null;
						
						if (currentPeriodEnd && !isNaN(currentPeriodEnd)) {
							planExpires = currentPeriodEnd * 1000;
						} else {
							planExpires = calculatePlanExpiresFromInterval(interval);
						}
						
						const expiresAtISO = planExpires ? new Date(planExpires).toISOString() : null;

						console.log('[Webhook] Subscription cancelled:', {
							subscriptionId: subscription.id,
							cancelAtPeriodEnd: subscription.cancel_at_period_end,
							currentPeriodEnd: expiresAtISO,
							currentPeriodEndRaw: currentPeriodEnd
						});

						// Update stripe_customers - set plan_active to false if cancelled immediately
						// Otherwise keep active until period end
						const planActive = subscription.cancel_at_period_end ? true : false;
						
						const { error } = await supabaseAdmin
							.from('stripe_customers')
							.update({ 
								...updateData,
								plan_active: planActive,
								plan_expires: planExpires
							})
							.eq('subscription_id', subscription.id);

						if (error) {
							console.error('[Webhook] Error updating cancelled subscription:', error);
						} else {
							console.log('[Webhook] Successfully updated cancelled subscription');
						}
					} else if (processedData.type === 'new_subscription') {
						console.log('[Webhook] New subscription:', {
							subscriptionId: subscription.id,
							planName,
							amount: amount / 100,
							currency,
							interval
						});
					} else if (processedData.type === 'renewal') {
						// Safely handle current_period_end
						const currentPeriodEnd = subscription.current_period_end;
						let planExpires: number | null = null;
						
						if (currentPeriodEnd && !isNaN(currentPeriodEnd)) {
							planExpires = currentPeriodEnd * 1000;
						} else {
							planExpires = calculatePlanExpiresFromInterval(interval);
						}
						
						const expiresAtISO = planExpires ? new Date(planExpires).toISOString() : null;

						console.log('[Webhook] Subscription renewal:', {
							subscriptionId: subscription.id,
							planName,
							amount: amount / 100,
							currency,
							interval,
							periodEnd: expiresAtISO,
							currentPeriodEndRaw: currentPeriodEnd
						});

						// Update plan_expires on renewal
						const { error } = await supabaseAdmin
							.from('stripe_customers')
							.update({ 
								...updateData,
								plan_active: true,
								plan_expires: planExpires
							})
							.eq('subscription_id', subscription.id);

						if (error) {
							console.error('[Webhook] Error updating renewal:', error);
						} else {
							console.log('[Webhook] Successfully updated subscription renewal');
						}
					} else {
						// Generic update - plan change, status change, etc.
						// Safely handle current_period_end
						const currentPeriodEnd = subscription.current_period_end;
						let planExpires: number | null = null;
						
						if (currentPeriodEnd && !isNaN(currentPeriodEnd)) {
							planExpires = currentPeriodEnd * 1000;
						} else {
							planExpires = calculatePlanExpiresFromInterval(interval);
						}

						console.log('[Webhook] Subscription updated:', {
							subscriptionId: subscription.id,
							status: subscription.status,
							planName,
							planActive: subscription.status === 'active',
							currentPeriodEndRaw: currentPeriodEnd
						});

						// Update subscription details
						const { error } = await supabaseAdmin
							.from('stripe_customers')
							.update({ 
								...updateData,
								plan_active: subscription.status === 'active' || subscription.status === 'trialing',
								plan_expires: planExpires
							})
							.eq('subscription_id', subscription.id);

						if (error) {
							console.error('[Webhook] Error updating subscription:', error);
						}
					}
					break;
				}

				case 'customer.subscription.deleted': {
					// The customer subscription stopped
					// ❌ Revoke access to the product
					const subscription = event.data.object;
					console.log('[Webhook] customer.subscription.deleted:', {
						subscriptionId: subscription.id,
						customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
					});

					const { error } = await supabaseAdmin
						.from('stripe_customers')
						.update({ 
							plan_active: false, 
							subscription_id: null,
							plan_expires: null,
							subscription_status: 'canceled',
							days_remaining: null
						})
						.eq('subscription_id', subscription.id);

					if (error) {
						console.error('[Webhook] Error updating deleted subscription:', error);
					} else {
						console.log('[Webhook] Successfully deactivated subscription');
					}
					break;
				}

				case 'invoice.payment_succeeded': {
					const invoice: Stripe.Invoice = event.data.object;
					console.log('[Webhook] invoice.payment_succeeded');

					const subscriptionId = typeof invoice.subscription === 'string' 
						? invoice.subscription 
						: invoice.subscription?.id;
					const customerId = typeof invoice.customer === 'string' 
						? invoice.customer 
						: invoice.customer?.id;
					const amountPaid = invoice.amount_paid;
					const currency = invoice.currency;
					const lineItem = invoice.lines.data[0];
					const priceId = lineItem?.price?.id;

					if (!subscriptionId) {
						console.log('[Webhook] Invoice has no subscription (one-time payment), skipping');
						break;
					}

					console.log('[Webhook] Payment succeeded details:', {
						invoiceId: invoice.id,
						subscriptionId,
						customerId,
						amountPaid: amountPaid / 100,
						currency,
						priceId,
						paidAt: new Date(invoice.status_transitions.paid_at! * 1000).toISOString()
					});

					// Update plan_expires based on subscription period
					// Get subscription to know the current period end
					try {
						const subscription = await stripe.subscriptions.retrieve(subscriptionId);
						
						// Get subscription details
						const priceId = subscription.items.data[0]?.price?.id;
						const amount = subscription.items.data[0]?.price?.unit_amount || 0;
						const currency = subscription.currency || 'usd';
						const interval = subscription.items.data[0]?.price?.recurring?.interval || 'month';
						
						// Determine plan name from price ID
						let planName = 'Unknown';
						if (priceId) {
							for (const [planType, planData] of Object.entries(config.stripe)) {
								if (planData.monthPriceId === priceId || planData.yearPriceId === priceId) {
									planName = planData.name;
									break;
								}
							}
						}
						
						// Safely handle current_period_end
						const currentPeriodEnd = subscription.current_period_end;
						let planExpires: number | null = null;
						
						if (currentPeriodEnd && !isNaN(currentPeriodEnd)) {
							planExpires = currentPeriodEnd * 1000;
						} else {
							planExpires = calculatePlanExpiresFromInterval(interval);
						}
						
						const { error } = await supabaseAdmin
							.from('stripe_customers')
							.update({ 
								subscription_status: subscription.status || null,
								plan_active: subscription.status === 'active' || subscription.status === 'trialing',
								plan_expires: planExpires,
								plan_name: planName,
								price_id: priceId || null,
								amount: amount > 0 ? amount / 100 : null,
								currency: currency || 'usd',
								interval: interval || null
							})
							.eq('subscription_id', subscriptionId);

						if (error) {
							console.error('[Webhook] Error updating plan_expires after payment:', error);
						} else {
							console.log('[Webhook] Successfully updated plan_expires after payment');
						}
					} catch (err) {
						console.error('[Webhook] Error retrieving subscription for invoice:', err);
					}
					break;
				}

				case 'invoice.payment_failed': {
					// A payment failed (for instance the customer does not have a valid payment method)
					// ⏳ Wait for the customer to pay (more friendly):
					//      - Stripe will automatically email the customer (Smart Retries)
					//      - We will receive a "customer.subscription.deleted" when all retries were made and the subscription has expired
					const invoice: Stripe.Invoice = event.data.object;
					const subscriptionId = typeof invoice.subscription === 'string' 
						? invoice.subscription 
						: invoice.subscription?.id;
					const customerId = typeof invoice.customer === 'string' 
						? invoice.customer 
						: invoice.customer?.id;
					const attemptCount = invoice.attempt_count;

					console.log('[Webhook] invoice.payment_failed:', {
						invoiceId: invoice.id,
						subscriptionId,
						customerId,
						attemptCount,
						amountDue: invoice.amount_due / 100,
						currency: invoice.currency
					});

					// Don't revoke access immediately - Stripe will retry
					// Only update if this is the final attempt (Stripe typically retries 3 times)
					// We'll handle deactivation in customer.subscription.deleted event
					break;
				}

				case 'invoice.paid': {
					// Customer just paid an invoice (for instance, a recurring payment for a subscription)
					// ✅ Grant access to the product - Payment confirmed, set subscription to active
					const invoice: Stripe.Invoice = event.data.object;
					const priceId = invoice.lines.data[0]?.price?.id;
					const customerId = typeof invoice.customer === 'string' 
						? invoice.customer 
						: invoice.customer?.id;
					const subscriptionId = typeof invoice.subscription === 'string' 
						? invoice.subscription 
						: invoice.subscription?.id;
					const amountPaid = invoice.amount_paid;
					const currency = invoice.currency;
					const invoiceStatus = invoice.status;

					console.log('[Webhook] invoice.paid:', {
						invoiceId: invoice.id,
						subscriptionId,
						customerId,
						priceId,
						amountPaid: amountPaid / 100,
						currency,
						invoiceStatus,
						paidAt: new Date(invoice.status_transitions.paid_at! * 1000).toISOString()
					});

					// Validate that invoice is actually paid
					if (invoiceStatus !== 'paid') {
						console.warn('[Webhook] invoice.paid received but invoice.status is not "paid":', {
							invoiceId: invoice.id,
							invoiceStatus,
							note: 'Skipping subscription update'
						});
						break;
					}

					// Update subscription if this is a recurring payment
					if (subscriptionId) {
						try {
							// Get current subscription status from database before update
							// Note: Using type assertion as database types may not include all new columns
							const { data: currentSubscription } = await (supabaseAdmin
								.from('stripe_customers')
								.select('subscription_status, plan_active')
								.eq('subscription_id', subscriptionId)
								.maybeSingle() as any);

							const previousStatus = (currentSubscription as any)?.subscription_status || 'unknown';
							const previousPlanActive = (currentSubscription as any)?.plan_active || false;

							const subscription = await stripe.subscriptions.retrieve(subscriptionId);
							
							// Get subscription details
							const subPriceId = subscription.items.data[0]?.price?.id;
							const amount = subscription.items.data[0]?.price?.unit_amount || 0;
							const subCurrency = subscription.currency || 'usd';
							const interval = subscription.items.data[0]?.price?.recurring?.interval || 'month';
							
							// Determine plan name from price ID
							let planName = 'Unknown';
							if (subPriceId) {
								for (const [planType, planData] of Object.entries(config.stripe)) {
									if (planData.monthPriceId === subPriceId || planData.yearPriceId === subPriceId) {
										planName = planData.name;
										break;
									}
								}
							}
							
							// Safely handle current_period_end
							const currentPeriodEnd = subscription.current_period_end;
							let planExpires: number | null = null;
							
							if (currentPeriodEnd && !isNaN(currentPeriodEnd)) {
								planExpires = currentPeriodEnd * 1000;
							} else {
								planExpires = calculatePlanExpiresFromInterval(interval);
							}
							
							// Payment confirmed via invoice.paid - explicitly set subscription to active
							// This ensures the user's payment status is properly reflected regardless of
							// previous subscription status (incomplete, past_due, etc.)
							const { error } = await supabaseAdmin
								.from('stripe_customers')
								.update({ 
									subscription_status: 'active', // Explicitly set to active when payment is confirmed
									plan_active: true, // Payment confirmed, subscription is active
									plan_expires: planExpires,
									plan_name: planName,
									price_id: subPriceId || null,
									amount: amount > 0 ? amount / 100 : null,
									currency: subCurrency || 'usd',
									interval: interval || null
								})
								.eq('subscription_id', subscriptionId);

							if (error) {
								console.error('[Webhook] Error updating subscription after invoice.paid:', {
									error: error.message,
									code: error.code,
									subscriptionId,
									invoiceId: invoice.id
								});
							} else {
								console.log('[Webhook] ✅ Payment confirmed via invoice.paid, subscription set to active:', {
									subscriptionId,
									invoiceId: invoice.id,
									amountPaid: amountPaid / 100,
									currency,
									previousStatus,
									newStatus: 'active',
									previousPlanActive,
									newPlanActive: true,
									planName,
									planExpires: planExpires ? new Date(planExpires).toISOString() : null,
									note: previousStatus !== 'active' 
										? `Subscription activated from ${previousStatus} state` 
										: 'Subscription already active, payment confirmed'
								});
							}
						} catch (err) {
							console.error('[Webhook] Error retrieving subscription for invoice.paid:', {
								error: err instanceof Error ? err.message : String(err),
								subscriptionId,
								invoiceId: invoice.id
							});
						}
					} else {
						console.log('[Webhook] invoice.paid received but no subscription_id - this is a one-time payment, not a subscription');
					}
					break;
				}

				case 'charge.refunded': {
					const charge: Stripe.Charge = event.data.object;
					console.log('[Webhook] charge.refunded:', {
						chargeId: charge.id,
						amountRefunded: charge.amount_refunded / 100,
						currency: charge.currency,
						customerId: typeof charge.customer === 'string' ? charge.customer : charge.customer?.id,
						refunded: charge.refunded
					});

					// Note: We don't update stripe_customers here as refunds don't affect subscription status
					// The subscription status is managed by subscription events
					break;
				}
			}
		} catch (error: any) {
			console.error('[Webhook] ❌ Error processing webhook event:', {
				eventType: eventType,
				error: error.message,
				stack: error.stack
			});
			// Return 200 to Stripe even on error to prevent retries
			// Log the error for debugging
			return NextResponse.json({ statusCode: 200, message: 'Event processed with errors', error: error.message });
		}

		console.log('[Webhook] ✅ Successfully processed event:', eventType);
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

// Export runtime config for webhook endpoint
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';