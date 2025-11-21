'use client';

import { useState, useEffect } from 'react';
import PortalButton from '@/components/stripe/PortalButton';
import CheckoutButton from "@/components/CheckoutButton";
import DeleteAccountButton from '@/components/app/profile/DeleteAccountButton';
import { motion, AnimatePresence } from 'framer-motion';

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
	const [showPricing, setShowPricing] = useState(false); // Show pricing on demand
	const [isYearly, setIsYearly] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [profileData, setProfileData] = useState<any>(null);

	useEffect(() => {
		async function fetchProfileData() {
			try {
				const response = await fetch('/api/profile');
				if (!response.ok) {
					throw new Error('Failed to fetch profile data');
				}
				const data = await response.json();
				setProfileData(data);
			} catch (err) {
				console.error('Error fetching profile data:', err);
				setError('Failed to load profile data. Please try again later.');
			} finally {
				setLoading(false);
			}
		}

		fetchProfileData();
	}, []);

	if (loading) {
		return (
			<div className="flex justify-center items-center py-24">
				<div className="relative">
					<div className="h-16 w-16 rounded-full border-t-4 border-b-4 border-[#5059FE] animate-spin"></div>
					<div className="h-16 w-16 rounded-full border-r-4 border-l-4 border-[#5059FE]/30 animate-spin absolute top-0 left-0 animate-[spin_1.5s_linear_infinite]"></div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<motion.div 
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				className="bg-red-50 border-l-4 border-red-500 p-5 rounded-lg shadow-md"
				role="alert"
			>
				<div className="flex items-center">
					<svg className="h-6 w-6 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<p className="font-medium text-red-800">Error</p>
				</div>
				<p className="mt-2 text-red-700">{error}</p>
			</motion.div>
		);
	}

	if (!profileData) {
		return <div>No profile data available</div>;
	}

	const { userData, subscriptionData, planName, planInterval, priceData } = profileData;

	return (
		<motion.div 
			className="space-y-10 pb-16 max-w-7xl mx-auto px-4 sm:px-6"
			initial="hidden"
			animate="visible"
			variants={staggerContainer}
		>
			{/* User Information */}
			<motion.div 
				className="bg-[var(--background)] shadow-lg rounded-xl p-8 border border-[var(--border)] hover:shadow-xl transition-shadow duration-300"
				variants={fadeIn}
			>
				<div className="flex items-center mb-6">
					<div className="bg-gradient-to-r from-[#5059FE] to-[#7D65F6] p-2 rounded-lg mr-4">
						<svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
						</svg>
					</div>
					<h2 className="text-xl font-bold">User Information</h2>
				</div>
				
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div className="bg-[var(--background-subtle)] p-4 rounded-lg">
						<label className="text-sm font-medium text-gray-500">Name</label>
						<p className="font-semibold text-lg mt-1">{userData.name || 'Not set'}</p>
					</div>

					<div className="bg-[var(--background-subtle)] p-4 rounded-lg">
						<label className="text-sm font-medium text-gray-500">Email</label>
						<p className="font-semibold text-lg mt-1 break-all">{userData.email}</p>
					</div>

					{userData.image && (
						<div className="col-span-1 md:col-span-2 flex items-center">
							<div className="mr-4">
								<img
									src={userData.image}
									alt="User avatar"
									className="w-20 h-20 rounded-full border-4 border-[#5059FE]/20 shadow-md"
								/>
							</div>
							<div>
								<label className="text-sm font-medium text-gray-500">Profile Image</label>
								<p className="text-sm text-gray-600 mt-1">Your profile picture is visible to other users</p>
							</div>
						</div>
					)}
				</div>
			</motion.div>

			{/* Subscription Information */}
			<motion.div 
				className="bg-[var(--background)] shadow-lg rounded-xl p-8 border border-[var(--border)] hover:shadow-xl transition-shadow duration-300"
				variants={fadeIn}
			>
				<div className="flex items-center mb-6">
					<div className="bg-gradient-to-r from-[#5059FE] to-[#7D65F6] p-2 rounded-lg mr-4">
						<svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
						</svg>
					</div>
					<h2 className="text-xl font-bold">Subscription Status</h2>
				</div>
				
				<div className="bg-[var(--background-subtle)] p-6 rounded-xl">
					<div className="space-y-5">
						<div>
							<label className="text-sm font-medium text-gray-500">Current Plan</label>
							{(() => {
								const style = getPlanBadgeStyle(planName);
								const intervalStyle = getIntervalBadgeStyle(planName);
								return (
									<div className="flex items-center gap-3 mt-2">
										<span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold border-2 ${style.bgColor} ${style.textColor} ${style.borderColor}`}>
											{planName}
											{planName.toLowerCase() === 'pro' && (
												<svg className="w-5 h-5 ml-1" viewBox="0 0 24 24" fill="currentColor">
													<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
												</svg>
											)}
										</span>
										<span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold border ${intervalStyle.bgColor} ${intervalStyle.textColor} ${intervalStyle.borderColor}`}>
											{planInterval === 'year' ? 'Yearly' : 'Monthly'} Plan
										</span>
									</div>
								);
							})()}
						</div>
						{subscriptionData ? (
							<>
								<div className="bg-[var(--background)] p-4 rounded-lg shadow-sm">
									<label className="text-sm font-medium text-gray-500">Subscription Status</label>
									<div className="mt-2">
										{subscriptionData.plan_active ? (
											<div className="flex items-center gap-2">
												<span className="relative flex h-3 w-3">
													<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
													<span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
												</span>
												<span className="font-medium text-green-700">Active</span>
											</div>
										) : (
											<div className="flex items-center gap-2">
												<span className="relative flex h-3 w-3">
													<span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
												</span>
												<span className="font-medium text-red-700">Inactive</span>
											</div>
										)}
									</div>
								</div>
								{subscriptionData.plan_expires && (
									<div className="bg-[var(--background)] p-4 rounded-lg shadow-sm">
										<label className="text-sm font-medium text-gray-500">Plan Expires</label>
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
										</div>
									</div>
								)}
								<div className="mt-6">
									<PortalButton />
								</div>
							</>
						) : (
							<div>
								<div className="mt-6">
									<motion.button
										onClick={() => setShowPricing(!showPricing)}
										className="bg-gradient-to-r from-[#5059FE] to-[#7D65F6] hover:from-[#4048ed] hover:to-[#6A55E1] text-white font-bold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5059FE] focus:ring-opacity-50 shadow-lg hover:shadow-xl transition-all duration-200 w-full sm:w-auto flex items-center justify-center"
										whileHover={{ scale: 1.03 }}
										whileTap={{ scale: 0.98 }}
									>
										{showPricing ? (
											<>
												<svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
												</svg>
												Hide Pricing
											</>
										) : (
											<>
												<svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
												</svg>
												Upgrade Plan
											</>
										)}
									</motion.button>
								</div>
							</div>
						)}
					</div>
				</div>
			</motion.div>

			{/* Pricing Section */}
			<AnimatePresence>
				{showPricing && (
					<motion.div 
						className="bg-[var(--background)] shadow-lg rounded-xl p-8 border border-[var(--border)] hover:shadow-xl transition-shadow duration-300 overflow-visible"
						initial={{ opacity: 0, y: -20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						transition={{ duration: 0.3 }}
					>
						<div className="flex items-center mb-6">
							<div className="bg-gradient-to-r from-[#5059FE] to-[#7D65F6] p-2 rounded-lg mr-4">
								<svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
							<h2 className="text-xl font-bold">Upgrade Your Plan</h2>
						</div>
						
						{/* Billing Toggle */}
						<div className="flex justify-center items-center gap-4 mb-10 bg-[var(--background-subtle)] p-4 rounded-full max-w-xs mx-auto">
							<span className={`text-sm font-medium transition-colors duration-200 ${!isYearly ? 'text-[#5059FE]' : 'text-gray-500'}`}>Monthly</span>
							<button
								onClick={() => setIsYearly(!isYearly)}
								className="relative inline-flex h-7 w-14 items-center rounded-full bg-gradient-to-r from-[#5059FE] to-[#7D65F6] transition-all duration-300"
								aria-pressed={isYearly}
								aria-labelledby="billing-period"
							>
								<span className="sr-only">Toggle billing period</span>
								<motion.span 
									className="inline-block h-5 w-5 transform rounded-full bg-white shadow-md"
									initial={false}
									animate={{ x: isYearly ? 28 : 4 }}
									transition={{ type: "spring", stiffness: 500, damping: 30 }}
								/>
							</button>
							<span className={`text-sm font-medium transition-colors duration-200 ${isYearly ? 'text-[#5059FE]' : 'text-gray-500'}`}>Yearly</span>
						</div>

						{/* Pricing Cards - Fixed layout with responsive grid */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
							{priceData.map((plan: any, index: number) => {
								const isFree = plan.type === 'free';
								const isBasic = plan.type === 'basic';
								const isPro = plan.type === 'pro';

								const getPlanFeatures = () => {
									if (isFree) return ['Up to 50 notes', 'Basic formatting'];
									if (isBasic) return ['Unlimited notes', 'Advanced formatting', 'File attachments'];
									return ['Everything in Basic', 'Priority support', 'API access'];
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
													Most Popular
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
														Save {yearlySavings}% yearly
													</span>
												</div>
											)}
										</div>
										
										<div className="mb-6">
											{isFree ? (
												<button 
													className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors duration-200"
													disabled
												>
													Current Plan
												</button>
											) : (
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
											<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Features</p>
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
							})}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Delete Account Section */}
			<motion.div 
				className="bg-[var(--background)] shadow-lg rounded-xl p-8 border-2 border-red-200 hover:shadow-xl transition-shadow duration-300"
				variants={fadeIn}
			>
				<div className="flex items-center mb-4">
					<div className="bg-red-100 p-2 rounded-lg mr-4">
						<svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
					</div>
					<div>
						<h2 className="text-xl font-bold text-red-900">Danger Zone</h2>
						<p className="text-sm text-gray-600 mt-1">Permanently delete your account and all associated data</p>
					</div>
				</div>
				<DeleteAccountButton />
			</motion.div>
		</motion.div>
	);
} 