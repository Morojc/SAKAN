'use client';

import { createPortalSession } from '@/app/actions/stripe';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import toast from 'react-hot-toast';

/**
 * Portal Button Component
 * Uses Stripe SDK directly via server action - no database queries
 */
export default function PortalButton() {
	const { data: session } = useSession();
	const [isLoading, setIsLoading] = useState(false);
	const user = session?.user;

	if (!user) {
		return <div>User not found</div>;
	}

	const handleClick = async () => {
		try {
			console.log('[PortalButton] Creating billing portal session');
			setIsLoading(true);

			if (!user) {
				throw new Error('Please log in to manage your billing.');
			}

			// Create portal session - service will find customer via Stripe SDK
			const url = await createPortalSession();
			console.log('[PortalButton] Portal session created, redirecting');
			window.location.href = url;
		} catch (error: any) {
			console.error('[PortalButton] Failed to create billing portal session:', error);
			toast.error(error?.message || 'Failed to create billing portal session');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div>
			<div className="mt-1">
				<p className="text-sm text-gray-600 mb-3">Click the button below to manage your billing settings and subscription</p>
				<button
					className={`w-full rounded-lg py-2 transition-colors ${isLoading
						? 'bg-gray-400 cursor-not-allowed'
						: 'bg-[#5059FE] hover:bg-[#4048ed]'
						} text-white font-medium`}
					onClick={handleClick}
					disabled={isLoading}
				>
					{isLoading ? 'Processing...' : 'Manage Billing'}
				</button>
			</div>
		</div>
	);
}