import { Suspense } from 'react';
import DashboardContent from '@/components/app/dashboard/DashboardContent';

/**
 * Main Dashboard Page
 * Displays comprehensive building management overview
 */
export default function AppPage() {
	console.log('[Dashboard Page] Rendering dashboard page');

	return (
		<div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
			<Suspense fallback={<DashboardSkeleton />}>
				<DashboardContent />
			</Suspense>
		</div>
	);
}

function DashboardSkeleton() {
	return (
		<div className="space-y-6">
			<div className="mb-6">
				<div className="h-8 bg-muted rounded w-64 mb-2 animate-pulse"></div>
				<div className="h-4 bg-muted rounded w-96 animate-pulse"></div>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{[...Array(4)].map((_, i) => (
					<div key={i} className="bg-card rounded-lg p-6 animate-pulse">
						<div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
						<div className="h-8 bg-muted rounded w-3/4 mb-2"></div>
						<div className="h-3 bg-muted rounded w-full"></div>
					</div>
				))}
			</div>
		</div>
	);
}
