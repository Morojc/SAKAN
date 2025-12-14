import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateSubscriptionPlan, getPlanChangeType, getProrationAmount } from '@/lib/stripe/services/subscription-update.service';
import { getActiveSubscriptionByUserId } from '@/lib/stripe/services/subscription.service';

/**
 * API Route for updating subscription plans
 * Handles upgrades, downgrades, and plan changes
 */
export async function POST(request: Request) {
	try {
		console.log('[Subscription Update API] Received subscription update request');

		const userSession = await auth();
		const userId = userSession?.user?.id;

		if (!userId) {
			return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
		}

		const { priceId, prorationBehavior } = await request.json();

		// Validate priceId is provided
		if (!priceId || priceId.trim() === '') {
			return NextResponse.json({ error: 'Price ID is required' }, { status: 400 });
		}

		// Validate priceId format
		if (!priceId.startsWith('price_') || priceId.length < 20) {
			return NextResponse.json({ error: 'Invalid price ID format' }, { status: 400 });
		}

		// Check if user has an active subscription
		const subscriptionResult = await getActiveSubscriptionByUserId(userId);
		
		if (!subscriptionResult?.subscription) {
			return NextResponse.json({ 
				error: 'No active subscription found',
				message: 'You need an active subscription to change plans. Please subscribe first.'
			}, { status: 400 });
		}

		const currentPriceId = subscriptionResult.subscription.items.data[0]?.price?.id;

		// Check if trying to switch to the same plan
		if (currentPriceId === priceId) {
			return NextResponse.json({ 
				error: 'Same plan',
				message: 'You are already subscribed to this plan.'
			}, { status: 400 });
		}

		// Determine if this is an upgrade or downgrade
		const changeType = await getPlanChangeType(currentPriceId || '', priceId);
		
		// Get proration amount for preview
		const prorationAmount = await getProrationAmount(userId, priceId);

		// Update the subscription
		const updatedSubscription = await updateSubscriptionPlan(
			userId,
			priceId,
			prorationBehavior || 'create_prorations'
		);

		console.log('[Subscription Update API] Subscription updated successfully:', updatedSubscription.id);

		return NextResponse.json({
			success: true,
			subscriptionId: updatedSubscription.id,
			changeType,
			prorationAmount,
			message: changeType === 'upgrade' 
				? 'Subscription upgraded successfully!' 
				: 'Subscription downgraded successfully!',
		});

	} catch (error: any) {
		console.error('[Subscription Update API] Error updating subscription:', error);
		return NextResponse.json({ 
			error: error.message || 'Failed to update subscription',
			details: error.message
		}, { status: 500 });
	}
}

/**
 * GET endpoint to preview plan change (proration amount, etc.)
 */
export async function GET(request: Request) {
	try {
		const userSession = await auth();
		const userId = userSession?.user?.id;

		if (!userId) {
			return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const newPriceId = searchParams.get('priceId');

		if (!newPriceId) {
			return NextResponse.json({ error: 'Price ID is required' }, { status: 400 });
		}

		// Get current subscription
		const subscriptionResult = await getActiveSubscriptionByUserId(userId);
		
		if (!subscriptionResult?.subscription) {
			return NextResponse.json({ 
				error: 'No active subscription found'
			}, { status: 400 });
		}

		const currentPriceId = subscriptionResult.subscription.items.data[0]?.price?.id;

		if (!currentPriceId) {
			return NextResponse.json({ 
				error: 'Current subscription price not found'
			}, { status: 400 });
		}

		// Get plan change type and proration
		const changeType = await getPlanChangeType(currentPriceId, newPriceId);
		const prorationAmount = await getProrationAmount(userId, newPriceId);

		return NextResponse.json({
			changeType,
			prorationAmount,
			currentPriceId,
			newPriceId,
		});

	} catch (error: any) {
		console.error('[Subscription Update API] Error previewing subscription change:', error);
		return NextResponse.json({ 
			error: error.message || 'Failed to preview subscription change'
		}, { status: 500 });
	}
}

