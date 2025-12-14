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

	const handlePlanChange = async (newPriceId: string) => {
		setIsLoading(true);
		try {
			// First, preview the change
			const previewResponse = await fetch(`/api/subscription/update?priceId=${encodeURIComponent(newPriceId)}`);
			const previewData = await previewResponse.json();

			if (!previewResponse.ok) {
				throw new Error(previewData.error || 'Failed to preview plan change');
			}

			// Confirm with user via toast
			const confirmed = await new Promise<boolean>((resolve) => {
				toast.custom(
					(t) => (
						<div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg shadow-lg max-w-md">
							<div className="flex items-start">
								<div className="flex-1">
									<h3 className="text-sm font-semibold text-blue-900 mb-1">
										Change Your Plan?
									</h3>
									<p className="text-sm text-blue-800 mb-2">
										{previewData.changeType === 'upgrade' ? 'Upgrading' : 'Downgrading'} your subscription
										{previewData.prorationAmount !== 0 && (
											<span className="block mt-1 font-medium">
												Proration: {previewData.prorationAmount > 0 ? '+' : ''}
												${(previewData.prorationAmount / 100).toFixed(2)}
											</span>
										)}
									</p>
									<div className="mt-3 flex gap-2">
										<button
											onClick={() => {
												toast.dismiss(t.id);
												resolve(true);
											}}
											className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md"
										>
											Confirm Change
										</button>
										<button
											onClick={() => {
												toast.dismiss(t.id);
												resolve(false);
											}}
											className="px-3 py-1.5 text-xs font-medium text-blue-700 hover:text-blue-900"
										>
											Cancel
										</button>
									</div>
								</div>
							</div>
						</div>
					),
					{ duration: 10000, position: 'top-center' }
				);
			});

			if (!confirmed) {
				setIsLoading(false);
				return;
			}

			// Execute the plan change
			const updateResponse = await fetch('/api/subscription/update', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					priceId: newPriceId,
					prorationBehavior: 'create_prorations',
				}),
			});

			const updateData = await updateResponse.json();

			if (updateResponse.ok) {
				toast.success(
					`✓ Plan ${previewData.changeType === 'upgrade' ? 'upgraded' : 'downgraded'} successfully! Your subscription will continue to renew automatically with the new plan.`,
					{ duration: 6000 }
				);
				// Refresh page after short delay
				setTimeout(() => {
					window.location.href = '/app/billing';
				}, 1500);
			} else {
				throw new Error(updateData.error || 'Failed to update plan');
			}
		} catch (error: any) {
			console.error('[CheckoutButton] Error changing plan:', error);
			toast.error(error.message || 'Failed to change plan');
			setIsLoading(false);
		}
	};

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
			} else if (data.error === 'already_subscribed' || data.message?.includes('already subscribed')) {
				// User has subscription - offer to change plan directly
				toast.custom(
					(t) => (
						<div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg shadow-lg max-w-md w-full">
							<div className="flex items-start">
								<div className="flex-shrink-0">
									<svg className="h-5 w-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
										<path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
									</svg>
								</div>
								<div className="ml-3 flex-1">
									<h3 className="text-sm font-semibold text-blue-900 mb-1">
										Upgrade or Downgrade Your Plan
									</h3>
									<p className="text-sm text-blue-800 mb-3 leading-relaxed">
										You already have an active subscription. Click below to securely change your plan. 
										The change will take effect immediately with proration. Your current plan remains 
										active until the end of your billing period.
									</p>
									<div className="mt-3 flex items-center gap-3">
										<button
											onClick={async () => {
												toast.dismiss(t.id);
												await handlePlanChange(priceId);
											}}
											className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
										>
											Change Plan Now
											<svg className="ml-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
											</svg>
										</button>
										<button
											onClick={() => {
												toast.dismiss(t.id);
												window.location.href = '/app/billing';
											}}
											className="text-xs text-blue-600 hover:text-blue-800 font-medium"
										>
											View Billing
										</button>
									</div>
								</div>
								<button
									onClick={() => toast.dismiss(t.id)}
									className="ml-2 flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
									aria-label="Close"
								>
									<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
										<path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
									</svg>
								</button>
							</div>
						</div>
					),
					{
						duration: 10000, // Show for 10 seconds
						position: 'top-center',
					}
				);
				setIsLoading(false);
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
					? 'Traitement...' 
					: !priceId 
						? 'Commencer' 
						: 'Acheter Maintenant'}
			</button>
			{showWarning && (
				<p className="text-xs text-amber-600 mt-1 text-center font-medium">
					⚠ Update config.ts with Stripe price IDs
				</p>
			)}
		</div>
	);
}