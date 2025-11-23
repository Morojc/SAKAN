import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function ValidateCodeLayout({
	children
}: {
	children: React.ReactNode
}) {
	const session = await auth();
	
	if (!session?.user?.email) {
		console.log('[ValidateCodeLayout] No session, redirecting to signin');
		redirect('/auth/signin');
	}

	console.log('[ValidateCodeLayout] Checking replacement email for:', session.user.email);

	// Check if user is a replacement email
	const { checkIfReplacementEmail } = await import('@/lib/utils/access-code');
	const codeData = await checkIfReplacementEmail(session.user.email);
	
	console.log('[ValidateCodeLayout] Code data found:', codeData ? `Yes (code: ${codeData.code}, action: ${codeData.action_type})` : 'No');
	
	if (!codeData) {
		// Not a replacement email, redirect to app
		console.log('[ValidateCodeLayout] Not a replacement email, redirecting to app');
		redirect('/app');
	}

	console.log('[ValidateCodeLayout] User is a replacement email, showing validate-code page');
	
	// Return children without app layout (no header/sidebar)
	// This page should be standalone
	return (
		<div className="min-h-screen bg-gray-50">
			{children}
		</div>
	);
}

