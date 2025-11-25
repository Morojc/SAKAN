import { cookies } from 'next/headers'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export interface AdminUser {
  id: string
  email: string
  full_name: string
  is_active: boolean
}

/**
 * Get current admin user from session
 * Returns null if not authenticated or session expired
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('admin_session')?.value

    if (!sessionToken) {
      return null
    }

    const supabase = createSupabaseAdminClient()

    // Get session from database
    const { data: session, error: sessionError } = await supabase
      .from('admin_sessions')
      .select('admin_id, expires_at')
      .eq('token', sessionToken)
      .single()

    if (sessionError || !session) {
      return null
    }

    // Check if session expired
    if (new Date(session.expires_at) < new Date()) {
      // Delete expired session
      await supabase
        .from('admin_sessions')
        .delete()
        .eq('token', sessionToken)
      
      return null
    }

    // Get admin details
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, email, full_name, is_active')
      .eq('id', session.admin_id)
      .single()

    if (adminError || !admin || !admin.is_active) {
      return null
    }

    return {
      id: admin.id,
      email: admin.email,
      full_name: admin.full_name,
      is_active: admin.is_active,
    }
  } catch (error) {
    console.error('[Admin Auth] Error getting admin user:', error)
    return null
  }
}

/**
 * Require admin authentication
 * Throws error if not authenticated
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser()
  
  if (!admin) {
    throw new Error('Authentication required')
  }

  return admin
}

