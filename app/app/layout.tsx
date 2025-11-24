import { Header } from "../../components/app/Header"
import { Sidebar } from "../../components/app/Sidebar"
import OnboardingGuard from "../../components/app/OnboardingGuard"
import { auth } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { headers } from "next/headers"

// Routes that should render without dashboard layout (Header/Sidebar)
const VERIFICATION_ROUTES = [
	'/app/verify-email-code',
	'/app/document-upload',
	'/app/verification-pending',
];

export default async function AppLayout({
	children
}: {
	children: React.ReactNode
}) {
	const headersList = await headers();
	const pathname = headersList.get('x-pathname') || '';
	
	// Check if current route is a verification route
	// If pathname is not available, default to dashboard layout (safer)
	const isVerificationRoute = pathname ? VERIFICATION_ROUTES.some(route => pathname.startsWith(route)) : false;

	// If it's a verification route, render minimal layout without dashboard
	if (isVerificationRoute) {
		return (
			<div className="min-h-screen bg-gray-50">
				{children}
			</div>
		);
	}

	// Check onboarding status for dashboard routes
	const session = await auth();
	const userId = session?.user?.id;
	let onboardingCompleted = true; // Default to true to avoid blocking if check fails

	if (userId) {
		try {
			const supabase = createSupabaseAdminClient();
			const { data: profile } = await supabase
				.from('profiles')
				.select('onboarding_completed, residence_id, role, email_verified, verified')
				.eq('id', userId)
				.maybeSingle();

			// Only show onboarding for syndics who haven't set a residence yet
			// One residence per syndic (enforced by database schema)
			if (!profile) {
				// If profile doesn't exist, default to showing onboarding
				// (new signups default to syndic role in auth.config.ts)
				onboardingCompleted = false;
			} else if (profile.role === 'syndic') {
				// For syndics: check email verification and document verification first
				// Middleware handles redirects, but we still need to check onboarding
				if (!profile.email_verified || !profile.verified) {
					// User will be redirected by middleware, but we still need to handle onboarding
					onboardingCompleted = false;
				} else {
					// Show onboarding only if syndic has no residence assigned
					if (profile.residence_id === null) {
						onboardingCompleted = false;
					} else {
						// If residence exists, check onboarding_completed flag first
						if (profile.onboarding_completed) {
							onboardingCompleted = true;
						} else {
							// If flag is not set, check if residents exist
							// If residents exist, consider onboarding completed (they've already configured)
							const { count } = await supabase
								.from('profiles')
								.select('*', { count: 'exact', head: true })
								.eq('residence_id', profile.residence_id)
								.eq('role', 'resident');
							
							// If there are residents, onboarding is effectively completed
							// Also update the flag for future checks
							const hasResidents = (count || 0) > 0;
							if (hasResidents) {
								// Update the flag to prevent showing onboarding again
								await supabase
									.from('profiles')
									.update({ onboarding_completed: true })
									.eq('id', userId);
							}
							onboardingCompleted = hasResidents;
						}
					}
				}
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

	// Normal app layout with header, sidebar, and content
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
