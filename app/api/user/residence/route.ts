import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

// GET /api/user/residence - Get the user's residence ID
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Get user's residence from profile_residences and role from profiles
    const { data: profileResidence, error } = await supabase
      .from('profile_residences')
      .select(`
        residence_id,
        apartment_number,
        verified,
        residence:residences(id, name, address, city)
      `)
      .eq('profile_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Log for debugging
    console.log('[GET /api/user/residence] User ID:', session.user.id);
    console.log('[GET /api/user/residence] Query error:', error);
    console.log('[GET /api/user/residence] Profile residence data:', profileResidence);

    if (error || !profileResidence) {
      console.error('[GET /api/user/residence] No residence found for user:', session.user.id);
      return NextResponse.json(
        { 
          success: false, 
          error: 'No residence found for this user',
          details: {
            user_id: session.user.id,
            error_code: error?.code,
            error_message: error?.message
          }
        },
        { status: 404 }
      );
    }

    // Get user's role from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        residence_id: profileResidence.residence_id,
        apartment_number: profileResidence.apartment_number,
        verified: profileResidence.verified,
        role: profile?.role || 'resident',
        residence: profileResidence.residence,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/user/residence] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

