import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

// POST /api/contributions/generate
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { residence_id, period_start, period_end } = body;

    if (!residence_id || !period_start || !period_end) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: residence_id, period_start, period_end' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Check if user is syndic of this residence
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can generate contributions' },
        { status: 403 }
      );
    }

    // Call the database function to generate contributions
    const { data, error } = await supabase.rpc('generate_contributions_for_period', {
      p_residence_id: residence_id,
      p_period_start: period_start,
      p_period_end: period_end,
    });

    if (error) {
      console.error('[POST /api/contributions/generate] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { count: data },
      message: `Successfully generated ${data} contribution(s)`,
    });
  } catch (error: any) {
    console.error('[POST /api/contributions/generate] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

