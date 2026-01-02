import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/current-user-profile
 * Returns the current user's profile information (full_name, phone_number)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Not authenticated' 
      }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    // Fetch profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone_number, role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) {
      console.error('[Current User Profile] Error fetching profile:', error);
      return NextResponse.json({ 
        success: false,
        error: 'Error fetching profile' 
      }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ 
        success: false,
        error: 'Profile not found' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: profile.id,
        full_name: profile.full_name || '',
        phone_number: profile.phone_number || null,
        role: profile.role || 'resident',
      }
    });

  } catch (error: any) {
    console.error('[Current User Profile] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

