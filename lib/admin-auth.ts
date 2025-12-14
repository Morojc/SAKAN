'use server'

import { cookies } from 'next/headers'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export interface AdminUser {
  id: string
  email: string
  full_name: string
  is_active: boolean
}

export async function getAdminUser(): Promise<AdminUser | null> {
  try {
    // Get admin session from cookie
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('admin_session')?.value

    if (!sessionToken) {
      console.log('[Admin Auth] No admin session cookie found')
      return null
    }

    const supabase = createSupabaseAdminClient()

    // Verify admin session
    const { data: session } = await supabase
      .from('admin_sessions')
      .select('admin_id, expires_at')
      .eq('token', sessionToken)
      .maybeSingle()

    if (!session || new Date(session.expires_at) < new Date()) {
      console.log('[Admin Auth] Invalid or expired admin session')
      return null
    }

    // Get admin details
    const { data: admin } = await supabase
      .from('admins')
      .select('id, email, full_name, is_active')
      .eq('id', session.admin_id)
      .eq('is_active', true)
      .maybeSingle()

    if (!admin) {
      console.log('[Admin Auth] Admin not found or not active')
      return null
    }

    return admin as AdminUser
  } catch (error) {
    console.error('[Admin Auth] Error getting admin user:', error)
    return null
  }
}

export async function getAdminId(): Promise<string | null> {
  const admin = await getAdminUser()
  return admin?.id || null
}
