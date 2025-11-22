'use client';

import { Building2, Users, Wallet, Clock, Target, TrendingUp, TrendingDown, Plus, ArrowRight, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

interface DashboardOverviewProps {
	stats: {
		totalResidents: number;
		cashOnHand: number;
		bankBalance: number;
		outstandingFees: number;
		openIncidents: number;
		recentAnnouncementsCount: number;
		todayPayments: number;
		monthlyPayments: number;
		fillRate: number;
		residentsChange: number;
		topResidents: Array<{
			id: string;
			full_name: string;
			apartment_number: string | null;
			complianceRate: number;
			totalFees: number;
			paidFees: number;
		}>;
		user: {
			name: string;
			email: string;
			image: string | null;
			role: string;
		};
		residence: {
			id: number;
			name: string;
			address: string;
			city: string;
		} | null;
	};
	loading?: boolean;
}

/**
 * Dashboard Overview Component
 * Creative and modern dashboard layout with enhanced UX
 */
export default function DashboardOverview({ stats, loading }: DashboardOverviewProps) {
	console.log('[DashboardOverview] Rendering with stats:', stats);

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('en-MA', {
			style: 'currency',
			currency: 'MAD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	// Calculate metrics
	const activeResidents = stats.totalResidents;
	const residentsChange = stats.residentsChange || 0;
	const avgTimeToResolve = 18; // days (placeholder)
	const timeChange = -3; // days (placeholder)
	const fillRate = stats.fillRate || 100;
	const fillRateChange = 5; // % (placeholder)

	const container = {
		hidden: { opacity: 0 },
		show: {
			opacity: 1,
			transition: {
				staggerChildren: 0.1
			}
		}
	};

	const item = {
		hidden: { opacity: 0, y: 20 },
		show: { opacity: 1, y: 0 }
	};

	if (loading) {
		return (
			<div className="space-y-8 p-2">
				<div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
					{[...Array(4)].map((_, i) => (
						<div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
					))}
				</div>
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					<div className="h-96 bg-gray-100 rounded-2xl animate-pulse lg:col-span-2" />
					<div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
				</div>
			</div>
		);
	}

	return (
		<motion.div 
			variants={container}
			initial="hidden"
			animate="show"
			className="space-y-8 p-1"
		>
			{/* Welcome Banner */}
			<motion.div variants={item} className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white p-8 shadow-xl">
				<div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
				<div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
					<div>
						<h1 className="text-3xl font-bold mb-2">
							Welcome back, {stats.user.name.split(' ')[0]}! 👋
						</h1>
						<p className="text-gray-300 flex items-center gap-2">
							<Building2 className="h-4 w-4" />
							{stats.residence?.name || 'My Residence'} • {stats.residence?.city || 'Casablanca'}
						</p>
					</div>
					<div className="flex items-center gap-3">
						<Link href="/app/payments">
							<Button className="bg-green-500 hover:bg-green-600 text-white border-0 shadow-lg shadow-green-500/20 transition-all hover:scale-105">
								<Plus className="h-4 w-4 mr-2" />
								Add Payment
							</Button>
						</Link>
						<Link href="/app/residents">
							<Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm transition-all hover:scale-105">
								<Users className="h-4 w-4 mr-2" />
								Residents
							</Button>
						</Link>
					</div>
				</div>
			</motion.div>

			{/* Metrics Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				{/* Total Residents */}
				<motion.div variants={item}>
					<Card className="relative overflow-hidden border-none shadow-lg bg-white hover:shadow-xl transition-all duration-300 group">
						<div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
							<Users className="h-24 w-24 text-blue-600" />
						</div>
						<CardContent className="p-6">
							<div className="flex items-center gap-4 mb-4">
								<div className="p-3 bg-blue-50 rounded-2xl group-hover:scale-110 transition-transform duration-300">
									<Users className="h-6 w-6 text-blue-600" />
								</div>
								<Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">
									Residents
								</Badge>
							</div>
							<div className="space-y-1">
								<h3 className="text-3xl font-bold text-gray-900">{activeResidents}</h3>
								<div className="flex items-center gap-2 text-sm">
									{residentsChange !== 0 ? (
										<span className={`flex items-center font-medium ${residentsChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
											{residentsChange > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
											{Math.abs(residentsChange)}%
										</span>
									) : (
										<span className="text-gray-400 flex items-center">
											<Activity className="h-3 w-3 mr-1" />
											Stable
										</span>
									)}
									<span className="text-gray-500">vs last month</span>
								</div>
							</div>
						</CardContent>
					</Card>
				</motion.div>

				{/* Monthly Revenue */}
				<motion.div variants={item}>
					<Card className="relative overflow-hidden border-none shadow-lg bg-white hover:shadow-xl transition-all duration-300 group">
						<div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
							<Wallet className="h-24 w-24 text-green-600" />
						</div>
						<CardContent className="p-6">
							<div className="flex items-center gap-4 mb-4">
								<div className="p-3 bg-green-50 rounded-2xl group-hover:scale-110 transition-transform duration-300">
									<Wallet className="h-6 w-6 text-green-600" />
								</div>
								<Badge variant="secondary" className="bg-green-50 text-green-700 border-green-100">
									Revenue
								</Badge>
							</div>
							<div className="space-y-1">
								<h3 className="text-3xl font-bold text-gray-900">{formatCurrency(stats.monthlyPayments)}</h3>
								<div className="flex items-center gap-2 text-sm">
									<span className="flex items-center font-medium text-green-600">
										<CheckCircle2 className="h-3 w-3 mr-1" />
										{stats.todayPayments}
									</span>
									<span className="text-gray-500">payments today</span>
								</div>
							</div>
						</CardContent>
					</Card>
				</motion.div>

				{/* Payment Rate */}
				<motion.div variants={item}>
					<Card className="relative overflow-hidden border-none shadow-lg bg-white hover:shadow-xl transition-all duration-300 group">
						<div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
							<Target className="h-24 w-24 text-purple-600" />
						</div>
						<CardContent className="p-6">
							<div className="flex items-center gap-4 mb-4">
								<div className="p-3 bg-purple-50 rounded-2xl group-hover:scale-110 transition-transform duration-300">
									<Target className="h-6 w-6 text-purple-600" />
								</div>
								<Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-100">
									Collection
								</Badge>
							</div>
							<div className="space-y-1">
								<h3 className="text-3xl font-bold text-gray-900">{fillRate}%</h3>
								<div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
									<div 
										className="bg-purple-500 h-1.5 rounded-full transition-all duration-1000" 
										style={{ width: `${fillRate}%` }} 
									/>
								</div>
								<p className="text-xs text-gray-500 mt-1">Target: 95%</p>
							</div>
						</CardContent>
					</Card>
				</motion.div>

				{/* Outstanding */}
				<motion.div variants={item}>
					<Card className="relative overflow-hidden border-none shadow-lg bg-white hover:shadow-xl transition-all duration-300 group">
						<div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
							<AlertCircle className="h-24 w-24 text-orange-600" />
						</div>
						<CardContent className="p-6">
							<div className="flex items-center gap-4 mb-4">
								<div className="p-3 bg-orange-50 rounded-2xl group-hover:scale-110 transition-transform duration-300">
									<AlertCircle className="h-6 w-6 text-orange-600" />
								</div>
								<Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-100">
									Pending
								</Badge>
							</div>
							<div className="space-y-1">
								<h3 className="text-3xl font-bold text-gray-900">{formatCurrency(stats.outstandingFees)}</h3>
								<div className="flex items-center gap-2 text-sm">
									<span className="text-gray-500">Outstanding amount</span>
								</div>
								{stats.outstandingFees > 0 && (
									<Link href="/app/residents" className="text-xs text-orange-600 font-medium hover:underline inline-block mt-1">
										View details →
									</Link>
								)}
							</div>
						</CardContent>
					</Card>
				</motion.div>
			</div>

			{/* Content Section */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
				{/* Recent Activity */}
				<motion.div variants={item} className="lg:col-span-2">
					<Card className="border-none shadow-lg h-full">
						<CardHeader className="flex flex-row items-center justify-between px-6 py-6">
							<div>
								<CardTitle className="text-xl font-bold text-gray-900">Recent Activity</CardTitle>
								<p className="text-sm text-gray-500 mt-1">Latest happenings in your residence</p>
							</div>
							<Link href="/app/payments">
								<Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900">
									View All <ArrowRight className="h-4 w-4 ml-1" />
								</Button>
							</Link>
						</CardHeader>
						<CardContent className="px-6 pb-6">
							<div className="space-y-4">
								{stats.todayPayments > 0 && (
									<div className="group flex items-center gap-4 p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-md transition-all duration-200 border border-transparent hover:border-gray-100">
										<div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
											<Wallet className="h-6 w-6 text-green-600" />
										</div>
										<div className="flex-1 min-w-0">
											<h4 className="font-semibold text-gray-900">New Payments Received</h4>
											<p className="text-sm text-gray-600 truncate">
												{stats.todayPayments} payments processed today
											</p>
										</div>
										<Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-0">
											Today
										</Badge>
									</div>
								)}

								{stats.openIncidents > 0 && (
									<div className="group flex items-center gap-4 p-4 rounded-2xl bg-orange-50/50 hover:bg-white hover:shadow-md transition-all duration-200 border border-transparent hover:border-orange-100">
										<div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
											<AlertCircle className="h-6 w-6 text-orange-600" />
										</div>
										<div className="flex-1 min-w-0">
											<h4 className="font-semibold text-gray-900">Incidents Reported</h4>
											<p className="text-sm text-gray-600 truncate">
												{stats.openIncidents} issues need attention
											</p>
										</div>
										<Link href="/app/incidents">
											<Button size="sm" variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800">
												Review
											</Button>
										</Link>
									</div>
								)}

								<div className="group flex items-center gap-4 p-4 rounded-2xl bg-blue-50/50 hover:bg-white hover:shadow-md transition-all duration-200 border border-transparent hover:border-blue-100">
									<div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
										<Users className="h-6 w-6 text-blue-600" />
									</div>
									<div className="flex-1 min-w-0">
										<h4 className="font-semibold text-gray-900">Community Status</h4>
										<p className="text-sm text-gray-600 truncate">
											{activeResidents} active residents in the building
										</p>
									</div>
									<Link href="/app/residents">
										<Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50">
											Manage
										</Button>
									</Link>
								</div>
							</div>
						</CardContent>
					</Card>
				</motion.div>

				{/* Top Residents / Insights */}
				<motion.div variants={item} className="space-y-6">
					{/* Insights Card */}
					<Card className="border-none shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white overflow-hidden">
						<CardContent className="p-6 relative">
							<div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
							<div className="relative z-10">
								<h3 className="text-lg font-bold mb-2 flex items-center gap-2">
									<Target className="h-5 w-5" />
									Quick Insight
								</h3>
								<div className="space-y-4">
									{stats.outstandingFees > 0 ? (
										<div>
											<p className="text-indigo-100 text-sm mb-3">
												You have <span className="font-bold text-white">{formatCurrency(stats.outstandingFees)}</span> in outstanding fees. Sending reminders could improve collection by 20%.
											</p>
											<Link href="/app/residents">
												<Button size="sm" className="bg-white text-indigo-600 hover:bg-indigo-50 border-0 w-full font-semibold">
													Send Reminders
												</Button>
											</Link>
										</div>
									) : (
										<div>
											<p className="text-indigo-100 text-sm">
												Great job! Your collection rate is optimal. Consider announcing the good financial health to residents.
											</p>
										</div>
									)}
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Top Residents */}
					<Card className="border-none shadow-lg">
						<CardHeader className="px-6 pt-6 pb-4">
							<CardTitle className="text-lg font-bold text-gray-900">Top Contributors</CardTitle>
						</CardHeader>
						<CardContent className="px-6 pb-6">
							<div className="space-y-4">
								{stats.topResidents.length > 0 ? (
									stats.topResidents.map((resident, idx) => (
										<div key={resident.id} className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<div className={`
													w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
													${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 
													  idx === 1 ? 'bg-gray-100 text-gray-700' : 
													  'bg-orange-100 text-orange-700'}
												`}>
													{idx + 1}
												</div>
												<div>
													<p className="text-sm font-semibold text-gray-900">{resident.full_name}</p>
													<p className="text-xs text-gray-500">{resident.apartment_number || 'N/A'}</p>
												</div>
											</div>
											<Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
												{resident.complianceRate}%
											</Badge>
										</div>
									))
								) : (
									<div className="text-center py-4 text-gray-500 text-sm">
										No data available yet
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</motion.div>
			</div>
		</motion.div>
	);
}