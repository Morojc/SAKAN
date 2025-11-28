'use client'
import CheckoutButton from "@/components/CheckoutButton";
import config from "@/config";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

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
		<section id="pricing" className="py-24 relative overflow-hidden">
			<div className="absolute inset-0 bg-[#0f1117]" />
			
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
				<div className="text-center mb-16">
					<h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
						Des tarifs simples et transparents
					</h2>
					<p className="text-xl text-gray-400">
						Choisissez le plan qui correspond à la taille de votre résidence
					</p>
				</div>

				{/* Billing Toggle */}
				<div className="flex justify-center items-center gap-4 mb-16">
					<span className={`text-sm font-medium ${!isYearly ? 'text-white' : 'text-gray-400'}`}>Mensuel</span>
					<button
						onClick={() => setIsYearly(!isYearly)}
						className="relative inline-flex h-7 w-12 items-center rounded-full bg-white/10 border border-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#0f1117]"
					>
						<span className={`${isYearly ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-indigo-500 transition-transform duration-200`} />
					</button>
					<span className={`text-sm font-medium ${isYearly ? 'text-white' : 'text-gray-400'}`}>
						Annuel <span className="text-indigo-400 text-xs ml-1">(-15%)</span>
					</span>
				</div>

				<div className="grid md:grid-cols-3 gap-8">
					{priceData.map((plan) => {
						const isFree = plan.type === 'free';
						const isBasic = plan.type === 'basic';

						const getPlanFeatures = () => {
							if (isFree) return ['Jusqu\'à 10 résidents', 'Gestion de base', 'Support par email'];
							if (isBasic) return ['Résidents illimités', 'Gestion financière complète', 'App mobile résidents', 'Support prioritaire'];
							return ['Tout du plan Basic', 'Multi-résidences', 'API access', 'Account manager dédié', 'Formation sur site'];
						};

						const getPlanPrice = () => {
							if (isFree) return '0';
							return isYearly ? plan.yearPrice?.toString() || '0' : plan.monthPrice?.toString() || '0';
						};

						const getPlanPeriod = () => {
							return isYearly ? 'an' : 'mois';
						};

						const features = getPlanFeatures();
						const price = getPlanPrice();
						const period = getPlanPeriod();
						const isHighlighted = isBasic;

						// Get the appropriate priceId based on billing period
						const currentPriceId = isYearly && plan.yearPriceId ? plan.yearPriceId : plan.monthPriceId || '';

						return (
							<div key={plan.type}
								className={`relative p-8 rounded-2xl border transition-all duration-300 ${
									isHighlighted 
										? 'bg-[#161922] border-indigo-500 shadow-2xl shadow-indigo-500/10 scale-105 z-10' 
										: 'bg-[#161922]/50 border-white/10 hover:border-white/20'
								}`}
							>
								{isHighlighted && (
									<div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
										<span className="bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
											Populaire
										</span>
									</div>
								)}
								
								<h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
								<p className="text-sm text-gray-400 mb-6">{plan.description}</p>
								
								<div className="flex items-baseline mb-8">
									<span className="text-4xl font-bold text-white">{price}</span>
									<span className="text-xl font-bold text-white ml-1">MAD</span>
									<span className="text-gray-400 ml-2">/{period}</span>
								</div>

								<CheckoutButton 
									priceId={currentPriceId} 
									productId={plan.productId} 
									className={`w-full py-4 rounded-xl font-bold transition-all duration-200 ${
										isHighlighted
											? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:shadow-lg hover:shadow-indigo-500/25 text-white'
											: 'bg-white text-gray-900 hover:bg-gray-100'
									}`}
								/>
								
								<ul className="space-y-4 mt-8">
									{features.map((feature, index) => (
										<li key={index} className="flex items-start">
											<CheckCircle2 className="h-5 w-5 text-indigo-500 mr-3 flex-shrink-0" />
											<span className="text-gray-300 text-sm">{feature}</span>
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