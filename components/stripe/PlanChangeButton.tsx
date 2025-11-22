'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { ArrowUp, ArrowDown, RefreshCw, CheckCircle, X } from 'lucide-react';

interface PlanChangeButtonProps {
	currentPlanName: string;
	newPlanName: string;
	priceId: string;
	changeType: 'upgrade' | 'downgrade' | 'same';
	isCurrentPlan?: boolean;
	className?: string;
	onSuccess?: () => void;
}

export function PlanChangeButton({
	currentPlanName,
	newPlanName,
	priceId,
	changeType,
	isCurrentPlan = false,
	className,
	onSuccess,
}: PlanChangeButtonProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [isPreviewing, setIsPreviewing] = useState(false);
	const [previewData, setPreviewData] = useState<{
		changeType: 'upgrade' | 'downgrade';
		prorationAmount: number;
	} | null>(null);

	const handlePreview = async () => {
		setIsPreviewing(true);
		try {
			const response = await fetch(`/api/subscription/update?priceId=${encodeURIComponent(priceId)}`);
			const data = await response.json();

			if (response.ok) {
				setPreviewData(data);
				// Show preview toast
				toast(
					(t) => (
						<div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg shadow-lg max-w-md">
							<div className="flex items-start">
								<div className="flex-1">
									<h3 className="text-sm font-semibold text-blue-900 mb-2">
										Plan Change Preview
									</h3>
									<p className="text-sm text-blue-800 mb-2">
										{changeType === 'upgrade' ? 'Upgrading' : 'Downgrading'} from{' '}
										<strong>{currentPlanName}</strong> to <strong>{newPlanName}</strong>
									</p>
									<p className="text-xs text-blue-700 mb-2 italic">
										✓ Your subscription will remain active and continue to renew automatically with the new plan.
										{previewData?.changeType === 'downgrade' && ' Changes take effect immediately.'}
									</p>
									{data.prorationAmount !== 0 && (
										<p className="text-sm text-blue-800 font-medium">
											Proration: {data.prorationAmount > 0 ? '+' : ''}
											{(data.prorationAmount / 100).toFixed(2)} USD
										</p>
									)}
									<div className="mt-3 flex gap-2">
										<button
											onClick={() => {
												toast.dismiss(t.id);
												handleConfirmChange();
											}}
											className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md"
										>
											Confirm Change
										</button>
										<button
											onClick={() => {
												toast.dismiss(t.id);
												setPreviewData(null);
											}}
											className="px-3 py-1.5 text-xs font-medium text-blue-700 hover:text-blue-900"
										>
											Cancel
										</button>
									</div>
								</div>
								<button
									onClick={() => {
										toast.dismiss(t.id);
										setPreviewData(null);
									}}
									className="ml-2 text-blue-400 hover:text-blue-600"
								>
									<X className="h-4 w-4" />
								</button>
							</div>
						</div>
					),
					{
						duration: 15000,
						position: 'top-center',
					}
				);
			}
		} catch (error: any) {
			console.error('[PlanChangeButton] Error previewing:', error);
			toast.error('Failed to preview plan change');
		} finally {
			setIsPreviewing(false);
		}
	};

	const handleConfirmChange = async () => {
		setIsLoading(true);
		try {
			const response = await fetch('/api/subscription/update', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					priceId,
					prorationBehavior: 'create_prorations',
				}),
			});

			const data = await response.json();

			if (response.ok) {
				toast.success(
					`✓ ${changeType === 'upgrade' ? 'Upgraded' : 'Downgraded'} to ${newPlanName}! Your subscription will continue to renew automatically.`,
					{
						duration: 6000,
						icon: <CheckCircle className="h-5 w-5 text-green-600" />,
					}
				);

				// Refresh the page to show updated subscription
				if (onSuccess) {
					onSuccess();
				}
				setTimeout(() => {
					window.location.reload();
				}, 1500);
			} else {
				toast.error(data.error || 'Failed to change plan');
			}
		} catch (error: any) {
			console.error('[PlanChangeButton] Error changing plan:', error);
			toast.error('Failed to change plan. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	if (isCurrentPlan) {
		return (
			<Button disabled className={className}>
				Current Plan
			</Button>
		);
	}

	if (changeType === 'same') {
		return (
			<Button disabled className={className}>
				Same Plan
			</Button>
		);
	}

	const isUpgrade = changeType === 'upgrade';
	const Icon = isUpgrade ? ArrowUp : ArrowDown;
	const buttonText = isUpgrade ? `Upgrade to ${newPlanName}` : `Downgrade to ${newPlanName}`;

	return (
		<Button
			onClick={handlePreview}
			disabled={isLoading || isPreviewing}
			className={`${className} ${
				isUpgrade
					? 'bg-green-600 hover:bg-green-700 text-white'
					: 'bg-gray-600 hover:bg-gray-700 text-white'
			}`}
		>
			{isLoading || isPreviewing ? (
				<>
					<RefreshCw className="mr-2 h-4 w-4 animate-spin" />
					{isPreviewing ? 'Previewing...' : 'Processing...'}
				</>
			) : (
				<>
					<Icon className="mr-2 h-4 w-4" />
					{buttonText}
				</>
			)}
		</Button>
	);
}

