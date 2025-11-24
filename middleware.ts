import authConfig from "@/lib/auth.config"
import NextAuth from "next-auth"
import { NextResponse } from "next/server"

export const config = {
	matcher: ["/app/:path*"],
};

const { auth } = NextAuth(authConfig)

// Pages that are allowed even if user is not verified
const ALLOWED_UNVERIFIED_PAGES = [
	'/app/verify-email-code',
	'/app/document-upload',
	'/app/verification-pending',
];

export default auth(async (req) => {
	if (!req.auth) {
		return NextResponse.redirect(new URL("/api/auth/signin", req.url));
	}
	
	const pathname = req.nextUrl.pathname;
	
	// Allow access to verification pages
	if (ALLOWED_UNVERIFIED_PAGES.some(page => pathname.startsWith(page))) {
		const response = NextResponse.next();
		response.headers.set('x-pathname', pathname);
		return response;
	}
	
	// Check verification status for other pages
	try {
		const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
		const supabase = createSupabaseAdminClient();
		
		const { data: profile } = await supabase
			.from('profiles')
			.select('role, email_verified, verified')
			.eq('id', req.auth.user?.id)
			.maybeSingle();
		
		if (profile) {
			// For syndics: check email verification first, then document verification
			if (profile.role === 'syndic') {
				if (!profile.email_verified) {
					// Redirect to email verification if not verified
					return NextResponse.redirect(new URL("/app/verify-email-code", req.url));
				}
				
				if (!profile.verified) {
					// Check if document is submitted
					const { data: submission } = await supabase
						.from('syndic_document_submissions')
						.select('id, status')
						.eq('user_id', req.auth.user?.id)
						.order('submitted_at', { ascending: false })
						.limit(1)
						.maybeSingle();
					
					if (!submission) {
						// No document submitted yet, redirect to upload
						return NextResponse.redirect(new URL("/app/document-upload", req.url));
					} else if (submission.status === 'pending') {
						// Document submitted but pending review
						return NextResponse.redirect(new URL("/app/verification-pending", req.url));
					} else if (submission.status === 'rejected') {
						// Document rejected, allow re-upload
						return NextResponse.redirect(new URL("/app/document-upload", req.url));
					}
					// If approved, verified should be true, but if not, allow access (admin will set it)
				}
			}
		}
	} catch (error) {
		console.error('[Middleware] Error checking verification status:', error);
		// On error, allow access (fail open for better UX)
	}
	
	// Add pathname to headers for use in server components
	const response = NextResponse.next();
	response.headers.set('x-pathname', pathname);
	
	return response;
});