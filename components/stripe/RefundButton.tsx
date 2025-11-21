'use client';

import { refund } from '@/app/actions/stripe';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface RefundButtonProps {
	subscriptionId: string;
	onSuccess?: () => void;
}

export default function RefundButton({ subscriptionId, onSuccess }: RefundButtonProps) {
	const { data: session } = useSession();
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();
	const user = session?.user;

	if (!user) {
		return <div>User not found</div>
	}

	const handleRefund = async () => {
		const isConfirmed = window.confirm('Are you sure you want to request a refund? This action cannot be undone.');
		if (!isConfirmed) return;

		try {
			setIsLoading(true);
			if (!user) {
				throw 'Please log in to request a refund.';
			}
			await refund(subscriptionId);
			toast.success('Refund request submitted successfully');
			// Force refresh the page data
			router.refresh();
			// Call the onSuccess callback if provided
			onSuccess?.();
		} catch (error) {
			console.log('Failed to request refund:', error);
			toast.error(error?.toString() || 'Failed to request refund');
			router.refresh();
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<div className="mt-8 border-t pt-6">
			<div className="mt-1">
				<p className="text-sm text-gray-600 mb-3">Click the button below to request a refund for your subscription</p>
				<button
					className={`w-full rounded-lg py-2 transition-colors ${isLoading
						? 'bg-gray-400 cursor-not-allowed'
						: 'bg-red-600 hover:bg-red-700'
						} text-white font-medium`}
					onClick={handleRefund}
					disabled={isLoading}
				>
					{isLoading ? 'Processing...' : 'Request Refund'}
				</button>
			</div>
		</div>
	);
} 