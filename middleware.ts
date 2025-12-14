import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export const config = {
	matcher: ["/app/:path*", "/admin/:path*"],
};

export async function middleware(req: NextRequest) {
	const pathname = req.nextUrl.pathname;
	
	// =====================================================
	// ADMIN ROUTES - Independent Authentication System
	// =====================================================
	if (pathname.startsWith('/admin')) {
		// Allow access to diagnostic page
		if (pathname === '/admin/check-hash') {
			const response = NextResponse.next();
			response.headers.set('x-pathname', pathname);
			return response;
		}

		// Allow access to login pages with access hash (e.g., /admin/abc123def)
		// Pattern: exactly 12 lowercase letters and numbers
		const isAccessHashRoute = /^\/admin\/[a-z0-9]{12}$/.test(pathname);
		
		if (isAccessHashRoute) {
			// This is a login page with access hash - allow without authentication
			const response = NextResponse.next();
			response.headers.set('x-pathname', pathname);
			return response;
		}

		// For other admin routes, check admin session
		try {
			const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
			const { cookies } = await import('next/headers');
			
			const cookieStore = await cookies();
			const sessionToken = cookieStore.get('admin_session')?.value;
			
			if (!sessionToken) {
				// No session - redirect to 404 (since they need unique URL)
				return NextResponse.redirect(new URL("/404", req.url));
			}
			
			// Verify session in database
			const supabase = createSupabaseAdminClient();
			const { data: session } = await supabase
				.from('admin_sessions')
				.select('admin_id, expires_at')
				.eq('token', sessionToken)
				.maybeSingle();
			
			if (!session || new Date(session.expires_at) < new Date()) {
				// Invalid or expired session - redirect to 404
				return NextResponse.redirect(new URL("/404", req.url));
			}
			
			// Check if admin is active
			const { data: admin } = await supabase
				.from('admins')
				.select('id, is_active')
				.eq('id', session.admin_id)
				.eq('is_active', true)
				.maybeSingle();
			
			if (!admin) {
				// Admin not active - redirect to 404
				return NextResponse.redirect(new URL("/404", req.url));
			}
			
			// Admin authenticated - allow access
			const response = NextResponse.next();
			response.headers.set('x-pathname', pathname);
			response.headers.set('x-is-admin', 'true');
			response.headers.set('x-admin-id', admin.id);
			return response;
		} catch (error) {
			console.error('[Middleware] Error checking admin session:', error);
			return NextResponse.redirect(new URL("/404", req.url));
		}
	}

	// =====================================================
	// APP ROUTES - NextAuth User Authentication System
	// =====================================================
	// Only load NextAuth for /app routes
	const authConfig = await import("@/lib/auth.config");
	const NextAuth = await import("next-auth");
	const { auth } = NextAuth.default(authConfig.default);

	// Get session for app routes
	const session = await auth();
	
	if (!session) {
		return NextResponse.redirect(new URL("/api/auth/signin", req.url));
	}
	
	const userId = session.user?.id;
	
	// Pages that are allowed even if user is not verified
	const ALLOWED_UNVERIFIED_PAGES = [
		'/app/verify-email-code',
		'/app/document-upload',
		'/app/verification-pending',
		'/app/waiting-residence',
	];
	
	// Allow access to verification pages
	if (ALLOWED_UNVERIFIED_PAGES.some(page => pathname.startsWith(page))) {
		const response = NextResponse.next();
		response.headers.set('x-pathname', pathname);
		return response;
	}
	
	// Check verification status for app pages
	try {
		const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
		const supabase = createSupabaseAdminClient();
		
		const { data: profile } = await supabase
			.from('profiles')
			.select('role, email_verified, verified')
			.eq('id', userId)
			.maybeSingle();
		
		if (profile) {
			// For syndics: check email verification, document verification, and residence assignment
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
						.eq('user_id', userId)
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
				
				// Check if syndic has been assigned a residence (using the new schema)
				if (profile.verified) {
					const { data: residence, error: residenceError } = await supabase
						.from('residences')
						.select('id, name, syndic_user_id')
						.eq('syndic_user_id', userId)
						.maybeSingle();
					
					// Only log if there's an error or no residence found (for debugging)
					if (residenceError) {
						console.error('[Middleware] Error checking syndic residence:', residenceError);
					}
					
					if (!residence) {
						console.log('[Middleware] No residence found for syndic, redirecting to waiting-residence');
						// Document approved but no residence assigned yet
						return NextResponse.redirect(new URL("/app/waiting-residence", req.url));
					}
					// Residence found - allow access (no need to log every successful check)
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
}
