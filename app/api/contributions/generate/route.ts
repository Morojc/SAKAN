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
    const { residence_id, period_start, period_end, plan_id } = body;

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
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    if (!profile || profile.role !== 'syndic') {
      return NextResponse.json(
        { success: false, error: 'Only syndics can generate contributions' },
        { status: 403 }
      );
    }

    // If plan_id is provided, use that specific plan; otherwise find active plan
    let activePlan: any = null;
    
    if (plan_id) {
      // Get the specific plan
      const { data: plan, error: planError } = await supabase
        .from('contribution_plans')
        .select('id, period_type, start_date, end_date, is_active')
        .eq('id', plan_id)
        .eq('residence_id', residence_id)
        .maybeSingle();
      
      if (planError) {
        console.error('[POST /api/contributions/generate] Error fetching plan:', planError);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch contribution plan' },
          { status: 500 }
        );
      }
      
      if (!plan) {
        return NextResponse.json(
          { success: false, error: 'Contribution plan not found' },
          { status: 404 }
        );
      }
      
      activePlan = plan;
    } else {
      // Get all active plans and find one that overlaps with the period
      const { data: allActivePlans, error: planError } = await supabase
        .from('contribution_plans')
        .select('id, period_type, start_date, end_date, is_active')
        .eq('residence_id', residence_id)
        .eq('is_active', true);

      if (planError) {
        console.error('[POST /api/contributions/generate] Error fetching plan:', planError);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch contribution plan' },
          { status: 500 }
        );
      }

      if (!allActivePlans || allActivePlans.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No active contribution plan found for this period' },
          { status: 400 }
        );
      }

      // Find plan that overlaps with the period
      const periodStartDate = new Date(period_start);
      const periodEndDate = new Date(period_end);
      
      activePlan = allActivePlans.find((p: any) => {
        const planStart = new Date(p.start_date);
        const planEnd = p.end_date ? new Date(p.end_date) : null;
        
        return planStart <= periodEndDate && (!planEnd || planEnd >= periodStartDate);
      });

      if (!activePlan) {
        return NextResponse.json(
          { success: false, error: 'No active contribution plan found that covers this period' },
          { status: 400 }
        );
      }
    }

    // Use the period dates from the request - they are already calculated based on plan's start_date
    // The frontend calculates periods correctly based on the plan's start_date and period_type
    let calculatedPeriodStart = period_start;
    let calculatedPeriodEnd = period_end;

    // Validate that the period aligns with the plan's start_date
    // This ensures the period is a valid period for this plan
    const planStartDate = new Date(activePlan.start_date);
    const periodStartDate = new Date(period_start);
    const periodEndDate = new Date(period_end);
    
    // Check if period is within plan's date range
    if (periodStartDate < planStartDate) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Period start (${period_start}) is before plan start date (${activePlan.start_date})` 
        },
        { status: 400 }
      );
    }
    
    if (activePlan.end_date) {
      const planEndDate = new Date(activePlan.end_date);
      if (periodEndDate > planEndDate) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Period end (${period_end}) is after plan end date (${activePlan.end_date})` 
          },
          { status: 400 }
        );
      }
    }

    // Check if contributions already exist for this plan and period
    const { data: existingContributions, error: checkError } = await supabase
      .from('contributions')
      .select('id')
      .eq('residence_id', residence_id)
      .eq('contribution_plan_id', activePlan.id)
      .eq('period_start', calculatedPeriodStart)
      .eq('period_end', calculatedPeriodEnd)
      .limit(1);
    
    if (checkError) {
      console.error('[POST /api/contributions/generate] Error checking existing contributions:', checkError);
    }
    
    if (existingContributions && existingContributions.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Contributions already exist for this plan and period',
          already_applied: true,
          plan_id: activePlan.id,
        },
        { status: 400 }
      );
    }

    // Log the plan and period being used for debugging
    console.log('[POST /api/contributions/generate] Using plan:', {
      plan_id: activePlan.id,
      period_type: activePlan.period_type,
      original_period: { start: period_start, end: period_end },
      calculated_period: { start: calculatedPeriodStart, end: calculatedPeriodEnd },
    });

    // Call the database function to generate contributions
    // Pass the plan_id we found to avoid the database function searching again
    const { data, error } = await supabase.rpc('generate_contributions_for_period', {
      p_residence_id: residence_id,
      p_period_start: calculatedPeriodStart,
      p_period_end: calculatedPeriodEnd,
      p_plan_id: activePlan.id, // Pass the plan_id we already found
    });

    if (error) {
      console.error('[POST /api/contributions/generate] RPC Error:', error);
      
      // DIAGNOSTIC LOGIC: Help the user understand WHY it failed
      if (error.message && error.message.includes('No active contribution plan')) {
        
        // 1. Check if ANY plan exists for this residence
        const { data: plans } = await supabase
          .from('contribution_plans')
          .select('*')
          .eq('residence_id', residence_id);
          
        if (!plans || plans.length === 0) {
          return NextResponse.json({ 
            success: false, 
            error: 'No active contribution plan found. Please create a contribution plan first.',
            details: 'No plans exist for this residence.'
          }, { status: 400 });
        }

        // 2. Check for Active plans
        const activePlans = plans.filter((p: any) => p.is_active);
        
        if (activePlans.length === 0) {
          return NextResponse.json({ 
            success: false, 
            error: 'No active contribution plan found. Please activate a plan in settings.',
            details: `Found ${plans.length} plans, but none are active.`
          }, { status: 400 });
        }

        // 3. Check dates of active plans
        const validDatePlans = activePlans.filter((p: any) => {
          return p.start_date <= period_end && (!p.end_date || p.end_date >= period_start);
        });

        if (validDatePlans.length === 0) {
          const plan = activePlans[0];
          return NextResponse.json({ 
            success: false, 
            error: `Active plan found ("${plan.plan_name}"), but its dates don't cover this period.`,
            details: `Plan starts ${plan.start_date}. Generating for ${period_start}. Please update the plan start date to be on or before the generation period, or run the SQL fix to allow overlaps.`
          }, { status: 400 });
        }
      }

      return NextResponse.json(
        { 
          success: false, 
          error: error.message || 'Failed to generate contributions',
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
