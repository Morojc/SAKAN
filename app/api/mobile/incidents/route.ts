import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createIncident } from '@/app/app/incidents/actions';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * Helper to get user's residence ID
 */
async function getUserResidenceId(userId: string, userRole: string, supabase: any): Promise<number | null> {
  if (userRole === 'syndic') {
    const { data } = await supabase.from('residences').select('id').eq('syndic_user_id', userId).maybeSingle();
    return data?.id || null;
  } else if (userRole === 'guard') {
    const { data } = await supabase.from('residences').select('id').eq('guard_user_id', userId).maybeSingle();
    return data?.id || null;
  } else if (userRole === 'resident') {
    const { data } = await supabase.from('profile_residences').select('residence_id').eq('profile_id', userId).limit(1).maybeSingle();
    return data?.residence_id || null;
  }
  return null;
}

/**
 * Mobile API: Incidents
 * GET /api/mobile/incidents - Get all incidents
 * POST /api/mobile/incidents - Create incident
 */

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const userId = session.user.id;

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !userProfile) {
      return NextResponse.json({ success: false, error: 'Failed to fetch user profile' }, { status: 400 });
    }

    const residenceId = await getUserResidenceId(userId, userProfile.role, supabase);
    if (!residenceId) {
      return NextResponse.json({ success: false, error: 'User has no residence assigned' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    // Fetch incidents with joins
    let incidentsQuery = supabase
      .from('incidents')
      .select(`
        *,
        reporter:user_id (
          id,
          full_name
        ),
        assignee:assigned_to (
          id,
          full_name
        ),
        residences:residence_id (
          id,
          name,
          address
        )
      `)
      .eq('residence_id', residenceId);

    // Role-based filtering
    if (userProfile.role === 'resident') {
      incidentsQuery = incidentsQuery.eq('user_id', userId);
    }

    // Status filter
    if (status) {
      incidentsQuery = incidentsQuery.eq('status', status);
    }

    const { data: incidents, error: incidentsError } = await incidentsQuery.order('created_at', { ascending: false });

    if (incidentsError) {
      return NextResponse.json({ success: false, error: incidentsError.message }, { status: 400 });
    }

    // Transform incidents
    const incidentsWithNames = (incidents || []).map((incident: any) => ({
      ...incident,
      reporter_name: incident.reporter?.full_name || 'Unknown',
      assignee_name: incident.assignee?.full_name || null,
      residence_name: incident.residences?.name || 'Unknown',
    }));

    return NextResponse.json({ success: true, data: incidentsWithNames });
  } catch (error: any) {
    console.error('[Mobile API] Incidents GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = await createIncident(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[Mobile API] Incidents POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

