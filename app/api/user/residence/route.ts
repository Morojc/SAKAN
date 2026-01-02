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
    const userId = session.user.id;

    // 1. Try to find link in profile_residences (for residents)
    let { data: profileResidence, error } = await supabase
      .from('profile_residences')
      .select('residence_id, apartment_number, verified')
      .eq('profile_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[GET /api/user/residence] Database error (profile_residences):', error);
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    }

    let role = 'resident';
    let residenceId = profileResidence?.residence_id;
    let apartmentNumber = profileResidence?.apartment_number;
    let verified = profileResidence?.verified || false;

    // 2. If not found in profile_residences, check if user is a syndic or guard in residences table
    if (!profileResidence) {
      // Check if user is a syndic
      const { data: syndicResidence, error: syndicError } = await supabase
        .from('residences')
        .select('id')
        .eq('syndic_user_id', userId)
        .maybeSingle();

      if (syndicResidence) {
        residenceId = syndicResidence.id;
        role = 'syndic';
        verified = true; // Syndics are implicitly verified
        // Syndics might not have an apartment number if not linked in profile_residences
      } else {
        // Check if user is a guard
        const { data: guardResidence, error: guardError } = await supabase
          .from('residences')
          .select('id')
          .eq('guard_user_id', userId)
          .maybeSingle();

        if (guardResidence) {
          residenceId = guardResidence.id;
          role = 'guard';
          verified = true; // Guards are implicitly verified
        }
      }
    } else {
      // If found in profile_residences, we still need the role from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (profile) {
        role = profile.role;
      }
    }

    // 3. If still no residence found
    if (!residenceId) {
      console.warn('[GET /api/user/residence] No residence link found for user:', userId);
      return NextResponse.json(
        { 
          success: false, 
          error: 'No residence found for this user. Please link your profile to a residence.',
          details: {
            user_id: userId,
            suggestion: 'Run the SQL script in supabase/helpers/link_user_to_residence.sql'
          }
        },
        { status: 200 } // Return 200 instead of 404 to avoid browser error
      );
    }

    // 4. Fetch residence details
    const { data: residence, error: residenceFetchError } = await supabase
      .from('residences')
      .select('id, name, address, city')
      .eq('id', residenceId)
      .single();

    if (residenceFetchError) {
       console.error('[GET /api/user/residence] Error fetching residence details:', residenceFetchError);
    }

    return NextResponse.json({
      success: true,
      data: {
        residence_id: residenceId,
        apartment_number: apartmentNumber,
        verified: verified,
        role: role,
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
