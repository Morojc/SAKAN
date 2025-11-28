import { Suspense } from 'react';
import PaymentsContent from '@/components/app/payments/PaymentsContent';

/**
 * Payments Page
 * Displays payments list, balance tracking, and cash payment entry
 */
export default function PaymentsPage() {
	console.log('[Payments Page] Rendering payments page');

	return (
		<div className="max-w-7xl mx-auto p-4 sm:px-6">
			<h1 className="text-2xl font-bold mb-6">Payments & Balance</h1>
			<Suspense fallback={<PaymentsPageSkeleton />}>
				<PaymentsContent />
			</Suspense>
		</div>
	);
}

function PaymentsPageSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div className="bg-card rounded-lg p-6 animate-pulse">
					<div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
					<div className="h-8 bg-muted rounded w-3/4"></div>
				</div>
				<div className="bg-card rounded-lg p-6 animate-pulse">
					<div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
					<div className="h-8 bg-muted rounded w-3/4"></div>
				</div>
			</div>
			<div className="bg-card rounded-lg p-6 animate-pulse">
				<div className="h-6 bg-muted rounded w-1/4 mb-4"></div>
				<div className="space-y-3">
					<div className="h-10 bg-muted rounded"></div>
					<div className="h-10 bg-muted rounded"></div>
					<div className="h-10 bg-muted rounded"></div>
				</div>
			</div>
		</div>
	);
}

