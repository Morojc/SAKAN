import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * POST /api/check-apartment
 * Check if an apartment number is already reserved in a residence
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
    const { apartment_number, residence_id } = body;

    if (!apartment_number || typeof apartment_number !== 'string') {
      return NextResponse.json({ 
        success: false,
        error: 'Apartment number is required' 
      }, { status: 400 });
    }

    if (!residence_id) {
      return NextResponse.json({ 
        success: false,
        error: 'Residence ID is required' 
      }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Check if apartment is already taken in this residence
    const { data: existingReservation, error } = await supabase
      .from('profile_residences')
      .select('id, profile_id, apartment_number')
      .eq('residence_id', Number(residence_id))
      .eq('apartment_number', apartment_number.trim())
      .maybeSingle();

    if (error) {
      console.error('[Check Apartment] Error checking apartment:', error);
      return NextResponse.json({ 
        success: false,
        error: 'Error checking apartment availability' 
      }, { status: 500 });
    }

    if (existingReservation) {
      // Get the name of the resident who has this apartment
      const { data: residentProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', existingReservation.profile_id)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        available: false,
        reservedBy: residentProfile?.full_name || 'another resident',
        message: `Apartment ${apartment_number.trim()} is already reserved by ${residentProfile?.full_name || 'another resident'} in this residence.`
      });
    }

    return NextResponse.json({
      success: true,
      available: true,
      message: 'Apartment number is available.'
    });

  } catch (error: any) {
    console.error('[Check Apartment] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

