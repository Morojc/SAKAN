'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { createPortalSession } from '@/app/actions/stripe';
import { useState } from 'react';

interface SubscriptionStatusCardProps {
	planName: string;
	planInterval: string;
	status: string;
	currentPeriodEnd: Date | null;
	cancelAtPeriodEnd: boolean;
	daysRemaining: number | null;
}

export function SubscriptionStatusCard({
	planName,
	planInterval,
	status,
	currentPeriodEnd,
	cancelAtPeriodEnd,
	daysRemaining,
}: SubscriptionStatusCardProps) {
	const [isLoading, setIsLoading] = useState(false);

	const handleManageBilling = async () => {
		setIsLoading(true);
		try {
			const portalUrl = await createPortalSession();
			window.open(portalUrl, '_blank');
		} catch (error) {
			console.error('[SubscriptionStatusCard] Error:', error);
		} finally {
			setIsLoading(false);
		}
	};

	const getStatusBadge = () => {
		if (status === 'active' && !cancelAtPeriodEnd) {
			return (
				<Badge className="bg-green-100 text-green-800 border-green-200">
					<CheckCircle className="w-3 h-3 mr-1" />
					Active
				</Badge>
			);
		}
		if (status === 'active' && cancelAtPeriodEnd) {
			return (
				<Badge className="bg-amber-100 text-amber-800 border-amber-200">
					<AlertTriangle className="w-3 h-3 mr-1" />
					Canceling
				</Badge>
			);
		}
		return (
			<Badge className="bg-gray-100 text-gray-800 border-gray-200">
				<XCircle className="w-3 h-3 mr-1" />
				Inactive
			</Badge>
		);
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>Subscription Status</CardTitle>
						<CardDescription className="mt-1">
							Current plan: <strong>{planName}</strong> ({planInterval}ly)
						</CardDescription>
					</div>
					{getStatusBadge()}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Cancellation Warning */}
				{cancelAtPeriodEnd && daysRemaining !== null && (
					<div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
						<div className="flex items-start gap-3">
							<AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
							<div className="flex-1">
								<h4 className="font-semibold text-amber-900 mb-1">Subscription ending soon</h4>
								<p className="text-sm text-amber-800 mb-3">
									Your subscription will end at the end of the current billing period.
								</p>
								<div className="flex flex-wrap gap-4 text-sm">
									<div className="flex items-center gap-2">
										<Clock className="h-4 w-4 text-amber-700" />
										<span className="font-medium text-amber-900">
											{daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
										</span>
									</div>
									{currentPeriodEnd && (
										<div className="flex items-center gap-2">
											<Calendar className="h-4 w-4 text-amber-700" />
											<span className="text-amber-800">
												Until {currentPeriodEnd.toLocaleDateString('en-US', {
													month: 'short',
													day: 'numeric',
													year: 'numeric',
												})}
											</span>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Next Billing / Access Until */}
				{currentPeriodEnd && (
					<div>
						<label className="text-sm text-muted-foreground">
							{cancelAtPeriodEnd ? 'Access Until' : 'Next Billing Date'}
						</label>
						<div className="flex items-center gap-2 mt-1">
							<Calendar className="h-4 w-4 text-muted-foreground" />
							<span className="font-medium">
								{currentPeriodEnd.toLocaleDateString('en-US', {
									year: 'numeric',
									month: 'long',
									day: 'numeric',
								})}
							</span>
						</div>
						{daysRemaining !== null && !cancelAtPeriodEnd && (
							<p className="text-xs text-muted-foreground mt-1">
								{daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
							</p>
						)}
					</div>
				)}

				{/* Manage Button */}
				<Button onClick={handleManageBilling} disabled={isLoading} className="w-full">
					{isLoading ? 'Loading...' : 'Manage Subscription'}
				</Button>
			</CardContent>
		</Card>
	);
}

