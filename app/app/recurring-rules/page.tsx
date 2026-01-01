import { Suspense } from 'react';
import RecurringFeesTab from '@/components/app/payments/RecurringFeesTab';

/**
 * Recurring Rules Page
 * Displays and manages recurring fee rules for automated payment generation
 */
export default function RecurringRulesPage() {
	console.log('[Recurring Rules Page] Rendering recurring rules page');

	return (
		<div className="max-w-7xl mx-auto p-4 sm:px-6">
			<div className="mb-6">
				<h1 className="text-2xl font-bold">Recurring Rules</h1>
				<p className="text-muted-foreground mt-1">
					Create and manage automated payment rules for residents
				</p>
			</div>
			<Suspense fallback={<RecurringRulesPageSkeleton />}>
				<RecurringFeesTab />
			</Suspense>
		</div>
	);
}

function RecurringRulesPageSkeleton() {
	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div className="h-6 bg-muted rounded w-1/4 animate-pulse"></div>
				<div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{[1, 2, 3].map((i) => (
					<div key={i} className="bg-card rounded-lg p-6 animate-pulse">
						<div className="h-5 bg-muted rounded w-3/4 mb-3"></div>
						<div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
						<div className="space-y-2">
							<div className="h-3 bg-muted rounded w-full"></div>
							<div className="h-3 bg-muted rounded w-2/3"></div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

