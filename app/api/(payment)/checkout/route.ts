import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { getSupabaseClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';
export async function POST(request: Request) {
	try {
		const userSession = await auth()
		const userId = userSession?.user?.id
		// 检查 userId 是否存在
		if (!userId) {
			return new Response('User ID is required', { status: 400 });
		}
		const { priceId, email } = await request.json();
		
		// Validate priceId is provided
		if (!priceId || priceId.trim() === '') {
			return NextResponse.json({ message: 'Price ID is required' }, { status: 400 });
		}
		
		// Check if priceId is a placeholder or too short
		if (priceId.includes('YOUR_') || priceId.includes('_PRICE_ID') || priceId.length < 20) {
			return NextResponse.json({ 
				message: 'Price ID not configured in config.ts. Get Price IDs from: Stripe Dashboard → Products → Click product → Click "..." on price → Copy Price ID',
				error: 'price_not_configured',
				priceId,
				help: 'Update config.ts with actual Stripe price IDs from https://dashboard.stripe.com/test/products'
			}, { status: 400 });
		}
		
		// Verify the price exists in Stripe
		try {
			await stripe.prices.retrieve(priceId);
		} catch (priceError: any) {
			console.error('Stripe price error:', priceError);
			if (priceError.code === 'resource_missing' || priceError.statusCode === 404) {
				return NextResponse.json({ 
					message: `Price ID "${priceId}" does not exist in your Stripe account. Please update config.ts with a valid price ID from https://dashboard.stripe.com/test/products`,
					error: 'invalid_price_id',
					priceId,
					help: 'The price ID in config.ts does not match any price in your Stripe account. Get the correct Price ID from your Stripe Dashboard.'
				}, { status: 400 });
			}
			throw priceError;
		}
		
		// Get authenticated Supabase client (throws error if not authenticated)
		let supabase;
		try {
			supabase = await getSupabaseClient({ throwOnUnauthenticated: true });
		} catch (error: any) {
			if (error.message === 'User not authenticated') {
				return NextResponse.json({ message: 'User not authenticated' }, { status: 401 });
			}
			throw error;
		}

		// Check if user has an active subscription
		// If they do, we'll handle plan change through subscription update instead
		const { data: subscriptionData } = await supabase
			.from('stripe_customers')
			.select('*')
			.eq('user_id', userId)
			.eq('plan_active', true)
			.limit(1);

		if (subscriptionData && subscriptionData.length > 0) {
			// User already has subscription - redirect to use subscription update API instead
			return NextResponse.json({ 
				message: 'User already subscribed. Please use the subscription update endpoint to change plans.',
				error: 'already_subscribed',
				hasSubscription: true
			}, { status: 400 });
		}

		// Get origin from request header, or use environment variable for ngrok, or fallback to localhost
		const origin = request.headers.get('origin') 
			|| process.env.NEXT_PUBLIC_APP_URL 
			|| process.env.NGROK_URL 
			|| 'http://localhost:3000';
		
		const session = await stripe.checkout.sessions.create({
			metadata: {
				user_id: userId,
			},
			customer_email: email,
			// Pass metadata to subscription and customer when they are created
			subscription_data: {
				metadata: {
					user_id: userId,
				},
			},
			payment_method_types: ['card'],
			line_items: [
				{
					quantity: 1,
					price: priceId,
				}
			],
			mode: 'subscription',
			success_url: `${origin}/app`,
			cancel_url: `${origin}/cancel`,
		});


		return NextResponse.json({ id: session.id, client_secret: session.client_secret });
	} catch (error: any) {
		console.error(error);
		return NextResponse.json({ message: error.message }, { status: 500 });
	}
}