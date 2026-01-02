import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getUserResidenceId } from '@/lib/residence-utils';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const residenceId = parseInt(id);

    if (isNaN(residenceId)) {
      return NextResponse.json({ error: 'Invalid residence ID' }, { status: 400 });
    }

    const supabase = await createSupabaseAdminClient();

    // Verify user's residence ownership
    const userResidenceId = await getUserResidenceId(supabase, userId);
    if (userResidenceId !== residenceId) {
      return NextResponse.json({ error: 'Unauthorized to access this residence' }, { status: 403 });
    }

    // Fetch residence with total_apartments
    const { data: residence, error } = await supabase
      .from('residences')
      .select('total_apartments')
      .eq('id', residenceId)
      .single();

    if (error) {
      console.error('Error fetching residence:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      total_apartments: residence?.total_apartments || null 
    }, { status: 200 });
  } catch (error: any) {
    console.error('Unexpected error in total-apartments API:', error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 });
  }
}

