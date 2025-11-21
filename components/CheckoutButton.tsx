'use client';

import { loadStripe } from '@stripe/stripe-js';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useState } from 'react';

interface CheckoutButtonProps {
	priceId: string;
	productId: string;
	className?: string;
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function CheckoutButton({ priceId, productId, className }: CheckoutButtonProps) {
	const { data: session } = useSession();
	const user = session?.user;
	const email = user?.email;
	const [isLoading, setIsLoading] = useState(false);
	
	// Check if priceId is a placeholder or invalid
	const isPriceConfigured = priceId && 
		priceId.trim() !== '' &&
		!priceId.includes('YOUR_') && 
		!priceId.includes('_PRICE_ID') && 
		priceId.startsWith('price_') &&
		priceId.length > 20; // Valid Stripe price IDs are typically 28+ characters

	const handleCheckout = async () => {
		if (!user) {
			toast.error("Please log in first");
			redirect('/api/auth/signin?callbackUrl=/');
			return;
		}

		// If it's a free plan (empty priceId), redirect to app
		if (!priceId || priceId.trim() === '') {
			redirect('/app/notes');
			return;
		}

		// Check if priceId is a placeholder
		if (priceId.includes('YOUR_') || priceId.includes('_PRICE_ID') || priceId.length < 20) {
			toast.error("Price ID not configured. Get your Price IDs from Stripe Dashboard → Products → Click '...' on each price → Copy Price ID. Then update config.ts", {
				duration: 6000,
			});
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		console.log('Loading started:', isLoading);

		const stripe = await stripePromise;
		const response = await fetch('/api/checkout', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				priceId: priceId,
				productId: productId,
				userId: user?.id,
				email: email,
			}),
		});
		
		const data = await response.json();

		if (response.ok) {
			await stripe?.redirectToCheckout({ sessionId: data.id });
		} else if (response.status === 400) {
			if (data.error === 'price_not_configured' || data.error === 'invalid_price_id') {
				toast.error(data.message || 'Price ID is not configured correctly. Please update config.ts with your Stripe price IDs.');
			} else if (data.message === 'User already subscribed' || data.message?.includes('already subscribed')) {
				toast.success('You are already subscribed');
				redirect('/app/profile');
			} else {
				toast.error(data.message || 'Something went wrong');
			}
		} else {
			toast.error(data.message || 'Something went wrong');
		}

		setIsLoading(false);
	}

	const isDisabled = isLoading;
	const showWarning = !isPriceConfigured && priceId && priceId.trim() !== '';
	
	return (
		<div>
			<button
				className={className || `w-full rounded-lg py-2 transition-colors ${isDisabled
					? 'bg-gray-400 cursor-not-allowed'
					: 'bg-[#5059FE] hover:bg-[#4048ed]'
					} text-white`}
				onClick={handleCheckout}
				disabled={isDisabled}
				title={showWarning ? 'Click to see error - Price ID needs to be updated in config.ts' : undefined}
			>
				{isLoading 
					? 'Processing...' 
					: !priceId 
						? 'Get Started' 
						: 'Buy Now'}
			</button>
			{showWarning && (
				<p className="text-xs text-amber-600 mt-1 text-center font-medium">
					⚠ Update config.ts with Stripe price IDs
				</p>
			)}
		</div>
	);
}