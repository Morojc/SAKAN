import { Header } from "../../components/app/Header"
import { Sidebar } from "../../components/app/Sidebar"
import OnboardingGuard from "../../components/app/OnboardingGuard"
import ReplacementUserRedirect from "../../components/app/ReplacementUserRedirect"
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
	let isReplacementUser = false;

	// Check if user is a replacement email
	// This check is done here instead of middleware to avoid Edge Runtime limitations
	if (session?.user?.email) {
		try {
			const supabase = createSupabaseAdminClient();
			
			// Check if user already has syndic role (code already validated)
			// Only check if userId exists (user has profile)
			let userRole: string | null = null;
			if (userId) {
				const { data: profile } = await supabase
					.from('profiles')
					.select('role')
					.eq('id', userId)
					.maybeSingle();
				userRole = profile?.role || null;
			}
			
			console.log('[AppLayout] Checking replacement email for:', session.user.email, 'User ID:', userId, 'Profile role:', userRole);
			
			// Only redirect if user is not already a syndic
			if (userRole !== 'syndic') {
				// Use checkIfReplacementEmail utility which handles RLS properly
				const { checkIfReplacementEmail } = await import('@/lib/utils/access-code');
				const codeData = await checkIfReplacementEmail(session.user.email);

				console.log('[AppLayout] Code data found:', codeData ? `Yes (code: ${codeData.code}, action: ${codeData.action_type})` : 'No');

				if (codeData) {
					// User is a replacement email - set flag to render client redirect component
					console.log('[AppLayout] User is a replacement email, will trigger client redirect');
					isReplacementUser = true;
				} else {
					console.log('[AppLayout] No pending access code found for this email');
				}
			} else {
				console.log('[AppLayout] User already has syndic role, skipping replacement check');
			}
		} catch (error) {
			console.error('[AppLayout] Error checking replacement email:', error);
			// Continue to app if check fails
		}
	}

	if (userId) {
		try {
			const supabase = createSupabaseAdminClient();
			const { data: profile } = await supabase
				.from('profiles')
				.select('onboarding_completed, residence_id, role')
				.eq('id', userId)
				.maybeSingle();

			// Only show onboarding for syndics who haven't set a residence yet
			// One residence per syndic (enforced by database schema)
			if (!profile) {
				// If profile doesn't exist, default to showing onboarding
				// (new signups default to syndic role in auth.config.ts)
				onboardingCompleted = false;
			} else if (profile.role === 'syndic') {
				// Show onboarding only if syndic has no residence assigned
				onboardingCompleted = profile.residence_id !== null;
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
					{isReplacementUser && <ReplacementUserRedirect />}
					<OnboardingGuard onboardingCompleted={onboardingCompleted}>
				{children}
					</OnboardingGuard>
			</main>
			</div>
		</div>
	)
}
