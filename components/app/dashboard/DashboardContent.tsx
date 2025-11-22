'use client';

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import OverviewCards from './OverviewCards';
import { getDashboardStats } from '@/app/actions/dashboard';

/**
 * Dashboard Content Component
 * Client component that fetches and displays dashboard statistics
 */
export default function DashboardContent() {
	const [stats, setStats] = useState({
		totalResidents: 0,
		cashOnHand: 0,
		bankBalance: 0,
		outstandingFees: 0,
		openIncidents: 0,
		recentAnnouncementsCount: 0,
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function fetchStats() {
			console.log('[DashboardContent] Fetching dashboard stats');
			setLoading(true);
			setError(null);

			try {
				const result = await getDashboardStats();

				if (result.success) {
					console.log('[DashboardContent] Stats loaded:', result.stats);
					setStats(result.stats);
				} else {
					console.error('[DashboardContent] Error:', result.error);
					setError(result.error || 'Failed to load dashboard stats');
				}
			} catch (err: any) {
				console.error('[DashboardContent] Error fetching stats:', err);
				setError(err.message || 'Failed to load dashboard stats');
			} finally {
				setLoading(false);
			}
		}

		fetchStats();
	}, []);

	if (loading) {
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

	if (error) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>Error</AlertTitle>
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		);
	}

	return <OverviewCards stats={stats} />;
}

