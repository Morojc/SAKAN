import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * POST /api/check-resident-other-residences
 * Check if a resident exists in other residences (besides the current one)
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Not authenticated' 
      }, { status: 401 });
    }

    const body = await req.json();
    const { resident_id, residence_id } = body;

    if (!resident_id || !residence_id) {
      return NextResponse.json({ 
        success: false,
        error: 'Resident ID and Residence ID are required' 
      }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Check if resident exists in other residences
    const { data: otherResidences, error } = await supabase
      .from('profile_residences')
      .select('residence_id')
      .eq('profile_id', resident_id)
      .neq('residence_id', Number(residence_id));

    if (error) {
      console.error('[Check Resident Other Residences] Error checking:', error);
      return NextResponse.json({ 
        success: false,
        error: 'Error checking other residences' 
      }, { status: 500 });
    }

    const existsInOtherResidences = otherResidences && otherResidences.length > 0;

    // If exists in other residences, get the profile data
    let profileData: { full_name: string; phone_number: string | null; role: string } | null = null;
    if (existsInOtherResidences) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone_number, role')
        .eq('id', resident_id)
        .maybeSingle();
      
      if (profile) {
        profileData = {
          full_name: profile.full_name,
          phone_number: profile.phone_number,
          role: profile.role || 'resident',
        };
      }
    }

    return NextResponse.json({
      success: true,
      existsInOtherResidences: existsInOtherResidences,
      profileData: profileData,
    });

  } catch (error: any) {
    console.error('[Check Resident Other Residences] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

