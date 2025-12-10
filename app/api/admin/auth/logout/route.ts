import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('admin_session')?.value

    if (sessionToken) {
      // Delete session from database
      const supabase = createSupabaseAdminClient()
      await supabase
        .from('admin_sessions')
        .delete()
        .eq('token', sessionToken)
    }

    // Clear cookie
    cookieStore.delete('admin_session')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin Logout] Error:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

export async function GET(_request: NextRequest) {
  // Also support GET for simple logout links
  return POST(_request)
}

