import { Suspense } from 'react';
import Loading from '@/components/app/billing/loading';
import BillingContent from '@/components/app/billing/BillingContent';

export default function BillingPage() {
	return (
		<div className="max-w-7xl mx-auto p-4 sm:px-6">
			<h1 className="text-2xl font-bold mb-6">Billing & Subscription</h1>
			<Suspense fallback={<Loading />}>
				<BillingContent />
			</Suspense>
		</div>
	);
}

