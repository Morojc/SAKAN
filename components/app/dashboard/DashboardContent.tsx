'use client';

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import DashboardOverview from './DashboardOverview';
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
		todayPayments: 0,
		monthlyPayments: 0,
		fillRate: 100,
		residentsChange: 0,
		topResidents: [] as Array<{
			id: string;
			full_name: string;
			apartment_number: string | null;
			complianceRate: number;
			totalFees: number;
			paidFees: number;
		}>,
		user: {
			name: 'Syndic',
			email: '',
			image: null,
			role: 'syndic',
		},
		residence: null,
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

	if (error) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>Error</AlertTitle>
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		);
	}

	return <DashboardOverview stats={stats} loading={loading} />;
}
