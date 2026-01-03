import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';
import type { UpdateContributionPlanDTO, ApiResponse, ContributionPlan } from '@/types/financial.types';

// GET /api/contributions/plans/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('contribution_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[GET /api/contributions/plans/[id]] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Contribution plan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as ContributionPlan,
    });
  } catch (error: any) {
    console.error('[GET /api/contributions/plans/[id]] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/contributions/plans/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body: UpdateContributionPlanDTO = await request.json();

    const supabase = createSupabaseAdminClient();

    // Check if user is syndic
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can update contribution plans' },
        { status: 403 }
      );
    }

    // If activating this plan, deactivate others
    if (body.is_active === true) {
      const { data: plan } = await supabase
        .from('contribution_plans')
        .select('residence_id')
        .eq('id', id)
        .single();

      if (plan) {
        await supabase
          .from('contribution_plans')
          .update({ is_active: false })
          .eq('residence_id', plan.residence_id)
          .eq('is_active', true)
          .neq('id', id);
      }
    }

    const { data, error } = await supabase
      .from('contribution_plans')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[PUT /api/contributions/plans/[id]] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as ContributionPlan,
      message: 'Contribution plan updated successfully',
    });
  } catch (error: any) {
    console.error('[PUT /api/contributions/plans/[id]] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/contributions/plans/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    // Check if user is syndic
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can delete contribution plans' },
        { status: 403 }
      );
    }

    // Check if plan has related contributions - prevent deletion if contributions exist
    const { data: relatedContributions, error: contributionsError } = await supabase
      .from('contributions')
      .select('id')
      .eq('contribution_plan_id', id)
      .limit(1);

    if (contributionsError) {
      console.error('[DELETE /api/contributions/plans/[id]] Error checking contributions:', contributionsError);
      return NextResponse.json(
        { success: false, error: 'Failed to check for related contributions' },
        { status: 500 }
      );
    }

    if (relatedContributions && relatedContributions.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot delete plan: This plan has related contributions. Plans with contributions cannot be deleted to maintain financial integrity.' 
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('contribution_plans')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DELETE /api/contributions/plans/[id]] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Contribution plan deleted successfully',
    });
  } catch (error: any) {
    console.error('[DELETE /api/contributions/plans/[id]] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

