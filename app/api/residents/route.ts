import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const residenceId = searchParams.get('residenceId');

    if (!residenceId) {
      return NextResponse.json({ error: 'Residence ID is required' }, { status: 400 });
    }

    const supabase = await createSupabaseAdminClient();

    // Get all residents for the residence
    const { data: profileResidences, error } = await supabase
      .from('profile_residences')
      .select(`
        profile_id,
        apartment_number,
        verified,
        profiles:profile_id (
          id,
          full_name,
          email
        )
      `)
      .eq('residence_id', residenceId)
      .eq('verified', true)
      .order('apartment_number', { ascending: true });

    if (error) {
      console.error('Error fetching residents:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format the response
    const residents = profileResidences?.map((pr: any) => ({
      id: pr.profiles.id,
      full_name: pr.profiles.full_name,
      email: pr.profiles.email,
      apartment_number: pr.apartment_number,
    })) || [];

    return NextResponse.json({ residents });
  } catch (error: any) {
    console.error('Error in residents API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

