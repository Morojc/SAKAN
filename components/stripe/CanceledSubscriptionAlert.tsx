'use client';

import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Calendar, Clock, CheckCircle } from 'lucide-react';
import { createPortalSession } from '@/app/actions/stripe';
import { useRouter } from 'next/navigation';

interface CanceledSubscriptionAlertProps {
	planName: string;
	planInterval: string;
	daysRemaining: number;
	accessUntil: Date;
	canceledAt: Date | null;
	onReactivate?: () => void;
}

export function CanceledSubscriptionAlert({
	planName,
	planInterval,
	daysRemaining,
	accessUntil,
	canceledAt,
	onReactivate,
}: CanceledSubscriptionAlertProps) {
	const [isReactivating, setIsReactivating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();

	const handleReactivate = async () => {
		console.log('[CanceledSubscriptionAlert] Reactivating subscription...');
		setIsReactivating(true);
		setError(null);

		try {
			// Open Stripe billing portal where user can reactivate
			const portalUrl = await createPortalSession();
			
			console.log('[CanceledSubscriptionAlert] Redirecting to billing portal in same tab');

			// Redirect in same tab (not new window)
			window.location.href = portalUrl;

			// Callback for parent component (won't execute due to redirect)
			if (onReactivate) {
				onReactivate();
			}
		} catch (err: any) {
			console.error('[CanceledSubscriptionAlert] Error opening portal:', err);
			setError(err.message || 'Failed to open billing portal');
			setIsReactivating(false);
		}
		// Note: setIsReactivating(false) not needed in finally because page will redirect
	};

	// Different alert styles based on days remaining
	const getAlertVariant = () => {
		if (daysRemaining <= 3) return 'destructive'; // Red
		if (daysRemaining <= 7) return 'default'; // Amber (will be styled)
		return 'default'; // Yellow
	};

	const getAlertStyles = () => {
		if (daysRemaining <= 3) {
			return 'bg-red-50 border-red-200 text-red-900';
		}
		if (daysRemaining <= 7) {
			return 'bg-orange-50 border-orange-200 text-orange-900';
		}
		return 'bg-amber-50 border-amber-200 text-amber-900';
	};

	const getIconColor = () => {
		if (daysRemaining <= 3) return 'text-red-600';
		if (daysRemaining <= 7) return 'text-orange-600';
		return 'text-amber-600';
	};

	return (
		<Alert className={`${getAlertStyles()} mb-6`}>
			<div className="flex items-start gap-3">
				<AlertCircle className={`h-5 w-5 ${getIconColor()} mt-0.5 flex-shrink-0`} />
				<div className="flex-1">
					<AlertTitle className="text-base font-semibold mb-2">
						{daysRemaining <= 3 ? '🚨 Subscription Ending Very Soon!' : '⚠️ Subscription Scheduled for Cancellation'}
					</AlertTitle>
					<AlertDescription className="space-y-3">
						<p className="text-sm">
							Your <strong>{planName}</strong> ({planInterval}ly) subscription will be canceled at the end of the current billing period. 
							You'll continue to have access to all premium features until then.
						</p>

						{/* Key Information Grid */}
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
							{/* Days Remaining */}
							<div className="flex items-center gap-3 bg-white/50 rounded-lg p-3 border border-current/10">
								<div className={`w-10 h-10 rounded-full ${daysRemaining <= 3 ? 'bg-red-100' : daysRemaining <= 7 ? 'bg-orange-100' : 'bg-amber-100'} flex items-center justify-center flex-shrink-0`}>
									<Clock className={`h-5 w-5 ${daysRemaining <= 3 ? 'text-red-700' : daysRemaining <= 7 ? 'text-orange-700' : 'text-amber-700'}`} />
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-xs font-medium opacity-75 uppercase tracking-wide">Time Remaining</p>
									<p className="text-lg font-bold">
										{daysRemaining} {daysRemaining === 1 ? 'Day' : 'Days'}
									</p>
								</div>
							</div>

							{/* Access Until */}
							<div className="flex items-center gap-3 bg-white/50 rounded-lg p-3 border border-current/10">
								<div className={`w-10 h-10 rounded-full ${daysRemaining <= 3 ? 'bg-red-100' : daysRemaining <= 7 ? 'bg-orange-100' : 'bg-amber-100'} flex items-center justify-center flex-shrink-0`}>
									<Calendar className={`h-5 w-5 ${daysRemaining <= 3 ? 'text-red-700' : daysRemaining <= 7 ? 'text-orange-700' : 'text-amber-700'}`} />
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-xs font-medium opacity-75 uppercase tracking-wide">Access Until</p>
									<p className="text-sm font-bold">
										{accessUntil.toLocaleDateString('en-US', {
											month: 'short',
											day: 'numeric',
											year: 'numeric',
										})}
									</p>
									<p className="text-xs opacity-75">
										{accessUntil.toLocaleTimeString('en-US', {
											hour: '2-digit',
											minute: '2-digit',
										})}
									</p>
								</div>
							</div>
						</div>

						{/* Cancellation Date */}
						{canceledAt && (
							<p className="text-xs opacity-75">
								Cancellation requested on {canceledAt.toLocaleDateString('en-US', {
									month: 'long',
									day: 'numeric',
									year: 'numeric',
								})}
							</p>
						)}

						{/* Error Message */}
						{error && (
							<div className="bg-red-100 border border-red-300 rounded-md p-3 text-red-800 text-sm">
								<strong>Error:</strong> {error}
							</div>
						)}

						{/* Action Buttons */}
						<div className="flex flex-col sm:flex-row gap-3 pt-2">
							<Button
								onClick={handleReactivate}
								disabled={isReactivating}
								className={`flex-1 ${
									daysRemaining <= 3
										? 'bg-red-600 hover:bg-red-700'
										: daysRemaining <= 7
										? 'bg-orange-600 hover:bg-orange-700'
										: 'bg-amber-600 hover:bg-amber-700'
								} text-white`}
							>
								{isReactivating ? (
									<>
										<RefreshCw className="mr-2 h-4 w-4 animate-spin" />
										Opening Portal...
									</>
								) : (
									<>
										<CheckCircle className="mr-2 h-4 w-4" />
										Reactivate Subscription
									</>
								)}
							</Button>
							<Button
								variant="outline"
								onClick={() => router.push('/app/billing')}
								className="flex-1 border-current/30 hover:bg-white/50"
							>
								View Billing Details
							</Button>
						</div>

						{/* Info Message */}
						<div className="bg-white/50 rounded-md p-3 border border-current/10">
							<p className="text-xs">
								<strong>💡 Good to know:</strong> Reactivating your subscription will prevent cancellation and 
								continue your {planInterval}ly billing cycle. You won't be charged again until the next billing period.
							</p>
						</div>
					</AlertDescription>
				</div>
			</div>
		</Alert>
	);
}

