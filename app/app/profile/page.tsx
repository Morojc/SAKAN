'use client';

import { Suspense } from 'react';
import Loading from '@/components/app/profile/loading';
import ProfileAndBillingContent from '@/components/app/profile/ProfileAndBillingContent';
import { useI18n } from '@/lib/i18n/client';

export default function ProfilePage() {
	const { t } = useI18n();
	return (
		<div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-gray-900 mb-2">{t('profile.title')}</h1>
				<p className="text-gray-600">{t('profile.description')}</p>
			</div>
			<Suspense fallback={<Loading />}>
				<ProfileAndBillingContent />
			</Suspense>
		</div>
	);
}
