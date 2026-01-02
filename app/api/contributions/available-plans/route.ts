import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

// GET /api/contributions/available-plans?residenceId=1&periodStart=2025-01-01&periodEnd=2025-01-31
// Returns plans that haven't been applied for the given period
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
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');

    if (!residenceId || !periodStart || !periodEnd) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: residenceId, periodStart, periodEnd' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Check if user is syndic
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile?.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can view available plans' },
        { status: 403 }
      );
    }

    const periodStartDate = new Date(periodStart);
    const periodEndDate = new Date(periodEnd);

    // Get all plans (active and inactive) that could cover this period
    const { data: allPlans, error: plansError } = await supabase
      .from('contribution_plans')
      .select('id, plan_name, period_type, amount_per_period, start_date, end_date, is_active')
      .eq('residence_id', parseInt(residenceId))
      .lte('start_date', periodEnd)
      .order('created_at', { ascending: false });

    if (plansError) {
      console.error('[GET /api/contributions/available-plans] Error:', plansError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch plans' },
        { status: 500 }
      );
    }

    if (!allPlans || allPlans.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No plans found for this residence',
      });
    }

    // Check which plans have already been applied for this period
    const { data: existingContributions, error: contribError } = await supabase
      .from('contributions')
      .select('contribution_plan_id')
      .eq('residence_id', parseInt(residenceId))
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd);

    if (contribError) {
      console.error('[GET /api/contributions/available-plans] Error checking contributions:', contribError);
      return NextResponse.json(
        { success: false, error: 'Failed to check existing contributions' },
        { status: 500 }
      );
    }

    const appliedPlanIds = new Set(
      (existingContributions || []).map((c: any) => c.contribution_plan_id).filter(Boolean)
    );

    // Filter plans that:
    // 1. Overlap with the period
    // 2. Haven't been applied yet (or don't have contributions for this period)
    const availablePlans = allPlans
      .filter((plan: any) => {
        const planStart = new Date(plan.start_date);
        const planEnd = plan.end_date ? new Date(plan.end_date) : null;
        
        // Check if plan overlaps with period
        const overlaps = planStart <= periodEndDate && (!planEnd || planEnd >= periodStartDate);
        
        // Check if plan hasn't been applied for this period
        const notApplied = !appliedPlanIds.has(plan.id);
        
        return overlaps && notApplied;
      })
      .map((plan: any) => ({
        id: plan.id,
        plan_name: plan.plan_name,
        period_type: plan.period_type,
        amount_per_period: plan.amount_per_period,
        is_active: plan.is_active,
        start_date: plan.start_date,
        end_date: plan.end_date,
      }));

    return NextResponse.json({
      success: true,
      data: availablePlans,
      message: `Found ${availablePlans.length} available plan(s) for this period`,
    });
  } catch (error: any) {
    console.error('[GET /api/contributions/available-plans] Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

