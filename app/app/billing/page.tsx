import { Suspense } from 'react';
import Loading from '@/components/app/billing/loading';
import BillingContent from '@/components/app/billing/BillingContent';

export default function BillingPage() {
	return (
		<div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-gray-900 mb-2">Billing & Subscription</h1>
				<p className="text-gray-600">Manage your subscription and payment methods</p>
			</div>
			<Suspense fallback={<Loading />}>
				<BillingContent />
			</Suspense>
		</div>
	);
}

