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

    // Call the database function to generate contributions
    const { data, error } = await supabase.rpc('generate_contributions_for_period', {
      p_residence_id: residence_id,
      p_period_start: period_start,
      p_period_end: period_end,
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
