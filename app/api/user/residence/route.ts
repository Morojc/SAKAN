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

    // Use maybeSingle() to handle cases where no residence link exists
    const { data: profileResidence, error } = await supabase
      .from('profile_residences')
      .select('residence_id, apartment_number, verified')
      .eq('profile_id', session.user.id)
      .maybeSingle();

    // Log for debugging
    console.log('[GET /api/user/residence] User ID:', session.user.id);
    console.log('[GET /api/user/residence] Query error:', error);
    console.log('[GET /api/user/residence] Profile residence data:', profileResidence);

    // Check for actual database errors
    if (error) {
      console.error('[GET /api/user/residence] Database error:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database error while fetching residence',
          details: {
            user_id: session.user.id,
            error_code: error.code,
            error_message: error.message
          }
        },
        { status: 500 }
      );
    }

    // No residence link found (this is expected if user isn't linked yet)
    // Return 200 with success: false instead of 404 to avoid browser error display
    if (!profileResidence) {
      console.warn('[GET /api/user/residence] No residence link found for user:', session.user.id);
      return NextResponse.json(
        { 
          success: false, 
          error: 'No residence found for this user. Please link your profile to a residence.',
          details: {
            user_id: session.user.id,
            suggestion: 'Run the SQL script in supabase/helpers/link_user_to_residence.sql'
          }
        },
        { status: 200 } // Return 200 instead of 404 to avoid browser error
      );
    }

    // Fetch residence details separately (matching the working pattern)
    const { data: residence } = await supabase
      .from('residences')
      .select('id, name, address, city')
      .eq('id', profileResidence.residence_id)
      .maybeSingle();

    // Get user's role from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        residence_id: profileResidence.residence_id,
        apartment_number: profileResidence.apartment_number,
        verified: profileResidence.verified,
        role: profile?.role || 'resident',
        residence: residence || null,
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

