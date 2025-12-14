'use client';

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import DashboardOverview from './DashboardOverview';
import { getDashboardStats } from '@/app/actions/dashboard';
import { useI18n } from '@/lib/i18n/client';

/**
 * Dashboard Content Component
 * Client component that fetches and displays dashboard statistics
 */
export default function DashboardContent() {
	const { t } = useI18n();
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
		residence: null as {
			id: number;
			name: string;
			address: string;
			city: string;
		} | null,
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
					// If user has no residence, the onboarding guard will handle showing the wizard
					// Don't show error, just show empty stats
					if (!result.stats.residence) {
						console.log('[DashboardContent] User has no residence - onboarding will be shown');
					}
				} else {
					// Only show error if it's a real error, not just missing profile/residence
					if (result.error && !result.error.includes('profile') && !result.error.includes('residence')) {
						console.error('[DashboardContent] Error:', result.error);
						setError(result.error);
					} else {
						// For profile/residence errors, just use empty stats
						console.log('[DashboardContent] Profile/residence issue - using empty stats');
						if (result.stats) {
							setStats(result.stats);
						}
					}
				}
			} catch (err: any) {
				console.error('[DashboardContent] Error fetching stats:', err);
				// Only show error for unexpected errors
				if (!err.message?.includes('profile') && !err.message?.includes('residence')) {
					setError(err.message || 'Failed to load dashboard stats');
				}
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
				<AlertTitle>{t('common.error')}</AlertTitle>
				<AlertDescription>{error || t('dashboard.failedToLoad')}</AlertDescription>
			</Alert>
		);
	}

	return <DashboardOverview stats={stats} loading={loading} />;
}
