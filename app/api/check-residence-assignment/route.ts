import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const session = await auth()
    const userId = session?.user?.id

    console.log('[Check Residence] Checking for user:', userId)

    if (!userId) {
      console.log('[Check Residence] No userId found')
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = createSupabaseAdminClient()

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, verified')
      .eq('id', userId)
      .maybeSingle()

    console.log('[Check Residence] Profile:', profile, 'Error:', profileError)

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    let hasResidence = false
    let residenceDetails = null

    // Check based on role
    if (profile.role === 'syndic') {
      const { data: residence, error: resError } = await supabase
        .from('residences')
        .select('id, name, syndic_user_id')
        .eq('syndic_user_id', userId)
        .maybeSingle()
      
      console.log('[Check Residence] Syndic residence check:', residence, 'Error:', resError)
      hasResidence = !!residence
      residenceDetails = residence
    } else if (profile.role === 'guard') {
      const { data: residence } = await supabase
        .from('residences')
        .select('id, name, guard_user_id')
        .eq('guard_user_id', userId)
        .maybeSingle()
      
      hasResidence = !!residence
      residenceDetails = residence
    } else if (profile.role === 'resident') {
      const { data: pr } = await supabase
        .from('profile_residences')
        .select('residence_id')
        .eq('profile_id', userId)
        .limit(1)
        .maybeSingle()
      
      hasResidence = !!pr
      residenceDetails = pr
    }

    console.log('[Check Residence] Final result:', { hasResidence, role: profile.role, verified: profile.verified })

    return NextResponse.json({ 
      hasResidence,
      role: profile.role,
      verified: profile.verified,
      residenceDetails
    })

  } catch (error: any) {
    console.error('Error checking residence assignment:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 })
  }
}

