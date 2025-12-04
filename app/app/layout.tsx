import { SidebarProvider } from "../../components/app/SidebarProvider"
import { AppLayoutContentClient } from "../../components/app/AppLayoutContent"
import { headers } from "next/headers"

// Routes that should render without dashboard layout (Header/Sidebar)
// These are verification/waiting pages that need minimal UI
const MINIMAL_LAYOUT_ROUTES = [
	'/app/verify-email-code',
	'/app/document-upload',
	'/app/verification-pending',
	'/app/waiting-residence',
];

export default async function AppLayout({
	children
}: {
	children: React.ReactNode
}) {
	const headersList = await headers();
	const pathname = headersList.get('x-pathname') || '';
	
	// Check if current route needs minimal layout (no header/sidebar)
	const isMinimalLayout = pathname ? MINIMAL_LAYOUT_ROUTES.some(route => pathname.startsWith(route)) : false;

	// If it's a minimal layout route, render without dashboard UI
	if (isMinimalLayout) {
		return (
			<div className="min-h-screen bg-gray-50">
				{children}
			</div>
		);
	}

	// Normal app layout with header, sidebar, and content
	// Middleware handles all verification and residence checks
	// No onboarding wizard needed - admins assign residences
	return (
		<SidebarProvider>
			<AppLayoutContentClient>
				{children}
			</AppLayoutContentClient>
		</SidebarProvider>
	)
}
