import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { refundByUserId, refundSubscriptionPayment } from '@/lib/stripe/services/payment.service';

/**
 * Refund API Route
 * Uses Stripe SDK directly - no database queries
 */
export async function POST(request: Request) {
	try {
		console.log('[Refund API] Processing refund request');

		const userSession = await auth();
		const userId = userSession?.user?.id;

		if (!userId) {
			console.error('[Refund API] User ID is required');
			return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
		}

		const { subscriptionId, amount } = await request.json();

		// If subscriptionId is provided, refund that specific subscription
		// Otherwise, refund the user's active subscription
		let refund;

		if (subscriptionId) {
			console.log('[Refund API] Refunding subscription:', subscriptionId);
			refund = await refundSubscriptionPayment(
				subscriptionId,
				amount ? amount * 100 : undefined // Convert to cents if provided
			);
		} else {
			console.log('[Refund API] Refunding user subscription:', userId);
			refund = await refundByUserId(userId, amount ? amount * 100 : undefined);
		}

		console.log('[Refund API] Refund successful:', refund.id);
		return NextResponse.json({ refund, success: true }, { status: 200 });
	} catch (error: any) {
		console.error('[Refund API] Error processing refund:', error);
		return NextResponse.json(
			{ message: error.message || 'Failed to process refund', success: false },
			{ status: 500 }
		);
	}
}