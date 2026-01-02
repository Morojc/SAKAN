import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const residenceId = searchParams.get('residenceId');

    if (!residenceId) {
      return NextResponse.json(
        { error: 'Residence ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseAdminClient();

    // Fetch all verified residents in the residence
    const { data: residents, error } = await supabase
      .from('profile_residences')
      .select(`
        apartment_number,
        profile_id,
        verified,
        profiles:profile_id(
          id,
          full_name
        )
      `)
      .eq('residence_id', parseInt(residenceId))
      .eq('verified', true)
      .order('apartment_number');

    if (error) {
      console.error('Error fetching apartments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch apartments' },
        { status: 500 }
      );
    }

    // Format the data
    const apartments = (residents || []).map((resident: any) => ({
      number: resident.apartment_number,
      residentName: resident.profiles?.full_name || 'Unknown',
      residentId: resident.profile_id,
    }));

    return NextResponse.json({ apartments });
  } catch (error: any) {
    console.error('Error in apartments API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

