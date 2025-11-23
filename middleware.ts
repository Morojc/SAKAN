import authConfig from "@/lib/auth.config"
import NextAuth from "next-auth"
import { NextResponse } from "next/server"

export const config = {
	matcher: ["/app/:path*"],
};

const { auth } = NextAuth(authConfig)

export default auth((req) => {
	if (!req.auth) {
		return NextResponse.redirect(new URL("/api/auth/signin", req.url));
	}
	
	// Add pathname to headers for use in server components
	const response = NextResponse.next();
	response.headers.set('x-pathname', req.nextUrl.pathname);
	
	// Note: Replacement email check is done in app/app/layout.tsx
	// to avoid Edge Runtime limitations with Supabase client
	return response;
});