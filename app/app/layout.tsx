import { Header } from "../../components/app/Header"
import { Sidebar } from "../../components/app/Sidebar"
import OnboardingGuard from "../../components/app/OnboardingGuard"
import { auth } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/utils/supabase/server"

export default async function AppLayout({
	children
}: {
	children: React.ReactNode
}) {
	// Check onboarding status
	const session = await auth();
	const userId = session?.user?.id;
	let onboardingCompleted = true; // Default to true to avoid blocking if check fails

	if (userId) {
		try {
			const supabase = createSupabaseAdminClient();
			const { data: profile } = await supabase
				.from('profiles')
				.select('onboarding_completed, residence_id, role')
				.eq('id', userId)
				.maybeSingle();

			// Consider onboarding incomplete if:
			// 1. Profile doesn't exist, OR
			// 2. onboarding_completed is false, OR
			// 3. residence_id is null (user hasn't created a residence yet)
			// Only show onboarding for syndics (they need to create a residence)
			if (!profile) {
				onboardingCompleted = false; // Show onboarding if profile doesn't exist
			} else if (profile.role === 'syndic') {
				onboardingCompleted = profile.onboarding_completed === true && profile.residence_id !== null;
			} else {
				// Non-syndics don't need onboarding
				onboardingCompleted = true;
			}
		} catch (error) {
			console.error('[AppLayout] Error checking onboarding status:', error);
			// Default to false to show onboarding if there's an error (safer for new users)
			onboardingCompleted = false;
		}
	}

	return (
		<div className="flex h-screen bg-gray-50 overflow-hidden">
			{/* Sidebar - Desktop Only */}
			<aside className="hidden lg:block w-64 bg-white border-r border-gray-200 flex-shrink-0">
				<Sidebar />
			</aside>
			
			{/* Main Content Area */}
			<div className="flex-1 flex flex-col overflow-hidden">
			<Header />
				<main className="flex-1 overflow-y-auto bg-gray-50">
					<OnboardingGuard onboardingCompleted={onboardingCompleted}>
				{children}
					</OnboardingGuard>
			</main>
			</div>
		</div>
	)
}
