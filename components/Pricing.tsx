'use client'
import CheckoutButton from "@/components/CheckoutButton";
import config from "@/config";
import { useState } from "react";

interface PlanData {
	type: string;
	monthPrice?: number;
	yearPrice?: number;
	monthPriceId?: string;
	yearPriceId?: string;
	productId: string;
	name: string;
	description: string;
}

// Convert the price data object into an array with type information
const priceData = Object.entries(config.stripe).map(([type, data]) => ({
	type,
	...data
})) as PlanData[];

export default function Pricing() {
	const [isYearly, setIsYearly] = useState(false);

	return (
		<section id="pricing" className="bg-[var(--background)] py-16">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<h2 className="text-3xl font-bold text-center mb-6">Pricing</h2>

				{/* Billing Toggle */}
				<div className="flex justify-center items-center gap-4 mb-12">
					<span className={`text-sm ${!isYearly ? 'text-[#5059FE] font-semibold' : 'text-gray-500'}`}>Monthly</span>
					<button
						onClick={() => setIsYearly(!isYearly)}
						className="relative inline-flex h-6 w-11 items-center rounded-full bg-[#5059FE] hover:bg-[#4048ed] transition-all duration-300"
					>
						<span className={`inline-block h-4 w-4 transform rounded-full bg-[var(--background)] shadow-md transition-all duration-300 ease-in-out hover:scale-110 ${isYearly ? 'translate-x-6' : 'translate-x-1'}`} />
					</button>
					<span className={`text-sm ${isYearly ? 'text-[#5059FE] font-semibold' : 'text-gray-500'}`}>Yearly</span>
				</div>

				<div className="grid md:grid-cols-3 gap-8">
					{priceData.map((plan) => {
						const isFree = plan.type === 'free';
						const isBasic = plan.type === 'basic';

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

						return (
							<div key={plan.type}
								className={`bg-[var(--background)] p-8 rounded-lg shadow-md border-2 relative card-hover ${isHighlighted ? 'border-[var(--primary)]' : 'border-[var(--border)]'
									}`}
							>
								{isBasic && (
									<div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
										<span className="bg-[#5059FE] text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg hover-lift">
											Most Popular
										</span>
									</div>
								)}
								<h3 className="text-xl font-bold mb-4">{plan.name}</h3>
								<p className="text-sm text-gray-600 mb-4">{plan.description}</p>
								<p className="text-4xl font-bold mb-6">
									${price}<span className="text-gray-500 text-base">/{period}</span>
								</p>
								<CheckoutButton priceId={currentPriceId} productId={plan.productId} />
								<ul className="space-y-3 mt-8">
									{features.map((feature, index) => (
										<li key={index} className="flex items-center">
											<svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
											</svg>
											{feature}
										</li>
									))}
								</ul>
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
} 