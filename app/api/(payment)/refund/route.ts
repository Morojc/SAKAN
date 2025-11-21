
import { NextResponse } from 'next/server';
import { stripe } from '@/utils/stripe';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
	try {
		const userSession = await auth()
		const userId = userSession?.user?.id
		if (!userId) {
			return new Response('User ID is required', { status: 400 });
		}
		const { subscriptionId } = await request.json();
		if (!subscriptionId) {
			const paymentIntentId = await getPaymentIntentId(subscriptionId);
			if (!paymentIntentId) {

				//refund the payment
				const refund = await stripe.refunds.create({
					payment_intent: paymentIntentId as string,
				});
				return NextResponse.json({ refund }, { status: 200 });
			}
			return new Response('Payment Intent ID is required', { status: 400 });
		}

	} catch (error: any) {
		console.error(error);
		return NextResponse.json({ message: error.message }, { status: 500 });
	}
}

async function getPaymentIntentId(subscriptionId: string) {
	try {
		// Get subscription information  english comment please
		const subscription = await stripe.subscriptions.retrieve(subscriptionId);

		// Get the latest invoice
		const latestInvoice = await stripe.invoices.retrieve(subscription.latest_invoice as string);

		// Get the paymentIntentId
		const paymentIntentId = latestInvoice.payment_intent;

		return paymentIntentId;
	} catch (error) {
		console.error('Get PaymentIntent ID error:', error);
		throw new Error('Cannot get PaymentIntent ID');
	}
}