import { Suspense } from 'react';
import Loading from '@/components/app/profile/loading';
import ProfileAndBillingContent from '@/components/app/profile/ProfileAndBillingContent';

export default function ProfilePage() {
	return (
		<div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-gray-900 mb-2">Profile and Settings</h1>
				<p className="text-gray-600">Manage your account information and subscription</p>
			</div>
			<Suspense fallback={<Loading />}>
				<ProfileAndBillingContent />
			</Suspense>
		</div>
	);
}
