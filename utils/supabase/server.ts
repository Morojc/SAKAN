import { createClient } from '@supabase/supabase-js'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Database } from '@/types/database.types'

/**
 * Get authenticated Supabase client for server components and API routes
 * @param options - Optional configuration
 * @param options.throwOnUnauthenticated - If true, throws error instead of redirecting (for API routes)
 * @returns Supabase client with user's JWT token
 * @throws Error if no session and throwOnUnauthenticated is true
 */
const getSupabaseClient = async (options?: { throwOnUnauthenticated?: boolean }) => {
	const session = await auth()

	if (!session?.supabaseAccessToken) {
		// In API routes, throw error instead of redirecting
		if (options?.throwOnUnauthenticated) {
			throw new Error('User not authenticated')
		}
		// In server components, redirect to home
		redirect('/')
	}
	
	// session.supabaseAccessToken 来创建 supabase client
	// Note: Using 'dbasakan' schema for this project
	return createClient<Database>(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			db: {
				schema: 'dbasakan' as any, // Custom schema for this project
			},
			global: {
				headers: {
					Authorization: `Bearer ${session.supabaseAccessToken}`,
				},
			},
		}
	)
}

function createSupabaseAdminClient() {
	// server api - uses service_role key for admin access
	// Note: Using 'dbasakan' schema for this project
	return createClient<Database>(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SECRET_KEY!,
		{
			db: {
				schema: 'dbasakan' as any, // Custom schema for this project (not in Database type)
			},
			auth: {
				persistSession: false,
			},
		}
	)
}
export { getSupabaseClient, createSupabaseAdminClient }