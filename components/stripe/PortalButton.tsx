'use client';

import { createPortalSession } from '@/app/actions/stripe';
import { createSupabaseClient } from '@/utils/supabase/front';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function PortalButton() {
	const { data: session } = useSession();
	const [isLoading, setIsLoading] = useState(false);
	const user = session?.user;
	if (!user) {
		return <div>User not found</div>
	}

	const handleClick = async () => {
		try {
			setIsLoading(true);
			if (!user) {
				throw 'Please log in to manage your billing.';
			}
			if (!session?.supabaseAccessToken) {
				throw 'Please log in to manage your billing.';
			}
			const supabase = await createSupabaseClient(session?.supabaseAccessToken);

			if (user.id) {
				const { data: customer, error: _fetchError } = await supabase
					.from('stripe_customers')
					.select('stripe_customer_id')
					.eq('user_id', user.id)
					.single();
				if (customer?.stripe_customer_id) {
					const url = await createPortalSession(customer?.stripe_customer_id);
					window.location.href = url;
				}
			}
		} catch (error) {
			console.error('Failed to create billing portal session:', error);
			toast.error(error?.toString() || 'Failed to create billing portal session');
		} finally {
			setIsLoading(false);
		}
	}

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