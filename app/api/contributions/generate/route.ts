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
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[POST /api/contributions/generate] Profile error:', profileError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    if (profile?.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can generate contributions' },
        { status: 403 }
      );
    }

    // Call the database function to generate contributions
    console.log('[POST /api/contributions/generate] Calling RPC with:', {
      p_residence_id: residence_id,
      p_period_start: period_start,
      p_period_end: period_end,
    });

    const { data, error } = await supabase.rpc('generate_contributions_for_period', {
      p_residence_id: residence_id,
      p_period_start: period_start,
      p_period_end: period_end,
    });

    if (error) {
      console.error('[POST /api/contributions/generate] RPC Error:', error);
      console.error('[POST /api/contributions/generate] Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(
        { 
          success: false, 
          error: error.message || 'Failed to generate contributions',
          details: {
            code: error.code,
            hint: error.hint,
          }
        },
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

