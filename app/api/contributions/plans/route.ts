import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';
import type { CreateContributionPlanDTO, ApiResponse, ContributionPlan } from '@/types/financial.types';

// GET /api/contributions/plans?residenceId=1
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const residenceId = searchParams.get('residenceId');

    if (!residenceId) {
      return NextResponse.json(
        { success: false, error: 'Residence ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('contribution_plans')
      .select('*')
      .eq('residence_id', residenceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET /api/contributions/plans] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as ContributionPlan[],
    });
  } catch (error: any) {
    console.error('[GET /api/contributions/plans] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/contributions/plans
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreateContributionPlanDTO = await request.json();

    // Validate required fields
    if (!body.residence_id || !body.plan_name || !body.amount_per_period || !body.period_type || !body.start_date) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
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
        { success: false, error: 'Only syndics can create contribution plans' },
        { status: 403 }
      );
    }

    // Deactivate other plans if this is set to active
    if (body.applies_to_all_apartments !== false) {
      await supabase
        .from('contribution_plans')
        .update({ is_active: false })
        .eq('residence_id', body.residence_id)
        .eq('is_active', true);
    }

    const { data, error } = await supabase
      .from('contribution_plans')
      .insert({
        ...body,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('[POST /api/contributions/plans] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as ContributionPlan,
      message: 'Contribution plan created successfully',
    });
  } catch (error: any) {
    console.error('[POST /api/contributions/plans] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

