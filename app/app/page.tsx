import { Suspense } from 'react';
import DashboardContent from '@/components/app/dashboard/DashboardContent';

/**
 * Main Dashboard Page
 * Displays financial and operational overview
 */
export default function AppPage() {
	console.log('[Dashboard Page] Rendering dashboard page');

	return (
		<div className="max-w-7xl mx-auto p-4 sm:px-6">
			<div className="mb-6">
				<h1 className="text-2xl font-bold">Dashboard</h1>
				<p className="text-muted-foreground">Financial and operational overview</p>
			</div>
			<Suspense fallback={<DashboardSkeleton />}>
				<DashboardContent />
			</Suspense>
		</div>
	);
}

function DashboardSkeleton() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{[...Array(6)].map((_, i) => (
				<div key={i} className="bg-card rounded-lg p-6 animate-pulse">
					<div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
					<div className="h-8 bg-muted rounded w-3/4 mb-2"></div>
					<div className="h-3 bg-muted rounded w-full"></div>
				</div>
			))}
		</div>
	);
}

