import { createSupabaseAdminClient, getSupabaseClient } from '@/lib/supabase/server';
import { auth } from "@/lib/auth"
import PortalButton from '@/components/stripe/PortalButton';
import { stripe } from '@/lib/stripe/client';
import config from '@/config';
import RefundButton from '@/components/stripe/RefundButton';
import { getSubscriptionDetails } from '@/lib/stripe/services/subscription.service';
import { CanceledSubscriptionAlert } from '@/components/stripe/CanceledSubscriptionAlert';

// Helper function to get plan name from price ID
function getPlanNameFromPriceId(priceId: string): { name: string; interval: string } {
	for (const [planType, planData] of Object.entries(config.stripe)) {
		if (planData.monthPriceId === priceId) {
			return { name: planData.name, interval: 'month' };
		}
		if (planData.yearPriceId === priceId) {
			return { name: planData.name, interval: 'year' };
		}
	}
	return { name: 'Unknown Plan', interval: 'month' };
}

// Helper function to get plan badge style
function getPlanBadgeStyle(planName: string): { bgColor: string; textColor: string; borderColor: string } {
	switch (planName.toLowerCase()) {
		case 'free':
			return {
				bgColor: 'bg-gray-100',
				textColor: 'text-gray-700',
				borderColor: 'border-gray-200'
			};
		case 'basic':
			return {
				bgColor: 'bg-blue-100',
				textColor: 'text-blue-700',
				borderColor: 'border-blue-200'
			};
		case 'pro':
			return {
				bgColor: 'bg-purple-100',
				textColor: 'text-purple-700',
				borderColor: 'border-purple-200'
			};
		default:
			return {
				bgColor: 'bg-gray-100',
				textColor: 'text-gray-700',
				borderColor: 'border-gray-200'
			};
	}
}

// Helper function to get interval badge style
function getIntervalBadgeStyle(planName: string): { bgColor: string; textColor: string; borderColor: string } {
	switch (planName.toLowerCase()) {
		case 'free':
			return {
				bgColor: 'bg-gray-50',
				textColor: 'text-gray-600',
				borderColor: 'border-gray-200'
			};
		case 'basic':
			return {
				bgColor: 'bg-blue-50',
				textColor: 'text-blue-600',
				borderColor: 'border-blue-100'
			};
		case 'pro':
			return {
				bgColor: 'bg-purple-50',
				textColor: 'text-purple-600',
				borderColor: 'border-purple-100'
			};
		default:
			return {
				bgColor: 'bg-gray-50',
				textColor: 'text-gray-600',
				borderColor: 'border-gray-200'
			};
	}
}

export async function BillingInfo() {
	console.log('[BillingInfo] Rendering billing info component');

	const session = await auth();
	const userId = session?.user?.id;

	if (!userId) {
		console.error('[BillingInfo] User not found');
		return <div>User not found</div>;
	}

	// Get user data from database
	const supabase = createSupabaseAdminClient();
	const { data: userData, error: userError } = await supabase
		.from('users')
		.select('*')
		.eq('id', userId)
		.single();

	if (userError) {
		console.error('[BillingInfo] Error fetching user data:', userError);
		return <div>Error fetching user data</div>;
	}

	if (!userData) {
		console.error('[BillingInfo] User data not found');
		return <div>User data not found</div>;
	}

	// Get subscription data using Stripe SDK directly
	console.log('[BillingInfo] Getting subscription details from Stripe SDK');
	const subscriptionDetails = await getSubscriptionDetails(userId);

	const planName = subscriptionDetails.planName;
	const planInterval = subscriptionDetails.planInterval;

	// Format subscription data for display
	const subscriptionData = subscriptionDetails.customerId
		? {
				subscription_id: subscriptionDetails.subscriptionId || null,
				stripe_customer_id: subscriptionDetails.customerId,
				plan_active: subscriptionDetails.status === 'active',
				plan_expires: subscriptionDetails.currentPeriodEnd
					? subscriptionDetails.currentPeriodEnd.getTime()
					: null,
				cancel_at: subscriptionDetails.cancelAt,
				cancel_at_period_end: subscriptionDetails.cancelAtPeriodEnd,
				canceled_at: subscriptionDetails.canceledAt,
				days_remaining: subscriptionDetails.daysRemaining,
			}
		: null;

	console.log('[BillingInfo] Subscription details loaded:', {
		planName,
		planInterval,
		hasActiveSubscription: !!subscriptionData,
		cancelAtPeriodEnd: subscriptionDetails.cancelAtPeriodEnd,
		daysRemaining: subscriptionDetails.daysRemaining,
	});

	return (
		<div className="bg-[var(--background)] shadow rounded-lg p-6 space-y-8">
			{/* Canceled Subscription Alert */}
			{subscriptionData?.cancel_at_period_end && subscriptionData.days_remaining !== null && subscriptionData.plan_expires && (
				<CanceledSubscriptionAlert
					planName={planName}
					planInterval={planInterval}
					daysRemaining={subscriptionData.days_remaining}
					accessUntil={new Date(subscriptionData.plan_expires)}
					canceledAt={subscriptionData.canceled_at || null}
				/>
			)}

			{/* Subscription Information */}
			<div>
				<h2 className="text-xl font-semibold mb-4">Subscription Status</h2>
				<div className="bg-[var(--background)] p-4 rounded-lg">
					<div className="space-y-3">
						<div>
							<label className="text-sm text-gray-600">Current Plan</label>
							{(() => {
								const style = getPlanBadgeStyle(planName);
								const intervalStyle = getIntervalBadgeStyle(planName);
								return (
									<div className="flex items-center gap-3 mt-1 flex-wrap">
										<span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold border ${style.bgColor} ${style.textColor} ${style.borderColor}`}>
											{planName}
											{planName.toLowerCase() === 'pro' && (
												<svg className="w-4 h-4 ml-1" viewBox="0 0 24 24" fill="currentColor">
													<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
												</svg>
											)}
										</span>
										<span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${intervalStyle.bgColor} ${intervalStyle.textColor} ${intervalStyle.borderColor}`}>
											{planInterval === 'year' ? 'Yearly' : 'Monthly'} Plan
										</span>
										{subscriptionData?.cancel_at_period_end && (
											<span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border bg-amber-100 text-amber-800 border-amber-200">
												<svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
												</svg>
												Ending Soon
											</span>
										)}
									</div>
								);
							})()}
						</div>
						{subscriptionData ? (
							<>
								<div>
									<label className="text-sm text-gray-600">Subscription Status</label>
									<div className="mt-1">
										{subscriptionData.plan_active ? (
											<div className="flex items-center gap-2">
												{subscriptionData.cancel_at_period_end ? (
													<>
														<div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
														<span className="font-medium text-amber-700 flex items-center gap-1.5">
															<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
															</svg>
															Active (Scheduled for Cancellation)
														</span>
													</>
												) : (
													<>
														<div className="w-2 h-2 rounded-full bg-green-500"></div>
														<span className="font-medium text-green-700">Active</span>
													</>
												)}
											</div>
										) : (
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 rounded-full bg-red-500"></div>
												<span className="font-medium text-red-700">Inactive</span>
											</div>
										)}
									</div>
								</div>
								{subscriptionData.plan_expires && (
									<div>
										<label className="text-sm text-gray-600">
											{subscriptionData.cancel_at_period_end ? 'Access Until' : 'Next Billing Date'}
										</label>
										<div className="mt-1 flex flex-col gap-1">
											<div className="flex items-center gap-2">
												<svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
												</svg>
												<time dateTime={new Date(subscriptionData.plan_expires).toISOString()} className="font-medium text-gray-900">
													{new Date(subscriptionData.plan_expires).toLocaleDateString('en-US', {
														year: 'numeric',
														month: 'long',
														day: 'numeric',
													})} at {new Date(subscriptionData.plan_expires).toLocaleTimeString('en-US', {
														hour: '2-digit',
														minute: '2-digit',
														hour12: true,
														hourCycle: 'h12'
													}).replace(/^(\d):/, '0$1:')}
												</time>
											</div>
											{subscriptionData.days_remaining !== null && !subscriptionData.cancel_at_period_end && (
												<p className="text-xs text-gray-500 ml-6">
													{subscriptionData.days_remaining} {subscriptionData.days_remaining === 1 ? 'day' : 'days'} remaining
												</p>
											)}
										</div>
									</div>
								)}
								<div className="mt-3 flex flex-col gap-3">
									<PortalButton />
									{subscriptionData.subscription_id && (
										<RefundButton subscriptionId={subscriptionData.subscription_id} />
									)}
								</div>
							</>
						) : (
							<div>
								<label className="text-sm text-gray-600">Subscription Status</label>
								<p className="font-medium">
									<span className="text-gray-600">Free Plan</span>
								</p>
							</div>
						)}
					</div>
				</div>
			</div>

			{userData.image && (
				<div>
					<h2 className="text-xl font-semibold mb-4">Profile Image</h2>
					{userData.image ? (
						<img
							src={userData.image}
							alt="User avatar"
							className="w-20 h-20 rounded-full"
						/>
					) : (
						<p className="text-gray-600">No avatar set</p>
					)}
				</div>
			)}
		</div>
	);
}