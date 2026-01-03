'use client';

import { useState, useEffect } from 'react';
import PortalButton from '@/components/stripe/PortalButton';
import CheckoutButton from "@/components/CheckoutButton";
import { PlanChangeButton } from '@/components/stripe/PlanChangeButton';
import DeleteAccountButton from '@/components/app/profile/DeleteAccountButton';
import { motion } from 'framer-motion';
import { CanceledSubscriptionAlert } from '@/components/stripe/CanceledSubscriptionAlert';
import { RefreshCw } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';

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

// Animation variants
const fadeIn = {
	hidden: { opacity: 0, y: 20 },
	visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const staggerContainer = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.1
		}
	}
};

export default function ProfileAndBillingContent() {
	const { t } = useI18n();
	const [isYearly, setIsYearly] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [profileData, setProfileData] = useState<any>(null);

	useEffect(() => {
		async function fetchProfileData() {
			try {
				const response = await fetch('/api/profile');
				
				// Handle 401 (unauthorized) - user is not authenticated
				if (response.status === 401) {
					// User is not authenticated, redirect to sign in silently
					setLoading(false);
					window.location.href = '/api/auth/signin';
					return;
				}
				
				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}));
					throw new Error(errorData.error || t('profile.failedToFetchData'));
				}
				
				const data = await response.json();
				setProfileData(data);
			} catch (err) {
				// Don't show error for network issues during redirect
				if (err instanceof Error && err.message !== 'Failed to fetch') {
					console.error('Error fetching profile data:', err);
					setError(t('profile.failedToLoadData'));
				}
			} finally {
				setLoading(false);
			}
		}

		fetchProfileData();
	}, []);

	// Extract data safely - handle undefined/null cases
	const userData = profileData?.userData || null;
    const userRole = profileData?.userRole || 'resident';
	const subscriptionData = profileData?.subscriptionData || null;
	const planName = profileData?.planName || 'Free';
	const planInterval = profileData?.planInterval || 'month';
	const priceData = profileData?.priceData;
	
	// Ensure priceData is always an array
	const safePriceData = Array.isArray(priceData) ? priceData : [];

	// Debug logging
	console.log('[ProfileAndBillingContent] Subscription data:', subscriptionData);
	console.log('[ProfileAndBillingContent] Price data:', {
		hasPriceData: !!priceData,
		priceDataLength: safePriceData.length,
		priceDataTypes: safePriceData.map((p: any) => p.type),
	});

	// Check if alert should show
	const shouldShowAlert = subscriptionData?.cancel_at_period_end && 
		subscriptionData?.plan_expires && 
		(subscriptionData?.days_remaining !== null && subscriptionData?.days_remaining !== undefined);

	console.log('[ProfileAndBillingContent] State:', {
		loading,
		hasError: !!error,
		hasProfileData: !!profileData,
		safePriceDataLength: safePriceData.length,
		shouldShowAlert,
	});

	// Always render the full structure - "Choose Your Plan" section is always visible
	return (
		<motion.div 
			className="space-y-10 pb-16 max-w-7xl mx-auto px-4 sm:px-6"
			initial="hidden"
			animate="visible"
			variants={staggerContainer}
		>
			{/* Error Message - Show if there's an error */}
			{error && (
				<motion.div 
					variants={fadeIn}
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					className="bg-red-50 border-l-4 border-red-500 p-5 rounded-lg shadow-md"
					role="alert"
				>
					<div className="flex items-center">
						<svg className="h-6 w-6 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<p className="font-medium text-red-800">{t('common.error')}</p>
					</div>
					<p className="mt-2 text-red-700">{error}</p>
				</motion.div>
			)}

			{/* Canceled Subscription Alert - Only show when data is available */}
			{shouldShowAlert && subscriptionData && (
				<motion.div 
					variants={fadeIn}
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					style={{ display: 'block', visibility: 'visible' }}
				>
					<CanceledSubscriptionAlert
						planName={planName}
						planInterval={planInterval}
						daysRemaining={subscriptionData.days_remaining ?? 0}
						accessUntil={new Date(subscriptionData.plan_expires)}
						canceledAt={subscriptionData.canceled_at ? new Date(subscriptionData.canceled_at) : null}
					/>
				</motion.div>
			)}

			{/* User Information - Always show, with loading state */}
			<motion.div 
				className="bg-white shadow-lg rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-shadow duration-300"
				variants={fadeIn}
			>
				<div className="flex items-center mb-6">
					<div className="bg-gradient-to-r from-gray-900 to-gray-800 p-2.5 rounded-xl mr-4 shadow-lg">
						<svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
						</svg>
					</div>
					<h2 className="text-2xl font-bold text-gray-900">{t('profile.userInformation')}</h2>
				</div>
				
				{loading ? (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div className="bg-gray-50 p-4 rounded-xl animate-pulse">
							<div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
							<div className="h-6 bg-gray-200 rounded w-3/4"></div>
						</div>
						<div className="bg-gray-50 p-4 rounded-xl animate-pulse">
							<div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
							<div className="h-6 bg-gray-200 rounded w-3/4"></div>
						</div>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
							<label className="text-sm font-medium text-gray-500 mb-2 block">{t('profile.name')}</label>
							<p className="font-semibold text-lg text-gray-900">{userData?.name || t('profile.notSet')}</p>
						</div>

						<div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
							<label className="text-sm font-medium text-gray-500 mb-2 block">{t('profile.email')}</label>
							<p className="font-semibold text-lg text-gray-900 break-all">{userData?.email || t('profile.notSet')}</p>
						</div>

						{userData?.image && (
							<div className="col-span-1 md:col-span-2 flex items-center gap-4 bg-gray-50 p-5 rounded-xl border border-gray-100">
								<div>
									<img
										src={userData.image}
										alt={t('profile.userAvatar')}
										className="w-20 h-20 rounded-full border-4 border-gray-200 shadow-md"
									/>
								</div>
								<div>
									<label className="text-sm font-medium text-gray-500 block mb-1">{t('profile.profileImage')}</label>
									<p className="text-sm text-gray-600">{t('profile.profileImageDesc')}</p>
								</div>
							</div>
						)}
					</div>
				)}
			</motion.div>

			{/* Subscription Information - Always show, with loading state */}
			<motion.div 
				className="bg-white shadow-lg rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-shadow duration-300"
				variants={fadeIn}
			>
				<div className="flex items-center mb-6">
					<div className="bg-gradient-to-r from-gray-900 to-gray-800 p-2.5 rounded-xl mr-4 shadow-lg">
						<svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
						</svg>
					</div>
					<h2 className="text-2xl font-bold text-gray-900">{t('profile.subscriptionStatus')}</h2>
				</div>
				
				{loading ? (
					<div className="bg-gray-50 p-6 rounded-xl border border-gray-100 animate-pulse">
						<div className="space-y-4">
							<div className="h-4 bg-gray-200 rounded w-32 mb-4"></div>
							<div className="h-10 bg-gray-200 rounded w-48"></div>
							<div className="h-4 bg-gray-200 rounded w-40"></div>
						</div>
					</div>
				) : (
				
				<div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
					<div className="space-y-5">
						<div>
							<label className="text-sm font-medium text-gray-500 mb-2 block">{t('profile.currentPlan')}</label>
							{(() => {
								const style = getPlanBadgeStyle(planName);
								const intervalStyle = getIntervalBadgeStyle(planName);
								return (
									<div className="flex items-center gap-3 mt-2 flex-wrap">
										<span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold border-2 ${style.bgColor} ${style.textColor} ${style.borderColor}`}>
											{planName}
											{planName.toLowerCase() === 'pro' && (
												<svg className="w-5 h-5 ml-1" viewBox="0 0 24 24" fill="currentColor">
													<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
												</svg>
											)}
										</span>
										<span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold border ${intervalStyle.bgColor} ${intervalStyle.textColor} ${intervalStyle.borderColor}`}>
											{planInterval === 'year' ? t('profile.yearly') : t('profile.monthly')} {t('profile.plan')}
										</span>
										{subscriptionData?.cancel_at_period_end && (
											<span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border bg-amber-100 text-amber-800 border-amber-200">
												<svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
												</svg>
												{t('profile.endingSoon')}
											</span>
										)}
									</div>
								);
							})()}
						</div>
						{subscriptionData ? (
							<>
								<div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
									<label className="text-sm font-medium text-gray-500 mb-2 block">{t('profile.subscriptionStatus')}</label>
									<div className="mt-2">
										{subscriptionData.plan_active ? (
											<div className="flex items-center gap-2">
												{subscriptionData.cancel_at_period_end ? (
													<>
														<span className="relative flex h-3 w-3">
															<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
															<span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
														</span>
														<span className="font-medium text-amber-700 flex items-center gap-1.5">
															<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
															</svg>
															{t('profile.activeScheduledCancellation')}
														</span>
													</>
												) : (
													<>
														<span className="relative flex h-3 w-3">
															<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
															<span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
														</span>
														<span className="font-medium text-green-700">{t('profile.active')}</span>
													</>
												)}
											</div>
										) : (
											<div className="flex items-center gap-2">
												<span className="relative flex h-3 w-3">
													<span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
												</span>
												<span className="font-medium text-red-700">{t('profile.inactive')}</span>
											</div>
										)}
									</div>
								</div>
								{subscriptionData.plan_expires && (
									<div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
										<label className="text-sm font-medium text-gray-500 mb-2 block">
											{subscriptionData.cancel_at_period_end ? t('profile.accessUntil') : t('profile.nextBillingDate')}
										</label>
										<div className="mt-2">
											<div className="flex items-center gap-2">
												<svg className="w-5 h-5 text-[#5059FE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
												</svg>
												<time dateTime={new Date(subscriptionData.plan_expires).toISOString()} className="font-medium">
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
											{subscriptionData.days_remaining !== null && subscriptionData.days_remaining !== undefined && !subscriptionData.cancel_at_period_end && (
												<p className="text-xs text-gray-500 mt-1 ml-7">
													{subscriptionData.days_remaining} {subscriptionData.days_remaining === 1 ? t('profile.dayRemaining') : t('profile.daysRemaining')}
												</p>
											)}
										</div>
									</div>
								)}
								<div className="mt-6">
									<PortalButton />
								</div>
							</>
						) : (
							<div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
								<label className="text-sm font-medium text-gray-500 mb-2 block">{t('profile.subscriptionStatus')}</label>
								<p className="font-medium text-gray-600">{t('profile.freePlanNoSubscription')}</p>
							</div>
						)}
					</div>
				</div>
				)}
			</motion.div>
		

			{/* Pricing Section - Always Visible - Shows even during loading/error states */}
			<motion.div 
				className="bg-[var(--background)] shadow-lg rounded-xl p-8 border border-[var(--border)] hover:shadow-xl transition-shadow duration-300 overflow-visible"
				variants={fadeIn}
			>
				<div className="flex items-center mb-6">
					<div className="bg-gradient-to-r from-[#5059FE] to-[#7D65F6] p-2 rounded-lg mr-4">
						<svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<h2 className="text-xl font-bold">{t('profile.chooseYourPlan')}</h2>
				</div>
						
						{/* Billing Toggle */}
						<div className="flex justify-center items-center gap-4 mb-10 bg-[var(--background-subtle)] p-4 rounded-full max-w-xs mx-auto">
							<span className={`text-sm font-medium transition-colors duration-200 ${!isYearly ? 'text-[#5059FE]' : 'text-gray-500'}`}>{t('profile.monthly')}</span>
							<button
								onClick={() => setIsYearly(!isYearly)}
								className="relative inline-flex h-7 w-14 items-center rounded-full bg-gradient-to-r from-[#5059FE] to-[#7D65F6] transition-all duration-300"
								aria-pressed={isYearly}
								aria-labelledby="billing-period"
							>
								<span className="sr-only">{t('profile.toggleBillingPeriod')}</span>
								<motion.span 
									className="inline-block h-5 w-5 transform rounded-full bg-white shadow-md"
									initial={false}
									animate={{ x: isYearly ? 28 : 4 }}
									transition={{ type: "spring", stiffness: 500, damping: 30 }}
								/>
							</button>
							<span className={`text-sm font-medium transition-colors duration-200 ${isYearly ? 'text-[#5059FE]' : 'text-gray-500'}`}>{t('profile.yearly')}</span>
						</div>

						{/* Pricing Cards - Always visible, shows loading state when data is not available */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
							{loading ? (
								// Show loading skeleton when loading
								<>
									{[1, 2, 3].map((i) => (
										<div key={i} className="bg-[var(--background)] p-6 rounded-xl shadow-md border-2 border-[var(--border)] animate-pulse">
											<div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
											<div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
											<div className="h-10 bg-gray-200 rounded w-2/3 mb-6"></div>
											<div className="h-10 bg-gray-200 rounded w-full mb-6"></div>
											<div className="space-y-3">
												<div className="h-4 bg-gray-200 rounded"></div>
												<div className="h-4 bg-gray-200 rounded"></div>
												<div className="h-4 bg-gray-200 rounded"></div>
											</div>
										</div>
									))}
								</>
							) : safePriceData.length > 0 ? (
								safePriceData.map((plan: any, index: number) => {
								const isFree = plan.type === 'free';
								const isBasic = plan.type === 'basic';
								const isPro = plan.type === 'pro';
								const isCurrentPlan = subscriptionData?.plan_active && 
									planName?.toLowerCase() === plan.type.toLowerCase() &&
									((planInterval === 'month' && !isYearly) || (planInterval === 'year' && isYearly));

								const getPlanFeatures = () => {
									if (isFree) return [t('profile.planFeatures.free.1'), t('profile.planFeatures.free.2')];
									if (isBasic) return [t('profile.planFeatures.basic.1'), t('profile.planFeatures.basic.2'), t('profile.planFeatures.basic.3')];
									return [t('profile.planFeatures.pro.1'), t('profile.planFeatures.pro.2'), t('profile.planFeatures.pro.3')];
								};

								const getPlanPrice = () => {
									if (isFree) return '0';
									return isYearly ? plan.yearPrice?.toString() || '0' : plan.monthPrice?.toString() || '0';
								};

								const getPlanPeriod = () => {
									if (isFree) return isYearly ? 'year' : 'month';
									return isYearly ? 'year' : 'month';
								};

								const features = getPlanFeatures();
								const price = getPlanPrice();
								const period = getPlanPeriod();
								const isHighlighted = isBasic;

								// Get the appropriate priceId based on billing period
								const currentPriceId = isYearly && plan.yearPriceId ? plan.yearPriceId : plan.monthPriceId || '';

								// Calculate yearly savings percentage if applicable
								const monthlyCost = plan.monthPrice || 0;
								const yearlyCost = plan.yearPrice || 0;
								const yearlySavings = monthlyCost > 0 && yearlyCost > 0 
									? Math.round(100 - ((yearlyCost / 12) / monthlyCost * 100)) 
									: 0;

								return (
									<motion.div 
										key={plan.type}
										className={`bg-[var(--background)] p-6 rounded-xl shadow-md border-2 relative ${
											isHighlighted 
												? 'border-[#5059FE] ring-2 ring-[#5059FE] ring-opacity-20' 
												: isPro 
													? 'border-purple-400 ring-2 ring-purple-400 ring-opacity-20' 
													: 'border-[var(--border)]'
										}`}
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ 
											delay: index * 0.1,
											duration: 0.3
										}}
										whileHover={{ 
											y: -5,
											boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
										}}
									>
										{isHighlighted && (
											<div className="absolute -top-5 left-0 w-full flex justify-center">
												<span className="bg-gradient-to-r from-[#5059FE] to-[#7D65F6] text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg">
													{t('profile.mostPopular')}
												</span>
											</div>
										)}
										
										<h3 className={`text-xl font-bold mb-2 flex items-center ${isPro ? 'text-purple-600' : isBasic ? 'text-[#5059FE]' : ''}`}>
											{plan.name}
											{isPro && (
												<svg className="w-5 h-5 ml-2 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
													<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
												</svg>
											)}
										</h3>
										<p className="text-sm text-gray-600 mb-4 h-10">{plan.description}</p>
										
										<div className="mb-6">
											<div className="flex items-baseline">
												<span className="text-4xl font-extrabold">
													${price}
												</span>
												<span className="text-gray-500 text-sm ml-2">/{period}</span>
											</div>
											
											{isYearly && yearlySavings > 0 && !isFree && (
												<div className="mt-2">
													<span className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-md">
														{t('profile.saveYearly', { percent: yearlySavings })}
													</span>
												</div>
											)}
										</div>
										
										<div className="mb-6">
											{isCurrentPlan ? (
												<button 
													className="w-full py-3 px-4 bg-green-100 hover:bg-green-200 text-green-800 font-medium rounded-lg transition-colors duration-200"
													disabled
												>
													{t('profile.currentPlan')}
												</button>
											) : isFree ? (
												<button 
													className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors duration-200"
													disabled
												>
													{t('profile.freePlan')}
												</button>
											) : subscriptionData ? (
												// User has subscription - show upgrade/downgrade button
												(() => {
													const currentPlanType = planName?.toLowerCase() || '';
													const targetPlanType = plan.type.toLowerCase();
													
													// Determine if this is an upgrade or downgrade
													const planHierarchy: { [key: string]: number } = {
														'free': 0,
														'basic': 1,
														'pro': 2,
													};
													
													const currentTier = planHierarchy[currentPlanType] ?? 0;
													const targetTier = planHierarchy[targetPlanType] ?? 0;
													
													const changeType = targetTier > currentTier ? 'upgrade' : 
																	   targetTier < currentTier ? 'downgrade' : 'same';
													
													return (
														<div className="relative">
															<div className="absolute -inset-0.5 bg-gradient-to-r from-[#5059FE] to-[#7D65F6] rounded-lg blur opacity-30 group-hover:opacity-100 transition duration-200"></div>
															<PlanChangeButton
																currentPlanName={planName}
																newPlanName={plan.name}
																priceId={currentPriceId}
																changeType={changeType}
																isCurrentPlan={false}
																className={`relative w-full py-3 px-4 ${
																	isHighlighted 
																		? 'bg-gradient-to-r from-[#5059FE] to-[#7D65F6] hover:from-[#4048ed] hover:to-[#6A55E1] text-white' 
																		: isPro 
																			? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white' 
																			: 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-200'
																} font-medium rounded-lg transition-all duration-200`}
																onSuccess={() => {
																	// Refresh page data
																	window.location.reload();
																}}
															/>
														</div>
													);
												})()
											) : (
												// No subscription - show checkout button for new subscription
												<div className="relative">
													<div className="absolute -inset-0.5 bg-gradient-to-r from-[#5059FE] to-[#7D65F6] rounded-lg blur opacity-30 group-hover:opacity-100 transition duration-200"></div>
													<CheckoutButton 
														priceId={currentPriceId} 
														productId={plan.productId} 
														className={`relative w-full py-3 px-4 ${
															isHighlighted 
																? 'bg-gradient-to-r from-[#5059FE] to-[#7D65F6] hover:from-[#4048ed] hover:to-[#6A55E1] text-white' 
																: isPro 
																	? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white' 
																	: 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-200'
														} font-medium rounded-lg transition-all duration-200`}
													/>
												</div>
											)}
										</div>
										
										<div className="space-y-3">
											<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('profile.features')}</p>
											<ul className="space-y-3">
												{features.map((feature: string, index: number) => (
													<li key={index} className="flex items-start">
														<svg className={`w-5 h-5 mr-2 mt-0.5 flex-shrink-0 ${
															isPro ? 'text-purple-500' : isBasic ? 'text-[#5059FE]' : 'text-green-500'
														}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
														</svg>
														<span className="text-sm">{feature}</span>
													</li>
												))}
											</ul>
										</div>
									</motion.div>
								);
							})
							) : (
								// Fallback when priceData is missing or empty
								<div className="col-span-3 text-center py-12">
									<div className="flex justify-center mb-4">
										<RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
									</div>
									<p className="text-gray-600">
										{loading ? t('profile.loadingPricingPlans') : t('profile.pricingPlansNotAvailable')}
									</p>
									<p className="text-sm text-gray-500 mt-2">
										{loading ? t('profile.pleaseWaitFetchingPlans') : t('profile.refreshOrContactSupport')}
									</p>
								</div>
							)}
						</div>
			</motion.div>

			{/* Delete Account Section */}
			<motion.div 
				className="bg-white shadow-lg rounded-2xl p-8 border-2 border-red-200 hover:shadow-xl transition-shadow duration-300"
				variants={fadeIn}
			>
				<div className="flex items-center mb-4">
					<div className="bg-red-100 p-2.5 rounded-xl mr-4">
						<svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
					</div>
					<div>
						<h2 className="text-xl font-bold text-red-900">{t('profile.dangerZone')}</h2>
						<p className="text-sm text-gray-600 mt-1">{t('profile.dangerZoneDesc')}</p>
					</div>
				</div>
				<DeleteAccountButton userRole={userRole} />
			</motion.div>
		</motion.div>
	);
} 