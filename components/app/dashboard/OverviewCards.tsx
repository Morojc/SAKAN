'use client';

import { Users, Wallet, Building2, AlertCircle, Receipt, Megaphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface OverviewCardsProps {
	stats: {
		totalResidents: number;
		cashOnHand: number;
		bankBalance: number;
		outstandingFees: number;
		openIncidents: number;
		recentAnnouncementsCount: number;
	};
}

/**
 * Overview Cards Component
 * Displays key financial and operational stats on the dashboard
 */
export default function OverviewCards({ stats }: OverviewCardsProps) {
	console.log('[OverviewCards] Rendering with stats:', stats);

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('en-MA', {
			style: 'currency',
			currency: 'MAD',
		}).format(amount);
	};

	const cards = [
		{
			title: 'Total Residents',
			value: stats.totalResidents.toString(),
			description: 'Active residents in building',
			icon: Users,
			iconColor: 'text-blue-600',
			bgColor: 'bg-blue-50',
			link: '/app/residents',
		},
		{
			title: 'Cash on Hand',
			value: formatCurrency(stats.cashOnHand),
			description: 'Available cash balance',
			icon: Wallet,
			iconColor: 'text-emerald-600',
			bgColor: 'bg-emerald-50',
			link: '/app/payments',
		},
		{
			title: 'Bank Balance',
			value: formatCurrency(stats.bankBalance),
			description: 'Bank account balance',
			icon: Building2,
			iconColor: 'text-cyan-600',
			bgColor: 'bg-cyan-50',
			link: '/app/payments',
		},
		{
			title: 'Outstanding Fees',
			value: formatCurrency(stats.outstandingFees),
			description: 'Unpaid and overdue fees',
			icon: Receipt,
			iconColor: 'text-amber-600',
			bgColor: 'bg-amber-50',
			link: '/app/residents',
		},
		{
			title: 'Open Incidents',
			value: stats.openIncidents.toString(),
			description: 'Incidents awaiting resolution',
			icon: AlertCircle,
			iconColor: 'text-rose-600',
			bgColor: 'bg-rose-50',
			link: '/app/incidents',
		},
		{
			title: 'Announcements',
			value: stats.recentAnnouncementsCount.toString(),
			description: 'Recent announcements',
			icon: Megaphone,
			iconColor: 'text-purple-600',
			bgColor: 'bg-purple-50',
			link: '/app/announcements',
		},
	];

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{cards.map((card, index) => {
				const Icon = card.icon;
				return (
					<Card
						key={index}
						className="hover:shadow-lg transition-shadow duration-300 cursor-pointer"
					>
						<Link href={card.link}>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">{card.title}</CardTitle>
								<div className={`p-2 rounded-full ${card.bgColor}`}>
									<Icon className={`h-4 w-4 ${card.iconColor}`} />
								</div>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">{card.value}</div>
								<p className="text-xs text-muted-foreground mt-1">{card.description}</p>
								<Button variant="link" className="p-0 h-auto mt-2 text-xs">
									View details →
								</Button>
							</CardContent>
						</Link>
					</Card>
				);
			})}
		</div>
	);
}

